import React, { useState, useMemo } from "react";

export default function MarkdownPane({ markdown, items = [] }) {
  const [copied, setCopied] = useState(false);
  const content = useMemo(() => generateMarkdown(items), [items]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="markdown-pane">
      <div className="markdown-header">
        <h3 style={{margin:0,fontSize:16,color:"#ffffff"}}>Extracted Content</h3>
        <div className="markdown-actions">
          <button 
            onClick={handleCopy} 
            className="action-button"
            style={{background:"#000000", color:"#ffffff", border:"1px solid #ffffff"}}
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>
      <div className="markdown-content">
        {content ? (
          <pre style={{margin:0,whiteSpace:"pre-wrap",color:"#ffffff"}}>{content}</pre>
        ) : (
          <div style={{color:"#ffffff",opacity:0.7,padding:"20px 0",textAlign:"center"}}>
            No content extracted yet
          </div>
        )}
      </div>
    </div>
  );
}

function generateMarkdown(items = []) {
  if (!items || items.length === 0) return "";
  
  const sorted = [...items].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  return sorted.map(item => {
    switch (item.type) {
      case "paragraph":
        return item.text;
      case "heading":
        return `# ${item.text}`;
      case "table":
        return `Table: ${item.text || ""}`;
      case "figure":
        return `Figure: ${item.text || ""}`;
      case "formula":
        return `Formula: ${item.text || ""}`;
      default:
        return item.text || "";
    }
  }).join("\n\n");
}