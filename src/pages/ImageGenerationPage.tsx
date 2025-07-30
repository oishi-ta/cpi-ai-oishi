// src/pages/ImageGenerationPage.tsx - 履歴削除・シンプル版

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { useChat } from '../hooks/useChat';
import { useSearch } from '../hooks/useSearch';
import { getUserEmail } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import ImageGenerationForm from '../components/features/ImageGenerationForm';
import MultiImageDisplay from '../components/features/MultiImageDisplay';
import type { ImageGenerationRequest } from '../types/image';
import type { ModelType } from '../types/chat';

interface ImageGenerationPageProps {
  user: any;
  signOut: () => void;
}

const ImageGenerationPage: React.FC<ImageGenerationPageProps> = ({
  user,
  signOut
}) => {
  const navigate = useNavigate();
  const userEmail = getUserEmail(user);
  const [model, setModel] = useState<ModelType>('nova-lite');
  
  // チャット機能のフック
  const {
    chats,
    activeChatId,
    startNewChat,
    handleChatSelect: originalHandleChatSelect,
    handleChatDelete
  } = useChat(user);
  
  const { handleSearchSubmit } = useSearch();
  
  const {
    isGenerating,
    generatedImages,
    generationError,
    generateImage,
    clearError
  } = useImageGeneration();

  const handleGenerate = async (request: ImageGenerationRequest) => {
    try {
      await generateImage(request);
    } catch (error) {
      // エラーはフックで処理済み
    }
  };

  const handleRegenerate = (seed: number) => {
    if (generatedImages.length > 0) {
      const firstImage = generatedImages[0];
      const request: ImageGenerationRequest = {
        prompt: firstImage.prompt,
        negativePrompt: firstImage.negativePrompt || undefined,
        width: firstImage.width,
        height: firstImage.height,
        seed,
        numberOfImages: generatedImages.length
      };
      handleGenerate(request);
    }
  };

  const handleBackToChat = () => {
    if (activeChatId) {
      // アクティブなチャットがある場合はそのチャットに戻る
      navigate(`/chat/${activeChatId}`);
    } else {
      // アクティブなチャットがない場合は通常のチャットページに戻る
      navigate('/chat');
    }
  };

  // 🔄 チャット選択時にパスパラメータ形式で遷移
  const handleChatSelect = (chatId: string) => {
    // まず元の状態更新を実行
    originalHandleChatSelect(chatId);
    
    // パスパラメータ形式でチャットページに遷移
    navigate(`/chat/${chatId}`);
  };

  // 🔄 新しいチャット作成時にもページ遷移
  const handleNewChat = () => {
    startNewChat();
    navigate('/chat'); // 新しいチャットは /chat のみ
  };

  // 🔄 検索実行時にもページ遷移
  const handleSearchSubmitWithNavigation = async (query: string) => {
    await handleSearchSubmit(query);
    navigate('/chat'); // 検索結果をチャットページで表示
  };

  return (
    <div className="app-layout">
      {/* サイドバー */}
      <Sidebar 
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={handleNewChat}
        onChatSelect={handleChatSelect} // パスパラメータ対応
        onChatDelete={handleChatDelete}
        userEmail={userEmail}
        onSignOut={signOut}
        model={model}
        onModelChange={setModel}
        onSearchSubmit={handleSearchSubmitWithNavigation}
      />
      
      {/* メインコンテンツ */}
      <main className="main-content">
        {/* ヘッダー */}
        <div className="image-page-header">
          <button 
            onClick={handleBackToChat}
            className="back-button"
            title="チャットに戻る"
          >
            <LuArrowLeft />
            チャットに戻る
          </button>
          <h1 className="page-title">画像生成</h1>
          <div style={{ width: '120px' }}></div>
        </div>

        <div className="image-page-content">
          {/* 左パネル: フォーム */}
          <div className="image-form-panel">
            <ImageGenerationForm
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
            />

            {/* エラー表示 */}
            {generationError && (
              <div className="error-message">
                <span>❌ {generationError}</span>
                <button onClick={clearError} className="error-close">×</button>
              </div>
            )}
          </div>

          {/* 右パネル: 画像表示 */}
          <div className="image-display-panel">
            {isGenerating && (
              <div className="generating-placeholder">
                <div className="generating-animation">
                  <div className="generating-spinner"></div>
                  <h3>生成中...</h3>
                  <p>しばらくお待ちください</p>
                </div>
              </div>
            )}
            
            {!isGenerating && generatedImages.length > 0 && (
              <MultiImageDisplay
                images={generatedImages}
                onRegenerate={handleRegenerate}
                className="main-image-display"
              />
            )}
            
            {!isGenerating && generatedImages.length === 0 && (
              <div className="empty-placeholder">
                <div className="empty-content">
                  <h3>画像生成</h3>
                  <p>プロンプトを入力して画像を生成してください</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImageGenerationPage;