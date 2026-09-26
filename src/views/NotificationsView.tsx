import React from 'react';
import { Bell, CheckCheck, Clock, User, CheckSquare } from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { formatHebrewDate } from '../lib/utils';

interface NotificationsViewProps {
  onNavigate: (path: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({ onNavigate }) => {
  const notifications = dataStore.getNotifications();

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

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-xs">
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
