import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import ChatPage from './pages/ChatPage';
import './App.css';

function App() {
  const auth = useAuth();

  if (auth.isLoading) { 
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>読み込み中...</p>
      </div>
    );
  }

  if (auth.error) { 
    return <div className="error-container">エラー: {auth.error.message}</div>; 
  }

  // 認証されていない場合
  if (!auth.isAuthenticated) {
    // URLにcodeパラメータがない場合のみリダイレクト（ループ防止）
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    
    if (!code && !error) {
      auth.signinRedirect();
      return (
        <div className="loading-container">
          <div className="spinner"></div>
          <p>認証ページへリダイレクトしています...</p>
        </div>
      );
    }
    
    // エラーがある場合
    if (error) {
      return <div className="error-container">認証エラー: {error}</div>;
    }
    
    // codeがあるが認証が完了していない場合
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>認証処理中...</p>
      </div>
    );
  }

  // 認証済みの場合
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/chat" element={<ChatPage />} />
      </Routes>
    </Router>
  );
}

export default App;