import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
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

// 検索結果の型定義
interface SearchResult {
  chatId: string;
  title: string;
  matchedContent: string;
  matchType: 'title' | 'content';
  score: number;
  createdAt: string;
  updatedAt: string;
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  query: string;
  limit: number;
  offset: number;
}

interface ChatPageProps {
  user: any;
  signOut: () => void;
}

function ChatPage({ user, signOut }: ChatPageProps) {
  const [searchParams] = useSearchParams();
  
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
  
  // 削除関連の状態
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  // 検索関連の状態
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamingMessageIdRef = useRef<string | null>(null);

  // 一意のIDを生成する関数
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // Amplify Auth APIを使用したトークン取得
  const getCurrentToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch (error) {
      console.error('トークン取得エラー:', error);
      return null;
    }
  };

  // 認証済みユーザーの情報取得
  const userEmail = user?.signInDetails?.loginId || user?.username || user?.attributes?.email;

  // 検索API関数
  const searchChats = async (query: string, limit: number = 20, offset: number = 0): Promise<SearchResponse> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      const encodedQuery = encodeURIComponent(query);
      const url = `${apiBaseUrl}/search?q=${encodedQuery}&limit=${limit}&offset=${offset}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: { 
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`検索エラー: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('検索APIエラー:', error);
      throw error;
    }
  };

  // 検索実行ハンドラー
  const handleSearchSubmit = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);
    setSearchQuery(query);
    setIsSearchMode(true);

  // モバイルサイドバーを閉じる
  setIsMobileSidebarOpen(false);
  
    try {
      const response = await searchChats(query, 20, 0);
      setSearchResults(response.results);
    } catch (error) {
      console.error('検索エラー:', error);
      setSearchError('検索中にエラーが発生しました');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 検索結果クリックハンドラー
  const handleSearchResultClick = (chatId: string) => {
    // 検索モードを終了
    setIsSearchMode(false);
    
    // チャットを選択
    setActiveChatId(chatId);
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

  // Presigned URL取得
  const getPresignedUrl = async (fileName: string, fileType: string) => {
    const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
    const currentToken = await getCurrentToken();
    
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

  // S3から画像を取得する関数
  const fetchImageFromS3 = async (s3Key: string): Promise<{base64Data: string; contentType: string}> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
      const currentToken = await getCurrentToken();
      
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

  // チャット削除API呼び出し
  const deleteChatFromServer = async (chatId: string): Promise<boolean> => {
    try {
      const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        console.error('認証トークンが取得できません');
        return false;
      }
      
      const response = await fetch(`${apiBaseUrl}/chats/${chatId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${currentToken}` }
      });

      return response.ok;
    } catch (error) {
      console.error("チャット削除APIエラー:", error);
      return false;
    }
  };

  // ★ 停止機能
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      console.log('Generation stopped by user');
      abortControllerRef.current.abort();
      setIsLoading(false);
      
      // 停止メッセージを追加
      if (currentStreamingMessageIdRef.current) {
        setChats(prevChats => prevChats.map(chat => {
          const targetChatId = activeChatId || `streaming-${currentStreamingMessageIdRef.current?.split('-')[0]}`;
          if (chat.id !== targetChatId) return chat;
          
          return {
            ...chat,
            messages: chat.messages.map(msg => 
              msg.id === currentStreamingMessageIdRef.current && msg.role === 'assistant'
                ? { ...msg, content: msg.content + '\n\n[生成が停止されました]' }
                : msg
            )
          };
        }));
      }
      
      abortControllerRef.current = null;
      currentStreamingMessageIdRef.current = null;
    }
  };

  // URL パラメータからチャットIDを取得してアクティブにする
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('chatId');
    if (chatIdFromUrl && chats.length > 0) {
      const targetChat = chats.find(chat => chat.id === chatIdFromUrl);
      if (targetChat && activeChatId !== chatIdFromUrl) {
        setActiveChatId(chatIdFromUrl);
      }
    }
  }, [searchParams, chats, activeChatId]);

  // チャット履歴取得
  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }

    const fetchChatList = async () => {
      try {
        const apiBaseUrl = import.meta.env.VITE_APP_API_BASE_URL;
        const currentToken = await getCurrentToken();
        
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
  }, [user]);

  // 履歴取得関数
  const fetchChatHistory = async (chatId: string) => {
    const currentToken = await getCurrentToken();
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
      await signOut();
    } catch (error) {
      console.error("サインアウトエラー:", error);
    }
  };

  const handleCancelSignOut = () => {
    setShowSignOutModal(false);
  };

  // チャット削除ハンドラー
  const handleChatDelete = async (chatId: string) => {
    if (isDeletingChat) return;
    
    setIsDeletingChat(true);
    
    try {
      const success = await deleteChatFromServer(chatId);
      
      if (success) {
        // ローカル状態から削除
        setChats(prevChats => prevChats.filter(chat => chat.id !== chatId));
        
        // 削除されたチャットがアクティブだった場合、アクティブチャットをクリア
        if (activeChatId === chatId) {
          setActiveChatId(null);
        }
      } else {
        alert('チャットの削除に失敗しました。');
      }
    } catch (error) {
      console.error('チャット削除エラー:', error);
      alert('チャットの削除中にエラーが発生しました。');
    } finally {
      setIsDeletingChat(false);
    }
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

  // メッセージ送信処理
  const handleSendPrompt = async () => {
    const currentToken = await getCurrentToken();
    
    if ((!prompt.trim() && !attachedFile) || !currentToken) {
      if (!currentToken) {
        alert("認証エラーが発生しました。再度ログインしてください。");
        await signOut();
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

      // メッセージIDをLambda関数に送信
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
      
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was aborted');
      }
      
      if (activeChatId) {
        setActiveChatId(activeChatId);
      }
      
      currentStreamingMessageIdRef.current = null;
    }
  };

  const startNewChat = () => {
    // 検索モードを終了
    setIsSearchMode(false);
    
    setActiveChatId(null);
    setPrompt('');
    setAttachedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    closeMobileSidebar();
  };

  const handleChatSelect = (chatId: string) => {
    // 検索モードを終了
    setIsSearchMode(false);
    
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
        onChatDelete={handleChatDelete}
        userEmail={userEmail}
        onSignOut={handleSignOutRequest}
        className={isMobileSidebarOpen ? 'mobile-open' : ''}
        model={model}
        onModelChange={handleModelChange}
        onSearchSubmit={handleSearchSubmit}
      />
      
      <MainContent 
        messages={activeMessages}
        promptInput={prompt}
        isLoading={isLoading}
        onPromptChange={setPrompt}
        onSendPrompt={handleSendPrompt}
        onStopGeneration={handleStopGeneration}
        mode={mode}
        onModeChange={setMode}
        onToggleSidebar={toggleMobileSidebar}
        isMobileSidebarOpen={isMobileSidebarOpen}
        attachedFile={attachedFile}
        onFileAttach={handleFileAttach}
        onFileRemove={handleFileRemove}
        isUploading={isUploading}
        uploadProgress={uploadProgress}
        uploadError={uploadError}
        // 検索関連のプロパティ
        searchResults={searchResults}
        searchQuery={searchQuery}
        isSearching={isSearching}
        searchError={searchError}
        isSearchMode={isSearchMode}
        onSearchResultClick={handleSearchResultClick}
        activeChatId={activeChatId}
      />

      <SignOutConfirmationModal
        isOpen={showSignOutModal}
        onConfirm={handleConfirmedSignOut}
        onCancel={handleCancelSignOut}
        userEmail={userEmail}
      />
    </div>
  );
}

export default ChatPage;