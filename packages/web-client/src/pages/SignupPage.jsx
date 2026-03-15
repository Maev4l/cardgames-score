import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { signUp } from '@/lib/auth';

// Card suit SVG icons
const SuitHeart = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
  </svg>
);

const SuitSpade = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
    <path d="M12 2C8 6 4 9.5 4 13c0 2.5 2 4.5 4.5 4.5 1.5 0 2.8-.7 3.5-1.8v4.3h-2v2h8v-2h-2v-4.3c.7 1.1 2 1.8 3.5 1.8 2.5 0 4.5-2 4.5-4.5 0-3.5-4-7-8-11z"/>
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

// Password requirements
const passwordRules = [
  { test: (pw) => pw.length >= 8, label: '8+ characters' },
  { test: (pw) => /[a-z]/.test(pw), label: 'Lowercase' },
  { test: (pw) => /[A-Z]/.test(pw), label: 'Uppercase' },
  { test: (pw) => /[0-9]/.test(pw), label: 'Number' },
  { test: (pw) => /[^a-zA-Z0-9]/.test(pw), label: 'Symbol' },
];

const validatePassword = (pw) => {
  for (const rule of passwordRules) {
    if (!rule.test(pw)) return rule.label;
  }
  return null;
};

const SignupPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const passwordValid = password.length > 0 && !validatePassword(password);
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0;
  const displayNameValid = displayName.length === 0 || displayName.length <= 20;
  const canSubmit = email && passwordValid && passwordsMatch && displayNameValid;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, displayName || undefined);
      navigate('/pending-approval');
    } catch (err) {
      if (err.name === 'UsernameExistsException') {
        setError('An account with this email already exists');
      } else if (err.name === 'InvalidParameterException') {
        setError(err.message || 'Invalid input');
      } else {
        setError(err.message || 'Sign up failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-felt">
      <Card className="w-full max-w-md bg-ivory/95 backdrop-blur-sm border-gold/30 shadow-2xl">
        <CardHeader className="text-center space-y-2 pb-2">
          <div className="flex justify-center items-center gap-2 mb-2">
            <span className="text-ruby"><SuitHeart /></span>
            <span className="text-charcoal"><SuitSpade /></span>
            <span className="text-ruby"><SuitDiamond /></span>
            <span className="text-charcoal"><SuitClub /></span>
          </div>
          <CardTitle className="font-display text-3xl text-charcoal tracking-tight">
            Create Account
          </CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
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
                autoComplete="email"
                required
                className="h-12 bg-white border-charcoal/20 focus:border-gold focus:ring-gold/30 placeholder:text-charcoal/40"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="displayName" className="text-charcoal font-medium">
                  Display Name
                </Label>
                <span className={`text-xs text-charcoal/50 ${displayName.length === 0 ? 'invisible' : ''}`}>
                  {displayName.length}/20
                </span>
              </div>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={20}
                placeholder="Optional"
                className="h-12 bg-white border-charcoal/20 focus:border-gold focus:ring-gold/30 placeholder:text-charcoal/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-charcoal font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="h-12 bg-white border-charcoal/20 focus:border-gold focus:ring-gold/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-charcoal"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {passwordRules.map((rule) => (
                  <span
                    key={rule.label}
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      rule.test(password)
                        ? 'bg-felt/20 text-felt'
                        : 'bg-charcoal/10 text-charcoal/50'
                    }`}
                  >
                    {rule.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-charcoal font-medium">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  className="h-12 bg-white border-charcoal/20 focus:border-gold focus:ring-gold/30 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-charcoal/50 hover:text-charcoal"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <p className={`text-xs text-ruby ${confirmPassword.length === 0 || passwordsMatch ? 'invisible' : ''}`}>
                Passwords do not match
              </p>
            </div>

            <Button
              type="submit"
              className="w-full h-12 bg-felt hover:bg-felt-dark text-ivory font-medium text-base transition-all"
              disabled={!canSubmit || submitting}
            >
              {submitting ? 'Creating account...' : 'Create Account'}
            </Button>

            <p className="text-center text-sm text-charcoal/60">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-gold hover:text-gold/80 font-medium transition-colors"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </form>
      </Card>
    </div>
  );
};

export default SignupPage;
