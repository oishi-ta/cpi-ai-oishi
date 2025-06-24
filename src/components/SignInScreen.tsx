// src/components/SignInScreen.tsx
import React from 'react';

interface SignInScreenProps {
  onSignIn: () => void;
}

const SignInScreen: React.FC<SignInScreenProps> = ({ onSignIn }) => {
  return (
    <div className="signin-container">
      <h1>CPI社内文書AI</h1>
      <p>利用するにはサインインが必要です。</p>
      <button onClick={onSignIn}>サインイン</button>
    </div>
  );
};

export default SignInScreen;