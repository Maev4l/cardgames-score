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

// Preserve query params when redirecting to login
const RedirectToLogin = () => {
  const location = useLocation();
  return <Navigate to={`/login${location.search}`} replace />;
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
        <Route path="/" element={<RedirectToLogin />} />
      </Routes>
      <PWAUpdatePrompt />
    </BrowserRouter>
  );
};

export default App;
