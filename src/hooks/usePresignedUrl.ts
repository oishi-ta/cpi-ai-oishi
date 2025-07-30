// src/hooks/usePresignedUrl.ts - 自動更新機能付きHook
import { useState, useEffect, useCallback, useRef } from 'react';
import { fileApi } from '../services/fileApi';
import { getErrorMessage } from '../utils/errorUtils';

export const usePresignedUrl = (
  s3Key: string | null, 
  initialUrl?: string, 
  initialExpiresAt?: number
) => {
  const [presignedUrl, setPresignedUrl] = useState<string | null>(initialUrl || null);
  const [isLoading, setIsLoading] = useState(!initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number | null>(initialExpiresAt || null);
  
  const refreshTimerRef = useRef<number | null>(null);
  const isRefreshingRef = useRef(false);
  
  // 🔄 Presigned URL更新関数
  const refreshUrl = useCallback(async (force = false) => {
    if (!s3Key) return;
    if (isRefreshingRef.current && !force) return; // 重複実行防止
    
    try {
      isRefreshingRef.current = true;
      setIsLoading(true);
      setError(null);
      
      console.log('Presigned URL更新開始:', { s3Key, force });
      
      const response = await fileApi.getChatAttachmentPresignedUrl(s3Key);
      
      setPresignedUrl(response.presignedUrl);
      setExpiresAt(response.expiresAt);
      
      console.log('Presigned URL更新完了:', {
        s3Key,
        expiresAt: new Date(response.expiresAt).toISOString()
      });
      
    } catch (err) {
      const errorMessage = getErrorMessage(err);
      console.error('Presigned URL更新エラー:', { s3Key, error: errorMessage });
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      isRefreshingRef.current = false;
    }
  }, [s3Key]);
  
  // 🕐 自動更新タイマー設定
  const scheduleRefresh = useCallback((targetExpiresAt: number) => {
    // 既存タイマーをクリア
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    
    const now = Date.now();
    const timeUntilExpiry = targetExpiresAt - now;
    const refreshBuffer = 10 * 60 * 1000; // 10分前
    const refreshTime = Math.max(timeUntilExpiry - refreshBuffer, 1000); // 最短1秒
    
    if (refreshTime > 0 && refreshTime < 24 * 60 * 60 * 1000) { // 24時間以内
      console.log('自動更新タイマー設定:', {
        s3Key,
        refreshTime: Math.round(refreshTime / 1000) + '秒後',
        expiresAt: new Date(targetExpiresAt).toISOString()
      });
      
      refreshTimerRef.current = window.setTimeout(() => {
        console.log('自動更新実行:', s3Key);
        refreshUrl(true);
      }, refreshTime);
    }
  }, [s3Key, refreshUrl]);
  
  // 初期化とタイマー設定
  useEffect(() => {
    if (!s3Key) return;
    
    if (!presignedUrl) {
      // 初回URL取得
      refreshUrl();
    } else if (expiresAt) {
      // 既存URLの自動更新設定
      scheduleRefresh(expiresAt);
    }
    
    // クリーンアップ
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [s3Key, presignedUrl, expiresAt, refreshUrl, scheduleRefresh]);
  
  // expiresAtが更新された時の自動更新設定
  useEffect(() => {
    if (expiresAt) {
      scheduleRefresh(expiresAt);
    }
  }, [expiresAt, scheduleRefresh]);
  
  // ⚡ 期限切れ直前チェック
  const isExpiringSoon = useCallback(() => {
    if (!expiresAt) return false;
    const now = Date.now();
    const bufferTime = 5 * 60 * 1000; // 5分
    return (expiresAt - now) < bufferTime;
  }, [expiresAt]);
  
  // 🔄 手動更新（エラー時の再試行用）
  const retry = useCallback(() => {
    setError(null);
    refreshUrl(true);
  }, [refreshUrl]);
  
  // 📊 URL有効性チェック
  const isValid = useCallback(() => {
    if (!presignedUrl || !expiresAt) return false;
    return Date.now() < expiresAt;
  }, [presignedUrl, expiresAt]);
  
  return {
    presignedUrl,
    isLoading,
    error,
    expiresAt,
    isExpiringSoon: isExpiringSoon(),
    isValid: isValid(),
    refreshUrl: () => refreshUrl(true),
    retry
  };
};