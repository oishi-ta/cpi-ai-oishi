// src/services/imageApi.ts
import type { ImageGenerationRequest, ImageGenerationResponse } from '../types/image';
import { getCurrentToken } from '../utils/auth';

// 画像生成専用のLambda関数URL
const IMAGE_LAMBDA_FUNCTION_URL = import.meta.env.VITE_APP_IMAGE_LAMBDA_FUNCTION_URL;

export const imageApi = {
  // Lambda関数URL経由で画像生成（同期処理）
  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      if (!IMAGE_LAMBDA_FUNCTION_URL) {
        throw new Error('画像生成Lambda関数URLが設定されていません');
      }
      
      const response = await fetch(IMAGE_LAMBDA_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTPエラー: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('画像生成APIエラー:', error);
      throw error;
    }
  },

  // 後方互換性のため残す（非推奨）
  async startImageGeneration(request: ImageGenerationRequest) {
    console.warn('startImageGeneration is deprecated. Use generateImage instead.');
    return this.generateImage(request);
  },

  // 後方互換性のため残す（非推奨）
  async getJobStatus(jobId: string) {
    console.warn('getJobStatus is deprecated with Lambda Function URL approach.');
    throw new Error('Job status checking is not needed with synchronous processing');
  }
};