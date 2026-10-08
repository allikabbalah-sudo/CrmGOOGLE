import React, { useState, useEffect } from 'react';
import {
  FileAudio,
  FileImage,
  Upload,
  Trash2,
  Share2,
  Play,
  Pause,
  Plus,
  Search,
  FolderSync,
  Filter,
  Users,
  BookOpen,
  FileCode2,
  FolderArchive,
  HardDrive,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { MediaFile, Client, Program } from '../types';
import { dataStore } from '../lib/dataStore';
import { formatFileSize, formatHebrewDate } from '../lib/utils';
import { AudioRecorder } from '../components/media/AudioRecorder';
import { TransferMediaModal } from '../components/dialogs/TransferMediaModal';
import { GoogleDriveModal } from '../components/dialogs/GoogleDriveModal';
import { ShareMediaModal } from '../components/dialogs/ShareMediaModal';
import { compressImageFile } from '../lib/indexedDbStorage';
import { MediaImage } from '../components/media/MediaImage';

interface MediaGalleryViewProps {
  onNavigate?: (path: string) => void;
}

export const MediaGalleryView: React.FC<MediaGalleryViewProps> = ({ onNavigate }) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [clientsMap, setClientsMap] = useState<Record<string, Client>>({});
  const [programsMap, setProgramsMap] = useState<Record<string, Program>>({});

  const [activeTab, setActiveTab] = useState<'all' | 'general' | 'clients' | 'programs'>('all');
  const [fileTypeFilter, setFileTypeFilter] = useState<'all' | 'audio' | 'image'>('all');
  const [selectedClientIdFilter, setSelectedClientIdFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [showRecorder, setShowRecorder] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [activePlayingUrl, setActivePlayingUrl] = useState<string | null>(null);

  const [transferringFile, setTransferringFile] = useState<MediaFile | null>(null);
  const [shareModalFile, setShareModalFile] = useState<MediaFile | null>(null);
  const [justUploadedNotice, setJustUploadedNotice] = useState<MediaFile | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const refreshData = () => {
    const files = dataStore.getAllMediaFiles();
    setMediaFiles(files);

    const clientsList = dataStore.getClients();
    const cMap: Record<string, Client> = {};
    clientsList.forEach((c) => {
      cMap[c.id] = c;
    });
    setClientsMap(cMap);

    const progsList = dataStore.getPrograms();
    const pMap: Record<string, Program> = {};
    progsList.forEach((p) => {
      pMap[p.id] = p;
    });
    setProgramsMap(pMap);
  };

  useEffect(() => {
    refreshData();
    const unsubscribe = dataStore.subscribe(() => {
      refreshData();
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(async (file: File) => {
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
        const newMedia = dataStore.addMediaFile({
          name: file.name,
          url: dataUrl,
          type: file.type.startsWith('audio') ? 'audio' : 'image',
          size: Math.round(dataUrl.length * 0.75),
          category: 'general',
          parent_id: 'general',
        });
        setJustUploadedNotice(newMedia);
        setTimeout(() => setJustUploadedNotice((cur) => (cur?.id === newMedia.id ? null : cur)), 8000);
      });
      e.target.value = '';
    }
  };

  const handleRecordingComplete = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const newMedia = dataStore.addMediaFile({
        name: file.name,
        url: dataUrl,
        type: 'audio',
        size: file.size,
        category: 'general',
        parent_id: 'general',
      });
      setShowRecorder(false);
      setJustUploadedNotice(newMedia);
      setTimeout(() => setJustUploadedNotice((cur) => (cur?.id === newMedia.id ? null : cur)), 8000);
    };
    reader.readAsDataURL(file);
  };

  const handlePlayAudio = async (file: MediaFile) => {
    let playUrl = file.url;
    if (!playUrl || playUrl.startsWith('cloud_media:') || playUrl.startsWith('idb_media:')) {
      const resolved = await dataStore.resolveMediaFileUrl(file.id);
      if (resolved) {
        playUrl = resolved;
      } else {
        return;
      }
    }

    if (activePlayingUrl === playUrl) {
      audioRef.current?.pause();
      setActivePlayingUrl(null);
    } else {
      setActivePlayingUrl(playUrl);
      if (audioRef.current) {
        audioRef.current.src = playUrl;
        audioRef.current.play();
      }
    }
  };

  const handleShare = (file: MediaFile) => {
    setShareModalFile(file);
  };

  const saveRename = (id: string) => {
    if (newNameInput.trim()) {
      dataStore.renameMediaFile(id, newNameInput.trim());
    }
    setRenamingId(null);
  };

  // Filter logic
  const filteredFiles = mediaFiles.filter((f) => {
    // Search term
    if (searchTerm && !f.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    // File type filter
    if (fileTypeFilter !== 'all' && f.type !== fileTypeFilter) {
      return false;
    }
    // Tab filter
    if (activeTab === 'general') {
      return f.category === 'general' || !f.parent_id || f.parent_id === 'general';
    }
    if (activeTab === 'clients') {
      if (f.category !== 'client') return false;
      if (selectedClientIdFilter !== 'all' && f.parent_id !== selectedClientIdFilter) {
        return false;
      }
      return true;
    }
    if (activeTab === 'programs') {
      if (f.category !== 'program') return false;
      if (selectedClientIdFilter !== 'all') {
        const prog = programsMap[f.parent_id];
        if (!prog || prog.client_id !== selectedClientIdFilter) return false;
      }
      return true;
    }
    return true;
  });

  const generalCount = mediaFiles.filter((m) => m.category === 'general' || !m.parent_id || m.parent_id === 'general').length;
  const clientCount = mediaFiles.filter((m) => m.category === 'client').length;
  const programCount = mediaFiles.filter((m) => m.category === 'program').length;

  return (
    <div className="space-y-6 dir-rtl font-heebo">
      <audio
        ref={audioRef}
        onEnded={() => setActivePlayingUrl(null)}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FolderArchive className="w-6 h-6 text-primary" />
            ספריית מדיה וקבצים כללית
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            ניהול מרכזי של כל ההקלטות, התיעודים, התמונות והקבצים בקליניקה ושיוכם ללקוחות ותוכניות טיפול
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={() => setShowDriveModal(true)}
            className="px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
          >
            <HardDrive className="w-4 h-4" />
            Google Drive
          </button>

          <button
            onClick={() => setShowRecorder((p) => !p)}
            className={`px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs ${
              showRecorder ? 'bg-rose-600 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            <Plus className="w-4 h-4" />
            {showRecorder ? 'סגור מקליט' : 'הקלטת שמע חדשה'}
          </button>

          <label className="px-4 py-2 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-all">
            <Upload className="w-4 h-4" />
            העלה קובץ למדיה כללית
            <input
              type="file"
              multiple
              accept="image/*,audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Just Uploaded Quick Notification Banner */}
      {justUploadedNotice && (
        <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex items-center justify-between gap-3 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
            <span className="truncate">
              הקובץ <strong>{justUploadedNotice.name}</strong> הועלה בהצלחה לספריית המדיה!
            </span>
          </div>
          <button
            onClick={() => setShareModalFile(justUploadedNotice)}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shrink-0 flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            שתף קובץ עכשיו
          </button>
        </div>
      )}

      {/* Audio Recorder Panel */}
      {showRecorder && (
        <div className="bg-card border border-border p-4 rounded-2xl shadow-md">
          <AudioRecorder
            onRecordingComplete={handleRecordingComplete}
            onCancel={() => setShowRecorder(false)}
          />
        </div>
      )}

      {/* Category Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2 rounded-2xl border border-border">
        <div className="flex items-center gap-1 overflow-x-auto w-full sm:w-auto">
          <button
            onClick={() => { setActiveTab('all'); setSelectedClientIdFilter('all'); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            הכל ({mediaFiles.length})
          </button>

          <button
            onClick={() => { setActiveTab('general'); setSelectedClientIdFilter('all'); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'general'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            מדיה כללית ({generalCount})
          </button>

          <button
            onClick={() => { setActiveTab('clients'); setSelectedClientIdFilter('all'); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'clients'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            קבצי לקוחות ({clientCount})
          </button>

          <button
            onClick={() => { setActiveTab('programs'); setSelectedClientIdFilter('all'); }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeTab === 'programs'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            קבצי תוכניות טיפול ({programCount})
          </button>
        </div>

        {/* Filter & Search Inputs */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Client Filter Dropdown if in Clients or Programs tab */}
          {(activeTab === 'clients' || activeTab === 'programs') && (
            <select
              value={selectedClientIdFilter}
              onChange={(e) => setSelectedClientIdFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none"
            >
              <option value="all">כל הלקוחות</option>
              {(Object.values(clientsMap) as Client[]).map((c) => (
                <option key={`client-opt-${c.id}`} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          )}

          {/* Type filter */}
          <select
            value={fileTypeFilter}
            onChange={(e) => setFileTypeFilter(e.target.value as any)}
            className="px-3 py-1.5 text-xs bg-muted/50 border border-border rounded-xl text-foreground focus:outline-none"
          >
            <option value="all">כל סוגי הקבצים</option>
            <option value="audio">הקלטות שמע בלבד</option>
            <option value="image">תמונות ומסמכים בלבד</option>
          </select>

          {/* Search */}
          <div className="relative flex-1 sm:w-48">
            <Search className="w-3.5 h-3.5 absolute right-3 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="חפש לפי שם קובץ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-8 pl-3 py-1.5 text-xs bg-muted/50 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>
      </div>

      {/* Media Grid */}
      {filteredFiles.length === 0 ? (
        <div className="p-12 text-center bg-card border border-dashed border-border rounded-2xl text-muted-foreground space-y-2">
          <FolderArchive className="w-10 h-10 mx-auto text-muted-foreground/40" />
          <h3 className="font-bold text-sm text-foreground">לא נמצאו קבצי מדיה</h3>
          <p className="text-xs">נסה לשנות את מסנני החיפוש או העלה קבצים חדשים למערכת.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFiles.map((file) => {
            let associationText = 'מדיה כללית';
            let associationClass = 'bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20';

            if (file.category === 'client' && file.parent_id) {
              const client = clientsMap[file.parent_id];
              associationText = `לקוח: ${client ? client.full_name : 'לקוח'}`;
              associationClass = 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20';
            } else if (file.category === 'program' && file.parent_id) {
              const prog = programsMap[file.parent_id];
              const client = prog ? clientsMap[prog.client_id] : null;
              associationText = `תוכנית: ${prog ? prog.title : 'תוכנית'}${client ? ` (${client.full_name})` : ''}`;
              associationClass = 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20';
            }

            return (
              <div
                key={file.id}
                className="bg-card border border-border hover:border-primary/40 rounded-2xl p-4 flex flex-col justify-between transition-all shadow-xs hover:shadow-md relative space-y-3"
              >
                {/* File Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden flex-1">
                    <div
                      className={`p-2.5 rounded-xl shrink-0 ${
                        file.type === 'audio'
                          ? 'bg-purple-500/10 text-purple-600'
                          : 'bg-emerald-500/10 text-emerald-600'
                      }`}
                    >
                      {file.type === 'audio' ? <FileAudio className="w-5 h-5" /> : <FileImage className="w-5 h-5" />}
                    </div>

                    <div className="min-w-0 flex-1">
                      {renamingId === file.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={newNameInput}
                            onChange={(e) => setNewNameInput(e.target.value)}
                            className="px-2 py-1 text-xs bg-background border border-border rounded-lg w-full"
                            autoFocus
                          />
                          <button
                            onClick={() => saveRename(file.id)}
                            className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-lg"
                          >
                            שמור
                          </button>
                        </div>
                      ) : (
                        <h4
                          className="font-bold text-xs text-foreground truncate cursor-pointer hover:text-primary transition-colors"
                          title={file.name}
                          onClick={() => {
                            setRenamingId(file.id);
                            setNewNameInput(file.name);
                          }}
                        >
                          {file.name}
                        </h4>
                      )}
                      <span className="text-[10px] text-muted-foreground block mt-0.5">
                        {formatFileSize(file.size)} • {formatHebrewDate(file.created_at, 'dd/MM/yy HH:mm')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {file.drive_view_link && (
                      <a
                        href={file.drive_view_link}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 hover:bg-emerald-500/10 text-emerald-600 rounded-lg transition-colors"
                        title="פתח ב-Google Drive"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                    <button
                      onClick={() => handleShare(file)}
                      className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                      title="שתף קובץ"
                    >
                      <Share2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`האם למחוק את קובץ המדיה "${file.name}"?`)) {
                          dataStore.deleteMediaFile(file.id);
                        }
                      }}
                      className="p-1.5 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded-lg transition-colors"
                      title="מחק קובץ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Association Badge */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`px-2.5 py-1 text-[10px] font-bold rounded-lg border truncate max-w-[220px] ${associationClass}`}>
                      {associationText}
                    </span>
                    {(file.source === 'drive' || file.drive_file_id) && (
                      <span className="px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                        <HardDrive className="w-2.5 h-2.5" />
                        Drive
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => setTransferringFile(file)}
                    className="px-2.5 py-1 text-[11px] font-bold text-primary hover:bg-primary/10 rounded-lg border border-primary/20 flex items-center gap-1 transition-colors"
                  >
                    <FolderSync className="w-3.5 h-3.5" />
                    העבר / שייך
                  </button>
                </div>

                {/* Audio Player or Image Preview */}
                {file.type === 'audio' ? (
                  <div className="bg-muted/40 p-2.5 rounded-xl flex items-center justify-between gap-2 border border-border/50">
                    <button
                      onClick={() => handlePlayAudio(file)}
                      className="p-2 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors shadow-xs shrink-0"
                    >
                      {activePlayingUrl === file.url ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4 fill-current mr-0.5" />
                      )}
                    </button>
                    <span className="text-[11px] text-muted-foreground flex-1 font-mono truncate">
                      {activePlayingUrl === file.url ? 'מנגן כעת...' : 'לחץ להשמעת התיעוד'}
                    </span>
                  </div>
                ) : (
                  <div className="rounded-xl overflow-hidden border border-border/50 max-h-36 bg-slate-950/5 flex items-center justify-center">
                    <MediaImage
                      file={file}
                      className="w-full h-32 object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer Media Modal */}
      <TransferMediaModal
        isOpen={!!transferringFile}
        onClose={() => setTransferringFile(null)}
        file={transferringFile}
        onTransferSuccess={() => {
          refreshData();
        }}
      />

      {/* Google Drive Modal */}
      <GoogleDriveModal
        isOpen={showDriveModal}
        onClose={() => setShowDriveModal(false)}
        parentId="general"
        category="general"
        targetName="ספריית מדיה כללית"
        onFilesImported={() => {
          refreshData();
        }}
      />

      {/* Share Media Modal */}
      <ShareMediaModal
        isOpen={!!shareModalFile}
        onClose={() => setShareModalFile(null)}
        file={shareModalFile}
        client={shareModalFile ? clientsMap[shareModalFile.parent_id] : null}
      />
    </div>
  );
};
