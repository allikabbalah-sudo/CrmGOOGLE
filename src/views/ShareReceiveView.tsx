import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  RefreshCw,
  Clipboard,
  Trash2,
  Plus,
  Phone,
  Mail,
  X,
} from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { formatFileSize, generateUUID } from '../lib/utils';
import { saveMediaBlobToIDB } from '../lib/indexedDbStorage';
import { ClientModal } from '../components/dialogs/ClientModal';

interface ShareReceiveViewProps {
  onNavigate: (path: string) => void;
}

export interface ReceivedFileItem {
  id: string;
  name: string;
  size: number;
  type: 'audio' | 'image' | 'video' | 'document';
  url: string;
  file?: File;
  dataUrl?: string;
  isWhatsApp?: boolean;
}

// Magic bytes inspector for WhatsApp typeless blobs
async function detectCategoryAndMime(blob: Blob, rawName: string, rawMime: string) {
  let mime = (rawMime || '').toLowerCase();
  const name = (rawName || '').toLowerCase();

  if (
    mime.startsWith('audio/') ||
    mime.includes('opus') ||
    mime.includes('ogg') ||
    name.match(/\.(opus|ogg|m4a|mp3|wav|aac|amr|3gp)$/i)
  ) {
    return { cat: 'audio' as const, mime: mime || 'audio/ogg' };
  }
  if (
    mime.startsWith('image/') ||
    name.match(/\.(png|jpg|jpeg|webp|gif|svg|bmp)$/i)
  ) {
    return { cat: 'image' as const, mime: mime || 'image/jpeg' };
  }
  if (mime.startsWith('video/') || name.match(/\.(mp4|webm|mov)$/i)) {
    return { cat: 'video' as const, mime: mime || 'video/mp4' };
  }

  // Magic bytes inspection
  try {
    const slice = await blob.slice(0, 16).arrayBuffer();
    const bytes = new Uint8Array(slice);
    if (bytes.length >= 4) {
      // Ogg / Opus voice note: "OggS" (0x4F, 0x67, 0x67, 0x53)
      if (bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
        return { cat: 'audio' as const, mime: 'audio/ogg' };
      }
      // JPEG: 0xFF, 0xD8, 0xFF
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return { cat: 'image' as const, mime: 'image/jpeg' };
      }
      // PNG: 0x89, 0x50, 0x4E, 0x47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
        return { cat: 'image' as const, mime: 'image/png' };
      }
      // WebP: RIFF ... WEBP
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
        return { cat: 'image' as const, mime: 'image/webp' };
      }
      // MP4 / M4A: "ftyp" at offset 4
      if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
        return { cat: 'audio' as const, mime: 'audio/mp4' };
      }
      // AMR: "#!AMR"
      if (bytes[0] === 0x23 && bytes[1] === 0x21 && bytes[2] === 0x41 && bytes[3] === 0x4d) {
        return { cat: 'audio' as const, mime: 'audio/amr' };
      }
      // MP3: "ID3"
      if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
        return { cat: 'audio' as const, mime: 'audio/mpeg' };
      }
      // PDF: "%PDF"
      if (bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
        return { cat: 'document' as const, mime: 'application/pdf' };
      }
    }
  } catch {
    // ignore
  }

  return { cat: 'document' as const, mime: mime || 'application/octet-stream' };
}

export const ShareReceiveView: React.FC<ShareReceiveViewProps> = ({ onNavigate }) => {
  const [receivedFiles, setReceivedFiles] = useState<ReceivedFileItem[]>([]);
  const [sharedText, setSharedText] = useState('');
  const [sharedTitle, setSharedTitle] = useState('');
  const [sharedUrl, setSharedUrl] = useState('');
  const [isLoadingShared, setIsLoadingShared] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Subscription to dataStore updates
  const [, setStoreTick] = useState(0);
  useEffect(() => {
    return dataStore.subscribe(() => setStoreTick((t) => t + 1));
  }, []);

  // Client Selection & Target
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isQuickAddClientOpen, setIsQuickAddClientOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [targetType, setTargetType] = useState<'gallery' | 'session' | 'note'>('gallery');
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccessClientId, setSavedSuccessClientId] = useState<string | null>(null);

  const clients = dataStore.getClients() || [];
  const selectedClient = clients.find((c) => c && c.id === selectedClientId);
  const availablePrograms = selectedClientId ? dataStore.getPrograms(selectedClientId) : [];
  const availableSessions = selectedClientId ? dataStore.getSessions(selectedClientId) : [];

  const filteredClients = useMemo(() => {
    const list = clients || [];
    if (!clientSearch.trim()) return list;
    const q = clientSearch.trim().toLowerCase();
    return list.filter((c) => {
      if (!c) return false;
      const name = String(c.full_name || '').toLowerCase();
      const phone = String(c.phone || '').toLowerCase();
      const email = String(c.email || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || email.includes(q);
    });
  }, [clients, clientSearch]);

  // Helper to ingest an array of File or Blob objects
  const processIncomingFiles = useCallback(async (files: (File | Blob)[], originName?: string) => {
    const newItems: ReceivedFileItem[] = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const rawName = (f as File).name || originName || `whatsapp_file_${Date.now()}_${i}`;
      const rawType = f.type || '';

      const { cat, mime } = await detectCategoryAndMime(f, rawName, rawType);
      const isWA =
        rawName.toLowerCase().includes('whatsapp') ||
        rawName.toLowerCase().includes('ptt') ||
        mime.includes('opus') ||
        mime.includes('ogg');

      let cleanName = rawName;
      if (!cleanName || cleanName === 'blob' || !cleanName.includes('.')) {
        const ext = cat === 'audio' ? 'opus' : cat === 'image' ? 'jpg' : 'bin';
        cleanName = `whatsapp_${cat}_${Date.now()}_${i}.${ext}`;
      }

      const fileObj = new File([f], cleanName, { type: mime });
      const blobUrl = URL.createObjectURL(fileObj);

      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(blobUrl);
        reader.readAsDataURL(f);
      });

      newItems.push({
        id: generateUUID(),
        name: cleanName,
        size: f.size,
        type: cat,
        url: blobUrl,
        file: fileObj,
        dataUrl,
        isWhatsApp: isWA,
      });
    }

    if (newItems.length > 0) {
      setReceivedFiles((prev) => {
        // avoid exact duplicates by size and name
        const existingKeys = new Set(prev.map((it) => `${it.name}_${it.size}`));
        const filtered = newItems.filter((it) => !existingKeys.has(`${it.name}_${it.size}`));
        return [...prev, ...filtered];
      });

      if (newItems.some((it) => it.type === 'audio')) {
        setTargetType('session'); // Auto-select session recording for voice notes
      }
    }
  }, []);

  // Scan sources (Server, Cache Storage, URL) with polling retry
  const scanAllSharedSources = useCallback(async () => {
    const items: ReceivedFileItem[] = [];

    // 1. URL search parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlTitle = urlParams.get('title') || '';
    const urlText = urlParams.get('text') || '';
    const urlShare = urlParams.get('url') || '';

    if (urlTitle) setSharedTitle(urlTitle);
    if (urlText) setSharedText(urlText);
    if (urlShare) setSharedUrl(urlShare);

    // 2. Server Shared Files endpoint
    try {
      const srvRes = await fetch('/api/server-shared-files');
      if (srvRes.ok) {
        const srvData = await srvRes.json();
        if (srvData && Array.isArray(srvData.files) && srvData.files.length > 0) {
          if (srvData.title && !urlTitle) setSharedTitle(srvData.title);
          if (srvData.text && !urlText) setSharedText(srvData.text);
          if (srvData.url && !urlShare) setSharedUrl(srvData.url);

          for (const f of srvData.files) {
            try {
              const res = await fetch(f.dataUrl);
              const blob = await res.blob();
              const { cat, mime } = await detectCategoryAndMime(blob, f.name, f.type);
              const fileObj = new File([blob], f.name || `whatsapp_${cat}_${Date.now()}`, { type: mime });
              const blobUrl = URL.createObjectURL(fileObj);

              items.push({
                id: generateUUID(),
                name: f.name || `whatsapp_${cat}_${Date.now()}`,
                size: f.size || blob.size,
                type: cat,
                url: blobUrl,
                file: fileObj,
                dataUrl: f.dataUrl,
                isWhatsApp: true,
              });
            } catch (err) {
              console.warn('Error reading server shared blob:', err);
            }
          }
        }
      }
    } catch (e) {
      console.warn('Server shared files check error:', e);
    }

    // 3. Service Worker Cache Storage
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
          }

          const countToSearch = Math.max(filesCount, 10);
          for (let i = 0; i < countToSearch; i++) {
            const fileKey = `/pwa-shared-file-${i}`;
            const fileRes = await cache.match(fileKey);
            if (fileRes) {
              const rawName = fileRes.headers.get('x-file-name') || `whatsapp_file_${i}`;
              const name = decodeURIComponent(rawName);
              const rawMime = fileRes.headers.get('x-file-type') || fileRes.headers.get('content-type') || '';
              const blob = await fileRes.blob();

              const { cat, mime } = await detectCategoryAndMime(blob, name, rawMime);
              const fileObj = new File([blob], name, { type: mime });
              const blobUrl = URL.createObjectURL(fileObj);

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
                isWhatsApp: true,
              });
            }
          }
        }
      } catch (err) {
        console.warn('Error reading from pwa-shared-cache:', err);
      }
    }

    return items;
  }, []);

  // Multi-attempt polling on mount
  useEffect(() => {
    let isCancelled = false;

    const runPoll = async () => {
      setIsLoadingShared(true);

      for (let attempt = 0; attempt < 4; attempt++) {
        if (isCancelled) return;
        const found = await scanAllSharedSources();

        if (found.length > 0) {
          if (!isCancelled) {
            setReceivedFiles(found);
            if (found.some((it) => it.type === 'audio')) {
              setTargetType('session');
            }
            setIsLoadingShared(false);
          }
          return;
        }

        // Wait before next attempt (300ms, 700ms, 1200ms)
        const delay = attempt === 0 ? 300 : attempt === 1 ? 700 : 1200;
        await new Promise((r) => setTimeout(r, delay));
      }

      if (!isCancelled) {
        setIsLoadingShared(false);
      }
    };

    runPoll();

    return () => {
      isCancelled = true;
    };
  }, [scanAllSharedSources]);

  // Window Clipboard Paste Listener (Ctrl+V / Command+V anywhere on this view)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items || items.length === 0) return;

      const pastedFiles: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file') {
          const f = item.getAsFile();
          if (f) pastedFiles.push(f);
        } else if (item.kind === 'string' && item.type === 'text/plain') {
          item.getAsString((text) => {
            if (text && !sharedText) {
              setSharedText(text);
            }
          });
        }
      }

      if (pastedFiles.length > 0) {
        await processIncomingFiles(pastedFiles, `pasted_${Date.now()}`);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [sharedText, processIncomingFiles]);

  // Manual refresh button handler
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      const found = await scanAllSharedSources();
      if (found.length > 0) {
        setReceivedFiles(found);
        if (found.some((it) => it.type === 'audio')) {
          setTargetType('session');
        }
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Clipboard Paste Button handler
  const handleClipboardButtonPaste = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        const files: File[] = [];
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/') || type.startsWith('audio/')) {
              const blob = await item.getType(type);
              const ext = type.includes('png') ? 'png' : type.includes('jpeg') ? 'jpg' : 'bin';
              files.push(new File([blob], `clipboard_${Date.now()}.${ext}`, { type }));
            }
          }
        }
        if (files.length > 0) {
          await processIncomingFiles(files);
          return;
        }
      }
      // fallback to text
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) setSharedText(text);
      }
    } catch (err) {
      console.warn('Clipboard read failed or permission denied:', err);
    }
  };

  // Manual File Upload handler
  const handleManualFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processIncomingFiles(Array.from(files));
    e.target.value = '';
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processIncomingFiles(Array.from(files));
    }
  };

  const handleRemoveItem = (id: string) => {
    setReceivedFiles((prev) => prev.filter((it) => it.id !== id));
  };

  // Save received items into Client
  const handleSaveToClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    setIsSaving(true);
    const client = dataStore.getClientById(selectedClientId);
    if (!client) {
      setIsSaving(false);
      return;
    }

    try {
      // 1. Text or Link shared from WhatsApp
      if (sharedText || sharedUrl || sharedTitle) {
        const textToAppend = [
          sharedTitle ? `כותרת שיתוף: ${sharedTitle}` : '',
          sharedText ? sharedText : '',
          sharedUrl ? `קישור: ${sharedUrl}` : '',
          `[התקבל מוואטסאפ ב-${new Date().toLocaleDateString('he-IL')}]`,
        ]
          .filter(Boolean)
          .join('\n');

        const existingNotes = client.notes || '';
        dataStore.updateClient(selectedClientId, {
          notes: existingNotes ? `${existingNotes}\n\n---\n${textToAppend}` : textToAppend,
        });

        dataStore.logActivity(selectedClientId, 'shared_note_added', {
          title: sharedTitle || 'הודעה/טקסט משותף',
        });
      }

      // 2. Save each received file
      for (const item of receivedFiles) {
        const dataToPersist = item.dataUrl || item.url;

        // Add to dataStore (generates unique ID and links to parent)
        const addedMedia = dataStore.addMediaFile({
          name: item.name,
          size: item.size,
          type: item.type,
          category: selectedProgramId ? 'program' : 'client',
          parent_id: selectedProgramId || selectedClientId,
          url: dataToPersist,
        });

        // Ensure IndexedDB holds binary under the exact addedMedia.id
        if (dataToPersist && !dataToPersist.startsWith('http')) {
          await saveMediaBlobToIDB(addedMedia.id, dataToPersist).catch(() => {});
        }

        // If user chose to link to an existing session
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

      // 3. If user opted to create a NEW session from shared audio recording
      if (targetType === 'session' && !selectedSessionId && receivedFiles.some((f) => f.type === 'audio')) {
        const audioItem = receivedFiles.find((f) => f.type === 'audio');
        const audioUrl = audioItem?.dataUrl || audioItem?.url || '';
        dataStore.addSession({
          client_id: selectedClientId,
          program_id: selectedProgramId || undefined,
          session_date: new Date().toISOString(),
          status: 'completed',
          notes: `מפגש שנוצר מהקלטת קול מוואטסאפ (${audioItem?.name || ''})`,
          audio_urls: audioUrl ? [audioUrl] : [],
          image_urls: [],
        });
      }

      // Force immediate cloud sync so second device receives the update right away
      await dataStore.forceImmediateCloudSync().catch(() => {});

      // Clean up server buffer & service worker cache after successful save
      fetch('/api/server-shared-files/clear', { method: 'POST' }).catch(() => {});
      if (typeof caches !== 'undefined') {
        try {
          const cache = await caches.open('pwa-shared-cache');
          await cache.delete('/pwa-shared-meta.json');
          for (let i = 0; i < 20; i++) {
            await cache.delete(`/pwa-shared-file-${i}`);
          }
        } catch {
          // ignore
        }
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
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            onClick={() => onNavigate(`/clients/${savedSuccessClientId}?tab=media`)}
            className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center gap-2"
          >
            <span>צפה במדיה בגלריית הלקוח</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => onNavigate(`/clients/${savedSuccessClientId}`)}
            className="px-4 py-2.5 bg-card hover:bg-muted text-foreground border border-border font-medium text-xs sm:text-sm rounded-xl transition-colors"
          >
            לכרטיס הלקוח הכללי
          </button>
          <button
            onClick={() => onNavigate('/dashboard')}
            className="px-4 py-2.5 bg-card hover:bg-muted text-muted-foreground font-medium text-xs sm:text-sm rounded-xl transition-colors"
          >
            ללוח הבקרה
          </button>
        </div>
      </div>
    );
  }

  const hasFiles = receivedFiles.length > 0;
  const hasText = Boolean(sharedText || sharedTitle || sharedUrl);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`max-w-2xl mx-auto space-y-6 dir-rtl text-right transition-colors rounded-3xl ${
        isDragOver ? 'ring-4 ring-teal-500 bg-teal-500/5' : ''
      }`}
    >
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
                <span>קליטת שיתוף WhatsApp / מכשיר</span>
              </div>
              <h2 className="text-lg font-bold text-foreground">שיוך הקלטה או תמונה ללקוח</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                קליטת הודעה קולית, תמונה או קובץ משיתוף וואטסאפ ישירות לתיק הלקוח
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing || isLoadingShared}
              className="p-2 border border-border rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted text-xs transition-colors flex items-center gap-1"
              title="סרוק שוב קבצים שהתקבלו"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing || isLoadingShared ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-[11px] font-semibold">רענן סריקה</span>
            </button>
            <button
              onClick={() => onNavigate('/dashboard')}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground p-1.5"
            >
              ביטול
            </button>
          </div>
        </div>

        {/* Loading state indicator */}
        {isLoadingShared && (
          <div className="p-4 bg-teal-500/5 border border-teal-500/20 rounded-xl text-center text-xs text-teal-800 dark:text-teal-200 flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>סורק ומזהה קבצים שהתקבלו מוואטסאפ או מהמכשיר...</span>
          </div>
        )}

        {/* Display Received Shared Files Preview */}
        {hasFiles && (
          <div className="space-y-3">
            <div className="text-xs font-bold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span>קבצים שזוהו בהצלחה ({receivedFiles.length}):</span>
                <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/30">
                  מוכנים לשיוך
                </span>
              </span>
            </div>

            <div className="space-y-3">
              {receivedFiles.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="p-4 bg-muted/30 border border-border rounded-xl space-y-3 relative group"
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
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-xs sm:text-sm text-foreground truncate">
                            {fileItem.name}
                          </h4>
                          {fileItem.isWhatsApp && (
                            <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold rounded-md border border-emerald-500/30 flex items-center gap-1">
                              <span>WhatsApp</span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {formatFileSize(fileItem.size)} • {fileItem.type === 'audio' ? 'הקלטת קול' : fileItem.type === 'image' ? 'תמונה' : fileItem.type.toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(fileItem.id)}
                      className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors"
                      title="הסר קובץ זה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Audio Player Preview */}
                  {fileItem.type === 'audio' && (
                    <div className="pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground mb-1.5">
                        <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span>נגן הקלטה קולית מוואטסאפ:</span>
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
        )}

        {/* Display Received Text or Link */}
        {hasText && (
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

        {/* Empty state / Manual Controls */}
        {!hasFiles && !hasText && !isLoadingShared && (
          <div className="p-6 border-2 border-dashed border-border rounded-xl text-center space-y-3 bg-muted/20">
            <div className="w-12 h-12 bg-teal-500/10 text-teal-600 rounded-full flex items-center justify-center mx-auto">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs sm:text-sm font-bold text-foreground">
                לא זוהה קובץ משיתוף פעיל
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                בטלפון: היכנס לוואטסאפ, לחץ על שיתוף (Share) בהקלטה או תמונה, ובחר ב-<strong>Kabbalah CRM</strong>.
              </p>
            </div>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={handleClipboardButtonPaste}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-colors"
              >
                <Clipboard className="w-4 h-4" />
                <span>הדבק מהלוח (Ctrl+V)</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-4 py-2 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-bold cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-teal-600" />
                <span>בחר קובץ מהמכשיר</span>
                <input
                  type="file"
                  multiple
                  accept="*/*,audio/*,image/*,video/*,application/pdf"
                  onChange={handleManualFileInput}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {/* Additional files button if files are already received */}
        {hasFiles && (
          <div className="pt-2 flex items-center justify-end gap-2 text-xs">
            <button
              type="button"
              onClick={handleClipboardButtonPaste}
              className="text-primary hover:underline font-semibold flex items-center gap-1"
            >
              <Clipboard className="w-3.5 h-3.5" />
              <span>הדבק עוד מהלוח</span>
            </button>
            <span className="text-border">|</span>
            <label className="text-teal-600 hover:underline font-semibold cursor-pointer flex items-center gap-1">
              <Upload className="w-3.5 h-3.5" />
              <span>הוסף עוד קובץ</span>
              <input
                type="file"
                multiple
                accept="*/*,audio/*,image/*,video/*,application/pdf"
                onChange={handleManualFileInput}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Form: Select Client & Destination */}
        <form onSubmit={handleSaveToClient} className="space-y-4 pt-2">
          {/* Client Search & Interactive Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-foreground">
                בחר לקוח לקליטת הקובץ *
              </label>
              <button
                type="button"
                onClick={() => setIsQuickAddClientOpen(true)}
                className="text-xs text-teal-600 hover:text-teal-700 font-bold flex items-center gap-1 hover:underline"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ לקוח חדש</span>
              </button>
            </div>

            {selectedClient ? (
              <div className="p-3 bg-teal-500/10 border border-teal-500/30 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-teal-600 text-white font-bold flex items-center justify-center text-xs overflow-hidden shrink-0 shadow-xs">
                    {selectedClient.avatar_url ? (
                      <img
                        src={selectedClient.avatar_url}
                        alt={selectedClient.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      (selectedClient.full_name || 'לק').substring(0, 2)
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                      <h4 className="font-extrabold text-xs sm:text-sm text-foreground truncate">
                        {selectedClient.full_name}
                      </h4>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                      {selectedClient.phone ? `טלפון: ${selectedClient.phone}` : selectedClient.email || 'לקוח נבחר לקליטת השיתוף'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedClientId('');
                    setSelectedProgramId('');
                    setSelectedSessionId('');
                    setClientSearch('');
                  }}
                  className="px-3 py-1.5 bg-card hover:bg-muted text-foreground border border-border rounded-xl text-xs font-semibold shrink-0 transition-colors"
                >
                  החלף לקוח
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="הקלד שם לקוח, טלפון או דוא״ל לחיפוש מהיר..."
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className="w-full pr-9 pl-8 py-2.5 text-xs bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 font-medium shadow-2xs"
                  />
                  {clientSearch && (
                    <button
                      type="button"
                      onClick={() => setClientSearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Instant Search Results / Client List */}
                <div className="space-y-1 max-h-56 overflow-y-auto border border-border rounded-xl p-1.5 bg-card shadow-inner">
                  {filteredClients.length === 0 ? (
                    <div className="p-4 text-center space-y-2.5">
                      <p className="text-xs text-muted-foreground">
                        {clientSearch.trim()
                          ? `לא נמצאו לקוחות התואמים לחיפוש "${clientSearch}"`
                          : clients.length === 0
                          ? 'טוען לקוחות מהענן או שטרם נוספו לקוחות'
                          : 'הקלד בתיבת החיפוש או בחר מטה'}
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsQuickAddClientOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>צור לקוח חדש עבור קובץ זה</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="px-2 py-1 text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                        <span>תוצאות חיפוש לקוחות ({filteredClients.length}):</span>
                        <span className="text-[10px] font-normal">לחץ על לקוח לבחירה</span>
                      </div>
                      {filteredClients.slice(0, 10).map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedClientId(c.id);
                            setSelectedProgramId('');
                            setSelectedSessionId('');
                            setClientSearch('');
                          }}
                          className="w-full p-2.5 hover:bg-teal-500/10 active:bg-teal-500/20 rounded-xl flex items-center justify-between text-right transition-colors border border-transparent hover:border-teal-500/30 group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold flex items-center justify-center text-xs overflow-hidden shrink-0">
                              {c.avatar_url ? (
                                <img
                                  src={c.avatar_url}
                                  alt={c.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                (c.full_name || 'לק').substring(0, 2)
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-xs text-foreground group-hover:text-teal-700 dark:group-hover:text-teal-300 truncate">
                                {c.full_name}
                              </div>
                              <div className="text-[10px] text-muted-foreground truncate">
                                {c.phone ? `${c.phone}` : c.email || 'לקוח במערכת'}
                              </div>
                            </div>
                          </div>
                          <span className="text-[11px] font-bold text-teal-600 bg-teal-500/10 px-2.5 py-1 rounded-lg shrink-0 group-hover:bg-teal-600 group-hover:text-white transition-colors">
                            שייך
                          </span>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            )}
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
                        {idx === 0 ? '⭐ [העדכני ביותר] ' : ''}{new Date(s.session_date).toLocaleDateString('he-IL')} • {s.status}
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
              disabled={!selectedClientId || isSaving || (!hasFiles && !hasText)}
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
          <li>
            <strong>במחשב / WhatsApp Web:</strong> תוכל גם להעתיק את התמונה או ההקלטה וללחוץ כאן על <strong>"הדבק מהלוח (Ctrl+V)"</strong> או לגרור את הקובץ ישירות לחלון!
          </li>
        </ol>
      </div>

      {/* Quick Add Client Modal */}
      <ClientModal
        isOpen={isQuickAddClientOpen}
        onClose={() => setIsQuickAddClientOpen(false)}
        onSave={(clientData) => {
          const newClient = dataStore.addClient({
            ...clientData,
            status: clientData.status || 'active',
            full_name: clientData.full_name || 'לקוח חדש',
          });
          setSelectedClientId(newClient.id);
          setIsQuickAddClientOpen(false);
        }}
      />
    </div>
  );
};
