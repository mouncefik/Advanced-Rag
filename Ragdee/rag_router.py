import os
from typing import Optional, List

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

from rag_service import RagService, build_service_from_latest, find_latest_recognition_dir

BASE_DIR = os.path.dirname(__file__)

router = APIRouter(tags=["rag"]) 


class InitRequest(BaseModel):
    recognition_dir: Optional[str] = None
    embedding_model: Optional[str] = None
    answer_model: Optional[str] = None
    api_key_env: Optional[str] = None


class InitResponse(BaseModel):
    initialized: bool
    chunks_indexed: int
    recognition_dir: Optional[str] = None


class QueryRequest(BaseModel):
    question: str
    k: Optional[int] = 3
    include_relations: Optional[bool] = None
    relation_window: Optional[int] = None
    max_group_items: Optional[int] = None


class RelatedOut(BaseModel):
    page: int
    line: int
    score: float
    text: str


class SourceOut(BaseModel):
    page: int
    line: int
    percentage: float
    score: float
    text: str
    related: List[RelatedOut] = []


class QueryResponse(BaseModel):
    answer: str
    sources: List[SourceOut]


@router.post("/init", response_model=InitResponse)
def init_rag(request: Request, body: InitRequest) -> InitResponse:
    try:
        svc: Optional[RagService] = None
        recognition_dir = body.recognition_dir

        if recognition_dir:
            if not os.path.isdir(recognition_dir):
                raise HTTPException(status_code=400, detail=f"recognition_dir not found: {recognition_dir}")
            svc = RagService(
                embedding_model=body.embedding_model or "text-embedding-3-small",
                answer_model=body.answer_model or "gpt-4o-mini",
                api_key_env=body.api_key_env or "OPENAI_API_KEY",
            )
            svc.index_recognition_dir(recognition_dir)
        else:
            # Try latest run under api_outputs
            svc = build_service_from_latest(BASE_DIR)
            if svc is None:
                # Fallback: look up recognition_json path under api_outputs explicitly
                latest_rec_dir = find_latest_recognition_dir(os.path.join(BASE_DIR, "api_outputs"))
                if latest_rec_dir is None:
                    raise HTTPException(status_code=404, detail="No recognition_json directory found under api_outputs")
                svc = RagService(
                    embedding_model=body.embedding_model or "text-embedding-3-small",
                    answer_model=body.answer_model or "gpt-4o-mini",
                    api_key_env=body.api_key_env or "OPENAI_API_KEY",
                )
                svc.index_recognition_dir(latest_rec_dir)
                recognition_dir = latest_rec_dir

        request.app.state.rag_service = svc
        # Access internal chunk count for status
        chunk_count = len(getattr(svc, "_chunks", []) )
        return InitResponse(initialized=True, chunks_indexed=chunk_count, recognition_dir=recognition_dir)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to initialize RAG service: {e}")


@router.get("/status")
def rag_status(request: Request):
    svc = getattr(request.app.state, "rag_service", None)
    if not svc:
        return {"initialized": False, "chunks_indexed": 0}
    return {"initialized": True, "chunks_indexed": len(getattr(svc, "_chunks", []))}


@router.post("/query", response_model=QueryResponse)
def rag_query(request: Request, body: QueryRequest) -> QueryResponse:
    svc: Optional[RagService] = getattr(request.app.state, "rag_service", None)
    if svc is None:
        raise HTTPException(status_code=400, detail="RAG service is not initialized. Call /rag/init first.")
    try:
        result = svc.query(
            body.question,
            max_sources=body.k or 3,
            include_relations=body.include_relations,
            relation_window=body.relation_window,
            max_group_items=body.max_group_items or 5,
        )
        sources_out = [
            SourceOut(
                page=s.get("page", 0),
                line=s.get("line", 0),
                percentage=s.get("percentage", s.get("percent", 0.0)),
                score=s.get("score", 0.0),
                text=s.get("text", ""),
                related=[
                    RelatedOut(
                        page=r.get("page", 0),
                        line=r.get("line", 0),
                        score=r.get("score", 0.0),
                        text=r.get("text", "")
                    ) for r in s.get("related", [])
                ]
            ) for s in result.get("sources", [])
        ]
        return QueryResponse(answer=result.get("answer", ""), sources=sources_out)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {e}")