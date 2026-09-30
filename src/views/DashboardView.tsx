import React, { useState } from 'react';
import {
  Users,
  Kanban,
  Calendar,
  CheckSquare,
  Clock,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Calendar as CalendarIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { dataStore } from '../lib/dataStore';
import { formatHebrewDate } from '../lib/utils';
import { CLIENT_STATUS_LABELS, SESSION_STATUS_LABELS } from '../types';

interface DashboardViewProps {
  onNavigate: (path: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const clients = dataStore.getClients() || [];
  const tasks = dataStore.getTasks() || [];
  const sessions = dataStore.getSessions() || [];
  const programs = dataStore.getPrograms() || [];

  // Clients with no activity or program in the last 7-14 days
  const nowTime = Date.now();
  const clientsWithoutProgram7Days = clients.filter((c) => {
    if (!c) return false;
    const cp = programs.filter((p) => p.client_id === c.id);
    const cs = sessions.filter((s) => s.client_id === c.id);
    let latest = 0;
    for (const p of cp) {
      const t = Math.max(
        p.created_at ? new Date(p.created_at).getTime() : 0,
        p.updated_at ? new Date(p.updated_at).getTime() : 0,
        p.start_date ? new Date(p.start_date).getTime() : 0
      );
      if (t > latest) latest = t;
    }
    for (const s of cs) {
      const t = Math.max(
        s.session_date ? new Date(s.session_date).getTime() : 0,
        s.created_at ? new Date(s.created_at).getTime() : 0
      );
      if (t > latest) latest = t;
    }
    return latest === 0 || nowTime - latest >= 7 * 86400000;
  }).length;

  // Counts
  const activeClientsCount = clients.filter((c) => c?.status === 'active').length;
  const leadsCount = clients.filter((c) => c?.status === 'lead').length;

  // Sessions this week
  const now = new Date();
  const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay())); // Sunday
  const endOfWeek = new Date(startOfWeek.getTime() + 7 * 86400000);

  const sessionsThisWeek = sessions.filter((s) => {
    if (!s?.session_date) return false;
    const d = new Date(s.session_date);
    return d >= startOfWeek && d <= endOfWeek;
  }).length;

  const openTasks = tasks
    .filter((t) => t?.status === 'todo')
    .sort((a, b) => {
      if (!a?.due_date) return 1;
      if (!b?.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  // Today's sessions
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySessions = sessions.filter((s) => s?.session_date?.startsWith(todayStr));

  // Chart data: sessions by status
  const chartData = [
    { name: 'א' }, { name: 'ב' }, { name: 'ג' }, { name: 'ד' }, { name: 'ה' }, { name: 'ו' }, { name: 'ש' }
  ].map((d, index) => {
    const daySessions = sessions.filter((s) => s?.session_date ? new Date(s.session_date).getDay() === index : false);
    return {
      day: d.name,
      מפגשים: daySessions.length,
    };
  });

  const handleToggleTask = (id: string, currentStatus: string) => {
    dataStore.updateTask(id, {
      status: currentStatus === 'todo' ? 'done' : 'todo',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Greeting */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            ברוך הבא לקליניקה הקבלית
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ריכוז פעילות טיפולית, יומן מפגשים, משימות ומעקב מטופלים בזמן אמת
          </p>
        </div>
        <button
          onClick={() => onNavigate('/clients')}
          className="px-4 py-2 bg-[oklch(0.62_0.13_200)] text-white text-xs sm:text-sm font-bold rounded-lg shadow-xs hover:bg-[oklch(0.56_0.13_200)] transition-colors"
        >
          + לקוח חדש
        </button>
      </div>

      {/* Alert banner for clients needing follow-up */}
      {clientsWithoutProgram7Days > 0 && (
        <div
          onClick={() => onNavigate('/clients')}
          className="p-4 bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-card border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer hover:border-amber-500/50 transition-all shadow-xs"
        >
          <div className="flex items-center gap-3 text-amber-900 dark:text-amber-200">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="font-bold text-xs sm:text-sm text-foreground">
                ישנם {clientsWithoutProgram7Days} לקוחות ללא תוכנית עבודה פעילה בשבוע/שבועיים האחרונים
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                לחץ כאן למעבר לכרטיסיית הלקוחות ללא פעילות, שליחת הודעת WhatsApp או פתיחת תוכנית עבודה חדשה
              </p>
            </div>
          </div>
          <button
            type="button"
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow-xs shrink-0 self-end sm:self-auto"
          >
            <span>צפה בלקוחות</span>
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 4 Clickable KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* KPI 1: Active Clients */}
        <div
          onClick={() => onNavigate('/clients')}
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-emerald-500/50 cursor-pointer transition-all group"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">לקוחות פעילים</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{activeClientsCount}</span>
            <span className="text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              פעיל <ArrowLeft className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* KPI 2: Leads */}
        <div
          onClick={() => onNavigate('/pipeline')}
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-amber-500/50 cursor-pointer transition-all group"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">לידים ופניות</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{leadsCount}</span>
            <span className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-400 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5">
              ממתין <ArrowLeft className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* KPI 3: Sessions This Week */}
        <div
          onClick={() => onNavigate('/calendar')}
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-blue-500/50 cursor-pointer transition-all group"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">סשנים השבוע</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{sessionsThisWeek}</span>
            <span className="text-xs text-slate-400">יומן טיפולים</span>
          </div>
        </div>

        {/* KPI 4: Open Tasks */}
        <div
          onClick={() => onNavigate('/tasks')}
          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm hover:border-rose-500/50 cursor-pointer transition-all group"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400 font-bold mb-1">משימות פתוחות</p>
          <div className="flex items-end justify-between">
            <span className="text-3xl font-bold text-slate-800 dark:text-white">{openTasks.length}</span>
            <span className="text-xs text-red-600 bg-red-50 dark:bg-red-950/50 dark:text-red-400 px-1.5 py-0.5 rounded font-bold">
              דחוף
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid: Today's Sessions & Open Tasks */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Sessions Panel */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CalendarIcon className="w-4 h-4 text-primary" />
                מפגשים טיפוליים להיום ({todaySessions.length})
              </h3>
              <button
                onClick={() => onNavigate('/calendar')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                לכל היומן <ArrowLeft className="w-3 h-3" />
              </button>
            </div>

            {todaySessions.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl my-2">
                <p className="text-xs font-medium">אין מפגשים מתוכננים להיום</p>
                <p className="text-[11px] mt-0.5 text-muted-foreground">תוכל לקבוע מפגשים ביומן הטיפולים</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {todaySessions.map((s) => {
                  const client = dataStore.getClientById(s.client_id);
                  const timeStr = formatHebrewDate(s.session_date, 'HH:mm');
                  const statusInfo = SESSION_STATUS_LABELS[s.status] || {
                    label: s.status || 'מתוכנן',
                    class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                  };

                  return (
                    <div
                      key={s.id}
                      onClick={() => onNavigate(`/clients/${s.client_id}`)}
                      className="p-3 bg-muted/30 hover:bg-muted border border-border/80 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="px-2.5 py-1 bg-primary/10 text-primary font-mono text-xs font-bold rounded-lg border border-primary/20">
                          {timeStr}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">
                            {client?.full_name || 'מטופל לא ידוע'}
                          </h4>
                          <span className="text-[11px] text-muted-foreground truncate block">
                            {s.notes || client?.selected_reading || 'טיפול קבלי / איזון ספירות'}
                          </span>
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity Chart */}
          <div className="mt-6 pt-4 border-t border-border">
            <h4 className="text-[11px] font-bold text-muted-foreground mb-2">פריסת מפגשים שבועית</h4>
            <div className="h-28 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <XAxis dataKey="day" stroke="currentColor" fontSize={10} tickLine={false} />
                  <YAxis stroke="currentColor" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderRadius: '8px', fontSize: '11px' }}
                  />
                  <Bar dataKey="מפגשים" fill="oklch(0.62 0.13 200)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Open Tasks Panel */}
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 border-b border-border pb-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-rose-500" />
                משימות קרובות לביצוע ({openTasks.length})
              </h3>
              <button
                onClick={() => onNavigate('/tasks')}
                className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              >
                לכל המשימות <ArrowLeft className="w-3 h-3" />
              </button>
            </div>

            {openTasks.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground border border-dashed border-border rounded-xl my-2">
                <p className="text-xs font-medium">אין משימות פתוחות כרגע</p>
                <p className="text-[11px] mt-0.5 text-muted-foreground">כל הכבוד! כל המשימות בוצעו בהצלחה</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {openTasks.slice(0, 5).map((t) => {
                  const client = t.client_id ? dataStore.getClientById(t.client_id) : null;
                  const dueDateStr = t.due_date ? formatHebrewDate(t.due_date, 'dd/MM HH:mm') : 'ללא תאריך';

                  return (
                    <div
                      key={t.id}
                      className="p-3 bg-muted/30 border border-border/80 rounded-xl flex items-start gap-3 hover:border-primary/40 transition-all"
                    >
                      <button
                        onClick={() => handleToggleTask(t.id, t.status)}
                        className="mt-0.5 text-muted-foreground hover:text-primary transition-colors"
                      >
                        <div className="w-4 h-4 rounded border border-muted-foreground/60 flex items-center justify-center hover:bg-primary/10"></div>
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-foreground truncate">{t.title}</h4>
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {dueDateStr}
                          </span>
                        </div>
                        {t.description && (
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {t.description}
                          </p>
                        )}
                        {client && (
                          <span className="inline-block mt-1 text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded">
                            {client.full_name || 'מטופל'}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground">ניהול משימות שוטף ותזכורות לטיפול</span>
            <button
              onClick={() => onNavigate('/tasks')}
              className="px-3 py-1.5 bg-muted hover:bg-muted/80 text-foreground text-xs font-bold rounded-lg transition-colors"
            >
              + משימה חדשה
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
