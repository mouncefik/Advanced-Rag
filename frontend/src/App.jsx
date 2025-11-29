import { useEffect, useState } from 'react';
import './App.css';
import { uploadDocument, API_BASE, apiHealth, ragInit, ragQuery, ragStatus } from './api/client';
import Header from './components/Header';
import UploadPanel from './components/UploadPanel';
import DocumentViewer from './components/DocumentViewer';
import PageOverlays from './components/PageOverlays';
import OverlayOverview from './components/OverlayOverview';
import JsonViewer from './components/JsonViewer';

function App() {
  const [file, setFile] = useState(null);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState({ status: 'unknown' });
  const [pageIndex, setPageIndex] = useState(0);
  const [selectedItem, setSelectedItem] = useState(null);
  const [hoveredItem, setHoveredItem] = useState(null);
  // Section 3: RAG Chat states
  const [ragReady, setRagReady] = useState(false);
  const [ragChunks, setRagChunks] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [chatAnswer, setChatAnswer] = useState('');
  const [chatSources, setChatSources] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [ragError, setRagError] = useState('');

  useEffect(() => {
    (async () => {
      try { const h = await apiHealth(); setHealth(h || { status: 'error' }); } catch { setHealth({ status: 'error' }); }
    })();
  }, []);

  useEffect(() => {
    if (pageIndex >= pages.length) setPageIndex(0);
  }, [pages.length]);

  const onUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    setSelectedItem(null);
    try {
      const data = await uploadDocument(file);

      if (data?.type === 'image') {
        const page = { 
          page: 1, 
          items: data.items || [], 
          overlay_url: data.overlay_url || '',
          original_url: data.original_url || ''
        };
        setPages([page]);
      } else if (data?.type === 'pdf') {
        setPages(data.pages || []);
      } else {
        setPages([]);
      }
      setPageIndex(0);
      // Refresh RAG status after processing
      try { const s = await ragStatus(); setRagReady(!!s?.initialized); setRagChunks(s?.chunks_indexed || 0); } catch {}
    } catch (err) {
      setError(err?.message || 'Upload failed');
    } finally {
      setLoading(false);
      try { const h = await apiHealth(); setHealth(h || { status: 'error' }); } catch { setHealth({ status: 'error' }); }
    }
  };

  const initRag = async () => {
    setRagError('');
    try {
      const res = await ragInit();
      setRagReady(!!res?.initialized);
      setRagChunks(res?.chunks_indexed || 0);
    } catch (e) {
      setRagError(e?.message || 'Failed to initialize RAG');
      setRagReady(false);
      setRagChunks(0);
    }
  };

  const askRag = async () => {
    if (!chatInput.trim()) return;
    setChatLoading(true);
    setRagError('');
    setChatAnswer('');
    setChatSources([]);
    try {
      const res = await ragQuery(chatInput.trim(), 3);
      setChatAnswer(res?.answer || '');
      setChatSources(res?.sources || []);
    } catch (e) {
      setRagError(e?.message || 'Query failed');
    } finally {
      setChatLoading(false);
    }
  };

  const handlePageChange = (newIndex) => {
    setPageIndex(newIndex);
    setSelectedItem(null);
  };

  const handleItemSelect = (item) => {
    setSelectedItem(item);
  };

  const handleItemHover = (item) => {
    setHoveredItem(item);
  };

  return (
    <div className="container">
      <Header apiStatus={health?.status} />
      
      {/* Upload Section */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #ffffff',
        background: '#000000'
      }}>
        <UploadPanel 
          onFileChange={setFile} 
          onSubmit={onUpload} 
          file={file} 
        />
        {error && (
          <div style={{
            marginTop: '12px',
            padding: '8px 12px',
            background: '#000000',
            border: '1px solid #ffffff',
            color: '#ffffff',
            fontSize: '14px'
          }}>
            Error: {error}
          </div>
        )}
      </div>

      {/* First Section: Document Viewer + Page Overlays */}
      <div style={{
        display: 'flex',
        height: '50vh',
        borderBottom: '1px solid #ffffff'
      }}>
        <div style={{ flex: 1, padding: '16px', paddingRight: '8px' }}>
          <DocumentViewer 
            file={file}
            pages={pages}
            currentPageIndex={pageIndex}
            onPageChange={handlePageChange}
          />
        </div>
        <div style={{ flex: 1, padding: '16px', paddingLeft: '8px' }}>
          <PageOverlays 
            pages={pages}
            currentPageIndex={pageIndex}
            onPageChange={handlePageChange}
          />
        </div>
      </div>

      {/* Second Section: Overlay Overview + JSON Viewer */}
      <div style={{
        display: 'flex',
        height: '50vh'
      }}>
        <div style={{ flex: 1, padding: '16px', paddingRight: '8px' }}>
          <OverlayOverview 
            pages={pages}
            currentPageIndex={pageIndex}
            onItemSelect={handleItemSelect}
            selectedItemId={selectedItem?.id || selectedItem?.bbox?.join(',')}
          />
        </div>
        <div style={{ flex: 1, padding: '16px', paddingLeft: '8px' }}>
          <JsonViewer 
            pages={pages}
            currentPageIndex={pageIndex}
            selectedItem={selectedItem}
            onItemHover={handleItemHover}
            onItemSelect={handleItemSelect}
          />
        </div>
      </div>

      {/* Third Section: RAG Chat + Sources */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '0px',
        height: '50vh',
        borderTop: '1px solid #ffffff'
      }}>
        {/* Chat Panel */}
        <div style={{ padding: '16px', borderRight: '1px solid #ffffff' }}>
          <div style={{
            background: '#000000',
            border: '1px solid #ffffff',
            height: '100%',
            display: 'grid',
            gridTemplateRows: 'auto auto 1fr',
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #ffffff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#ffffff' }}>
              <span>RAG Chat</span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button onClick={initRag} style={{ background: 'transparent', border: '1px solid #ffffff', color: '#ffffff', padding: '4px 8px', cursor: 'pointer' }}>Initialize Index</button>
                <span style={{ fontSize: 12, opacity: 0.8 }}>{ragReady ? `Ready (${ragChunks} chunks)` : 'Not initialized'}</span>
              </div>
            </div>
            <div style={{ padding: '10px 12px', borderBottom: '1px solid #ffffff', display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a question about the document"
                style={{ flex: 1, background: '#000000', color: '#ffffff', border: '1px solid #ffffff', padding: '6px 8px' }}
              />
              <button onClick={askRag} disabled={chatLoading || !ragReady} style={{ background: '#000000', color: '#ffffff', border: '1px solid #ffffff', padding: '6px 12px', cursor: 'pointer' }}>{chatLoading ? 'Asking…' : 'Ask'}</button>
            </div>
            <div style={{ padding: '12px', overflowY: 'auto' }}>
              {ragError && (
                <div style={{ marginBottom: 8, padding: '8px 10px', background: '#000000', border: '1px solid #ffffff', color: '#ffffff', fontSize: 12 }}>Error: {ragError}</div>
              )}
              <div style={{ color: '#ffffff', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                {chatAnswer ? chatAnswer : (
                  <span style={{ opacity: 0.7 }}>Ask a question to see an answer grounded in your document.</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sources Panel */}
        <div style={{ padding: '16px' }}>
          <div style={{
            background: '#000000',
            border: '1px solid #ffffff',
            height: '100%',
            display: 'grid',
            gridTemplateRows: 'auto 1fr',
          }}>
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #ffffff', color: '#ffffff', display: 'flex', justifyContent: 'space-between' }}>
              <span>Information Sources</span>
              <span style={{ fontSize: 12, opacity: 0.8 }}>{chatSources.length} items</span>
            </div>
            <div style={{ padding: '12px', overflowY: 'auto', display: 'grid', gap: '12px' }}>
              {chatSources.length === 0 ? (
                <div style={{ color: '#ffffff', opacity: 0.7 }}>No sources yet.</div>
              ) : (
                chatSources.map((s, i) => (
                  <div key={i} style={{ border: '1px solid #ffffff', padding: '8px 10px', background: '#000000', color: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <strong>Page {s.page}, Line {s.line}</strong>
                      <span style={{ fontSize: 12 }}>Score: {s.score?.toFixed?.(3) ?? s.score}</span>
                    </div>
                    <div style={{ fontSize: 12, marginBottom: 6 }}>{s.text}</div>
                    <div style={{ height: 8, background: '#222', border: '1px solid #ffffff', position: 'relative' }}>
                      <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: `${Math.min(100, Math.max(0, s.percentage || s.percent || 0))}%`, background: '#ffffff' }} />
                    </div>
                    <div style={{ fontSize: 11, marginTop: 6, opacity: 0.8 }}>Relevance: {Math.round(s.percentage || s.percent || 0)}%</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {loading && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'grid',placeItems:'center',zIndex:1000}}>
          <div style={{display:'grid',placeItems:'center',gap:10,background:'#000000',border:'1px solid #ffffff',padding:'16px 20px'}}>
            <Spinner />
            <div style={{color:'#ffffff'}}>Processing…</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <div style={{width:'100%',height:3,background:'#333333',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',left:0,top:0,bottom:0,width:'30%',background:'#ffffff',animation:'loader 1s linear infinite'}} />
    </div>
  );
}

export default App;
