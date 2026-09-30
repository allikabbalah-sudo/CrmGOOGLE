import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Users,
  Search,
  Plus,
  Phone,
  Mail,
  MapPin,
  Calendar,
  MessageCircle,
  BookOpen,
  ChevronLeft,
  Download,
  Camera,
  Edit,
  Clock,
  AlertCircle,
  Sparkles,
  Layers,
} from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { Client, ClientStatus, CLIENT_STATUS_LABELS, Program, Session } from '../types';
import { formatHebrewDate, toWhatsAppUrl } from '../lib/utils';
import { ClientModal } from '../components/dialogs/ClientModal';
import { ProgramModal } from '../components/dialogs/ProgramModal';
import { ExportClientsModal } from '../components/dialogs/ExportClientsModal';
import { compressImageFile } from '../lib/indexedDbStorage';
import { ClientAvatar } from '../components/common/ClientAvatar';

interface ClientsViewProps {
  onNavigate: (path: string) => void;
}

type InactiveTimeframe = '7days' | '14days' | 'never';

interface ClientActivityInfo {
  hasPrograms: boolean;
  hasSessions: boolean;
  latestTime: number;
  daysSince: number | null;
  activityLabel: string;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [inactiveTimeframe, setInactiveTimeframe] = useState<InactiveTimeframe>('7days');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [programModalClientId, setProgramModalClientId] = useState<string | null>(null);

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
  const [, setStoreTick] = useState(0);

  useEffect(() => {
    return dataStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const clients = dataStore.getClients() || [];
  const programs = dataStore.getPrograms() || [];
  const sessions = dataStore.getSessions() || [];

  // Compute activity for every client
  const clientActivityMap = useMemo(() => {
    const map = new Map<string, ClientActivityInfo>();
    const now = Date.now();

    for (const c of clients) {
      if (!c || !c.id) continue;
      const cPrograms = programs.filter((p) => p.client_id === c.id);
      const cSessions = sessions.filter((s) => s.client_id === c.id);

      let latestTime = 0;

      for (const p of cPrograms) {
        if (p.created_at) {
          const t = new Date(p.created_at).getTime();
          if (!isNaN(t) && t > latestTime) latestTime = t;
        }
        if (p.updated_at) {
          const t = new Date(p.updated_at).getTime();
          if (!isNaN(t) && t > latestTime) latestTime = t;
        }
        if (p.start_date) {
          const t = new Date(p.start_date).getTime();
          if (!isNaN(t) && t > latestTime) latestTime = t;
        }
      }

      for (const s of cSessions) {
        if (s.session_date) {
          const t = new Date(s.session_date).getTime();
          if (!isNaN(t) && t > latestTime) latestTime = t;
        }
        if (s.created_at) {
          const t = new Date(s.created_at).getTime();
          if (!isNaN(t) && t > latestTime) latestTime = t;
        }
      }

      if (latestTime === 0) {
        map.set(c.id, {
          hasPrograms: false,
          hasSessions: false,
          latestTime: 0,
          daysSince: null,
          activityLabel: 'טרם הוגדרה תוכנית עבודה',
        });
      } else {
        const days = Math.floor((now - latestTime) / (1000 * 60 * 60 * 24));
        const dateObj = new Date(latestTime);
        const dateStr = dateObj.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
        map.set(c.id, {
          hasPrograms: cPrograms.length > 0,
          hasSessions: cSessions.length > 0,
          latestTime,
          daysSince: Math.max(0, days),
          activityLabel: days === 0 ? 'היום' : days === 1 ? 'אתמול' : `לפני ${days} ימים (${dateStr})`,
        });
      }
    }

    return map;
  }, [clients, programs, sessions]);

  // Counts for inactive clients
  const countNoActivity7Days = useMemo(() => {
    return clients.filter((c) => {
      const act = clientActivityMap.get(c.id);
      return !act || act.daysSince === null || act.daysSince >= 7;
    }).length;
  }, [clients, clientActivityMap]);

  const countNoActivity14Days = useMemo(() => {
    return clients.filter((c) => {
      const act = clientActivityMap.get(c.id);
      return !act || act.daysSince === null || act.daysSince >= 14;
    }).length;
  }, [clients, clientActivityMap]);

  const countNoProgramEver = useMemo(() => {
    return clients.filter((c) => {
      const act = clientActivityMap.get(c.id);
      return !act || !act.hasPrograms;
    }).length;
  }, [clients, clientActivityMap]);

  const handleCardAvatarClick = (clientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadingClientId(clientId);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
      avatarInputRef.current.click();
    }
  };

  const handleCardAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadingClientId) return;
    try {
      const compressed = await compressImageFile(file, 250, 250, 0.82);
      if (compressed) {
        dataStore.updateClient(uploadingClientId, { avatar_url: compressed });
      }
    } catch (err) {
      console.error('Failed to update avatar from card:', err);
    } finally {
      setUploadingClientId(null);
    }
  };

  const filteredClients = clients.filter((c) => {
    if (!c) return false;

    // Filter by special "no_recent_program" tab
    if (statusFilter === 'no_recent_program') {
      const act = clientActivityMap.get(c.id);
      if (inactiveTimeframe === '7days') {
        if (act && act.daysSince !== null && act.daysSince < 7) return false;
      } else if (inactiveTimeframe === '14days') {
        if (act && act.daysSince !== null && act.daysSince < 14) return false;
      } else if (inactiveTimeframe === 'never') {
        if (act && act.hasPrograms) return false;
      }
    } else if (statusFilter !== 'all' && c.status !== statusFilter) {
      return false;
    }

    // Search filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.address && c.address.toLowerCase().includes(term)) ||
      (c.mother_name && c.mother_name.toLowerCase().includes(term)) ||
      (c.selected_reading && c.selected_reading.toLowerCase().includes(term))
    );
  });

  // Sort order:
  // When in no_recent_program tab, sort by longest time without activity first
  const sortedClients = [...filteredClients].sort((a, b) => {
    if (statusFilter === 'no_recent_program') {
      const actA = clientActivityMap.get(a.id);
      const actB = clientActivityMap.get(b.id);
      // Clients with no program ever go first
      const daysA = actA?.daysSince ?? 9999;
      const daysB = actB?.daysSince ?? 9999;
      return daysB - daysA;
    }

    const statusOrder: Record<ClientStatus, number> = {
      active: 1,
      consultation: 2,
      lead: 3,
      waiting: 4,
      paid: 5,
      inactive: 6,
    };
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });

  const handleCreateClient = (data: Partial<Client>) => {
    const newClient = dataStore.addClient(data as any);
    onNavigate(`/clients/${newClient.id}`);
  };

  const handleSaveNewProgram = (programData: any) => {
    dataStore.addProgram(programData);
    setProgramModalClientId(null);
  };

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            מטופלי הקליניקה ({clients.length})
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            ניהול כרטיסי לקוחות, תהליכים קבליים והיסטוריית טיפולים
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex-1 sm:flex-initial px-3.5 py-2 bg-card hover:bg-muted text-foreground border border-border text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
            title="ייצוא רשימת לקוחות כקובץ JSON מובנה"
          >
            <Download className="w-4 h-4 text-teal-600" />
            <span>ייצוא לקוחות (JSON)</span>
          </button>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 sm:flex-initial px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>לקוח חדש לקליניקה</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="space-y-3 bg-card p-3 rounded-2xl border border-border">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="חפש לפי שם, טלפון, דוא''ל, כתובת, שם האם או סוג קריאה..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Status & Inactive Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {/* All */}
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'bg-muted/40 text-muted-foreground hover:bg-muted'
              }`}
            >
              הכל ({clients.length})
            </button>

            {/* Inactive in Last Week/Two Weeks Tab (REQUESTED) */}
            <button
              onClick={() => setStatusFilter('no_recent_program')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all whitespace-nowrap flex items-center gap-1.5 border ${
                statusFilter === 'no_recent_program'
                  ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                  : 'bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 border-amber-500/30'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>ללא תוכנית לאחרונה (שבוע/שבועיים)</span>
              <span
                className={`px-1.5 py-0.2 text-[10px] rounded-full font-black ${
                  statusFilter === 'no_recent_program'
                    ? 'bg-white/20 text-white'
                    : 'bg-amber-500/25 text-amber-800 dark:text-amber-200'
                }`}
              >
                {inactiveTimeframe === '7days'
                  ? countNoActivity7Days
                  : inactiveTimeframe === '14days'
                  ? countNoActivity14Days
                  : countNoProgramEver}
              </span>
            </button>

            {/* Standard Statuses */}
            {(Object.keys(CLIENT_STATUS_LABELS) as ClientStatus[]).map((st) => {
              const label = CLIENT_STATUS_LABELS[st]?.label || st;
              const count = clients.filter((c) => c?.status === st).length;
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-primary text-primary-foreground shadow-xs'
                      : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-filters when "no_recent_program" tab is active */}
        {statusFilter === 'no_recent_program' && (
          <div className="pt-2 border-t border-border/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-amber-500/5 -mx-3 -mb-3 p-3 rounded-b-2xl">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                סינון לפי פרק זמן ללא פעילות:
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setInactiveTimeframe('7days')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  inactiveTimeframe === '7days'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-card text-foreground hover:bg-muted border-border'
                }`}
              >
                שבוע אחרון (7 ימים) ({countNoActivity7Days})
              </button>
              <button
                type="button"
                onClick={() => setInactiveTimeframe('14days')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  inactiveTimeframe === '14days'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-card text-foreground hover:bg-muted border-border'
                }`}
              >
                שבועיים אחרונים (14 ימים) ({countNoActivity14Days})
              </button>
              <button
                type="button"
                onClick={() => setInactiveTimeframe('never')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg border transition-all ${
                  inactiveTimeframe === 'never'
                    ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                    : 'bg-card text-foreground hover:bg-muted border-border'
                }`}
              >
                מעולם לא נפתחה תוכנית ({countNoProgramEver})
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Helpful banner for no_recent_program */}
      {statusFilter === 'no_recent_program' && (
        <div className="p-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-amber-900 dark:text-amber-200">
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold">
                נמצאו {sortedClients.length} לקוחות שלא בוצעה או נפתחה עבורם תוכנית ב-
                {inactiveTimeframe === '7days'
                  ? '7 הימים האחרונים'
                  : inactiveTimeframe === '14days'
                  ? '14 הימים האחרונים'
                  : 'כלל הזמנים'}
                .
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80">
                מומלץ לפתוח עבורם תוכנית עבודה חדשה או ליצור קשר ב-WhatsApp כדי לחדש את הטיפול.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clients Grid */}
      {sortedClients.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border rounded-2xl">
          <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-foreground">לא נמצאו לקוחות התואמים את החיפוש</h3>
          <p className="text-xs text-muted-foreground mt-1">נסה לשנות את מילות החיפוש או הוסף לקוח חדש</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedClients.map((client) => {
            const statusInfo = CLIENT_STATUS_LABELS[client.status] || {
              label: client.status || 'פעיל',
              color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
              badge: 'bg-emerald-500',
            };

            const actInfo = clientActivityMap.get(client.id);
            const isInactiveInTab =
              statusFilter === 'no_recent_program' ||
              (actInfo && (actInfo.daysSince === null || actInfo.daysSince >= 7));

            const whatsappMessage = `שלום ${client.full_name}, מה שלומך? רציתי להתעניין בשלומך ולבדוק התקדמות לגבי תוכנית המפגשים בקליניקה.`;
            const whatsappUrl = toWhatsAppUrl(client.phone, whatsappMessage);

            return (
              <div
                key={client.id}
                onClick={() => onNavigate(`/clients/${client.id}`)}
                className={`bg-card border rounded-2xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group ${
                  statusFilter === 'no_recent_program'
                    ? 'border-amber-500/40 hover:border-amber-500'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative group/avatar shrink-0">
                        <ClientAvatar
                          avatarUrl={client.avatar_url}
                          name={client.full_name}
                          className="w-11 h-11 border border-primary/30"
                        />
                        <button
                          type="button"
                          onClick={(e) => handleCardAvatarClick(client.id, e)}
                          title="החלף / העלה תמונה ללקוח"
                          className="absolute inset-0 rounded-full bg-black/45 text-white opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity shadow-xs"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                          {client.full_name}
                        </h3>
                        {client.mother_name && (
                          <span className="text-[11px] text-muted-foreground block">
                            אם: {client.mother_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  {/* Activity / Inactivity Tag (REQUESTED FEATURE) */}
                  {isInactiveInTab && (
                    <div className="mb-3 px-2.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300 font-semibold text-[11px]">
                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>פעילות אחרונה:</span>
                      </div>
                      <span className="text-[11px] font-bold text-amber-900 dark:text-amber-200">
                        {actInfo?.activityLabel || 'ללא תוכנית'}
                      </span>
                    </div>
                  )}

                  {/* Kabbalah Reading (Free-text display) */}
                  {client.selected_reading && (
                    <div className="mb-3 p-2 bg-primary/5 rounded-xl text-xs text-primary font-medium flex items-center gap-1.5 border border-primary/20">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{client.selected_reading}</span>
                    </div>
                  )}

                  {/* Contact Details */}
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{client.phone || 'אין טלפון'}</span>
                    </div>
                    {client.email && (
                      <div className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 shrink-0" />
                        <a
                          href={`mailto:${client.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline truncate"
                        >
                          {client.email}
                        </a>
                      </div>
                    )}
                    {client.address && (
                      <div className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{client.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Quick Actions */}
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs gap-1.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* One-click open program button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProgramModalClientId(client.id);
                      }}
                      className="px-2 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg font-bold flex items-center gap-1 transition-colors border border-primary/30"
                      title="פתיחת תוכנית עבודה אוטומטית ללקוח זה"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span className="text-[11px]">+ תוכנית</span>
                    </button>

                    {/* WhatsApp check-in */}
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="px-2 py-1 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg font-bold flex items-center gap-1 transition-colors"
                      title="שלח הודעת התעניינות ב-WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[11px]">WhatsApp</span>
                    </a>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientToEdit(client);
                      }}
                      className="p-1 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors border border-border/50"
                      title="עריכת פרטי לקוח ותמונה"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <span className="text-[11px] font-bold text-primary flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform whitespace-nowrap">
                    כרטיס <ChevronLeft className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Hidden file input for direct card avatar uploads */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleCardAvatarFileChange}
        className="hidden"
      />

      {/* Add Client Modal */}
      <ClientModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateClient}
      />

      {/* Edit Client Modal */}
      {clientToEdit && (
        <ClientModal
          isOpen={true}
          clientToEdit={clientToEdit}
          onClose={() => setClientToEdit(null)}
          onSave={(data) => {
            dataStore.updateClient(clientToEdit.id, data);
            setClientToEdit(null);
          }}
        />
      )}

      {/* Direct Program Creation Modal from Client Card */}
      {programModalClientId && (
        <ProgramModal
          isOpen={true}
          onClose={() => setProgramModalClientId(null)}
          onSave={handleSaveNewProgram}
          clientId={programModalClientId}
        />
      )}

      {/* Export Clients JSON Modal */}
      <ExportClientsModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        allClients={clients}
        filteredClients={filteredClients}
        isFiltered={searchTerm.trim() !== '' || statusFilter !== 'all'}
      />
    </div>
  );
};
