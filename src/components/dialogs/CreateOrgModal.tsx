import React, { useState } from 'react';
import { Building2, Plus, X, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrganization } from '../../context/OrganizationContext';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateOrgModal: React.FC<CreateOrgModalProps> = ({ isOpen, onClose }) => {
  const { createOrganization } = useAuth();
  const { refetchOrgData } = useOrganization();
  const [orgName, setOrgName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgName.trim()) {
      setError('אנא הזן שם עבור הארגון / הקליניקה החדשה');
      return;
    }
    setIsLoading(true);
    try {
      createOrganization(orgName.trim());
      if (refetchOrgData) refetchOrgData();
      setOrgName('');
      setError('');
      onClose();
    } catch (err: any) {
      setError(err.message || 'אירעה שגיאה ביצירת הארגון');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden text-right animate-in fade-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">יצירת ארגון / קליניקה חדשה</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              שם הקליניקה / הארגון *
            </label>
            <input
              type="text"
              required
              placeholder="לדוגמה: מרכז אור הספירות — תל אביב"
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-primary">
              <ShieldCheck className="w-4 h-4" />
              מדיניות פרטיות והרשאות
            </div>
            <p className="text-muted-foreground leading-relaxed text-[11px]">
              כמקים הארגון, תוגדר כבעלים (Owner). רק יוצר הארגון ומנהליו רשאים להוסיף חברים ומטפלים חדשים. הארגון ונתוני המטופלים בו חסויים לחלוטין ואינם נגישים לאף משתמש חיצוני.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              צור ארגון עכשיו
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
