// src/App.tsx

import { useState, useEffect } from 'react';
import { useAuth } from "react-oidc-context";
import './App.css';

// コンポーネントと型をインポート
import Sidebar, { type ChatThread, type Message } from './components/Sidebar';
import MainContent from './components/MainContent';
import SignInScreen from './components/SignInScreen';

interface ApiResponse {
  answer: string;
}

function App() {
  const auth = useAuth();
  
  const [prompt, setPrompt] = useState<string>(''); // 入力フォーム専用
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    // 現在のアプリケーションの状態に基づいてbodyのIDを決定する
    let pageId = '';
    if (auth.isLoading) {
      pageId = 'page-loading';
    } else if (auth.error) {
      pageId = 'page-error';
    } else if (auth.isAuthenticated) {
      pageId = 'page-authenticated-chat';
    } else {
      pageId = 'page-signin';
    }

    // bodyタグにIDを設定する
    document.body.id = pageId;

    // クリーンアップ関数: コンポーネントがアンマウントされる際にIDを削除する
    return () => {
      document.body.id = '';
    };
  }, [auth.isLoading, auth.error, auth.isAuthenticated]); 
  // これらの状態が変わるたびにエフェクトを再実行


  const handleSignOut = async () => {
    await auth.removeUser();
    const clientId = "370ul24957c9akfm11j1eelooj";
    const logoutUri = import.meta.env.VITE_APP_POST_LOGOUT_REDIRECT_URI;
    const cognitoDomain = "https://ap-northeast-1baatqb5cy.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const currentPrompt = prompt; // 後で使うために保持
    setPrompt(''); // 入力欄をクリア

    let targetChatId = activeChatId;

    // 新規チャットの場合
    if (activeChatId === null) {
      const newChatId = Date.now().toString();
      const newChat: ChatThread = {
        id: newChatId,
        title: currentPrompt.substring(0, 20), // プロンプトの先頭をタイトルに
        messages: [userMessage],
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(newChatId);
      targetChatId = newChatId;
    } else {
      // 既存チャットにメッセージを追加
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat
      ));
    }

    try {
      const apiEndpoint = import.meta.env.VITE_APP_API_ENDPOINT;
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.user?.id_token}`
        },
        body: JSON.stringify({ user_prompt: currentPrompt }),
      });
      if (!res.ok) { throw new Error(`HTTP error! status: ${res.status}`); }
      
      const data: ApiResponse = await res.json();
      const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.answer };

      // 対応するチャットにAIの応答を追加
      setChats(prev => prev.map(chat => 
        chat.id === targetChatId ? { ...chat, messages: [...chat.messages, assistantMessage] } : chat
      ));

    } catch (err: any) {
      console.error(err);
      const errorMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: `エラーが発生しました: ${err.message}` };
      // エラーメッセージをチャットに追加
      setChats(prev => prev.map(chat => 
        chat.id === targetChatId ? { ...chat, messages: [...chat.messages, errorMessage] } : chat
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
  };
  
  const handleChatSelect = (chatId: string) => {
    setActiveChatId(chatId);
  };

  // 表示するメッセージリストを決定
  const activeMessages = chats.find(chat => chat.id === activeChatId)?.messages || [];

  if (auth.isLoading) { return <div>Loading...</div>; }
  if (auth.error) { return <div>{auth.error.message}</div>; }
  
  if (auth.isAuthenticated) {
    return (
      <div className="app-layout">
        <Sidebar 
          userEmail={auth.user?.profile.email}
          chats={chats}
          activeChatId={activeChatId}
          onNewChat={startNewChat}
          onChatSelect={handleChatSelect}
          onSignOut={handleSignOut}
        />
        <MainContent 
          messages={activeMessages}
          promptInput={prompt}
          isLoading={isLoading}
          onPromptChange={setPrompt}
          onSendPrompt={handleSendPrompt}
        />
      </div>
    );
  }

  return <SignInScreen onSignIn={() => auth.signinRedirect()} />;
}

export default App;