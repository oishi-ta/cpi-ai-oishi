export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'knowledge_base' | 'general';
  model?: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4';
  attachment?: {
    fileName: string;
    fileType?: string;
    size?: number;
    data?: string;
    s3Key?: string;
    displayUrl?: string;
    fileUrl?: string;
    note?: string;
    isLoading?: boolean;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
}

export type ChatMode = 'knowledge_base' | 'general';

export type ModelType = 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4';

export type ChatListItem = Omit<ChatThread, 'messages'>;

export interface SSEMessage {
  type: string;
  data: any;
}