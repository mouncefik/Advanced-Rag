import React from "react";

export default function DataTable({ rows }) {
  const data = Array.isArray(rows) ? rows : [];
  return (
    <div style={{marginTop:16}}>
      <h3 style={{margin:"0 0 8px",fontSize:16,color:"#e2e8f0"}}>Reading Order</h3>
      <div style={{overflow:"auto",border:"1px solid #262626",borderRadius:10}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead style={{background:"#000000",color:"#e5e7eb"}}>
            <tr>
              <th style={{textAlign:"left",padding:10,borderBottom:"1px solid #262626"}}>Order</th>
              <th style={{textAlign:"left",padding:10,borderBottom:"1px solid #262626"}}>Type</th>
              <th style={{textAlign:"left",padding:10,borderBottom:"1px solid #262626"}}>BBox</th>
              <th style={{textAlign:"left",padding:10,borderBottom:"1px solid #262626"}}>Text</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => (
              <tr key={i} style={{background:i%2?"#0a0a0a":"#000000",color:"#cbd5e1"}}>
                <td style={{padding:10,borderBottom:"1px solid #262626"}}>{r.order ?? i+1}</td>
                <td style={{padding:10,borderBottom:"1px solid #262626"}}>{r.type ?? "paragraph"}</td>
                <td style={{padding:10,borderBottom:"1px solid #262626"}}>{Array.isArray(r.bbox)? r.bbox.join(", "): String(r.bbox)}</td>
                <td style={{padding:10,borderBottom:"1px solid #262626",maxWidth:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{r.text ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}