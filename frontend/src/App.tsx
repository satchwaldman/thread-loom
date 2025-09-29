import { useState } from 'react';
import './App.css';
import type { Message } from './types';
import MessageView from './components/MessageView';
import Sidebar from './components/Sidebar';

// --- Utility Functions ---

const createNewMessage = (
  text: string,
  sender: 'user' | 'ai' | 'error',
  parentId: string | null,
  options: { model?: string; cost?: number } = {}
): Message => {
  return {
    id: `msg_${Date.now()}_${Math.random()}`,
    text,
    sender,
    parentId,
    children: [],
    isCollapsed: false,
    threadAnchors: [],
    model: options.model,
    cost: options.cost,
  };
};

// --- Main App Component ---

function App() {
  const [messages, setMessages] = useState<Map<string, Message>>(() => {
    const initialMessage = createNewMessage('Welcome to Thread Loom!', 'ai', null);
    const map = new Map<string, Message>();
    map.set(initialMessage.id, initialMessage);
    return map;
  });

  const [mainThreadIds, setMainThreadIds] = useState<string[]>(() => {
    // In a real app, we'd derive this from the initial messages map
    return Array.from(messages.keys());
  });

  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-5-mini');
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  const handleRemoveFromContext = (messageId: string) => {
    setSelectedContextIds(prev => prev.filter(id => id !== messageId));
  };

  const handleAddToContext = (messageId: string) => {
    setSelectedContextIds(prev => {
      if (prev.includes(messageId)) return prev; // Avoid duplicates
      return [...prev, messageId];
    });
  };

  const handleToggleCollapse = (messageId: string) => {
    const newMessagesMap = new Map(messages);
    const message = newMessagesMap.get(messageId);
    if (message) {
      message.isCollapsed = !message.isCollapsed;
      setMessages(newMessagesMap);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() === '') return;

    const userMessage = createNewMessage(inputText, 'user', activeParentId);
    const newMessagesMap = new Map(messages);
    newMessagesMap.set(userMessage.id, userMessage);

    // If it's a reply, update the parent's children array
    if (activeParentId) {
      const parent = newMessagesMap.get(activeParentId);
      if (parent) {
        parent.children.push(userMessage.id);
      }
    } else {
      setMainThreadIds([...mainThreadIds, userMessage.id]);
    }

    setMessages(newMessagesMap);
    setInputText('');
    setActiveParentId(null); // Reset after sending

    try {
      // --- Context Construction ---
      let context = '';
      if (selectedContextIds.length > 0) {
        context = selectedContextIds.map(id => messages.get(id)?.text || '').join('\n\n');
      } else {
        // TODO: Implement default tree traversal logic here
      }
      const messageWithContext = context ? `${context}\n\n---\n\nUser: ${inputText}` : inputText;
      // --- End Context Construction ---

      const response = await fetch('http://localhost:3001/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageWithContext, model: selectedModel }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const aiResponseData = await response.json();
      // The AI's response should be a child of the user's message
      const aiMessage = createNewMessage(aiResponseData.text, 'ai', userMessage.id, {
        model: aiResponseData.model,
        cost: aiResponseData.cost,
      });
      
      const finalMessagesMap = new Map(newMessagesMap);
      finalMessagesMap.set(aiMessage.id, aiMessage);
      userMessage.children.push(aiMessage.id); // Link AI response to user message
      setMessages(finalMessagesMap);
      setTotalCost(prevCost => prevCost + (aiResponseData.cost || 0));

    } catch (error) {
      console.error('Fetch error:', error);
      const errorMessage = createNewMessage('Failed to get a response from the server.', 'error', userMessage.id);
      
      const errorMap = new Map(newMessagesMap);
      errorMap.set(errorMessage.id, errorMessage);
      userMessage.children.push(errorMessage.id);
      setMessages(errorMap);
    }
  };

  return (
    <div className="main-layout">
      <div className="chat-container">
        <div style={{ padding: '0.5rem 1rem', borderBottom: '1px solid #444', textAlign: 'left' }}>
          Total Cost: ${totalCost.toFixed(6)}
        </div>
        <div className="message-list">
        {mainThreadIds.map(id => (
          <MessageView
            key={id}
            messageId={id}
            allMessages={messages}
            onSetReply={setActiveParentId}
            onAddToContext={handleAddToContext}
            onToggleCollapse={handleToggleCollapse}
          />
        ))}
        </div>
        {activeParentId && (
          <div style={{ textAlign: 'left', padding: '0 1rem', fontSize: '12px', color: '#aaa' }}>
            Replying to message: {messages.get(activeParentId)?.text.substring(0, 50)}...
            <button onClick={() => setActiveParentId(null)} style={{ marginLeft: '10px' }}>Cancel</button>
          </div>
        )}
        <form className="input-form" onSubmit={handleSendMessage}>
          <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
            <option value="gpt-5">GPT-5</option>
            <option value="gpt-5-mini">GPT-5 Mini</option>
            <option value="gpt-5-nano">GPT-5 Nano</option>
          </select>
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type your message..."
          />
          <button type="submit">Send</button>
        </form>
      </div>
      <Sidebar
        selectedContextIds={selectedContextIds}
        allMessages={messages}
        onRemoveFromContext={handleRemoveFromContext}
      />
    </div>
  );
}

export default App;
