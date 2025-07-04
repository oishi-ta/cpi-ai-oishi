import React, { createContext, useContext, useState, useEffect } from 'react';

interface User {
  email?: string;
  id_token?: string;
  profile: {
    email?: string;
  };
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  error: Error | null;
  signinRedirect: () => void;
  removeUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const cognitoDomain = import.meta.env.VITE_APP_COGNITO_DOMAIN;
  const clientId = import.meta.env.VITE_APP_COGNITO_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_APP_REDIRECT_URI;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // URLからコードパラメータをチェック
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        
        if (code) {
          // 認証コードが存在する場合、トークンを取得
          const tokenResponse = await exchangeCodeForToken(code);
          if (tokenResponse) {
            const userInfo = decodeIdToken(tokenResponse.id_token);
            const userData: User = {
              email: userInfo.email,
              id_token: tokenResponse.id_token,
              profile: {
                email: userInfo.email
              }
            };
            
            sessionStorage.setItem('user', JSON.stringify(userData));
            setUser(userData);
            setIsAuthenticated(true);
            
            // URLからクエリパラメータを削除
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        } else {
          // セッションストレージから認証情報を確認
          const storedUser = sessionStorage.getItem('user');
          if (storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            setIsAuthenticated(true);
          }
        }
      } catch (err) {
        console.error('認証チェックエラー:', err);
        setError(err as Error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const exchangeCodeForToken = async (code: string) => {
    try {
      const tokenEndpoint = `${cognitoDomain}/oauth2/token`;
      
      // PKCE対応の場合、code_verifierが必要
      // 今回はpublicクライアントとして実装
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code: code,
        redirect_uri: redirectUri,
      });

      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('トークン取得エラーレスポンス:', errorData);
        throw new Error('トークン取得に失敗しました');
      }

      return await response.json();
    } catch (error) {
      console.error('トークン交換エラー:', error);
      return null;
    }
  };

  const decodeIdToken = (idToken: string) => {
    try {
      const base64Url = idToken.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('IDトークンのデコードエラー:', error);
      return {};
    }
  };

  const signinRedirect = () => {
    const loginUrl = `${cognitoDomain}/oauth2/authorize?` +
      `response_type=code&` +
      `client_id=${clientId}&` +
      `redirect_uri=${encodeURIComponent(redirectUri)}&` +
      `scope=email+openid+phone`;
    
    window.location.href = loginUrl;
  };

  const removeUser = async () => {
    sessionStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      isLoading,
      user,
      error,
      signinRedirect,
      removeUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};