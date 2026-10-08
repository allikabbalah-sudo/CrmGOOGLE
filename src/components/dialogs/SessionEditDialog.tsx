import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, CheckCircle2, AlertCircle, FileText, Mic } from 'lucide-react';
import { Session, SessionStatus, SESSION_STATUS_LABELS } from '../../types';
import { formatHebrewDate } from '../../lib/utils';
import { AudioRecorder } from '../media/AudioRecorder';

interface SessionEditDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (sessionId: string, updates: Partial<Session>) => void;
  session: Session | null;
  clientName?: string;
}

export const SessionEditDialog: React.FC<SessionEditDialogProps> = ({
  isOpen,
  onClose,
  onSave,
  session,
  clientName,
}) => {
  const [status, setStatus] = useState<SessionStatus>('scheduled');
  const [sessionDate, setSessionDate] = useState('');
  const [sessionTime, setSessionTime] = useState('');
  const [notes, setNotes] = useState('');
  const [showRecorder, setShowRecorder] = useState(false);
  const [audioNotice, setAudioNotice] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      setStatus(session.status);
      const iso = session.session_date || new Date().toISOString();
      const parts = iso.split('T');
      setSessionDate(parts[0] || '');
      setSessionTime(parts[1] ? parts[1].substring(0, 5) : '10:00');
      setNotes(session.notes || '');
      setAudioNotice(null);
    }
  }, [session, isOpen]);

  if (!isOpen || !session) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullDateISO = new Date(`${sessionDate}T${sessionTime}:00`).toISOString();

    onSave(session.id, {
      status,
      session_date: fullDateISO,
      notes: notes.trim(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-bold text-base text-foreground">עדכון מפגש טיפולי</h3>
            {clientName && <p className="text-xs text-muted-foreground font-medium">מטופל: {clientName}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-right">
          {/* Status Selection */}
          <div>
            <label className="block text-xs font-semibold mb-1.5">סטטוס המפגש *</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SESSION_STATUS_LABELS) as SessionStatus[]).map((st) => {
                const info = SESSION_STATUS_LABELS[st];
                const isSelected = status === st;
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatus(st)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all text-center ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>

            {status === 'postponed' && (
              <p className="text-[11px] text-purple-600 dark:text-purple-400 mt-1.5 flex items-center gap-1 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                שימו לב: דחיית מפגש תיצור אוטומטית מפגש חלופי בסוף התוכנית!
              </p>
            )}
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">תאריך המפגש</label>
              <div className="relative">
                <Calendar className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <input
                  type="date"
                  required
                  value={sessionDate}
                  onChange={(e) => setSessionDate(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">שעת המפגש</label>
              <div className="relative">
                <Clock className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                <input
                  type="time"
                  required
                  value={sessionTime}
                  onChange={(e) => setSessionTime(e.target.value)}
                  className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold mb-1">סיכום ותיעוד המפגש</label>
            <textarea
              rows={4}
              placeholder="תיעוד אבחון קבלי, עבודה אנרגטית, מסקנות והנחיות למטופל..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Quick Mic Recording Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowRecorder((p) => !p)}
              className="text-xs text-primary hover:underline font-bold flex items-center gap-1.5"
            >
              <Mic className="w-4 h-4" />
              {showRecorder ? 'סגור הקלטה' : 'הקלט סיכום קולי למפגש זה'}
            </button>

            {showRecorder && (
              <div className="mt-2 space-y-2">
                <AudioRecorder
                  onRecordingComplete={(file) => {
                    setAudioNotice(`ההקלטה "${file.name}" נשמרה בהצלחה במדיית הלקוח!`);
                    setShowRecorder(false);
                    setTimeout(() => setAudioNotice(null), 5000);
                  }}
                  onCancel={() => setShowRecorder(false)}
                />
              </div>
            )}

            {audioNotice && (
              <div className="mt-2 p-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl font-medium">
                {audioNotice}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              שמור שינויים
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
