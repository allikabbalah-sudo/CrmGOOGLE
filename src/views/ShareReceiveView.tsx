import React, { useState, useEffect, useMemo } from 'react';
import {
  Share2,
  FileAudio,
  FileImage,
  FileText,
  FileVideo,
  CheckCircle2,
  User,
  ArrowRight,
  Upload,
  Calendar,
  Sparkles,
  MessageSquare,
  Search,
  ExternalLink,
  Volume2,
} from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { formatFileSize, generateUUID } from '../lib/utils';
import { saveMediaBlobToIDB } from '../lib/indexedDbStorage';

interface ShareReceiveViewProps {
  onNavigate: (path: string) => void;
}

interface ReceivedFileItem {
  id: string;
  name: string;
  size: number;
  type: 'audio' | 'image' | 'video' | 'document';
  url: string;
  file?: File;
  dataUrl?: string;
}

export const ShareReceiveView: React.FC<ShareReceiveViewProps> = ({ onNavigate }) => {
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFileItem[]>([]);
  const [sharedText, setSharedText] = useState('');
  const [sharedTitle, setSharedTitle] = useState('');
  const [sharedUrl, setSharedUrl] = useState('');
  const [isLoadingShared, setIsLoadingShared] = useState(true);

  // Client Selection & Target
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [targetType, setTargetType] = useState<'gallery' | 'session' | 'note'>('gallery');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessClientId, setSavedSuccessClientId] = useState<string | null>(null);

  const clients = dataStore.getClients() || [];
  const availablePrograms = selectedClientId ? dataStore.getPrograms(selectedClientId) : [];
  const availableSessions = selectedClientId ? dataStore.getSessions(selectedClientId) : [];

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const q = clientSearch.toLowerCase();
    return clients.filter(
      (c) =>
        c.full_name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q))
    );
  }, [clients, clientSearch]);

  // Read shared target files and text from Service Worker Cache & URL Params
  useEffect(() => {
    let isMounted = true;

    const readSharedData = async () => {
      setIsLoadingShared(true);

      // 1. Check URL parameters (for GET text/link shares or ?shared=1 redirect)
      const urlParams = new URLSearchParams(window.location.search);
      const urlTitle = urlParams.get('title') || '';
      const urlText = urlParams.get('text') || '';
      const urlShare = urlParams.get('url') || '';

      if (urlTitle) setSharedTitle(urlTitle);
      if (urlText) setSharedText(urlText);
      if (urlShare) setSharedUrl(urlShare);

      const items: ReceivedFileItem[] = [];

      // 2. Check Service Worker Cache (where sw-share-target.js stores files from POST)
      if (typeof caches !== 'undefined') {
        try {
          const cacheExists = await caches.has('pwa-shared-cache');
          if (cacheExists) {
            const cache = await caches.open('pwa-shared-cache');

            // Read metadata
            const metaRes = await cache.match('/pwa-shared-meta.json');
            let filesCount = 0;
            if (metaRes) {
              try {
                const meta = await metaRes.json();
                if (meta.title && !urlTitle) setSharedTitle(meta.title);
                if (meta.text && !urlText) setSharedText(meta.text);
                if (meta.url && !urlShare) setSharedUrl(meta.url);
                filesCount = meta.filesCount || 0;
              } catch (e) {
                console.warn('Error parsing share metadata:', e);
              }
              await cache.delete('/pwa-shared-meta.json');
            }

            // Read files (up to filesCount or search available cached files)
            const countToSearch = Math.max(filesCount, 10);
            for (let i = 0; i < countToSearch; i++) {
              const fileKey = `/pwa-shared-file-${i}`;
              const fileRes = await cache.match(fileKey);
              if (fileRes) {
                const rawName = fileRes.headers.get('x-file-name') || `shared_file_${i}`;
                const name = decodeURIComponent(rawName);
                const mimeType = fileRes.headers.get('x-file-type') || fileRes.headers.get('content-type') || '';
                const blob = await fileRes.blob();

                // Determine file category
                let cat: ReceivedFileItem['type'] = 'document';
                if (mimeType.startsWith('audio/') || name.match(/\.(mp3|wav|m4a|ogg|aac|opus)$/i)) {
                  cat = 'audio';
                } else if (mimeType.startsWith('image/') || name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
                  cat = 'image';
                } else if (mimeType.startsWith('video/') || name.match(/\.(mp4|webm|mov)$/i)) {
                  cat = 'video';
                }

                const fileObj = new File([blob], name, { type: mimeType });
                const blobUrl = URL.createObjectURL(fileObj);

                // Convert blob to DataURL for persistence
                const dataUrl = await new Promise<string>((resolve) => {
                  const reader = new FileReader();
                  reader.onload = () => resolve(reader.result as string);
                  reader.onerror = () => resolve(blobUrl);
                  reader.readAsDataURL(blob);
                });

                items.push({
                  id: generateUUID(),
                  name,
                  size: blob.size,
                  type: cat,
                  url: blobUrl,
                  file: fileObj,
                  dataUrl,
                });

                // Clear from cache so it's not reread on refresh
                await cache.delete(fileKey);
              }
            }
          }
        } catch (err) {
          console.warn('Error reading from pwa-shared-cache:', err);
        }
      }

      if (isMounted) {
        if (items.length > 0) {
          setReceivedFiles(items);
          if (items.some((it) => it.type === 'audio')) {
            setTargetType('session'); // Default audio voice notes to session recording
          }
        }
        setIsLoadingShared(false);
      }
    };

    readSharedData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Manual File Upload handler (to test without native intent)
  const handleManualFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newItems: ReceivedFileItem[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      let cat: ReceivedFileItem['type'] = 'document';
      if (f.type.startsWith('audio/') || f.name.match(/\.(mp3|wav|m4a|ogg|aac|opus)$/i)) {
        cat = 'audio';
      } else if (f.type.startsWith('image/') || f.name.match(/\.(png|jpg|jpeg|webp|gif|svg)$/i)) {
        cat = 'image';
      } else if (f.type.startsWith('video/')) {
        cat = 'video';
      }

      const blobUrl = URL.createObjectURL(f);
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(blobUrl);
        reader.readAsDataURL(f);
      });

      newItems.push({
        id: generateUUID(),
        name: f.name,
        size: f.size,
        type: cat,
        url: blobUrl,
        file: f,
        dataUrl,
      });
    }

    setReceivedFiles((prev) => [...prev, ...newItems]);
    if (newItems.some((it) => it.type === 'audio')) {
      setTargetType('session');
    }
  };

  // Save received items into Client
  const handleSaveToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    setIsSaving(true);
    const client = dataStore.getClientById(selectedClientId);
    if (!client) return;

    try {
      // 1. If text/link was shared from WhatsApp:
      if (sharedText || sharedUrl || sharedTitle) {
        const textToAppend = [
          sharedTitle ? `כותרת שיתוף: ${sharedTitle}` : '',
          sharedText ? sharedText : '',
          sharedUrl ? `קישור: ${sharedUrl}` : '',
          `[התקבל משיתוף ב-${new Date().toLocaleDateString('he-IL')}]`,
        ]
          .filter(Boolean)
          .join('\n');

        const existingNotes = client.notes || '';
        dataStore.updateClient(selectedClientId, {
          notes: existingNotes ? `${existingNotes}\n\n---\n${textToAppend}` : textToAppend,
        });

        // Also add activity log
        dataStore.logActivity(selectedClientId, 'shared_note_added', {
          title: sharedTitle || 'הודעה/טקסט משותף',
        });
      }

      // 2. Save each received file
      for (const item of receivedFiles) {
        const mediaFileId = generateUUID();
        const dataToPersist = item.dataUrl || item.url;

        // Persist binary to IndexedDB
        if (dataToPersist && !dataToPersist.startsWith('http')) {
          await saveMediaBlobToIDB(mediaFileId, dataToPersist);
        }

        // Add to dataStore
        dataStore.addMediaFile({
          name: item.name,
          size: item.size,
          type: item.type,
          category: selectedProgramId ? 'program' : 'client',
          parent_id: selectedProgramId || selectedClientId,
          url: dataToPersist,
        });

        // If user chose to link to a specific session:
        if (targetType === 'session' && selectedSessionId) {
          const currentSession = availableSessions.find((s) => s.id === selectedSessionId);
          const currentAudio = currentSession?.audio_urls || [];
          const currentImages = currentSession?.image_urls || [];
          if (item.type === 'audio' && !currentAudio.includes(dataToPersist)) {
            dataStore.updateSession(selectedSessionId, {
              audio_urls: [...currentAudio, dataToPersist],
            });
          } else if (item.type === 'image' && !currentImages.includes(dataToPersist)) {
            dataStore.updateSession(selectedSessionId, {
              image_urls: [...currentImages, dataToPersist],
            });
          }
        }

        dataStore.logActivity(selectedClientId, 'shared_media_saved', {
          name: item.name,
          type: item.type,
          size: item.size,
        });
      }

      // If user opted to create a new session from shared audio recording
      if (targetType === 'session' && !selectedSessionId && receivedFiles.some((f) => f.type === 'audio')) {
        const audioItem = receivedFiles.find((f) => f.type === 'audio');
        const audioUrl = audioItem?.dataUrl || audioItem?.url || '';
        dataStore.addSession({
          client_id: selectedClientId,
          program_id: selectedProgramId || undefined,
          session_date: new Date().toISOString(),
          status: 'completed',
          notes: `מפגש שנוצר מקובץ הקלטה קולית משותף (${audioItem?.name || ''})`,
          audio_urls: audioUrl ? [audioUrl] : [],
          image_urls: [],
        });
      }

      setSavedSuccessClientId(selectedClientId);
    } catch (err: any) {
      alert('שגיאה בשמירת הקובץ: ' + (err.message || err));
    } finally {
      setIsSaving(false);
    }
  };

  // Success view
  if (savedSuccessClientId) {
    const client = dataStore.getClientById(savedSuccessClientId);
    return (
      <div className="max-w-xl mx-auto py-10 px-4 text-center space-y-5 animate-in fade-in">
        <div className="w-16 h-16 bg-teal-500/10 text-teal-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-black text-foreground">הקובץ נקלט ונשמר בהצלחה!</h2>
          <p className="text-sm text-muted-foreground">
            הקובץ שוייך לכרטיס של <strong>{client?.full_name || 'הלקוח'}</strong>
          </p>
        </div>
        <div className="flex items-center justify-center gap-3 pt-3">
          <button
            onClick={() => onNavigate(`/clients/${savedSuccessClientId}`)}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2"
          >
            <span>מעבר לכרטיס הלקוח</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-4 py-2.5 bg-card hover:bg-muted text-foreground border border-border font-medium text-xs sm:text-sm rounded-xl transition-colors"
          >
            ללוח הבקרה
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 dir-rtl text-right">
      {/* Top Banner / Status */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-teal-500/10 text-teal-600 dark:text-teal-400 rounded-xl">
              <Share2 className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-teal-500/10 text-teal-700 dark:text-teal-300 text-[10px] font-bold mb-1">
                <Sparkles className="w-3 h-3" />
                <span>קליטת שיתוף חיצוני (Share Target)</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">שיוך קובץ או הקלטה ללקוח</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                קליטת קובץ שמע, תמונה או הודעה שנשלחו מוואטסאפ או מכל אפליקציה במכשיר
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground p-1"
          >
            ביטול
          </button>
        </div>

        {/* Loading state indicator */}
        {isLoadingShared && (
          <div className="p-4 bg-muted/40 rounded-xl text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>סורק קבצים שהתקבלו מהמכשיר...</span>
          </div>
        )}

        {/* Display Received Shared Files Preview */}
        {receivedFiles.length > 0 ? (
          <div className="space-y-3">
            <div className="text-xs font-bold text-foreground flex items-center justify-between">
              <span>קבצים שנקלטו ({receivedFiles.length}):</span>
              <span className="text-[11px] text-teal-600 font-semibold">מוכנים לשיוך</span>
            </div>

            <div className="space-y-3">
              {receivedFiles.map((fileItem, idx) => (
                <div
                  key={fileItem.id || idx}
                  className="p-4 bg-muted/30 border border-border rounded-xl space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 bg-card rounded-lg border border-border shrink-0 text-teal-600">
                        {fileItem.type === 'audio' && <FileAudio className="w-6 h-6 text-indigo-600" />}
                        {fileItem.type === 'image' && <FileImage className="w-6 h-6 text-emerald-600" />}
                        {fileItem.type === 'video' && <FileVideo className="w-6 h-6 text-purple-600" />}
                        {fileItem.type === 'document' && <FileText className="w-6 h-6 text-amber-600" />}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                          {fileItem.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatFileSize(fileItem.size)} • {fileItem.type.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Audio Player Preview */}
                  {fileItem.type === 'audio' && (
                    <div className="pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>האזנה להקלטה שהתקבלה:</span>
                      </div>
                      <audio controls className="w-full h-10 rounded-lg" src={fileItem.url} />
                    </div>
                  )}

                  {/* Image Thumbnail Preview */}
                  {fileItem.type === 'image' && (
                    <div className="pt-2 border-t border-border/60">
                      <img
                        src={fileItem.url}
                        alt={fileItem.name}
                        className="max-h-48 rounded-xl object-contain mx-auto border border-border bg-black/5"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Display Received Text or Link (e.g. from WhatsApp text share) */}
        {(sharedText || sharedTitle || sharedUrl) && (
          <div className="p-4 bg-teal-50 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-teal-900 dark:text-teal-200">
              <MessageSquare className="w-4 h-4 text-teal-600" />
              <span>הודעה / טקסט שהתקבל מוואטסאפ:</span>
            </div>
            {sharedTitle && <div className="text-xs font-bold text-foreground">{sharedTitle}</div>}
            {sharedText && (
              <p className="text-xs text-muted-foreground whitespace-pre-wrap bg-card p-2.5 rounded-lg border border-border">
                {sharedText}
              </p>
            )}
            {sharedUrl && (
              <div className="flex items-center gap-1.5 text-xs text-teal-700 dark:text-teal-300 font-mono">
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                <a href={sharedUrl} target="_blank" rel="noopener noreferrer" className="underline truncate">
                  {sharedUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Empty state / Manual Test Picker if opened directly */}
        {receivedFiles.length === 0 && !sharedText && !isLoadingShared && (
          <div className="p-6 border-2 border-dashed border-border rounded-xl text-center space-y-3 bg-muted/20">
            <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                לא זוהה קובץ משיתוף פעיל
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                בטלפון: היכנס לוואטסאפ, לחץ על שיתוף (Share) בהקלטה או תמונה, ובחר ב-<strong>Kabbalah CRM</strong>.
              </p>
            </div>
            <div className="pt-2">
              <label className="inline-flex items-center gap-2 px-4 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>בחר קובץ לבדיקה ידנית מהמחשב</span>
                <input
                  type="file"
                  multiple
                  accept="audio/*,image/*,video/*,application/pdf"
                  onChange={handleManualFileInput}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Form: Select Client & Destination */}
        <form onSubmit={handleSaveToClient} className="space-y-4 pt-2">
          {/* Client Search & Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-foreground">
              בחר לקוח לקליטת הקובץ *
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="חיפוש לקוח לפי שם, טלפון או דוא״ל..."
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs bg-muted/30 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium"
              />
            </div>

            <select
              required
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedProgramId('');
                setSelectedSessionId('');
              }}
              className="w-full px-3 py-2.5 text-xs bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium mt-1.5"
            >
              <option value="">-- לחץ לבחירת הלקוח מתוך הרשימה ({filteredClients.length}) --</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Client selected options */}
          {selectedClientId && (
            <div className="space-y-3 p-4 bg-muted/20 border border-border rounded-xl">
              {/* Destination Radio */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-foreground">יעד השמירה בתוך כרטיס הלקוח:</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      targetType === 'session'
                        ? 'bg-teal-500/10 border-teal-500 font-bold text-teal-900 dark:text-teal-200'
                        : 'bg-card border-border text-muted-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      value="session"
                      checked={targetType === 'session'}
                      onChange={() => setTargetType('session')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-teal-600" />
                      <span>שיוך כהקלטת מפגש טיפולי</span>
                    </div>
                  </label>

                  <label
                    className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                      targetType === 'gallery'
                        ? 'bg-teal-500/10 border-teal-500 font-bold text-teal-900 dark:text-teal-200'
                        : 'bg-card border-border text-muted-foreground'
                    }`}
                  >
                    <input
                      type="radio"
                      name="targetType"
                      value="gallery"
                      checked={targetType === 'gallery'}
                      onChange={() => setTargetType('gallery')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    <div className="flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5 text-teal-600" />
                      <span>שמירה בגלריית המדיה של הלקוח</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* If Session selected, offer existing sessions or new */}
              {targetType === 'session' && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-bold text-foreground">
                    בחר מפגש קיים (או השאר ריק ליצירת מפגש חדש אוטומטית):
                  </label>
                  <select
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-card border border-border rounded-lg"
                  >
                    <option value="">+ צור מפגש חדש עם הקלטה זו כעת</option>
                    {availableSessions.map((s, idx) => (
                      <option key={s.id} value={s.id}>
                        מפגש #{idx + 1} • {new Date(s.session_date).toLocaleDateString('he-IL')} • {s.status}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Programs selector if available */}
              {availablePrograms.length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <label className="block text-[11px] font-semibold text-muted-foreground">
                    שיוך לתוכנית עבודה (אופציונלי):
                  </label>
                  <select
                    value={selectedProgramId}
                    onChange={(e) => setSelectedProgramId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-card border border-border rounded-lg"
                  >
                    <option value="">כללי (ללא שיוך לתוכנית)</option>
                    {availablePrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-4 border-t border-border flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
            >
              ביטול
            </button>

            <button
              type="submit"
              disabled={!selectedClientId || isSaving || (receivedFiles.length === 0 && !sharedText)}
              className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs sm:text-sm font-bold rounded-xl shadow-xs transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>שומר...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>שמור קובץ בכרטיס הלקוח</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Instructions card on how to share from WhatsApp */}
      <div className="p-5 bg-card border border-border rounded-2xl space-y-2 text-xs text-muted-foreground leading-relaxed">
        <h3 className="font-bold text-foreground text-xs sm:text-sm flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          כיצד לשתף קובץ אודיו או תמונה מוואטסאפ (WhatsApp) ישירות לאפליקציה?
        </h3>
        <ol className="list-decimal list-inside space-y-1.5 mr-2">
          <li>
            <strong>וודא שהאפליקציה מותקנת בטלפון כ-PWA:</strong> לחץ על "התקן אפליקציה" בדפדפן (Chrome / Edge / Safari).
          </li>
          <li>
            <strong>בוואטסאפ (WhatsApp):</strong> לחץ לחיצה ארוכה על הודעה קולית, קובץ שמע, תמונה או מסמך, ולחץ על כפתור <strong>שיתוף (Share)</strong>.
          </li>
          <li>
            ברשימת האפליקציות במסך השיתוף של הטלפון, בחר ב-<strong>Kabbalah CRM</strong>.
          </li>
          <li>
            האפליקציה תיפתח ישירות במסך זה, תזהה את הקובץ ותאפשר לך לשייך אותו ללקוח ולמפגש בלחיצה אחת!
          </li>
        </ol>
      </div>
    </div>
  );
};
