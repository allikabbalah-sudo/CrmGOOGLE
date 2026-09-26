import React, { useState, useEffect } from 'react';
import { X, FolderSync, Users, BookOpen, FileCode2 } from 'lucide-react';
import { MediaFile, Client, Program } from '../../types';
import { dataStore } from '../../lib/dataStore';

interface TransferMediaModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: MediaFile | null;
  onTransferSuccess?: () => void;
}

export const TransferMediaModal: React.FC<TransferMediaModalProps> = ({
  isOpen,
  onClose,
  file,
  onTransferSuccess,
}) => {
  const [transferType, setTransferType] = useState<'general' | 'client' | 'program'>('client');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [selectedProgramId, setSelectedProgramId] = useState<string>('');

  const [clients, setClients] = useState<Client[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    if (isOpen) {
      const allClients = dataStore.getClients();
      setClients(allClients);

      if (file) {
        if (file.category === 'client' && file.parent_id) {
          setTransferType('client');
          setSelectedClientId(file.parent_id);
        } else if (file.category === 'program' && file.parent_id) {
          setTransferType('program');
          const prog = dataStore.getProgramById(file.parent_id);
          if (prog) {
            setSelectedClientId(prog.client_id);
            setSelectedProgramId(prog.id);
          }
        } else {
          setTransferType('general');
          if (allClients.length > 0) setSelectedClientId(allClients[0].id);
        }
      }
    }
  }, [isOpen, file]);

  useEffect(() => {
    if (selectedClientId) {
      const clientProgs = dataStore.getPrograms(selectedClientId);
      setPrograms(clientProgs);
      if (clientProgs.length > 0 && !clientProgs.some((p) => p.id === selectedProgramId)) {
        setSelectedProgramId(clientProgs[0].id);
      }
    } else {
      setPrograms([]);
    }
  }, [selectedClientId]);

  if (!isOpen || !file) return null;

  const handleSave = () => {
    if (transferType === 'general') {
      dataStore.transferMediaFile(file.id, 'general', 'general');
    } else if (transferType === 'client') {
      if (!selectedClientId) {
        alert('אנא בחר לקוח');
        return;
      }
      dataStore.transferMediaFile(file.id, selectedClientId, 'client');
    } else if (transferType === 'program') {
      if (!selectedProgramId) {
        alert('אנא בחר תוכנית טיפול');
        return;
      }
      dataStore.transferMediaFile(file.id, selectedProgramId, 'program');
    }

    onTransferSuccess?.();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 dir-rtl animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 text-primary rounded-xl">
              <FolderSync className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">העברה ושיוך קובץ מדיה</h3>
              <p className="text-xs text-muted-foreground truncate max-w-[240px]">{file.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transfer Destination Type */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-foreground block">יעד העברה:</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setTransferType('client')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                transferType === 'client'
                  ? 'bg-primary/10 border-primary text-primary shadow-2xs'
                  : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <Users className="w-4 h-4" />
              לקוח ספציפי
            </button>

            <button
              type="button"
              onClick={() => setTransferType('program')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                transferType === 'program'
                  ? 'bg-primary/10 border-primary text-primary shadow-2xs'
                  : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              תוכנית טיפול
            </button>

            <button
              type="button"
              onClick={() => setTransferType('general')}
              className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center gap-1.5 transition-all ${
                transferType === 'general'
                  ? 'bg-primary/10 border-primary text-primary shadow-2xs'
                  : 'bg-muted/40 border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              <FileCode2 className="w-4 h-4" />
              מדיה כללית
            </button>
          </div>
        </div>

        {/* Client Selection */}
        {(transferType === 'client' || transferType === 'program') && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">בחר לקוח:</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full p-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">-- בחר לקוח מהרשימה --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.phone || 'ללא טלפון'})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Program Selection */}
        {transferType === 'program' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-foreground block">בחר תוכנית טיפול:</label>
            {programs.length === 0 ? (
              <p className="text-xs text-amber-600 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                אין תוכניות טיפול פעילות ללקוח זה. תוכל ליצור תוכנית בכרטיס הלקוח.
              </p>
            ) : (
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full p-2.5 bg-background border border-border rounded-xl text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.total_sessions} מפגשים)
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {transferType === 'general' && (
          <p className="text-xs text-muted-foreground bg-muted/40 p-3 rounded-xl border border-border">
            הקובץ יישמר במאגר המדיה הכללית של הקליניקה ללא שיוך ללקוח או תוכנית טיפול ספציפית.
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-border text-xs font-bold rounded-xl hover:bg-muted"
          >
            ביטול
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:bg-primary/90 shadow-sm"
          >
            אישור והעברה
          </button>
        </div>
      </div>
    </div>
  );
};
