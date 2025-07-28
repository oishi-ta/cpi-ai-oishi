// src/components/features/MultiImageDisplay.tsx
import React, { useState } from 'react';
import { LuDownload } from 'react-icons/lu';
import type { GeneratedImage } from '../../types/image';
import ImageDisplay from './ImageDisplay';

interface MultiImageDisplayProps {
  images: GeneratedImage[];
  onRegenerate?: (seed: number) => void;
  className?: string;
}

const MultiImageDisplay: React.FC<MultiImageDisplayProps> = ({
  images,
  onRegenerate,
  className = ''
}) => {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const handleThumbnailClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const downloadAllImages = () => {
    images.forEach((image, index) => {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${image.base64}`;
      const filename = `nova_canvas_batch_${image.seed}_${index + 1}.png`;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  if (images.length === 1) {
    // 1枚の場合は通常の表示
    return (
      <ImageDisplay 
        image={images[0]} 
        onRegenerate={onRegenerate}
        className={className}
      />
    );
  }

  const selectedImage = images[selectedImageIndex];

  return (
    <div className={`multi-image-display ${className}`}>
      {/* メイン画像表示 */}
      <div className="main-image-container">
        <img
          src={`data:image/png;base64,${selectedImage.base64}`}
          alt={`${selectedImage.prompt} - ${selectedImageIndex + 1}`}
          className="main-generated-image"
        />
        
        {/* オーバーレイアクション */}
        <div className="image-overlay">
          <div className="image-actions">
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:image/png;base64,${selectedImage.base64}`;
                link.download = `nova_canvas_${selectedImage.seed}_${selectedImageIndex + 1}.png`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="action-button download"
              title="ダウンロード"
            >
              <LuDownload />
            </button>
          </div>
        </div>
      </div>

      {/* サムネイル一覧 */}
      <div className="thumbnail-container">
        {images.map((image, index) => (
          <div 
            key={index}
            className={`thumbnail-item ${index === selectedImageIndex ? 'active' : ''}`}
            onClick={() => handleThumbnailClick(index)}
          >
            <img
              src={`data:image/png;base64,${image.base64}`}
              alt={`${image.prompt} - ${index + 1}`}
              className="thumbnail-image"
            />
          </div>
        ))}
      </div>

      {/* 一括ダウンロードボタン */}
      <div className="batch-actions">
        <button
          onClick={downloadAllImages}
          className="batch-download-button"
          title="すべての画像をダウンロード"
        >
          <LuDownload />
          すべてダウンロード ({images.length}枚)
        </button>
      </div>

      {/* 画像詳細情報（選択された画像の詳細） */}
      <div className="image-details">
        <div className="detail-group">
          <div className="detail-label">プロンプト</div>
          <div className="detail-text">{selectedImage.prompt}</div>
        </div>

        {selectedImage.negativePrompt && (
          <div className="detail-group">
            <div className="detail-label">ネガティブプロンプト</div>
            <div className="detail-text">{selectedImage.negativePrompt}</div>
          </div>
        )}

        <div className="detail-row">
          <div className="detail-group">
            <div className="detail-label">サイズ</div>
            <div className="detail-value">{selectedImage.width} × {selectedImage.height}</div>
          </div>
          <div className="detail-group">
            <div className="detail-label">シード</div>
            <div className="detail-value">{selectedImage.seed}</div>
          </div>
          <div className="detail-group">
            <div className="detail-label">画像番号</div>
            <div className="detail-value">{selectedImageIndex + 1} / {images.length}</div>
          </div>
        </div>

        <div className="detail-group">
          <div className="detail-label">生成日時</div>
          <div className="detail-value">
            {new Date(selectedImage.generatedAt).toLocaleString('ja-JP')}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiImageDisplay;