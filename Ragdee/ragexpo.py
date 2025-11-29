import os
import glob
import json
from datetime import datetime
from typing import List, Tuple, Dict, Any

import gradio as gr

# note : Heavy ML imports (torch/transformers) are intentionally lazy to
# let the Gradio UI start even if dependencies aren’t installed yet.
# They are imported only when a parse is requested.

MODEL_CACHE: Dict[str, Any] = {}

ASSETS_DIR = os.path.join(os.path.dirname(__file__), "assets")
BANNER_PATH = os.path.join(ASSETS_DIR, "dolphin.png")
DEFAULT_MODEL_PATH = os.path.join(os.path.dirname(__file__), "hf_model")
DEFAULT_OUTPUT_ROOT = os.path.join(os.path.dirname(__file__), "gradio_outputs")


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def get_model(model_path: str):
    if model_path in MODEL_CACHE:
        return MODEL_CACHE[model_path]

    # Lazy import to avoid import errors until the user actually runs inference
    from importlib import import_module
    demo_page = import_module("demo_page")
    model = demo_page.DOLPHIN(model_path)
    MODEL_CACHE[model_path] = model
    return model


def _format_results_markdown(filename: str, results: List[Dict[str, Any]]) -> str:
    # Group results by label
    groups: Dict[str, List[Dict[str, Any]]] = {}
    for r in results:
        groups.setdefault(r.get("label", "text"), []).append(r)

    lines = [
        f"# Dolphin: Parallel Content Parsing\n",
        f"**File**: `{os.path.basename(filename)}`  ",
        f"**Elements**: {len(results)}\n",
        "---\n",
    ]

    order_sorted = sorted(results, key=lambda x: x.get("reading_order", 0))
    lines.append("## Reading Order\n")
    for r in order_sorted:
        ro = r.get("reading_order", 0)
        label = r.get("label", "text")
        text = (r.get("text", "").strip() or "(empty)")
        bbox = r.get("bbox", [])
        lines.append(f"- `{ro:03d}` • **{label}** • bbox={bbox}  ")
        # Truncate overly long text in the list view
        preview = text.replace("\n", " ")
        if len(preview) > 180:
            preview = preview[:180] + "…"
        lines.append(f"  {preview}\n")

    # Sections by type
    for section, title in [("tab", "Tables"), ("equ", "Equations"), ("code", "Code"), ("text", "Text"), ("fig", "Figures")]:
        if groups.get(section):
            lines.append(f"\n## {title}\n")
            for idx, r in enumerate(groups[section], 1):
                t = (r.get("text", "").strip() or "(empty)")
                lines.append(f"- **{title[:-1]} {idx}**\n")
                # Keep full content here
                lines.append(f"\n```\n{t}\n```\n")

    return "\n".join(lines)


def _results_dataframe(results: List[Dict[str, Any]]):
    # Minimal DataFrame-like structure for Gradio Dataframe
    rows = []
    for r in sorted(results, key=lambda x: x.get("reading_order", 0)):
        rows.append([
            r.get("reading_order", 0),
            r.get("label", "text"),
            r.get("text", ""),
            r.get("bbox", []),
        ])
    headers = ["reading_order", "label", "text", "bbox"]
    return rows, headers


def _collect_figure_paths(results: List[Dict[str, Any]], base_dir: str) -> List[str]:
    figures = []
    for r in results:
        if r.get("label") == "fig":
            path = r.get("figure_path") or r.get("text")
            if path:
                abs_path = path
                if not os.path.isabs(abs_path):
                    abs_path = os.path.join(base_dir, path)
                if os.path.exists(abs_path):
                    figures.append(abs_path)
    return figures


def parse_files(files: List[Any], model_path: str, max_batch_size: int, save_dir: str, progress=gr.Progress(track_tqdm=True)):
    from importlib import import_module
    demo_page = import_module("demo_page")
    setup_utils = import_module("utils.utils")

    if not files:
        return "Please upload at least one image or PDF.", [], [], "", {}

    # Prepare output directory for this run
    run_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    base_out = _ensure_dir(save_dir or DEFAULT_OUTPUT_ROOT)
    run_out = _ensure_dir(os.path.join(base_out, f"run_{run_id}"))
    setup_utils.setup_output_dirs(run_out)

    # Load model once
    progress(0.1, desc="Loading model…")
    model = get_model(model_path or DEFAULT_MODEL_PATH)

    summaries = []
    gallery_images = []
    all_rows: List[List[Any]] = []
    json_paths = []
    raw_all: Dict[str, Any] = {}

    total = len(files)
    for i, f in enumerate(files, 1):
        progress((i - 1) / total, desc=f"Parsing {os.path.basename(getattr(f, 'name', str(f)))}…")
        filepath = getattr(f, "name", f)
        try:
            json_path, recognition_results = demo_page.process_document(
                document_path=filepath,
                model=model,
                save_dir=run_out,
                max_batch_size=max_batch_size,
            )
            json_paths.append(json_path or "")
            raw_all[os.path.basename(filepath)] = recognition_results

            # Format outputs
            summaries.append(_format_results_markdown(filepath, recognition_results))
            rows, headers = _results_dataframe(recognition_results)
            all_rows.extend(rows)
            # Collect figures
            gallery_images.extend(_collect_figure_paths(recognition_results, run_out))

        except Exception as e:
            summaries.append(f"### Error processing `{os.path.basename(filepath)}`\n```\n{str(e)}\n```")

    # Combine markdown summaries
    summary_md = "\n\n---\n\n".join(summaries)

    # DataFrame for all files
    df_headers = ["reading_order", "label", "text", "bbox"]

    # JSON paths as text block for easy copy
    json_paths_text = "\n".join([p for p in json_paths if p]) or "(no JSON saved)"

    progress(1.0, desc="Done")
    return summary_md, gallery_images, {"data": all_rows, "headers": df_headers}, json_paths_text, raw_all


def build_app():
    examples = []
    demo_dir = os.path.join(os.path.dirname(__file__), "demo")
    page_dir = os.path.join(demo_dir, "page_imgs")
    # Load up to 4 example page images if present
    if os.path.exists(page_dir):
        examples = [[p] for p in sorted(glob.glob(os.path.join(page_dir, "*.jpg")))[:4]]

    with gr.Blocks(theme=gr.themes.Soft(), css=".banner {display:flex;gap:12px;align-items:center}") as app:
        gr.Markdown("""
        <div class="banner">
            <img src="file://""" + BANNER_PATH + """" alt="Dolphin" style="height:48px"/>
            <div>
                <h3 style="margin:0">Dolphin — Parallel Content Parsing</h3>
                <div style="opacity:0.8">Batch decode document elements (default batch_size = 4)</div>
            </div>
        </div>
        """)

        with gr.Row():
            with gr.Column():
                files = gr.Files(label="Upload image(s) or PDF(s)", file_count="multiple")
                model_path = gr.Textbox(label="Model path (local or HF ID)", value=DEFAULT_MODEL_PATH)
                batch_size = gr.Slider(1, 32, value=4, step=1, label="Max batch size")
                save_dir = gr.Textbox(label="Save directory", value=DEFAULT_OUTPUT_ROOT)
                run_btn = gr.Button("Parse Document(s)", variant="primary")

            with gr.Column():
                summary_md = gr.Markdown(value="Upload files, choose batch size, and click Parse.")
                gallery = gr.Gallery(label="Figures", columns=4, height=240)
                dataframe = gr.Dataframe(headers=["reading_order", "label", "text", "bbox"], row_count=1)
                json_paths_out = gr.Textbox(label="Saved JSON paths", lines=3)
                raw_json_out = gr.JSON(label="Raw results (per file)")

        run_btn.click(
            fn=parse_files,
            inputs=[files, model_path, batch_size, save_dir],
            outputs=[summary_md, gallery, dataframe, json_paths_out, raw_json_out],
        )

        if examples:
            gr.Examples(
                examples=examples,
                inputs=[files],
                label="Examples (demo/page_imgs)",
            )

    return app


if __name__ == "__main__":
    app = build_app()
    app.launch()
