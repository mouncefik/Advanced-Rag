import re
from pathlib import Path

def parse_structured_text(text: str):
    # Capture: id, type, bbox coordinates, and content
    pattern = r"(\d{3})\s*•\s*(\w+)\s*•\s*bbox=\[([\d\s,]+)\]\s*\n(.*?)\n(?=\d{3}\s*•|\Z)"
    matches = re.findall(pattern, text, re.S)

    parsed = []
    for idx, typ, bbox_str, content in matches:
        bbox = list(map(int, bbox_str.split(',')))
        parsed.append({
            "id": int(idx),
            "type": typ.strip(),
            "bbox": bbox,
            "content": content.strip()
        })
    return parsed


def convert_to_markdown(blocks):
    md_lines = []
    for block in blocks:
        t = block["type"]
        c = block["content"]

        if t == "header":
            md_lines.append(f"# {c}\n")
        elif t == "sec_1":
            md_lines.append(f"## {c}\n")
        elif t == "sec_2":
            md_lines.append(f"### {c}\n")
        elif t == "sec_3":
            md_lines.append(f"#### {c}\n")
        elif t == "half_para":
            md_lines.append(f"> {c}\n")
        elif t == "para":
            md_lines.append(f"{c}\n")
        else:
            md_lines.append(f"{c}\n")
    return "\n".join(md_lines)


def sort_by_bbox(blocks, y_tolerance=20):
    """
    Sorts blocks by vertical (y1) position, then by horizontal (x1) if on the same line.
    y_tolerance: how close two y-values can be to be considered the same line.
    """
    # First sort by y1, then x1
    blocks.sort(key=lambda b: (b["bbox"][1], b["bbox"][0]))

    # Group lines that are roughly on the same y-level
    sorted_blocks = []
    current_line_y = None
    current_group = []

    for b in blocks:
        y1 = b["bbox"][1]
        if current_line_y is None or abs(y1 - current_line_y) <= y_tolerance:
            current_group.append(b)
            if current_line_y is None:
                current_line_y = y1
        else:
            # sort within line by x
            current_group.sort(key=lambda b: b["bbox"][0])
            sorted_blocks.extend(current_group)
            current_group = [b]
            current_line_y = y1

    if current_group:
        current_group.sort(key=lambda b: b["bbox"][0])
        sorted_blocks.extend(current_group)

    return sorted_blocks


def structured_text_to_md(input_path, output_path):
    text = Path(input_path).read_text(encoding="utf-8")
    blocks = parse_structured_text(text)
    sorted_blocks = sort_by_bbox(blocks)
    markdown = convert_to_markdown(sorted_blocks)
    Path(output_path).write_text(markdown, encoding="utf-8")
    print(f"✅ Markdown file created with layout order: {output_path}")


if __name__ == "__main__":
    import sys
    if len(sys.argv) != 3:
        print("Usage: python structured_to_md_bbox.py input.txt output.md")
    else:
        structured_text_to_md(sys.argv[1], sys.argv[2])
