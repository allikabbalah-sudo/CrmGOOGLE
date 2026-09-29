import React, { useState, useEffect, useMemo } from 'react';
import {
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageCircle,
  BookOpen,
  Heart,
  Plus,
  Trash2,
  Edit,
  Sparkles,
  ArrowRight,
  FileText,
  CheckSquare,
  Layers,
  Folder,
  ArrowDownUp,
  Clock,
  ListFilter,
  CheckCircle2,
  Camera,
  Upload,
  FileAudio,
  FileImage,
  Volume2,
  ExternalLink,
} from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { Client, Program, Session, CLIENT_STATUS_LABELS } from '../types';
import { formatHebrewDate, toWhatsAppUrl } from '../lib/utils';
import { ClientModal } from '../components/dialogs/ClientModal';
import { ProgramModal } from '../components/dialogs/ProgramModal';
import { SessionEditDialog } from '../components/dialogs/SessionEditDialog';
import { LiveReadingModal } from '../components/dialogs/LiveReadingModal';
import { FileGallery } from '../components/media/FileGallery';
import { TASK_PRIORITY_LABELS, SESSION_STATUS_LABELS } from '../types';
import { compressImageFile } from '../lib/indexedDbStorage';
import { ClientAvatar } from '../components/common/ClientAvatar';

interface ClientDetailViewProps {
  clientId: string;
  onNavigate: (path: string) => void;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onNavigate }) => {
  const cleanClientId = clientId.split('?')[0];

  const initialTab = useMemo<'general' | 'clinical' | 'media'>(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      if (search.includes('tab=media') || clientId.includes('tab=media')) return 'media';
      if (search.includes('tab=clinical') || clientId.includes('tab=clinical')) return 'clinical';
    }
    return 'general';
  }, [clientId]);

  const [activeTab, setActiveTab] = useState<'general' | 'clinical' | 'media'>(initialTab);
  const [callNoteInput, setCallNoteInput] = useState('');
  const [sessionSortOrder, setSessionSortOrder] = useState<'desc' | 'asc'>('desc');
  const [clinicalSubView, setClinicalSubView] = useState<'programs' | 'timeline'>('programs');
  const [, setStoreTick] = useState(0);

  // Subscribe to real-time updates from dataStore
  useEffect(() => {
    return dataStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  // Synchronize tab if prop or URL changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search || '';
      if (search.includes('tab=media') || clientId.includes('tab=media')) {
        setActiveTab('media');
      } else if (search.includes('tab=clinical') || clientId.includes('tab=clinical')) {
        setActiveTab('clinical');
      }
    }
  }, [clientId]);

  // Modals
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLiveReadingOpen, setIsLiveReadingOpen] = useState(false);

  const client = dataStore.getClientById(cleanClientId);
  const programs = dataStore.getPrograms(cleanClientId);
  const sessions = dataStore.getSessions(cleanClientId);
  const tasks = dataStore.getTasks().filter((t) => t.client_id === cleanClientId);

  // Fetch all media files related to this client (both direct and via client programs)
  const directMediaFiles = dataStore.getMediaFiles(cleanClientId) || [];
  const programIds = new Set(programs.map((p) => p.id));
  const allRelatedMedia = (dataStore.getAllMediaFiles() || []).filter(
    (m) => m.parent_id === cleanClientId || programIds.has(m.parent_id)
  );
  const mediaMap = new Map<string, any>();
  allRelatedMedia.forEach((m) => mediaMap.set(m.id, m));
  directMediaFiles.forEach((m) => mediaMap.set(m.id, m));
  const mediaFiles = Array.from(mediaMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  const handleAddNewSession = (programId?: string) => {
    const newSess = dataStore.addSession({
      client_id: cleanClientId,
      program_id: programId || null,
      session_date: new Date().toISOString(),
      status: 'scheduled',
      notes: '',
      audio_urls: [],
      image_urls: [],
    });
    setSelectedSession(newSess);
    setIsSessionDialogOpen(true);
  };

  const handleDeleteSession = (sessionId: string) => {
    if (confirm('האם אתה בטוח שברצונך למחוק מפגש זה לצמיתות?')) {
      dataStore.deleteSession(sessionId);
    }
  };

  if (!client) {
    return (
      <div className="p-12 text-center bg-card border border-border rounded-2xl space-y-3">
        <h3 className="font-bold text-base text-foreground">הלקוח המבוקש לא נמצא במערכת</h3>
        <button
          onClick={() => onNavigate('/clients')}
          className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl"
        >
          חזרה לרשימת הלקוחות
        </button>
      </div>
    );
  }

  const statusInfo = CLIENT_STATUS_LABELS[client.status] || {
    label: client.status || 'פעיל',
    color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    badge: 'bg-emerald-500',
  };
  const whatsappUrl = toWhatsAppUrl(client.phone, `Hello ${client.full_name}, How are you? Are you ready for today's session?`);

  const handleUpdateClient = (data: Partial<Client>) => {
    dataStore.updateClient(clientId, data);
  };

  const handleDirectAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageFile(file, 250, 250, 0.82);
      if (compressed) {
        dataStore.updateClient(clientId, { avatar_url: compressed });
      }
    } catch (err) {
      console.error('Failed to update avatar:', err);
    }
  };

  const handleRemoveAvatar = () => {
    if (confirm('האם להסיר את תמונת הפרופיל של הלקוח?')) {
      dataStore.updateClient(clientId, { avatar_url: undefined });
    }
  };

  const handleDeleteClient = () => {
    if (confirm(`האם אתה בטוח שברצונך למחוק את כרטיס הלקוח "${client.full_name}"? פעולה זו תמחק גם את כל המפגשים, התוכניות, הקבצים והמשימות המשויכות!`)) {
      dataStore.deleteClientCascading(clientId);
      onNavigate('/clients');
    }
  };

  const handleAddCallDoc = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callNoteInput.trim()) return;

    const dateFormatted = formatHebrewDate(new Date(), 'dd/MM/yyyy HH:mm');
    const newLine = `[${dateFormatted}] שיחה: ${callNoteInput.trim()}`;
    const existingNotes = client.notes ? `${newLine}\n\n${client.notes}` : newLine;

    dataStore.updateClient(clientId, { notes: existingNotes });
    setCallNoteInput('');
  };

  const handleSaveProgram = (progData: any) => {
    if (editingProgram) {
      dataStore.updateProgramWithSessions(editingProgram.id, progData);
    } else {
      dataStore.addProgram(progData);
    }
  };

  const handleSaveSession = (sessionId: string, updates: Partial<Session>) => {
    dataStore.updateSession(sessionId, updates);
  };

  const handlePerformReading = (readingType: string, summary: string, followupDays: number) => {
    dataStore.performLiveReading(clientId, readingType, summary, followupDays);
  };

  const handleUploadFile = async (file: File) => {
    const isImage = file.type.startsWith('image');
    let dataUrl = '';
    if (isImage) {
      dataUrl = await compressImageFile(file);
    } else {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    if (!dataUrl) return;

    dataStore.addMediaFile({
      url: dataUrl,
      name: file.name,
      size: Math.round(dataUrl.length * 0.75),
      type: file.type.startsWith('audio') ? 'audio' : 'image',
      category: 'client',
      parent_id: clientId,
    });
  };

  const handleUploadProgramFile = async (file: File, programId: string) => {
    const isImage = file.type.startsWith('image');
    let dataUrl = '';
    if (isImage) {
      dataUrl = await compressImageFile(file);
    } else {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string) || '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      });
    }

    if (!dataUrl) return;

    dataStore.addMediaFile({
      url: dataUrl,
      name: file.name,
      size: Math.round(dataUrl.length * 0.75),
      type: file.type.startsWith('audio') ? 'audio' : 'image',
      category: 'program',
      parent_id: programId,
    });
  };

  return (
    <div className="space-y-5">
      {/* Back Button */}
      <div>
        <button
          onClick={() => onNavigate('/clients')}
          className="text-xs text-muted-foreground hover:text-foreground font-semibold flex items-center gap-1 mb-2"
        >
          <ArrowRight className="w-4 h-4" />
          חזרה לרשימת הלקוחות
        </button>
      </div>

      {/* Main Profile Header Card */}
      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="relative group shrink-0">
              <ClientAvatar
                avatarUrl={client.avatar_url}
                name={client.full_name}
                className="w-16 h-16 border-2 border-primary/40 shadow-sm"
              />
              <label
                htmlFor="client-detail-avatar-upload"
                className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white cursor-pointer transition-opacity"
                title="החלף / העלה תמונת פרופיל"
              >
                <Camera className="w-5 h-5 drop-shadow" />
              </label>
              <input
                id="client-detail-avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleDirectAvatarUpload}
                className="hidden"
              />
              {client.avatar_url && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="absolute -bottom-1 -right-1 w-5 h-5 bg-rose-600 hover:bg-rose-700 text-white rounded-full flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition-opacity shadow-xs"
                  title="הסר תמונה"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold text-foreground">{client.full_name}</h1>
                <span className={`px-3 py-0.5 text-xs font-bold rounded-full border ${statusInfo.color}`}>
                  {statusInfo.label}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1 font-medium">
                {client.mother_name && <span>שם האם: <strong className="text-foreground">{client.mother_name}</strong></span>}
                {client.date_of_birth && <span>תאריך לידה: <strong className="text-foreground">{formatHebrewDate(client.date_of_birth)}</strong></span>}
                {client.last_completed_session_at && (
                  <span>מפגש אחרון: <strong className="text-foreground">{formatHebrewDate(client.last_completed_session_at, 'dd/MM/yyyy')}</strong></span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setIsLiveReadingOpen(true)}
              className="px-3.5 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 font-bold text-xs rounded-xl border border-amber-500/30 flex items-center gap-1.5 transition-all shadow-xs"
            >
              <Sparkles className="w-4 h-4 text-amber-500" />
              לייב רידינג
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-xs"
            >
              <MessageCircle className="w-4 h-4" />
              WhatsApp
            </a>

            <button
              onClick={() => setIsEditClientOpen(true)}
              className="px-3.5 py-2 border border-border hover:bg-muted font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <Edit className="w-3.5 h-3.5" />
              ערוך
            </button>

            <button
              onClick={handleDeleteClient}
              className="p-2 border border-border hover:bg-rose-500/10 text-rose-600 rounded-xl transition-colors"
              title="מחק כרטיס לקוח"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-border pb-1">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'general'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <User className="w-4 h-4" />
          פרטים אישיים ושיחות
        </button>

        <button
          onClick={() => setActiveTab('clinical')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'clinical'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Layers className="w-4 h-4" />
          תוכניות ומפגשי טיפול ({sessions.length})
        </button>

        <button
          onClick={() => setActiveTab('media')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
            activeTab === 'media'
              ? 'bg-primary text-primary-foreground shadow-xs'
              : 'text-muted-foreground hover:bg-muted'
          }`}
        >
          <Folder className="w-4 h-4" />
          גלריית מדיה והקלטות ({mediaFiles.length})
        </button>
      </div>

      {/* TAB 1: GENERAL */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Main Info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Kabbalah Reading Card */}
            {client.selected_reading && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                    <BookOpen className="w-4 h-4" />
                    סוג קריאה קבלית / אבחון נבחר
                  </div>
                  <button
                    onClick={() => setIsEditClientOpen(true)}
                    className="text-[11px] text-amber-800 dark:text-amber-300 hover:underline font-semibold flex items-center gap-1"
                  >
                    <Edit className="w-3 h-3" />
                    ערוך פרטי קריאה
                  </button>
                </div>
                <div className="font-bold text-base text-foreground break-words whitespace-pre-wrap leading-relaxed">
                  {client.selected_reading}
                </div>
              </div>
            )}

            {/* Call Documentation Form */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                תיעוד שיחה מהיר
              </h3>
              <form onSubmit={handleAddCallDoc} className="space-y-3">
                <textarea
                  rows={3}
                  placeholder="הקלד סיכום שיחה מהיר (יתווסף אוטומטית לראש הערות הלקוח עם חותמת זמן)..."
                  value={callNoteInput}
                  onChange={(e) => setCallNoteInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90"
                  >
                    + הוסף תיעוד שיחה
                  </button>
                </div>
              </form>
            </div>

            {/* Recent Media & Recordings Preview Card */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground">
                      מדיה, תמונות והקלטות ששותפו ({mediaFiles.length})
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      הקלטות וואטסאפ, קבצי שמע ומסמכים המשוייכים ללקוח
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('media')}
                  className="text-xs font-bold text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-1"
                >
                  <span>פתח גלריה מלאה</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {mediaFiles.length === 0 ? (
                <div className="p-4 bg-muted/20 border border-dashed border-border rounded-xl text-center space-y-2">
                  <p className="text-xs text-muted-foreground">
                    טרם נשמרו הקלטות קול או תמונות בכרטיס לקוח זה.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('media')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>העלה קובץ או הקלטה לגלריה</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {mediaFiles.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-muted/30 border border-border rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 bg-card rounded-lg border border-border shrink-0">
                          {item.type === 'audio' ? (
                            <FileAudio className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <FileImage className="w-5 h-5 text-emerald-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-xs text-foreground truncate">{item.name}</h4>
                          <span className="text-[10px] text-muted-foreground">
                            {item.created_at ? formatHebrewDate(item.created_at, 'dd/MM/yyyy HH:mm') : ''}
                          </span>
                        </div>
                      </div>

                      {item.type === 'audio' && item.url && !item.url.startsWith('cloud_media:') && (
                        <audio controls className="h-8 max-w-full sm:max-w-xs shrink-0 rounded" src={item.url} />
                      )}

                      {item.type === 'image' && item.url && !item.url.startsWith('cloud_media:') && (
                        <img
                          src={item.url}
                          alt={item.name}
                          className="w-10 h-10 object-cover rounded-lg border border-border shrink-0"
                        />
                      )}
                    </div>
                  ))}

                  {mediaFiles.length > 3 && (
                    <div className="text-center pt-1">
                      <button
                        type="button"
                        onClick={() => setActiveTab('media')}
                        className="text-xs text-muted-foreground hover:text-foreground font-semibold hover:underline"
                      >
                        + עוד {mediaFiles.length - 3} קבצים נוספים בגלריה
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Full Clinical Notes */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-2">
              <h3 className="font-bold text-sm text-foreground">יומן הערות ותיעוד מתמשך</h3>
              <div className="p-4 bg-muted/30 rounded-xl text-xs leading-relaxed whitespace-pre-wrap font-mono border border-border/60 min-h-[120px]">
                {client.notes || 'אין הערות מתועדות ללקוח זה עדיין.'}
              </div>
            </div>
          </div>

          {/* Side Details (Partner, Personal, Contact) */}
          <div className="space-y-5">
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3 text-xs">
              <h3 className="font-bold text-sm border-b border-border pb-2 text-foreground">פרטי התקשרות</h3>
              <div className="space-y-2 text-muted-foreground">
                <p>טלפון: <strong className="text-foreground">{client.phone}</strong></p>
                {client.email && <p>דוא"ל: <strong className="text-foreground">{client.email}</strong></p>}
                {client.address && <p>כתובת: <strong className="text-foreground">{client.address}</strong></p>}
              </div>
            </div>

            {/* Partner Card */}
            {(client.partner_full_name || client.partner_mother_name) && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3 text-xs">
                <h3 className="font-bold text-sm border-b border-border pb-2 text-foreground flex items-center gap-1.5">
                  <Heart className="w-4 h-4 text-rose-500" />
                  פרטי בן/בת זוג
                </h3>
                <div className="space-y-2 text-muted-foreground">
                  {client.partner_full_name && <p>שם מלא: <strong className="text-foreground">{client.partner_full_name}</strong></p>}
                  {client.partner_mother_name && <p>שם האם: <strong className="text-foreground">{client.partner_mother_name}</strong></p>}
                  {client.partner_dob && <p>תאריך לידה: <strong className="text-foreground">{formatHebrewDate(client.partner_dob)}</strong></p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: CLINICAL (PROGRAMS & TASKS) */}
      {activeTab === 'clinical' && (() => {
        // Sort sessions based on user preference (default: newest at top, oldest at bottom)
        const sortedSessions = [...sessions].sort((a, b) => {
          const timeA = a.session_date ? new Date(a.session_date).getTime() : 0;
          const timeB = b.session_date ? new Date(b.session_date).getTime() : 0;
          return sessionSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
        });

        const standaloneSessions = sortedSessions.filter(
          (s) => !s.program_id || !programs.some((p) => p.id === s.program_id)
        );

        const completedCount = sessions.filter((s) => s.status === 'completed').length;
        const scheduledCount = sessions.filter((s) => s.status === 'scheduled').length;

        return (
          <div className="space-y-6">
            {/* Header Action & Sorting Bar */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm text-foreground">תוכניות עבודה ומפגשי טיפול</h3>
                  <span className="px-2 py-0.5 text-[11px] font-bold bg-primary/10 text-primary rounded-full">
                    {sessions.length} מפגשים
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {completedCount} בוצעו • {scheduledCount} מתוכננים • {sessionSortOrder === 'desc' ? 'ממוין מהעדכני ביותר (למעלה) לישן ביותר (למטה)' : 'ממוין מהישן ביותר (למעלה) לעדכני ביותר (למטה)'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                {/* View Switcher: Programs vs Unified Timeline */}
                <div className="flex items-center bg-muted/40 p-1 rounded-xl border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setClinicalSubView('programs')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                      clinicalSubView === 'programs'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    לפי תוכניות ({programs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setClinicalSubView('timeline')}
                    className={`px-3 py-1.5 font-bold rounded-lg transition-all flex items-center gap-1 ${
                      clinicalSubView === 'timeline'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    ציר כל המפגשים ({sessions.length})
                  </button>
                </div>

                {/* Sort Order Toggle */}
                <button
                  type="button"
                  onClick={() => setSessionSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                  className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                  title="החלף כיוון מיון"
                >
                  <ArrowDownUp className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {sessionSortOrder === 'desc' ? 'סדר: עדכני למעלה' : 'סדר: ישן למעלה'}
                  </span>
                </button>

                {/* Add Session & Add Program buttons */}
                <button
                  type="button"
                  onClick={() => handleAddNewSession()}
                  className="px-3 py-2 bg-card hover:bg-muted text-foreground border border-border text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5 text-teal-600" />
                  <span>+ מפגש חדש</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingProgram(null);
                    setIsProgramModalOpen(true);
                  }}
                  className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  + תוכנית עבודה
                </button>
              </div>
            </div>

            {/* SUB-VIEW 1: BY PROGRAMS */}
            {clinicalSubView === 'programs' && (
              <div className="space-y-6">
                {programs.length === 0 && standaloneSessions.length === 0 ? (
                  <div className="p-8 text-center bg-card border border-dashed border-border rounded-2xl text-muted-foreground text-xs space-y-3">
                    <p>אין תוכנית עבודה או מפגשים מתועדים ללקוח זה עדיין.</p>
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleAddNewSession()}
                        className="px-3 py-1.5 bg-card border border-border hover:bg-muted text-xs font-bold rounded-xl"
                      >
                        + הוסף מפגש טיפול בודד
                      </button>
                      <button
                        onClick={() => {
                          setEditingProgram(null);
                          setIsProgramModalOpen(true);
                        }}
                        className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl"
                      >
                        + צור סדרת טיפולים חדשה
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {programs.map((prog) => {
                      const rawProgSessions = sessions.filter((s) => s.program_id === prog.id);
                      const progCompleted = rawProgSessions.filter((s) => s.status === 'completed').length;
                      const progMediaFiles = dataStore.getMediaFiles(prog.id);

                      // Chronological order from oldest to newest to calculate each session's sequence number (#1, #2...)
                      const chronologicalSessions = [...rawProgSessions].sort(
                        (a, b) => new Date(a.session_date).getTime() - new Date(b.session_date).getTime()
                      );
                      const getProgSessionNumber = (id: string) => {
                        const idx = chronologicalSessions.findIndex((s) => s.id === id);
                        return idx >= 0 ? idx + 1 : 1;
                      };

                      // Sessions sorted: newest at top, oldest at bottom (or as toggled)
                      const progSessions = [...rawProgSessions].sort((a, b) => {
                        const timeA = a.session_date ? new Date(a.session_date).getTime() : 0;
                        const timeB = b.session_date ? new Date(b.session_date).getTime() : 0;
                        return sessionSortOrder === 'desc' ? timeB - timeA : timeA - timeB;
                      });

                      return (
                        <div key={prog.id} className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="font-bold text-base text-foreground">{prog.title}</h4>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                  {progCompleted} מתוך {prog.total_sessions} בוצעו
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                ימי טיפול: {(prog.weekly_days || []).map((d) => ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][d]).join(', ')} • {sessionSortOrder === 'desc' ? 'מפגשים מסודרים מהעדכני ביותר (למעלה) לישן ביותר (למטה)' : 'מפגשים מסודרים מהישן ביותר (למעלה) לעדכני ביותר (למטה)'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleAddNewSession(prog.id)}
                                className="px-3 py-1.5 border border-border text-xs font-semibold rounded-lg hover:bg-muted flex items-center gap-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                מפגש לתוכנית
                              </button>
                              <button
                                onClick={() => {
                                  setEditingProgram(prog);
                                  setIsProgramModalOpen(true);
                                }}
                                className="px-3 py-1.5 border border-border text-xs font-semibold rounded-lg hover:bg-muted"
                              >
                                ערוך תוכנית
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm('למחוק תוכנית זו ואת כל המפגשים הכלולים בה?')) {
                                    dataStore.deleteProgram(prog.id);
                                  }
                                }}
                                className="p-1.5 border border-border text-rose-600 hover:bg-rose-500/10 rounded-lg"
                                title="מחק תוכנית"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          {/* Sessions Grid (Newest at top, Oldest at bottom) */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {progSessions.map((s, idx) => {
                              const stInfo = SESSION_STATUS_LABELS[s.status] || {
                                label: s.status || 'מתוכנן',
                                class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                              };
                              const isLatest = sessionSortOrder === 'desc' && idx === 0;
                              const isOldest = sessionSortOrder === 'desc' && idx === progSessions.length - 1 && progSessions.length > 1;

                              return (
                                <div
                                  key={s.id}
                                  onClick={() => {
                                    setSelectedSession(s);
                                    setIsSessionDialogOpen(true);
                                  }}
                                  className={`p-3.5 bg-muted/30 hover:bg-muted border rounded-xl cursor-pointer transition-all space-y-2 relative group ${
                                    isLatest ? 'border-primary/50 shadow-xs ring-1 ring-primary/20' : 'border-border/80'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-bold text-xs">מפגש #{getProgSessionNumber(s.id)}</span>
                                      {isLatest && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-md shadow-2xs">
                                          העדכני ביותר
                                        </span>
                                      )}
                                      {isOldest && (
                                        <span className="px-1.5 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground border border-border/60 rounded-md">
                                          הישן ביותר
                                        </span>
                                      )}
                                    </div>
                                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${stInfo.class}`}>
                                      {stInfo.label}
                                    </span>
                                  </div>

                                  <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <span>{formatHebrewDate(s.session_date, 'EEEE, dd/MM/yyyy HH:mm')}</span>
                                  </div>

                                  {s.notes && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 bg-card/60 p-1.5 rounded-lg border border-border/40">
                                      {s.notes}
                                    </p>
                                  )}

                                  {/* Media indicators */}
                                  {((s.audio_urls && s.audio_urls.length > 0) || (s.image_urls && s.image_urls.length > 0)) && (
                                    <div className="flex items-center gap-2 text-[10px] text-teal-600 dark:text-teal-400 font-semibold pt-1 border-t border-border/40">
                                      {s.audio_urls?.length > 0 && <span>🎵 {s.audio_urls.length} הקלטות</span>}
                                      {s.image_urls?.length > 0 && <span>🖼️ {s.image_urls.length} תמונות</span>}
                                    </div>
                                  )}

                                  {/* Actions */}
                                  <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                    <span className="text-primary hover:underline">לחץ לעריכה</span>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteSession(s.id);
                                      }}
                                      className="p-1 hover:text-rose-600 rounded transition-colors"
                                      title="מחק מפגש"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Program Files & Media Section */}
                          <div className="pt-4 border-t border-border space-y-3">
                            <div className="flex items-center justify-between">
                              <h5 className="font-bold text-xs text-foreground flex items-center gap-1.5">
                                <Folder className="w-4 h-4 text-primary" />
                                קובצי ומדיית תוכנית הטיפול ({progMediaFiles.length})
                              </h5>
                            </div>

                            <FileGallery
                              parentId={prog.id}
                              category="program"
                              targetName={`${client.full_name} - ${prog.title}`}
                              mediaFiles={progMediaFiles}
                              availablePrograms={programs}
                              onUploadFile={(file) => handleUploadProgramFile(file, prog.id)}
                              onDeleteFile={(id) => dataStore.deleteMediaFile(id)}
                              onRenameFile={(id, name) => dataStore.renameMediaFile(id, name)}
                              onTransferFile={(id, targetProgId) => dataStore.transferMediaFile(id, targetProgId, 'program')}
                            />
                          </div>
                        </div>
                      );
                    })}

                    {/* Standalone Sessions Section (if any exist) */}
                    {standaloneSessions.length > 0 && (
                      <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-base text-foreground">מפגשים בודדים ופגישות קבליות</h4>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300">
                                {standaloneSessions.length} מפגשים
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              מפגשים ללא שיוך לתוכנית מחזורית • מסודרים מהעדכני ביותר (למעלה) לישן ביותר (למטה)
                            </p>
                          </div>
                          <button
                            onClick={() => handleAddNewSession()}
                            className="px-3 py-1.5 border border-border text-xs font-semibold rounded-lg hover:bg-muted flex items-center gap-1"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            + מפגש בודד
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                          {standaloneSessions.map((s, idx) => {
                            const stInfo = SESSION_STATUS_LABELS[s.status] || {
                              label: s.status || 'מתוכנן',
                              class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                            };
                            const isLatest = sessionSortOrder === 'desc' && idx === 0;

                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  setSelectedSession(s);
                                  setIsSessionDialogOpen(true);
                                }}
                                className={`p-3.5 bg-muted/30 hover:bg-muted border rounded-xl cursor-pointer transition-all space-y-2 relative ${
                                  isLatest ? 'border-primary/50 shadow-xs ring-1 ring-primary/20' : 'border-border/80'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-xs">מפגש טיפולי</span>
                                    {isLatest && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-md shadow-2xs">
                                        העדכני ביותר
                                      </span>
                                    )}
                                  </div>
                                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${stInfo.class}`}>
                                    {stInfo.label}
                                  </span>
                                </div>

                                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                                  <span>{formatHebrewDate(s.session_date, 'EEEE, dd/MM/yyyy HH:mm')}</span>
                                </div>

                                {s.notes && (
                                  <p className="text-[11px] text-muted-foreground line-clamp-2 bg-card/60 p-1.5 rounded-lg border border-border/40">
                                    {s.notes}
                                  </p>
                                )}

                                <div className="pt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                                  <span className="text-primary hover:underline">לחץ לעריכה</span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteSession(s.id);
                                    }}
                                    className="p-1 hover:text-rose-600 rounded transition-colors"
                                    title="מחק מפגש"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* SUB-VIEW 2: FULL CHRONOLOGICAL TIMELINE (Newest to Oldest) */}
            {clinicalSubView === 'timeline' && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
                <div className="border-b border-border pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">ציר כל המפגשים הטיפוליים של הלקוח</h4>
                    <p className="text-xs text-muted-foreground">
                      ריכוז מלא של כל המפגשים — {sessionSortOrder === 'desc' ? 'מהעדכני ביותר (למעלה) לישן ביותר (למטה)' : 'מהישן ביותר (למעלה) לעדכני ביותר (למטה)'}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-xl">
                    סה״כ {sortedSessions.length} מפגשים
                  </span>
                </div>

                {sortedSessions.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-xs">
                    אין מפגשים רשומים ללקוח זה עדיין.
                  </div>
                ) : (
                  <div className="relative border-r-2 border-primary/30 mr-3 pr-5 space-y-4 py-2">
                    {sortedSessions.map((s, idx) => {
                      const prog = programs.find((p) => p.id === s.program_id);
                      const isLatest = sessionSortOrder === 'desc' && idx === 0;
                      const isOldest = sessionSortOrder === 'desc' && idx === sortedSessions.length - 1 && sortedSessions.length > 1;
                      const stInfo = SESSION_STATUS_LABELS[s.status] || {
                        label: s.status || 'מתוכנן',
                        class: 'bg-blue-500/10 text-blue-600 border-blue-200',
                      };

                      return (
                        <div key={`timeline-${s.id}`} className="relative group">
                          {/* Timeline Dot */}
                          <div
                            className={`absolute -right-[27px] top-3.5 w-3.5 h-3.5 rounded-full border-2 border-background ${
                              isLatest ? 'bg-primary ring-4 ring-primary/20' : 'bg-muted-foreground'
                            }`}
                          />

                          <div
                            onClick={() => {
                              setSelectedSession(s);
                              setIsSessionDialogOpen(true);
                            }}
                            className={`p-4 bg-muted/30 hover:bg-muted border rounded-xl cursor-pointer transition-all space-y-2.5 ${
                              isLatest ? 'border-primary/50 shadow-xs ring-1 ring-primary/20' : 'border-border/80'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-xs text-foreground">
                                  {prog ? prog.title : 'מפגש טיפולי'}
                                </span>
                                {isLatest && (
                                  <span className="px-2 py-0.5 text-[9px] font-bold bg-primary text-primary-foreground rounded-md shadow-2xs">
                                    העדכני ביותר
                                  </span>
                                )}
                                {isOldest && (
                                  <span className="px-2 py-0.5 text-[9px] font-medium bg-muted text-muted-foreground border border-border/60 rounded-md">
                                    הישן ביותר
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${stInfo.class}`}>
                                  {stInfo.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteSession(s.id);
                                  }}
                                  className="p-1 text-muted-foreground hover:text-rose-600 rounded transition-colors"
                                  title="מחק מפגש"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-primary font-mono font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              <span>{formatHebrewDate(s.session_date, 'EEEE, dd/MM/yyyy HH:mm')}</span>
                            </div>

                            {s.notes && (
                              <p className="text-xs text-muted-foreground bg-card/60 p-2.5 rounded-lg border border-border/40 whitespace-pre-wrap">
                                {s.notes}
                              </p>
                            )}

                            {((s.audio_urls && s.audio_urls.length > 0) || (s.image_urls && s.image_urls.length > 0)) && (
                              <div className="flex items-center gap-3 text-xs text-teal-600 dark:text-teal-400 font-semibold pt-1">
                                {s.audio_urls?.length > 0 && <span>🎵 {s.audio_urls.length} הקלטות קול</span>}
                                {s.image_urls?.length > 0 && <span>🖼️ {s.image_urls.length} קבצי מדיה</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Client Tasks Section */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-3">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-primary" />
                משימות משוייכות ללקוח ({tasks.length})
              </h3>
              {tasks.length === 0 ? (
                <p className="text-xs text-muted-foreground">אין משימות פתוחות ללקוח זה.</p>
              ) : (
                <div className="space-y-2">
                  {tasks.map((t) => (
                    <div key={t.id} className="p-3 bg-muted/30 rounded-xl border border-border flex items-center justify-between text-xs">
                      <div>
                        <h4 className="font-bold">{t.title}</h4>
                        {t.description && <p className="text-[11px] text-muted-foreground">{t.description}</p>}
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {t.due_date ? formatHebrewDate(t.due_date, 'dd/MM/yy HH:mm') : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* TAB 3: MEDIA & RECORDINGS */}
      {activeTab === 'media' && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-foreground">גלריית מדיה, הקלטות קול וקבצים</h3>
          <FileGallery
            parentId={cleanClientId}
            category="client"
            targetName={client.full_name}
            mediaFiles={mediaFiles}
            availablePrograms={programs}
            onUploadFile={handleUploadFile}
            onDeleteFile={(id) => dataStore.deleteMediaFile(id)}
            onRenameFile={(id, name) => dataStore.renameMediaFile(id, name)}
            onTransferFile={(id, targetProgId) => dataStore.transferMediaFile(id, targetProgId, 'program')}
          />
        </div>
      )}

      {/* Dialogs */}
      <ClientModal
        isOpen={isEditClientOpen}
        onClose={() => setIsEditClientOpen(false)}
        onSave={handleUpdateClient}
        clientToEdit={client}
      />

      <ProgramModal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        onSave={handleSaveProgram}
        clientId={cleanClientId}
        programToEdit={editingProgram}
      />

      <SessionEditDialog
        isOpen={isSessionDialogOpen}
        onClose={() => setIsSessionDialogOpen(false)}
        onSave={handleSaveSession}
        session={selectedSession}
        clientName={client.full_name}
      />

      <LiveReadingModal
        isOpen={isLiveReadingOpen}
        onClose={() => setIsLiveReadingOpen(false)}
        clientId={cleanClientId}
        clientName={client.full_name}
        onPerformReading={handlePerformReading}
      />
    </div>
  );
};
