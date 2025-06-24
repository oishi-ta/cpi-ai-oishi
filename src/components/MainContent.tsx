// src/components/MainContent.tsx
import React, { useRef, useState, useLayoutEffect } from 'react';
import { LuSendHorizontal, LuUser, LuBot, LuCopy, LuArrowDown } from 'react-icons/lu';
import TextareaAutosize from 'react-textarea-autosize';

// 型定義
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
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
  onSendPrompt: () => void;
}

const MainContent: React.FC<MainContentProps> = ({
  messages,
  promptInput,
  isLoading,
  onPromptChange,
  onSendPrompt,
}) => {
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  // ★★★ここが修正のポイント★★★
  // 全ての複雑な条件分岐をなくし、最もシンプルで確実なスクロール処理に戻します。
  useLayoutEffect(() => {
    const chatArea = chatAreaRef.current;
    if (chatArea) {
      // メッセージが更新されるか、ローディング状態が変わるたびに、常に一番下へスクロールします。
      chatArea.scrollTop = chatArea.scrollHeight;
    }
  }, [messages, isLoading]); // 依存配列に messages と isLoading を指定


  // 「一番下に移動」ボタンの表示/非表示ロジックは、このままでも問題ありません。
  // （ただし、常に自動スクロールするため、ボタンが表示される機会は減ります）
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
      chatArea.scrollTo({
        top: chatArea.scrollHeight,
        behavior: 'smooth'
      });
    }
  };
  
  const handleCopy = async (textToCopy: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(messageId);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
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
            <div className="icon">
              {msg.role === 'user' ? <LuUser /> : <LuBot />}
            </div>
            <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
          </div>
        </div>
        <div className="message-content">
          <p>{msg.content}</p>
        </div>
        <div className="message-actions">
          {copiedId === msg.id ? (
            <span className="copied-feedback">コピーしました！</span>
          ) : (
            <button 
              className="action-icon" 
              title="Copy"
              onClick={() => handleCopy(msg.content, msg.id)}
            >
              <LuCopy />
            </button>
          )}
        </div>
      </>
    );

    return (
      <div key={msg.id} className={`message-wrapper ${msg.role}`}>
        <div className="message-content-container">
          {messageContent}
        </div>
      </div>
    );
  };

  const renderLoading = () => (
     <div className="message-wrapper assistant">
      <div className="message-content-container">
        <div className="message-header">
          <div className="sender-info">
            <div className="icon"><LuBot /></div>
            <span>Assistant</span>
          </div>
        </div>
        <div className="message-content">
          <div className="spinner-dots" />
        </div>
      </div>
    </div>
  );

  return (
    <main className="main-content">
      <div className="chat-area-wrapper">
        <div className="chat-area" ref={chatAreaRef} onScroll={handleScroll}>
          {messages.map(renderMessage)}
          {isLoading && renderLoading()}
        </div>
        
        {showScrollToBottom && (
          <button className="scroll-to-bottom-button" onClick={scrollToBottom} title="一番下へ移動">
            <LuArrowDown />
          </button>
        )}
        
        <div className="prompt-input-wrapper">
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
              placeholder="質問を入力してください..."
              disabled={isLoading}
              rows={1}
              maxRows={10}
            />
            <button 
              onClick={onSendPrompt} 
              disabled={isLoading || !promptInput.trim()}
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