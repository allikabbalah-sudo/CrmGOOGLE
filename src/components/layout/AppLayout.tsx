import React, { useEffect } from 'react';
import { SidebarNav } from './SidebarNav';
import { TopBar } from './TopBar';
import { BottomNav } from './BottomNav';
import { OfflineIndicator } from '../pwa/OfflineIndicator';
import { dataStore } from '../../lib/dataStore';

interface AppLayoutProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ currentPath, onNavigate, children }) => {
  useEffect(() => {
    // Check for task reminders & session reminders every 30s
    const interval = setInterval(() => {
      const now = new Date();
      const tasks = dataStore.getTasks();

      tasks.forEach((t) => {
        if (t.status === 'todo' && t.due_date) {
          const dueDate = new Date(t.due_date);
          const diffMs = dueDate.getTime() - now.getTime();
          const diffMins = Math.floor(diffMs / 60000);

          // 1 hour reminder (between 50 and 65 mins)
          if (diffMins > 0 && diffMins <= 60 && !t.reminder_1h_sent_at) {
            dataStore.updateTask(t.id, { reminder_1h_sent_at: new Date().toISOString() });
            dataStore.addNotification({
              type: 'task_reminder',
              title: `תזכורת: משימה בעוד שעה!`,
              body: t.title,
              link: '/tasks',
            });
          }
          // 10 minute reminder
          else if (diffMins > 0 && diffMins <= 10 && !t.reminder_10m_sent_at) {
            dataStore.updateTask(t.id, { reminder_10m_sent_at: new Date().toISOString() });
            dataStore.addNotification({
              type: 'task_reminder',
              title: `תזכורת דחופה: משימה בעוד 10 דקות!`,
              body: t.title,
              link: '/tasks',
            });
          }
        }
      });
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* Desktop Sidebar */}
      <SidebarNav currentPath={currentPath} onNavigate={onNavigate} />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <TopBar onNavigate={onNavigate} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-300">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav currentPath={currentPath} onNavigate={onNavigate} />

      {/* PWA Offline Connectivity Indicator */}
      <OfflineIndicator />
    </div>
  );
};
