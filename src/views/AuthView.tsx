import React, { useState } from 'react';
import { Sparkles, Mail, Lock, User, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthViewProps {
  onNavigate: (path: string) => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onNavigate }) => {
  const { login, register, loginWithGoogle } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Google Login modal state
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleEmail, setGoogleEmail] = useState('alli.kabbalah@gmail.com');
  const [googleName, setGoogleName] = useState('אלי קבלה');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (isRegistering) {
      if (!fullName.trim() || !email.trim() || !password.trim()) {
        setErrorMsg('אנא מלא את כל השדות');
        return;
      }
      const res = register(email.trim(), password.trim(), fullName.trim());
      if (res.success) {
        onNavigate('/dashboard');
      } else {
        setErrorMsg(res.error || 'אירעה שגיאה בהרשמה');
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setErrorMsg('אנא הזן דוא"ל וסיסמה');
        return;
      }
      const res = login(email.trim(), password.trim());
      if (res.success) {
        onNavigate('/dashboard');
      } else {
        setErrorMsg(res.error || 'פרטי ההתחברות שגויים');
      }
    }
  };

  const handleGoogleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleEmail.trim()) return;

    const res = loginWithGoogle(googleEmail.trim(), googleName.trim());
    if (res.success) {
      setShowGoogleModal(false);
      onNavigate('/dashboard');
    } else {
      setErrorMsg(res.error || 'אירעה שגיאה בהתחברות עם Google');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-teal-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto text-white shadow-lg">
            <Sparkles className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-foreground">Kabbalah CRM</h1>
          <p className="text-xs text-muted-foreground font-medium">
            {isRegistering ? 'הרשמה והקמת חשבון מטפל חדש' : 'כניסה למערכת ניהול הקליניקה הקבלית'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl text-center">
            {errorMsg}
          </div>
        )}

        {/* Google Login Section */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowGoogleModal(true)}
            className="w-full py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-2.5"
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
            התחבר באמצעות Google
          </button>

          <div className="relative flex items-center justify-center my-2">
            <div className="border-t border-border w-full" />
            <span className="bg-card px-2 text-[11px] text-muted-foreground shrink-0">או התחבר בדוא"ל</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-right">
          {isRegistering && (
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
                  className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
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
                placeholder="therapist@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">סיסמה *</label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isRegistering ? 'הרשם וזהה ארגון שמשויך אליך' : 'התחבר למערכת'}
          </button>
        </form>

        <div className="pt-2 text-center border-t border-border">
          <button
            onClick={() => {
              setIsRegistering((p) => !p);
              setErrorMsg('');
            }}
            className="text-xs text-primary font-bold hover:underline"
          >
            {isRegistering ? 'כבר רשום? לחץ להתחברות' : 'אין לך חשבון? לחץ להרשמה מהירה'}
          </button>
        </div>
      </div>

      {/* Google Auth Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-5 animate-in zoom-in-95 text-right">
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
              המערכת תזהה אוטומטית ארגונים וקליניקות שמשויכים לכתובת גוגל זו:
            </p>

            <form onSubmit={handleGoogleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">כתובת דוא"ל Google</label>
                <input
                  type="email"
                  required
                  value={googleEmail}
                  onChange={(e) => setGoogleEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">שם מלא בחשבון</label>
                <input
                  type="text"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
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
