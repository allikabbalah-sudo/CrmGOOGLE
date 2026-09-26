import React, { useState, useEffect } from 'react';
import { UserPlus, CheckCircle2, LogIn } from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

interface InviteViewProps {
  token: string;
  onNavigate: (path: string) => void;
}

export const InviteView: React.FC<InviteViewProps> = ({ token, onNavigate }) => {
  const { acceptInviteToken } = useOrganization();
  const { user } = useAuth();
  const [statusMsg, setStatusMsg] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    if (token) {
      localStorage.setItem('pending_invite_token', token);
    }
  }, [token]);

  const handleAccept = () => {
    if (token) {
      localStorage.setItem('pending_invite_token', token);
    }

    if (!user) {
      onNavigate('/auth');
      return;
    }

    const success = acceptInviteToken(token);
    if (success) {
      localStorage.removeItem('pending_invite_token');
      setStatusMsg('הצטרפת בהצלחה לארגון הקליניקה!');
      setIsError(false);
      setTimeout(() => {
        onNavigate('/dashboard');
      }, 1200);
    } else {
      setStatusMsg('קישור ההזמנה אינו תקף או שכבר פג תוקפו.');
      setIsError(true);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl text-center space-y-6">
        <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto shadow-inner">
          <UserPlus className="w-7 h-7" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-foreground">הזמנה להצטרפות לקליניקה קבלית</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            מוזמן/ת להצטרף לצוות המטפלים ולנהל כרטיסי מטופלים, סדרות טיפול ומפגשים.
          </p>
        </div>

        {statusMsg && (
          <div
            className={`p-3 border text-xs font-bold rounded-xl ${
              isError
                ? 'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {statusMsg}
          </div>
        )}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleAccept}
            className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
          >
            {user ? <CheckCircle2 className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
            {user ? 'קבל הזמנה והצטרף כעת' : 'התחבר / הירשם כדי להצטרף'}
          </button>

          {!user && (
            <p className="text-[11px] text-muted-foreground font-medium">
              לאחר ההתחברות או ההרשמה (במייל או Google), תצורף אוטומטית לקליניקה.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
