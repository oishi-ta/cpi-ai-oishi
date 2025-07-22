import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import MainContent, { type ChatThread, type Message } from '../components/MainContent';
import SignOutConfirmationModal from '../components/SignOutConfirmationModal';

interface SSEMessage {
  type: string;
  data: any;
}

type ChatListItem = Omit<ChatThread, 'messages'>;

// ファイル添付情報の型定義（S3併用版）
interface FileAttachment {
  fileName: string;
  fileType: string;
  size: number;
  data: string;        // Base64データ（Bedrock送信用）
  s3Key: string;       // S3キー（履歴保存用）
  displayUrl: string;  // 表示用URL
}

function ChatPage() {
  const auth = useAuth();
  const [prompt, setPrompt] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mode, setMode] = useState<'knowledge_base' | 'general'>('general');
  const [model, setModel] = useState<'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4'>('nova-lite');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [attachedFile, setAttachedFile] = useState<FileAttachment | null>(null);
  
  // アップロード関連の状態
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamingMessageIdRef = useRef<string | null>(null);

  // 一意のIDを生成する関数
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // 最新のトークンを取得するヘルパー関数（修正版）
  const getCurrentToken = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        return userData.id_token;
      } catch (error) {
        console.error('localStorage parsing error:', error);
        localStorage.removeItem('user');
      }
    }
    return null;
  };

  // ファイルサイズ制限（Bedrock制限に合わせて3.75MB）
  const getFileSizeLimit = (): number => {
    return 3.75 * 1024 * 1024; // 3.75MB
  };

  // 画像圧縮関数
  const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<{base64Data: string; blob: Blob}> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      const img = new Image();
      
      img.onload = () => {
        // アスペクト比を保持してリサイズ
        const { width, height } = img;
        const ratio = Math.min(maxWidth / width, maxWidth / height);
        
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        
        // 描画
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        // Base64とBlobの両方を生成
        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64Data = compressedDataUrl.split(',')[1];
        
        // Blobに変換（S3アップロード用）
        canvas.toBlob((blob) => {
          if (blob) {
            resolve({ base64Data, blob });
          } else {
            reject(new Error('圧縮に失敗しました'));
          }
        }, 'image/jpeg', quality);
      };
      
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      img.src = URL.createObjectURL(file);
    });
  };

  // Presigned URL取得（修正版）
  const getPresignedUrl = async (fileName: string, fileType: string) => {
    const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
    const currentToken = getCurrentToken();
    
    if (!currentToken) {
      throw new Error('認証トークンが取得できません');
    }
    
    const response = await fetch(`${apiBaseUrl}/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ fileName, fileType })
    });

    if (!response.ok) {
      throw new Error(`Presigned URL取得エラー: ${response.status}`);
    }

    return await response.json();
  };

  // S3へのファイルアップロード
  const uploadFileToS3 = async (file: File, uploadUrl: string) => {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`S3アップロードエラー: ${response.status}`);
    }
  };

  // S3への圧縮画像アップロード
  const uploadCompressedToS3 = async (compressedBlob: Blob, fileName: string) => {
    const { uploadUrl, s3Key } = await getPresignedUrl(fileName, 'image/jpeg');
    
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: compressedBlob,
      headers: {
        'Content-Type': 'image/jpeg',
      },
    });

    if (!response.ok) {
      throw new Error(`S3アップロードエラー: ${response.status}`);
    }
    
    return s3Key;
  };

  // S3から画像を取得する関数（修正版）
  const fetchImageFromS3 = async (s3Key: string): Promise<{base64Data: string; contentType: string}> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
      const currentToken = getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      const response = await fetch(`${apiBaseUrl}/get-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ s3Key })
      });

      if (!response.ok) {
        throw new Error(`画像取得エラー: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('S3画像取得エラー:', error);
      throw error;
    }
  };

  // チャット履歴取得（修正版）
  useEffect(() => {
    if (!auth.isAuthenticated) {
      setChats([]);
      return;
    }

    const fetchChatList = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
        const currentToken = getCurrentToken();
        
        if (!currentToken) {
          console.error('認証トークンが取得できません');
          return;
        }
        
        const response = await fetch(`${apiBaseUrl}/chats`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${currentToken}` }
        });

        if (!response.ok) {
          throw new Error(`HTTPエラー: ${response.status}`);
        }
        
        const data: ChatListItem[] = await response.json();
        setChats(data.map(chat => ({ ...chat, messages: [] })));
      } catch (error) {
        console.error("チャット履歴一覧の取得に失敗しました:", error);
      }
    };

    fetchChatList();
  }, [auth.isAuthenticated]);

  // 履歴取得関数（修正版）
  const fetchChatHistory = async (chatId: string) => {
    const currentToken = getCurrentToken();
    if (!currentToken) {
      console.error('認証トークンが取得できません');
      return;
    }

    try {
      const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
      const response = await fetch(`${apiBaseUrl}/chats/${chatId}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });

      if (!response.ok) throw new Error(`HTTPエラー: ${response.status}`);
      const messages: Message[] = await response.json();
      
      // 履歴メッセージの画像復元処理
      const processedMessages = await Promise.all(
        messages.map(async (message) => {
          if (message.attachment?.s3Key && message.attachment.fileType?.startsWith('image/')) {
            try {
              const imageData = await fetchImageFromS3(message.attachment.s3Key);
              
              return {
                ...message,
                attachment: {
                  ...message.attachment,
                  data: imageData.base64Data,
                  displayUrl: `data:${imageData.contentType};base64,${imageData.base64Data}`
                }
              };
            } catch (error) {
              console.error('画像復元エラー:', error);
              return {
                ...message,
                attachment: {
                  ...message.attachment,
                  note: '画像の読み込みに失敗しました'
                }
              };
            }
          }
          return message;
        })
      );
      
      // 履歴取得時は完全にメッセージを置き換える
      setChats(prevChats => 
        prevChats.map(chat => 
          chat.id === chatId ? { ...chat, messages: processedMessages } : chat
        )
      );
    } catch (error) {
      console.error("チャット履歴の取得に失敗しました:", error);
    }
  };

  // アクティブチャット変更時の履歴取得
  useEffect(() => {
    if (activeChatId) {
      const activeChat = chats.find(c => c.id === activeChatId);
      if (activeChat && activeChat.messages.length === 0) {
        fetchChatHistory(activeChatId);
      }
    }
  }, [activeChatId, chats]);

  // モバイルサイドバー制御
  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  // サインアウト処理
  const handleSignOutRequest = () => {
    setShowSignOutModal(true);
  };

  const handleConfirmedSignOut = async () => {
    setShowSignOutModal(false);
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    setChats([]);
    setActiveChatId(null);
    
    try {
      await auth.removeUser();
    } catch (error) {
      console.error("ローカルセッションクリアエラー:", error);
    }
    
    const cognitoDomain = import.meta.env.VITE_APP_COGNITO_DOMAIN;
    const clientId = import.meta.env.VITE_APP_COGNITO_CLIENT_ID;
    const postLogoutRedirectUri = import.meta.env.VITE_APP_POST_LOGOUT_REDIRECT_URI || import.meta.env.VITE_APP_REDIRECT_URI;
    
    const logoutUrl = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(postLogoutRedirectUri)}`;
    window.location.href = logoutUrl;
  };

  const handleCancelSignOut = () => {
    setShowSignOutModal(false);
  };

  // S3併用のファイル添付ハンドラー（圧縮版）
  const handleFileAttach = async (file: File) => {
    try {
      setIsUploading(true);
      setUploadError(null);
      setUploadProgress(0);
      
      // ファイルサイズチェック
      const maxSize = getFileSizeLimit();
      if (file.size > maxSize) {
        const maxSizeMB = Math.round(maxSize / (1024 * 1024) * 100) / 100;
        throw new Error(`ファイルサイズが制限を超えています。最大${maxSizeMB}MBまでです。`);
      }

      setUploadProgress(10);
      
      let base64Result: string;
      let s3Result: string;
      
      if (file.type.startsWith('image/')) {
        // 画像の場合: 並行処理（オリジナルBase64 + 圧縮版S3保存）
        const [originalBase64, compressedData] = await Promise.all([
          // 1. オリジナルBase64変換（Bedrock送信用）
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
          
          // 2. 画像圧縮（S3保存用）
          compressImage(file, 800, 0.7)
        ]);
        
        setUploadProgress(60);
        
        // 圧縮版をS3にアップロード
        s3Result = await uploadCompressedToS3(compressedData.blob, file.name);
        base64Result = originalBase64;
        
      } else {
        // PDFの場合: 従来通り
        const [originalBase64, s3Key] = await Promise.all([
          new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              const result = e.target?.result as string;
              const base64Data = result.split(',')[1];
              resolve(base64Data);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
          
          (async () => {
            const { uploadUrl, s3Key } = await getPresignedUrl(file.name, file.type);
            await uploadFileToS3(file, uploadUrl);
            return s3Key;
          })()
        ]);
        
        base64Result = originalBase64;
        s3Result = s3Key;
      }
      
      setUploadProgress(90);
      
      // ファイル情報を保持
      const newAttachment: FileAttachment = {
        fileName: file.name,
        fileType: file.type,
        size: file.size,
        data: base64Result,      // Bedrock送信用（オリジナル）
        s3Key: s3Result,         // 履歴保存用（圧縮版またはオリジナル）
        displayUrl: `data:${file.type};base64,${base64Result}`
      };
      
      setAttachedFile(newAttachment);
      setUploadProgress(100);

      // モード設定（全モデル対応なので現在のモデルを維持）
      setMode('general');
      // 現在のモデルをそのまま維持（制約なし）

    } catch (error) {
      console.error('ファイル処理エラー:', error);
      setUploadError(error instanceof Error ? error.message : 'ファイルの処理に失敗しました');
    } finally {
      setIsUploading(false);
      setTimeout(() => {
        setUploadProgress(0);
        setUploadError(null);
      }, 3000);
    }
  };
  
  const handleFileRemove = () => {
    setAttachedFile(null);
    setUploadProgress(0);
    setUploadError(null);
  };

  // メッセージ送信処理（修正版）
  const handleSendPrompt = async () => {
    const currentToken = getCurrentToken();
    
    if ((!prompt.trim() && !attachedFile) || !currentToken) {
      if (!currentToken) {
        alert("認証エラーが発生しました。再度ログインしてください。");
        auth.signinRedirect();
      } else {
        alert("メッセージを入力するか、ファイルを添付してください。");
      }
      return;
    }

    if (isUploading) {
      alert("ファイルの処理中です。完了までお待ちください。");
      return;
    }

    setIsLoading(true);
    const userMessageContent = prompt;
    const currentFile = attachedFile;

    setPrompt('');
    setAttachedFile(null);

    // 事前に一意のメッセージIDを生成
    const userMessageId = generateUniqueId();
    const assistantMessageId = generateUniqueId();

    // 現在のストリーミング情報を保存
    currentStreamingMessageIdRef.current = assistantMessageId;

    // Lambda関数用の添付ファイルペイロード（S3キー含む）
    let attachmentPayload = null;
    if (currentFile) {
      if (currentFile.fileType === 'application/pdf') {
        attachmentPayload = {
          fileName: currentFile.fileName,
          size: currentFile.size,
          s3Key: currentFile.s3Key,  // S3キーを追加
          source: {
            type: 'document',
            media_type: currentFile.fileType,
            data: currentFile.data,
          },
        };
      } else if (currentFile.fileType.startsWith('image/')) {
        attachmentPayload = {
          fileName: currentFile.fileName,
          size: currentFile.size,
          s3Key: currentFile.s3Key,  // S3キーを追加
          source: {
            type: 'image',
            media_type: currentFile.fileType,
            data: currentFile.data,
          },
        };
      } else {
        throw new Error('サポートされていないファイル形式です');
      }
    }

    // ユーザーメッセージ（画像表示URL含む）
    const userMessage: Message = { 
      id: userMessageId,
      role: 'user', 
      content: userMessageContent,
      attachment: currentFile ? {
        fileName: currentFile.fileName,
        fileType: currentFile.fileType,
        size: currentFile.size,
        data: currentFile.data,
        s3Key: currentFile.s3Key,
        displayUrl: currentFile.displayUrl
      } : undefined
    };

    const assistantPlaceholder: Message = { 
      id: assistantMessageId,
      role: 'assistant', 
      content: '',
      mode: mode,
      model: model
    };

    const isNewChat = activeChatId === null;
    let chatTitle = userMessageContent.substring(0, 30);
    if (!chatTitle && currentFile) {
      chatTitle = currentFile.fileName;
    }

    if (isNewChat) {
      // 新しいチャットの場合、一時的にメッセージを表示するためのチャットを作成
      const tempChat: ChatThread = {
        id: `streaming-${userMessageId}`,
        title: chatTitle + '...',
        messages: [userMessage, assistantPlaceholder]
      };
      
      setChats(prev => [tempChat, ...prev]);
      setActiveChatId(tempChat.id);
    } else {
      // 既存チャットの場合、メッセージを追加
      setChats(prev => prev.map(chat => {
        if (chat.id !== activeChatId) return chat;
        
        // 既存のメッセージIDと重複しないかチェック
        const existingIds = chat.messages.map(msg => msg.id);
        if (existingIds.includes(userMessageId) || existingIds.includes(assistantMessageId)) {
          return chat;
        }
        
        return { ...chat, messages: [...chat.messages, userMessage, assistantPlaceholder] };
      }));
    }

    // AbortController管理
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      const lambdaFunctionUrl = import.meta.env.VITE_APP_LAMBDA_FUNCTION_URL;
      
      if (!lambdaFunctionUrl) {
        alert('システム設定エラー: Lambda Function URLが設定されていません');
        setIsLoading(false);
        return;
      }

      // メッセージIDをLambda関数に送信（修正版）
      const response = await fetch(lambdaFunctionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
          'Accept': 'text/event-stream',
          'Cache-Control': 'no-cache',
        },
        body: JSON.stringify({
          user_prompt: userMessageContent,
          chat_id: isNewChat ? null : activeChatId,
          mode: mode,
          model: model,
          attachment: attachmentPayload,
          // メッセージIDを送信
          user_message_id: userMessageId,
          assistant_message_id: assistantMessageId,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTPエラー: ${response.status}`);
      }

      const contentType = response.headers.get('Content-Type');
      if (!contentType || !contentType.includes('text/event-stream')) {
        throw new Error('サーバーからSSEストリームが返されませんでした');
      }

      // SSEストリーム処理
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ストリームの読み取りができませんでした');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          
          if (done) break;
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.trim() === '') continue;
            
            if (line.startsWith('data: ')) {
              const jsonData = line.slice(6).trim();
              if (jsonData === '') continue;
              
              try {
                const message: SSEMessage = JSON.parse(jsonData);
                
                if (message.type === 'message') {
                  setChats(prevChats => prevChats.map(chat => {
                    const targetChatId = isNewChat ? `streaming-${userMessageId}` : activeChatId;
                    if (chat.id !== targetChatId) return chat;
                    
                    // 特定のアシスタントメッセージのみ更新
                    const lastMessage = chat.messages[chat.messages.length - 1];
                    if (lastMessage?.role === 'assistant' && lastMessage?.id === assistantMessageId) {
                      const updatedLastMessage = { 
                        ...lastMessage, 
                        content: lastMessage.content + message.data 
                      };
                      return { 
                        ...chat, 
                        messages: [...chat.messages.slice(0, -1), updatedLastMessage] 
                      };
                    }
                    return chat;
                  }));
                }
              } catch (e) {
                console.error("SSEメッセージの解析に失敗しました:", e);
              }
            } else if (line.startsWith('event: ')) {
              const eventType = line.slice(7).trim();
              
              const nextLineIndex = lines.indexOf(line) + 1;
              if (nextLineIndex < lines.length && lines[nextLineIndex].startsWith('data: ')) {
                const eventData = lines[nextLineIndex].slice(6).trim();
                
                try {
                  // ChatPage.tsx - SSEイベント処理部分
                  if (eventType === 'newChat') {
                    const newChatData = JSON.parse(eventData);
                    
                    if (isNewChat) {
                      // 新しいチャットの画像復元処理
                      const processedMessages = await Promise.all(
                        newChatData.messages.map(async (message: any) => {
                          if (message.attachment?.s3Key && message.attachment.fileType?.startsWith('image/')) {
                            try {
                              const imageData = await fetchImageFromS3(message.attachment.s3Key);
                              return {
                                ...message,
                                attachment: {
                                  ...message.attachment,
                                  data: imageData.base64Data,
                                  displayUrl: `data:${imageData.contentType};base64,${imageData.base64Data}`
                                }
                              };
                            } catch (error) {
                              console.error('newChat画像復元エラー:', error);
                              return {
                                ...message,
                                attachment: {
                                  ...message.attachment,
                                  note: '画像の読み込みに失敗しました'
                                }
                              };
                            }
                          }
                          return message;
                        })
                      );
                      
                      const restoredChatData = {
                        ...newChatData,
                        messages: processedMessages
                      };
                      
                      // ストリーミング用チャットを復元済みチャットで置き換え
                      setChats(prev => {
                        const streamingIndex = prev.findIndex(c => c.id === `streaming-${userMessageId}`);
                        if (streamingIndex !== -1) {
                          const updatedChats = [...prev];
                          updatedChats[streamingIndex] = restoredChatData;
                          return updatedChats;
                        } else {
                          return [restoredChatData, ...prev];
                        }
                      });
                      
                      setActiveChatId(restoredChatData.id);
                    }
                  } else if (eventType === 'error') {
                    const errorData = JSON.parse(eventData);
                    console.error("サーバーエラー:", errorData);
                    setIsLoading(false);
                  } else if (eventType === 'end') {
                    setIsLoading(false);
                    if (activeChatId) {
                      setActiveChatId(activeChatId);
                    }
                  }
                } catch (e) {
                  console.error("イベント処理エラー:", e);
                }
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
        setIsLoading(false);
        abortControllerRef.current = null;
        currentStreamingMessageIdRef.current = null;
      }

    } catch (error) {
      console.error("SSEリクエストエラー:", error);
      setIsLoading(false);
      
      if (activeChatId) {
        setActiveChatId(activeChatId);
      }
      
      currentStreamingMessageIdRef.current = null;
    }
  };

  const startNewChat = () => {
    setActiveChatId(null);
    setPrompt('');
    setAttachedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    closeMobileSidebar();
  };

  const handleChatSelect = (chatId: string) => {
    if (chatId !== activeChatId) {
      setActiveChatId(chatId);
    }
    closeMobileSidebar();
  };

  // 全モデル対応版：制約なしのモデル変更
  const handleModelChange = (newModel: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4') => {
    setModel(newModel);
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const activeMessages = chats.find(chat => chat.id === activeChatId)?.messages || [];

  return (
    <div className="app-layout">
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
        model={model}
        onModelChange={handleModelChange}
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
        attachedFile={attachedFile}
        onFileAttach={handleFileAttach}
        onFileRemove={handleFileRemove}
        // S3併用方式用のプロパティ
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
      />

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