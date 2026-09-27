import React from 'react';
import {
  Calendar,
  Users,
  Shield,
  ArrowLeft,
  Lock,
  Sparkles,
  LogIn,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface LandingViewProps {
  onNavigate: (path: string) => void;
}

export const LandingView: React.FC<LandingViewProps> = ({ onNavigate }) => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground flex flex-col justify-between font-heebo dir-rtl selection:bg-teal-500/20 selection:text-teal-700">
      {/* Top Header */}
      <header className="w-full border-b border-border/60 bg-card/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-700 to-teal-500 text-white font-black flex items-center justify-center shadow-sm">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-foreground">
              crmkabbalah
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('/privacy')}
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1"
            >
              מדיניות פרטיות
            </button>
            {user ? (
              <button
                onClick={() => onNavigate('/dashboard')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors"
              >
                <span>מעבר למערכת</span>
                <ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => onNavigate('/auth')}
                className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors"
              >
                <LogIn className="w-4 h-4" />
                <span>התחברות למערכת</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12 md:py-20 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-teal-500/10 border border-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold mb-6">
          <Shield className="w-3.5 h-3.5 text-teal-600" />
          <span>מערכת ענן מאובטחת ומותאמת לקליניקה</span>
        </div>

        {/* Primary Title requested: crmkabbalah */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-foreground leading-tight mb-4">
          crmkabbalah
        </h1>

        {/* Short description requested */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 font-normal leading-relaxed">
          מערכת לניהול קשרי לקוחות וסנכרון יומן פגישות.
        </p>

        {/* Main CTA Button */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mb-16">
          {user ? (
            <button
              onClick={() => onNavigate('/dashboard')}
              className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <span>כניסה ללוח הבקרה (שלום {user.email})</span>
              <ArrowLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => onNavigate('/auth')}
              className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm sm:text-base rounded-2xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <LogIn className="w-5 h-5" />
              <span>התחברות למערכת</span>
            </button>
          )}

          <button
            onClick={() => onNavigate('/privacy')}
            className="w-full sm:w-auto px-6 py-3.5 bg-card hover:bg-muted text-foreground border border-border font-medium text-sm rounded-2xl transition-colors"
          >
            קרא את מדיניות הפרטיות
          </button>
        </div>

        {/* Features Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 w-full text-right">
          <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-3">
              <Users className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">ניהול קשרי לקוחות</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              כרטיס לקוח מקיף, מעקב מפגשים וסדרות טיפול, משימות, תיעוד והיסטוריה מלאה.
            </p>
          </div>

          <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-3">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">סנכרון יומן Google</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              סנכרון פגישות ולוחות זמנים מול יומן Google Calendar בזמן אמת ובאישור המשתמש.
            </p>
          </div>

          <div className="p-5 bg-card border border-border rounded-2xl shadow-2xs space-y-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-3">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-foreground">פרטיות ואבטחת מידע</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              אחסון ענן מוצפן ב-Firebase, גיבויים שוטפים ושמירה קפדנית על פרטיות הנתונים.
            </p>
          </div>
        </div>

        {/* Safe Google Integration Note */}
        <div className="mt-12 p-4 bg-muted/40 border border-border rounded-2xl max-w-xl text-center text-xs text-muted-foreground space-y-1">
          <div className="flex items-center justify-center gap-1.5 font-bold text-foreground">
            <CheckCircle2 className="w-4 h-4 text-teal-600" />
            <span>אימות Google OAuth מאובטח</span>
          </div>
          <p>
            האפליקציה פועלת בהתאם לתקנות הגנת המידע של Google (Google API Services User Data Policy) ואינה מעבירה או מוכרת מידע לצדדים שלישיים.
          </p>
        </div>
      </main>

      {/* Public Footer */}
      <footer className="w-full border-t border-border bg-card/60 py-6 text-xs text-muted-foreground">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">crmkabbalah</span>
            <span>•</span>
            <span>© {new Date().getFullYear()} כל הזכויות שמורות</span>
          </div>

          <div className="flex items-center gap-6">
            <button
              onClick={() => onNavigate('/privacy')}
              className="text-primary hover:underline font-bold"
            >
              מדיניות פרטיות (Privacy Policy)
            </button>
            <span className="text-border">|</span>
            <button
              onClick={() => onNavigate('/auth')}
              className="hover:text-foreground transition-colors"
            >
              התחברות למערכת
            </button>
            <span className="text-border">|</span>
            <a
              href="mailto:alli.kabbalah@gmail.com"
              className="hover:text-foreground transition-colors"
            >
              alli.kabbalah@gmail.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
