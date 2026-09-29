import React, { useState, useRef, useEffect } from 'react';
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
} from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { Client, ClientStatus, CLIENT_STATUS_LABELS } from '../types';
import { formatHebrewDate, toWhatsAppUrl } from '../lib/utils';
import { ClientModal } from '../components/dialogs/ClientModal';
import { ExportClientsModal } from '../components/dialogs/ExportClientsModal';
import { compressImageFile } from '../lib/indexedDbStorage';
import { ClientAvatar } from '../components/common/ClientAvatar';

interface ClientsViewProps {
  onNavigate: (path: string) => void;
}

export const ClientsView: React.FC<ClientsViewProps> = ({ onNavigate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [uploadingClientId, setUploadingClientId] = useState<string | null>(null);
  const [, setStoreTick] = useState(0);

  useEffect(() => {
    return dataStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  const clients = dataStore.getClients() || [];

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
    // Status filter
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;

    // Search filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (c.full_name && c.full_name.toLowerCase().includes(term)) ||
      (c.phone && c.phone.includes(term)) ||
      (c.email && c.email.toLowerCase().includes(term)) ||
      (c.address && c.address.toLowerCase().includes(term)) ||
      (c.mother_name && c.mother_name.toLowerCase().includes(term))
    );
  });

  // Sort order: active -> consultation -> lead -> waiting -> paid -> inactive
  const statusOrder: Record<ClientStatus, number> = {
    active: 1,
    consultation: 2,
    lead: 3,
    waiting: 4,
    paid: 5,
    inactive: 6,
  };

  const sortedClients = [...filteredClients].sort(
    (a, b) => (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99)
  );

  const handleCreateClient = (data: Partial<Client>) => {
    const newClient = dataStore.addClient(data as any);
    onNavigate(`/clients/${newClient.id}`);
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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card p-3 rounded-2xl border border-border">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="חפש לפי שם, טלפון, דוא''ל, כתובת או שם האם..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
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

      {/* Clients Grid */}
      {sortedClients.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border rounded-2xl">
          <Users className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2" />
          <h3 className="font-bold text-sm text-foreground">לא נמצאו לקוחות התואמים את החיפוש</h3>
          <p className="text-xs text-muted-foreground mt-1">נסה לשנות את מילות החיפוש או הוסף לקוח חדש</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedClients.map((client, index) => {
            const statusInfo = CLIENT_STATUS_LABELS[client.status] || {
              label: client.status || 'פעיל',
              color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
              badge: 'bg-emerald-500',
            };
            const whatsappUrl = toWhatsAppUrl(client.phone, `Hello ${client.full_name}, How are you? Are you ready for today's session?`);

            return (
              <div
                key={client.id}
                onClick={() => onNavigate(`/clients/${client.id}`)}
                className="bg-card border border-border hover:border-primary/50 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
                style={index === 4 ? { backgroundColor: '#baefd1' } : undefined}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative group/avatar shrink-0">
                        <ClientAvatar
                          avatarUrl={client.avatar_url}
                          name={client.full_name}
                          className="w-10 h-10 border border-primary/30"
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
                          <span className="text-[11px] text-muted-foreground">
                            אם: {client.mother_name}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full border ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>

                  {/* Reading / Notes details */}
                  {client.selected_reading && (
                    <div className="mb-3 p-2 bg-muted/40 rounded-xl text-xs text-primary font-medium flex items-center gap-1.5 border border-border/50">
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{client.selected_reading}</span>
                    </div>
                  )}

                  {/* Latest session */}
                  {(() => {
                    const clientSessions = dataStore.getSessions(client.id);
                    const latestSession = clientSessions[0];
                    if (!latestSession) return null;
                    return (
                      <div className="mb-3 px-2.5 py-1.5 bg-muted/40 rounded-xl text-xs flex items-center justify-between border border-border/60">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
                          <Calendar className="w-3 h-3 text-primary shrink-0" />
                          <span>מפגש עדכני:</span>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-foreground">
                          {formatHebrewDate(latestSession.session_date, 'dd/MM/yyyy')}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Contact Details */}
                  <div className="space-y-1.5 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 shrink-0" />
                      <span>{client.phone}</span>
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
                <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-1.5 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg font-bold flex items-center gap-1 transition-colors"
                      title="שלח הודעת WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span className="text-[11px]">WhatsApp</span>
                    </a>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setClientToEdit(client);
                      }}
                      className="p-1.5 bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg font-semibold flex items-center gap-1 transition-colors border border-border/50"
                      title="עריכת פרטי לקוח ותמונה"
                    >
                      <Edit className="w-3.5 h-3.5" />
                      <span className="text-[11px]">ערוך</span>
                    </button>
                  </div>

                  <span className="text-[11px] font-bold text-primary flex items-center gap-0.5 group-hover:translate-x-[-2px] transition-transform">
                    לכרטיס הלקוח <ChevronLeft className="w-3.5 h-3.5" />
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
