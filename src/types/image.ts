// src/types/image.ts
export interface ImageGenerationRequest {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  seed?: number;
  saveToS3?: boolean;
  numberOfImages?: number; // 枚数指定を追加
}

export interface GeneratedImage {
  base64: string;
  s3Key?: string;
  seed: number;
  prompt: string;
  negativePrompt: string;
  width: number;
  height: number;
  generatedAt: string;
  index?: number; // 複数画像の場合のインデックス
}

export interface ImageGenerationResponse {
  success: boolean;
  images?: GeneratedImage[]; // 複数画像対応
  image?: GeneratedImage; // 後方互換性のため残す
  totalCount?: number; // 生成された画像の総数
  error?: string;
  details?: string;
}

export interface ImageHistory {
  id: string;
  prompt: string;
  negativePrompt: string;
  images: GeneratedImage[]; // 複数画像対応
  createdAt: string;
}