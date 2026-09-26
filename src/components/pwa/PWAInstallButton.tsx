import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, Share2, X } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  variant?: 'header' | 'card';
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  variant = 'header',
  className = '',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already installed as standalone PWA
  if (isInstalled) {
    if (variant === 'card') {
      return (
        <div className="flex items-center gap-3 p-4 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 rounded-xl text-teal-900 dark:text-teal-200">
          <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0" />
          <div>
            <div className="font-bold text-sm">האפליקציה מותקנת במכשיר זה</div>
            <div className="text-xs text-teal-700 dark:text-teal-300">
              אתה משתמש בגרסת האפליקציה העצמאית (PWA) הנהנית מגישה מהירה וביצועים גבוהים.
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    if (variant === 'card') {
      return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-950/30 dark:to-emerald-950/30 border border-teal-200 dark:border-teal-800 rounded-xl">
          <div className="flex items-start gap-3">
            <div className="p-2.5 bg-teal-600 text-white rounded-lg shrink-0 shadow-xs">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-sm text-foreground">התקנת אפליקציה למכשיר (PWA)</div>
              <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                התקן את Kabbalah CRM כאפליקציה עצמאית במסך הבית או שולחן העבודה לגישה מהירה ונוחה.
              </div>
            </div>
          </div>
          <button
            onClick={install}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs sm:text-sm font-bold shadow-xs transition-colors shrink-0"
          >
            <Download className="w-4 h-4" />
            התקן עכשיו
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors ${className}`}
        title="התקנת אפליקציה למכשיר"
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">התקן אפליקציה</span>
      </button>
    );
  }

  // iOS Safari flow
  if (isIOS) {
    return (
      <>
        {variant === 'card' ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-slate-700 text-white rounded-lg shrink-0">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="font-bold text-sm text-foreground">התקנה ב-iPhone / iPad</div>
                <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                  ניתן להוסיף את המערכת למסך הבית של האייפון בקלות ישירות מספארי.
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowIOSGuide(true)}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs sm:text-sm font-bold transition-colors shrink-0"
            >
              <Smartphone className="w-4 h-4" />
              הוראות התקנה ב-iOS
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowIOSGuide(true)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 border border-slate-300 dark:border-slate-700 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-xs font-medium transition-colors ${className}`}
            title="התקן באייפון / אייפד"
          >
            <Smartphone className="w-3.5 h-3.5 text-teal-600" />
            <span className="hidden sm:inline">התקן ב-iOS</span>
          </button>
        )}

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
            <div className="w-full max-w-sm rounded-2xl bg-card border border-border p-6 shadow-2xl text-right dir-rtl">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-teal-600" />
                  <h3 className="text-base font-bold text-foreground">התקנה ב-iPhone / iPad</h3>
                </div>
                <button
                  onClick={() => setShowIOSGuide(false)}
                  className="p-1 text-muted-foreground hover:text-foreground rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mt-4 space-y-3 text-xs sm:text-sm text-foreground">
                <div className="flex items-start gap-2.5 p-2.5 bg-muted/60 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <div>
                    לחץ על כפתור <strong>השיתוף (Share)</strong> בתחתית דפדפן Safari:
                    <div className="mt-1 flex items-center gap-1.5 text-teal-600 dark:text-teal-400 font-semibold text-xs">
                      <Share2 className="w-4 h-4" /> אייקון ריבוע עם חץ כלפי מעלה
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-muted/60 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <div>
                    גלול מעט מטה ולחץ על <strong>"הוסף למסך הבית" (Add to Home Screen)</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-2.5 bg-muted/60 rounded-xl">
                  <span className="w-6 h-6 rounded-full bg-teal-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <div>
                    לחץ על <strong>"הוסף" (Add)</strong> בפינה העליונה. האפליקציה תופיע כעת במסך הבית שלך!
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-teal-600 hover:bg-teal-700 py-2.5 text-xs sm:text-sm font-bold text-white transition-colors"
              >
                הבנתי, תודה!
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  // Fallback for desktop browsers where install banner is not currently fired
  if (variant === 'card') {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-muted/40 border border-border rounded-xl">
        <div className="flex items-start gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-lg shrink-0">
            <Download className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-sm text-foreground">תמיכת PWA פעילה במלואה</div>
            <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
              האפליקציה מוגדרת כ-Progressive Web App. בדפדפנים תומכים (Chrome / Edge / Safari) יופיע סמל התקנה בשורת הכתובת.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
