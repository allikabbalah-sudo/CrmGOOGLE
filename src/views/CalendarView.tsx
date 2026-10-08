import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  CheckSquare,
  RefreshCw,
  ExternalLink,
  LogOut,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isSameDay,
  parseISO,
  addHours,
} from 'date-fns';
import { dataStore } from '../lib/dataStore';
import { Session, Task, SESSION_STATUS_LABELS } from '../types';
import { formatHebrewDate, HEBREW_DAYS } from '../lib/utils';
import { SessionEditDialog } from '../components/dialogs/SessionEditDialog';
import {
  initGoogleCalendarAuth,
  signInWithGoogleCalendar,
  logoutGoogleCalendar,
  fetchGoogleCalendarEvents,
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  GoogleCalendarEvent,
  getCalendarAccessToken,
} from '../lib/googleCalendar';

interface CalendarViewProps {
  onNavigate: (path: string) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ onNavigate }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [searchClientQuery, setSearchClientQuery] = useState('');

  // Session Edit Dialog
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);

  // Google Calendar Integration States
  const [gcalUserEmail, setGcalUserEmail] = useState<string | null>(null);
  const [isConnectedGcal, setIsConnectedGcal] = useState(false);
  const [gcalEvents, setGcalEvents] = useState<GoogleCalendarEvent[]>([]);
  const [isLoadingGcal, setIsLoadingGcal] = useState(false);
  const [showGcalOverlay, setShowGcalOverlay] = useState(true);
  const [gcalError, setGcalError] = useState<string | null>(null);

  // Confirmation Modals
  const [confirmSyncSession, setConfirmSyncSession] = useState<{ session: Session; clientName: string } | null>(null);
  const [confirmSyncMonth, setConfirmSyncMonth] = useState(false);
  const [confirmDeleteGcalEvent, setConfirmDeleteGcalEvent] = useState<GoogleCalendarEvent | null>(null);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  const clients = dataStore.getClients() || [];
  const allSessions = dataStore.getSessions() || [];
  const allTasks = dataStore.getTasks() || [];

  // Init Google Calendar auth listener
  useEffect(() => {
    const unsubscribe = initGoogleCalendarAuth(
      (user, token) => {
        setIsConnectedGcal(true);
        setGcalUserEmail(user.email);
      },
      () => {
        setIsConnectedGcal(false);
        setGcalUserEmail(null);
        setGcalEvents([]);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Fetch Google Calendar events when month changes or connection changes
  useEffect(() => {
    if (isConnectedGcal) {
      loadGoogleEvents();
    }
  }, [isConnectedGcal, currentMonth]);

  const loadGoogleEvents = async () => {
    const token = getCalendarAccessToken();
    if (!token) return;

    setIsLoadingGcal(true);
    setGcalError(null);
    try {
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(monthStart);
      const start = startOfWeek(monthStart, { weekStartsOn: 0 });
      const end = endOfWeek(monthEnd, { weekStartsOn: 0 });

      const events = await fetchGoogleCalendarEvents(start, end);
      setGcalEvents(events);
    } catch (err: any) {
      console.error('Failed to load Google Calendar events:', err);
      setGcalError(err.message || 'שגיאה בטעינת אירועים מ-Google Calendar');
    } finally {
      setIsLoadingGcal(false);
    }
  };

  const handleConnectGoogle = async () => {
    setGcalError(null);
    try {
      const res = await signInWithGoogleCalendar();
      if (res) {
        setIsConnectedGcal(true);
        setGcalUserEmail(res.user.email);
        setSyncStatusMsg(`התחברת בהצלחה ל-Google Calendar (${res.user.email})`);
        setTimeout(() => setSyncStatusMsg(null), 4000);
      }
    } catch (err: any) {
      setGcalError('התחברות ל-Google Calendar נכשלה: ' + (err.message || ''));
    }
  };

  const handleDisconnectGoogle = async () => {
    await logoutGoogleCalendar();
    setIsConnectedGcal(false);
    setGcalUserEmail(null);
    setGcalEvents([]);
    setSyncStatusMsg('החיבור ל-Google Calendar נותק');
    setTimeout(() => setSyncStatusMsg(null), 3500);
  };

  // Perform sync single session to Google Calendar
  const executeSyncSession = async (session: Session, clientName: string) => {
    setConfirmSyncSession(null);
    setIsLoadingGcal(true);
    setGcalError(null);
    try {
      const startDate = new Date(session.session_date);
      const endDate = addHours(startDate, 1); // 1 hour session

      const createdEvent = await createGoogleCalendarEvent({
        summary: `מפגש טיפולי - ${clientName}`,
        description: `מפגש בקליניקה קבלית.\nסטטוס: ${SESSION_STATUS_LABELS[session.status]?.label || session.status}\nהערות: ${session.notes || 'אין'}`,
        startDateTime: startDate.toISOString(),
        endDateTime: endDate.toISOString(),
      });

      setSyncStatusMsg(`המפגש של ${clientName} סונכרן בהצלחה ל-Google Calendar!`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
      loadGoogleEvents();
    } catch (err: any) {
      setGcalError('שגיאה בסנכרון ל-Google Calendar: ' + (err.message || ''));
    } finally {
      setIsLoadingGcal(false);
    }
  };

  // Perform bulk sync all sessions of current month
  const executeBulkSyncMonth = async () => {
    setConfirmSyncMonth(false);
    setIsLoadingGcal(true);
    setGcalError(null);

    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);

    const monthSessions = activeSessions.filter((s) => {
      const d = parseISO(s.session_date);
      return d >= monthStart && d <= monthEnd;
    });

    let successCount = 0;
    try {
      for (const s of monthSessions) {
        const client = dataStore.getClientById(s.client_id);
        const clientName = client?.full_name || 'מטופל';
        const startDate = new Date(s.session_date);
        const endDate = addHours(startDate, 1);

        await createGoogleCalendarEvent({
          summary: `מפגש טיפולי - ${clientName}`,
          description: `מפגש בקליניקה קבלית.\nסטטוס: ${SESSION_STATUS_LABELS[s.status]?.label || s.status}\nהערות: ${s.notes || ''}`,
          startDateTime: startDate.toISOString(),
          endDateTime: endDate.toISOString(),
        });
        successCount++;
      }
      setSyncStatusMsg(`סונכרנו בהצלחה ${successCount} מפגשים ל-Google Calendar!`);
      setTimeout(() => setSyncStatusMsg(null), 5000);
      loadGoogleEvents();
    } catch (err: any) {
      setGcalError(`סונכרנו ${successCount} מפגשים לפני שארעה שגיאה: ` + (err.message || ''));
    } finally {
      setIsLoadingGcal(false);
    }
  };

  // Perform delete event from Google Calendar
  const executeDeleteGcalEvent = async (event: GoogleCalendarEvent) => {
    setConfirmDeleteGcalEvent(null);
    setIsLoadingGcal(true);
    setGcalError(null);
    try {
      await deleteGoogleCalendarEvent(event.id);
      setSyncStatusMsg(`האירוע "${event.summary}" הוסר מ-Google Calendar`);
      setTimeout(() => setSyncStatusMsg(null), 4000);
      loadGoogleEvents();
    } catch (err: any) {
      setGcalError('שגיאה במחיקת אירוע: ' + (err.message || ''));
    } finally {
      setIsLoadingGcal(false);
    }
  };

  // Filter clients for search dropdown
  const filteredClientsSearch = (clients || [])
    .filter((c) => c && c.full_name && c.full_name.toLowerCase().includes((searchClientQuery || '').toLowerCase()))
    .slice(0, 8);

  // Filter sessions by client
  const activeSessions = allSessions.filter((s) => {
    if (selectedClientId !== 'all' && s.client_id !== selectedClientId) return false;
    return true;
  });

  const activeTasks = allTasks.filter((t) => {
    if (selectedClientId !== 'all' && t.client_id !== selectedClientId) return false;
    return t.status === 'todo' && t.due_date;
  });

  const getGcalWebLink = (session: Session, clientName: string) => {
    const start = session.session_date ? new Date(session.session_date) : new Date();
    const end = addHours(start, 1);
    const fmt = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, '');
    const title = encodeURIComponent(`מפגש טיפולי — ${clientName}`);
    const details = encodeURIComponent(session.notes ? `מפגש טיפולי בקליניקה.\nהערות: ${session.notes}` : 'מפגש טיפולי בקליניקה קבלית');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${fmt(start)}/${fmt(end)}&details=${details}`;
  };

  // Calendar Math
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const daysGrid: Date[] = [];
  let day = calendarStart;
  while (day <= calendarEnd) {
    daysGrid.push(day);
    day = addDays(day, 1);
  }

  // Selected Day Items
  const daySessions = activeSessions
    .filter((s) => isSameDay(parseISO(s.session_date), selectedDay))
    .sort((a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime());
  const dayTasks = activeTasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), selectedDay));
  const dayGcalEvents = gcalEvents.filter((ev) => {
    if (!ev.start.dateTime && !ev.start.date) return false;
    const evDate = parseISO(ev.start.dateTime || ev.start.date || '');
    return isSameDay(evDate, selectedDay);
  });

  const handleUpdateSessionStatus = (s: Session, newStatus: any) => {
    dataStore.updateSession(s.id, { status: newStatus });
  };

  const handleToggleTaskStatus = (t: Task) => {
    dataStore.updateTask(t.id, { status: t.status === 'todo' ? 'done' : 'todo' });
  };

  return (
    <div className="space-y-5">
      {/* Top Header & Client Search Filter */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            יומן טיפולים ומפגשים בקליניקה
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ניהול לוח זמנים, מפגשים קבליים, סנכרון ל-Google Calendar ומשימות
          </p>
        </div>

        {/* Client Search Filter */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="סינון לפי שם לקוח בקליניקה..."
            value={searchClientQuery}
            onChange={(e) => setSearchClientQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />

          {searchClientQuery.trim() && (
            <div className="absolute right-0 left-0 mt-1 bg-card border border-border rounded-xl shadow-xl py-1 z-50 text-right">
              <button
                onClick={() => {
                  setSelectedClientId('all');
                  setSearchClientQuery('');
                }}
                className="w-full px-3 py-1.5 text-xs text-primary font-bold hover:bg-muted text-right"
              >
                הצג את כל הלקוחות
              </button>
              {filteredClientsSearch.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedClientId(c.id);
                    setSearchClientQuery(c.full_name);
                  }}
                  className="w-full px-3 py-1.5 text-xs hover:bg-muted text-right truncate block"
                >
                  {c.full_name} ({c.phone})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Google Calendar Banner / Connection Bar */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2zm-7 5h5v5h-5z"/>
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-foreground">Google Calendar סנכרון יומן</h3>
              {isConnectedGcal ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  מחובר
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                  לא מחובר
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isConnectedGcal
                ? `מחובר באמצעות ${gcalUserEmail} • הצגת אירועים וסנכרון מפגשי קליניקה`
                : 'חבר את Google Calendar כדי לסנכרן את המפגשים הטיפוליים ישירות ליומן האישי שלך'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {isConnectedGcal ? (
            <>
              <button
                onClick={() => setConfirmSyncMonth(true)}
                disabled={isLoadingGcal}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGcal ? 'animate-spin' : ''}`} />
                סנכרן את מפגשי החודש
              </button>

              <button
                onClick={handleDisconnectGoogle}
                title="נתק מ-Google Calendar"
                className="p-2 border border-border hover:bg-rose-500/10 hover:text-rose-600 rounded-xl text-muted-foreground transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handleConnectGoogle}
              className="gsi-material-button text-xs py-2 px-4 bg-card border border-border rounded-xl font-bold shadow-sm hover:bg-muted transition-all flex items-center gap-2 text-foreground"
            >
              <svg className="w-4 h-4" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              התחבר עם Google Calendar
            </button>
          )}
        </div>
      </div>

      {/* Notifications / Errors */}
      {syncStatusMsg && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          {syncStatusMsg}
        </div>
      )}

      {gcalError && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {gcalError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main Monthly Calendar Grid (2 cols) */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
          {/* Calendar Header Month Nav */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 hover:bg-muted rounded-xl transition-colors text-foreground"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <h3 className="font-bold text-base text-foreground">
              {formatHebrewDate(currentMonth, 'MMMM yyyy')}
            </h3>

            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 hover:bg-muted rounded-xl transition-colors text-foreground"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          </div>

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center border-b border-border pb-2">
            {HEBREW_DAYS.map((d) => (
              <span key={d} className="text-xs font-bold text-muted-foreground">
                {d}
              </span>
            ))}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {daysGrid.map((d, idx) => {
              const isSelected = isSameDay(d, selectedDay);
              const isCurrentMonth = isSameMonth(d, currentMonth);

              // Check items on this day
              const daySess = activeSessions.filter((s) => isSameDay(parseISO(s.session_date), d));
              const dayTsks = activeTasks.filter((t) => t.due_date && isSameDay(parseISO(t.due_date), d));
              const dayGcal = gcalEvents.filter((ev) => {
                if (!ev.start.dateTime && !ev.start.date) return false;
                const evDate = parseISO(ev.start.dateTime || ev.start.date || '');
                return isSameDay(evDate, d);
              });

              const hasItems = daySess.length > 0 || dayTsks.length > 0 || dayGcal.length > 0;

              return (
                <button
                  key={`grid-day-${format(d, 'yyyy-MM-dd')}-${idx}`}
                  onClick={() => setSelectedDay(d)}
                  className={`min-h-[70px] p-1.5 rounded-xl border transition-all text-right flex flex-col justify-between relative ${
                    isSelected
                      ? 'border-primary ring-2 ring-primary/30 bg-primary/10'
                      : isCurrentMonth
                      ? 'bg-card border-border/60 hover:bg-muted/40'
                      : 'bg-muted/20 border-transparent text-muted-foreground/40'
                  }`}
                >
                  <span
                    className={`text-xs font-bold ${
                      isSameDay(d, new Date())
                        ? 'bg-primary text-primary-foreground px-1.5 py-0.5 rounded-md inline-block'
                        : isCurrentMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }`}
                  >
                    {format(d, 'd')}
                  </span>

                  {/* Indicators / Dots */}
                  {hasItems && (
                    <div className="flex flex-col gap-0.5 mt-1">
                      {daySess.slice(0, 2).map((s) => (
                        <div
                          key={`grid-sess-${s.id}`}
                          className="text-[9px] font-bold px-1 py-0.2 bg-primary/20 text-primary truncate rounded"
                        >
                          {formatHebrewDate(s.session_date, 'HH:mm')}
                        </div>
                      ))}

                      {/* Google Calendar event indicator */}
                      {dayGcal.slice(0, 1).map((ev, gIdx) => (
                        <div
                          key={`grid-gcal-${ev.id || gIdx}`}
                          className="text-[9px] font-bold px-1 py-0.2 bg-blue-500/20 text-blue-600 dark:text-blue-400 truncate rounded flex items-center gap-1"
                        >
                          <span className="w-1 h-1 rounded-full bg-blue-500" />
                          {ev.summary}
                        </div>
                      ))}

                      {dayTsks.length > 0 && (
                        <div className="text-[9px] font-bold px-1 py-0.2 bg-rose-500/20 text-rose-700 dark:text-rose-300 truncate rounded">
                          {dayTsks.length} משימות
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Day Details Panel */}
        <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-4">
          <div className="border-b border-border pb-3">
            <h3 className="font-bold text-sm text-foreground">
              לו"ז ליום {formatHebrewDate(selectedDay, 'EEEE, dd/MM/yyyy')}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {daySessions.length} מפגשים • {dayGcalEvents.length} אירועי Google • {dayTasks.length} משימות
            </p>
          </div>

          {/* Day Sessions */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wide">מפגשים טיפוליים בקליניקה</h4>
            {daySessions.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין מפגשים מתוכננים ליום זה.</p>
            ) : (
              <div className="space-y-2">
                {daySessions.map((s) => {
                  const client = dataStore.getClientById(s.client_id);
                  const clientName = client?.full_name || 'מטופל';
                  const stInfo = SESSION_STATUS_LABELS[s.status] || {
                    label: s.status || 'מתוכנן',
                    class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                  };

                  return (
                    <div
                      key={`day-panel-sess-${s.id}`}
                      className="p-3 bg-muted/30 border border-border/80 rounded-xl space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold text-primary">
                          {formatHebrewDate(s.session_date, 'HH:mm')}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${stInfo.class}`}>
                          {stInfo.label}
                        </span>
                      </div>

                      <h5
                        onClick={() => onNavigate(`/clients/${s.client_id}`)}
                        className="font-bold text-xs hover:text-primary hover:underline cursor-pointer"
                      >
                        {clientName}
                      </h5>

                      {s.notes && <p className="text-[11px] text-muted-foreground truncate">{s.notes}</p>}

                      {/* Actions including Sync to Google Calendar */}
                      <div className="pt-2 border-t border-border/40 flex flex-wrap items-center gap-1">
                        <button
                          onClick={() => handleUpdateSessionStatus(s, 'completed')}
                          className="px-2 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded hover:bg-emerald-700"
                        >
                          בוצע
                        </button>
                        <button
                          onClick={() => handleUpdateSessionStatus(s, 'postponed')}
                          className="px-2 py-1 bg-purple-600 text-white text-[10px] font-bold rounded hover:bg-purple-700"
                        >
                          נדחה
                        </button>
                        <button
                          onClick={() => handleUpdateSessionStatus(s, 'cancelled')}
                          className="px-2 py-1 bg-rose-600 text-white text-[10px] font-bold rounded hover:bg-rose-700"
                        >
                          בוטל
                        </button>
                        <button
                          onClick={() => {
                            setEditingSession(s);
                            setIsSessionDialogOpen(true);
                          }}
                          className="px-2 py-1 border border-border text-[10px] font-bold rounded hover:bg-muted"
                        >
                          ערוך
                        </button>

                        {/* Google Calendar sync button */}
                        <button
                          onClick={() => {
                            if (!isConnectedGcal) {
                              handleConnectGoogle();
                            } else {
                              setConfirmSyncSession({ session: s, clientName });
                            }
                          }}
                          title="סנכרן ל-Google Calendar דרך חשבון מחובר"
                          className="px-2 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded hover:bg-blue-500/20 transition-all flex items-center gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          סנכרן
                        </button>

                        {/* Direct Google Calendar Web Link */}
                        <a
                          href={getGcalWebLink(s, clientName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="פתח והוסף ישירות ב-Google Calendar Web"
                          className="px-2 py-1 bg-muted hover:bg-muted/80 border border-border text-foreground text-[10px] font-bold rounded transition-all flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3 text-primary" />
                          יומן Google
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Google Calendar Events Section */}
          {isConnectedGcal && (
            <div className="space-y-3 pt-3 border-t border-border">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  אירועי Google Calendar ליום זה
                </h4>
              </div>

              {dayGcalEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground">אין אירועים נוספים ב-Google Calendar ליום זה.</p>
              ) : (
                <div className="space-y-2">
                  {dayGcalEvents.map((ev, gIdx) => (
                    <div
                      key={`day-panel-gcal-${ev.id || gIdx}`}
                      className="p-2.5 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-1 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground text-xs">{ev.summary}</span>
                        <div className="flex items-center gap-1">
                          {ev.htmlLink && (
                            <a
                              href={ev.htmlLink}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1 text-muted-foreground hover:text-blue-600"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            onClick={() => setConfirmDeleteGcalEvent(ev)}
                            className="p-1 text-muted-foreground hover:text-rose-600"
                            title="מחק מ-Google Calendar"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="text-[11px] text-muted-foreground font-mono">
                        {ev.start.dateTime ? formatHebrewDate(ev.start.dateTime, 'HH:mm') : 'כל היום'}
                        {ev.location ? ` • ${ev.location}` : ''}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Day Tasks */}
          <div className="space-y-3 pt-3 border-t border-border">
            <h4 className="text-xs font-bold text-rose-500 uppercase tracking-wide">משימות ליום זה</h4>
            {dayTasks.length === 0 ? (
              <p className="text-xs text-muted-foreground">אין משימות מתוכננות ליום זה.</p>
            ) : (
              <div className="space-y-2">
                {dayTasks.map((t) => (
                  <div key={`day-panel-task-${t.id}`} className="p-2.5 bg-muted/30 border border-border/80 rounded-xl flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleTaskStatus(t)}
                        className="p-1 text-muted-foreground hover:text-primary"
                      >
                        <CheckSquare className="w-4 h-4" />
                      </button>
                      <span className="font-bold truncate">{t.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {t.due_date ? formatHebrewDate(t.due_date, 'HH:mm') : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog: Single Session Sync */}
      {confirmSyncSession && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <CalendarIcon className="w-6 h-6" />
            </div>

            <div className="space-y-2 text-center">
              <h3 className="font-bold text-base text-foreground">אישור סנכרון מפגש ל-Google Calendar</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                האם ברצונך לייצא וליצור אירוע חדש ב-Google Calendar עבור המפגש של{' '}
                <strong className="text-foreground">{confirmSyncSession.clientName}</strong> בתאריך{' '}
                <strong className="text-foreground font-mono">
                  {formatHebrewDate(confirmSyncSession.session.session_date, 'dd/MM/yyyy HH:mm')}
                </strong>
                ?
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmSyncSession(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
              >
                ביטול
              </button>
              <button
                onClick={() => executeSyncSession(confirmSyncSession.session, confirmSyncSession.clientName)}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                אישור וסנכרון כעת
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Bulk Month Sync */}
      {confirmSyncMonth && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
              <RefreshCw className="w-6 h-6" />
            </div>

            <div className="space-y-2 text-center">
              <h3 className="font-bold text-base text-foreground">סנכרון כל מפגשי החודש ל-Google Calendar</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                פעולה זו תייצא את כל המפגשים הטיפוליים המתוכננים לחודש{' '}
                <strong className="text-foreground">{formatHebrewDate(currentMonth, 'MMMM yyyy')}</strong> למשתמש Google Calendar שלך ({gcalUserEmail}).
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmSyncMonth(false)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
              >
                ביטול
              </button>
              <button
                onClick={executeBulkSyncMonth}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                סנכרן את כל מפגשי החודש
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog: Delete Google Calendar Event */}
      {confirmDeleteGcalEvent && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 text-right">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="space-y-2 text-center">
              <h3 className="font-bold text-base text-foreground">מחיקת אירוע מ-Google Calendar</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                האם אתה בטוח שברצונך למחוק את האירוע{' '}
                <strong className="text-foreground">"{confirmDeleteGcalEvent.summary}"</strong> מיומן Google Calendar שלך?
                <br />
                לא ניתן לבטל פעולה זו.
              </p>
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteGcalEvent(null)}
                className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
              >
                ביטול
              </button>
              <button
                onClick={() => executeDeleteGcalEvent(confirmDeleteGcalEvent)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                מחק מאירועי Google
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session Edit Dialog */}
      <SessionEditDialog
        isOpen={isSessionDialogOpen}
        onClose={() => setIsSessionDialogOpen(false)}
        onSave={(sId, updates) => dataStore.updateSession(sId, updates)}
        session={editingSession}
      />
    </div>
  );
};

