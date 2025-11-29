"""
Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
SPDX-License-Identifier: MIT
"""

import argparse
import glob
import os

import torch
from PIL import Image
from transformers import AutoProcessor, VisionEncoderDecoderModel

from utils.utils import *


class DOLPHIN:
    def __init__(self, model_id_or_path):
        """Initialize the Hugging Face model
        
        Args:
            model_id_or_path: Path to local model or Hugging Face model ID
        """
        # Load model from local path or Hugging Face hub
        self.processor = AutoProcessor.from_pretrained(model_id_or_path)
        self.model = VisionEncoderDecoderModel.from_pretrained(model_id_or_path)
        self.model.eval()
        
        # Set device and precision
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.model.to(self.device)
        # Keep model in fp32 to avoid Half/float mismatches
        # self.model = self.model.float()
        
        # set tokenizer
        self.tokenizer = self.processor.tokenizer
        
    def chat(self, prompt, image):
        """Process an image with the given prompt
        
        Args:
            prompt: Text prompt to guide the model
            image: PIL Image to process
            
        Returns:
            Generated text from the model
        """
        # Prepare image
        pixel_values = self.processor(image, return_tensors="pt").pixel_values
        # Use fp32 inputs to avoid dtype mismatch
        pixel_values = pixel_values.float()
            
        # Prepare prompt
        prompt = f"<s>{prompt} <Answer/>"
        prompt_ids = self.tokenizer(
            prompt, 
            add_special_tokens=False, 
            return_tensors="pt"
        ).input_ids.to(self.device)
        
        decoder_attention_mask = torch.ones_like(prompt_ids)
        
        # Generate text
        outputs = self.model.generate(
            pixel_values=pixel_values.to(self.device),
            decoder_input_ids=prompt_ids,
            decoder_attention_mask=decoder_attention_mask,
            min_length=1,
            max_length=4096,
            pad_token_id=self.tokenizer.pad_token_id,
            eos_token_id=self.tokenizer.eos_token_id,
            use_cache=True,
            bad_words_ids=[[self.tokenizer.unk_token_id]],
            return_dict_in_generate=True,
            do_sample=False,
            num_beams=1
        )
        
        # Process the output
        sequence = self.tokenizer.batch_decode(outputs.sequences, skip_special_tokens=False)[0]
        sequence = sequence.replace(prompt, "").replace("<pad>", "").replace("</s>", "").strip()
        
        return sequence


def process_layout(input_path, model, save_dir, alpha=0.3):
    """Process layout detection for image or PDF
    
    Args:
        input_path: Path to input image or PDF
        model: DOLPHIN model instance
        save_dir: Directory to save results
        alpha: Transparency for visualization overlay
    """
    file_ext = os.path.splitext(input_path)[1].lower()
    
    if file_ext == '.pdf':
        # Convert PDF to images
        images = convert_pdf_to_images(input_path)
        if not images:
            raise Exception(f"Failed to convert PDF {input_path} to images")
        
        # Process each page
        for page_idx, pil_image in enumerate(images):
            print(f"\nProcessing page {page_idx + 1}/{len(images)}")
            
            # Generate output name for this page
            base_name = os.path.splitext(os.path.basename(input_path))[0]
            page_name = f"{base_name}_page_{page_idx + 1:03d}"
            
            # Process layout for this page
            process_single_layout(pil_image, model, save_dir, page_name, alpha)
    
    else:
        # Process regular image file
        pil_image = Image.open(input_path).convert("RGB")
        base_name = os.path.splitext(os.path.basename(input_path))[0]
        process_single_layout(pil_image, model, save_dir, base_name, alpha, input_path)


def process_single_layout(pil_image, model, save_dir, image_name, alpha=0.3, original_path=None):
    """Process layout for a single image
    
    Args:
        pil_image: PIL Image object
        model: DOLPHIN model instance
        save_dir: Directory to save results
        image_name: Name for the output files
        alpha: Transparency for visualization overlay
        original_path: Original image path (for regular images, None for PDF pages)
    """
    # Parse layout
    print("Parsing layout and reading order...")
    layout_output = model.chat("Parse the reading order of this document.", pil_image)
    
    # Parse the layout string
    layout_results = parse_layout_string(layout_output)
    
    print(f"Detected {len(layout_results)} layout elements")
    
    # Save visualization (pass original PIL image for coordinate mapping)
    vis_path = os.path.join(save_dir, f"{image_name}_layout.png")
    visualize_layout(
        pil_image if original_path is None else original_path, 
        layout_results, 
        vis_path, 
        alpha,
        original_image=pil_image  # Pass PIL image for coordinate mapping
    )
    
    # Save JSON (pass original PIL image for coordinate mapping)
    json_path = save_layout_json(
        layout_results, 
        original_path if original_path else image_name,
        save_dir,
        original_image=pil_image  # Pass PIL image for coordinate mapping
    )
    
    return layout_results, vis_path, json_path


def main():
    parser = argparse.ArgumentParser(description="Layout detection and visualization using DOLPHIN model")
    parser.add_argument("--model_path", default="./hf_model", help="Path to Hugging Face model")
    parser.add_argument(
        "--input_path", 
        type=str, 
        required=True, 
        help="Path to input image/PDF or directory of files"
    )
    parser.add_argument(
        "--save_dir",
        type=str,
        default=None,
        help="Directory to save results (default: same as input directory)",
    )
    parser.add_argument(
        "--alpha",
        type=float,
        default=0.2,
        help="Transparency of the overlay (0-1, lower = more transparent, default: 0.3)",
    )
    args = parser.parse_args()
    
    # Load Model
    print("Loading model...")
    model = DOLPHIN(args.model_path)
    
    # Set save directory
    save_dir = args.save_dir or (
        args.input_path if os.path.isdir(args.input_path) else os.path.dirname(args.input_path)
    )
    
    # Create save directory if it doesn't exist
    os.makedirs(save_dir, exist_ok=True)
    
    # Collect files
    if os.path.isdir(args.input_path):
        # Support both image and PDF files
        file_extensions = [".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG", ".pdf", ".PDF"]
        
        input_files = []
        for ext in file_extensions:
            input_files.extend(glob.glob(os.path.join(args.input_path, f"*{ext}")))
        input_files = sorted(input_files)
    else:
        if not os.path.exists(args.input_path):
            raise FileNotFoundError(f"Input path {args.input_path} does not exist")
        
        # Check if it's a supported file type
        file_ext = os.path.splitext(args.input_path)[1].lower()
        supported_exts = ['.jpg', '.jpeg', '.png', '.pdf']
        
        if file_ext not in supported_exts:
            raise ValueError(f"Unsupported file type: {file_ext}. Supported types: {supported_exts}")
        
        input_files = [args.input_path]
    
    total_files = len(input_files)
    print(f"\nTotal files to process: {total_files}")
    
    # Process files
    for file_path in input_files:
        print(f"\n{'='*60}")
        print(f"Processing: {file_path}")
        print('='*60)
        
        try:
            process_layout(
                input_path=file_path,
                model=model,
                save_dir=save_dir,
                alpha=args.alpha
            )
            print(f"\n✓ Processing completed for {file_path}")
            
        except Exception as e:
            print(f"\n✗ Error processing {file_path}: {str(e)}")
            continue
    
    print(f"\n{'='*60}")
    print(f"All processing completed. Results saved to {save_dir}")
    print('='*60)


if __name__ == "__main__":
    main()