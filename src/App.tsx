// src/App.tsx

import { useState, useEffect } from 'react';
import { useAuth } from "react-oidc-context";
import './App.css';

// コンポーネントと型をインポート
import Sidebar, { type ChatThread, type Message } from './components/Sidebar';
import MainContent from './components/MainContent';
import SignInScreen from './components/SignInScreen';

interface ApiResponse {
  answer?: string; // 既存チャットの場合はanswerが返る (オプショナル)
  newChat?: ChatThread; // 新規チャットの場合はnewChatが返る (オプショナル)
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


  // --- ▼▼▼ 認証後にDBから履歴を読み込むuseEffect ▼▼▼ ---
  useEffect(() => {
    const fetchHistory = async () => {
      if (auth.isAuthenticated && auth.user?.id_token) {
        setIsLoading(true);
        try {
          const apiEndpoint = import.meta.env.VITE_APP_API_ENDPOINT;
          const res = await fetch(apiEndpoint, {
            method: 'GET', // GETリクエスト
            headers: {
              'Authorization': `Bearer ${auth.user.id_token}`
            }
          });
          if (!res.ok) throw new Error('Failed to fetch history');
          
          const historyData: ChatThread[] = await res.json();
          setChats(historyData);
        } catch (error) {
          console.error("履歴の取得に失敗しました:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchHistory();
  }, [auth.isAuthenticated, auth.user?.id_token]); // 認証状態が変わったら実行


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

    // --- 楽観的UI更新 ---
    const isNewChat = activeChatId === null;
    let tempChatId: string | null = null;
    
    if (isNewChat) {
      tempChatId = "temp-" + Date.now().toString();
      const newChat: ChatThread = { id: tempChatId, title: currentPrompt.substring(0, 20), messages: [userMessage] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(tempChatId);
    } else {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat
      ));
    }
    // ---

    try {
      const apiEndpoint = import.meta.env.VITE_APP_API_ENDPOINT;
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.user?.id_token}` },
        body: JSON.stringify({ user_prompt: currentPrompt, chat_id: activeChatId }),
      });
      if (!res.ok) { throw new Error(`HTTP error! status: ${res.status}`); }
      
      const data: ApiResponse = await res.json();

      // ▼▼▼ API応答のハンドリングを修正 ▼▼▼
      if (data.newChat) { // 新規チャットの場合
        const newChatFromDB: ChatThread = data.newChat;
        // 一時的なチャットを、DBから返ってきた本物のチャットに置き換える
        setChats(prev => prev.map(chat => chat.id === tempChatId ? newChatFromDB : chat));
        // activeChatIdも本物のIDに更新
        setActiveChatId(newChatFromDB.id);
      } else if (data.answer) { // 既存チャットの場合
        const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.answer };
        setChats(prev => prev.map(chat => 
          chat.id === activeChatId ? { ...chat, messages: [...chat.messages, assistantMessage] } : chat
        ));
      }

    } catch (err: any) {
      // エラーが発生した場合、一時的なチャットを削除するなどの後処理も可能
      console.error(err);
      if (tempChatId) {
        setChats(prev => prev.filter(chat => chat.id !== tempChatId));
        setActiveChatId(null);
      }
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