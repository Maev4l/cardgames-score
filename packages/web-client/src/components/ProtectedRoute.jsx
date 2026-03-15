import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { isAuthenticated } from '@/lib/auth';

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    isAuthenticated().then((auth) => {
      setAuthenticated(auth);
      setLoading(false);
    });
  }, []);

  if (loading) {
    // Simple loading state with theme colors
    return (
      <div className="min-h-screen flex items-center justify-center bg-felt">
        <div className="text-ivory/60">Loading...</div>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
