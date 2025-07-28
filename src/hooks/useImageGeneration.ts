// src/hooks/useImageGeneration.ts
import { useState } from 'react';
import type { ImageGenerationRequest, GeneratedImage, GeneratedImageResponse, ImageHistory } from '../types/image';
import { imageApi } from '../services/imageApi';
import { fileApi } from '../services/fileApi';

export const useImageGeneration = () => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistory[]>([]);
  const [generationProgress, setGenerationProgress] = useState<string>('');

  const generateImage = async (request: ImageGenerationRequest) => {
    try {
      setIsGenerating(true);
      setGenerationError(null);
      setGenerationProgress('Nova Canvasで画像生成中...');
      
      // Lambda関数URL経由で同期処理（S3キーのみ取得）
      const response = await imageApi.generateImage(request);
      
      if (response.success && response.images) {
        setGenerationProgress('画像データを取得中...');
        
        // Presigned URLから直接画像データを取得
        const imagesWithData = await Promise.all(
          response.images.map(async (imageInfo: GeneratedImageResponse): Promise<GeneratedImage | null> => {
            try {
              if (imageInfo.presignedUrl) {
                // Presigned URLから直接画像を取得
                const imageResponse = await fetch(imageInfo.presignedUrl);
                
                if (!imageResponse.ok) {
                  throw new Error(`画像取得失敗: ${imageResponse.status}`);
                }
                
                // ArrayBufferとして取得してBase64に変換
                const arrayBuffer = await imageResponse.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                const base64String = btoa(String.fromCharCode(...uint8Array));
                
                // GeneratedImage型に変換
                const completeImage: GeneratedImage = {
                  ...imageInfo,
                  base64: base64String,
                };
                
                return completeImage;
              } else if (imageInfo.s3Key) {
                // フォールバック: 既存のAPI経由
                console.warn('Presigned URLがないため、API経由で取得:', imageInfo.s3Key);
                const s3ImageData = await fileApi.fetchImageFromS3(imageInfo.s3Key);
                
                const completeImage: GeneratedImage = {
                  ...imageInfo,
                  base64: s3ImageData.base64Data,
                };
                
                return completeImage;
              } else {
                console.warn('S3キーもPresigned URLも見つかりません:', imageInfo);
                return null;
              }
            } catch (error) {
              console.error('画像取得エラー:', error);
              return null;
            }
          })
        );
        
        // nullでない画像のみフィルタ
        const validImages: GeneratedImage[] = imagesWithData.filter((img): img is GeneratedImage => img !== null);
        
        if (validImages.length === 0) {
          throw new Error('すべての画像の取得に失敗しました');
        }
        
        if (validImages.length < response.images.length) {
          console.warn(`${response.images.length - validImages.length}枚の画像取得に失敗しました`);
        }
        
        setGeneratedImages(validImages);
        
        // 履歴に追加
        const historyItem: ImageHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          prompt: request.prompt,
          negativePrompt: request.negativePrompt || '',
          images: validImages,
          createdAt: new Date().toISOString()
        };
        
        setImageHistory(prev => [historyItem, ...prev]);
        
        return validImages;
      } else {
        throw new Error(response.error || '画像生成に失敗しました');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像生成に失敗しました';
      setGenerationError(errorMessage);
      console.error('画像生成エラー:', error);
      throw error;
    } finally {
      setIsGenerating(false);
      setGenerationProgress('');
    }
  };

  const clearError = () => {
    setGenerationError(null);
  };

  const clearCurrentImages = () => {
    setGeneratedImages([]);
  };

  const selectHistoryImages = (historyItem: ImageHistory) => {
    setGeneratedImages(historyItem.images);
  };

  return {
    isGenerating,
    generatedImages,
    generationError,
    imageHistory,
    generationProgress,
    generateImage,
    clearError,
    clearCurrentImages,
    selectHistoryImages
  };
};