// src/components/features/MultiImageDisplay.tsx - 黒背景削除版

import React, { useState } from 'react';
import { LuDownload } from 'react-icons/lu';
import type { GeneratedImage } from '../../types/image';

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
    return (
      <div className={`single-image-display ${className}`}>
        <div className="main-image-container" style={{
          // 🚫 黒い背景を削除
          background: 'transparent',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          maxWidth: '100%',
          width: 'fit-content',
          margin: '0 auto'
        }}>
          <img
            src={`data:image/png;base64,${images[0].base64}`}
            alt={images[0].prompt}
            className="main-generated-image"
            style={{
              width: 'auto',
              height: 'auto',
              maxWidth: '100%',
              maxHeight: '600px',
              display: 'block',
              borderRadius: '12px'
            }}
          />
          
          {/* オーバーレイアクション */}
          <div className="image-overlay" style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            opacity: 0,
            transition: 'opacity 0.3s ease',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: '16px',
            borderRadius: '12px'
          }}>
            <div className="image-actions">
              <button
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = `data:image/png;base64,${images[0].base64}`;
                  link.download = `nova_canvas_${images[0].seed}.png`;
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="action-button download"
                title="ダウンロード"
                style={{
                  width: '40px',
                  height: '40px',
                  background: 'rgba(255,255,255,0.9)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  fontSize: '18px'
                }}
              >
                <LuDownload />
              </button>
            </div>
          </div>
        </div>
        
        {/* 簡潔な情報表示 */}
        <div className="image-simple-info" style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          <div style={{ marginBottom: '4px' }}>
            <strong>シード:</strong> {images[0].seed}
          </div>
          <div style={{ marginBottom: '4px' }}>
            <strong>サイズ:</strong> {images[0].width} × {images[0].height}
          </div>
          <div>
            <strong>生成日時:</strong> {new Date(images[0].generatedAt).toLocaleString('ja-JP')}
          </div>
        </div>
      </div>
    );
  }

  const selectedImage = images[selectedImageIndex];

  return (
    <div className={`multi-image-display ${className}`}>
      {/* メイン画像表示 */}
      <div className="main-image-container" style={{
        // 🚫 黒い背景を削除
        background: 'transparent',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        position: 'relative',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        maxWidth: '100%',
        width: 'fit-content',
        margin: '0 auto'
      }}>
        <img
          src={`data:image/png;base64,${selectedImage.base64}`}
          alt={`${selectedImage.prompt} - ${selectedImageIndex + 1}`}
          className="main-generated-image"
          style={{
            width: 'auto',
            height: 'auto',
            maxWidth: '100%',
            maxHeight: '600px',
            display: 'block',
            borderRadius: '12px'
          }}
        />
        
        {/* オーバーレイアクション */}
        <div className="image-overlay" style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          opacity: 0,
          transition: 'opacity 0.3s ease',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '16px',
          borderRadius: '12px'
        }}>
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
              style={{
                width: '40px',
                height: '40px',
                background: 'rgba(255,255,255,0.9)',
                border: 'none',
                borderRadius: '8px',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontSize: '18px'
              }}
            >
              <LuDownload />
            </button>
          </div>
        </div>
      </div>

      {/* サムネイル一覧 */}
      <div className="thumbnail-container" style={{
        display: 'flex',
        gap: '8px',
        alignItems: 'center',
        justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: '16px'
      }}>
        {images.map((image, index) => (
          <div 
            key={index}
            className={`thumbnail-item ${index === selectedImageIndex ? 'active' : ''}`}
            onClick={() => handleThumbnailClick(index)}
            style={{
              position: 'relative',
              width: '60px',
              height: '60px',
              borderRadius: '8px',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: index === selectedImageIndex ? '2px solid #6366f1' : '2px solid transparent',
              boxShadow: index === selectedImageIndex ? '0 0 0 2px rgba(99, 102, 241, 0.3)' : 'none'
            }}
          >
            <img
              src={`data:image/png;base64,${image.base64}`}
              alt={`${image.prompt} - ${index + 1}`}
              className="thumbnail-image"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block'
              }}
            />
          </div>
        ))}
      </div>

      {/* 一括ダウンロードボタン */}
      <div className="batch-actions" style={{
        display: 'flex',
        justifyContent: 'center',
        padding: '16px 0',
        borderTop: '1px solid #e5e7eb',
        marginTop: '16px'
      }}>
        <button
          onClick={downloadAllImages}
          className="batch-download-button"
          title="すべての画像をダウンロード"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          <LuDownload />
          すべてダウンロード ({images.length}枚)
        </button>
      </div>

      {/* 簡潔な画像詳細情報 */}
      <div className="image-simple-info" style={{
        marginTop: '16px',
        padding: '12px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        fontSize: '12px',
        color: '#666'
      }}>
        <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
          画像 {selectedImageIndex + 1} / {images.length}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>シード:</strong> {selectedImage.seed}
        </div>
        <div style={{ marginBottom: '4px' }}>
          <strong>サイズ:</strong> {selectedImage.width} × {selectedImage.height}
        </div>
        <div>
          <strong>生成日時:</strong> {new Date(selectedImage.generatedAt).toLocaleString('ja-JP')}
        </div>
      </div>
    </div>
  );
};

export default MultiImageDisplay;