import React, { useRef, useState, useLayoutEffect } from 'react';
import { LuSendHorizontal, LuUser, LuBot, LuCopy, LuMenu, LuX, LuPaperclip } from 'react-icons/lu';
import { IoArrowDown, IoDocumentTextOutline } from 'react-icons/io5';
import TextareaAutosize from 'react-textarea-autosize';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// 型定義（S3併用対応）
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'knowledge_base' | 'general';
  model?: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-3-5-sonnet-v2' | 'claude-sonnet-4';
  attachment?: {
    fileName: string;
    fileType?: string;      // オプショナルに変更
    size?: number;          // オプショナルに変更
    data?: string;          // Base64データ
    s3Key?: string;         // S3キー（履歴保存用）
    displayUrl?: string;    // 表示用URL（data:image/jpeg;base64,xxxxx）
    fileUrl?: string;       // 後方互換性のため残す
    note?: string;          // エラーメッセージなど
    isLoading?: boolean;    // 画像読み込み中フラグ
  };
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
}

interface MainContentProps {
  messages: Message[];
  promptInput: string;
  isLoading: boolean;
  onPromptChange: (newPrompt: string) => void;
  onSendPrompt: () => void;
  mode: 'knowledge_base' | 'general';
  onModeChange: (newMode: 'knowledge_base' | 'general') => void;
  onToggleSidebar?: () => void;
  isMobileSidebarOpen?: boolean;
  attachedFile: any; // S3併用方式のFileAttachmentまたは従来のFile
  onFileAttach: (file: File) => void;
  onFileRemove: () => void;
  // S3併用方式用のプロパティ
  isUploading?: boolean;
  uploadProgress?: number;
  uploadError?: string | null;
}

// 遅延読み込み画像コンポーネント
const LazyImage: React.FC<{ 
  base64Data?: string; 
  displayUrl?: string;
  mimeType: string; 
  fileName: string;
  size?: number;
}> = ({ base64Data, displayUrl, mimeType, fileName, size }) => {
  const [imageUrl, setImageUrl] = useState<string>();
  const [hasError, setHasError] = useState(false);
  
  // 安全なファイル名とMIMEタイプ
  const safeMimeType = mimeType || 'image/jpeg';
  const safeFileName = fileName || 'image';
  
  // コンポーネントマウント時に即座に画像URLを設定
  React.useEffect(() => {
    try {
      // 表示URLまたはBase64データから画像URLを生成
      let url = displayUrl;
      if (!url && base64Data) {
        url = `data:${safeMimeType};base64,${base64Data}`;
      }
      
      if (url) {
        setImageUrl(url);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.error('画像読み込みエラー:', error);
      setHasError(true);
    }
  }, [base64Data, displayUrl, safeMimeType]);
  
  if (hasError) {
    return (
      <div className="broken-image" style={{ 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        color: '#999',
        textAlign: 'center'
      }}>
        ❌ 画像を表示できません<br />
        <small>{safeFileName}</small>
      </div>
    );
  }
  
  if (!imageUrl) {
    return null; // 読み込み中は何も表示しない
  }
  
  return (
    <div className="image-attachment">
      <div>
        <img 
          src={imageUrl} 
          alt={safeFileName}
          className="attachment-image"
          style={{ 
            maxWidth: '300px', 
            maxHeight: '200px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onError={() => setHasError(true)}
        />
        {size && (
          <div className="image-info" style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginTop: '4px' 
          }}>
            {safeFileName} ({Math.round(size / 1024)}KB)
          </div>
        )}
      </div>
    </div>
  );
};

// 添付ファイル表示コンポーネント（S3併用対応版）
const AttachmentDisplay: React.FC<{ attachment: Message['attachment'] }> = ({ attachment }) => {
  if (!attachment) return null;

  // fileTypeの安全チェック
  const fileType = attachment.fileType || '';
  const fileName = attachment.fileName || 'Unknown file';
  
  if (fileType.startsWith('image/')) {
    // 読み込み中の場合
    if (attachment.isLoading) {
      return (
        <div className="attachment-file" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f0f8ff',
          maxWidth: '300px'
        }}>
          <div style={{ fontSize: '24px', marginRight: '12px' }}>⏳</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {fileName}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {attachment.note || '画像を読み込み中...'}
            </div>
          </div>
        </div>
      );
    }
    
    // 画像データがない場合の処理
    if (!attachment.data && !attachment.displayUrl && !attachment.fileUrl) {
      return (
        <div className="attachment-file" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: attachment.s3Key ? '#e3f2fd' : '#fff3cd',
          maxWidth: '300px'
        }}>
          <div style={{ fontSize: '24px', marginRight: '12px' }}>🖼️</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {fileName}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {attachment.size && `${Math.round(attachment.size / 1024)}KB`}
              <br />
              {attachment.note ? (
                <small style={{ color: '#f57c00' }}>{attachment.note}</small>
              ) : (
                <small style={{ color: '#856404' }}>※ 履歴では画像を表示できません</small>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // 画像データがある場合は表示
    return (
      <LazyImage 
        base64Data={attachment.data}
        displayUrl={attachment.displayUrl || attachment.fileUrl}
        mimeType={fileType}
        fileName={fileName}
        size={attachment.size}
      />
    );
  } else {
    // その他のファイルの場合
    return (
      <div className="attachment-file" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        maxWidth: '300px'
      }}>
        <div className="attachment-file-icon" style={{ fontSize: '24px', marginRight: '12px' }}>
          <IoDocumentTextOutline />
        </div>
        <div>
          <div className="attachment-file-name" style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {fileName}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {attachment.size && `${Math.round(attachment.size / 1024)}KB`}
            {attachment.note && (
              <>
                <br />
                <small style={{ color: '#856404' }}>{attachment.note}</small>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
};

const MainContent: React.FC<MainContentProps> = ({
  messages,
  promptInput,
  isLoading,
  onPromptChange,
  onSendPrompt,
  mode,
  onModeChange,
  onToggleSidebar,
  isMobileSidebarOpen = false,
  attachedFile,
  onFileAttach,
  onFileRemove,
  isUploading = false,
  uploadProgress = 0,
  uploadError = null,
}) => {
  const chatAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null); // TextareaAutosize用のref
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);

  const [shouldFocus, setShouldFocus] = useState(false);

  useLayoutEffect(() => {
    const chatArea = chatAreaRef.current;
    if (chatArea && messages.length > 0) {
      const originalBehavior = chatArea.style.scrollBehavior;
      chatArea.style.scrollBehavior = 'auto';
      chatArea.scrollTop = chatArea.scrollHeight;
      chatArea.style.scrollBehavior = originalBehavior;
    }
  }, [messages, isLoading]);

  // promptInputが空になった時にフォーカスを戻す
  React.useEffect(() => {
    if (shouldFocus && !promptInput && !isLoading) {
      promptTextareaRef.current?.focus();
      setShouldFocus(false);
    }
  }, [promptInput, isLoading, shouldFocus]);

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
      chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }
  };

  // 送信処理
  const handleSendPrompt = () => {
    if (isLoading || isUploading || (!promptInput.trim() && !attachedFile)) return;
    
    setShouldFocus(true); // フォーカスフラグを立てる
    onSendPrompt();
    
    // 送信後にフォーカスを戻す（少し遅延させる）
    setTimeout(() => {
      promptTextareaRef.current?.focus();
    }, 10);
  };

  // Enterキーでの送信処理
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendPrompt();
    }
  };
  
  const handleCopy = async (textToCopy: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedId(messageId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      alert('コピーに失敗しました。');
    }
  };

  const getModelDisplayName = (modelId: string) => {
    switch (modelId) {
      case 'nova-lite': return 'Nova Lite';
      case 'nova-pro': return 'Nova Pro';
      case 'claude-3-7-sonnet': return 'Claude 3.7 Sonnet';
      case 'claude-3-5-sonnet-v2': return 'Claude 3.5 Sonnet';
      case 'claude-sonnet-4': return 'Claude Sonnet 4';
      default: return modelId;
    }
  };

  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // ファイルサイズチェック（3.75MB制限）
      const maxSize = 3.75 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('ファイルサイズが制限を超えています。最大3.75MBまでです。');
        return;
      }

      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        onFileAttach(file);
      } else {
        alert('画像(JPG, PNG, GIFなど)またはPDFファイルを選択してください。');
      }
    }
    event.target.value = ''; // 同じファイルを再度選択できるようにリセット
  };

  // マークダウンコンポーネントの設定
  const markdownComponents = {
    code({ node, inline, className, children, ...props }: any) {
      const match = /language-(\w+)/.exec(className || '');
      const language = match ? match[1] : '';
      
      return !inline && match ? (
        <SyntaxHighlighter
          style={oneDark}
          language={language}
          PreTag="div"
          {...props}
        >
          {String(children).replace(/\n$/, '')}
        </SyntaxHighlighter>
      ) : (
        <code className={className} {...props}>
          {children}
        </code>
      );
    }
  };

  const renderMessage = (msg: Message) => {
    const messageContent = (
      <>
        <div className="message-header">
          <div className="sender-info">
            <div className="icon">{msg.role === 'user' ? <LuUser /> : <LuBot />}</div>
            <span>{msg.role === 'user' ? 'You' : 'Assistant'}</span>
          </div>
        </div>
        <div className="message-content">
          {msg.role === 'assistant' && msg.content === '' && isLoading ? (
            <div className="spinner-dots" />
          ) : (
            <div className="message-text">
              {msg.role === 'user' ? (
                <>
                  {/* S3併用方式の添付ファイル表示 */}
                  {msg.attachment && (
                    <div className="message-attachment" style={{ marginBottom: '12px' }}>
                      <AttachmentDisplay attachment={msg.attachment} />
                    </div>
                  )}
                  {msg.content && <p className="user-message-text">{msg.content}</p>}
                </>
              ) : (
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkBreaks]}
                    components={markdownComponents}
                  >
                    {msg.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="message-actions">
          {msg.role === 'assistant' && (
            <div className="message-meta">
              {msg.mode && (
                <span className={`mode-tag mode-${msg.mode}`}>
                  {msg.mode === 'knowledge_base' ? '社内データで検索' : '通常AIで生成'}
                </span>
              )}
              {msg.model && (
                <span className={`model-tag model-${getModelDisplayName(msg.model)}`}>
                  {getModelDisplayName(msg.model)}
                </span>
              )}
            </div>
          )}
          {copiedId === msg.id ? (
            <span className="copied-feedback">コピーしました！</span>
          ) : (
            <button className="action-icon" title="Copy" onClick={() => handleCopy(msg.content, msg.id)}>
              <LuCopy />
            </button>
          )}
        </div>
      </>
    );

    return (
      <div key={msg.id} className={`message-wrapper ${msg.role}`}>
        <div className="message-content-container">{messageContent}</div>
      </div>
    );
  };
  
  return (
    <main className="main-content">
      {/* モバイル用ヘッダー */}
      <div className="mobile-header">
        <button 
          className={`mobile-menu-button ${isMobileSidebarOpen ? 'active' : ''}`}
          onClick={onToggleSidebar}
          title={isMobileSidebarOpen ? 'メニューを閉じる' : 'メニューを開く'}
        >
          {isMobileSidebarOpen ? <LuX /> : <LuMenu />}
        </button>
        <div className="mobile-title">CPI社内文書AI</div>
        <div style={{ width: '40px' }}></div>
      </div>

      <div className="chat-area-wrapper">
        <div className="chat-area" ref={chatAreaRef} onScroll={handleScroll}>
          {messages.map(renderMessage)}
        </div>
        
        {showScrollToBottom && (
          <button className="scroll-to-bottom-button" onClick={scrollToBottom} title="一番下へ移動">
            <IoArrowDown />
          </button>
        )}
        
        <div className="prompt-input-wrapper">
          
          {/* モード選択セクション */}
          <div className="mode-selector">
            <label className="radio-label">
              <input 
                type="radio" 
                name="chatMode" 
                value="knowledge_base"
                checked={mode === 'knowledge_base'}
                onChange={() => onModeChange('knowledge_base')}
                disabled={isLoading || !!attachedFile}
              />
              <span>社内データのみ</span>
            </label>
            <label className="radio-label">
              <input 
                type="radio" 
                name="chatMode" 
                value="general"
                checked={mode === 'general'}
                onChange={() => onModeChange('general')}
                disabled={isLoading}
              />
              <span>通常生成AI利用</span>
            </label>
          </div>

          {/* アップロード進捗表示 */}
          {isUploading && (
            <div className="upload-progress" style={{
              padding: '8px 12px',
              backgroundColor: '#e3f2fd',
              borderRadius: '4px',
              marginBottom: '8px'
            }}>
              <div style={{ fontSize: '14px', marginBottom: '4px' }}>
                ファイル処理中... {uploadProgress}%
              </div>
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#ddd',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${uploadProgress}%`,
                  height: '100%',
                  backgroundColor: '#2196f3',
                  transition: 'width 0.3s ease'
                }} />
              </div>
            </div>
          )}

          {/* エラー表示 */}
          {uploadError && (
            <div className="upload-error" style={{
              padding: '8px 12px',
              backgroundColor: '#ffebee',
              color: '#c62828',
              borderRadius: '4px',
              marginBottom: '8px',
              fontSize: '14px'
            }}>
              ❌ {uploadError}
            </div>
          )}

          {/* ファイルプレビュー */}
          {attachedFile && (
            <div className="file-preview-container">
              <div className="file-preview">
                <div className="file-preview-icon"><IoDocumentTextOutline /></div>
                <span className="file-preview-name">
                  {attachedFile.fileName || attachedFile.name}
                  {attachedFile.size && ` (${Math.round(attachedFile.size / 1024)}KB)`}
                </span>
                <button className="file-preview-remove" onClick={onFileRemove} title="ファイルを削除">
                  <LuX />
                </button>
              </div>
            </div>
          )}

          <div className="prompt-input-container">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept="image/*,application/pdf"
            />
            <button
              className="attach-icon-button"
              onClick={handleAttachClick}
              disabled={isLoading || isUploading || !!attachedFile || mode !== 'general'}
              title={
                mode !== 'general' 
                  ? "通常生成AI利用モードで添付可能です" 
                  : isUploading 
                  ? "ファイル処理中です" 
                  : "ファイルを添付（最大3.75MB）"
              }
            >
              <LuPaperclip />
            </button>
            <TextareaAutosize
              ref={promptTextareaRef} // refを設定
              className="prompt-textarea"
              value={promptInput}
              onChange={(e) => onPromptChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                mode === 'knowledge_base' 
                  ? "ご自由に入力してください..."
                  : attachedFile 
                  ? "画像について質問してください..." 
                  : "ご自由に入力してください... (画像・PDFも添付可、最大3.75MB)"
              }
              disabled={isLoading || isUploading}
              rows={1}
              maxRows={10}
            />
            <button 
              className="send-icon-button"
              onClick={handleSendPrompt}
              disabled={isLoading || isUploading || (!promptInput.trim() && !attachedFile)}
              title="送信"
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