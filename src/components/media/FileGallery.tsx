import React, { useState, useEffect } from 'react';
import {
  FileAudio,
  FileImage,
  Upload,
  Trash2,
  Edit2,
  Share2,
  FolderSync,
  Play,
  Pause,
  Plus,
  X,
  Search,
  HardDrive,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { MediaFile, Program, Client } from '../../types';
import { formatFileSize, formatHebrewDate } from '../../lib/utils';
import { AudioRecorder } from './AudioRecorder';
import { TransferMediaModal } from '../dialogs/TransferMediaModal';
import { GoogleDriveModal } from '../dialogs/GoogleDriveModal';
import { ShareMediaModal } from '../dialogs/ShareMediaModal';
import { MediaImage } from './MediaImage';
import { dataStore } from '../../lib/dataStore';

interface FileGalleryProps {
  parentId: string; // client_id or program_id
  category: 'client' | 'program' | 'general';
  mediaFiles: MediaFile[];
  availablePrograms?: Program[];
  targetName?: string;
  client?: Client;
  onUploadFile: (file: File) => void;
  onDeleteFile: (id: string) => void;
  onRenameFile: (id: string, newName: string) => void;
  onTransferFile?: (id: string, targetProgramId: string) => void;
}

export const FileGallery: React.FC<FileGalleryProps> = ({
  parentId,
  category,
  mediaFiles,
  availablePrograms = [],
  targetName,
  client,
  onUploadFile,
  onDeleteFile,
  onRenameFile,
  onTransferFile,
}) => {
  const [showRecorder, setShowRecorder] = useState(false);
  const [showDriveModal, setShowDriveModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [newNameInput, setNewNameInput] = useState('');
  const [activePlayingUrl, setActivePlayingUrl] = useState<string | null>(null);
  const [transferModalFile, setTransferModalFile] = useState<MediaFile | null>(null);
  const [shareModalFile, setShareModalFile] = useState<MediaFile | null>(null);
  const [justUploadedNotice, setJustUploadedNotice] = useState<string | null>(null);
  const [justUploadedFile, setJustUploadedFile] = useState<MediaFile | null>(null);

  const prevMediaCount = React.useRef(mediaFiles?.length || 0);

  // If a new media file was added, highlight it with a quick share option
  useEffect(() => {
    const currentCount = mediaFiles?.length || 0;
    if (currentCount > prevMediaCount.current && currentCount > 0) {
      const newestFile = mediaFiles[0];
      if (newestFile) {
        setJustUploadedNotice(newestFile.name);
        setJustUploadedFile(newestFile);
        const timer = setTimeout(() => {
          setJustUploadedNotice(null);
          setJustUploadedFile(null);
        }, 12000);
        return () => clearTimeout(timer);
      }
    }
    prevMediaCount.current = currentCount;
  }, [mediaFiles]);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  const filtered = (mediaFiles || []).filter((f) =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      Array.from(files).forEach((file) => onUploadFile(file));
      e.target.value = '';
    }
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

  const startRename = (file: MediaFile) => {
    setRenamingId(file.id);
    setNewNameInput(file.name);
  };

  const saveRename = (id: string) => {
    if (newNameInput.trim()) {
      onRenameFile(id, newNameInput.trim());
    }
    setRenamingId(null);
  };

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        onEnded={() => setActivePlayingUrl(null)}
        className="hidden"
      />

      {/* Just Uploaded Quick Notification */}
      {justUploadedNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-300 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 truncate">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span className="truncate">
              הקובץ <strong>{justUploadedNotice}</strong> הועלה בהצלחה!
            </span>
          </div>
          {mediaFiles.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const target = justUploadedFile || mediaFiles.find((m) => m.name === justUploadedNotice) || mediaFiles[0];
                if (target) setShareModalFile(target);
              }}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg shrink-0 flex items-center gap-1.5 transition-colors shadow-xs text-xs cursor-pointer"
            >
              <Share2 className="w-3.5 h-3.5" />
              שתף עכשיו
            </button>
          )}
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="חפש בקבצי המדיה..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-9 pl-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          <button
            onClick={() => setShowDriveModal(true)}
            className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
          >
            <HardDrive className="w-3.5 h-3.5" />
            Google Drive
          </button>

          <button
            onClick={() => setShowRecorder((p) => !p)}
            className={`flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 transition-colors ${
              showRecorder ? 'bg-rose-600 text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            {showRecorder ? 'סגור מקליט' : 'הקלט קול'}
          </button>

          <label className="flex-1 sm:flex-initial px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg cursor-pointer flex items-center justify-center gap-1.5 shadow-sm transition-all">
            <Upload className="w-3.5 h-3.5" />
            העלה קובץ
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

      {/* Recorder Panel */}
      {showRecorder && (
        <AudioRecorder
          onRecordingComplete={(file) => {
            onUploadFile(file);
            setShowRecorder(false);
          }}
          onCancel={() => setShowRecorder(false)}
        />
      )}

      {/* Gallery Grid */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center bg-card border border-dashed border-border rounded-xl text-muted-foreground">
          <p className="text-sm">אין קבצי מדיה בקטגוריה זו</p>
          <p className="text-xs mt-1">תוכל להעלות תמונות, הקלטות קול וסיכומי טיפול</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((file) => (
            <div
              key={file.id}
              className="bg-card border border-border hover:border-primary/40 rounded-xl p-3 flex flex-col justify-between transition-all shadow-sm hover:shadow-md relative"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 overflow-hidden">
                  <div className={`p-2 rounded-lg shrink-0 ${file.type === 'audio' ? 'bg-purple-500/10 text-purple-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    {file.type === 'audio' ? <FileAudio className="w-4 h-4" /> : <FileImage className="w-4 h-4" />}
                  </div>

                  <div className="min-w-0 flex-1">
                    {renamingId === file.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newNameInput}
                          onChange={(e) => setNewNameInput(e.target.value)}
                          className="px-2 py-0.5 text-xs bg-background border border-border rounded w-full"
                          autoFocus
                        />
                        <button
                          onClick={() => saveRename(file.id)}
                          className="px-2 py-0.5 bg-primary text-primary-foreground text-xs rounded"
                        >
                          שמור
                        </button>
                      </div>
                    ) : (
                      <h5
                        className="font-medium text-xs truncate cursor-pointer hover:text-primary"
                        title={file.name}
                        onClick={() => startRename(file)}
                      >
                        {file.name}
                      </h5>
                    )}
                    <span className="text-[10px] text-muted-foreground block">
                      {formatFileSize(file.size)} • {formatHebrewDate(file.created_at, 'dd/MM/yy HH:mm')}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleShare(file)}
                    className="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                    title="שתף קובץ (WhatsApp, הורדה, מכשיר)"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => onDeleteFile(file.id)}
                    className="p-1 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded transition-colors"
                    title="מחק קובץ"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Audio Player / Image Preview */}
              {file.type === 'audio' ? (
                <div className="bg-muted/40 p-2 rounded-lg flex items-center justify-between gap-2 mt-1">
                  <button
                    onClick={() => handlePlayAudio(file)}
                    className="p-1.5 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors shadow-xs"
                  >
                    {activePlayingUrl === file.url ? (
                      <Pause className="w-3.5 h-3.5" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current mr-0.5" />
                    )}
                  </button>
                  <span className="text-[11px] text-muted-foreground flex-1 font-mono">
                    {activePlayingUrl === file.url ? 'מנגן כעת...' : 'הקלטה מוכנה להשמעה'}
                  </span>
                </div>
              ) : (
                <div className="mt-1 rounded-lg overflow-hidden border border-border/50 max-h-32 bg-slate-950/5 flex items-center justify-center">
                  <MediaImage
                    file={file}
                    className="w-full h-28 object-cover hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}

              {/* Transfer Option */}
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between text-[11px]">
                <button
                  onClick={() => setTransferModalFile(file)}
                  className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
                >
                  <FolderSync className="w-3.5 h-3.5" />
                  העבר / שייך קובץ
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transfer Media Modal */}
      <TransferMediaModal
        isOpen={!!transferModalFile}
        onClose={() => setTransferModalFile(null)}
        file={transferModalFile}
      />

      {/* Share Media Modal */}
      <ShareMediaModal
        isOpen={!!shareModalFile}
        onClose={() => setShareModalFile(null)}
        file={shareModalFile}
        client={client}
      />
    </div>
  );
};
