// src/contexts/ImageContext.tsx - フォーム状態対応版
import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';
import type { GeneratedImage } from '../types/image';

interface ImageFormState {
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  seed: number | null;
  numberOfImages: number;
}

interface ImageContextType {
  // 画像状態
  generatedImages: GeneratedImage[];
  setGeneratedImages: (images: GeneratedImage[]) => void;
  clearImages: () => void;
  hasImages: boolean;
  
  // フォーム状態
  formState: ImageFormState;
  updateFormState: (updates: Partial<ImageFormState>) => void;
  clearFormState: () => void;
}

const defaultFormState: ImageFormState = {
  prompt: '',
  negativePrompt: '',
  width: 512,
  height: 512,
  seed: null,
  numberOfImages: 1
};

const ImageContext = createContext<ImageContextType | undefined>(undefined);

interface ImageProviderProps {
  children: ReactNode;
}

export const ImageProvider: React.FC<ImageProviderProps> = ({ children }) => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [formState, setFormState] = useState<ImageFormState>(defaultFormState);

  console.log('🎯 ImageProvider rendered:', {
    imageCount: generatedImages.length,
    formPrompt: formState.prompt.substring(0, 20) + (formState.prompt.length > 20 ? '...' : '')
  });

  const clearImages = () => {
    setGeneratedImages([]);
    console.log('画像状態をクリア');
  };

  const updateFormState = (updates: Partial<ImageFormState>) => {
    setFormState(prev => ({ ...prev, ...updates }));
    console.log('フォーム状態更新:', updates);
  };

  const clearFormState = () => {
    setFormState(defaultFormState);
    console.log('フォーム状態をクリア');
  };

  const contextValue: ImageContextType = {
    generatedImages,
    setGeneratedImages,
    clearImages,
    hasImages: generatedImages.length > 0,
    formState,
    updateFormState,
    clearFormState
  };

  return (
    <ImageContext.Provider value={contextValue}>
      {children}
    </ImageContext.Provider>
  );
};

// 基本的なuseContextを使用
export const useImageContext = (): ImageContextType => {
  console.log('🔍 useImageContext called');
  
  const context = useContext(ImageContext);
  
  if (context === undefined) {
    console.error('❌ useImageContext must be used within an ImageProvider');
    throw new Error('useImageContext must be used within an ImageProvider');
  }
  
  console.log('✅ useImageContext success - images:', context.generatedImages.length, 'prompt:', context.formState.prompt.substring(0, 10));
  return context;
};