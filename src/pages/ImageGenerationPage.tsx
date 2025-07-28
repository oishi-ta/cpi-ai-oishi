// src/pages/ImageGenerationPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LuArrowLeft, LuHistory } from 'react-icons/lu';
import { useImageGeneration } from '../hooks/useImageGeneration';
import { useChat } from '../hooks/useChat';
import { useSearch } from '../hooks/useSearch';
import { getUserEmail } from '../utils/auth';
import Sidebar from '../components/layout/Sidebar';
import ImageGenerationForm from '../components/features/ImageGenerationForm';
import MultiImageDisplay from '../components/features/MultiImageDisplay';
import ImageDisplay from '../components/features/ImageDisplay';
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
    handleChatSelect,
    handleChatDelete
  } = useChat(user);
  
  const { handleSearchSubmit } = useSearch();
  
  const {
    isGenerating,
    generatedImages,
    generationError,
    imageHistory,
    generateImage,
    clearError,
    selectHistoryImages
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
    navigate('/chat');
  };

  return (
    <div className="app-layout">
      {/* サイドバー */}
      <Sidebar 
        chats={chats}
        activeChatId={activeChatId}
        onNewChat={startNewChat}
        onChatSelect={handleChatSelect}
        onChatDelete={handleChatDelete}
        userEmail={userEmail}
        onSignOut={signOut}
        model={model}
        onModelChange={setModel}
        onSearchSubmit={handleSearchSubmit}
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
          <h1 className="page-title">Nova Canvas画像生成</h1>
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

            {/* 履歴 */}
            {imageHistory.length > 0 && (
              <div className="image-history">
                <h3 className="history-title">
                  <LuHistory />
                  生成履歴
                </h3>
                <div className="history-grid">
                  {imageHistory.map((item) => (
                    <div 
                      key={item.id}
                      className="history-item"
                      onClick={() => selectHistoryImages(item)}
                    >
                      <img 
                        src={`data:image/png;base64,${item.images[0].base64}`}
                        alt={item.prompt}
                        className="history-thumbnail"
                      />
                      <div className="history-info">
                        <div className="history-prompt">{item.prompt.substring(0, 50)}...</div>
                        <div className="history-date">
                          {new Date(item.createdAt).toLocaleString('ja-JP')}
                        </div>
                        {item.images.length > 1 && (
                          <div className="history-count">{item.images.length}枚</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 右パネル: 画像表示 */}
          <div className="image-display-panel">
            {isGenerating && (
              <div className="generating-placeholder">
                <div className="generating-animation">
                  <div className="generating-spinner"></div>
                  <h3>Nova Canvasで生成中...</h3>
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
                  <div className="empty-icon">🎨</div>
                  <h3>Nova Canvas画像生成</h3>
                  <p>プロンプトを入力してNova Canvasで画像を生成してください</p>
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