import React from "react";

export default function Header() {
  return (
    <header className="app-header">
      <div className="header-content">
        <div className="logo">
          <h1 style={{margin:0,fontSize:20,color:"#ffffff"}}>Parallel Content Parser</h1>
        </div>
        <nav>
          <ul className="nav-links">
            <li><a href="#" className="nav-link active">API Online</a></li>
            <li><a href="#" className="nav-link">Docs</a></li>
            <li><a href="#" className="nav-link">GitHub</a></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}