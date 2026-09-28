import React, { useState, useMemo } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  FileCode,
  Users,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
} from 'lucide-react';
import { Client } from '../../types';
import { formatClientToCustomExport } from '../../lib/dataStore';

interface ExportClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allClients: Client[];
  filteredClients?: Client[];
  isFiltered?: boolean;
}

export const ExportClientsModal: React.FC<ExportClientsModalProps> = ({
  isOpen,
  onClose,
  allClients,
  filteredClients,
  isFiltered = false,
}) => {
  const [exportScope, setExportScope] = useState<'all' | 'filtered'>(
    isFiltered && filteredClients && filteredClients.length !== allClients.length
      ? 'filtered'
      : 'all'
  );
  const [showPreview, setShowPreview] = useState(true);
  const [copied, setCopied] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Clients selected for export
  const selectedClients = useMemo(() => {
    if (exportScope === 'filtered' && filteredClients) {
      return filteredClients;
    }
    return allClients;
  }, [exportScope, allClients, filteredClients]);

  // Formatted JSON data in exact requested schema:
  // [
  //   {
  //     firstName: "",
  //     lastName: "",
  //     status: "lead",
  //     userId: "",
  //     ... all other client fields
  //   }
  // ]
  const exportedData = useMemo(() => {
    return selectedClients.map((client) => formatClientToCustomExport(client));
  }, [selectedClients]);

  const jsonString = useMemo(() => {
    return JSON.stringify(exportedData, null, 2);
  }, [exportedData]);

  // Sample preview for first 2 clients
  const previewJsonString = useMemo(() => {
    const sample = exportedData.slice(0, 2);
    return JSON.stringify(sample, null, 2);
  }, [exportedData]);

  if (!isOpen) return null;

  const handleCopyClipboard = async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = jsonString;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleDownloadFile = () => {
    try {
      const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toISOString().split('T')[0];
      const link = document.createElement('a');
      link.href = url;
      link.download = `clients_export_${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3000);
    } catch (err) {
      console.error('Failed to trigger download', err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-foreground dir-rtl font-heebo"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 flex items-center justify-center border border-teal-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <span>ייצוא נתוני לקוחות</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 font-bold border border-teal-500/30">
                  JSON מובנה
                </span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                ייצוא לקוחות במבנה הכולל firstName, lastName, status, userId וכל פרטי הלקוח
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Format Spec Banner */}
          <div className="p-3 bg-muted/40 rounded-xl border border-border/70 text-xs space-y-1.5">
            <div className="font-bold text-primary flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>מבנה הנתונים המיוצא:</span>
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              הייצוא מחזיר מערך של אובייקטים כאשר השדות הראשונים הינם{' '}
              <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono font-bold">
                firstName
              </code>
              ,{' '}
              <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono font-bold">
                lastName
              </code>
              ,{' '}
              <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono font-bold">
                status
              </code>
              ,{' '}
              <code className="bg-background px-1 py-0.5 rounded text-foreground font-mono font-bold">
                userId
              </code>
              , ובנוסף כל שאר הפרטים המלאים של הלקוח (טלפון, דוא"ל, שם האם, תאריך לידה, קריאה נבחרת, הערות ועוד).
            </p>
          </div>

          {/* Scope Selection if filter active */}
          {filteredClients && filteredClients.length !== allClients.length && (
            <div className="bg-card border border-border rounded-xl p-3 space-y-2">
              <label className="text-xs font-bold text-foreground block">
                בחר איזה לקוחות לייצא:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setExportScope('all')}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                    exportScope === 'all'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>כל הלקוחות בקליניקה</span>
                  </span>
                  <span className="font-bold px-1.5 py-0.5 rounded-md bg-background text-[11px]">
                    {allClients.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setExportScope('filtered')}
                  className={`p-2.5 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                    exportScope === 'filtered'
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted/30 border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    <span>רק לקוחות מסוננים כרגע</span>
                  </span>
                  <span className="font-bold px-1.5 py-0.5 rounded-md bg-background text-[11px]">
                    {filteredClients.length}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Summary Stats */}
          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">
              סה"כ רשומות לייצוא:{' '}
              <strong className="text-foreground">{selectedClients.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => setShowPreview(!showPreview)}
              className="text-primary hover:underline flex items-center gap-1 font-semibold text-[11px]"
            >
              {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPreview ? 'הסתר תצוגה מקדימה' : 'הצג תצוגה מקדימה'}</span>
            </button>
          </div>

          {/* JSON Preview Block */}
          {showPreview && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <FileCode className="w-3.5 h-3.5 text-teal-600" />
                  <span>תצוגה מקדימה (דוגמה ל-2 לקוחות ראשונים מתוך {selectedClients.length}):</span>
                </span>
                <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">application/json</span>
              </div>
              <div className="relative rounded-xl border border-border bg-slate-900 text-slate-100 p-3 max-h-56 overflow-auto font-mono text-[11px] leading-relaxed dir-ltr">
                <pre>{previewJsonString}</pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-border bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 border border-border hover:bg-muted text-muted-foreground hover:text-foreground text-xs font-bold rounded-xl transition-colors order-3 sm:order-1"
          >
            סגור
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto order-1 sm:order-2">
            {/* Copy to Clipboard */}
            <button
              type="button"
              onClick={handleCopyClipboard}
              className="flex-1 sm:flex-initial px-3.5 py-2 border border-border bg-card hover:bg-muted text-foreground text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 shadow-xs"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="text-emerald-600">הועתק ללוח!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                  <span>העתק JSON ללוח</span>
                </>
              )}
            </button>

            {/* Download JSON File */}
            <button
              type="button"
              onClick={handleDownloadFile}
              className="flex-1 sm:flex-initial px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              {downloadSuccess ? (
                <>
                  <Check className="w-4 h-4 text-white" />
                  <span>הקובץ הורד בהצלחה!</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>הורד קובץ JSON ({selectedClients.length})</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
