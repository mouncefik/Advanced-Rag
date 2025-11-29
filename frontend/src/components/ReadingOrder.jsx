import React, { useEffect, useRef, useState } from "react";
import MarkdownPane from "./MarkdownPane";

export default function ReadingOrder({ image, items = [] }) {
  const imgRef = useRef(null);
  const [dims, setDims] = useState({ naturalWidth: 1, naturalHeight: 1, displayWidth: 0, displayHeight: 0 });

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () =>
      setDims({
        naturalWidth: img.naturalWidth || 1,
        naturalHeight: img.naturalHeight || 1,
        displayWidth: img.clientWidth,
        displayHeight: img.clientHeight,
      });
    if (img.complete) onLoad();
    else img.addEventListener("load", onLoad);
    return () => img && img.removeEventListener("load", onLoad);
  }, [image]);

  const sx = dims.displayWidth / dims.naturalWidth;
  const sy = dims.displayHeight / dims.naturalHeight;

  // Use only black and white shades
  const colors = {
    paragraph: "#ffffff",
    table: "#ffffff",
    figure: "#ffffff",
    formula: "#ffffff",
    heading: "#ffffff",
    foot: "#ffffff",
  };

  const md = generateMarkdown(items);

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 16 }}>
      <div style={{ background: "#000000", border: "1px solid #ffffff", overflow: "hidden" }}>
        <div style={{ position: "relative" }}>
          {image ? (
            <img ref={imgRef} src={image} alt="page" style={{ width: "100%", display: "block" }} />
          ) : (
            <div style={{height:420,background:"#000000",display:"grid",placeItems:"center",color:"#ffffff"}}>Upload an image or PDF page to preview</div>
          )}
          {(items || []).map((it, idx) => {
            const [x1, y1, x2, y2] = it.bbox || [0, 0, 0, 0];
            const left = Math.round(x1 * sx);
            const top = Math.round(y1 * sy);
            const width = Math.round((x2 - x1) * sx);
            const height = Math.round((y2 - y1) * sy);
            const color = colors[it.type] || "#ffffff";
            return (
              <div
                key={idx}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width,
                  height,
                  border: `2px solid ${color}`,
                  background: "rgba(255, 255, 255, 0.1)",
                  backdropFilter: "blur(0.5px)",
                  borderRadius: 0,
                  boxShadow: "none",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: -12,
                    left: -12,
                    background: "#ffffff",
                    color: "#000000",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 0,
                  }}
                >
                  {it.order ?? idx + 1}
                </span>
                <span
                  style={{
                    position: "absolute",
                    bottom: 4,
                    right: 6,
                    fontSize: 12,
                    color: "#ffffff",
                    background: "rgba(0,0,0,0.8)",
                    padding: "2px 6px",
                    borderRadius: 0,
                  }}
                >
                  {it.type || "paragraph"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <MarkdownPane markdown={md} items={items} />
    </section>
  );
}

function generateMarkdown(items) {
  const lines = ["# Reading Order", "", "The following blocks appear in order on the page:", ""]; 
  (items || []).forEach((it, idx) => {
    const [x1, y1, x2, y2] = it.bbox || [0, 0, 0, 0];
    const bb = `${Math.round(x1)}, ${Math.round(y1)}, ${Math.round(x2)}, ${Math.round(y2)}`;
    const type = it.type || "paragraph";
    const txt = (it.text || "").replace(/\n/g, " ").slice(0, 160);
    lines.push(`${idx + 1}. **${type}** — bbox: [${bb}]`);
    if (txt) lines.push(`   > ${txt}`);
  });
  return lines.join("\n");
}