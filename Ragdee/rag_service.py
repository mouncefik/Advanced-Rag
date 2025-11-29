import os
import json
import math
import glob
from dataclasses import dataclass
from typing import List, Dict, Any, Optional, Tuple

try:
    from dotenv import load_dotenv
    load_dotenv()   
except ImportError:
    pass 

try:
    from openai import OpenAI
except ImportError:
    OpenAI = None  


@dataclass
class SourceChunk:
    text: str
    page: int
    line: int
    meta: Dict[str, Any]
    embedding: Optional[List[float]] = None


class RagService:
    """
    Retrieval-Augmented Generation service using OpenAI embeddings and models.

    - Indexes extracted content from recognition JSONs produced during uploads.
    - Tracks original positions (page, line) for precise citations.
    - Answers queries grounded in the indexed content.
    - Returns top-3 source contributions with percentages.
    """

    def __init__(
        self,
        embedding_model: Optional[str] = None,
        answer_model: Optional[str] = None,
        api_key_env: str = "OPENAI_API_KEY",
        max_tokens: Optional[int] = None,
        temperature: Optional[float] = None,
    ) -> None:
        api_key = os.getenv(api_key_env)
        if OpenAI is None:
            raise RuntimeError(
                "OpenAI SDK not available. Install with `pip install openai` and set OPENAI_API_KEY."
            )
        if not api_key:
            raise RuntimeError("Missing OPENAI_API_KEY environment variable.")

        self.client = OpenAI()
        
        # Load configuration from environment variables with fallbacks
        self.embedding_model = embedding_model or os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        self.answer_model = answer_model or os.getenv("ANSWER_MODEL", "gpt-4o-mini")
        self.max_tokens = max_tokens or int(os.getenv("MAX_TOKENS", "4096"))
        self.temperature = temperature or float(os.getenv("TEMPERATURE", "0.2"))
        # New relation config
        self.relation_window_default = int(os.getenv("RELATION_WINDOW", "2"))
        self.include_relations_default = os.getenv("INCLUDE_RELATIONS", "true").lower() in ("1", "true", "yes")
        
        self._chunks: List[SourceChunk] = []
        self._page_index: Dict[int, List[int]] = {}
        # Relation index: chunk_idx -> neighbor indices
        self._relations: Dict[int, List[int]] = {}
        # Optional for quick lookup by page
        self._page_index: Dict[int, List[int]] = {}

    # --------------- Indexing ---------------
    def clear_index(self) -> None:
        self._chunks.clear()
        self._page_index.clear()

    def index_recognition_dir(self, recognition_dir: str) -> int:
        """
        Index all JSON files under a recognition_json directory.
        Attempts to preserve page/line; if line is unavailable, uses item index.
        Returns the number of chunks indexed.
        """
        recognition_dir = os.path.abspath(recognition_dir)
        if not os.path.isdir(recognition_dir):
            raise FileNotFoundError(f"Recognition dir not found: {recognition_dir}")

        total = 0
        self.clear_index()

        json_files = sorted(glob.glob(os.path.join(recognition_dir, "**", "*.json"), recursive=True))
        if not json_files:
            # If directory structure differs, allow reading a single summary.json
            json_files = [os.path.join(recognition_dir, "summary.json")] if os.path.exists(os.path.join(recognition_dir, "summary.json")) else []

        for jf in json_files:
            try:
                with open(jf, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception:
                continue

            # Infer page from filename if not present in items
            page_hint = self._infer_page_from_filename(os.path.basename(jf))

            # Normalize to iterable of items
            items = []
            if isinstance(data, dict):
                if "items" in data and isinstance(data["items"], list):
                    items = data["items"]
                else:
                    # If dict and contains text-like fields, treat it as a single item
                    if any(k in data for k in ("text", "content")):
                        items = [data]
            elif isinstance(data, list):
                items = data

            # Build line counter per page
            line_counter: Dict[int, int] = {}

            for idx, item in enumerate(items):
                text = self._extract_text(item)
                if not text:
                    continue

                page = self._extract_page(item, page_hint)
                # line number preference order: explicit fields -> fallback to idx
                line = self._extract_line(item)
                if line is None:
                    prev = line_counter.get(page, 0)
                    line = prev + 1
                    line_counter[page] = line

                chunk = SourceChunk(text=text.strip(), page=page, line=line, meta=item)
                self._chunks.append(chunk)
                total += 1

        # Compute embeddings in batches for efficiency
        self._embed_all()
        self._rebuild_page_index()
        return total

    def _infer_page_from_filename(self, name: str) -> Optional[int]:
        # Try patterns like: page_005.json, *_page_001_*.json, *_page_1.json, 1.json
        import re
        m = re.search(r"page[_-]?(\d+)", name)
        if m:
            try:
                return int(m.group(1))
            except ValueError:
                pass
        m2 = re.search(r"(\d+)\.json$", name)
        if m2:
            try:
                return int(m2.group(1))
            except ValueError:
                pass
        return None

    def _extract_text(self, item: Any) -> Optional[str]:
        if isinstance(item, str):
            return item
        if not isinstance(item, dict):
            return None
        for key in ("text", "content", "value", "raw_text"):
            v = item.get(key)
            if isinstance(v, str) and v.strip():
                return v
        # If bbox-text structured
        if "lines" in item and isinstance(item["lines"], list):
            text = " ".join([l.get("text", "") for l in item["lines"] if isinstance(l, dict)])
            return text.strip() or None
        return None

    def _extract_page(self, item: Any, page_hint: Optional[int]) -> int:
        if isinstance(item, dict):
            for key in ("page", "page_no", "page_index"):
                v = item.get(key)
                if isinstance(v, int) and v >= 1:
                    return v
        return page_hint or 1

    def _extract_line(self, item: Any) -> Optional[int]:
        if isinstance(item, dict):
            for key in ("line", "line_no", "line_number", "row_index", "index"):
                v = item.get(key)
                if isinstance(v, int) and v >= 1:
                    return v
        return None

    def _embed_all(self) -> None:
        texts = [c.text for c in self._chunks]
        # Guard: OpenAI client requires non-empty input
        if not texts:
            return
        # Batch embedding
        resp = self.client.embeddings.create(model=self.embedding_model, input=texts)
        for chunk, data in zip(self._chunks, resp.data):
            chunk.embedding = data.embedding

    def _rebuild_page_index(self) -> None:
        self._page_index.clear()
        for i, c in enumerate(self._chunks):
            self._page_index.setdefault(c.page, []).append(i)
        # Build simple line-neighborhood relations per page
        self._rebuild_relations()

    def _rebuild_relations(self) -> None:
        self._relations.clear()
        # Group indices by page
        by_page: Dict[int, List[Tuple[int, int]]] = {}
        for idx, c in enumerate(self._chunks):
            by_page.setdefault(c.page, []).append((idx, c.line))
        for page, pairs in by_page.items():
            pairs.sort(key=lambda x: x[1])
            # For each chunk, add neighbors within relation_window_default
            for i, (idx, line) in enumerate(pairs):
                neighbors: List[int] = []
                # look left
                j = i - 1
                while j >= 0 and abs(pairs[j][1] - line) <= self.relation_window_default:
                    neighbors.append(pairs[j][0])
                    j -= 1
                # look right
                k = i + 1
                while k < len(pairs) and abs(pairs[k][1] - line) <= self.relation_window_default:
                    neighbors.append(pairs[k][0])
                    k += 1
                self._relations[idx] = neighbors

    # --------------- Querying ---------------
    def query(self, question: str, max_sources: int = 3, include_relations: Optional[bool] = None, relation_window: Optional[int] = None, max_group_items: int = 5) -> Dict[str, Any]:
        if not self._chunks:
            return {"answer": "No indexed content. Please index recognition JSON first.", "sources": []}

        include_rel = include_relations if include_relations is not None else self.include_relations_default
        rel_win = relation_window if relation_window is not None else self.relation_window_default

        q_emb = self._embed_query(question)
        scored = self._score_chunks(q_emb)
        seeds = scored[:max_sources]

        # Build context from seeds and their related neighbors
        total_weight = 0.0
        contributions = []
        context_parts = []
        used_indices: set[int] = set()

        def neighbor_weight(delta_line: int) -> float:
            # decay by line distance
            import math
            return math.exp(-0.3 * abs(delta_line))

        for (chunk, sim) in seeds:
            # representative
            seed_idx = self._chunks.index(chunk)
            if seed_idx in used_indices:
                continue
            used_indices.add(seed_idx)
            group_weight = sim
            related_items = []
            if include_rel:
                # collect neighbors within rel_win
                for n_idx in self._relations.get(seed_idx, []):
                    if n_idx in used_indices:
                        continue
                    n = self._chunks[n_idx]
                    if abs(n.line - chunk.line) <= rel_win and n.page == chunk.page:
                        w = neighbor_weight(n.line - chunk.line) * sim
                        related_items.append({
                            "page": n.page,
                            "line": n.line,
                            "score": w,
                            "text": n.text,
                        })
                        group_weight += w
                        used_indices.add(n_idx)
                        if len(related_items) >= max_group_items:
                            break

            total_weight += group_weight
            contributions.append({
                "page": chunk.page,
                "line": chunk.line,
                "score": group_weight,
                "text": chunk.text,
                "related": related_items if include_rel else [],
            })
            # Build context with representative and neighbors
            group_ctx = [f"[Page {chunk.page}, Line {chunk.line}] {chunk.text}"]
            for r in related_items:
                group_ctx.append(f"[Page {r['page']}, Line {r['line']}] {r['text']}")
            context_parts.append("\n".join(group_ctx))

        # Normalize to percentages
        for c in contributions:
            c["percent"] = round((c["score"] / (total_weight or 1e-9)) * 100)

        context = "\n\n".join(context_parts)
        prompt = (
            "You are a helpful assistant. Answer the user based ONLY on the provided context. "
            "If the answer is not in context, say you cannot find it in the document.\n\n"
            f"Context:\n{context}\n\n"
            f"Question: {question}"
        )

        completion = self.client.chat.completions.create(
            model=self.answer_model,
            messages=[
                {"role": "system", "content": "You ground answers strictly in provided context."},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
            max_tokens=self.max_tokens,
        )
        answer = completion.choices[0].message.content

        return {"answer": answer, "sources": contributions}

    def _embed_query(self, question: str) -> List[float]:
        resp = self.client.embeddings.create(model=self.embedding_model, input=[question])
        return resp.data[0].embedding

    def _score_chunks(self, q_emb: List[float]) -> List[Tuple[SourceChunk, float]]:
        scored: List[Tuple[SourceChunk, float]] = []
        q_norm = self._norm(q_emb)
        for c in self._chunks:
            if not c.embedding:
                continue
            sim = self._cosine(q_emb, c.embedding, q_norm, self._norm(c.embedding))
            scored.append((c, sim))
        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    @staticmethod
    def _norm(vec: List[float]) -> float:
        return math.sqrt(sum((v * v) for v in vec)) or 1e-9

    @staticmethod
    def _cosine(a: List[float], b: List[float], a_norm: float, b_norm: float) -> float:
        dot = 0.0
        # Assumes equal length
        for x, y in zip(a, b):
            dot += x * y
        return dot / (a_norm * b_norm)


# --------- Convenience helpers for api_outputs ---------

def find_latest_recognition_dir(api_outputs_dir: str) -> Optional[str]:
    """Find the latest run's recognition_json directory under api_outputs."""
    api_outputs_dir = os.path.abspath(api_outputs_dir)
    if not os.path.isdir(api_outputs_dir):
        return None
    run_dirs = [d for d in glob.glob(os.path.join(api_outputs_dir, "run_*")) if os.path.isdir(d)]
    if not run_dirs:
        return None
    run_dirs.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    # Try common subdir name
    candidate = os.path.join(run_dirs[0], "recognition_json")
    return candidate if os.path.isdir(candidate) else None


def build_service_from_latest(base_dir: str) -> Optional[RagService]:
    """
    Create and index a RagService from the latest recognition_json directory.
    Returns None if not found.
    """
    recognition_dir = find_latest_recognition_dir(os.path.join(base_dir, "api_outputs"))
    if not recognition_dir:
        return None
    svc = RagService()
    svc.index_recognition_dir(recognition_dir)
    return svc


if __name__ == "__main__":
    # Example CLI usage (quick test):
    base = os.path.dirname(__file__)  # D:\1project2026\RAG_advanced\Dolphin
    svc = build_service_from_latest(base)
    if not svc:
        print("No recognition_json found under api_outputs.")
    else:
        q = "What is RAG?"
        print(f"Query: {q}")
        result = svc.query(q)
        print(json.dumps(result, indent=2, ensure_ascii=False))