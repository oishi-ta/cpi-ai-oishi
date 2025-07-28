// src/components/features/MultiImageDisplay.tsx
import React, { useState } from 'react';
import { LuDownload, LuMaximize2 } from 'react-icons/lu';
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
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);

  const handleImageClick = (index: number) => {
    setSelectedImageIndex(index);
  };

  const handleCloseModal = () => {
    setSelectedImageIndex(null);
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

  return (
    <div className={`multi-image-display ${className}`}>
      {/* 画像グリッド */}
      <div className="image-grid">
        {images.map((image, index) => (
          <div 
            key={index}
            className="grid-image-container"
            onClick={() => handleImageClick(index)}
          >
            <img
              src={`data:image/png;base64,${image.base64}`}
              alt={`${image.prompt} - ${index + 1}`}
              className="grid-image"
            />
            <div className="image-overlay">
              <div className="image-actions">
                <button
                  className="action-button expand"
                  title="拡大表示"
                >
                  <LuMaximize2 />
                </button>
              </div>
            </div>
            <div className="image-index">{index + 1}</div>
          </div>
        ))}
      </div>

      {/* 一括操作 */}
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

      {/* モーダル表示 */}
      {selectedImageIndex !== null && (
        <div className="image-modal-overlay" onClick={handleCloseModal}>
          <div className="image-modal-content" onClick={(e) => e.stopPropagation()}>
            <button 
              className="modal-close-button"
              onClick={handleCloseModal}
            >
              ×
            </button>
            <ImageDisplay 
              image={images[selectedImageIndex]} 
              onRegenerate={onRegenerate}
              className="modal-image-display"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiImageDisplay;