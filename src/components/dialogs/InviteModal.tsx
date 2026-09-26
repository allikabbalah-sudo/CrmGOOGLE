import React, { useState } from 'react';
import { X, Mail, Copy, Check, UserPlus, UserCheck, Link2 } from 'lucide-react';
import { dataStore } from '../../lib/dataStore';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InviteModal: React.FC<InviteModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'direct' | 'link'>('direct');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'admin' | 'therapist' | 'member'>('therapist');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleDirectAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      dataStore.addMemberDirect(email.trim(), fullName.trim(), role);
      setSuccessMsg(`המשתמש (${email.trim()}) שויך בהצלחה לקליניקה! בעת התחברות עם כתובת זו או עם Google, הוא יראה את הקליניקה מיד.`);
      setEmail('');
      setFullName('');
    } catch (err: any) {
      alert(err.message || 'אירעה שגיאה בהוספת המשתמש');
    }
  };

  const handleGenerateInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    const invite = dataStore.createInvite(email.trim(), role);
    const origin = window.location.origin;
    const link = `${origin}/invite/${invite.token}`;
    setGeneratedLink(link);
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            הוספה ושיוך משתמשים לקליניקה
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="flex border-b border-border bg-muted/30">
          <button
            type="button"
            onClick={() => {
              setActiveTab('direct');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'direct'
                ? 'border-primary text-primary bg-card'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            הוספת משתמש רשום/דוא"ל
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('link');
              setSuccessMsg('');
            }}
            className={`flex-1 py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
              activeTab === 'link'
                ? 'border-primary text-primary bg-card'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Link2 className="w-4 h-4" />
            יצירת קישור הזמנה
          </button>
        </div>

        <div className="p-5 space-y-4 text-right">
          {successMsg && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl text-center">
              {successMsg}
            </div>
          )}

          {activeTab === 'direct' ? (
            <form onSubmit={handleDirectAdd} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">כתובת דוא"ל של המשתמש *</label>
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
                <label className="block text-xs font-semibold mb-1">שם המשתמש (אופציונלי)</label>
                <input
                  type="text"
                  placeholder="דוד כהן"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">תפקיד בקליניקה</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <option value="therapist">מטפל (גישה ללקוחות משויכים)</option>
                  <option value="admin">אדמין (ניהול מלא של הקליניקה)</option>
                  <option value="member">חבר צוות</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
                >
                  סגור
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  שייך משתמש לקליניקה
                </button>
              </div>
            </form>
          ) : !generatedLink ? (
            <form onSubmit={handleGenerateInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">כתובת מייל להזמנה *</label>
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
                <label className="block text-xs font-semibold mb-1">תפקיד במערכת</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                >
                  <option value="therapist">מטפל (גישה ללקוחות משויכים)</option>
                  <option value="admin">אדמין (ניהול מלא של הקליניקה)</option>
                  <option value="member">חבר צוות</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all"
                >
                  צור קישור הזמנה
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 animate-in fade-in">
              <p className="text-xs text-muted-foreground font-medium">
                קישור ההזמנה נוצר בהצלחה! שלח קישור זה למשתמש המוזמן:
              </p>

              <div className="p-3 bg-muted rounded-xl border border-border flex items-center justify-between gap-2">
                <span className="text-xs font-mono text-primary truncate flex-1">{generatedLink}</span>
                <button
                  onClick={copyToClipboard}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg shrink-0 flex items-center gap-1 shadow-xs"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'הועתק!' : 'העתק קישור'}
                </button>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  onClick={() => {
                    setGeneratedLink(null);
                    setEmail('');
                    onClose();
                  }}
                  className="px-4 py-2 bg-slate-800 text-white rounded-xl text-xs font-bold"
                >
                  סגור
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
