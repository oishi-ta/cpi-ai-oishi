# srcフォルダ詳細コード説明

このドキュメントでは、CPI社内文書AIプロジェクトのsrcフォルダ下の各ファイルがどのようなコードを実装しているかを詳細に説明します。

## メインファイル

### `src/main.tsx`
**役割**: アプリケーションのエントリーポイント

**実装内容**:
```typescript
// AWS Amplify設定の初期化
Amplify.configure(amplifyconfig);

// Reactアプリケーションのマウント
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- AWS Amplifyの設定を読み込んで初期化
- React 19のStrictModeでアプリケーションをマウント
- グローバルCSSスタイルの読み込み

### `src/App.tsx`
**役割**: メインアプリケーションコンポーネント

**主要な実装内容**:

#### 1. 認証設定
```typescript
// カスタムサインイン/サインアップフォーム設定
const formFields = {
  signIn: {
    username: { placeholder: 'ユーザー名を入力してください', ... },
    password: { placeholder: 'パスワードを入力してください', ... }
  },
  signUp: { /* サインアップフィールド設定 */ }
};

// 日本語化設定
I18n.putVocabularies(translations);
I18n.putVocabularies(JA_TRANSLATIONS);
I18n.setLanguage('ja');
```

#### 2. カスタム認証サービス
```typescript
const services = {
  // パスワード検証
  async validateCustomSignUp(formData: any) {
    // 8文字以上、大文字・小文字・数字チェック
  },
  
  // サインアップ処理
  async handleSignUp(input: any) {
    // AWS Cognitoサインアップ実行
  },
  
  // 確認コード処理
  async handleConfirmSignUp(input: any) {
    // 確認コード検証後、完了画面表示
  }
};
```

#### 3. 確認完了画面コンポーネント
```typescript
const ConfirmationCompleteScreen = () => (
  // アカウント申請受付完了のUI表示
  // 管理者承認待ちメッセージ
);
```

#### 4. ルーティング設定
```typescript
<Router>
  <Routes>
    <Route path="/" element={<Navigate to="/chat" replace />} />
    <Route path="/chat" element={<ChatPage user={user} signOut={handleSignOut} />} />
  </Routes>
</Router>
```

### `src/amplifyconfiguration.ts`
**役割**: AWS Amplify設定

**実装内容**:
```typescript
const amplifyConfig: ResourcesConfig = {
  Auth: {
    Cognito: {
      userPoolId: 'ap-northeast-1_LuvUmWDZ4',
      userPoolClientId: '1io057uu2e3jobtl0rsggpc3js',
      loginWith: {
        oauth: {
          domain: 'ap-northeast-1luvumwdz4.auth.ap-northeast-1.amazoncognito.com',
          scopes: ['openid', 'email', 'phone'],
          redirectSignIn: ['http://localhost:5173'],
          redirectSignOut: ['http://localhost:5173'],
          responseType: 'code'
        }
      }
    }
  }
};
```

- AWS Cognito User Pool設定
- OAuth認証設定
- リダイレクトURL設定

## 国際化・翻訳

### `src/ja.ts`
**役割**: 日本語翻訳定義

**実装内容**:
```typescript
export const JA_TRANSLATIONS = {
  ja: {
    // 認証画面の翻訳
    'Username': 'ユーザー名',
    'Password': 'パスワード',
    'Sign In': 'サインイン',
    
    // パスワードポリシーエラーメッセージ
    'Password must have at least 8 characters': 'パスワードは8文字以上にしてください',
    'Password does not conform to policy: Password must have uppercase characters': 'パスワードには大文字を含めてください',
    
    // 一般的なエラーメッセージ
    'User does not exist': 'ユーザーが存在しません',
    'Incorrect username or password.': 'ユーザー名またはパスワードが違います'
  }
};
```

- AWS Amplify UIコンポーネントの日本語化
- 認証関連のエラーメッセージ翻訳
- パスワードポリシー違反メッセージの翻訳

## ページコンポーネント

### `src/pages/ChatPage.tsx`
**役割**: チャットページのメインコンポーネント

**主要な実装内容**:

#### 1. 状態管理
```typescript
const [prompt, setPrompt] = useState<string>('');
const [mode, setMode] = useState<ChatMode>('general');
const [model, setModel] = useState<ModelType>('nova-lite');
const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
```

#### 2. カスタムフック使用
```typescript
const {
  chats, activeChatId, activeMessages, isLoading,
  startNewChat, handleChatSelect, handleChatDelete, handleSendMessage
} = useChat(user);

const { attachedFile, isUploading, handleFileAttach, handleFileRemove } = useFileUpload();

const { searchResults, searchQuery, isSearching, handleSearchSubmit } = useSearch();
```

#### 3. URL パラメータ処理
```typescript
useEffect(() => {
  const chatIdFromUrl = searchParams.get('chatId');
  if (chatIdFromUrl && chats.length > 0) {
    const targetChat = chats.find(chat => chat.id === chatIdFromUrl);
    if (targetChat && activeChatId !== chatIdFromUrl) {
      handleChatSelect(chatIdFromUrl);
    }
  }
}, [searchParams, chats, activeChatId, handleChatSelect]);
```

#### 4. イベントハンドラー
```typescript
// メッセージ送信処理
const handleSendPrompt = async () => {
  const currentPrompt = prompt;
  const currentFile = attachedFile;
  
  setPrompt('');
  handleFileRemove();
  
  await handleSendMessage(currentPrompt, mode, model, currentFile);
};

// サインアウト処理
const handleSignOutRequest = () => {
  setShowSignOutModal(true);
};
```

## サービス層（API通信）

### `src/services/chatApi.ts`
**役割**: チャット機能のAPI通信

**主要な実装内容**:

#### 1. チャット一覧取得
```typescript
async fetchChatList(): Promise<ChatListItem[]> {
  const currentToken = await getCurrentToken();
  
  const response = await fetch(`${API_BASE_URL}/chats`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });
  
  return await response.json();
}
```

#### 2. チャット履歴取得
```typescript
async fetchChatHistory(chatId: string): Promise<Message[]> {
  const response = await fetch(`${API_BASE_URL}/chats/${chatId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${currentToken}` }
  });
  
  return await response.json();
}
```

#### 3. メッセージ送信（SSE対応）
```typescript
async sendMessage(payload: any): Promise<Response> {
  const response = await fetch(lambdaFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`,
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
    },
    body: JSON.stringify(payload),
    signal: payload.signal,
  });
  
  return response;
}
```

### `src/services/fileApi.ts`
**役割**: ファイル操作のAPI通信

**主要な実装内容**:

#### 1. Presigned URL取得
```typescript
async getPresignedUrl(fileName: string, fileType: string): Promise<{uploadUrl: string; s3Key: string}> {
  const response = await fetch(`${API_BASE_URL}/presigned-url`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`,
    },
    body: JSON.stringify({ fileName, fileType })
  });
  
  return await response.json();
}
```

#### 2. S3アップロード
```typescript
async uploadToS3(file: File | Blob, uploadUrl: string): Promise<void> {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    headers: { 'Content-Type': file.type },
  });
}
```

#### 3. S3画像取得
```typescript
async fetchImageFromS3(s3Key: string): Promise<{base64Data: string; contentType: string}> {
  const response = await fetch(`${API_BASE_URL}/get-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${currentToken}`,
    },
    body: JSON.stringify({ s3Key })
  });
  
  return await response.json();
}
```

### `src/services/searchApi.ts`
**役割**: 検索機能のAPI通信

**実装内容**:
```typescript
async searchChats(query: string, limit: number = 20, offset: number = 0): Promise<SearchResponse> {
  const encodedQuery = encodeURIComponent(query);
  const url = `${API_BASE_URL}/search?q=${encodedQuery}&limit=${limit}&offset=${offset}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: { 
      'Authorization': `Bearer ${currentToken}`,
      'Content-Type': 'application/json'
    }
  });
  
  return await response.json();
}
```

## 型定義

### `src/types/chat.ts`
**役割**: チャット機能の型定義

**主要な型定義**:
```typescript
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'knowledge_base' | 'general';
  model?: 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4';
  attachment?: {
    fileName: string;
    fileType?: string;
    size?: number;
    data?: string;
    s3Key?: string;
    displayUrl?: string;
  };
}

export interface ChatThread {
  id: string;
  title: string;
  messages: Message[];
}

export type ChatMode = 'knowledge_base' | 'general';
export type ModelType = 'nova-lite' | 'nova-pro' | 'claude-3-7-sonnet' | 'claude-sonnet-4';
```

### `src/types/file.ts`
**役割**: ファイル関連の型定義

```typescript
export interface FileAttachment {
  fileName: string;
  fileType: string;
  size: number;
  data: string;        // Base64データ（Bedrock送信用）
  s3Key: string;       // S3キー（履歴保存用）
  displayUrl: string;  // 表示用URL
}

export interface UploadProgress {
  isUploading: boolean;
  progress: number;
  error: string | null;
}
```

### `src/types/search.ts`
**役割**: 検索機能の型定義

```typescript
export interface SearchResult {
  chatId: string;
  title: string;
  matchedContent: string;
  matchType: 'title' | 'content';
  score: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  query: string;
  limit: number;
  offset: number;
}
```

## カスタムフック

### `src/hooks/useChat.ts`
**役割**: チャット機能のロジック

**主要な実装内容**:

#### 1. 状態管理
```typescript
const [chats, setChats] = useState<ChatThread[]>([]);
const [activeChatId, setActiveChatId] = useState<string | null>(null);
const [isLoading, setIsLoading] = useState<boolean>(false);

const abortControllerRef = useRef<AbortController | null>(null);
const currentStreamingMessageIdRef = useRef<string | null>(null);
```

#### 2. チャット履歴取得
```typescript
const fetchChatHistory = async (chatId: string) => {
  const messages: Message[] = await chatApi.fetchChatHistory(chatId);
  
  // 履歴メッセージの画像復元処理
  const processedMessages = await Promise.all(
    messages.map(async (message) => {
      if (message.attachment?.s3Key && message.attachment.fileType?.startsWith('image/')) {
        const imageData = await fileApi.fetchImageFromS3(message.attachment.s3Key);
        return {
          ...message,
          attachment: {
            ...message.attachment,
            data: imageData.base64Data,
            displayUrl: `data:${imageData.contentType};base64,${imageData.base64Data}`
          }
        };
      }
      return message;
    })
  );
  
  setChats(prevChats => 
    prevChats.map(chat => 
      chat.id === chatId ? { ...chat, messages: processedMessages } : chat
    )
  );
};
```

#### 3. SSEストリーミング処理
```typescript
const handleSendMessage = async (prompt: string, mode: ChatMode, model: ModelType, attachedFile: FileAttachment | null) => {
  // AbortController管理
  abortControllerRef.current = new AbortController();
  
  const response = await chatApi.sendMessage({
    user_prompt: prompt,
    chat_id: isNewChat ? null : activeChatId,
    mode: mode,
    model: model,
    attachment: attachmentPayload,
    signal: abortControllerRef.current.signal,
  });

  // SSEストリーム処理
  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const message: SSEMessage = JSON.parse(line.slice(6));
        
        if (message.type === 'message') {
          // リアルタイムでメッセージ内容を更新
          setChats(prevChats => /* メッセージ更新ロジック */);
        }
      }
    }
  }
};
```

#### 4. 生成停止機能
```typescript
const handleStopGeneration = () => {
  if (abortControllerRef.current) {
    abortControllerRef.current.abort();
    setIsLoading(false);
    
    // 停止メッセージを追加
    if (currentStreamingMessageIdRef.current) {
      setChats(prevChats => /* 停止メッセージ追加ロジック */);
    }
  }
};
```

### `src/hooks/useFileUpload.ts`
**役割**: ファイルアップロードのロジック

**主要な実装内容**:

#### 1. ファイル処理（画像の場合）
```typescript
const handleFileAttach = async (file: File) => {
  if (file.type.startsWith('image/')) {
    // 並行処理（オリジナルBase64 + 圧縮版S3保存）
    const [originalBase64, compressedData] = await Promise.all([
      // オリジナルBase64変換（Bedrock送信用）
      new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64Data = (e.target?.result as string).split(',')[1];
          resolve(base64Data);
        };
        reader.readAsDataURL(file);
      }),
      
      // 画像圧縮（S3保存用）
      compressImage(file, 800, 0.7)
    ]);
    
    // 圧縮版をS3にアップロード
    const { uploadUrl, s3Key } = await fileApi.getPresignedUrl(file.name, 'image/jpeg');
    await fileApi.uploadToS3(compressedData.blob, uploadUrl);
  }
};
```

#### 2. 進捗管理
```typescript
const [isUploading, setIsUploading] = useState(false);
const [uploadProgress, setUploadProgress] = useState(0);
const [uploadError, setUploadError] = useState<string | null>(null);

// 進捗更新
setUploadProgress(10);  // 開始
setUploadProgress(60);  // 処理中
setUploadProgress(90);  // アップロード完了
setUploadProgress(100); // 完了
```

### `src/hooks/useSearch.ts`
**役割**: 検索機能のロジック

**実装内容**:
```typescript
const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
const [searchQuery, setSearchQuery] = useState<string>('');
const [isSearching, setIsSearching] = useState<boolean>(false);
const [isSearchMode, setIsSearchMode] = useState<boolean>(false);

const handleSearchSubmit = async (query: string) => {
  setIsSearching(true);
  setSearchQuery(query);
  setIsSearchMode(true);

  try {
    const response = await searchApi.searchChats(query, 20, 0);
    setSearchResults(response.results);
  } catch (error) {
    setSearchError('検索中にエラーが発生しました');
  } finally {
    setIsSearching(false);
  }
};

const exitSearchMode = () => {
  setIsSearchMode(false);
  setSearchResults([]);
  setSearchQuery('');
};
```

## ユーティリティ関数

### `src/utils/auth.ts`
**役割**: 認証関連のユーティリティ

**実装内容**:
```typescript
// 現在のトークン取得
export const getCurrentToken = async (): Promise<string | null> => {
  try {
    const session = await fetchAuthSession();
    return session.tokens?.idToken?.toString() || null;
  } catch (error) {
    console.error('トークン取得エラー:', error);
    return null;
  }
};

// ユーザーメール取得
export const getUserEmail = (user: any): string => {
  return user?.signInDetails?.loginId || user?.username || user?.attributes?.email;
};
```

### `src/utils/fileUtils.ts`
**役割**: ファイル操作のユーティリティ

**主要な実装内容**:

#### 1. 画像圧縮
```typescript
export const compressImage = (file: File, maxWidth: number = 800, quality: number = 0.7): Promise<{base64Data: string; blob: Blob}> => {
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
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      // Base64とBlobの両方を生成
      const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
      const base64Data = compressedDataUrl.split(',')[1];
      
      canvas.toBlob((blob) => {
        if (blob) {
          resolve({ base64Data, blob });
        }
      }, 'image/jpeg', quality);
    };
    
    img.src = URL.createObjectURL(file);
  });
};
```

#### 2. ファイル検証
```typescript
export const validateFile = (file: File): { isValid: boolean; error?: string } => {
  const maxSize = getFileSizeLimit(); // 3.75MB
  
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: `ファイルサイズが制限を超えています。最大${maxSizeMB}MBまでです。`
    };
  }
  
  if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
    return {
      isValid: false,
      error: '画像(JPG, PNG, GIFなど)またはPDFファイルを選択してください。'
    };
  }
  
  return { isValid: true };
};
```

### `src/utils/markdown.ts`
**役割**: マークダウン処理のユーティリティ

**実装内容**:
```typescript
export const markdownComponents = {
  code({ node, inline, className, children, ...props }: any) {
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : '';
    
    return !inline && match ? (
      React.createElement(SyntaxHighlighter, {
        style: oneDark,
        language: language,
        PreTag: "div",
        ...props
      }, String(children).replace(/\n$/, ''))
    ) : (
      React.createElement('code', {
        className: className,
        ...props
      }, children)
    );
  }
};
```

## 定数定義

### `src/constants/models.ts`
**役割**: AIモデル設定

**実装内容**:
```typescript
export const MODEL_OPTIONS = [
  { group: 'Amazon Nova', models: ['nova-lite', 'nova-pro'] },
  { group: 'Anthropic Claude', models: ['claude-3-7-sonnet', 'claude-sonnet-4'] }
] as const;

export const getModelDisplayName = (modelId: string): string => {
  switch (modelId) {
    case 'nova-lite': return 'Nova Lite';
    case 'nova-pro': return 'Nova Pro';
    case 'claude-3-7-sonnet': return 'Claude 3.7 Sonnet';
    case 'claude-sonnet-4': return 'Claude Sonnet 4';
    default: return modelId;
  }
};

export const getModelDescription = (modelId: string): string => {
  switch (modelId) {
    case 'nova-lite': return '低コスト、日常的なタスク';
    case 'nova-pro': return '低コスト、複雑な推論タスク';
    case 'claude-3-7-sonnet': return '中コスト、高度な推論能力';
    case 'claude-sonnet-4': return '高コスト、最上位モデル';
    default: return '';
  }
};
```

## スタイルファイル

### `src/index.css`
**役割**: グローバルスタイル

**主要な設定**:
- フォントファミリー設定（system-ui, Avenir, Helvetica, Arial）
- ダークモード対応のカラースキーム
- 基本的なリセットCSS
- ボタンとリンクの基本スタイル

### `src/App.css`
**役割**: アプリケーション専用スタイル

**主要な機能**:
- CSS変数による統一されたデザインシステム
- レスポンシブデザイン（デスクトップ・タブレット・モバイル対応）
- サイドバー・メインコンテンツのレイアウト
- チャットメッセージのスタイリング
- 検索機能のUI
- ファイルアップロード・プレビューのスタイル
- アニメーション効果

### `src/amplify-ui-theme.css`
**役割**: AWS Amplify UIのカスタムテーマ

**実装内容**:
```css
:root {
  --amplify-components-button-primary-background-color: #1976d2;
  --amplify-components-button-primary-hover-background-color: #1565c0;
  --amplify-components-fieldcontrol-focus-border-color: #1976d2;
}

.amplify-authenticator[data-variation="modal"] {
  background-color: rgba(0, 0, 0, 0.5) !important;
}
```

- 認証UIのカラーテーマカスタマイズ
- モーダル表示時の背景設定
- フォーカス状態のスタイル調整

## コンポーネント構成

### レイアウトコンポーネント
- `src/components/layout/Sidebar.tsx`: サイドバーレイアウト
- `src/components/layout/MainContent.tsx`: メインコンテンツレイアウト

### 機能コンポーネント
- `src/components/features/MessageInput.tsx`: メッセージ入力
- `src/components/features/MessageList.tsx`: メッセージ一覧表示
- `src/components/features/ModelSelector.tsx`: AIモデル選択
- `src/components/features/SearchInput.tsx`: 検索入力
- `src/components/features/SearchResults.tsx`: 検索結果表示

### UIコンポーネント
- `src/components/ui/AttachmentDisplay.tsx`: 添付ファイル表示
- `src/components/ui/FilePreview.tsx`: ファイルプレビュー
- `src/components/ui/LazyImage.tsx`: 遅延読み込み画像

### 共通コンポーネント
- `src/components/common/SignOutConfirmationModal.tsx`: サインアウト確認モーダル

## 技術的特徴

1. **TypeScript**: 型安全性を重視した実装
2. **React 19**: 最新のReact機能を活用
3. **AWS Amplify**: 認証・API通信の統合
4. **SSE (Server-Sent Events)**: リアルタイムストリーミング
5. **カスタムフック**: ロジックの再利用性
6. **レスポンシブデザイン**: モバイル・デスクトップ対応
7. **ファイル処理**: 画像圧縮・S3アップロード
8. **国際化**: 日本語対応
9. **エラーハンドリング**: 包括的なエラー処理
10. **パフォーマンス最適化**: 遅延読み込み・メモ化

このアーキテクチャにより、スケーラブルで保守性の高いAIチャットアプリケーションが実現されています。