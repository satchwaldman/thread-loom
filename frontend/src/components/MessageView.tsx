import React from 'react';
import type { Message } from '../types';

interface MessageViewProps {
  messageId: string;
  allMessages: Map<string, Message>;
  onSetReply: (parentId: string) => void;
  onAddToContext: (messageId: string) => void;
  onToggleCollapse: (messageId: string) => void;
}

const MessageView: React.FC<MessageViewProps> = ({ 
  messageId, 
  allMessages, 
  onSetReply, 
  onAddToContext, 
  onToggleCollapse 
}) => {
  const message = allMessages.get(messageId);

  if (!message) {
    return <div>Message not found!</div>;
  }

  const hasChildren = message.children && message.children.length > 0;
  
  // Build collapse button if needed
  let collapseButton = null;
  if (hasChildren) {
    const buttonText = message.isCollapsed ? '[+]' : '[-]';
    collapseButton = (
      <button 
        onClick={() => onToggleCollapse(message.id)} 
        style={{ 
          fontSize: '12px', 
          padding: '2px 5px', 
          marginRight: '10px', 
          cursor: 'pointer', 
          border: 'none', 
          background: 'transparent', 
          color: '#888' 
        }}
      >
        {buttonText}
      </button>
    );
  }

  // Build cost display if needed
  let costDisplay = null;
  if (message.sender === 'ai' && message.cost != null) {
    costDisplay = (
      <div style={{ fontSize: '10px', color: '#888', marginTop: '5px' }}>
        (Model: {message.model}, Cost: ${message.cost.toFixed(6)})
      </div>
    );
  }

  // Build children display if needed
  let childrenDisplay = null;
  if (!message.isCollapsed && hasChildren) {
    childrenDisplay = (
      <div 
        className="children-container" 
        style={{ 
          marginLeft: '20px', 
          borderLeft: '1px solid #444', 
          paddingLeft: '10px' 
        }}
      >
        {message.children.map((childId) => (
          <MessageView
            key={childId}
            messageId={childId}
            allMessages={allMessages}
            onSetReply={onSetReply}
            onAddToContext={onAddToContext}
            onToggleCollapse={onToggleCollapse}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="message-container">
      <div className="message">
        <div className="message-main-content">
          {collapseButton}
          <div className="message-body">
            <div className="sender">{message.sender}</div>
            <div>{message.text}</div>
            {costDisplay}
          </div>
        </div>
        <div className="message-actions">
          <button 
            onClick={() => onSetReply(message.id)} 
            style={{ fontSize: '10px', padding: '2px 5px' }}
          >
            Reply
          </button>
          <button 
            onClick={() => onAddToContext(message.id)} 
            style={{ fontSize: '10px', padding: '2px 5px', marginLeft: '5px' }}
          >
            Add to Context
          </button>
        </div>
      </div>
      {childrenDisplay}
    </div>
  );
};

export default MessageView;
