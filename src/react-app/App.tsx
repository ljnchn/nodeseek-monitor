import { useState, useEffect } from "react";
import { InitPage } from "./pages/InitPage";
import { LoginPage } from "./pages/LoginPage";
import { Dashboard } from "./pages/Dashboard";

type AppState = 'loading' | 'init' | 'login' | 'dashboard';

function App() {
  const [appState, setAppState] = useState<AppState>('loading');

  useEffect(() => {
    document.documentElement.classList.add('dark');
    checkSystemStatus();
  }, []);

  const checkSystemStatus = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        setAppState('login');
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
