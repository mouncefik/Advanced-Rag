import { useState, useRef, useEffect } from 'react';

export default function OverlayOverview({ pages, currentPageIndex, onItemSelect, selectedItemId }) {
  const [copiedItemId, setCopiedItemId] = useState(null);
  const [imageError, setImageError] = useState(false);
  const imgRef = useRef(null);
  const [dims, setDims] = useState({ naturalWidth: 1, naturalHeight: 1, displayWidth: 0, displayHeight: 0 });

  const currentPage = pages[currentPageIndex];
  const items = currentPage?.items || [];
  const origin = 'http://127.0.0.1:8000';
  const overlayUrl = currentPage ? `${origin}${currentPage.overlay_url}` : null;

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    const onLoad = () => setDims({
      naturalWidth: img.naturalWidth || 1,
      naturalHeight: img.naturalHeight || 1,
      displayWidth: img.clientWidth,
      displayHeight: img.clientHeight
    });
    if (img.complete) onLoad(); else img.addEventListener('load', onLoad);
    return () => img && img.removeEventListener('load', onLoad);
  }, [overlayUrl, currentPageIndex]);

  const handleItemClick = async (item) => {
    onItemSelect(item);
  };

  const copyItem = async (item) => {
    try {
      const textToCopy = item.text || item.content || JSON.stringify(item, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedItemId(item.id || item.bbox?.join(',') || Math.random());
      setTimeout(() => setCopiedItemId(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  if (!currentPage) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        border: '1px solid #ffffff',
        color: '#ffffff'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No Overlay Data</div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>Process a document to see overlay parts</div>
        </div>
      </div>
    );
  }

  const sx = dims.displayWidth / dims.naturalWidth;
  const sy = dims.displayHeight / dims.naturalHeight;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#000000',
      border: '1px solid #ffffff'
    }}>
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #ffffff',
        color: '#ffffff',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Overlay Overview</span>
        <span>{items.length} parts</span>
      </div>

      <div style={{
        flex: 1,
        position: 'relative',
        overflow: 'auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center'
      }}>
        {overlayUrl && !imageError ? (
          <div style={{ position: 'relative', maxWidth: '100%', maxHeight: '100%' }}>
            <img
              ref={imgRef}
              src={overlayUrl}
              alt={`Overlay for page ${currentPageIndex + 1}`}
              style={{
                width: '90%',
                height: 'auto',
                objectFit: 'contain',
                display: 'block'
              }}
              onError={() => setImageError(true)}
            />

            {items.map((item, index) => {
              const itemId = item.id || item.bbox?.join(',') || index;
              const isSelected = selectedItemId === itemId;
              const isCopied = copiedItemId === itemId;

              const bbox = item.bbox;
              if (!bbox || bbox.length < 4) return null;

              return (
                <div
                  key={itemId}
                  onClick={() => handleItemClick(item)}
                  style={{
                    position: 'absolute',
                    left: `${bbox[0] * sx}px`,
                    top: `${bbox[1] * sy}px`,
                    width: `${(bbox[2] - bbox[0]) * sx}px`,
                    height: `${(bbox[3] - bbox[1]) * sy}px`,
                    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255, 255, 255, 0.3)',
                    background: isCopied
                      ? 'rgba(255, 255, 255, 0.12)'
                      : isSelected
                        ? 'rgba(255, 255, 255, 0.1)'
                        : 'rgba(255, 255, 255, 0.05)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: '#ffffff',
                    zIndex: 2
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.15)';
                      e.target.style.border = '1px solid rgba(255, 255, 255, 0.6)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isCopied) {
                      e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.target.style.border = '1px solid rgba(255, 255, 255, 0.3)';
                    }
                  }}
                  title={`Click to select: ${item.text || item.type || 'Item'}`}
                >
                  {isSelected && (
                    <button
                      onClick={(e) => { e.stopPropagation(); copyItem(item); }}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        background: 'rgba(0,0,0,0.85)',
                        border: '1px solid #ffffff',
                        color: '#ffffff',
                        padding: '2px 6px',
                        fontSize: '10px',
                        cursor: 'pointer'
                      }}
                      title="Copy this item"
                    >
                      Copy
                    </button>
                  )}

                  {isCopied && (
                    <span style={{
                      background: 'rgba(0, 0, 0, 0.8)',
                      padding: '2px 4px',
                      fontSize: '8px'
                    }}>
                      Copied!
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ color: '#ffffff', textAlign: 'center' }}>
            <div>No overlay available</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              Page {currentPageIndex + 1}
            </div>
          </div>
        )}
      </div>

      {copiedItemId && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          right: '20px',
          background: 'rgba(0, 0, 0, 0.9)',
          border: '1px solid #ffffff',
          color: '#ffffff',
          padding: '8px 12px',
          fontSize: '12px',
          zIndex: 10
        }}>
          Content copied to clipboard!
        </div>
      )}
    </div>
  );
}