// src/components/MainContent.tsx
import React, { useRef, useState, useLayoutEffect } from 'react';
import { LuSendHorizontal, LuUser, LuBot, LuCopy, LuArrowDown, LuMenu, LuX } from 'react-icons/lu';
import TextareaAutosize from 'react-textarea-autosize';

// 型定義
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'knowledge_base' | 'general';
}
export interface ChatThread {
  id:string;
  title: string;
  messages: Message[];
}

interface MainContentProps {
  messages: Message[];
  promptInput: string;
  isLoading: boolean;
  onPromptChange: (newPrompt: string) => void;
  onSendPrompt: () => void; // 引数なしに変更
  mode: 'knowledge_base' | 'general'; // modeを受け取る
  onModeChange: (newMode: 'knowledge_base' | 'general') => void; // mode変更関数を受け取る
  onToggleSidebar?: () => void; // モバイル用サイドバー切り替え
  isMobileSidebarOpen?: boolean; // サイドバーの開閉状態
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
      // 一時的にスクロール動作を無効化して瞬間移動
      const originalBehavior = chatArea.style.scrollBehavior;
      chatArea.style.scrollBehavior = 'auto';
      chatArea.scrollTop = chatArea.scrollHeight;
      // すぐにスクロール動作を元に戻す
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
      // 手動でボタンを押した時のみスムーズスクロール
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
          {msg.role === 'assistant' && msg.mode && (
            <span className={`mode-tag mode-${msg.mode}`}>
              {msg.mode === 'knowledge_base' ? '社内データで検索' : '通常AIで生成'}
            </span>
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
        <div style={{ width: '40px' }}></div> {/* スペーサー */}
      </div>

      <div className="chat-area-wrapper">
        <div className="chat-area" ref={chatAreaRef} onScroll={handleScroll}>
          {messages.map(renderMessage)}
        </div>
        
        {showScrollToBottom && (
          <button className="scroll-to-bottom-button" onClick={scrollToBottom} title="一番下へ移動">
            <LuArrowDown />
          </button>
        )}
        
        <div className="prompt-input-wrapper">
          
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