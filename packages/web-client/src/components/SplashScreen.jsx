// Splash screen shown on app startup to avoid login screen flash
// Displays for minimum 3s while checking authentication in background
import { useState, useEffect } from 'react';
import { isAuthenticated } from '@/lib/auth';

const SplashScreen = ({ onComplete }) => {
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Minimum display time ensures smooth UX
    const minDisplayTime = new Promise(resolve => setTimeout(resolve, 3000));
    const authCheck = isAuthenticated();

    // Wait for both auth check and minimum display time
    Promise.all([authCheck, minDisplayTime]).then(([isAuth]) => {
      setFadeOut(true);
      // Allow fade animation to complete before callback
      setTimeout(() => onComplete(isAuth), 300);
    });
  }, [onComplete]);

  return (
    <div
      className={`fixed inset-0 bg-felt flex flex-col items-center justify-center z-50 transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Logo */}
      <img
        src="/icon.svg"
        alt="Atout"
        className="size-24 mb-6 animate-pulse"
      />

      {/* App name */}
      <h1 className="font-display text-4xl text-ivory mb-2">Atout</h1>
      <p className="text-ivory/50 text-sm">Card Game Scoring</p>

      {/* Loading indicator */}
      <div className="mt-8 flex gap-1">
        <div className="size-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="size-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="size-2 rounded-full bg-gold animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export default SplashScreen;
