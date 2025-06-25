import { useState, useEffect } from "react";
import { InitPage } from "./pages/InitPage";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";
import { AuthUtils } from "./lib/auth";

type AppState = 'loading' | 'init' | 'login' | 'dashboard';

function App() {
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    document.documentElement.classList.add('dark');
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      // 如果已经有token，直接尝试访问需要认证的API
      if (AuthUtils.isLoggedIn()) {
        const response = await AuthUtils.authFetch('/api/config');
        if (response.ok) {
          setAppState('dashboard');
          return;
        }
      }
      
      // 检查系统是否已初始化
      const response = await fetch('/api/config');
      if (response.ok) {
        const data = await response.json();
        if (data.initialized) {
          setAppState('login');
        } else {
          setAppState('init');
        }
      } else if (response.status === 404) {
        setAppState('init');
      }
    } catch (error) {
      console.error('Failed to check system status:', error);
      setAppState('init');
    }
  };

  const handleInit = () => {
    setAppState('login');
  };

  const handleLogin = () => {
    setAppState('dashboard');
  };

  if (appState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">加载中...</div>
      </div>
    );
  }

  if (appState === 'init') {
    return <InitPage onInit={handleInit} />;
  }

  if (appState === 'login') {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <Dashboard />;
}

export default App;
