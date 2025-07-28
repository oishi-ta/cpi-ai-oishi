// src/services/imageApi.ts
import type { ImageGenerationRequest, ImageGenerationResponse } from '../types/image';
import { getCurrentToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const imageApi = {
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      const response = await fetch(`${API_BASE_URL}/generate-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTPエラー: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('画像生成APIエラー:', error);
      throw error;
    }
  }
};