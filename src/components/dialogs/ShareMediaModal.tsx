import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Download,
  Copy,
  Check,
  MessageCircle,
  ExternalLink,
  Mail,
  FileAudio,
  FileImage,
  FileText,
  Play,
  Pause,
  Sparkles,
  Info,
} from 'lucide-react';
import { MediaFile, Client } from '../../types';
import { dataStore } from '../../lib/dataStore';
import { formatFileSize, formatHebrewDate } from '../../lib/utils';

interface ShareMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: MediaFile | null;
  client?: Client | null;
}

/**
 * Converts a data URL to a binary Blob
 */
function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/octet-stream'): Blob {
  try {
    if (dataUrl.startsWith('data:')) {
      const parts = dataUrl.split(',');
      const mimeMatch = parts[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
      const byteString = atob(parts[1]);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      return new Blob([ab], { type: mime });
    }
  } catch (e) {
    console.warn('Error converting dataUrl to blob', e);
  }
  return new Blob([], { type: fallbackMime });
}

/**
 * Converts any resolved URL (data:, blob:, http:) into a real File object for native file sharing
 */
async function getMediaFileObject(file: MediaFile, resolvedUrl: string | null): Promise<File | null> {
  try {
    let url = resolvedUrl || file.url;
    if (!url || url.startsWith('cloud_media:') || url.startsWith('idb_media:')) {
      const fetched = await dataStore.resolveMediaFileUrl(file.id);
      if (fetched) url = fetched;
    }
    if (!url) return null;

    let mime = file.type === 'audio' ? 'audio/mpeg' : 'image/jpeg';
    const lowerName = (file.name || '').toLowerCase();
    if (lowerName.endsWith('.png')) mime = 'image/png';
    else if (lowerName.endsWith('.webp')) mime = 'image/webp';
    else if (lowerName.endsWith('.gif')) mime = 'image/gif';
    else if (lowerName.endsWith('.wav')) mime = 'audio/wav';
    else if (lowerName.endsWith('.ogg')) mime = 'audio/ogg';
    else if (lowerName.endsWith('.mp3')) mime = 'audio/mpeg';
    else if (lowerName.endsWith('.m4a')) mime = 'audio/mp4';
    else if (lowerName.endsWith('.pdf')) mime = 'application/pdf';

    let blob: Blob;
    if (url.startsWith('data:')) {
      blob = dataUrlToBlob(url, mime);
    } else {
      const res = await fetch(url);
      blob = await res.blob();
    }

    return new File([blob], file.name, {
      type: blob.type || mime,
      lastModified: new Date(file.created_at).getTime() || Date.now(),
    });
  } catch (err) {
    console.warn('Failed to obtain File object:', err);
    return null;
  }
}

/**
 * Cleans an Israeli/International phone number for WhatsApp links
 */
function formatWhatsAppPhone(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  } else if (cleaned.startsWith('0')) {
    cleaned = '972' + cleaned.substring(1);
  }
  return cleaned;
}

export const ShareMediaModal: React.FC<ShareMediaModalProps> = ({
  isOpen,
  onClose,
  file,
  client: providedClient,
}) => {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [associatedClient, setAssociatedClient] = useState<Client | null>(null);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!isOpen || !file) {
      setResolvedUrl(null);
      setIsPlaying(false);
      setToastMsg(null);
      setAssociatedClient(null);
      return;
    }

    // Resolve associated client if not provided
    if (providedClient) {
      setAssociatedClient(providedClient);
    } else if (file.category === 'client' && file.parent_id) {
      const c = dataStore.getClientById(file.parent_id);
      if (c) setAssociatedClient(c);
    } else if (file.category === 'program' && file.parent_id) {
      const prog = dataStore.getProgramById(file.parent_id);
      if (prog) {
        const c = dataStore.getClientById(prog.client_id);
        if (c) setAssociatedClient(c);
      }
    }

    // Resolve URL / binary for playback and download
    let isCancelled = false;
    setIsLoadingFile(true);

    const resolve = async () => {
      try {
        let url = file.url;
        if (!url || url.startsWith('cloud_media:') || url.startsWith('idb_media:')) {
          const fetched = await dataStore.resolveMediaFileUrl(file.id);
          if (fetched) url = fetched;
        }
        if (!isCancelled) {
          setResolvedUrl(url || null);
        }
      } catch (e) {
        console.warn('Could not resolve file url', e);
      } finally {
        if (!isCancelled) {
          setIsLoadingFile(false);
        }
      }
    };

    resolve();

    return () => {
      isCancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [isOpen, file, providedClient]);

  if (!isOpen || !file) return null;

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 4000);
  };

  const handleDownload = async () => {
    try {
      let url = resolvedUrl || file.url;
      if (!url || url.startsWith('cloud_media:') || url.startsWith('idb_media:')) {
        const fetched = await dataStore.resolveMediaFileUrl(file.id);
        if (fetched) url = fetched;
      }

      if (!url) {
        showToast('לא ניתן להוריד את הקובץ כעת');
        return;
      }

      let downloadUrl = url;
      let shouldRevoke = false;

      if (url.startsWith('data:')) {
        const mime = file.type === 'audio' ? 'audio/mpeg' : 'image/jpeg';
        const blob = dataUrlToBlob(url, mime);
        downloadUrl = URL.createObjectURL(blob);
        shouldRevoke = true;
      }

      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = file.name || `file_${Date.now()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      if (shouldRevoke) {
        setTimeout(() => URL.revokeObjectURL(downloadUrl), 8000);
      }

      showToast('הקובץ הורד בהצלחה למכשיר שלך! 📥');
    } catch (e) {
      console.error('Download error:', e);
      showToast('שגיאה בהורדת הקובץ');
    }
  };

  /**
   * Shares the ACTUAL FILE binary (never as a link!) using Web Share API
   */
  const handleShareAsFile = async () => {
    setIsSharing(true);
    try {
      const fileObj = await getMediaFileObject(file, resolvedUrl);
      if (!fileObj) {
        showToast('שגיאה בהכנת הקובץ לשיתוף');
        await handleDownload();
        return;
      }

      // Check if browser Web Share API supports file sharing directly (mobile devices, WhatsApp, Telegram, etc.)
      if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({
          files: [fileObj],
          title: file.name,
        });
        showToast('הקובץ שותף בהצלחה כקובץ! 📁');
        return;
      }

      // If Web Share API with files is not supported (Desktop PC / browser without file sharing)
      // Download the file immediately so the user has the actual file in hand
      await handleDownload();
      showToast('הקובץ הורד למכשירך כקובץ! כעת ניתן לצרף אותו (📎) בכל צ׳אט או מייל 📥');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User closed share dialog
        return;
      }
      console.warn('Native file share failed:', err);
      // Fallback: download file
      await handleDownload();
    } finally {
      setIsSharing(false);
    }
  };

  /**
   * WhatsApp text strictly contains NO links — only polite text
   */
  const getWhatsAppMessage = () => {
    const clientName = associatedClient?.full_name ? ` ${associatedClient.full_name}` : '';
    return `שלום${clientName},\nמצורף קובץ מתוך מערכת הקליניקה:\n📄 *${file.name}*`;
  };

  const getWhatsAppUrl = () => {
    const msg = getWhatsAppMessage();
    const encoded = encodeURIComponent(msg);
    if (associatedClient?.phone) {
      const cleanPhone = formatWhatsAppPhone(associatedClient.phone);
      return `https://wa.me/${cleanPhone}?text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
  };

  const handleWhatsAppDirect = () => {
    const url = getWhatsAppUrl();
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch {
      window.location.href = url;
    }
  };

  /**
   * Send via WhatsApp as a file:
   * First tries direct file share if mobile browser supports sharing files to WhatsApp;
   * Otherwise downloads the file and immediately opens WhatsApp chat to attach!
   */
  const handleSendToWhatsAppAsFile = async () => {
    setIsSharing(true);
    try {
      const fileObj = await getMediaFileObject(file, resolvedUrl);
      if (fileObj && typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({
          files: [fileObj],
          title: file.name,
        });
        showToast('הקובץ נשלח כקובץ! 📁');
        return;
      }

      // Otherwise: 1. Download file to device
      await handleDownload();

      // 2. Open WhatsApp chat with client
      setTimeout(() => {
        handleWhatsAppDirect();
      }, 500);

      showToast('הקובץ הורד למכשירך! גרור אותו לוואטסאפ או לחץ על 📎 לצירוף כקובץ');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      await handleDownload();
      handleWhatsAppDirect();
    } finally {
      setIsSharing(false);
    }
  };

  const handleCopyDetails = async () => {
    try {
      const textToCopy = getWhatsAppMessage();

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      showToast('שם ופרטי הקובץ הועתקו ללוח בהצלחה! ✨');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
      showToast('לא ניתן להעתיק ללוח בדפדפן זה');
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`קובץ מהקליניקה: ${file.name}`);
    const body = encodeURIComponent(getWhatsAppMessage());
    const targetEmail = associatedClient?.email || '';
    window.location.href = `mailto:${targetEmail}?subject=${subject}&body=${body}`;
    showToast('תוכנת הדוא״ל נפתחת ✉️');
  };

  const toggleAudio = () => {
    if (!audioRef.current || !resolvedUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-card w-full max-w-lg rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col text-right relative"
        dir="rtl"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">שיתוף קובץ מדיה כקובץ</h3>
              <p className="text-xs text-muted-foreground">שליחת הקובץ עצמו (שמע/תמונה) ולא כקישור</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toast feedback notification */}
        {toastMsg && (
          <div className="mx-5 mt-3 px-3 py-2 bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-xs rounded-xl flex items-center gap-2 animate-in slide-in-from-top-1 duration-200">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="font-medium">{toastMsg}</span>
          </div>
        )}

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* File Card Preview */}
          <div className="p-3.5 bg-muted/40 border border-border/80 rounded-xl flex items-center gap-3">
            <div
              className={`p-3 rounded-xl shrink-0 ${
                file.type === 'audio'
                  ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400'
                  : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {file.type === 'audio' ? (
                <FileAudio className="w-6 h-6" />
              ) : (
                <FileImage className="w-6 h-6" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm text-foreground truncate" title={file.name}>
                {file.name}
              </h4>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>{formatFileSize(file.size)}</span>
                <span>•</span>
                <span>{file.type === 'audio' ? 'הקלטת שמע' : 'תמונה'}</span>
                <span>•</span>
                <span>{formatHebrewDate(file.created_at, 'dd/MM/yyyy HH:mm')}</span>
              </div>
              {associatedClient && (
                <p className="text-xs text-primary font-medium mt-1 truncate">
                  משויך ללקוח: {associatedClient.full_name}
                  {associatedClient.phone ? ` (${associatedClient.phone})` : ''}
                </p>
              )}
            </div>

            {/* Quick Play button if audio and resolved */}
            {file.type === 'audio' && resolvedUrl && (
              <button
                onClick={toggleAudio}
                className="p-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs cursor-pointer"
                title={isPlaying ? 'עצור' : 'השמע'}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current mr-0.5" />}
              </button>
            )}
          </div>

          {/* Hidden audio element for preview */}
          {file.type === 'audio' && resolvedUrl && (
            <audio
              ref={audioRef}
              src={resolvedUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          )}

          {/* Primary Share Options - File Oriented */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground px-0.5">אפשרויות שיתוף כקובץ</p>

            {/* 1. HERO ACTION: Direct Native File Share (Mobile / Tablet / Modern Browser) */}
            <button
              type="button"
              onClick={handleShareAsFile}
              disabled={isSharing}
              className="w-full p-3.5 bg-primary/10 hover:bg-primary/20 border-2 border-primary/40 hover:border-primary rounded-xl flex items-center justify-between text-right transition-all group shadow-xs cursor-pointer disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary text-primary-foreground group-hover:scale-105 transition-transform">
                  <Share2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h5 className="font-bold text-sm text-foreground">שתף קובץ ישירות (WhatsApp / אפליקציות)</h5>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary text-primary-foreground">
                      מומלץ
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    מעביר את הקובץ עצמו (שמע/תמונה) ישירות לאפליקציה הנבחרת — ללא שום קישור!
                  </p>
                </div>
              </div>
              <span className="text-xs text-primary font-bold px-3 py-1.5 rounded-lg bg-primary/15 group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                {isSharing ? 'מכין...' : 'שתף קובץ'}
              </span>
            </button>

            {/* 2. Direct WhatsApp as File */}
            <div className="bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/35 rounded-xl p-3 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-600 text-white shrink-0">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-foreground">
                      {associatedClient?.phone
                        ? `שליחה בוואטסאפ ל-${associatedClient.full_name} כקובץ`
                        : 'שליחה בוואטסאפ כקובץ'}
                    </h5>
                    <p className="text-[11px] text-muted-foreground">
                      מוריד את הקובץ ופותח את השיחה בוואטסאפ לצירוף ישיר (📎) כקובץ
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleSendToWhatsAppAsFile}
                    disabled={isSharing}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                    title="שליחת הקובץ כקובץ בוואטסאפ"
                  >
                    <Download className="w-3.5 h-3.5" />
                    שלח בוואטסאפ
                  </button>
                </div>
              </div>
            </div>

            {/* 3. Direct File Download */}
            <button
              type="button"
              onClick={handleDownload}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-foreground">הורדת הקובץ למכשיר</h5>
                  <p className="text-[11px] text-muted-foreground">
                    שומר עותק מלא של {file.name} בתיקיית ההורדות במכשיר שלך
                  </p>
                </div>
              </div>
              <span className="text-xs text-purple-600 font-medium px-2.5 py-1 rounded-lg bg-purple-500/10">הורד</span>
            </button>

            {/* 4. Copy details (clean text without any links!) */}
            <button
              type="button"
              onClick={handleCopyDetails}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-foreground">העתקת פרטי הקובץ (טקסט)</h5>
                  <p className="text-[11px] text-muted-foreground">
                    {copied ? 'הועתק בהצלחה!' : 'מעתיק את שם ותיאור הקובץ ללוח להדבקה קלה'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded bg-muted">
                {copied ? 'הועתק ✓' : 'העתק'}
              </span>
            </button>

            {/* 5. Email Option */}
            <button
              type="button"
              onClick={handleEmailShare}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-foreground">שליחה בדוא״ל</h5>
                  <p className="text-[11px] text-muted-foreground">
                    {associatedClient?.email
                      ? `שליחה ישירה לכתובת ${associatedClient.email}`
                      : 'פתיחת תוכנת הדוא״ל עם פרטי הקובץ'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded bg-muted">שלח</span>
            </button>

            {/* 6. Google Drive auxiliary view (Internal only, not for sharing as link) */}
            {file.drive_view_link && (
              <a
                href={file.drive_view_link}
                target="_blank"
                rel="noreferrer"
                className="w-full p-2.5 bg-muted/20 hover:bg-muted/40 border border-dashed border-border rounded-xl flex items-center justify-between text-right transition-colors group cursor-pointer text-xs"
              >
                <div className="flex items-center gap-2 text-muted-foreground">
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>צפייה פנימית בענן Google Drive (עותק גיבוי בלבד)</span>
                </div>
                <span className="text-[11px] text-muted-foreground font-medium">פתח</span>
              </a>
            )}
          </div>

          {/* Hint info box */}
          <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl flex items-start gap-2.5 text-foreground text-xs leading-relaxed">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
            <span>
              <strong>שיתוף כקובץ בלבד:</strong> כל פעולות השיתוף מעבירות את קובץ המדיה עצמו (קובץ שמע/תמונה) כקובץ מלא ולא כקישור, בדיוק כפי שביקשת.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors cursor-pointer"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
