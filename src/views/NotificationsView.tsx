import React, { useState } from 'react';
import { Bell, CheckCheck, Clock, User, CheckSquare, Smartphone, Volume2 } from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { formatHebrewDate } from '../lib/utils';
import {
  isNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  sendDeviceNotification,
} from '../lib/deviceNotifications';

interface NotificationsViewProps {
  onNavigate: (path: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const notifications = dataStore.getNotifications();
  const [testSent, setTestSent] = useState(false);
  const [, setTick] = useState(0);

  const handleMarkAllRead = () => {
    dataStore.markAllNotificationsRead();
  };

  const handleNotificationClick = (n: any) => {
    dataStore.markNotificationRead(n.id);
    if (n.data?.client_id) {
      onNavigate(`/clients/${n.data.client_id}`);
    } else if (n.data?.task_id) {
      onNavigate('/tasks');
    }
  };

  const hasPerm = getNotificationPermission() === 'granted';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            התראות ועדכוני קליניקה ({notifications.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            הודעות push, תזכורות למפגשים ועדכונים שוטפים
          </p>
        </div>

        {notifications.some((n) => !n.read_at) && (
          <button
            onClick={handleMarkAllRead}
            className="px-3.5 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            סמן הכל כנקרא
          </button>
        )}
      </div>

      {/* Device Notifications Banner */}
      {isNotificationSupported() && (
        <div className="p-4 rounded-2xl bg-card border border-border shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div className={`p-2.5 rounded-xl ${hasPerm ? 'bg-emerald-500/10 text-emerald-600' : 'bg-amber-500/10 text-amber-600'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-foreground">
                {hasPerm ? 'התראות במכשיר (Push) פעילות' : 'קבלת התראות ישירות למכשיר'}
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {hasPerm
                  ? 'המכשיר שלך מקבל צליל ותזכורת בזמן אמת עבור מפגשים ומשימות.'
                  : 'אפשר קבלת התראות קופצות וצלילים ישירות למכשיר כדי לא לפספס פגישות ומשימות.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {hasPerm ? (
              <button
                type="button"
                onClick={async () => {
                  setTestSent(true);
                  await sendDeviceNotification('בדיקת התראה מקליניקה קבלית 🔔', {
                    body: 'התראות למכשיר פועלות בצורה מושלמת!',
                    sound: true,
                  });
                  setTimeout(() => setTestSent(false), 3000);
                }}
                className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-xl border border-border flex items-center gap-1.5 transition-colors"
              >
                <Volume2 className="w-3.5 h-3.5 text-primary" />
                {testSent ? 'נשלחה התראה!' : 'שלח התראת בדיקה'}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  await requestNotificationPermission();
                  setTick((t) => t + 1);
                }}
                className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 shadow-xs transition-colors"
              >
                הפעל התראות במכשיר
              </button>
            )}
          </div>
        </div>
      )}

      {/* List */}
      {notifications.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border rounded-2xl text-muted-foreground text-xs">
          אין התראות במערכת עדיין.
        </div>
      ) : (
        <div className="space-y-2.5">
          {notifications.map((n) => {
            const isRead = !!n.read_at;
            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  isRead
                    ? 'bg-card border-border/70 opacity-80'
                    : 'bg-primary/5 border-primary/30 shadow-xs'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2.5 rounded-xl ${isRead ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground'}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-foreground">{n.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.body}</p>
                    <span className="text-[10px] font-mono text-muted-foreground/80 mt-1 block">
                      {formatHebrewDate(n.created_at, 'dd/MM/yyyy HH:mm')}
                    </span>
                  </div>
                </div>

                {!isRead && (
                  <span className="w-2.5 h-2.5 bg-primary rounded-full shrink-0 mt-1"></span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
