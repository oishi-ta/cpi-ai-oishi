import { getCurrentToken } from '../utils/auth';

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;

export const fileApi = {
  async getPresignedUrl(fileName: string, fileType: string): Promise<{uploadUrl: string; s3Key: string}> {
    const currentToken = await getCurrentToken();
    
    if (!currentToken) {
      throw new Error('認証トークンが取得できません');
    }
    
    const response = await fetch(`${API_BASE_URL}/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentToken}`,
      },
      body: JSON.stringify({ fileName, fileType })
    });

    if (!response.ok) {
      throw new Error(`Presigned URL取得エラー: ${response.status}`);
    }

    return await response.json();
  },

  async uploadToS3(file: File | Blob, uploadUrl: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
      },
    });

    if (!response.ok) {
      throw new Error(`S3アップロードエラー: ${response.status}`);
    }
  },

  async fetchImageFromS3(s3Key: string): Promise<{base64Data: string; contentType: string}> {
    try {
      const currentToken = await getCurrentToken();
      
      if (!currentToken) {
        throw new Error('認証トークンが取得できません');
      }
      
      const response = await fetch(`${API_BASE_URL}/get-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentToken}`,
        },
        body: JSON.stringify({ s3Key })
      });

      if (!response.ok) {
        throw new Error(`画像取得エラー: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('S3画像取得エラー:', error);
      throw error;
    }
  }
};