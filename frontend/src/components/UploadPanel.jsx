import React, { useRef } from "react";

export default function UploadPanel({ onFileChange, onSubmit }) {
  const inputRef = useRef(null);

  const handleFiles = (files) => {
    const arr = Array.from(files || []);
    const first = arr?.[0] || null;
    onFileChange?.(first);
  };

  return (
    <div style={{border:"1px dashed #ffffff",padding:24,background:"#000000",color:"#ffffff"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div>
          <h2 style={{margin:0,fontSize:18}}>Upload documents or images</h2>
          <p style={{margin:"6px 0 16px",opacity:0.8}}>PDF, PNG, JPG supported</p>
        </div>
        <button onClick={() => onSubmit?.()} style={{background:"#000000",color:"#ffffff",border:"1px solid #ffffff",padding:"10px 14px",cursor:"pointer"}}>Process</button>
      </div>
      <div
        onDragOver={(e)=>{e.preventDefault();}}
        onDrop={(e)=>{e.preventDefault(); handleFiles(e.dataTransfer.files);}}
        style={{display:"grid",placeItems:"center",gap:10,padding:24,background:"#000000"}}
      >
        <input ref={inputRef} type="file" multiple accept=".pdf,image/*" onChange={(e)=>handleFiles(e.target.files)} style={{display:"none"}} />
        <button onClick={()=>inputRef.current?.click()} style={{background:"#000000",color:"#ffffff",border:"1px solid #ffffff",padding:"10px 14px",cursor:"pointer"}}>Select files</button>
        <span style={{opacity:0.7}}>or drag and drop here</span>
      </div>
    </div>
  );
}