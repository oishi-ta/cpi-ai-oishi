// src/hooks/useImageGeneration.ts
import { useState } from 'react';
import type { ImageGenerationRequest, GeneratedImage, GeneratedImageResponse, ImageHistory } from '../types/image';
import { imageApi } from '../services/imageApi';
import { fetchImageFromPresignedUrl, checkImageSize, calculateBase64Size } from '../utils/imageUtils';

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
      
      console.log('画像生成開始:', {
        prompt: request.prompt.substring(0, 50) + '...',
        numberOfImages: request.numberOfImages || 1,
        dimensions: `${request.width || 1024}x${request.height || 1024}`
      });
      
      // Lambda Function URL経由で同期処理（S3キーとPresigned URLを取得）
      const response = await imageApi.generateImage(request);
      
      if (response.success && response.images && response.images.length > 0) {
        setGenerationProgress('画像データを取得中...');
        
        // Presigned URLまたはS3キーから画像データを取得
        const imagesWithData = await Promise.all(
          response.images.map(async (imageInfo: GeneratedImageResponse, index: number): Promise<GeneratedImage | null> => {
            try {
              console.log(`画像${index + 1}の取得開始:`, {
                hasPresignedUrl: !!imageInfo.presignedUrl,
                hasS3Key: !!imageInfo.s3Key,
                seed: imageInfo.seed
              });
              
              let base64String: string;
              
              if (imageInfo.presignedUrl) {
                // 優先: Presigned URLから直接画像を取得（ユーティリティ関数使用）
                console.log(`画像${index + 1}: Presigned URLから取得中...`);
                
                base64String = await fetchImageFromPresignedUrl(imageInfo.presignedUrl);
                
                // データサイズチェック
                const estimatedSize = calculateBase64Size(base64String);
                checkImageSize(estimatedSize);
                
                console.log(`画像${index + 1}: Presigned URLから正常取得`, {
                  base64Length: base64String.length,
                  estimatedSizeBytes: estimatedSize
                });
                
              } else if (imageInfo.s3Key) {
                // フォールバック: 既存のAPI経由でS3から取得
                console.log(`画像${index + 1}: 既存API経由でS3から取得中...`, imageInfo.s3Key);
                
                // この場合は fileApi を使う必要があるが、Lambda Function URL中心の設計では非推奨
                console.warn('Presigned URLが利用できないため、S3キーを使用します（非推奨）');
                throw new Error('Presigned URLが提供されていません');
                
              } else {
                throw new Error('画像データの取得方法が見つかりません（S3キーもPresigned URLも無し）');
              }
              
              // GeneratedImage型に変換
              const completeImage: GeneratedImage = {
                base64: base64String,
                s3Key: imageInfo.s3Key,
                seed: imageInfo.seed,
                prompt: imageInfo.prompt,
                negativePrompt: imageInfo.negativePrompt || '',
                width: imageInfo.width,
                height: imageInfo.height,
                generatedAt: imageInfo.generatedAt,
                index: imageInfo.index || (index + 1)
              };
              
              return completeImage;
              
            } catch (error) {
              console.error(`画像${index + 1}の取得エラー:`, {
                error: error instanceof Error ? error.message : error,
                imageInfo: {
                  hasPresignedUrl: !!imageInfo.presignedUrl,
                  hasS3Key: !!imageInfo.s3Key,
                  seed: imageInfo.seed
                }
              });
              return null;
            }
          })
        );
        
        // nullでない画像のみフィルタ
        const validImages: GeneratedImage[] = imagesWithData.filter((img): img is GeneratedImage => img !== null);
        
        console.log('画像取得結果:', {
          requested: response.images.length,
          successful: validImages.length,
          failed: response.images.length - validImages.length
        });
        
        if (validImages.length === 0) {
          throw new Error('すべての画像の取得に失敗しました');
        }
        
        if (validImages.length < response.images.length) {
          const failedCount = response.images.length - validImages.length;
          console.warn(`${failedCount}枚の画像取得に失敗しましたが、${validImages.length}枚は正常に取得できました`);
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
        
        console.log('画像生成完了:', {
          historyId: historyItem.id,
          totalImages: validImages.length
        });
        
        return validImages;
      } else {
        throw new Error(response.error || '画像生成レスポンスが無効です');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '画像生成に失敗しました';
      
      console.error('画像生成エラー:', {
        error: errorMessage,
        request: {
          prompt: request.prompt.substring(0, 50) + '...',
          numberOfImages: request.numberOfImages || 1
        }
      });
      
      setGenerationError(errorMessage);
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