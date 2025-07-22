import React, { useState, useRef, useEffect } from 'react';
import { LuChevronDown, LuPlus } from 'react-icons/lu';
import { type ChatThread } from './MainContent';

interface SidebarProps {
  chats: ChatThread[];
  activeChatId: string | null;
  onNewChat: () => void;
  onChatSelect: (chatId: string) => void;
  userEmail: string | undefined;
  onSignOut: () => void;
  className?: string;
  model: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4';
  onModelChange: (newModel: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4') => void;
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
  const [isOpen, setIsOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  const getModelDisplayName = (modelId: string) => {
    switch (modelId) {
      case 'nova-lite': return 'Nova Lite';
      case 'nova-pro': return 'Nova Pro';
      case 'claude-3-7-sonnet': return 'Claude 3.7 Sonnet';
      case 'claude-sonnet-4': return 'Claude Sonnet 4';
      default: return modelId;
    }
  };

  const getModelDescription = (modelId: string) => {
    switch (modelId) {
      case 'nova-lite': return '低コスト、日常的なタスク';
      case 'nova-pro': return '低コスト、複雑な推論タスク';
      case 'claude-3-7-sonnet': return '中コスト、高度な推論能力';
      case 'claude-sonnet-4': return '高コスト、最上位モデル';
      default: return '';
    }
  };

  // モデルの定義配列
  const modelOptions = [
    { group: 'Amazon Nova', models: ['nova-lite', 'nova-pro'] },
    { group: 'Anthropic Claude', models: ['claude-3-7-sonnet', 'claude-sonnet-4'] }
  ] as const;

  // 外部クリックでドロップダウンを閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOptionClick = (selectedModel: string) => {
    onModelChange(selectedModel as typeof model);
    setIsOpen(false);
  };

  return (
    <aside className={`sidebar ${className}`}>
      <div className="sidebar-header">
        CPI社内文書AI
      </div>

      {/* カスタムモデル選択ドロップダウン */}
      <div className="model-selector-dropdown" ref={selectRef}>
        <div className="custom-select">
          <div 
            className="custom-select-trigger"
            onClick={() => setIsOpen(!isOpen)}
          >
            <div className="selected-model">
              <div className="selected-model-name">{getModelDisplayName(model)}</div>
              <div className="selected-model-description">{getModelDescription(model)}</div>
            </div>
            <LuChevronDown className={`chevron ${isOpen ? 'open' : ''}`} />
          </div>
          
          {isOpen && (
            <div className="custom-select-dropdown">
              {modelOptions.map((group) => (
                <div key={group.group} className="option-group">
                  <div className="option-group-label">{group.group}</div>
                  {group.models.map((modelId) => (
                    <div
                      key={modelId}
                      className={`option-item ${model === modelId ? 'selected' : ''}`}
                      onClick={() => handleOptionClick(modelId)}
                    >
                      <div className="option-name">{getModelDisplayName(modelId)}</div>
                      <div className="option-description">{getModelDescription(modelId)}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
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