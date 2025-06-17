import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from "react-oidc-context";
import type { User } from "oidc-client-ts";

const cognitoAuthConfig = {
  // Cognitoユーザープールのドメイン
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_baatQB5CY",
  // アプリケーションクライアントID
  client_id: "370ul24957c9akfm11j1eelooj",
  // アプリケーションのコールバックURL
  redirect_uri: import.meta.env.VITE_APP_REDIRECT_URI,
  response_type: "code",
  // 許可するスコープ
  scope: "email openid phone",
};

const onSigninCallback = (_user: User | void): void => {
  // 認証完了後、URLからクエリパラメータを削除してリロードを防ぐ
  window.history.replaceState({}, document.title, window.location.pathname);
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)