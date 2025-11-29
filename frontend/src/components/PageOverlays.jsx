import { useState } from 'react';

export default function PageOverlays({ pages, currentPageIndex, onPageChange }) {
  const [imageError, setImageError] = useState({});

  if (pages.length === 0) {
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
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No Overlays</div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>Upload and process a document to see overlays</div>
        </div>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];
  const origin = 'http://127.0.0.1:8000';
  const overlayUrl = currentPage ? `${origin}${currentPage.overlay_url}` : null;

  const handleImageError = (pageIndex) => {
    setImageError(prev => ({ ...prev, [pageIndex]: true }));
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: '#000000',
      border: '1px solid #ffffff'
    }}>
      {/* Header */}
      <div style={{
        padding: '8px 12px',
        borderBottom: '1px solid #ffffff',
        color: '#ffffff',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <span>Page Overlays</span>
        <span>{currentPageIndex + 1} / {pages.length}</span>
      </div>

      {/* Overlay Image */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        overflow: 'auto',
        position: 'relative'
      }}>
        {overlayUrl && !imageError[currentPageIndex] ? (
          <img
            src={overlayUrl}
            alt={`Overlay for page ${currentPageIndex + 1}`}
            style={{
              width: '90%',
              height: 'auto',
              display: 'block'
            }}
            onError={() => handleImageError(currentPageIndex)}
          />
        ) : (
          <div style={{ color: '#ffffff', textAlign: 'center' }}>
            <div>No overlay available</div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
              Page {currentPageIndex + 1}
            </div>
          </div>
        )}
      </div>

      {/* Navigation Dots */}
      {pages.length > 1 && (
        <div style={{
          padding: '12px',
          borderTop: '1px solid #ffffff',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '8px'
        }}>
          {pages.map((_, index) => (
            <button
              key={index}
              onClick={() => onPageChange(index)}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                border: '1px solid #ffffff',
                background: index === currentPageIndex ? '#ffffff' : 'transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (index !== currentPageIndex) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.3)';
                }
              }}
              onMouseLeave={(e) => {
                if (index !== currentPageIndex) {
                  e.target.style.background = 'transparent';
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}