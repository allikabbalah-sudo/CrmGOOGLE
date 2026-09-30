import React, { useState } from 'react';
import {
  ShieldAlert,
  ExternalLink,
  Copy,
  Check,
  X,
  HelpCircle,
  Key,
  Globe,
  Sparkles,
} from 'lucide-react';
import firebaseConfig from '../../../firebase-applet-config.json';

interface UnauthorizedDomainModalProps {
  isOpen: boolean;
  onClose: () => void;
  featureName?: string;
  onManualToken?: (token: string) => void;
}

export const UnauthorizedDomainModal: React.FC<UnauthorizedDomainModalProps> = ({
  isOpen,
  onClose,
  featureName = 'Google Calendar',
  onManualToken,
}) => {
  const [copied, setCopied] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);

  if (!isOpen) return null;

  const currentDomain =
    typeof window !== 'undefined' ? window.location.hostname : 'crmgoogle.vercel.app';
  const projectId = (firebaseConfig as any).projectId || 'gen-lang-client-0443086133';
  const firebaseSettingsUrl = `https://console.firebase.google.com/project/${projectId}/authentication/settings`;

  const handleCopyDomain = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(currentDomain);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleApplyManualToken = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken.trim()) return;
    if (onManualToken) {
      onManualToken(manualToken.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-card border border-border rounded-3xl p-6 w-full max-w-lg shadow-2xl space-y-5 animate-in zoom-in-95 text-right font-heebo">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-foreground">
                אישור דומיין ב-Firebase ({featureName})
              </h3>
              <p className="text-[11px] text-muted-foreground">
                שגיאת אבטחה של Firebase: <code className="text-amber-600 font-mono text-[10px]">auth/unauthorized-domain</code>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Explanation */}
        <div className="p-3.5 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-xs space-y-2 text-amber-900 dark:text-amber-200">
          <p className="font-bold flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-amber-600 shrink-0" />
            הדומיין שממנו אתה גולש אינו מורשה עדיין ב-Firebase:
          </p>
          <div className="flex items-center justify-between gap-2 p-2 bg-background/80 rounded-xl border border-amber-500/30">
            <code className="font-mono text-xs font-bold text-foreground dir-ltr">
              {currentDomain}
            </code>
            <button
              type="button"
              onClick={handleCopyDomain}
              className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 rounded-lg font-bold text-[11px] flex items-center gap-1 transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'הועתק!' : 'העתק דומיין'}</span>
            </button>
          </div>
        </div>

        {/* Step-by-step instructions */}
        <div className="space-y-2 text-xs text-foreground">
          <p className="font-bold text-xs flex items-center gap-1.5 text-primary">
            <HelpCircle className="w-4 h-4" />
            איך לפתור את זה ב-2 קליקים ב-Firebase Console:
          </p>

          <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground pr-1">
            <li>
              פתח את הגדרות הפרויקט ב-Firebase:{' '}
              <a
                href={firebaseSettingsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-bold inline-flex items-center gap-1 hover:underline dir-ltr"
              >
                <span>Firebase Auth Settings</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </li>
            <li>
              בלשונית <strong className="text-foreground">Settings (הגדרות)</strong>, גלול למטה לאזור <strong className="text-foreground">Authorized domains (דומיינים מורשים)</strong>.
            </li>
            <li>
              לחץ על <strong className="text-foreground">Add domain (הוסף דומיין)</strong>, הדבק את{' '}
              <code className="bg-muted px-1.5 py-0.5 rounded font-bold text-foreground dir-ltr">
                {currentDomain}
              </code>{' '}
              ולחץ <strong className="text-foreground">Save (שמור)</strong>.
            </li>
            <li>רענן דף זה — וההתחברות תעבוד מיד ללא כל שגיאה!</li>
          </ol>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5 border-t border-border">
          <a
            href={firebaseSettingsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" />
            <span>פתח את Firebase Console כעת</span>
          </a>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            {onManualToken && (
              <button
                type="button"
                onClick={() => setShowManualInput(!showManualInput)}
                className="px-3 py-2 border border-border hover:bg-muted text-muted-foreground text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>הזנת תוקן ידני</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-colors"
            >
              הבנתי, סגור
            </button>
          </div>
        </div>

        {/* Optional Manual Token Input */}
        {showManualInput && onManualToken && (
          <form onSubmit={handleApplyManualToken} className="pt-3 border-t border-dashed border-border space-y-2">
            <label className="block text-[11px] font-bold text-foreground">
              הזן Google OAuth Access Token ישירות (לחיבור מיידי):
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="ya29.a0AfH6SM..."
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                className="flex-1 px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-primary dir-ltr"
              />
              <button
                type="submit"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-colors shrink-0"
              >
                החל תוקן
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
