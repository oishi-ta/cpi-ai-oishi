// src/types/chat.ts - Message型の簡素化
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
    s3Key?: string;          // 🎯 これが最重要！
    // 🚀 以下のプロパティは削除（PresignedOnlyImageが自動処理）
    // data?: string;        // ❌ Base64データ不要
    // displayUrl?: string;  // ❌ 自動生成されるため不要
    // fileUrl?: string;     // ❌ 不要
    // note?: string;        // ❌ エラー表示は自動処理
    // isLoading?: boolean;  // ❌ コンポーネント内で管理
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