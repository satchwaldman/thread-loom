import React from 'react';
import type { Message } from '../types';

interface SidebarProps {
  selectedContextIds: string[];
  allMessages: Map<string, Message>;
  onRemoveFromContext: (messageId: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedContextIds, allMessages, onRemoveFromContext }) => {
  return (
    <div className="sidebar-container">
      <h4>Context Shopping Cart</h4>
      {selectedContextIds.length === 0 ? (
        <p>No context selected. Default context will be used.</p>
      ) : (
        <ul>
          {selectedContextIds.map(id => {
            const message = allMessages.get(id);
            return (
              <li key={id}>
                <p>"{message?.text.substring(0, 50)}..."</p>
                <button onClick={() => onRemoveFromContext(id)}>Remove</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default Sidebar;
