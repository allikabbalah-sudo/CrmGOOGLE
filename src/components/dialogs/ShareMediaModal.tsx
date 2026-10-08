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
    }, 3500);
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

  const handleNativeShare = async () => {
    let url = resolvedUrl || file.url;
    if (!url || url.startsWith('cloud_media:') || url.startsWith('idb_media:')) {
      const fetched = await dataStore.resolveMediaFileUrl(file.id);
      if (fetched) url = fetched;
    }

    if (typeof navigator === 'undefined' || !navigator.share) {
      // Fallback: Copy and prompt
      handleCopyDetails();
      showToast('שיתוף ישיר אינו נתמך בדפדפן זה. פרטי הקובץ הועתקו ללוח');
      return;
    }

    try {
      let fileObj: File | null = null;
      if (url && url.startsWith('data:')) {
        const mime = file.type === 'audio' ? 'audio/mpeg' : 'image/jpeg';
        const blob = dataUrlToBlob(url, mime);
        fileObj = new File([blob], file.name, {
          type: blob.type || mime,
        });
      }

      // Try sharing actual file binary first if browser supports it
      if (fileObj && navigator.canShare && navigator.canShare({ files: [fileObj] })) {
        await navigator.share({
          files: [fileObj],
          title: file.name,
          text: `קובץ מדיה מ-Kabbalah CRM: ${file.name}`,
        });
        showToast('הקובץ שותף בהצלחה!');
        return;
      }

      // If Google Drive link exists and is an HTTP URL, share it
      if (file.drive_view_link && file.drive_view_link.startsWith('http')) {
        await navigator.share({
          title: file.name,
          text: `קובץ מדיה מ-Kabbalah CRM: ${file.name}`,
          url: file.drive_view_link,
        });
        showToast('הקישור שותף בהצלחה!');
        return;
      }

      // Otherwise share text description
      await navigator.share({
        title: file.name,
        text: `קובץ מדיה מ-Kabbalah CRM: ${file.name} (${file.type === 'audio' ? 'הקלטת שמע' : 'תמונה'})`,
      });
      showToast('הפרטים שותפו בהצלחה!');
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        // User cancelled share dialogue, do nothing
        return;
      }
      console.warn('Native share failed:', err);
      // Fallback to copy
      handleCopyDetails();
    }
  };

  const getWhatsAppMessage = () => {
    const clientName = associatedClient?.full_name ? ` ${associatedClient.full_name}` : '';
    let msg = `שלום${clientName},\nמצורף קובץ מתוך מערכת Kabbalah CRM:\n📄 *${file.name}*`;

    if (file.drive_view_link) {
      msg += `\n\n🔗 קישור לצפייה ב-Google Drive:\n${file.drive_view_link}`;
    }

    return msg;
  };

  const handleWhatsAppDirect = () => {
    const msg = getWhatsAppMessage();
    const encoded = encodeURIComponent(msg);

    if (associatedClient?.phone) {
      const cleanPhone = formatWhatsAppPhone(associatedClient.phone);
      window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
    } else {
      window.open(`https://api.whatsapp.com/send?text=${encoded}`, '_blank');
    }
    showToast('וואטסאפ נפתח לשיתוף 💬');
  };

  const handleDownloadAndWhatsApp = async () => {
    // 1. Download file
    await handleDownload();

    // 2. Open WhatsApp
    setTimeout(() => {
      handleWhatsAppDirect();
    }, 600);
  };

  const handleCopyDetails = async () => {
    try {
      let textToCopy = '';
      if (file.drive_view_link) {
        textToCopy = file.drive_view_link;
      } else {
        textToCopy = `קובץ: ${file.name} (${formatFileSize(file.size)})\nנוצר: ${formatHebrewDate(file.created_at, 'dd/MM/yyyy HH:mm')}`;
        if (associatedClient) {
          textToCopy += `\nלקוח: ${associatedClient.full_name}`;
        }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(textToCopy);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      showToast('הפרטים הועתקו ללוח בהצלחה! ✨');
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.warn('Clipboard copy failed:', e);
      showToast('לא ניתן להעתיק ללוח בדפדפן זה');
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(`קובץ מ-Kabbalah CRM: ${file.name}`);
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
              <h3 className="text-base font-bold text-foreground">שיתוף קובץ מדיה</h3>
              <p className="text-xs text-muted-foreground">שתף בוואטסאפ, במכשיר, בהורדה או במייל</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
                className="p-2.5 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors shadow-xs"
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

          {/* Primary Share Options */}
          <div className="space-y-2.5">
            <p className="text-xs font-semibold text-muted-foreground px-0.5">אפשרויות שיתוף מהירות</p>

            {/* 1. Direct WhatsApp Option */}
            <div className="bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-emerald-600 text-white">
                    <MessageCircle className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-foreground">
                      {associatedClient?.phone
                        ? `שליחה ישירה ל-${associatedClient.full_name} בוואטסאפ`
                        : 'שיתוף בוואטסאפ (WhatsApp)'}
                    </h5>
                    <p className="text-[11px] text-muted-foreground">
                      {associatedClient?.phone
                        ? `מספר: ${associatedClient.phone}`
                        : 'פותח את וואטסאפ עם כותרת והודעה מוכנה'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleDownloadAndWhatsApp}
                    className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium rounded-lg flex items-center gap-1 shadow-xs transition-colors"
                    title="מוריד את הקובץ ופותח את וואטסאפ לצירוף קל"
                  >
                    <Download className="w-3.5 h-3.5" />
                    הורד ושלח
                  </button>
                  <button
                    onClick={handleWhatsAppDirect}
                    className="px-2.5 py-1.5 bg-card hover:bg-muted text-emerald-700 dark:text-emerald-400 border border-emerald-500/40 text-xs font-medium rounded-lg transition-colors"
                  >
                    פתח הודעה
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Native System Share (Mobile / Desktop) */}
            <button
              onClick={handleNativeShare}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                  <Share2 className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-foreground">שיתוף מהיר במכשיר (תפריט הטלפון/מחשב)</h5>
                  <p className="text-[11px] text-muted-foreground">
                    שיתוף לאפליקציות מותקנות: WhatsApp, Telegram, AirDrop, כונן ועוד
                  </p>
                </div>
              </div>
              <span className="text-xs text-blue-600 font-medium px-2 py-1 rounded bg-blue-500/10">שתף</span>
            </button>

            {/* 3. Direct File Download */}
            <button
              onClick={handleDownload}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                  <Download className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-foreground">הורדת הקובץ למכשיר</h5>
                  <p className="text-[11px] text-muted-foreground">
                    שומר עותק מקומי מלא של {file.name} למחשב או לטלפון
                  </p>
                </div>
              </div>
              <span className="text-xs text-purple-600 font-medium px-2 py-1 rounded bg-purple-500/10">הורד</span>
            </button>

            {/* 4. Google Drive Link if exists */}
            {file.drive_view_link && (
              <a
                href={file.drive_view_link}
                target="_blank"
                rel="noreferrer"
                className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-semibold text-xs text-foreground">פתיחת הקובץ ב-Google Drive</h5>
                    <p className="text-[11px] text-muted-foreground">
                      צפייה ועריכה ישירה בענן Google Drive
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-600 font-medium px-2 py-1 rounded bg-amber-500/10">פתח</span>
              </a>
            )}

            {/* 5. Copy Details / Drive Link */}
            <button
              onClick={handleCopyDetails}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-muted text-muted-foreground group-hover:text-foreground transition-colors">
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </div>
                <div>
                  <h5 className="font-semibold text-xs text-foreground">
                    {file.drive_view_link ? 'העתקת קישור שיתוף של Google Drive' : 'העתקת פרטי הקובץ ללוח'}
                  </h5>
                  <p className="text-[11px] text-muted-foreground">
                    {copied ? 'הועתק בהצלחה!' : 'העתקה מוכנה להדבקה בכל צ׳אט או מייל'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-medium px-2 py-1 rounded bg-muted">
                {copied ? 'הועתק ✓' : 'העתק'}
              </span>
            </button>

            {/* 6. Email Option */}
            <button
              onClick={handleEmailShare}
              className="w-full p-3 bg-card hover:bg-muted/60 border border-border rounded-xl flex items-center justify-between text-right transition-colors group"
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
          </div>

          {/* Hint info box */}
          <div className="p-2.5 bg-muted/30 border border-border/50 rounded-xl flex items-start gap-2 text-muted-foreground text-[11px]">
            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-primary" />
            <span>
              טיפ: כדי לשלוח הקלטה או תמונה בוואטסאפ ללקוח, לחץ על <strong>"הורד ושלח"</strong> – הקובץ יירד מיד ותועבר ישירות לוואטסאפ כדי לצרף אותו בלחיצת פלוס (+).
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 rounded-lg transition-colors"
          >
            סגור
          </button>
        </div>
      </div>
    </div>
  );
};
