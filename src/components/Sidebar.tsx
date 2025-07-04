// src/components/Sidebar.tsx
import React from 'react';
import { LuPlus } from 'react-icons/lu';
import { type ChatThread } from './MainContent';

interface SidebarProps {
  chats: ChatThread[];
  activeChatId: string | null;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  // --- フッターに戻すためのProps ---
  userEmail: string | undefined;
  onSignOut: () => void;
  // --- モバイル対応用Props ---
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onNewChat,
  onChatSelect,
  userEmail,
  onSignOut,
  className = '',
}) => {
  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-header">
        CPI社内文書AI
      </div>

      <button onClick={onNewChat} className="new-chat-button">
        <LuPlus />
        新しいチャット
      </button>

      <nav className="history-nav">
        {chats.length > 0 ? (
          <ul>
            {chats.map((chat) => (
              <li
                key={chat.id}
                className={chat.id === activeChatId ? 'active' : ''}
                onClick={() => onChatSelect(chat.id)}
              >
                {chat.title}
              </li>
            ))}
          </ul>
        ) : (
          <p className="no-chats">チャット履歴がありません。</p>
        )}
      </nav>
      
      {/* --- フッターを復活 --- */}
      <div className="sidebar-footer">
        <span>{userEmail}</span>
        <button onClick={onSignOut} className="signout-button">
          サインアウト
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;