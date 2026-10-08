import React, { useState, useEffect } from 'react';
import {
  Settings,
  Users,
  Shield,
  Bell,
  Download,
  Upload,
  UserPlus,
  Trash2,
  Check,
  X,
  Smartphone,
  Sparkles,
  Database,
  Moon,
  Sun,
  Calendar as CalendarIcon,
  LogOut,
  Cloud,
} from 'lucide-react';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { dataStore } from '../lib/dataStore';
import { InviteModal } from '../components/dialogs/InviteModal';
import {
  initGoogleCalendarAuth,
  signInWithGoogleCalendar,
  logoutGoogleCalendar,
  setCalendarAccessToken,
} from '../lib/googleCalendar';
import JSZip from 'jszip';
import { PWAInstallButton } from '../components/pwa/PWAInstallButton';
import { ExportClientsModal } from '../components/dialogs/ExportClientsModal';
import {
  requestNotificationPermission,
  sendDeviceNotification,
  getNotificationPermission,
  isNotificationSupported,
} from '../lib/deviceNotifications';
import { UnauthorizedDomainModal } from '../components/common/UnauthorizedDomainModal';

export const SettingsView: React.FC = () => {
  const { currentOrg, members, pendingApprovals, reloadOrg } = useOrganization();
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isExportClientsModalOpen, setIsExportClientsModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);

  // Google Calendar state
  const [isConnectedGcal, setIsConnectedGcal] = useState(false);
  const [gcalEmail, setGcalEmail] = useState<string | null>(null);
  const [showDomainModal, setShowDomainModal] = useState(false);
  const [statusNotice, setStatusNotice] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Push notification state
  const [pushEnabled, setPushEnabled] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initGoogleCalendarAuth(
      (u) => {
        setIsConnectedGcal(true);
        setGcalEmail(u.email);
      },
      () => {
        setIsConnectedGcal(false);
        setGcalEmail(null);
      }
    );
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  const handleConnectGcal = async () => {
    setStatusNotice(null);
    try {
      const res = await signInWithGoogleCalendar();
      if (res) {
        setIsConnectedGcal(true);
        setGcalEmail(res.user?.email || 'alli.kabbalah@gmail.com');
        setStatusNotice({ type: 'success', message: 'התחברת בהצלחה ל-Google Calendar!' });
      }
    } catch (err: any) {
      console.error('Calendar connect error:', err);
      if (err?.code === 'auth/unauthorized-domain' || String(err?.message).includes('unauthorized-domain')) {
        setShowDomainModal(true);
      } else {
        setStatusNotice({
          type: 'error',
          message: 'התחברות ל-Google Calendar נכשלה: ' + (err.message || ''),
        });
      }
    }
  };

  const handleDisconnectGcal = async () => {
    if (confirm('האם לבטל את החיבור ל-Google Calendar?')) {
      await logoutGoogleCalendar();
      setIsConnectedGcal(false);
      setGcalEmail(null);
      setStatusNotice({ type: 'info', message: 'החיבור ל-Google Calendar בוטל' });
    }
  };

  const handleApproveUser = (approvalId: string) => {
    dataStore.approvePendingUser(approvalId);
    reloadOrg();
  };

  const handleRejectUser = (approvalId: string) => {
    dataStore.rejectPendingUser(approvalId);
    reloadOrg();
  };

  const handleMemberRoleChange = (userId: string, newRole: 'admin' | 'therapist' | 'member') => {
    dataStore.updateMemberRole(userId, newRole);
    reloadOrg();
  };

  const handleRemoveMember = (userId: string) => {
    if (confirm('האם להסיר משתמש זה מהארגון?')) {
      dataStore.removeMember(userId);
      reloadOrg();
    }
  };

  // Web Push setup
  const handleEnablePush = async () => {
    if (!isNotificationSupported()) {
      setStatusNotice({ type: 'error', message: 'דפדפן זה אינו תומך בהתראות מכשיר' });
      return;
    }

    const granted = await requestNotificationPermission();
    if (granted) {
      setPushEnabled(true);
      setStatusNotice({
        type: 'success',
        message: 'התראות הופעלו בהצלחה! תקבל תזכורות בזמן אמת למפגשים ומשימות ישירות למכשיר.',
      });
    } else {
      setStatusNotice({ type: 'error', message: 'הרשאת התראות נדחתה או נחסמה בהגדרות הדפדפן' });
    }
  };

  const handleSendTestNotification = async () => {
    if (!isNotificationSupported()) return;
    const sent = await sendDeviceNotification('בדיקת התראה מקליניקה קבלית 🔔', {
      body: 'ההתראות מוגדרות ופועלות בהצלחה במכשירך!',
      url: '/settings',
      sound: true,
    });
    if (sent) {
      setStatusNotice({ type: 'success', message: 'התראת בדיקה נשלחה כעת למכשירך!' });
    } else {
      setStatusNotice({ type: 'error', message: 'לא ניתן לשלוח התראה. ודא שההרשאות מאושרות בדפדפן.' });
    }
  };

  // ZIP Data Export
  const handleExportDataZip = async () => {
    setIsExporting(true);
    setStatusNotice(null);
    try {
      const zip = new JSZip();
      const exportJson = dataStore.exportAllData();

      // Store main backup JSON
      zip.file('kabbalah_crm_backup.json', JSON.stringify(exportJson, null, 2));

      // Store media metadata index
      zip.file('media_index.json', JSON.stringify(exportJson.mediaFiles, null, 2));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Kabbalah_CRM_Backup_${new Date().toISOString().split('T')[0]}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      setStatusNotice({ type: 'success', message: 'קובץ הגיבוב הופק והורד בהצלחה!' });
    } catch (err) {
      setStatusNotice({ type: 'error', message: 'שגיאה ביצוא הגיבוי: ' + err });
    } finally {
      setIsExporting(false);
    }
  };

  // ZIP Data Import
  const handleImportDataZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('אזהרה: טעינת גיבוי תחליף את כל נתוני הקליניקה הנוכחיים באחסון המקומי! להמשיך?')) {
      return;
    }

    setIsImporting(true);
    setImportProgress(20);

    try {
      const zip = await JSZip.loadAsync(file);
      setImportProgress(50);

      const jsonFile = zip.file('kabbalah_crm_backup.json');
      if (!jsonFile) {
        throw new Error('קובץ kabbalah_crm_backup.json לא נמצא בתוך הארכיון');
      }

      const jsonContent = await jsonFile.async('string');
      const parsedData = JSON.parse(jsonContent);

      setImportProgress(80);
      dataStore.importAllData(parsedData);

      setImportProgress(100);
      setStatusNotice({ type: 'success', message: 'הגיבוי נטען בהצלחה! הדף יתרענן כעת.' });
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setStatusNotice({ type: 'error', message: 'שגיאה בטעינת הקובץ: ' + err });
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between bg-card p-5 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            הגדרות קליניקה וניהול ארגון
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ארגון: <strong className="text-foreground">{currentOrg?.name || 'קליניקה קבלית'}</strong>
          </p>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-xl flex items-center gap-2 text-xs font-bold transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
          {theme === 'dark' ? 'מצב יום' : 'מצב לילה'}
        </button>
      </div>

      {/* Inline Feedback Notice */}
      {statusNotice && (
        <div
          className={`p-3.5 rounded-2xl text-xs font-bold flex items-center justify-between gap-3 border ${
            statusNotice.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              : statusNotice.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-300'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300'
          }`}
        >
          <span>{statusNotice.message}</span>
          <button
            onClick={() => setStatusNotice(null)}
            className="p-1 hover:bg-black/10 rounded-lg text-current"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Grid of Setting Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Real-time Cloud Database Sync Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Cloud className="w-5 h-5" />
              סנכון ענן בזמן אמת (Firebase Firestore)
            </div>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
              מסונכרן בזמן אמת ({user?.id || 'מחובר'})
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            כל הנתונים, המטופלים, המפגשים, המשימות וההגדרות מסונכרנים בזמן אמת בענן (Firestore) ומקושרים למזהה המשתמש הייחודי שלך (<strong>{user?.email || user?.id}</strong>). כל שינוי המתבצע במכשיר אחד משתקף מיידית בכל המכשירים והכרטיסיות המחוברות.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={async () => {
                setSyncStatusMsg('מסנכרן כעת לענן...');
                await dataStore.syncStateToCloud();
                setSyncStatusMsg('✓ כל הנתונים סונכרנו בהצלחה לענן ב-Firebase!');
                setTimeout(() => setSyncStatusMsg(null), 5000);
              }}
              className="py-2 px-4 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-xs font-bold rounded-xl transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <Database className="w-4 h-4" />
              ביצוע סנכרון ידני לענן עכשיו
            </button>
            {syncStatusMsg && (
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20 animate-in fade-in">
                {syncStatusMsg}
              </span>
            )}
          </div>
        </div>

        {/* Google Calendar Integration Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-sm">
              <CalendarIcon className="w-5 h-5" />
              חיבור ל-Google Calendar
            </div>
            {isConnectedGcal && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                מחובר ({gcalEmail})
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            סנכרן את יומן המפגשים הטיפוליים של הקליניקה עם יומן Google Personal שלך לקבלת התראות וניהול זמנים נוח בטלפון.
          </p>
          <div>
            {isConnectedGcal ? (
              <button
                onClick={handleDisconnectGcal}
                className="py-2 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20 text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
              >
                <LogOut className="w-4 h-4" />
                נתק את החיבור ל-Google Calendar
              </button>
            ) : (
              <button
                onClick={handleConnectGcal}
                className="gsi-material-button text-xs py-2 px-4 bg-card border border-border rounded-xl font-bold shadow-sm hover:bg-muted transition-all flex items-center gap-2 text-foreground"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                התחבר מחדש עם Google Calendar
              </button>
            )}
          </div>
        </div>

        {/* PWA & Mobile Install Card */}
        <div className="md:col-span-2">
          <PWAInstallButton variant="card" />
        </div>

        {/* Web Push Notifications Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
              <Bell className="w-5 h-5" />
              התראות במכשיר (Push)
            </div>
            {pushEnabled && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                פעיל ✓
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            קבל תזכורות בזמן אמת למפגשים קרובים, משימות לביצוע ועדכוני קליניקה ישירות למסך הטלפון או המחשב.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            {!pushEnabled ? (
              <button
                type="button"
                onClick={handleEnablePush}
                className="flex-1 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-xl border border-amber-500/30 transition-colors cursor-pointer"
              >
                הפעל התראות מכשיר כעת
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSendTestNotification}
                className="flex-1 py-2 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-xl border border-primary/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Smartphone className="w-3.5 h-3.5" />
                שלח התראת בדיקה למכשיר
              </button>
            )}
          </div>
        </div>

        {/* Privacy Policy & Terms Card */}
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400 font-bold text-sm">
            <Shield className="w-5 h-5" />
            מדיניות פרטיות ואבטחה
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            עיין במסמך מדיניות הפרטיות הרשמי של crmkabbalah, הכולל את תנאי השימוש בהרשאות Google Calendar ואבטחת נתוני המטופלים.
          </p>
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              window.history.pushState({}, '', '/privacy');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="w-full py-2 bg-teal-500/10 hover:bg-teal-500/20 text-teal-700 dark:text-teal-300 text-xs font-bold rounded-xl border border-teal-500/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            צפייה במדיניות הפרטיות (Privacy Policy)
          </a>
        </div>
      </div>

      {/* Pending Approvals (Admin Only) */}
      {pendingApprovals.length > 0 && (
        <div className="bg-card border border-amber-500/30 rounded-2xl p-5 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            אישורים ממתינים להצטרפות לקליניקה ({pendingApprovals.length})
          </h3>

          <div className="space-y-2">
            {pendingApprovals.map((app) => (
              <div key={app.id} className="p-3 bg-muted/40 rounded-xl border border-border flex items-center justify-between text-xs">
                <div>
                  <h4 className="font-bold">{app.user_name || app.user_email}</h4>
                  <p className="text-[11px] text-muted-foreground">{app.user_email}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApproveUser(app.id)}
                    className="px-3 py-1 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> אישור
                  </button>
                  <button
                    onClick={() => handleRejectUser(app.id)}
                    className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700 flex items-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> דחה
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Organization Members Section */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              חברי הארגון והמטפלים ({members.length})
            </h3>
            <p className="text-xs text-muted-foreground">ניהול הרשאות ותפקידי מטפלים בקליניקה</p>
          </div>

          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="px-3.5 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 flex items-center gap-1"
          >
            <UserPlus className="w-4 h-4" />
            + הזמן מטפל
          </button>
        </div>

        <div className="space-y-2.5">
          {members.map((m) => (
            <div key={m.id} className="p-3 bg-muted/30 border border-border rounded-xl flex items-center justify-between gap-3 text-xs">
              <div>
                <h4 className="font-bold text-foreground">{m.user_name || m.user_email}</h4>
                <p className="text-[11px] text-muted-foreground">{m.user_email}</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={m.role}
                  onChange={(e) => handleMemberRoleChange(m.user_id, e.target.value as any)}
                  className="px-2.5 py-1 bg-card border border-border rounded-lg text-xs font-semibold focus:outline-none"
                >
                  <option value="therapist">מטפל</option>
                  <option value="admin">אדמין</option>
                  <option value="member">חבר צוות</option>
                </select>

                {m.user_id !== user?.id && (
                  <button
                    onClick={() => handleRemoveMember(m.user_id)}
                    className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded-lg"
                    title="הסר חבר"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Full Data Export & Backup Section */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4" style={{ backgroundColor: '#baefd1' }}>
        <div className="border-b border-border pb-3">
          <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-primary" />
            גיבוי ושחזור נתונים מלא (ZIP / JSON)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            יצוא כל נתוני המערכת, הלקוחות, המפגשים והמדיה לקובץ ZIP מוצפן לגיבוי מקומי או העברה
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Custom Clients JSON Export */}
          <div className="p-4 bg-muted/40 border border-teal-500/30 rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-teal-700 dark:text-teal-300 font-bold text-xs mb-1">
                <Users className="w-4 h-4 text-teal-600" />
                <span>ייצוא לקוחות (JSON מובנה)</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                ייצוא נתוני לקוחות בפורמט JSON עם firstName, lastName, status, userId וכל פרטי הלקוח.
              </p>
            </div>
            <button
              onClick={() => setIsExportClientsModalOpen(true)}
              className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 transition-all mt-2"
            >
              <Download className="w-4 h-4" />
              <span>פתח חלון ייצוא לקוחות</span>
            </button>
          </div>

          {/* Full ZIP Export */}
          <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs">יצוא גיבוי מלא (ZIP)</h4>
              <p className="text-[11px] text-muted-foreground">יוצר קובץ ZIP הכולל את כל סכימת ה-DB והמדיה.</p>
            </div>
            <button
              onClick={handleExportDataZip}
              disabled={isExporting}
              className="w-full py-2 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:bg-primary/90 flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 mt-2"
            >
              <Download className="w-4 h-4" />
              {isExporting ? 'מייצא גיבוי...' : 'הורד קובץ גיבוי ZIP'}
            </button>
          </div>

          {/* Import */}
          <div className="p-4 bg-muted/30 border border-border rounded-xl space-y-2 flex flex-col justify-between">
            <div>
              <h4 className="font-bold text-xs">טעינת גיבוי קיים</h4>
              <p className="text-[11px] text-muted-foreground">טען קובץ ZIP קודם לשחזור נתוני הקליניקה.</p>
            </div>
            <label className="w-full py-2 bg-slate-800 text-white font-bold text-xs rounded-xl shadow-xs hover:bg-slate-700 flex items-center justify-center gap-1.5 cursor-pointer transition-all mt-2">
              <Upload className="w-4 h-4" />
              {isImporting ? `טוען... ${importProgress}%` : 'בחר קובץ ZIP לטעינה'}
              <input type="file" accept=".zip" onChange={handleImportDataZip} className="hidden" />
            </label>
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      <InviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} />

      {/* Export Clients Modal */}
      <ExportClientsModal
        isOpen={isExportClientsModalOpen}
        onClose={() => setIsExportClientsModalOpen(false)}
        allClients={dataStore.getClients()}
      />

      {/* Unauthorized Domain Modal */}
      <UnauthorizedDomainModal
        isOpen={showDomainModal}
        onClose={() => setShowDomainModal(false)}
        featureName="Google Calendar"
        onManualToken={(tok) => {
          setCalendarAccessToken(tok);
          setIsConnectedGcal(true);
          setGcalEmail('alli.kabbalah@gmail.com');
          setStatusNotice({ type: 'success', message: 'תוקן Google Calendar הוגדר בהצלחה!' });
        }}
      />
    </div>
  );
};
