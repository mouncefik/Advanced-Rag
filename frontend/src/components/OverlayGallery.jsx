import React, { useState, useRef, useEffect } from "react";

export default function OverlayGallery({ pages = [], images = [] }) {
  const data = Array.isArray(pages) && pages.length > 0 ? pages : (images || []).map((src, i) => ({ page: i + 1, overlay_url: src, items: [] }));
  const hasItems = data.length > 0;
  const [active, setActive] = useState(null);
  const origin = (import.meta.env.VITE_API_BASE || 'http://127.0.0.1:8000').replace(/\/$/, '');

  return (
    <section>
      <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",marginBottom:8}}>
        <h3 style={{margin:0,fontSize:16,color:"#ffffff"}}>Page Overlays</h3>
        <span style={{opacity:0.7,color:"#ffffff"}}>{hasItems ? `${data.length} pages` : "No pages"}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(220px, 1fr))",gap:12}}>
        {data.map((p, idx)=> (
          <div key={idx} style={{background:"#000000",border:"1px solid #ffffff",overflow:"hidden"}}>
            <img src={`${origin}${p.overlay_url}`} alt={`page-${p.page || idx+1}`} style={{width:"100%",display:"block"}} />
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px"}}>
              <span style={{fontSize:12,color:"#ffffff"}}>Page {p.page || idx+1}</span>
              <button onClick={()=>setActive(idx)} style={{background:"#000000",border:"1px solid #ffffff",color:"#ffffff",padding:"6px 10px",cursor:"pointer"}}>Open</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OverlayModal({ page, origin, onClose }) {
  const imgRef = useRef(null);
  const [dims, setDims] = useState({ naturalWidth: 1, naturalHeight: 1, displayWidth: 0, displayHeight: 0 });
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => setDims({ naturalWidth: img.naturalWidth || 1, naturalHeight: img.naturalHeight || 1, displayWidth: img.clientWidth, displayHeight: img.clientHeight });
    if (img.complete) onLoad(); else img.addEventListener("load", onLoad);
    return () => img && img.removeEventListener("load", onLoad);
  }, [page]);

  const sx = dims.displayWidth / dims.naturalWidth;
  const sy = dims.displayHeight / dims.naturalHeight;

  const colors = {
    paragraph: "#22c55e",
    table: "#16a34a",
    figure: "#34d399",
    formula: "#84cc16",
    heading: "#65a30d",
    foot: "#e5e7eb",
  };

  const copyText = async (txt) => {
    try {
      await navigator.clipboard.writeText(txt || "");
      toast("Copied to clipboard");
    } catch {
      toast("Copy failed");
    }
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"grid",gridTemplateRows:"auto 1fr",zIndex:1000}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px",background:"#000000",borderBottom:"1px solid #262626"}}>
        <strong style={{color:"#e2e8f0"}}>Page {page.page} — Click a block to copy its text</strong>
        <button onClick={onClose} style={{background:"#0a0a0a",color:"#e5e7eb",border:"1px solid #262626",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:12}}>Close</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1.2fr 1fr",gap:16,padding:16}}>
        <div style={{background:"#000000",border:"1px solid #262626",borderRadius:12,overflow:"hidden"}}>
          <div style={{position:"relative"}}>
            <img ref={imgRef} src={`${origin}${page.overlay_url}`} alt={`page-${page.page}`} style={{width:"100%",display:"block"}} />
            {(page.items || []).map((it, idx)=>{
              const [x1, y1, x2, y2] = it.bbox || [0,0,0,0];
              const left = Math.round(x1 * sx);
              const top = Math.round(y1 * sy);
              const width = Math.round((x2 - x1) * sx);
              const height = Math.round((y2 - y1) * sy);
              const color = colors[it.type] || "#22c55e";
              const text = it.text || "";
              return (
                <button key={idx} onClick={()=>copyText(text)}
                  title={text ? `Copy: ${text.slice(0,120)}` : 'No text'}
                  style={{position:"absolute",left,top,width,height,border:`2px solid ${color}`,background:`color-mix(in oklab, ${color} 16%, transparent)`,backdropFilter:"blur(0.5px)",borderRadius:8,boxShadow:"0 0 0 1px rgba(0,0,0,0.6), 0 6px 16px rgba(0,0,0,0.5)",cursor:"copy"}}
                >
                  <span style={{position:"absolute",top:-12,left:-12,background:color,color:"black",fontWeight:700,padding:"2px 8px",borderRadius:999}}>{it.order ?? idx+1}</span>
                  <span style={{position:"absolute",bottom:4,right:6,fontSize:12,color:"#e2e8f0",background:"rgba(0,0,0,0.6)",padding:"2px 6px",borderRadius:6}}>{it.type || "paragraph"}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{background:"#000000",border:"1px solid #262626",borderRadius:12,overflow:"hidden",display:"grid",gridTemplateRows:"auto 1fr"}}>
          <div style={{padding:"10px 12px",borderBottom:"1px solid #262626"}}>
            <strong style={{color:"#e2e8f0"}}>Blocks</strong>
          </div>
          <div style={{padding:12,overflow:"auto"}}>
            {(page.items || []).map((it, idx)=>{
              const text = it.text || "";
              return (
                <div key={idx} style={{display:"grid",gridTemplateColumns:"1fr auto",gap:8,alignItems:"center",padding:"8px 10px",border:"1px solid #262626",borderRadius:8,marginBottom:8,background:"#0a0a0a"}}>
                  <div>
                    <div style={{fontSize:12,color:"#cbd5e1"}}>#{it.order ?? idx+1} · {it.type || 'paragraph'}</div>
                    <div style={{fontSize:12,color:"#e5e7eb"}}>{text || <em style={{opacity:0.7}}>No text</em>}</div>
                  </div>
                  <button onClick={()=>copyText(text)} style={{background:"#22c55e",color:"black",border:"1px solid #16a34a",padding:"6px 10px",borderRadius:8,cursor:"pointer",fontSize:12}}>Copy</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <Toast refId="overlay-toast" />
    </div>
  );
}

function Toast({ refId }) {
  const [msg, setMsg] = useState("");
  useEffect(()=>{
    window.__setToast = (m) => { setMsg(m); clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(()=>setMsg(""), 1800); };
  },[]);
  if (!msg) return null;
  return (
    <div id={refId} style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:"#111827",color:"#e5e7eb",border:"1px solid #374151",padding:"8px 12px",borderRadius:8,zIndex:1100,boxShadow:"0 8px 30px rgba(0,0,0,0.35)"}}>{msg}</div>
  );
}

function toast(m) { if (typeof window !== 'undefined' && window.__setToast) window.__setToast(m); }