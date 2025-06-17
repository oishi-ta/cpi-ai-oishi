// src/components/Sidebar.tsx

import React from 'react';

// メッセージの型定義
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// チャットスレッドの型定義
export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
}

interface SidebarProps {
  userEmail: string | undefined;
  chats: ChatThread[]; // ChatItem[] から ChatThread[] に変更
  activeChatId: string | null;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  onSignOut: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ userEmail, chats, activeChatId, onNewChat, onChatSelect, onSignOut }) => {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <button onClick={onNewChat} className="new-chat-button">
          + 新しいチャット
        </button>
      </div>
      <nav className="history-nav">
        <ul>
          {chats.map((chat) => (
            // アクティブなチャットをハイライトするCSSクラスを追加
            <li 
              key={chat.id} 
              className={chat.id === activeChatId ? 'active' : ''}
              onClick={() => onChatSelect(chat.id)}
            >
              {chat.title}
            </li>
          ))}
        </ul>
      </nav>
      <div className="sidebar-footer">
        <span>{userEmail}</span>
        <button onClick={onSignOut} className="signout-button">サインアウト</button>
      </div>
    </aside>
  );
};

export default Sidebar;