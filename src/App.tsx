// src/App.tsx
import { useState, useEffect } from 'react';
import { useAuth } from "react-oidc-context";
import './App.css';

// コンポーネントと型をインポート
import Sidebar from './components/Sidebar';
import MainContent, { type ChatThread, type Message } from './components/MainContent';
import SignInScreen from './components/SignInScreen';

interface ApiResponse {
  answer?: string;
  newChat?: ChatThread;
}

function App() {
  const auth = useAuth();
  
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      if (auth.isAuthenticated && auth.user?.id_token) {
        try {
          const apiEndpoint = import.meta.env.VITE_APP_API_ENDPOINT;
          const res = await fetch(apiEndpoint, {
            method: 'GET',
            headers: { 'Authorization': `Bearer ${auth.user.id_token}` }
          });
          if (!res.ok) throw new Error('Failed to fetch history');
          
          const historyData: ChatThread[] = await res.json();
          setChats(historyData);
        } catch (error) {
          console.error("履歴の取得に失敗しました:", error);
        }
      }
    };
    fetchHistory();
  }, [auth.isAuthenticated, auth.user?.id_token]);


  const handleSignOut = async () => {
    await auth.removeUser();
    const clientId = "370ul24957c9akfm11j1eelooj";
    const logoutUri = import.meta.env.VITE_APP_POST_LOGOUT_REDIRECT_URI;
    const cognitoDomain = "https://ap-northeast-1baatqb5cy.auth.ap-northeast-1.amazoncognito.com";
    window.location.href = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const handleSendPrompt = async () => {
    if (!prompt.trim() || !auth.user?.id_token) return;
    
    setIsLoading(true);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const currentPrompt = prompt;
    setPrompt('');

    const isNewChat = activeChatId === null;
    let tempChatId: string | null = null;
    let updatedActiveChatId = activeChatId;
    
    if (isNewChat) {
      tempChatId = "temp-" + Date.now().toString();
      const newChat: ChatThread = { id: tempChatId, title: currentPrompt.substring(0, 30) + '...', messages: [userMessage] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(tempChatId);
      updatedActiveChatId = tempChatId;
    } else {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage] } : chat
      ));
    }
    
    try {
      const apiEndpoint = import.meta.env.VITE_APP_API_ENDPOINT;
      const res = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${auth.user.id_token}` },
        body: JSON.stringify({ user_prompt: currentPrompt, chat_id: activeChatId }),
      });
      if (!res.ok) { throw new Error(`HTTP error! status: ${res.status}`); }
      
      const data: ApiResponse = await res.json();

      if (data.newChat) {
        const newChatFromDB: ChatThread = data.newChat;
        setChats(prev => prev.map(chat => chat.id === tempChatId ? newChatFromDB : chat));
        setActiveChatId(newChatFromDB.id);
      } else if (data.answer) {
        const assistantMessage: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: data.answer };
        setChats(prev => prev.map(chat => 
          chat.id === updatedActiveChatId ? { ...chat, messages: [...chat.messages, assistantMessage] } : chat
        ));
      }

    } catch (err: any) {
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
    setPrompt('');
  };
  
  const handleChatSelect = (chatId: string) => {
    setActiveChatId(chatId);
  };

  const activeMessages = chats.find(chat => chat.id === activeChatId)?.messages || [];
  
  if (auth.isLoading) { return <div>Loading...</div>; }
  if (auth.error) { return <div>{auth.error.message}</div>; }
  
  if (auth.isAuthenticated) {
    return (
      <div className="app-layout">
        <Sidebar 
          chats={chats}
          activeChatId={activeChatId}
          onNewChat={startNewChat}
          onChatSelect={handleChatSelect}
          userEmail={auth.user?.profile.email}
          onSignOut={handleSignOut}
        />
        <MainContent 
          messages={activeMessages}
          promptInput={prompt}
          isLoading={isLoading && activeChatId !== null}
          onPromptChange={setPrompt}
          onSendPrompt={handleSendPrompt}
          // isChatActive={activeChatId !== null} // 不要なため削除
        />
      </div>
    );
  }

  return <SignInScreen onSignIn={() => auth.signinRedirect()} />;
}

export default App;