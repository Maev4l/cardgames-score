import { useState, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import LoginPage from '@/pages/LoginPage';
import SignupPage from '@/pages/SignupPage';
import HomePage from '@/pages/HomePage';
import PendingApprovalPage from '@/pages/PendingApprovalPage';
import NewGamePage from '@/pages/NewGamePage';
import BeloteSetupPage from '@/pages/belote/SetupPage';
import BeloteGamePage from '@/pages/belote/GamePage';
import TarotSetupPage from '@/pages/tarot/SetupPage';
import ProtectedRoute from '@/components/ProtectedRoute';
import PWAUpdatePrompt from '@/components/PWAUpdatePrompt';
import SplashScreen from '@/components/SplashScreen';

// Initial route handler - shows splash then redirects based on auth
const InitialRoute = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isAuth, setIsAuth] = useState(false);
  const location = useLocation();

  const handleSplashComplete = useCallback((authenticated) => {
    setIsAuth(authenticated);
    setShowSplash(false);
  }, []);

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />;
  }

  // After splash, redirect to home if authenticated, login otherwise
  return <Navigate to={isAuth ? '/home' : `/login${location.search}`} replace />;
};

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/pending-approval" element={<PendingApprovalPage />} />
        <Route path="/home" element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        } />
        <Route path="/new-game" element={
          <ProtectedRoute>
            <NewGamePage />
          </ProtectedRoute>
        } />
        <Route path="/belote/setup" element={
          <ProtectedRoute>
            <BeloteSetupPage />
          </ProtectedRoute>
        } />
        <Route path="/belote/game/:id" element={
          <ProtectedRoute>
            <BeloteGamePage />
          </ProtectedRoute>
        } />
        <Route path="/tarot/setup" element={
          <ProtectedRoute>
            <TarotSetupPage />
          </ProtectedRoute>
        } />
        <Route path="/" element={<InitialRoute />} />
      </Routes>
      <PWAUpdatePrompt />
    </BrowserRouter>
  );
};

export default App;
