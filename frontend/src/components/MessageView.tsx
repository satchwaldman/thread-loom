import React from 'react';
import type { Message } from '../types';

interface MessageViewProps {
  messageId: string;
  allMessages: Map<string, Message>;
  onSetReply: (parentId: string) => void;
  onAddToContext: (messageId: string) => void;
}

const MessageView: React.FC<MessageViewProps> = ({ messageId, allMessages, onSetReply, onAddToContext }) => {
  const message = allMessages.get(messageId);

  if (!message) {
    return <div>Message not found!</div>;
  }

  return (
    <div className="message-container">
      <div className="message">
        <div className="sender">{message.sender}</div>
        <div>{message.text}</div>
        <button onClick={() => onSetReply(message.id)} style={{ fontSize: '10px', padding: '2px 5px', marginLeft: '10px' }}>Reply</button>
        <button onClick={() => onAddToContext(message.id)} style={{ fontSize: '10px', padding: '2px 5px', marginLeft: '5px' }}>Add to Context</button>
      </div>
      {!message.isCollapsed && (
        <div className="children-container" style={{ marginLeft: '20px' }}>
          {message.children.map(childId => (
            <MessageView key={childId} messageId={childId} allMessages={allMessages} onSetReply={onSetReply} onAddToContext={onAddToContext} />
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageView;
