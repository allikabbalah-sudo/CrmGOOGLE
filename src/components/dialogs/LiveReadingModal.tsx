import React, { useState } from 'react';
import { X, Sparkles, BookOpen, CheckCircle2 } from 'lucide-react';
import { KABBALAH_READINGS } from '../../types';
import confetti from 'canvas-confetti';

interface LiveReadingModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: string;
  clientName: string;
  onPerformReading: (readingType: string, summary: string, followupDays: number) => void;
}

export const LiveReadingModal: React.FC<LiveReadingModalProps> = ({
  isOpen,
  onClose,
  clientId,
  clientName,
  onPerformReading,
}) => {
  const [readingType, setReadingType] = useState<string>(KABBALAH_READINGS[0]);
  const [summary, setSummary] = useState('');
  const [followupDays, setFollowupDays] = useState(7);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!readingType || !summary.trim()) return;

    onPerformReading(readingType, summary.trim(), followupDays);

    try {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch {}

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" />
            ביצוע לייב רידינג — {clientName}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-right">
          <div>
            <label className="block text-xs font-semibold mb-1 flex items-center gap-1">
              <BookOpen className="w-4 h-4 text-primary" />
              סוג הקריאה והאבחון הקבלי *
            </label>
            <select
              value={readingType}
              onChange={(e) => setReadingType(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              {KABBALAH_READINGS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">תקציר הקריאה וההכוונה הרוחנית *</label>
            <textarea
              rows={4}
              required
              placeholder="רשום את ממצאי הקריאה, הספירות הראשיות, צירופי שמות הקודש וההנחיות האנרגטיות למטופל/ת..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">יצירת משימת מעקב בעוד (ימים)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={90}
                value={followupDays}
                onChange={(e) => setFollowupDays(parseInt(e.target.value, 10) || 7)}
                className="w-24 px-3 py-1.5 text-xs bg-muted/40 border border-border rounded-xl text-center font-bold"
              />
              <span className="text-xs text-muted-foreground">ימים מיום הקריאה</span>
            </div>
          </div>

          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-[11px] text-amber-800 dark:text-amber-300">
            אישור הקריאה יעשה 3 פעולות אוטומטיות: יעדכן את הקריאה הנבחרת בכרטיס הלקוח, ייצר תוכנית ומפגש לייב רידינג שבוצע, ויפתח משימת מעקב ביומן.
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              בצע ושמור לייב רידינג
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
