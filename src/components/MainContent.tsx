// src/components/MainContent.tsx
import React, { useRef, useState, useLayoutEffect } from 'react';
import { LuSendHorizontal, LuUser, LuBot, LuCopy, LuMenu, LuX } from 'react-icons/lu';
import { IoArrowDown } from 'react-icons/io5';
import TextareaAutosize from 'react-textarea-autosize';

// 型定義
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'knowledge_base' | 'general';
  model?: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4'; // モデル選択肢を拡張
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
}

interface MainContentProps {
  messages: Message[];
  promptInput: string;
  isLoading: boolean;
  onPromptChange: (newPrompt: string) => void;
  onSendPrompt: () => void;
  mode: 'knowledge_base' | 'general';
  onModeChange: (newMode: 'knowledge_base' | 'general') => void;
  model: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4'; // モデル選択を拡張
  onModelChange: (newModel: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4') => void; // モデル変更を拡張
  onToggleSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
}

const MainContent: React.FC<MainContentProps> = ({
  messages,
  promptInput,
  isLoading,
  onPromptChange,
  onSendPrompt,
  mode,
  onModeChange,
  onToggleSidebar,
  isMobileSidebarOpen = false,
}) => {
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  useLayoutEffect(() => {
    const chatArea = chatAreaRef.current;
    if (chatArea && messages.length > 0) {
      const originalBehavior = chatArea.style.scrollBehavior;
      chatArea.style.scrollBehavior = 'auto';
      chatArea.scrollTop = chatArea.scrollHeight;
      chatArea.style.scrollBehavior = originalBehavior;
    }
  }, [messages, isLoading]);

  const handleScroll = () => {
    const chatArea = chatAreaRef.current;
    if (!chatArea) return;
    const { scrollTop, scrollHeight, clientHeight } = chatArea;
    const isScrolledUp = scrollHeight - scrollTop > clientHeight + 200;
    setShowScrollToBottom(isScrolledUp);
  };

  const scrollToBottom = () => {
    const chatArea = chatAreaRef.current;
    if (chatArea) {
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }
  };
  
  const handleCopy = async (textToCopy: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      alert('コピーに失敗しました。');
    }
  };

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

  const renderMessage = (msg: Message) => {
    const messageContent = (
      <>
        <div className="message-header">
          <div className="sender-info">
            <div className="icon">{msg.role === 'user' ? <LuUser /> : <LuBot />}</div>
            <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
          </div>
        </div>
        <div className="message-content">
          {msg.role === 'assistant' && msg.content === '' ? (
            <div className="spinner-dots" />
          ) : (
            <p>{msg.content}</p>
          )}
        </div>
        <div className="message-actions">
          {msg.role === 'assistant' && (
            <div className="message-meta">
              {msg.mode && (
                <span className={`mode-tag mode-${msg.mode}`}>
                  {msg.mode === 'knowledge_base' ? '社内データで検索' : '通常AIで生成'}
                </span>
              )}
              {msg.model && (
                <span className={`model-tag model-${msg.model}`}>
                  {getModelDisplayName(msg.model)}
                </span>
              )}
            </div>
          )}
          {copiedId === msg.id ? (
            <span className="copied-feedback">コピーしました！</span>
          ) : (
            <button className="action-icon" title="Copy" onClick={() => handleCopy(msg.content, msg.id)}>
              <LuCopy />
            </button>
          )}
        </div>
      </>
    );

    return (
      <div key={msg.id} className={`message-wrapper ${msg.role}`}>
        <div className="message-content-container">{messageContent}</div>
      </div>
    );
  };
  
  return (
    <main className="main-content">
      {/* モバイル用ヘッダー */}
      <div className="mobile-header">
        <button 
          className={`mobile-menu-button ${isMobileSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title={isMobileSidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          {isMobileSidebarOpen ? <LuX /> : <LuMenu />}
        </button>
        <div className="mobile-title">CPI社内文書AI</div>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="chat-area-wrapper">
        <div className="chat-area" ref={chatAreaRef} onScroll={handleScroll}>
          {messages.map(renderMessage)}
        </div>
        
        {showScrollToBottom && (
          <button className="scroll-to-bottom-button" onClick={scrollToBottom} title="一番下へ移動">
            <IoArrowDown />
          </button>
        )}
        
        <div className="prompt-input-wrapper">
          
          {/* モード選択セクション */}
          <div className="mode-selector">
            <label className="radio-label">
              <input 
                type="radio" 
                name="chatMode" 
                value="knowledge_base"
                checked={mode === 'knowledge_base'}
                onChange={() => onModeChange('knowledge_base')}
                disabled={isLoading}
              />
              <span>社内データのみ</span>
            </label>
            <label className="radio-label">
              <input 
                type="radio" 
                name="chatMode" 
                value="general"
                checked={mode === 'general'}
                onChange={() => onModeChange('general')}
                disabled={isLoading}
              />
              <span>通常生成AI利用</span>
            </label>
          </div>

          <div className="prompt-input-container">
            <TextareaAutosize
              className="prompt-textarea"
              value={promptInput}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (!isLoading && promptInput.trim()) {
                    onSendPrompt();
                  }
                }
              }}
              placeholder="ご自由に入力してください..."
              disabled={isLoading}
              rows={1}
              maxRows={10}
            />
            <button 
              className="send-icon-button"
              onClick={onSendPrompt} 
              disabled={isLoading || !promptInput.trim()}
              title="送信"
            >
              <LuSendHorizontal />
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

export default MainContent;