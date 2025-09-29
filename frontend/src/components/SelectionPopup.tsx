import React from 'react';

interface SelectionPopupProps {
  x: number;
  y: number;
  showAddThread: boolean;
  onAddThread: () => void;
  onAddToContext: () => void;
  onClose: () => void;
}

const SelectionPopup: React.FC<SelectionPopupProps> = ({
  x,
  y,
  showAddThread,
  onAddThread,
  onAddToContext,
  onClose
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        left: `${x}px`,
        top: `${y}px`,
        background: '#333',
        border: '1px solid #555',
        borderRadius: '4px',
        padding: '4px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
        zIndex: 1000,
        display: 'flex',
        gap: '4px'
      }}
      onMouseLeave={onClose}
    >
      {showAddThread && (
        <button
          onClick={onAddThread}
          style={{
            padding: '4px 8px',
            fontSize: '12px',
            background: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          Add Inline Thread
        </button>
      )}
      <button
        onClick={onAddToContext}
        style={{
          padding: '4px 8px',
          fontSize: '12px',
          background: '#28a745',
          color: 'white',
          border: 'none',
          borderRadius: '3px',
          cursor: 'pointer',
          whiteSpace: 'nowrap'
        }}
      >
        Add Message(s) to Context
      </button>
    </div>
  );
};

export default SelectionPopup;
