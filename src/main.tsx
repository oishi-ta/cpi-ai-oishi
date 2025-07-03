import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AuthProvider } from "react-oidc-context";
import type { User } from "oidc-client-ts";

const cognitoAuthConfig = {
  authority: import.meta.env.VITE_APP_COGNITO_AUTHORITY,
  client_id: import.meta.env.VITE_APP_COGNITO_CLIENT_ID,
  redirect_uri: import.meta.env.VITE_APP_REDIRECT_URI,
  response_type: "code",
  scope: "email openid phone",
  extraQueryParams: {
    lang: "ja"
  }
};

const onSigninCallback = (_user: User | void): void => {
  // 認証完了後、URLからクエリパラメータを削除してリロードを防ぐ
  window.history.replaceState({}, document.title, window.location.pathname);
  
  // サインイン完了後にページを更新して状態を確実に初期化
  window.location.reload();
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig} onSigninCallback={onSigninCallback}>
      <App />
    </AuthProvider>
  </React.StrictMode>,
)