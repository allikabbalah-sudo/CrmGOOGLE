import React, { useState } from 'react';
import {
  Sparkles,
  Mail,
  Lock,
  User,
  CheckCircle2,
  ShieldCheck,
  X,
  KeyRound,
  Zap,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthViewProps {
  onNavigate: (path: string) => void;
}

type AuthMode = 'login' | 'register' | 'forgot_password';

export const AuthView: React.FC<AuthViewProps> = ({ onNavigate }) => {
  const { login, register, loginWithGoogle, loginDirectly, resetPassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  const [email, setEmail] = useState('alli.kabbalah@gmail.com');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Google Login modal fallback state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('alli.kabbalah@gmail.com');
  const [googleName, setGoogleName] = useState('אלי קבלה');

  // Quick 1-click login for clinic owner
  const handleQuickOwnerLogin = () => {
    setErrorMsg('');
    setSuccessMsg('');
    const res = loginDirectly('alli.kabbalah@gmail.com', 'אלי קבלה');
    if (res.success) {
      onNavigate('/dashboard');
    } else {
      setErrorMsg(res.error || 'אירעה שגיאה בכניסה מהירה');
    }
  };

  // Real Google Sign-in with popup, falling back to manual email if popup blocked
  const handleRealGoogleSignIn = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setIsGoogleLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        const uEmail = result.user.email || 'alli.kabbalah@gmail.com';
        const uName = result.user.displayName || 'אלי קבלה';
        const res = loginWithGoogle(uEmail, uName);
        if (res.success) {
          onNavigate('/dashboard');
          return;
        }
      }
    } catch (err: any) {
      console.warn('Google popup error:', err);
      // If popup blocked or failed, seamlessly open the manual dialog so user is never stuck
      setShowGoogleModal(true);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg('חלון ההתחברות של גוגל נחסם או נסגר בדפדפן. באפשרותך להתחבר ישירות למטה.');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      if (mode === 'register') {
        if (!fullName.trim() || !email.trim() || !password.trim()) {
          setErrorMsg('אנא מלא את כל השדות הדרושים');
          setIsSubmitting(false);
          return;
        }
        const res = register(email.trim(), password.trim(), fullName.trim());
        if (res.success) {
          onNavigate('/dashboard');
        } else {
          setErrorMsg(res.error || 'אירעה שגיאה בהרשמה');
        }
      } else if (mode === 'forgot_password') {
        if (!email.trim() || !newPassword.trim()) {
          setErrorMsg('אנא הזן כתובת דוא"ל וסיסמה חדשה');
          setIsSubmitting(false);
          return;
        }
        const res = resetPassword(email.trim(), newPassword.trim());
        if (res.success) {
          setSuccessMsg('הסיסמה עודכנה בהצלחה! מתחבר למערכת...');
          setTimeout(() => {
            onNavigate('/dashboard');
          }, 600);
        } else {
          setErrorMsg(res.error || 'אירעה שגיאה באיפוס הסיסמה');
        }
      } else {
        // Standard login
        if (!email.trim() || !password.trim()) {
          setErrorMsg('אנא הזן כתובת דוא"ל וסיסמה');
          setIsSubmitting(false);
          return;
        }
        const res = login(email.trim(), password.trim());
        if (res.success) {
          onNavigate('/dashboard');
        } else {
          setErrorMsg(res.error || 'פרטי ההתחברות שגויים');
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleModalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) return;

    const res = loginWithGoogle(googleEmail.trim(), googleName.trim());
    if (res.success) {
      setShowGoogleModal(false);
      onNavigate('/dashboard');
    } else {
      setErrorMsg(res.error || 'אירעה שגיאה בהתחברות עם חשבון Google');
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6">
        {/* Logo & Heading */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-teal-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Kabbalah CRM</h1>
          <p className="text-xs text-muted-foreground font-medium">
            {mode === 'register'
              ? 'הרשמה והקמת חשבון מטפל חדש'
              : mode === 'forgot_password'
              ? 'איפוס סיסמה והתחברות למערכת'
              : 'כניסה למערכת ניהול הקליניקה הקבלית'}
          </p>
        </div>

        {/* Error / Success Feedback */}
        {errorMsg && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl text-center flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* 1-Click Fast Login for Clinic Owner (NO PASSWORD REQUIRED) */}
        {mode === 'login' && (
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={handleQuickOwnerLogin}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Zap className="w-4 h-4 text-amber-300" />
              <span>כניסה מהירה כמטפל ראשי (אלי קבלה)</span>
            </button>

            {/* Google Login Section */}
            <button
              type="button"
              disabled={isGoogleLoading}
              onClick={handleRealGoogleSignIn}
              className="w-full py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-2.5"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{isGoogleLoading ? 'מתחבר ל-Google...' : 'התחבר באמצעות Google'}</span>
            </button>

            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-border w-full" />
              <span className="bg-card px-2.5 text-[11px] text-muted-foreground shrink-0 font-medium">
                או התחבר באמצעות דוא"ל וסיסמה
              </span>
            </div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold mb-1">שם מלא *</label>
              <div className="relative">
                <User className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <input
                  type="text"
                  required
                  placeholder="דוד כהן"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold mb-1">כתובת דוא"ל *</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <input
                type="email"
                required
                placeholder="alli.kabbalah@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
            </div>
          </div>

          {mode !== 'forgot_password' ? (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold">סיסמה *</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot_password');
                      setErrorMsg('');
                    }}
                    className="text-[11px] text-primary hover:underline font-bold"
                  >
                    שכחת סיסמה?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pr-9 pl-10 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold mb-1">סיסמה חדשה *</label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="הזן סיסמה חדשה (לפחות 4 תווים)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full pr-9 pl-10 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>
              {mode === 'register'
                ? 'הרשם וזהה ארגון שמשויך אליך'
                : mode === 'forgot_password'
                ? 'אפס סיסמה והתחבר למערכת'
                : 'התחבר למערכת'}
            </span>
          </button>
        </form>

        {/* Mode Switchers */}
        <div className="pt-2 text-center border-t border-border flex flex-col gap-2">
          {mode === 'login' ? (
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg('');
                }}
                className="text-primary font-bold hover:underline"
              >
                אין לך חשבון? הרשמה מהירה
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('forgot_password');
                  setErrorMsg('');
                }}
                className="text-muted-foreground hover:text-foreground text-[11px]"
              >
                איפוס סיסמה
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
              }}
              className="text-xs text-primary font-bold hover:underline flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>חזרה למסך התחברות</span>
            </button>
          )}
        </div>
      </div>

      {/* Google Auth Manual Fallback Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 animate-in zoom-in-95 text-right">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-sm">התחברות עם חשבון Google</h3>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="p-1 hover:bg-muted rounded-lg text-muted-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-muted-foreground">
              המערכת תזהה אוטומטית את הקליניקה והנתונים המשויכים לכתובת Google זו:
            </p>

            <form onSubmit={handleGoogleModalSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">כתובת דוא"ל Google</label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">שם מלא בחשבון</label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-md hover:bg-primary/90 flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  המשך והתחבר כעת
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
