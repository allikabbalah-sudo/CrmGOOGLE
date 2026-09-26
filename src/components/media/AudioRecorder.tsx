import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, CheckCircle2, AlertCircle } from 'lucide-react';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  onCancel?: () => void;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({ onRecordingComplete, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);
  const audioElemRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const startRecording = async () => {
    setErrorMsg(null);
    audioChunksRef.current = [];

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMsg('הדפדפן שלך אינו תומך בהקלטת קול (דרוש חיבור מאובטח HTTPS).');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      }

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);

        // Stop all audio tracks to release microphone icon
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(250);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('נחסמה הגישה למיקרופון. אנא אפשר גישה למיקרופון בהגדרות הדפדפן.');
      } else {
        setErrorMsg('שגיאה בגישה למיקרופון. ודא שהמיקרופון מחובר ותקין.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const togglePlayback = () => {
    if (!audioElemRef.current || !audioUrl) return;
    if (isPlaying) {
      audioElemRef.current.pause();
      setIsPlaying(false);
    } else {
      audioElemRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleConfirmSave = () => {
    if (!audioBlob) return;
    const timestamp = new Date().getTime();
    const ext = audioBlob.type.includes('mp4') ? 'm4a' : audioBlob.type.includes('ogg') ? 'ogg' : 'webm';
    const file = new File([audioBlob], `recording_${timestamp}.${ext}`, { type: audioBlob.type });
    onRecordingComplete(file);
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-4 bg-muted/40 border border-border rounded-xl space-y-4 text-right">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${isRecording ? 'bg-rose-500/10 text-rose-600 animate-pulse' : 'bg-primary/10 text-primary'}`}>
            <Mic className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-semibold text-sm">הקלטת קובץ שמע לטיפול</h4>
            <p className="text-xs text-muted-foreground">הקלטת שיחה או סיכום קבלי בזמן אמת</p>
          </div>
        </div>
        {recordingTime > 0 && (
          <span className="font-mono text-sm font-bold px-2.5 py-1 bg-background border border-border rounded-full text-foreground">
            {formatTimer(recordingTime)}
          </span>
        )}
      </div>

      {errorMsg && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-300 text-xs rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Recording Controls */}
      {!audioBlob ? (
        <div className="flex items-center justify-center py-2">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-95"
            >
              <Mic className="w-4 h-4" />
              התחל הקלטה
            </button>
          ) : (
            <button
              type="button"
              onClick={stopRecording}
              className="flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-medium text-sm rounded-xl transition-all shadow-md active:scale-95 animate-pulse"
            >
              <Square className="w-4 h-4 fill-current" />
              עצור הקלטה
            </button>
          )}
        </div>
      ) : (
        /* Preview & Save Controls */
        <div className="space-y-3 pt-2 border-t border-border/60">
          <audio
            ref={audioElemRef}
            src={audioUrl || ''}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="p-2.5 bg-primary text-primary-foreground rounded-full shadow hover:opacity-90 transition-all"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current mr-0.5" />}
            </button>
            <div className="flex-1 text-xs text-muted-foreground">
              ההקלטה מוכנה לשמירה ({formatTimer(recordingTime)})
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setAudioBlob(null);
                setAudioUrl(null);
                setRecordingTime(0);
                if (onCancel) onCancel();
              }}
              className="px-3 py-1.5 border border-border text-xs font-medium text-muted-foreground rounded-lg hover:bg-muted"
            >
              <Trash2 className="w-3.5 h-3.5 inline ml-1" />
              בטל/מחק
            </button>

            <button
              type="button"
              onClick={handleConfirmSave}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              שמור הקלטה
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
