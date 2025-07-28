// src/components/features/ImageDisplay.tsx
import React, { useState } from 'react';
import { LuDownload, LuCopy, LuInfo, LuRefreshCw } from 'react-icons/lu';
import type { GeneratedImage } from '../../types/image';

interface ImageDisplayProps {
  image: GeneratedImage;
  onRegenerate?: (seed: number) => void;
  className?: string;
}

const ImageDisplay: React.FC<ImageDisplayProps> = ({
  image,
  onRegenerate,
  className = ''
}) => {
  const [copiedInfo, setCopiedInfo] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleDownload = () => {
    try {
      const link = document.createElement('a');
      link.href = `data:image/png;base64,${image.base64}`;
      
      const filename = `generated_${image.seed}_${new Date().getTime()}.png`;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('ダウンロードエラー:', error);
      alert('ダウンロードに失敗しました');
    }
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedInfo(type);
      setTimeout(() => setCopiedInfo(null), 2000);
    } catch (error) {
      console.error('コピーエラー:', error);
      alert('コピーに失敗しました');
    }
  };

  const handleRegenerate = () => {
    if (onRegenerate) {
      onRegenerate(image.seed);
    }
  };

  return (
    <div className={`image-display ${className}`}>
      {/* 画像本体 */}
      <div className="image-container">
        <img
          src={`data:image/png;base64,${image.base64}`}
          alt={image.prompt}
          className="generated-image"
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }}
        />
        
        {/* オーバーレイアクション */}
        <div className="image-overlay">
          <div className="image-actions">
            <button
              onClick={handleDownload}
              className="action-button download"
              title="ダウンロード"
            >
              <LuDownload />
            </button>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="action-button info"
              title="詳細情報"
            >
              <LuInfo />
            </button>
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                className="action-button regenerate"
                title="同じシードで再生成"
              >
                <LuRefreshCw />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 詳細情報 */}
      {showDetails && (
        <div className="image-details">
          <div className="detail-group">
            <div className="detail-label">プロンプト</div>
            <div className="detail-content">
              <span className="detail-text">{image.prompt}</span>
              <button
                onClick={() => handleCopy(image.prompt, 'prompt')}
                className="copy-button"
                title="プロンプトをコピー"
              >
                {copiedInfo === 'prompt' ? '✓' : <LuCopy />}
              </button>
            </div>
          </div>

          {image.negativePrompt && (
            <div className="detail-group">
              <div className="detail-label">ネガティブプロンプト</div>
              <div className="detail-content">
                <span className="detail-text">{image.negativePrompt}</span>
                <button
                  onClick={() => handleCopy(image.negativePrompt, 'negative')}
                  className="copy-button"
                  title="ネガティブプロンプトをコピー"
                >
                  {copiedInfo === 'negative' ? '✓' : <LuCopy />}
                </button>
              </div>
            </div>
          )}

          <div className="detail-row">
            <div className="detail-group">
              <div className="detail-label">サイズ</div>
              <div className="detail-value">{image.width} × {image.height}</div>
            </div>
            <div className="detail-group">
              <div className="detail-label">シード</div>
              <div className="detail-content">
                <span className="detail-value">{image.seed}</span>
                <button
                  onClick={() => handleCopy(image.seed.toString(), 'seed')}
                  className="copy-button"
                  title="シードをコピー"
                >
                  {copiedInfo === 'seed' ? '✓' : <LuCopy />}
                </button>
              </div>
            </div>
          </div>

          <div className="detail-group">
            <div className="detail-label">生成日時</div>
            <div className="detail-value">
              {new Date(image.generatedAt).toLocaleString('ja-JP')}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImageDisplay;