// src/hooks/useImageGeneration.ts
import { useState } from 'react';
import type { ImageGenerationRequest, GeneratedImage, ImageHistory } from '../types/image';
import { imageApi } from '../services/imageApi';

export const useImageGeneration = () => {
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [imageHistory, setImageHistory] = useState<ImageHistory[]>([]);

  const generateImage = async (request: ImageGenerationRequest) => {
    try {
      setIsGenerating(true);
      setGenerationError(null);
      
      const response = await imageApi.generateImage(request);
      
      if (response.success && response.images) {
        setGeneratedImages(response.images);
        
        // 履歴に追加
        const historyItem: ImageHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          prompt: request.prompt,
          negativePrompt: request.negativePrompt || '',
          images: response.images, // 複数画像対応
          createdAt: new Date().toISOString()
        };
        
        setImageHistory(prev => [historyItem, ...prev]);
        
        return response.images;
      } else if (response.success && response.image) {
        // 後方互換性のため単一画像も対応
        const images = [response.image];
        setGeneratedImages(images);
        
        const historyItem: ImageHistory = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          prompt: request.prompt,
          negativePrompt: request.negativePrompt || '',
          images: images,
          createdAt: new Date().toISOString()
        };
        
        setImageHistory(prev => [historyItem, ...prev]);
        
        return images;
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
    generateImage,
    clearError,
    clearCurrentImages,
    selectHistoryImages
  };
};