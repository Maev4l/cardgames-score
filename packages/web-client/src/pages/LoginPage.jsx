import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Hub } from 'aws-amplify/utils';
import { signIn, signInWithGoogle, isAuthenticated } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Card suit SVG icons
const SuitSpade = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2C8 6 4 9.5 4 13c0 2.5 2 4.5 4.5 4.5 1.5 0 2.8-.7 3.5-1.8v4.3h-2v2h8v-2h-2v-4.3c.7 1.1 2 1.8 3.5 1.8 2.5 0 4.5-2 4.5-4.5 0-3.5-4-7-8-11z"/>
  </svg>
);

const SuitHeart = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const SuitDiamond = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2L2 12l10 10 10-10L12 2z"/>
  </svg>
);

const SuitClub = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2c-1.93 0-3.5 1.57-3.5 3.5 0 .89.33 1.7.88 2.32C7.34 8.13 6 9.64 6 11.5c0 2.21 1.79 4 4 4 .73 0 1.41-.2 2-.54v5.04h-2v2h8v-2h-2v-5.04c.59.34 1.27.54 2 .54 2.21 0 4-1.79 4-4 0-1.86-1.34-3.37-3.38-3.68.55-.62.88-1.43.88-2.32C19.5 3.57 17.93 2 16 2c-1.46 0-2.73.88-3.28 2.14-.08-.01-.15-.01-.22 0-.08-.01-.15-.01-.22 0C11.73 2.88 10.46 2 9 2z"/>
  </svg>
);

// Google icon
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Check if error is "not approved" and redirect, otherwise return message
  const handleAuthError = useCallback((message) => {
    if (!message) return 'Authentication failed';
    if (message.toLowerCase().includes('not approved')) {
      navigate('/pending-approval');
      return null;
    }
    return message;
  }, [navigate]);

  // Check for OAuth errors in URL (returned from Cognito)
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const errorDesc = searchParams.get('error_description');

    if (errorParam || errorDesc) {
      const errorMsg = handleAuthError(errorDesc || errorParam);
      if (errorMsg) setError(errorMsg);
      setSearchParams({});
    }

    // Also check hash fragment for errors
    const hash = window.location.hash;
    if (hash.includes('error')) {
      const hashParams = new URLSearchParams(hash.substring(1));
      const hashError = hashParams.get('error_description') || hashParams.get('error');
      if (hashError) {
        const errorMsg = handleAuthError(hashError);
        if (errorMsg) setError(errorMsg);
        window.location.hash = '';
      }
    }
  }, [searchParams, setSearchParams, handleAuthError]);

  // Listen for Amplify auth events
  useEffect(() => {
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signInWithRedirect_failure') {
        const message = payload.data?.error?.message || payload.data?.message || 'Sign in failed';
        const errorMsg = handleAuthError(message);
        if (errorMsg) setError(errorMsg);
      }
      if (payload.event === 'signInWithRedirect') {
        navigate('/home');
      }
    });

    return unsubscribe;
  }, [navigate, handleAuthError]);

  // Check if already authenticated on mount
  useEffect(() => {
    isAuthenticated().then((authenticated) => {
      if (authenticated) {
        navigate('/home');
      }
    });
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await signIn(email, password);
      navigate('/home');
    } catch (err) {
      // Handle specific Cognito error codes
      const errorMessage = {
        'UserNotFoundException': 'No account found with this email',
        'NotAuthorizedException': 'Incorrect email or password',
        'UserNotConfirmedException': 'Please verify your email first',
        'NewPasswordRequired': 'Please set a new password',
      }[err.code] || err.message || 'An error occurred during sign in';

      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    signInWithGoogle();
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-felt">
      {/* Floating card suits background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[10%] left-[5%] text-gold/10 scale-[3] rotate-12 animate-float-slow">
          <SuitSpade />
        </div>
        <div className="absolute top-[20%] right-[10%] text-ruby/10 scale-[4] -rotate-12 animate-float-medium">
          <SuitHeart />
        </div>
        <div className="absolute bottom-[15%] left-[15%] text-ruby/10 scale-[3.5] rotate-45 animate-float-fast">
          <SuitDiamond />
        </div>
        <div className="absolute bottom-[25%] right-[8%] text-gold/10 scale-[3] -rotate-6 animate-float-slow">
          <SuitClub />
        </div>
        <div className="absolute top-[50%] left-[3%] text-gold/8 scale-[2] rotate-30 animate-float-medium">
          <SuitHeart />
        </div>
        <div className="absolute top-[60%] right-[5%] text-ruby/8 scale-[2.5] -rotate-20 animate-float-fast">
          <SuitSpade />
        </div>
      </div>

      {/* Login card */}
      <Card className="w-full max-w-md bg-ivory/95 backdrop-blur-sm border-gold/30 shadow-2xl relative z-10">
        <CardHeader className="text-center space-y-2 pb-2">
          {/* Logo / Title */}
          <div className="flex justify-center items-center gap-2 mb-2">
            <span className="text-ruby"><SuitHeart /></span>
            <span className="text-charcoal"><SuitSpade /></span>
            <span className="text-ruby"><SuitDiamond /></span>
            <span className="text-charcoal"><SuitClub /></span>
          </div>
          <CardTitle className="font-display text-3xl text-charcoal tracking-tight">
            Atout
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Google Sign In */}
          <Button
            variant="outline"
            className="w-full h-12 bg-white hover:bg-gray-50 border-gray-200 text-charcoal font-medium gap-3"
            onClick={handleGoogleSignIn}
          >
            <GoogleIcon />
            Continue with Google
          </Button>

          <div className="relative">
            <Separator className="bg-charcoal/20" />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#ebe6de] px-3 text-sm text-charcoal/50 font-sans">
              or
            </span>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-md bg-ruby/10 border border-ruby/30 text-ruby text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-charcoal font-medium">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 bg-white border-charcoal/20 focus:border-gold focus:ring-gold/30 placeholder:text-charcoal/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-charcoal font-medium">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 bg-white border-charcoal/20 focus:border-gold focus:ring-gold/30 placeholder:text-charcoal/40"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-felt hover:bg-felt-dark text-ivory font-medium text-base transition-all"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-sm text-charcoal/60">
            Don't have an account?{' '}
            <Link
              to="/signup"
              className="text-gold hover:text-gold/80 font-medium transition-colors"
            >
              Create account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default LoginPage;
