import { useState } from 'react';

export default function DocumentViewer({ file, pages, currentPageIndex, onPageChange }) {
  const [imageError, setImageError] = useState(false);

  if (!file && pages.length === 0) {
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
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No Document</div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>Upload a PDF or image to view</div>
        </div>
      </div>
    );
  }

  const currentPage = pages[currentPageIndex];
  const origin = 'http://127.0.0.1:8000';
  
  // For images, show the original file
  if (file && file.type.startsWith('image/')) {
    const imageUrl = URL.createObjectURL(file);
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#000000',
        border: '1px solid #ffffff',
        overflow: 'hidden'
      }}>
        <img
          src={imageUrl}
          alt="Uploaded document"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain'
          }}
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  // For PDFs, show the current page image
  if (currentPage && currentPage.original_url) {
    const imageUrl = `${origin}${currentPage.original_url}`;
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
          fontSize: '14px'
        }}>
          Page {currentPageIndex + 1} of {pages.length}
        </div>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden'
        }}>
          {!imageError ? (
            <img
              src={imageUrl}
              alt={`Page ${currentPageIndex + 1}`}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain'
              }}
              onError={() => setImageError(true)}
            />
          ) : (
            <div style={{ color: '#ffffff', textAlign: 'center' }}>
              <div>Failed to load page image</div>
              <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px' }}>
                {imageUrl}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

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
        <div style={{ fontSize: '18px', marginBottom: '8px' }}>Processing...</div>
        <div style={{ fontSize: '14px', opacity: 0.7 }}>Document is being processed</div>
      </div>
    </div>
  );
}