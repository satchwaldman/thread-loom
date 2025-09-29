import React, { useState } from 'react';
import type { Message, ThreadAnchor } from '../types';
import MessageView from './MessageView';

interface MessageTextWithThreadsProps {
  message: Message;
  allMessages: Map<string, Message>;
  onSetReply: (parentId: string) => void;
  onAddToContext: (messageId: string) => void;
  onToggleCollapse: (messageId: string) => void;
  onSendMessage?: (e: React.FormEvent, parentId?: string | null, messageText?: string) => Promise<void>;
  selectedModel?: string;
}

const MessageTextWithThreads: React.FC<MessageTextWithThreadsProps> = ({
  message,
  allMessages,
  onSetReply,
  onAddToContext,
  onToggleCollapse,
  onSendMessage,
  selectedModel
}) => {
  const [threadInputs, setThreadInputs] = useState<{ [key: string]: string }>({});

  // Format text with paragraphs and better formatting
  const formatText = (text: string) => {
    // Split by double newlines for paragraphs
    const paragraphs = text.split(/\n\n+/);
    return paragraphs.map((paragraph, idx) => {
      // Check if it's a list
      const lines = paragraph.split('\n');
      const isList = lines.every(line => line.trim().startsWith('- ') || line.trim().startsWith('* ') || /^\d+\./.test(line.trim()));
      
      if (isList) {
        return (
          <ul key={idx} style={{ marginTop: '10px', marginBottom: '10px', paddingLeft: '20px' }}>
            {lines.map((line, lineIdx) => (
              <li key={lineIdx} style={{ marginBottom: '5px' }}>
                {line.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '')}
              </li>
            ))}
          </ul>
        );
      }
      
      return (
        <p key={idx} style={{ marginTop: idx === 0 ? 0 : '10px', marginBottom: '10px', lineHeight: '1.5' }}>
          {paragraph}
        </p>
      );
    });
  };

  if (!message.threadAnchors || message.threadAnchors.length === 0) {
    // No threads, return formatted text
    return <div className="message-text">{formatText(message.text)}</div>;
  }

  // Sort anchors by position
  const sortedAnchors = [...message.threadAnchors].sort((a, b) => a.startIndex - b.startIndex);
  
  const segments: React.ReactNode[] = [];
  let lastIndex = 0;

  sortedAnchors.forEach((anchor, index) => {
    // Add text before the anchor
    if (anchor.startIndex > lastIndex) {
      const textSegment = message.text.substring(lastIndex, anchor.startIndex);
      segments.push(
        <span key={`text-${index}`}>
          {textSegment}
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
    if (threadMessage) {
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

    // Add the inline thread (if not collapsed)
    if (threadMessage && !threadMessage.isCollapsed) {
      const handleInlineThreadSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = threadInputs[anchor.threadId] || '';
        if (input.trim() && onSendMessage) {
          await onSendMessage(e, anchor.threadId, input);
          setThreadInputs(prev => ({ ...prev, [anchor.threadId]: '' }));
        }
      };

      segments.push(
        <div 
          key={`thread-${index}`}
          style={{ 
            marginLeft: '20px',
            marginTop: '8px',
            marginBottom: '8px',
            paddingLeft: '10px',
            borderLeft: '2px solid #4169E1',
            display: 'inline-block',
            width: 'calc(100% - 30px)'
          }}
        >
          {/* Input field at the top of the inline thread */}
          {onSendMessage && (
            <form 
              onSubmit={handleInlineThreadSubmit}
              style={{ 
                marginBottom: '10px',
                display: 'flex',
                gap: '8px'
              }}
            >
              <input
                type="text"
                value={threadInputs[anchor.threadId] || ''}
                onChange={(e) => setThreadInputs(prev => ({ ...prev, [anchor.threadId]: e.target.value }))}
                placeholder="Type in this thread..."
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: '13px',
                  background: '#2a2a2a',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  color: '#fff'
                }}
                autoFocus={threadMessage.children.length === 0}
              />
              <button 
                type="submit"
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
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
          )}
          
          {/* Display thread messages */}
          {threadMessage.children.map(childId => (
            <MessageView
              key={childId}
              messageId={childId}
              allMessages={allMessages}
              onSetReply={onSetReply}
              onAddToContext={onAddToContext}
              onToggleCollapse={onToggleCollapse}
              onSendMessage={onSendMessage}
              selectedModel={selectedModel}
              isInlineThread={true}
            />
          ))}
        </div>
      );
      
      // Continue with any text after this inline thread
      segments.push(<br key={`break-${index}`} />);
    }

    lastIndex = anchor.endIndex;
  });

  // Add any remaining text after the last anchor
  if (lastIndex < message.text.length) {
    const remainingText = message.text.substring(lastIndex);
    segments.push(
      <span key="text-end">
        {remainingText}
      </span>
    );
  }

  return <div className="message-text">{segments}</div>;
};

export default MessageTextWithThreads;
