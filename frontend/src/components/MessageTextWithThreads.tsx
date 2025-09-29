import React from 'react';
import type { Message, ThreadAnchor } from '../types';
import MessageView from './MessageView';

interface MessageTextWithThreadsProps {
  message: Message;
  allMessages: Map<string, Message>;
  onSetReply: (parentId: string) => void;
  onAddToContext: (messageId: string) => void;
  onToggleCollapse: (messageId: string) => void;
}

const MessageTextWithThreads: React.FC<MessageTextWithThreadsProps> = ({
  message,
  allMessages,
  onSetReply,
  onAddToContext,
  onToggleCollapse
}) => {
  if (!message.threadAnchors || message.threadAnchors.length === 0) {
    // No threads, just return plain text
    return <div className="message-text">{message.text}</div>;
  }

  // Sort anchors by position
  const sortedAnchors = [...message.threadAnchors].sort((a, b) => a.startIndex - b.startIndex);
  
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedAnchors.forEach((anchor, index) => {
    // Add text before the anchor
    if (anchor.startIndex > lastIndex) {
      segments.push(
        <span key={`text-${index}`}>
          {message.text.substring(lastIndex, anchor.startIndex)}
        </span>
      );
    }

    // Add the highlighted/anchor text
    segments.push(
      <span 
        key={`anchor-${index}`}
        style={{ 
          backgroundColor: 'rgba(65, 105, 225, 0.3)', 
          padding: '2px 4px',
          borderRadius: '3px',
          cursor: 'pointer'
        }}
        onClick={() => onToggleCollapse(anchor.threadId)}
      >
        {anchor.text}
      </span>
    );

    // Get the thread message
    const threadMessage = allMessages.get(anchor.threadId);
    
    // Add collapse/expand indicator
    if (threadMessage && threadMessage.children.length > 0) {
      segments.push(
        <span 
          key={`indicator-${index}`}
          style={{ 
            color: '#888', 
            fontSize: '10px', 
            marginLeft: '4px',
            cursor: 'pointer' 
          }}
          onClick={() => onToggleCollapse(anchor.threadId)}
        >
          {threadMessage.isCollapsed ? '[+]' : '[-]'}
        </span>
      );
    }

    // Add the inline thread (if not collapsed and has children)
    if (threadMessage && !threadMessage.isCollapsed && threadMessage.children.length > 0) {
      segments.push(
        <div 
          key={`thread-${index}`}
          style={{ 
            marginLeft: '20px',
            marginTop: '8px',
            marginBottom: '8px',
            paddingLeft: '10px',
            borderLeft: '2px solid #4169E1'
          }}
        >
          {threadMessage.children.map(childId => (
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

    lastIndex = anchor.endIndex;
  });

  // Add any remaining text after the last anchor
  if (lastIndex < message.text.length) {
    segments.push(
      <span key="text-end">
        {message.text.substring(lastIndex)}
      </span>
    );
  }

  return <div className="message-text">{segments}</div>;
};

export default MessageTextWithThreads;
