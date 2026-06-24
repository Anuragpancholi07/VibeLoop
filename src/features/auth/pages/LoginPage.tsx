import { useState } from 'react';
import { useAuth } from '../AuthContext';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, ArrowLeft, Loader2 } from 'lucide-react';

type AuthMode = 'select' | 'email' | 'phone' | 'otp';

export function LoginPage() {
  const { t } = useTranslation();
  const { signInWithEmail, signInWithPhone, verifyOtp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>('select');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpType, setOtpType] = useState<'email' | 'phone'>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const getErrorMessage = (err: any, defaultMsg: string) => {
    console.error('Auth error:', err);
    if (!err) return defaultMsg;
    if (typeof err === 'string') return err;
    if (err.error_description) return err.error_description;
    if (err.error?.message) return err.error.message;
    if (err.message) {
      if (err.message === '{}' || err.message === 'Internal Server Error' || err.message.includes('Database error')) {
        return 'Database or SMTP Configuration Error: Please ensure you ran 001_initial_schema.sql on Supabase and configured your Auth settings.';
      }
      return err.message;
    }
    const str = JSON.stringify(err);
    if (str === '{}') {
      return 'Connection/Database Error: Ensure you have run your Supabase initial schema and your internet connection is active.';
    }
    return str;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await signInWithEmail(email);
      setOtpType('email');
      setMode('otp');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await signInWithPhone(phone);
      setOtpType('phone');
      setMode('otp');
    } catch (err: any) {
      setError(getErrorMessage(err, 'Failed to send OTP'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await verifyOtp(otp, otpType);
    } catch (err: any) {
      setError(getErrorMessage(err, 'Invalid OTP'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(getErrorMessage(err, 'Google login failed'));
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-8 bg-background">
      {/* Logo & Branding */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-20 h-20 mx-auto mb-4 rounded-2xl gradient-primary flex items-center justify-center shadow-lg shadow-primary/25">
          <span className="text-3xl font-black text-white">V</span>
        </div>
        <h1 className="text-3xl font-bold gradient-text">VibeLoop</h1>
        <p className="text-muted-foreground mt-2 text-sm">{t('app.tagline')}</p>
      </motion.div>

      {/* Auth Card */}
      <motion.div
        layout
        className="w-full max-w-sm glass-strong rounded-2xl p-6 shadow-xl"
      >
        <AnimatePresence mode="wait">
          {/* ---- Mode Select ---- */}
          {mode === 'select' && (
            <motion.div
              key="select"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-semibold text-center">{t('auth.welcome')}</h2>
              <p className="text-sm text-muted-foreground text-center">{t('auth.createAccount')}</p>

              <button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                {t('auth.continueWithGoogle')}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <button
                onClick={() => setMode('email')}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity font-medium"
              >
                <Mail className="w-5 h-5" />
                {t('auth.continueWithEmail')}
              </button>

              <button
                onClick={() => setMode('phone')}
                className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-border bg-card hover:bg-secondary/50 transition-colors font-medium"
              >
                <Phone className="w-5 h-5" />
                {t('auth.continueWithPhone')}
              </button>

              <p className="text-xs text-muted-foreground text-center mt-4">
                {t('auth.agreeTerms')}
              </p>
            </motion.div>
          )}

          {/* ---- Email Mode ---- */}
          {mode === 'email' && (
            <motion.form
              key="email"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleEmailSubmit}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setMode('select')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-xl font-semibold">{t('auth.continueWithEmail')}</h2>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.emailPlaceholder')}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('auth.sendOtp')}
              </button>
            </motion.form>
          )}

          {/* ---- Phone Mode ---- */}
          {mode === 'phone' && (
            <motion.form
              key="phone"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handlePhoneSubmit}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setMode('select')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-xl font-semibold">{t('auth.continueWithPhone')}</h2>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t('auth.phonePlaceholder')}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('auth.sendOtp')}
              </button>
            </motion.form>
          )}

          {/* ---- OTP Mode ---- */}
          {mode === 'otp' && (
            <motion.form
              key="otp"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              onSubmit={handleOtpSubmit}
              className="space-y-4"
            >
              <button
                type="button"
                onClick={() => setMode(otpType === 'email' ? 'email' : 'phone')}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <h2 className="text-xl font-semibold">{t('auth.verifyOtp')}</h2>
              <p className="text-sm text-muted-foreground">
                {t('auth.otpSent', { destination: otpType === 'email' ? email : phone })}
              </p>
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder={t('auth.otpPlaceholder')}
                maxLength={6}
                required
                className="w-full px-4 py-3 rounded-xl bg-secondary/50 border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring text-center text-2xl tracking-[0.5em] font-mono"
              />
              {error && <p className="text-destructive text-sm">{error}</p>}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full px-4 py-3 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                {t('auth.verifyOtp')}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Age verification note */}
      <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
        {t('auth.ageVerification')}
      </p>
    </div>
  );
}
