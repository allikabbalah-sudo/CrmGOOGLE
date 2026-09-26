import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Folder,
  FileImage,
  FileAudio,
  File,
  Search,
  Check,
  CheckSquare,
  Square,
  ArrowRight,
  RefreshCw,
  X,
  ExternalLink,
  Download,
  AlertCircle,
  LogIn,
  LogOut,
  FolderOpen,
} from 'lucide-react';
import {
  fetchGoogleDriveFiles,
  importDriveFilesToMedia,
  signInWithGoogleDrive,
  getDriveAccessToken,
  logoutGoogleDrive,
  DriveFileItem,
  initGoogleDriveAuth,
} from '../../lib/googleDrive';
import { useOrganization } from '../../context/OrganizationContext';
import { formatFileSize, formatHebrewDate } from '../../lib/utils';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentId: string;
  category: 'client' | 'program' | 'general';
  targetName?: string;
  onFilesImported?: () => void;
}

interface BreadcrumbItem {
  id: string;
  name: string;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  parentId,
  category,
  targetName = 'ספריית המדיה',
  onFilesImported,
}) => {
  const { activeOrg } = useOrganization();
  const [isConnected, setIsConnected] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Files & Navigation
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: 'root', name: 'האחסון שלי (My Drive)' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'media' | 'image' | 'audio'>('media');

  const currentFolder = breadcrumbs[breadcrumbs.length - 1];

  // Auth initialization
  useEffect(() => {
    if (!isOpen) return;

    const token = getDriveAccessToken();
    if (token) {
      setIsConnected(true);
    }

    const unsubscribe = initGoogleDriveAuth(
      (user, token) => {
        setIsConnected(true);
        setUserEmail(user.email || null);
      },
      () => {
        if (!getDriveAccessToken()) {
          setIsConnected(false);
          setUserEmail(null);
        }
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  // Load files when connected, folder changes, or filters change
  const loadFiles = async () => {
    if (!getDriveAccessToken()) return;

    setIsLoading(true);
    setError(null);
    try {
      const folderId = currentFolder.id === 'root' ? undefined : currentFolder.id;
      const result = await fetchGoogleDriveFiles({
        folderId,
        searchQuery,
        filterType,
      });
      setFiles(result);
      setSelectedFileIds(new Set());
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
      setError(err.message || 'שגיאה בטעינת קבצים מ-Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && isConnected) {
      loadFiles();
    }
  }, [isOpen, isConnected, currentFolder.id, filterType]);

  const handleConnect = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await signInWithGoogleDrive();
      if (res) {
        setIsConnected(true);
        setUserEmail(res.user.email || null);
      }
    } catch (err: any) {
      console.error('Sign in error:', err);
      setError(err.message || 'ההתחברות ל-Google Drive נכשלה');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    await logoutGoogleDrive();
    setIsConnected(false);
    setUserEmail(null);
    setFiles([]);
    setSelectedFileIds(new Set());
  };

  const handleFolderClick = (folder: DriveFileItem) => {
    setBreadcrumbs((prev) => [...prev, { id: folder.id, name: folder.name }]);
    setSearchQuery('');
  };

  const handleBreadcrumbClick = (index: number) => {
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    setSearchQuery('');
  };

  const toggleSelectFile = (fileId: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const nonFolderFiles = files.filter(
      (f) => f.mimeType !== 'application/vnd.google-apps.folder'
    );
    if (selectedFileIds.size === nonFolderFiles.length) {
      setSelectedFileIds(new Set());
    } else {
      setSelectedFileIds(new Set(nonFolderFiles.map((f) => f.id)));
    }
  };

  const handleImportSelected = async () => {
    if (!activeOrg?.id || selectedFileIds.size === 0) return;

    const filesToImport = files.filter((f) => selectedFileIds.has(f.id));
    setIsImporting(true);
    setError(null);

    try {
      await importDriveFilesToMedia(
        filesToImport,
        parentId,
        category,
        activeOrg.id
      );
      onFilesImported?.();
      onClose();
    } catch (err: any) {
      console.error('Import error:', err);
      setError(err.message || 'שגיאה בייבוא הקבצים מ-Drive');
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                חיבור וייבוא קבצים מ-Google Drive
              </h3>
              <p className="text-xs text-muted-foreground">
                ייבוא הקלטות, תמונות ומדיה ישירות מ-Google Drive אל:{' '}
                <span className="font-bold text-primary">{targetName}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isConnected && userEmail && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-lg border border-border">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="truncate max-w-[160px]">{userEmail}</span>
                <button
                  onClick={handleDisconnect}
                  className="p-1 hover:text-rose-500 transition-colors"
                  title="התנתק מחשבון Google Drive"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {!isConnected ? (
          <div className="p-8 sm:p-12 text-center space-y-5 flex-1 flex flex-col items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/20">
              <HardDrive className="w-8 h-8" />
            </div>

            <div className="max-w-md space-y-2">
              <h4 className="font-bold text-lg text-foreground">
                חיבור חשבון Google Drive
              </h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                התחבר לחשבון ה-Google שלך כדי לדפדף בקבצים, תמונות והקלטות שמע,
                ולייבא אותם בצורה מאובטחת ישירות לתוך הקליניקה ולתיקי המטופלים.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2 max-w-md text-right">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleConnect}
              disabled={isLoading}
              className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              התחבר עכשיו ל-Google Drive
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 border-b border-border bg-muted/20 space-y-3 shrink-0">
              {/* Top controls: search, filter tabs, refresh */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="חיפוש קבצים ותיקיות ב-Drive..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && loadFiles()}
                    className="w-full pr-9 pl-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <div className="flex bg-muted rounded-xl p-0.5 text-xs">
                    <button
                      onClick={() => setFilterType('media')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'media'
                          ? 'bg-white dark:bg-slate-800 text-foreground font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      מדיה (תמונות + שמע)
                    </button>
                    <button
                      onClick={() => setFilterType('audio')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'audio'
                          ? 'bg-white dark:bg-slate-800 text-foreground font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      שמע בלבד
                    </button>
                    <button
                      onClick={() => setFilterType('image')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'image'
                          ? 'bg-white dark:bg-slate-800 text-foreground font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      תמונות
                    </button>
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-3 py-1 rounded-lg font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-white dark:bg-slate-800 text-foreground font-bold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      הכל
                    </button>
                  </div>

                  <button
                    onClick={loadFiles}
                    disabled={isLoading}
                    className="p-2 border border-border bg-white dark:bg-slate-800 hover:bg-muted text-muted-foreground hover:text-foreground rounded-xl transition-colors"
                    title="רענן קבצים"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {/* Breadcrumb path navigation */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-x-auto py-0.5">
                {breadcrumbs.map((crumb, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return (
                    <React.Fragment key={crumb.id}>
                      {idx > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />}
                      <button
                        onClick={() => handleBreadcrumbClick(idx)}
                        disabled={isLast}
                        className={`hover:underline flex items-center gap-1 px-1.5 py-0.5 rounded ${
                          isLast
                            ? 'font-bold text-foreground pointer-events-none'
                            : 'text-primary'
                        }`}
                      >
                        {idx === 0 ? <HardDrive className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                        <span>{crumb.name}</span>
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            </div>

            {/* Error banner if any */}
            {error && (
              <div className="p-3 bg-rose-500/10 border-b border-rose-500/20 text-rose-600 text-xs font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* File List Grid */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {isLoading ? (
                <div className="py-20 text-center space-y-3">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary" />
                  <p className="text-xs text-muted-foreground">טוען קבצים מ-Google Drive...</p>
                </div>
              ) : files.length === 0 ? (
                <div className="py-20 text-center space-y-2 border border-dashed border-border rounded-2xl">
                  <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/40" />
                  <h4 className="font-bold text-sm text-foreground">תיקייה זו ריקה</h4>
                  <p className="text-xs text-muted-foreground">
                    לא נמצאו קבצי מדיה בתיקייה זו התואמים את הסינון הנוכחי.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {files.map((file) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';
                    const isSelected = selectedFileIds.has(file.id);
                    const isImage = file.mimeType.startsWith('image/');
                    const isAudio = file.mimeType.startsWith('audio/');

                    if (isFolder) {
                      return (
                        <div
                          key={file.id}
                          onClick={() => handleFolderClick(file)}
                          className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800/80 border border-border hover:border-primary/50 hover:bg-muted/40 rounded-xl cursor-pointer transition-all group"
                        >
                          <div className="p-2.5 bg-amber-500/10 text-amber-500 rounded-xl group-hover:scale-105 transition-transform">
                            <Folder className="w-5 h-5 fill-amber-500/20" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h5 className="text-xs font-bold text-foreground truncate">
                              {file.name}
                            </h5>
                            <span className="text-[10px] text-muted-foreground">תיקייה</span>
                          </div>
                          <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                        </div>
                      );
                    }

                    return (
                      <div
                        key={file.id}
                        onClick={() => toggleSelectFile(file.id)}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/5 border-primary shadow-xs ring-1 ring-primary'
                            : 'bg-white dark:bg-slate-800/80 border-border hover:border-border/80 hover:bg-muted/30'
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="pt-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4 text-muted-foreground/50 hover:text-foreground" />
                          )}
                        </div>

                        {/* Thumbnail or Icon */}
                        <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden shrink-0 border border-border">
                          {file.thumbnailLink ? (
                            <img
                              src={file.thumbnailLink}
                              alt={file.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : isImage ? (
                            <FileImage className="w-6 h-6 text-blue-500" />
                          ) : isAudio ? (
                            <FileAudio className="w-6 h-6 text-violet-500" />
                          ) : (
                            <File className="w-6 h-6 text-muted-foreground" />
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <h5
                            className="text-xs font-bold text-foreground truncate"
                            title={file.name}
                          >
                            {file.name}
                          </h5>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-1">
                            {file.size ? <span>{formatFileSize(file.size)}</span> : null}
                            {file.size && file.modifiedTime ? <span>•</span> : null}
                            {file.modifiedTime ? (
                              <span>{formatHebrewDate(file.modifiedTime, 'dd/MM/yy')}</span>
                            ) : null}
                          </div>
                        </div>

                        {/* Direct link */}
                        {file.webViewLink && (
                          <a
                            href={file.webViewLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 text-muted-foreground/50 hover:text-primary transition-colors"
                            title="פתח ב-Google Drive"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer / Action Bar */}
            <div className="sticky bottom-0 bg-white dark:bg-slate-900 bg-card border-t border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
                <button
                  onClick={handleSelectAll}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {selectedFileIds.size ===
                  files.filter((f) => f.mimeType !== 'application/vnd.google-apps.folder').length &&
                  files.length > 0
                    ? 'בטל בחירת הכל'
                    : 'בחר את כל הקבצים'}
                </button>

                <span className="text-xs text-muted-foreground">
                  נבחרו: <strong className="text-foreground font-mono">{selectedFileIds.size}</strong> קבצים
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
                >
                  ביטול
                </button>

                <button
                  onClick={handleImportSelected}
                  disabled={selectedFileIds.size === 0 || isImporting}
                  className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {isImporting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  <span>ייבא {selectedFileIds.size > 0 ? `(${selectedFileIds.size})` : ''} למערכת</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
