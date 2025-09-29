export interface ThreadAnchor {
  startIndex: number;
  endIndex: number;
  threadId: string;
  text: string; // The highlighted text
}

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai' | 'error';
  parentId: string | null;
  children: string[];
  isCollapsed: boolean;
  threadAnchors: ThreadAnchor[];
  model?: string;
  cost?: number;
}
