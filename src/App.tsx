// src/App.tsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from "react-oidc-context";
import './App.css';

import Sidebar from './components/Sidebar';
import MainContent, { type ChatThread, type Message } from './components/MainContent';
import SignInScreen from './components/SignInScreen';

// WebSocketサーバーからのメッセージの型定義
interface WebSocketMessage {
  text?: string;
  status?: 'done';
  newChat?: ChatThread;
  chatId?: string;
  error?: string;
  action?: 'historyResponse';
  data?: Message[]; 
}

// HTTP APIから返されるチャットリストの型
type ChatListItem = Omit<ChatThread, 'messages'>;


function App() {
  const auth = useAuth();
  
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  
  const socketRef = useRef<WebSocket | null>(null);
  const tempChatIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user) {
      setChats([]);
      return;
    }
    const user = auth.user;

    const fetchChatList = async () => {
      try {
        const httpEndpoint = import.meta.env.VITE_APP_HTTP_API_ENDPOINT;
        const response = await fetch(`${httpEndpoint}/chats`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${user.id_token}` }
        });
        if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);
        const data: ChatListItem[] = await response.json();
        const initialChats = data.map(chat => ({ ...chat, messages: [] }));
        setChats(initialChats);
        
        if (initialChats.length > 0) {
            setActiveChatId(initialChats[0].id);
        } else {
            setActiveChatId(null);
        }
      } catch (error) {
        console.error("チャット履歴一覧の取得に失敗しました:", error);
      }
    };
    fetchChatList();
  }, [auth.isAuthenticated, auth.user]);

  useEffect(() => {
    if (auth.isAuthenticated && auth.user && !socketRef.current) {
      const user = auth.user;
      const wsEndpoint = import.meta.env.VITE_APP_WEBSOCKET_ENDPOINT;
      const socketUrl = `${wsEndpoint}?id_token=${user.id_token}`;
      
      const socket = new WebSocket(socketUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        console.log("WebSocket接続が確立しました。");
        setIsSocketConnected(true);
      };

      socket.onclose = (event) => {
        console.log("WebSocket接続が切れました。コード:", event.code, "理由:", event.reason);
        setIsSocketConnected(false);
        socketRef.current = null;
      };

      socket.onerror = (error) => console.error("WebSocketエラー:", error);

      return () => {
        if (socketRef.current) {
          socketRef.current.close();
          socketRef.current = null;
        }
      };
    }
  }, [auth.isAuthenticated, auth.user]);

  useEffect(() => {
    const socket = socketRef.current;
    if (socket && isSocketConnected) {
      const messageHandler = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          
          // ★★★ ここが最終修正点 ★★★
          // 条件式に `message.data` を含めることで、型の安全性を保証する
          if (message.action === 'historyResponse' && message.chatId) {
const historyMessages = message.data || []; // undefinedの場合は空配列
setChats(prevChats => prevChats.map(chat =>
chat.id === message.chatId ? { ...chat, messages: historyMessages } : chat
));
}
          else if (message.text) {
            setChats(prevChats => prevChats.map(chat => {
              const targetId = activeChatId || tempChatIdRef.current;
              if (chat.id !== targetId) return chat;

              const lastMessage = chat.messages[chat.messages.length - 1];
              if (lastMessage?.role === 'assistant') {
                const updatedLastMessage = { ...lastMessage, content: lastMessage.content + message.text };
                return { ...chat, messages: [...chat.messages.slice(0, -1), updatedLastMessage] };
              }
              return chat;
            }));
          } 
          else if (message.status === 'done') {
            const newChatData = message.newChat;
            if (newChatData) {
              setChats(prev => [
                newChatData,
                ...prev.filter(c => c.id !== tempChatIdRef.current)
              ]);
              setActiveChatId(newChatData.id);
              tempChatIdRef.current = null;
            }
            setIsLoading(false);
          } 
          else if (message.error) {
            console.error("サーバーエラー:", message.error);
            alert(`サーバーでエラーが発生しました: ${message.error}`);
            setIsLoading(false);
          }
        } catch(e) {
            console.error("受信メッセージの解析に失敗しました:", event.data, e);
        }
      };

      socket.addEventListener('message', messageHandler);

      return () => {
        socket.removeEventListener('message', messageHandler);
      };
    }
  }, [isSocketConnected, activeChatId]);

  useEffect(() => {
      const socket = socketRef.current;
      if (socket && isSocketConnected && activeChatId) {
          const activeChat = chats.find(c => c.id === activeChatId);
          if (activeChat && activeChat.messages.length === 0) {
              console.log(`チャット ${activeChatId} の履歴を取得します。`);
              socket.send(JSON.stringify({ action: 'getHistory', chat_id: activeChatId }));
          }
      }
  }, [activeChatId, isSocketConnected, chats]);


  const handleSignOut = async () => {
    await auth.removeUser();
    setActiveChatId(null);
  };
  
  const handleSendPrompt = async () => {
    if (!prompt.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        alert("接続が確立されていません。少し待ってから再試行してください。");
        return;
    }
    
    setIsLoading(true);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const currentPrompt = prompt;
    setPrompt('');

    const isNewChat = activeChatId === null;

    if (isNewChat) {
      const tempId = "temp-" + Date.now().toString();
      tempChatIdRef.current = tempId;
      const assistantPlaceholder: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
      const newChat: ChatThread = { id: tempId, title: currentPrompt.substring(0, 30) + '...', messages: [userMessage, assistantPlaceholder] };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(tempId);
    } else {
      const assistantPlaceholder: Message = { id: (Date.now() + 1).toString(), role: 'assistant', content: '' };
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage, assistantPlaceholder] } : chat
      ));
    }
    
    socketRef.current.send(JSON.stringify({
      action: 'sendMessage',
      user_prompt: currentPrompt,
      chat_id: isNewChat ? null : activeChatId,
    }));
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setPrompt('');
  };
  
  const handleChatSelect = (chatId: string) => {
    if (chatId !== activeChatId) {
      setActiveChatId(chatId);
    }
  };

  const activeMessages = chats.find(chat => chat.id === activeChatId)?.messages || [];

  if (auth.isLoading) { return <div>読み込み中...</div>; }
  if (auth.error) { return <div>エラー: {auth.error.message}</div>; }
  
  if (auth.isAuthenticated && auth.user) {
    return (
      <div className="app-layout">
        <Sidebar 
          chats={chats}
          activeChatId={activeChatId}
          onNewChat={startNewChat}
          onChatSelect={handleChatSelect}
          userEmail={auth.user.profile.email}
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