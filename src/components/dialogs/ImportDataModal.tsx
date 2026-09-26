import React, { useState } from 'react';
import {
  FileArchive,
  Upload,
  X,
  FileJson,
  CheckCircle2,
  AlertCircle,
  Table,
  Image as ImageIcon,
  Music,
  UserCheck,
  Check,
  Plus,
} from 'lucide-react';
import JSZip from 'jszip';
import { dataStore, ImportMappingItem } from '../../lib/dataStore';
import { useOrganization } from '../../context/OrganizationContext';
import { formatFileSize, generateUUID } from '../../lib/utils';

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: () => void;
}

interface ParsedFile {
  fileName: string;
  items: any[];
  sampleKeys: string[];
  detectedType: ImportMappingItem['entityType'];
}

interface ParsedMediaFile {
  id: string;
  fileName: string;
  fullPath: string;
  dataUrl: string;
  size: number;
  type: 'image' | 'audio';
  targetClientId: string;
  isAutoMatched: boolean;
  matchedClientName?: string;
}

const isImageFile = (fileName: string) => /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(fileName);
const isAudioFile = (fileName: string) => /\.(mp3|wav|m4a|ogg|webm|aac|flac)$/i.test(fileName);
const isMediaFileName = (fileName: string) => isImageFile(fileName) || isAudioFile(fileName);

const getMimeType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    bmp: 'image/bmp',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    m4a: 'audio/mp4',
    ogg: 'audio/ogg',
    webm: 'audio/webm',
    aac: 'audio/aac',
    flac: 'audio/flac',
  };
  return mimeMap[ext] || (isImageFile(fileName) ? `image/${ext}` : `audio/${ext}`);
};

const findMatchingClient = (
  pathOrName: string,
  clientsList: { id: string; full_name: string; phone?: string }[]
): { id: string; full_name: string } | null => {
  if (!pathOrName || !clientsList || clientsList.length === 0) return null;
  const normalized = pathOrName.toLowerCase().replace(/_/g, ' ');

  for (const client of clientsList) {
    if (!client) continue;

    // Exact or partial ID match
    if (client.id && normalized.includes(client.id.toLowerCase())) {
      return { id: client.id, full_name: client.full_name };
    }

    // Match full name
    if (client.full_name && client.full_name.trim().length > 1) {
      const name = client.full_name.toLowerCase().trim();
      if (normalized.includes(name)) {
        return { id: client.id, full_name: client.full_name };
      }
      const parts = name.split(/\s+/);
      if (parts.length > 1 && parts.every((p) => p.length > 1 && normalized.includes(p))) {
        return { id: client.id, full_name: client.full_name };
      }
    }

    // Match phone
    if (client.phone && client.phone.replace(/\D/g, '').length >= 7) {
      const cleanPhone = client.phone.replace(/\D/g, '');
      if (normalized.includes(cleanPhone)) {
        return { id: client.id, full_name: client.full_name };
      }
    }
  }

  return null;
};

export const ImportDataModal: React.FC<ImportDataModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
}) => {
  const { activeOrg } = useOrganization();
  const [parsedFiles, setParsedFiles] = useState<ParsedFile[]>([]);
  const [parsedMediaFiles, setParsedMediaFiles] = useState<ParsedMediaFile[]>([]);
  const [batchClientId, setBatchClientId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [successResult, setSuccessResult] = useState<Record<string, number> | null>(null);

  if (!isOpen) return null;

  const existingClients = dataStore.getClients() || [];

  const guessEntityType = (fileName: string, sampleObj: any): ImportMappingItem['entityType'] => {
    const fn = fileName.toLowerCase();
    if (fn.includes('client') || fn.includes('לקוח') || fn.includes('contacts')) return 'clients';
    if (fn.includes('program') || fn.includes('תוכני')) return 'programs';
    if (fn.includes('session') || fn.includes('מפגש') || fn.includes('meeting') || fn.includes('calendar')) return 'sessions';
    if (fn.includes('task') || fn.includes('משימ')) return 'tasks';
    if (fn.includes('media') || fn.includes('file') || fn.includes('קובץ')) return 'mediaFiles';
    if (fn.includes('activity') || fn.includes('log') || fn.includes('יומן')) return 'activityLogs';
    if (fn.includes('notif') || fn.includes('התרא')) return 'notifications';

    if (sampleObj && typeof sampleObj === 'object') {
      if (sampleObj.clients || sampleObj.sessions || sampleObj.organization) return 'full_export';
      if ('full_name' in sampleObj || 'phone' in sampleObj || 'mother_name' in sampleObj) return 'clients';
      if ('session_date' in sampleObj || 'program_id' in sampleObj) return 'sessions';
      if ('due_date' in sampleObj && 'priority' in sampleObj) return 'tasks';
      if ('total_sessions' in sampleObj) return 'programs';
      if ('url' in sampleObj || 'category' in sampleObj) return 'mediaFiles';
    }

    return 'clients';
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsLoading(true);
    setError('');
    setSuccessResult(null);

    const newParsedJson: ParsedFile[] = [];
    const newParsedMedia: ParsedMediaFile[] = [];
    const importedClientsFromJson: { id: string; full_name: string; phone?: string }[] = [];

    try {
      // First pass: scan for JSON files to extract any newly imported client names/IDs
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.name.endsWith('.zip')) {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);

          for (const relativePath of Object.keys(zipContent.files)) {
            const entry = zipContent.files[relativePath];
            if (entry.dir || !relativePath.endsWith('.json')) continue;

            try {
              const text = await entry.async('string');
              const parsed = JSON.parse(text);
              const items = Array.isArray(parsed) ? parsed : [parsed];

              items.forEach((item) => {
                if (item && typeof item === 'object') {
                  if (item.full_name) {
                    importedClientsFromJson.push({
                      id: item.id || generateUUID(),
                      full_name: item.full_name,
                      phone: item.phone,
                    });
                  } else if (Array.isArray(item.clients)) {
                    item.clients.forEach((c: any) => {
                      if (c && c.full_name) {
                        importedClientsFromJson.push({
                          id: c.id || generateUUID(),
                          full_name: c.full_name,
                          phone: c.phone,
                        });
                      }
                    });
                  }
                }
              });
            } catch (err) {
              console.warn('Error pre-scanning JSON in zip:', relativePath);
            }
          }
        } else if (file.name.endsWith('.json')) {
          try {
            const text = await file.text();
            const parsed = JSON.parse(text);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            items.forEach((item) => {
              if (item && typeof item === 'object' && item.full_name) {
                importedClientsFromJson.push({
                  id: item.id || generateUUID(),
                  full_name: item.full_name,
                  phone: item.phone,
                });
              }
            });
          } catch (err) {
            console.warn('Error pre-scanning direct JSON:', file.name);
          }
        }
      }

      // Combine existing and newly imported clients list for smart matching
      const allClientsList = [
        ...existingClients.map((c) => ({ id: c.id, full_name: c.full_name, phone: c.phone })),
        ...importedClientsFromJson,
      ];

      // Second pass: Process all files (ZIP entries, JSON, images, audio)
      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        if (file.name.endsWith('.zip')) {
          const zip = new JSZip();
          const zipContent = await zip.loadAsync(file);

          for (const relativePath of Object.keys(zipContent.files)) {
            const entry = zipContent.files[relativePath];
            if (entry.dir) continue;

            const lowerName = relativePath.toLowerCase();

            if (lowerName.endsWith('.json')) {
              try {
                const text = await entry.async('string');
                const parsed = JSON.parse(text);
                const items = Array.isArray(parsed) ? parsed : [parsed];
                const sampleObj = items[0] || {};
                const sampleKeys = typeof sampleObj === 'object' && sampleObj ? Object.keys(sampleObj).slice(0, 6) : [];

                newParsedJson.push({
                  fileName: relativePath,
                  items,
                  sampleKeys,
                  detectedType: guessEntityType(relativePath, sampleObj),
                });
              } catch (err) {
                console.warn('Could not parse JSON inside ZIP:', relativePath);
              }
            } else if (isMediaFileName(lowerName)) {
              try {
                const base64Data = await entry.async('base64');
                const mime = getMimeType(relativePath);
                const dataUrl = `data:${mime};base64,${base64Data}`;
                const uint8 = await entry.async('uint8array');
                const size = uint8.byteLength;
                const fileName = relativePath.split('/').pop() || relativePath;

                const match = findMatchingClient(relativePath, allClientsList);

                newParsedMedia.push({
                  id: generateUUID(),
                  fileName,
                  fullPath: relativePath,
                  dataUrl,
                  size,
                  type: isAudioFile(lowerName) ? 'audio' : 'image',
                  targetClientId: match ? match.id : '',
                  isAutoMatched: !!match,
                  matchedClientName: match ? match.full_name : undefined,
                });
              } catch (err) {
                console.warn('Could not read binary media file from ZIP:', relativePath, err);
              }
            }
          }
        } else if (file.name.endsWith('.json')) {
          const text = await file.text();
          try {
            const parsed = JSON.parse(text);
            const items = Array.isArray(parsed) ? parsed : [parsed];
            const sampleObj = items[0] || {};
            const sampleKeys = typeof sampleObj === 'object' && sampleObj ? Object.keys(sampleObj).slice(0, 6) : [];

            newParsedJson.push({
              fileName: file.name,
              items,
              sampleKeys,
              detectedType: guessEntityType(file.name, sampleObj),
            });
          } catch (err) {
            setError(`קובץ ${file.name} אינו בפורמט JSON תקין`);
          }
        } else if (isMediaFileName(file.name)) {
          try {
            const dataUrl = await readFileAsDataURL(file);
            const match = findMatchingClient(file.name, allClientsList);

            newParsedMedia.push({
              id: generateUUID(),
              fileName: file.name,
              fullPath: file.name,
              dataUrl,
              size: file.size,
              type: isAudioFile(file.name) ? 'audio' : 'image',
              targetClientId: match ? match.id : '',
              isAutoMatched: !!match,
              matchedClientName: match ? match.full_name : undefined,
            });
          } catch (err) {
            console.warn('Error reading media file:', file.name);
          }
        }
      }

      setParsedFiles(newParsedJson);
      setParsedMediaFiles(newParsedMedia);

      if (newParsedJson.length === 0 && newParsedMedia.length === 0) {
        setError('לא נמצאו קובצי JSON או קובצי מדיה תקינים בקובץ הטעון');
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה בפענוח הקובץ');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTypeChange = (index: number, newType: ImportMappingItem['entityType']) => {
    setParsedFiles((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], detectedType: newType };
      return updated;
    });
  };

  const handleMediaClientChange = (mediaId: string, clientId: string) => {
    setParsedMediaFiles((prev) =>
      prev.map((m) => (m.id === mediaId ? { ...m, targetClientId: clientId } : m))
    );
  };

  const handleApplyBatchClient = () => {
    if (!batchClientId) return;
    setParsedMediaFiles((prev) =>
      prev.map((m) => ({ ...m, targetClientId: batchClientId }))
    );
  };

  const handleExecuteImport = () => {
    if (parsedFiles.length === 0 && parsedMediaFiles.length === 0) return;
    setIsLoading(true);
    setError('');

    try {
      const importedCounts: Record<string, number> = {};

      // 1. Import mapped JSON files
      if (parsedFiles.length > 0) {
        const mappings: ImportMappingItem[] = parsedFiles.map((pf) => ({
          fileName: pf.fileName,
          entityType: pf.detectedType,
          items: pf.items,
        }));

        const res = dataStore.importMappedJsonEntities(mappings);
        Object.assign(importedCounts, res.importedCounts);
      }

      // 2. Import parsed media files and link to selected clients
      if (parsedMediaFiles.length > 0) {
        let mediaCount = 0;
        parsedMediaFiles.forEach((media) => {
          dataStore.addMediaFile({
            url: media.dataUrl,
            name: media.fileName,
            size: media.size,
            type: media.type,
            category: 'client',
            parent_id: media.targetClientId || '',
          });
          mediaCount++;
        });

        importedCounts.mediaFiles = (importedCounts.mediaFiles || 0) + mediaCount;
      }

      setSuccessResult(importedCounts);
      if (onImportComplete) onImportComplete();
    } catch (err: any) {
      setError(err.message || 'שגיאה בביצוע הייבוא');
    } finally {
      setIsLoading(false);
    }
  };

  const entityLabels: Record<ImportMappingItem['entityType'], string> = {
    clients: '👥 לקוחות ומטופלים',
    programs: '📋 תוכניות טיפול',
    sessions: '📅 מפגשים ויומן',
    tasks: '✅ משימות',
    mediaFiles: '📁 קבצים ומדיה',
    activityLogs: '📜 יומן פעילות',
    notifications: '🔔 התראות',
    full_export: '📦 קובץ ייצוא מלא (All Entities)',
    ignore: '❌ התעלם מקובץ זה',
  };

  const availableClients = dataStore.getClients() || [];

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-right animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2">
            <FileArchive className="w-5 h-5 text-primary" />
            <div>
              <h3 className="font-bold text-sm text-foreground">ייבוא נתונים מ-ZIP, קבצי JSON ומדיה</h3>
              <p className="text-[11px] text-muted-foreground">
                ייבוא ושיוך לקוחות, תוכניות, מפגשים ותמונות/הקלטות לקליניקה: <span className="font-bold text-primary">{activeOrg?.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successResult ? (
            <div className="p-6 bg-teal-500/10 border border-teal-500/30 rounded-2xl space-y-4 text-center">
              <div className="w-14 h-14 bg-teal-500 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-black text-lg text-teal-700 dark:text-teal-300">הייבוא הושלם בהצלחה!</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  כל הנתונים והמדיה שויכו והתווספו בהצלחה לקליניקה הפעילה
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs pt-2">
                {Object.entries(successResult).map(([key, count]) => {
                  if (count === 0) return null;
                  return (
                    <div key={key} className="bg-card p-3 rounded-xl border border-border shadow-2xs">
                      <div className="font-extrabold text-primary text-base">{count}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {entityLabels[key as ImportMappingItem['entityType']] || key}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  setParsedFiles([]);
                  setParsedMediaFiles([]);
                  setSuccessResult(null);
                  onClose();
                }}
                className="mt-3 px-6 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow-xs hover:bg-primary/90 transition-colors"
              >
                סגור חלון
              </button>
            </div>
          ) : (
            <>
              {/* Dropzone */}
              <div className="border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40 transition-all rounded-2xl p-6 text-center cursor-pointer relative">
                <input
                  type="file"
                  accept=".zip, .json, image/*, audio/*"
                  multiple
                  onChange={handleFileUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div className="space-y-2 pointer-events-none">
                  <div className="w-12 h-12 bg-primary/10 text-primary rounded-2xl flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <h4 className="text-xs font-bold text-foreground">לחץ לבחירת קובץ ZIP, JSON או קבצי מדיה (תמונות/הקלטות)</h4>
                  <p className="text-[11px] text-muted-foreground">
                    תמיכה מלאה בארכיוני ZIP המכילים קבצי נתונים ותמונות/הקלטות, או העלאה ישירה של קבצי מדיה ושיוכם ללקוח
                  </p>
                </div>
              </div>

              {isLoading && (
                <div className="p-4 text-center text-xs text-muted-foreground animate-pulse">
                  מעבד ומפענח קבצים ומדיה...
                </div>
              )}

              {/* Media Files Parsing & Assignment Section */}
              {parsedMediaFiles.length > 0 && (
                <div className="space-y-3 bg-card border border-primary/20 rounded-2xl p-4 bg-primary/5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
                    <div>
                      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <ImageIcon className="w-4 h-4 text-primary" />
                        קבצי מדיה שנמצאו לייבוא ({parsedMediaFiles.length})
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        שיוך אוטומטי או ידני של תמונות והקלטות לכרטיס הלקוח הרלוונטי
                      </p>
                    </div>

                    {/* Batch Client Selector */}
                    {availableClients.length > 0 && (
                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <select
                          value={batchClientId}
                          onChange={(e) => setBatchClientId(e.target.value)}
                          className="text-xs bg-card border border-border rounded-xl px-2.5 py-1 font-medium text-foreground"
                        >
                          <option value="">שייך את כל המדיה ללקוח...</option>
                          {availableClients.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.full_name} ({c.phone})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={handleApplyBatchClient}
                          disabled={!batchClientId}
                          className="px-2.5 py-1 bg-primary text-primary-foreground text-xs font-bold rounded-xl disabled:opacity-50 hover:bg-primary/90 transition-colors shrink-0"
                        >
                          החל
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {parsedMediaFiles.map((media) => {
                      return (
                        <div
                          key={media.id}
                          className="bg-card border border-border p-2.5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            {media.type === 'image' ? (
                              <div className="w-10 h-10 rounded-lg overflow-hidden border border-border bg-muted shrink-0 relative">
                                <img src={media.dataUrl} alt={media.fileName} className="w-full h-full object-cover" />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center shrink-0 border border-amber-500/20">
                                <Music className="w-5 h-5" />
                              </div>
                            )}

                            <div className="min-w-0 space-y-0.5">
                              <div className="font-bold text-foreground truncate dir-ltr">{media.fileName}</div>
                              <div className="text-[10px] text-muted-foreground flex items-center gap-2">
                                <span>{formatFileSize(media.size)}</span>
                                {media.isAutoMatched && media.matchedClientName && (
                                  <span className="text-[10px] bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                    <UserCheck className="w-3 h-3" />
                                    זיהוי אוטומטי: {media.matchedClientName}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Client Dropdown Selector */}
                          <div className="shrink-0">
                            <select
                              value={media.targetClientId}
                              onChange={(e) => handleMediaClientChange(media.id, e.target.value)}
                              className="text-xs bg-muted/40 border border-border rounded-xl px-2.5 py-1.5 font-bold text-foreground focus:ring-2 focus:ring-primary focus:outline-none max-w-[200px]"
                            >
                              <option value="">ללא שיוך (קובץ כללי בקליניקה)</option>
                              {availableClients.map((c) => (
                                <option key={c.id} value={c.id}>
                                  👤 {c.full_name} ({c.phone})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Parsed JSON Files List with Dropdown Mapping */}
              {parsedFiles.length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Table className="w-4 h-4 text-primary" />
                      קובצי נתונים (JSON) שהתגלו ({parsedFiles.length})
                    </h4>
                    <span className="text-[11px] text-muted-foreground">וודא את שיוך סוג המידע לכל קובץ</span>
                  </div>

                  <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                    {parsedFiles.map((file, idx) => (
                      <div
                        key={idx}
                        className="bg-muted/30 border border-border p-3 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <FileJson className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="font-bold text-xs truncate dir-ltr">{file.fileName}</span>
                            <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full shrink-0">
                              {file.items?.length || 0} רשומות
                            </span>
                          </div>
                          {(file.sampleKeys?.length || 0) > 0 && (
                            <p className="text-[10px] text-muted-foreground truncate dir-ltr">
                              שדות בקובץ: {file.sampleKeys.join(', ')}
                            </p>
                          )}
                        </div>

                        {/* Mapping Selector */}
                        <div className="shrink-0">
                          <select
                            value={file.detectedType}
                            onChange={(e) => handleTypeChange(idx, e.target.value as ImportMappingItem['entityType'])}
                            className="text-xs bg-card border border-border rounded-xl px-2.5 py-1.5 font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="clients">{entityLabels.clients}</option>
                            <option value="sessions">{entityLabels.sessions}</option>
                            <option value="programs">{entityLabels.programs}</option>
                            <option value="tasks">{entityLabels.tasks}</option>
                            <option value="mediaFiles">{entityLabels.mediaFiles}</option>
                            <option value="activityLogs">{entityLabels.activityLogs}</option>
                            <option value="notifications">{entityLabels.notifications}</option>
                            <option value="full_export">{entityLabels.full_export}</option>
                            <option value="ignore">{entityLabels.ignore}</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!successResult && (
          <div className="p-4 border-t border-border bg-muted/20 flex items-center justify-between shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:bg-muted rounded-xl transition-colors"
            >
              ביטול
            </button>

            <button
              type="button"
              onClick={handleExecuteImport}
              disabled={(parsedFiles.length === 0 && parsedMediaFiles.length === 0) || isLoading}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              בצע ייבוא לארגון {activeOrg?.name || ''}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
