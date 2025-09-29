import { useState, useEffect, useRef } from 'react';
import './App.css';
import type { Message, ThreadAnchor } from './types';
import MessageView from './components/MessageView';
import Sidebar from './components/Sidebar';
import SelectionPopup from './components/SelectionPopup';

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
  const [messages, setMessages] = useState<Map<string, Message>>(new Map());
  const [mainThreadIds, setMainThreadIds] = useState<string[]>([]);
  
  const [inputText, setInputText] = useState('');
  const [selectedModel, setSelectedModel] = useState('gpt-5-mini');
  const [activeParentId, setActiveParentId] = useState<string | null>(null);
  const [selectedContextIds, setSelectedContextIds] = useState<string[]>([]);
  const [totalCost, setTotalCost] = useState(0);

  // Selection popup state
  const [selectionPopup, setSelectionPopup] = useState<{
    visible: boolean;
    x: number;
    y: number;
    selectedText: string;
    messageIds: string[];
    startOffset?: number;
    endOffset?: number;
  }>({
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    messageIds: [],
  });

  // Handle text selection
  useEffect(() => {
    const handleMouseUp = () => {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0) {
        return;
      }

      const selectedText = selection.toString().trim();
      if (!selectedText) {
        setSelectionPopup(prev => ({ ...prev, visible: false }));
        return;
      }

      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Find which message(s) the selection spans
      const messageIds = new Set<string>();
      
      // Helper function to find parent message
      const findMessageId = (node: Node): string | null => {
        let current = node as HTMLElement;
        while (current && current !== document.body) {
          if (current.nodeType === Node.ELEMENT_NODE) {
            const element = current as HTMLElement;
            if (element.classList?.contains('message') && element.dataset.messageId) {
              return element.dataset.messageId;
            }
          }
          current = current.parentNode as HTMLElement;
        }
        return null;
      };

      // Find the message text container
      const findMessageTextContainer = (node: Node): HTMLElement | null => {
        let current = node as HTMLElement;
        while (current && current !== document.body) {
          if (current.nodeType === Node.ELEMENT_NODE) {
            const element = current as HTMLElement;
            if (element.classList?.contains('message-text')) {
              return element;
            }
          }
          current = current.parentNode as HTMLElement;
        }
        return null;
      };

      const startMessageId = findMessageId(range.startContainer);
      const endMessageId = findMessageId(range.endContainer);

      if (startMessageId) messageIds.add(startMessageId);
      if (endMessageId && endMessageId !== startMessageId) messageIds.add(endMessageId);

      const messageIdArray = Array.from(messageIds);

      // Calculate text position within the message (for single message selections)
      let startOffset = undefined;
      let endOffset = undefined;
      
      if (messageIdArray.length === 1) {
        const messageTextContainer = findMessageTextContainer(range.startContainer);
        if (messageTextContainer) {
          const fullText = messageTextContainer.textContent || '';
          const preSelectionRange = document.createRange();
          preSelectionRange.selectNodeContents(messageTextContainer);
          preSelectionRange.setEnd(range.startContainer, range.startOffset);
          const preSelectionText = preSelectionRange.toString();
          
          startOffset = preSelectionText.length;
          endOffset = startOffset + selectedText.length;
        }
      }

      if (messageIdArray.length > 0) {
        setSelectionPopup({
          visible: true,
          x: rect.left + rect.width / 2,
          y: rect.top - 40, // Position above selection
          selectedText,
          messageIds: messageIdArray,
          startOffset,
          endOffset,
        });
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, []);

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

  const handleAddThread = () => {
    if (selectionPopup.messageIds.length !== 1) return;
    if (selectionPopup.startOffset === undefined || selectionPopup.endOffset === undefined) return;
    
    const messageId = selectionPopup.messageIds[0];
    const message = messages.get(messageId);
    if (!message) return;

    // Create a placeholder message for the inline thread
    const anchorId = `anchor_${Date.now()}_${Math.random()}`;
    const anchorMessage = createNewMessage('', 'user', messageId); // Empty placeholder
    anchorMessage.id = anchorId;

    // Create thread anchor
    const newAnchor: ThreadAnchor = {
      startIndex: selectionPopup.startOffset,
      endIndex: selectionPopup.endOffset,
      threadId: anchorId,
      text: selectionPopup.selectedText,
    };

    // Update the message with the new thread anchor
    const newMessagesMap = new Map(messages);
    const updatedMessage = newMessagesMap.get(messageId);
    if (updatedMessage) {
      updatedMessage.threadAnchors = [...(updatedMessage.threadAnchors || []), newAnchor];
      newMessagesMap.set(anchorId, anchorMessage);
      setMessages(newMessagesMap);
      
      // Set this as the active parent for the next message
      setActiveParentId(anchorId);
    }
    
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(prev => ({ ...prev, visible: false }));
  };

  const handleAddSelectionToContext = () => {
    // Add all messages that contain the selection to context
    selectionPopup.messageIds.forEach(messageId => {
      handleAddToContext(messageId);
    });
    
    window.getSelection()?.removeAllRanges();
    setSelectionPopup(prev => ({ ...prev, visible: false }));
  };

  const handleSendMessage = async (e: React.FormEvent, parentId?: string | null, messageText?: string) => {
    e.preventDefault();
    const actualParentId = parentId !== undefined ? parentId : activeParentId;
    
    // Get text from form input if not provided directly
    const textToSend = messageText || inputText;
    
    if (textToSend.trim() === '') return;

    const userMessage = createNewMessage(textToSend, 'user', actualParentId);
    const newMessagesMap = new Map(messages);
    newMessagesMap.set(userMessage.id, userMessage);

    // If it's a reply, update the parent's children array
    if (actualParentId) {
      const parent = newMessagesMap.get(actualParentId);
      if (parent) {
        parent.children.push(userMessage.id);
      }
    } else {
      setMainThreadIds([...mainThreadIds, userMessage.id]);
    }

    setMessages(newMessagesMap);
    setInputText('');
    setActiveParentId(null); // Reset after sending

    // Create AI message placeholder with empty text
    const aiMessageId = `msg_${Date.now()}_${Math.random()}`;
    const aiMessage = createNewMessage('', 'ai', actualParentId);
    aiMessage.id = aiMessageId;
    
    const streamingMap = new Map(newMessagesMap);
    streamingMap.set(aiMessage.id, aiMessage);
    
    // Add AI message to the same parent as user message
    if (actualParentId) {
      const parent = streamingMap.get(actualParentId);
      if (parent) {
        parent.children.push(aiMessage.id);
      }
    } else {
      setMainThreadIds(prev => [...prev, aiMessage.id]);
    }
    
    setMessages(streamingMap);

    // --- Context Construction ---
    let context = '';
    
    // Build context by traversing up the parent chain
    const contextMessages: string[] = [];
    let currentId = actualParentId;
    let depth = 0;
    const maxDepth = 20; // Limit context depth
    let threadAnchorText = '';
    
    // Check if this is an inline thread and get the anchor text
    if (actualParentId?.includes('anchor_')) {
      const parentMessage = messages.get(actualParentId);
      if (parentMessage && parentMessage.parentId) {
        const grandparentMessage = messages.get(parentMessage.parentId);
        const anchor = grandparentMessage?.threadAnchors?.find(a => a.threadId === actualParentId);
        if (anchor) {
          threadAnchorText = anchor.text;
        }
      }
    }
    
    while (currentId && depth < maxDepth) {
      const msg = messages.get(currentId);
      if (msg && msg.text) {
        // Add message to context (prepend since we're going backwards)
        // Don't include empty anchor messages
        if (!msg.id.includes('anchor_') || msg.text !== '') {
          contextMessages.unshift(`${msg.sender}: ${msg.text}`);
        }
      }
      currentId = msg?.parentId || null;
      depth++;
    }
    
    // Add selected context if any
    if (selectedContextIds.length > 0) {
      const selectedContext = selectedContextIds.map(id => {
        const msg = messages.get(id);
        return msg ? `${msg.sender}: ${msg.text}` : '';
      }).filter(text => text).join('\n\n');
      if (selectedContext) {
        context = selectedContext + '\n\n---\n\n' + contextMessages.join('\n\n');
      } else {
        context = contextMessages.join('\n\n');
      }
    } else {
      context = contextMessages.join('\n\n');
    }
    
    // Special prompt engineering for inline threads
    let finalPrompt = '';
    if (threadAnchorText) {
      // This is an inline thread - add special context
      finalPrompt = `You are responding to a side thread about "${threadAnchorText}". 
Give a response to the following prompt: "${textToSend}"
Focus specifically on how it relates to "${threadAnchorText}".

Context of the conversation:
${context}

User: ${textToSend}`;
    } else {
      finalPrompt = context ? `${context}\n\n---\n\nUser: ${textToSend}` : `User: ${textToSend}`;
    }
    
    // --- End Context Construction ---

    // Use EventSource for streaming
    const params = new URLSearchParams({
      message: finalPrompt,
      model: selectedModel
    });
    
    console.log('Attempting SSE connection with params:', params.toString());
    console.log('URL length:', `http://localhost:3001/chat-stream?${params}`.length);
    
    const eventSource = new EventSource(`http://localhost:3001/chat-stream?${params}`);
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'chunk') {
          // Append chunk to AI message
          setMessages(prevMessages => {
            const updatedMessages = new Map(prevMessages);
            const aiMsg = updatedMessages.get(aiMessageId);
            if (aiMsg) {
              aiMsg.text = (aiMsg.text || '') + data.content;
            }
            return updatedMessages;
          });
        } else if (data.type === 'done') {
          // Update with final metadata
          setMessages(prevMessages => {
            const updatedMessages = new Map(prevMessages);
            const aiMsg = updatedMessages.get(aiMessageId);
            if (aiMsg) {
              aiMsg.model = data.model;
              aiMsg.cost = data.cost;
            }
            return updatedMessages;
          });
          setTotalCost(prevCost => prevCost + (data.cost || 0));
          eventSource.close();
        } else if (data.type === 'error') {
          console.error('Stream error:', data.message);
          setMessages(prevMessages => {
            const updatedMessages = new Map(prevMessages);
            const aiMsg = updatedMessages.get(aiMessageId);
            if (aiMsg) {
              aiMsg.text = `Error: ${data.message}`;
              aiMsg.sender = 'error';
            }
            return updatedMessages;
          });
          eventSource.close();
        }
      } catch (error) {
        console.error('Parse error:', error);
      }
    };
    
    eventSource.onerror = (error) => {
      console.error('EventSource error:', error);
      setMessages(prevMessages => {
        const updatedMessages = new Map(prevMessages);
        const aiMsg = updatedMessages.get(aiMessageId);
        if (aiMsg) {
          aiMsg.text = 'Failed to connect to the server.';
          aiMsg.sender = 'error';
        }
        return updatedMessages;
      });
      eventSource.close();
    };
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
            onSendMessage={handleSendMessage}
            selectedModel={selectedModel}
          />
        ))}
        </div>
        {activeParentId && (
          <div style={{ textAlign: 'left', padding: '0 1rem', fontSize: '12px', color: '#aaa' }}>
            {activeParentId.includes('anchor_') 
              ? `Creating inline thread at: "${messages.get(activeParentId)?.parentId ? 
                  messages.get(messages.get(activeParentId)?.parentId || '')?.threadAnchors?.find(a => a.threadId === activeParentId)?.text : ''}"...`
              : `Replying to message: ${messages.get(activeParentId)?.text.substring(0, 50)}...`
            }
            <button onClick={() => setActiveParentId(null)} style={{ marginLeft: '10px' }}>Cancel</button>
          </div>
        )}
        <form className="input-form" onSubmit={(e) => handleSendMessage(e, null)}>
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
      {selectionPopup.visible && (
        <SelectionPopup
          x={selectionPopup.x}
          y={selectionPopup.y}
          showAddThread={selectionPopup.messageIds.length === 1}
          onAddThread={handleAddThread}
          onAddToContext={handleAddSelectionToContext}
          onClose={() => setSelectionPopup(prev => ({ ...prev, visible: false }))}
        />
      )}
    </div>
  );
}

export default App;
