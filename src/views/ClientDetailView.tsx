import React, { useState } from 'react';
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

interface ClientDetailViewProps {
  clientId: string;
  onNavigate: (path: string) => void;
}

export const ClientDetailView: React.FC<ClientDetailViewProps> = ({ clientId, onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'clinical' | 'media'>('general');
  const [callNoteInput, setCallNoteInput] = useState('');

  // Modals
  const [isEditClientOpen, setIsEditClientOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [isSessionDialogOpen, setIsSessionDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isLiveReadingOpen, setIsLiveReadingOpen] = useState(false);

  const client = dataStore.getClientById(clientId);
  const programs = dataStore.getPrograms(clientId);
  const sessions = dataStore.getSessions(clientId);
  const tasks = dataStore.getTasks().filter((t) => t.client_id === clientId);
  const mediaFiles = dataStore.getMediaFiles(clientId);

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
            {client.avatar_url ? (
              <img
                src={client.avatar_url}
                alt={client.full_name}
                className="w-16 h-16 rounded-full object-cover border-2 border-primary/40 shadow-sm"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/20 text-primary font-bold text-xl flex items-center justify-center border-2 border-primary/40">
                {client.full_name ? client.full_name.charAt(0) : 'ל'}
              </div>
            )}

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
          תוכניות טיפול ומשימות ({programs.length})
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
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs">
                  <BookOpen className="w-4 h-4" />
                  אבחון קבלי נבחר
                </div>
                <h3 className="font-extrabold text-base text-foreground">{client.selected_reading}</h3>
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
      {activeTab === 'clinical' && (
        <div className="space-y-6">
          {/* Header Action */}
          <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border">
            <div>
              <h3 className="font-bold text-sm">תוכניות עבודה וסדרות טיפול</h3>
              <p className="text-xs text-muted-foreground">מעקב מפגשים מתוכננים, ביצועים ושינויים</p>
            </div>
            <button
              onClick={() => {
                setEditingProgram(null);
                setIsProgramModalOpen(true);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl shadow-xs hover:bg-primary/90 flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              + תוכנית עבודה חדשה
            </button>
          </div>

          {/* Programs List */}
          {programs.length === 0 ? (
            <div className="p-8 text-center bg-card border border-dashed border-border rounded-2xl text-muted-foreground text-xs">
              אין תוכנית עבודה פעילה ללקוח זה עדיין. לחץ על "+ תוכנית עבודה חדשה" ליצירת סדרת טיפולים.
            </div>
          ) : (
            programs.map((prog) => {
              const progSessions = sessions.filter((s) => s.program_id === prog.id);
              const completedCount = progSessions.filter((s) => s.status === 'completed').length;
              const progMediaFiles = dataStore.getMediaFiles(prog.id);

              return (
                <div key={prog.id} className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <h4 className="font-bold text-base text-foreground">{prog.title}</h4>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {completedCount} מתוך {prog.total_sessions} מפגשים בוצעו • ימי טיפול: {(prog.weekly_days || []).map((d) => ['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'][d]).join(', ')}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
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
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sessions Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {progSessions.map((s, idx) => {
                      const stInfo = SESSION_STATUS_LABELS[s.status] || {
                        label: s.status || 'מתוכנן',
                        class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
                      };
                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSession(s);
                            setIsSessionDialogOpen(true);
                          }}
                          className="p-3 bg-muted/30 hover:bg-muted border border-border/80 rounded-xl cursor-pointer transition-all space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs">מפגש #{idx + 1}</span>
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${stInfo.class}`}>
                              {stInfo.label}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            {formatHebrewDate(s.session_date, 'dd/MM/yyyy HH:mm')}
                          </div>
                          {s.notes && (
                            <p className="text-[11px] text-muted-foreground truncate">{s.notes}</p>
                          )}
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
            })
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
      )}

      {/* TAB 3: MEDIA & RECORDINGS */}
      {activeTab === 'media' && (
        <div className="bg-card border border-border rounded-2xl p-5 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-foreground">גלריית מדיה, הקלטות קול וקבצים</h3>
          <FileGallery
            parentId={clientId}
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
        clientId={clientId}
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
        clientId={clientId}
        clientName={client.full_name}
        onPerformReading={handlePerformReading}
      />
    </div>
  );
};
