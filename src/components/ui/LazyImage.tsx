import React, { useState, useEffect } from 'react';

interface LazyImageProps {
  base64Data?: string;
  displayUrl?: string;
  mimeType: string;
  fileName: string;
  size?: number;
}

const LazyImage: React.FC<LazyImageProps> = ({ 
  base64Data, 
  displayUrl, 
  mimeType, 
  fileName, 
  size 
}) => {
  const [imageUrl, setImageUrl] = useState<string>();
  const [hasError, setHasError] = useState(false);
  
  // 安全なファイル名とMIMEタイプ
  const safeMimeType = mimeType || 'image/jpeg';
  const safeFileName = fileName || 'image';
  
  // コンポーネントマウント時に即座に画像URLを設定
  useEffect(() => {
    try {
      // 表示URLまたはBase64データから画像URLを生成
      let url = displayUrl;
      if (!url && base64Data) {
        url = `data:${safeMimeType};base64,${base64Data}`;
      }
      
      if (url) {
        setImageUrl(url);
      } else {
        setHasError(true);
      }
    } catch (error) {
      console.error('画像読み込みエラー:', error);
      setHasError(true);
    }
  }, [base64Data, displayUrl, safeMimeType]);
  
  if (hasError) {
    return (
      <div className="broken-image" style={{ 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        color: '#999',
        textAlign: 'center'
      }}>
        ❌ 画像を表示できません<br />
        <small>{safeFileName}</small>
      </div>
    );
  }
  
  if (!imageUrl) {
    return null; // 読み込み中は何も表示しない
  }
  
  return (
    <div className="image-attachment">
      <div>
        <img 
          src={imageUrl} 
          alt={safeFileName}
          className="attachment-image"
          style={{ 
            maxWidth: '300px', 
            maxHeight: '200px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onError={() => setHasError(true)}
        />
        {size && (
          <div className="image-info" style={{ 
            fontSize: '12px', 
            color: '#666', 
            marginTop: '4px' 
          }}>
            {safeFileName} ({Math.round(size / 1024)}KB)
          </div>
        )}
      </div>
    </div>
  );
};

export default LazyImage;