import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import MainContent, { type ChatThread, type Message } from '../components/MainContent';
import SignOutConfirmationModal from '../components/SignOutConfirmationModal';

interface WebSocketMessage {
  text?: string;
  status?: 'done';
  newChat?: ChatThread;
  chatId?: string;
  error?: string;
  action?: 'historyResponse';
  data?: Message[];
}

type ChatListItem = Omit<ChatThread, 'messages'>;

function ChatPage() {
  const auth = useAuth();
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [mode, setMode] = useState<'knowledge_base' | 'general'>('general');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // サインアウト確認モーダルの状態
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  
  const socketRef = useRef<WebSocket | null>(null);
  const tempChatIdRef = useRef<string | null>(null);

  // 認証状態の変化を監視してWebSocketを再接続
  useEffect(() => {
    if (auth.isAuthenticated && auth.user && auth.user.id_token) {
      // WebSocketが接続されていない場合は接続
      if (!socketRef.current || socketRef.current.readyState === WebSocket.CLOSED) {
        const wsEndpoint = import.meta.env.VITE_APP_WEBSOCKET_ENDPOINT;
        const socketUrl = `${wsEndpoint}?id_token=${auth.user.id_token}`;

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
      }
    } else if (!auth.isAuthenticated) {
      // 認証されていない場合はWebSocketを切断
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
        setIsSocketConnected(false);
      }
    }
  }, [auth.isAuthenticated, auth.user]);

  // チャット履歴取得のuseEffect
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.user || !auth.user.id_token) {
      setChats([]);
      return;
    }

    const fetchChatList = async () => {
      try {
        const httpEndpoint = import.meta.env.VITE_APP_HTTP_API_ENDPOINT;
        const response = await fetch(`${httpEndpoint}/chats`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${auth.user!.id_token}` }
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

  // WebSocketメッセージハンドリング
  useEffect(() => {
    const socket = socketRef.current;
    if (socket && isSocketConnected) {
      const messageHandler = (event: MessageEvent) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          if (message.action === 'historyResponse' && message.chatId) {
            const historyMessages = message.data || [];
            setChats(prevChats => 
              prevChats.map(chat => 
                chat.id === message.chatId ? { ...chat, messages: historyMessages } : chat
              )
            );
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
              setChats(prev => [ newChatData, ...prev.filter(c => c.id !== tempChatIdRef.current) ]);
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
      return () => { socket.removeEventListener('message', messageHandler); };
    }
  }, [isSocketConnected, activeChatId]);

  // 履歴取得のuseEffect
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

  // モバイルサイドバー制御
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  // サインアウト要求ハンドラー（確認モーダルを表示）
  const handleSignOutRequest = () => {
    setShowSignOutModal(true);
  };

  // 実際のサインアウト処理
  const handleConfirmedSignOut = async () => {
    console.log("🔄 サインアウト開始");
    
    // モーダルを閉じる
    setShowSignOutModal(false);
    
    // WebSocket接続をクリーンアップ
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      console.log("✅ WebSocket切断完了");
    }
    
    // 状態をリセット
    setChats([]);
    setActiveChatId(null);
    setIsSocketConnected(false);
    console.log("✅ 状態リセット完了");
    
    try {
      // ローカルセッションをクリア
      await auth.removeUser();
      console.log("✅ ローカルセッションクリア完了");
    } catch (error) {
      console.error("❌ ローカルセッションクリアエラー:", error);
    }
    
    // Cognitoログアウトエンドポイントにリダイレクト
    const cognitoDomain = import.meta.env.VITE_APP_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_APP_COGNITO_CLIENT_ID;
    const postLogoutRedirectUri = import.meta.env.VITE_APP_POST_LOGOUT_REDIRECT_URI || import.meta.env.VITE_APP_REDIRECT_URI;
    
    // logout_uriパラメータを含めて、Cognitoセッションも確実にクリア
    const logoutUrl = `${cognitoDomain}/logout?` +
      `client_id=${clientId}&` +
      `logout_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    
    console.log("🚀 Cognitoログアウトエンドポイントにリダイレクト:", logoutUrl);
    window.location.href = logoutUrl;
  };

  // サインアウトキャンセル
  const handleCancelSignOut = () => {
    setShowSignOutModal(false);
  };

  // その他のハンドラー
  const handleSendPrompt = async () => {
    if (!prompt.trim() || !socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      alert("接続が確立されていません。少し待ってから再試行してください。");
      return;
    }

    setIsLoading(true);
    const userMessage: Message = { id: Date.now().toString(), role: 'user', content: prompt };
    const currentPrompt = prompt;
    setPrompt('');

    const assistantPlaceholder: Message = { 
      id: (Date.now() + 1).toString(), 
      role: 'assistant', 
      content: '',
      mode: mode
    };

    const isNewChat = activeChatId === null;

    if (isNewChat) {
      const tempId = "temp-" + Date.now().toString();
      tempChatIdRef.current = tempId;
      const newChat: ChatThread = { 
        id: tempId, 
        title: currentPrompt.substring(0, 30) + '...', 
        messages: [userMessage, assistantPlaceholder] 
      };
      setChats(prev => [newChat, ...prev]);
      setActiveChatId(tempId);
    } else {
      setChats(prev => prev.map(chat => 
        chat.id === activeChatId ? { ...chat, messages: [...chat.messages, userMessage, assistantPlaceholder] } : chat
      ));
    }

    socketRef.current.send(JSON.stringify({
      action: 'sendMessage',
      user_prompt: currentPrompt,
      chat_id: isNewChat ? null : activeChatId,
      mode: mode,
    }));
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setPrompt('');
    closeMobileSidebar();
  };

  const handleChatSelect = (chatId: string) => {
    if (chatId !== activeChatId) {
      setActiveChatId(chatId);
    }
    closeMobileSidebar();
  };

  const activeMessages = chats.find(chat => chat.id === activeChatId)?.messages || [];

  return (
    <div className="app-layout">
      {/* モバイル用オーバーレイ */}
      <div 
        className={`mobile-overlay ${isMobileSidebarOpen ? 'active' : ''}`}
        onClick={closeMobileSidebar}
      />
      
      <Sidebar 
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={startNewChat}
        onChatSelect={handleChatSelect}
        userEmail={auth.user?.profile.email}
        onSignOut={handleSignOutRequest}
        className={isMobileSidebarOpen ? 'mobile-open' : ''}
      />
      
      <MainContent 
        messages={activeMessages}
        promptInput={prompt}
        isLoading={isLoading}
        onPromptChange={setPrompt}
        onSendPrompt={handleSendPrompt}
        mode={mode}
        onModeChange={setMode}
        onToggleSidebar={toggleMobileSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
      />

      {/* サインアウト確認モーダル */}
      <SignOutConfirmationModal
        isOpen={showSignOutModal}
        onConfirm={handleConfirmedSignOut}
        onCancel={handleCancelSignOut}
        userEmail={auth.user?.profile.email}
      />
    </div>
  );
}

export default ChatPage;