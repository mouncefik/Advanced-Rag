import os
import io
import time
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageDraw
from rag_router import router as rag_router

# Lazy imports of repo modules to avoid heavy init until used
from importlib import import_module

def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path

BASE_DIR = os.path.dirname(__file__)
DEFAULT_MODEL_PATH = os.path.join(BASE_DIR, "hf_model")
OUTPUT_ROOT = _ensure_dir(os.path.join(BASE_DIR, "api_outputs"))

# Load utilities at module level
utils = import_module("utils.utils")
demo_page = import_module("demo_page")

app = FastAPI(title="Dolphin API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated assets
STATIC_DIR = _ensure_dir(os.path.join(OUTPUT_ROOT, "static"))
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
app.include_router(rag_router, prefix="/rag")

MODEL_CACHE: Dict[str, Any] = {}

def get_model(model_path: str = DEFAULT_MODEL_PATH):
    if model_path in MODEL_CACHE:
        return MODEL_CACHE[model_path]
    model = demo_page.DOLPHIN(model_path)
    MODEL_CACHE[model_path] = model
    return model

@app.get("/api/health")
def health():
    return {"status": "ok", "time": time.time()}

# Simple overlay renderer using recognition_results (original-coordinate bboxes)
def render_overlay(pil_image: Image.Image, results: List[Dict[str, Any]], save_path: str, alpha: float = 0.25):
    # Draw on a copy
    base = pil_image.convert("RGBA")
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    # pleasant color cycle
    palette = [
        (96, 165, 250, int(255 * alpha)),  # blue
        (34, 197, 94, int(255 * alpha)),   # green
        (234, 179, 8, int(255 * alpha)),   # amber
        (244, 114, 182, int(255 * alpha)), # pink
        (59, 130, 246, int(255 * alpha)),  # indigo
        (16, 185, 129, int(255 * alpha)),  # teal
    ]

    for i, r in enumerate(sorted(results, key=lambda x: x.get("reading_order", 0))):
        bbox = r.get("bbox", [0, 0, 0, 0])
        x1, y1, x2, y2 = [int(b) for b in bbox]
        color = palette[i % len(palette)]
        # filled rect
        draw.rectangle([x1, y1, x2, y2], fill=color)
        # border
        draw.rectangle([x1, y1, x2, y2], outline=(255, 255, 255, 255), width=2)
        # order pill
        pill_w = 26; pill_h = 16
        draw.rounded_rectangle([x1-8, y1-8, x1-8+pill_w, y1-8+pill_h], radius=8, fill=(255,255,255,230))
        draw.text((x1-4, y1-8), str(i+1), fill=(0,0,0,255))

    merged = Image.alpha_composite(base, overlay).convert("RGB")
    merged.save(save_path)
    return save_path

@app.post("/api/process")
async def process_document(file: UploadFile = File(...), max_batch_size: int = 16, model_path: str = DEFAULT_MODEL_PATH):
    try:
        # Prepare run directory
        run_id = datetime.now().strftime("run_%Y%m%d_%H%M%S")
        run_dir = _ensure_dir(os.path.join(OUTPUT_ROOT, run_id))
        utils.setup_output_dirs(run_dir)

        # Persist upload to disk
        filename = os.path.basename(file.filename)
        upload_path = os.path.join(run_dir, filename)
        content = await file.read()
        with open(upload_path, "wb") as f:
            f.write(content)

        # Load model once
        model = get_model(model_path)

        # Handle PDFs (multi-page) vs images
        ext = os.path.splitext(filename)[1].lower()
        result_payload: Dict[str, Any] = {"run_id": run_id, "source": filename}

        if ext == ".pdf":
            # Convert PDF to images and process each page
            images = utils.convert_pdf_to_images(upload_path)
            if not images:
                raise HTTPException(status_code=400, detail="Failed to convert PDF to images")

            pages = []
            for idx, pil_image in enumerate(images):
                page_name = f"{os.path.splitext(filename)[0]}_page_{idx+1:03d}"
                json_path, recognition_results = demo_page.process_single_image(
                    pil_image, model, run_dir, page_name, max_batch_size=max_batch_size, save_individual=False
                )
                # Render overlay
                overlay_name = f"{page_name}_overlay.png"
                overlay_path = os.path.join(STATIC_DIR, overlay_name)
                render_overlay(pil_image, recognition_results, overlay_path)

                # Map to client schema
                items = [
                    {
                        "order": r.get("reading_order", i+1),
                        "type": r.get("label", "paragraph"),
                        "bbox": r.get("bbox", [0,0,0,0]),
                        "text": r.get("text", ""),
                    }
                    for i, r in enumerate(recognition_results)
                ]

                pages.append({
                    "page": idx+1,
                    "items": items,
                    "overlay_url": f"/static/{overlay_name}",
                    "json_path": json_path or ""
                })

            # Save combined JSON/markdown
            combined_json_path = utils.save_combined_pdf_results(
                [{"page_number": p["page"], "elements": [
                    {"label": it["type"], "bbox": it["bbox"], "text": it.get("text",""), "reading_order": it["order"]}
                 for it in p["items"]]} for p in pages],
                upload_path,
                run_dir
            )
            result_payload.update({"type": "pdf", "pages": pages, "combined_json": combined_json_path})
            return result_payload
        else:
            # Single image flow
            pil_image = Image.open(io.BytesIO(content)).convert("RGB")
            base_name = os.path.splitext(filename)[0]
            json_path, recognition_results = demo_page.process_single_image(
                pil_image, model, run_dir, base_name, max_batch_size=max_batch_size, save_individual=True
            )
            overlay_name = f"{base_name}_overlay.png"
            overlay_path = os.path.join(STATIC_DIR, overlay_name)
            render_overlay(pil_image, recognition_results, overlay_path)

            items = [
                {
                    "order": r.get("reading_order", i+1),
                    "type": r.get("label", "paragraph"),
                    "bbox": r.get("bbox", [0,0,0,0]),
                    "text": r.get("text", ""),
                }
                for i, r in enumerate(recognition_results)
            ]

            return {
                "type": "image",
                "run_id": run_id,
                "source": filename,
                "items": items,
                "overlay_url": f"/static/{overlay_name}",
                "json_path": json_path or "",
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))