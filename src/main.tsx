import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from "react-oidc-context";
import type { User } from "oidc-client-ts";

const cognitoAuthConfig = {
  // Cognitoユーザープールのドメイン
  authority: "https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_LuvUmWDZ4",
  // アプリケーションクライアントID
  client_id: "1io057uu2e3jobtl0rsggpc3js",
  // アプリケーションのコールバックURL
  redirect_uri: import.meta.env.VITE_APP_REDIRECT_URI,
  response_type: "code",
  // 許可するスコープ
  scope: "email openid phone",
  //日本語対応
  extraQueryParams: {
    lang: "ja"
  }
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