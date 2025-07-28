import React from 'react';
import { IoDocumentTextOutline } from 'react-icons/io5';
import type { Message } from '../../types/chat';
import LazyImage from './LazyImage';

interface AttachmentDisplayProps {
  attachment: Message['attachment'];
}

const AttachmentDisplay: React.FC<AttachmentDisplayProps> = ({ attachment }) => {
  if (!attachment) return null;

  // fileTypeの安全チェック
  const fileType = attachment.fileType || '';
  const fileName = attachment.fileName || 'Unknown file';
  
  if (fileType.startsWith('image/')) {
    // 読み込み中の場合
    if (attachment.isLoading) {
      return (
        <div className="attachment-file" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: '#f0f8ff',
          maxWidth: '300px'
        }}>
          <div style={{ fontSize: '24px', marginRight: '12px' }}>⏳</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {fileName}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {attachment.note || '画像を読み込み中...'}
            </div>
          </div>
        </div>
      );
    }
    
    // 画像データがない場合の処理
    if (!attachment.data && !attachment.displayUrl && !attachment.fileUrl) {
      return (
        <div className="attachment-file" style={{
          display: 'flex',
          alignItems: 'center',
          padding: '12px',
          border: '1px solid #ddd',
          borderRadius: '8px',
          backgroundColor: attachment.s3Key ? '#e3f2fd' : '#fff3cd',
          maxWidth: '300px'
        }}>
          <div style={{ fontSize: '24px', marginRight: '12px' }}>🖼️</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '14px' }}>
              {fileName}
            </div>
            <div style={{ fontSize: '12px', color: '#666' }}>
              {attachment.size && `${Math.round(attachment.size / 1024)}KB`}
              <br />
              {attachment.note ? (
                <small style={{ color: '#f57c00' }}>{attachment.note}</small>
              ) : (
                <small style={{ color: '#856404' }}>※ 履歴では画像を表示できません</small>
              )}
            </div>
          </div>
        </div>
      );
    }
    
    // 画像データがある場合は表示
    return (
      <LazyImage 
        base64Data={attachment.data}
        displayUrl={attachment.displayUrl || attachment.fileUrl}
        mimeType={fileType}
        fileName={fileName}
        size={attachment.size}
      />
    );
  } else {
    // その他のファイルの場合
    return (
      <div className="attachment-file" style={{
        display: 'flex',
        alignItems: 'center',
        padding: '12px',
        border: '1px solid #ddd',
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        maxWidth: '300px'
      }}>
        <div className="attachment-file-icon" style={{ fontSize: '24px', marginRight: '12px' }}>
          <IoDocumentTextOutline />
        </div>
        <div>
          <div className="attachment-file-name" style={{ fontWeight: 'bold', fontSize: '14px' }}>
            {fileName}
          </div>
          <div style={{ fontSize: '12px', color: '#666' }}>
            {attachment.size && `${Math.round(attachment.size / 1024)}KB`}
            {attachment.note && (
              <>
                <br />
                <small style={{ color: '#856404' }}>{attachment.note}</small>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
};

export default AttachmentDisplay;