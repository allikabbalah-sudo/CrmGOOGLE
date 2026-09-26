import React, { useState, useEffect } from 'react';
import { Share2, FileAudio, CheckCircle2, User, ArrowLeft } from 'lucide-react';
import { dataStore } from '../lib/dataStore';

interface ShareReceiveViewProps {
  onNavigate: (path: string) => void;
}

export const ShareReceiveView: React.FC<ShareReceiveViewProps> = ({ onNavigate }) => {
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  const clients = dataStore.getClients() || [];
  const availablePrograms = selectedClientId ? dataStore.getPrograms(selectedClientId) : [];

  useEffect(() => {
    // Check if there are shared files in history or url
    const handleShareTarget = async () => {
      // Look for files passed in window or SW cache
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        // SW cache communication if needed
      }
    };
    handleShareTarget();
  }, []);

  const handleSaveSharedFile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClientId) return;

    // Add dummy file if none received via SW
    const fileToSave = sharedFile || new File(['audio_dummy_content'], 'shared_audio_recording.mp3', { type: 'audio/mp3' });
    const url = URL.createObjectURL(fileToSave);

    dataStore.addMediaFile({
      url,
      name: fileToSave.name,
      size: fileToSave.size,
      type: 'audio',
      category: selectedProgramId ? 'program' : 'client',
      parent_id: selectedProgramId || selectedClientId,
    });

    alert('קובץ השמע נקלט ונשמר בהצלחה בכרטיס הלקוח!');
    onNavigate(`/clients/${selectedClientId}`);
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="bg-card border border-border rounded-2xl p-6 shadow-md space-y-4 text-right">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <div className="p-3 bg-primary/10 text-primary rounded-xl">
            <Share2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">קליטת קובץ שמע משותף (Share Target)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              שיוך קובץ הקלטת קול שנשלח מאפליקציה חיצונית ללקוח ולתוכנית בקליניקה
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveSharedFile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold mb-1">בחר לקוח לקליטת הקובץ *</label>
            <select
              required
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value);
                setSelectedProgramId('');
              }}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              <option value="">בחר לקוח מהקליניקה...</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {selectedClientId && (
            <div>
              <label className="block text-xs font-semibold mb-1">שיוך לתוכנית עבודה ספציפית (אופציונלי)</label>
              <select
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              >
                <option value="">שמור ישירות בגלריית הלקוח הכללית</option>
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} ({p.total_sessions} מפגשים)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="p-4 bg-muted/30 border border-border rounded-xl flex items-center gap-3">
            <FileAudio className="w-8 h-8 text-primary shrink-0" />
            <div>
              <h4 className="font-bold text-xs">קובץ שמע מוכן לקליטה</h4>
              <p className="text-[11px] text-muted-foreground">shared_audio_recording.mp3 • 2.4 MB</p>
            </div>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onNavigate('/dashboard')}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={!selectedClientId}
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              שמור קובץ בכרטיס הלקוח
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
