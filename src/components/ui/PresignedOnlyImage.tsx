// src/components/ui/PresignedOnlyImage.tsx - クリーン版
import React, { useState, useCallback } from 'react';
import { usePresignedUrl } from '../../hooks/usePresignedUrl';

interface PresignedOnlyImageProps {
  s3Key?: string;
  presignedUrl?: string;    // 初期URL
  expiresAt?: number;       // 初期期限
  mimeType: string;
  fileName: string;
  size?: number;
  className?: string;
}

const PresignedOnlyImage: React.FC<PresignedOnlyImageProps> = ({
  s3Key,
  presignedUrl: initialPresignedUrl,
  expiresAt: initialExpiresAt,
  mimeType,
  fileName,
  size,
  className = ''
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  const safeFileName = fileName || 'image';
  
  // 🎯 Presigned URL自動管理
  const {
    presignedUrl,
    isLoading,
    error,
    expiresAt,
    isExpiringSoon,
    isValid,
    refreshUrl,
    retry
  } = usePresignedUrl(s3Key || null, initialPresignedUrl, initialExpiresAt);
  
  // 🖼️ 画像読み込み成功
  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
    setImageError(false);
    console.log('画像表示成功:', {
      fileName: safeFileName,
      s3Key,
      isExpiringSoon,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    });
  }, [safeFileName, s3Key, isExpiringSoon, expiresAt]);
  
  // 🚨 画像読み込みエラー
  const handleImageError = useCallback(async () => {
    console.warn('画像読み込みエラー:', {
      src: presignedUrl,
      fileName: safeFileName,
      s3Key,
      isValid: isValid,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
    });
    
    setImageError(true);
    
    // 期限切れの可能性がある場合は自動で再試行
    if (s3Key && (!isValid || isExpiringSoon)) {
      console.log('期限切れの可能性により自動再試行:', safeFileName);
      try {
        await refreshUrl();
        // 新しいURLで再試行
        setImageError(false);
      } catch (refreshError) {
        console.error('自動再試行も失敗:', refreshError);
      }
    }
  }, [presignedUrl, safeFileName, s3Key, isValid, isExpiringSoon, expiresAt, refreshUrl]);
  
  // 🔄 手動再試行
  const handleManualRetry = useCallback(() => {
    setImageError(false);
    setImageLoaded(false);
    if (error) {
      retry();
    } else {
      refreshUrl();
    }
  }, [error, retry, refreshUrl]);
  
  // 📅 期限表示用
  const formatExpiryTime = useCallback(() => {
    if (!expiresAt) return null;
    const now = Date.now();
    const timeLeft = expiresAt - now;
    
    if (timeLeft < 0) return '期限切れ';
    if (timeLeft < 60000) return '1分以内に期限切れ';
    if (timeLeft < 3600000) return `${Math.round(timeLeft / 60000)}分後に期限切れ`;
    return `${Math.round(timeLeft / 3600000)}時間後に期限切れ`;
  }, [expiresAt]);
  
  // 🔄 ローディング状態
    if (isLoading && !presignedUrl) {
    return (
        <div className={`image-loading ${className}`} style={{ 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        color: '#666',
        textAlign: 'center',
        backgroundColor: '#f9f9f9'
        }}>
        </div>
    );
    }
  
  // ❌ エラー状態
  if (error && !presignedUrl) {
    return (
      <div className={`broken-image ${className}`} style={{ 
        padding: '20px', 
        border: '1px solid #ddd', 
        borderRadius: '8px',
        color: '#999',
        textAlign: 'center',
        backgroundColor: '#fff5f5'
      }}>
        <div style={{ marginBottom: '8px' }}>❌</div>
        Presigned URL生成に失敗<br />
        <small>{safeFileName}</small>
        <br />
        <button 
          onClick={handleManualRetry}
          style={{
            marginTop: '8px',
            padding: '4px 8px',
            fontSize: '12px',
            backgroundColor: '#e2e8f0',
            border: '1px solid #cbd5e0',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          🔄 再試行
        </button>
        <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
          エラー: {error}
        </div>
      </div>
    );
  }
  
  // 🚫 URLなし
  if (!presignedUrl) {
    return null;
  }
  
  return (
    <div className={`presigned-image-container ${className}`}>
      {/* 🖼️ メイン画像 */}
      <div className="image-wrapper" style={{ position: 'relative' }}>
        <img 
          src={presignedUrl} 
          alt={safeFileName}
          className="attachment-image"
          style={{ 
            maxWidth: '300px', 
            maxHeight: '200px',
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            display: imageError ? 'none' : 'block'
          }}
          onLoad={handleImageLoad}
          onError={handleImageError}
          data-s3-key={s3Key} // 自動更新時の識別用
        />
        
        {/* 期限切れ警告 */}
        {isExpiringSoon && imageLoaded && (
          <div style={{
            position: 'absolute',
            top: '4px',
            right: '4px',
            background: 'rgba(255, 193, 7, 0.9)',
            color: '#856404',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            ⏰ {formatExpiryTime()}
          </div>
        )}
        
        {/* 更新中インジケーター */}
        {isLoading && presignedUrl && (
          <div style={{
            position: 'absolute',
            top: '4px',
            left: '4px',
            background: 'rgba(33, 150, 243, 0.9)',
            color: 'white',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            fontWeight: 'bold'
          }}>
            🔄 更新中
          </div>
        )}
      </div>
      
      {/* 🚨 画像エラー表示 */}
      {imageError && (
        <div style={{ 
          padding: '20px', 
          border: '1px solid #ddd', 
          borderRadius: '8px',
          color: '#999',
          textAlign: 'center',
          backgroundColor: '#fff5f5'
        }}>
          <div style={{ marginBottom: '8px' }}>❌</div>
          画像を表示できません<br />
          <small>{safeFileName}</small>
          <br />
          <button 
            onClick={handleManualRetry}
            style={{
              marginTop: '8px',
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: '#e2e8f0',
              border: '1px solid #cbd5e0',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            🔄 再読み込み
          </button>
        </div>
      )}
      
      {/* 📋 ファイル情報 */}
      {size && imageLoaded && (
        <div className="image-info" style={{ 
          fontSize: '12px', 
          color: '#666', 
          marginTop: '4px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{safeFileName} ({Math.round(size / 1024)}KB)</span>
        </div>
      )}
    </div>
  );
};

export default PresignedOnlyImage;