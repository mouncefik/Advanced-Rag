import { useState } from 'react';

export default function JsonViewer({ pages, currentPageIndex, selectedItem, onItemHover, onItemSelect }) {
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [hiddenItems, setHiddenItems] = useState(new Set());
  const [copiedItemIndex, setCopiedItemIndex] = useState(null);

  const currentPage = pages[currentPageIndex];
  const items = currentPage?.items || [];

  const toggleExpanded = (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  const toggleHidden = (itemId) => {
    const newHidden = new Set(hiddenItems);
    if (newHidden.has(itemId)) {
      newHidden.delete(itemId);
    } else {
      newHidden.add(itemId);
    }
    setHiddenItems(newHidden);
  };

  const copyItem = async (item, index) => {
    try {
      const textToCopy = item.text || item.content || JSON.stringify(item, null, 2);
      await navigator.clipboard.writeText(textToCopy);
      setCopiedItemIndex(index);
      setTimeout(() => setCopiedItemIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  function renderJsonValue(value) {
    if (value === null) return <span style={{ color: '#aaaaaa' }}>null</span>;
    if (Array.isArray(value)) {
      return (
        <span>
          <span style={{ color: '#ffffff' }}>[</span>
          <div style={{ marginLeft: '20px' }}>
            {value.map((v, i) => (
              <div key={i}>
                {renderJsonValue(v)}
                {i < value.length - 1 && <span style={{ color: '#ffffff' }}>,</span>}
              </div>
            ))}
          </div>
          <span style={{ color: '#ffffff' }}>]</span>
        </span>
      );
    }
    if (typeof value === 'object') {
      return (
        <span>
          <span style={{ color: '#ffffff' }}>{'{'}</span>
          <div style={{ marginLeft: '20px' }}>
            {Object.entries(value).map(([k, v], i, arr) => (
              <div key={k}>
                <span style={{ color: '#87cefa' }}>
                  "{k}":
                </span>
                &nbsp;
                {renderJsonValue(v)}
                {i < arr.length - 1 && <span style={{ color: '#ffffff' }}>,</span>}
              </div>
            ))}
          </div>
          <span style={{ color: '#ffffff' }}>{'}'}</span>
        </span>
      );
    }
    if (typeof value === 'string') {
      return <span style={{ color: '#98fb98' }}>&quot;{value}&quot;</span>;
    }
    if (typeof value === 'number') {
      return <span style={{ color: '#ffdab9' }}>{value}</span>;
    }
    if (typeof value === 'boolean') {
      return <span style={{ color: '#dda0dd' }}>{String(value)}</span>;
    }
    return <span style={{ color: '#ffffff' }}>{String(value)}</span>;
  }

  if (!currentPage || items.length === 0) {
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
          <div style={{ fontSize: '18px', marginBottom: '8px' }}>No JSON Data</div>
          <div style={{ fontSize: '14px', opacity: 0.7 }}>Process a document to see JSON structure</div>
        </div>
      </div>
    );
  }

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
        <span>JSON Viewer</span>
        <div style={{ display: 'flex', gap: '8px', fontSize: '12px' }}>
          <button
            onClick={() => setExpandedItems(new Set(items.map((_, i) => i)))}
            style={{
              background: 'transparent',
              border: '1px solid #ffffff',
              color: '#ffffff',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            Expand All
          </button>
          <button
            onClick={() => setExpandedItems(new Set())}
            style={{
              background: 'transparent',
              border: '1px solid #ffffff',
              color: '#ffffff',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            Collapse All
          </button>
          <button
            onClick={() => setHiddenItems(new Set())}
            style={{
              background: 'transparent',
              border: '1px solid #ffffff',
              color: '#ffffff',
              padding: '2px 6px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            Show All
          </button>
        </div>
      </div>

      {/* JSON Content */}
      <div style={{
        flex: 1,
        overflow: 'auto',
        padding: '12px',
        fontFamily: 'monospace',
        fontSize: '12px',
        lineHeight: '1.4'
      }}>
        <div style={{ color: '#ffffff' }}>
          <span>{'{'}</span>
          <div style={{ marginLeft: '20px' }}>
            <span style={{ color: '#ffffff' }}>
              "items": [
            </span>
            {items.map((item, index) => {
              const itemId = item.id || item.bbox?.join(',') || index;
              const isExpanded = expandedItems.has(index);
              const isHidden = hiddenItems.has(index);
              const isSelected = selectedItem && (
                selectedItem.id === item.id ||
                (selectedItem.bbox && item.bbox && selectedItem.bbox.join(',') === item.bbox.join(',') )
              );

              if (isHidden) {
                return (
                  <div key={index} style={{ marginLeft: '20px', opacity: 0.5 }}>
                    <span style={{ color: '#888888' }}>// Item {index + 1} hidden </span>
                    <button
                      onClick={() => toggleHidden(index)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '10px',
                        textDecoration: 'underline'
                      }}
                    >
                      [show]
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={index}
                  style={{
                    marginLeft: '20px',
                    border: isSelected ? '1px solid #ffffff' : '1px solid transparent',
                    background: isSelected ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                    padding: '4px',
                    margin: '2px 0',
                    cursor: 'pointer',
                    position: 'relative'
                  }}
                  onMouseEnter={() => onItemHover && onItemHover(item)}
                  onMouseLeave={() => onItemHover && onItemHover(null)}
                  onClick={() => onItemSelect && onItemSelect(item)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(index);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ffffff',
                        cursor: 'pointer',
                        fontSize: '12px',
                        width: '16px'
                      }}
                    >
                      {isExpanded ? '▼' : '▶'}
                    </button>
                    <span style={{ color: '#ffffff' }}>
                      Item {index + 1} ({item.type || 'unknown'})
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyItem(item, index);
                      }}
                      style={{
                        background: 'transparent',
                        border: '1px solid #ffffff',
                        color: '#ffffff',
                        padding: '2px 6px',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                      title="Copy this item"
                    >
                      Copy
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleHidden(index);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#888888',
                        cursor: 'pointer',
                        fontSize: '10px'
                      }}
                      title="Hide this item"
                    >
                      ✕
                    </button>
                  </div>

                  {isExpanded && (
                    <div style={{ marginLeft: '20px', marginTop: '4px' }}>
                      {renderJsonValue(item)}
                    </div>
                  )}

                  {copiedItemIndex === index && (
                    <span style={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      background: 'rgba(0, 0, 0, 0.8)',
                      padding: '2px 4px',
                      fontSize: '8px',
                      color: '#ffffff'
                    }}>
                      Copied!
                    </span>
                  )}

                  {index < items.length - 1 && <span style={{ color: '#ffffff' }}>,</span>}
                </div>
              );
            })}
            <span style={{ color: '#ffffff' }}>]</span>
          </div>
          <span>{'}'}</span>
        </div>
      </div>

      {/* Selected Item Info */}
      {selectedItem && (
        <div style={{
          borderTop: '1px solid #ffffff',
          padding: '8px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          fontSize: '11px',
          color: '#ffffff'
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Selected Item:</div>
          <div>Type: {selectedItem.type || 'unknown'}</div>
          {selectedItem.text && <div>Text: {selectedItem.text.substring(0, 100)}...</div>}
          {selectedItem.bbox && <div>BBox: [{selectedItem.bbox.join(', ')}]</div>}
        </div>
      )}
    </div>
  );
}