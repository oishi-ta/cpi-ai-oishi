// src/components/Sidebar.tsx
import React from 'react';
import { LuPlus } from 'react-icons/lu';
import { type ChatThread } from './MainContent';

interface SidebarProps {
  chats: ChatThread[];
  activeChatId: string | null;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  userEmail: string | undefined;
  onSignOut: () => void;
  className?: string;
  // モデル選択用のProps（拡張）
  model: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4';
  onModelChange: (newModel: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4') => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  chats,
  activeChatId,
  onNewChat,
  onChatSelect,
  userEmail,
  onSignOut,
  className = '',
  model,
  onModelChange,
}) => {
  const getModelDisplayName = (modelId: string) => {
    switch (modelId) {
      case 'nova-lite': return 'Nova Lite';
      case 'nova-pro': return 'Nova Pro';
      case 'claude-3-7-sonnet': return 'Claude 3.7 Sonnet';
      case 'claude-3-5-sonnet-v2': return 'Claude 3.5 Sonnet V2';
      case 'claude-sonnet-4': return 'Claude Sonnet 4';
      default: return modelId;
    }
  };

  // モデルの定義配列
  const modelOptions = [
    { group: 'Amazon Nova', models: ['nova-lite', 'nova-pro'] },
    { group: 'Anthropic Claude', models: ['claude-3-5-sonnet-v2', 'claude-3-7-sonnet', 'claude-sonnet-4'] }
  ] as const;

  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-header">
        CPI社内文書AI
      </div>

      {/* モデル選択プルダウン */}
      <div className="model-selector-dropdown">
        <label className="model-selector-label">
          AIモデル: {getModelDisplayName(model)}
        </label>
        <select 
          className="model-selector-select"
          value={model}
          onChange={(e) => onModelChange(e.target.value as typeof model)}
        >
          {modelOptions.map((group) => (
            <optgroup key={group.group} label={group.group}>
              {group.models.map((modelId) => (
                <option key={modelId} value={modelId}>
                  {getModelDisplayName(modelId)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
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