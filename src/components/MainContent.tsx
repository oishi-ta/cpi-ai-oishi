import React from 'react';
import { type Message } from './Sidebar'; // SidebarからMessage型をインポート

interface MainContentProps {
  messages: Message[]; // promptとresponseの代わりにmessagesを受け取る
  promptInput: string; // 入力フォーム専用のstate
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
  return (
    <main className="main-content">
      <header className="main-header">
        <h1>CPI社内文書AI</h1>
      </header>
      
      <div className="chat-area">
        {/* メッセージの配列をループして表示 */}
        {messages.map((msg) => (
          <div key={msg.id} className={`message-bubble ${msg.role}`}>
            <p>{msg.content}</p>
          </div>
        ))}
        {/* ローディング中は、新しいチャットの時だけ表示 */}
        {isLoading && <div className="message-bubble assistant"><div className="spinner-dots" /></div>}
      </div>

      <div className="search-container">
        <input
          type="text"
          value={promptInput}
          onChange={(e) => onPromptChange(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !isLoading && onSendPrompt()}
          placeholder="プロンプトを入力"
          disabled={isLoading}
        />
        <button 
          onClick={onSendPrompt} 
          disabled={isLoading || !promptInput.trim()}
        >
          送信
        </button>
      </div>
    </main>
  );
};

export default MainContent;