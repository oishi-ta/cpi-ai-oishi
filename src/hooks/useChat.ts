import { useState, useEffect, useRef } from 'react';
import type { ChatThread, Message, SSEMessage, ChatListItem, ModelType, ChatMode } from '../types/chat';
import type { FileAttachment } from '../types/file';
import { chatApi } from '../services/chatApi';
import { fileApi } from '../services/fileApi';

export const useChat = (user: any) => {
  const [chats, setChats] = useState<ChatThread[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDeletingChat, setIsDeletingChat] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentStreamingMessageIdRef = useRef<string | null>(null);

  // 一意のIDを生成する関数
  const generateUniqueId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  // チャット履歴取得
  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }

    const fetchChatList = async () => {
      try {
        const data: ChatListItem[] = await chatApi.fetchChatList();
        setChats(data.map(chat => ({ ...chat, messages: [] })));
      } catch (error) {
        console.error("チャット履歴一覧の取得に失敗しました:", error);
      }
    };

    fetchChatList();
  }, [user]);

  // 履歴取得関数
  const fetchChatHistory = async (chatId: string) => {
    try {
      const messages: Message[] = await chatApi.fetchChatHistory(chatId);
      
      // 履歴メッセージの画像復元処理
      const processedMessages = await Promise.all(
        messages.map(async (message) => {
          if (message.attachment?.s3Key && message.attachment.fileType?.startsWith('image/')) {
            try {
              const imageData = await fileApi.fetchImageFromS3(message.attachment.s3Key);
              
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

  // チャット削除ハンドラー
  const handleChatDelete = async (chatId: string) => {
    if (isDeletingChat) return;
    
    setIsDeletingChat(true);
    
    try {
      const success = await chatApi.deleteChat(chatId);
      
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

  // 停止機能
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

  // メッセージ送信処理
  const handleSendMessage = async (
    prompt: string,
    mode: ChatMode,
    model: ModelType,
    attachedFile: FileAttachment | null
  ) => {
    if ((!prompt.trim() && !attachedFile)) {
      alert("メッセージを入力するか、ファイルを添付してください。");
      return;
    }

    setIsLoading(true);
    const userMessageContent = prompt;
    const currentFile = attachedFile;

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
          s3Key: currentFile.s3Key,
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
          s3Key: currentFile.s3Key,
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
      const response = await chatApi.sendMessage({
        user_prompt: userMessageContent,
        chat_id: isNewChat ? null : activeChatId,
        mode: mode,
        model: model,
        attachment: attachmentPayload,
        user_message_id: userMessageId,
        assistant_message_id: assistantMessageId,
        signal: abortControllerRef.current.signal,
      });

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
                              const imageData = await fileApi.fetchImageFromS3(message.attachment.s3Key);
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
    setActiveChatId(null);
  };

  const handleChatSelect = (chatId: string) => {
    if (chatId !== activeChatId) {
      setActiveChatId(chatId);
    }
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

  return {
    chats,
    activeChatId,
    activeMessages,
    isLoading,
    isDeletingChat,
    startNewChat,
    handleChatSelect,
    handleChatDelete,
    handleSendMessage,
    handleStopGeneration
  };
};