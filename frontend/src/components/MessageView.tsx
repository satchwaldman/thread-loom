import React, { useState } from 'react';
import type { Message } from '../types';
import MessageTextWithThreads from './MessageTextWithThreads';

interface MessageViewProps {
  messageId: string;
  allMessages: Map<string, Message>;
  onSetReply: (parentId: string) => void;
  onAddToContext: (messageId: string) => void;
  onToggleCollapse: (messageId: string) => void;
  onSendMessage?: (e: React.FormEvent, parentId?: string | null, messageText?: string) => Promise<void>;
  selectedModel?: string;
  isInlineThread?: boolean;
}

const MessageView: React.FC<MessageViewProps> = ({ 
  messageId, 
  allMessages, 
  onSetReply, 
  onAddToContext, 
  onToggleCollapse,
  onSendMessage,
  selectedModel,
  isInlineThread = false
}) => {
  const [threadInput, setThreadInput] = useState('');
  const message = allMessages.get(messageId);

  if (!message) {
    return <div>Message not found!</div>;
  }

  const hasChildren = message.children && message.children.length > 0;
  
  // Build collapse button if needed (for regular child messages, not inline threads)
  let collapseButton = null;
  if (hasChildren && !message.parentId?.includes('anchor_')) {
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

  // Build children display if needed (for regular children, not inline threads)
  let childrenDisplay = null;
  if (!message.isCollapsed && hasChildren && !message.id.includes('anchor_')) {
    childrenDisplay = (
      <div 
        className="children-container" 
        style={{ 
          marginLeft: isInlineThread ? '0' : '20px', 
          borderLeft: isInlineThread ? 'none' : '1px solid #444', 
          paddingLeft: isInlineThread ? '0' : '10px' 
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
            onSendMessage={onSendMessage}
            selectedModel={selectedModel}
            isInlineThread={isInlineThread}
          />
        ))}
      </div>
    );
  }

  // Add thread input form only for non-inline threads
  let threadInputForm = null;
  if (onSendMessage && !message.isCollapsed && !isInlineThread) {
    const isThreadAnchor = message.id.includes('anchor_');
    // Don't show input for anchor messages as they're handled in MessageTextWithThreads
    const showInput = !isThreadAnchor && hasChildren && !message.parentId?.includes('anchor_');
    
    if (showInput) {
      const handleThreadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (threadInput.trim() === '') return;
        
        // For thread anchors, send message to the anchor
        // For regular threads, send message to continue at same level
        const parentId = isThreadAnchor ? message.id : message.parentId;
        
        // Pass the thread input text as the third parameter
        await onSendMessage(e, parentId, threadInput);
        setThreadInput('');
      };

      threadInputForm = (
        <form 
          onSubmit={handleThreadSubmit}
          style={{ 
            marginTop: '10px',
            marginBottom: '10px',
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}
        >
          <input
            type="text"
            value={threadInput}
            onChange={(e) => setThreadInput(e.target.value)}
            placeholder={isThreadAnchor ? "Start thread here..." : "Continue thread..."}
            style={{
              flex: 1,
              padding: '6px 10px',
              fontSize: '14px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '4px',
              color: '#fff'
            }}
          />
          <button 
            type="submit"
            style={{
              padding: '6px 12px',
              fontSize: '14px',
              background: '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Send
          </button>
        </form>
      );
    }
  }

  return (
    <div className="message-container">
      <div className="message" data-message-id={message.id}>
        <div className="message-main-content">
          {collapseButton}
          <div className="message-body">
            <div className="sender">{message.sender}</div>
            <MessageTextWithThreads
              message={message}
              allMessages={allMessages}
              onSetReply={onSetReply}
              onAddToContext={onAddToContext}
              onToggleCollapse={onToggleCollapse}
              onSendMessage={onSendMessage}
              selectedModel={selectedModel}
            />
            {costDisplay}
          </div>
        </div>
      </div>
      {threadInputForm}
      {childrenDisplay}
    </div>
  );
};

export default MessageView;
