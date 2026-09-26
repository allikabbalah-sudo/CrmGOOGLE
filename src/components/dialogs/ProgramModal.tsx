import React, { useState, useEffect, useMemo } from 'react';
import { X, Calendar, Clock, Plus, Trash2, Layers, Check, Info, Sparkles } from 'lucide-react';
import { Program } from '../../types';
import { HEBREW_DAYS, formatHebrewDate } from '../../lib/utils';
import { useOrganization } from '../../context/OrganizationContext';
import { generateSessions } from '../../lib/sessionGenerator';

interface ProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (programData: any) => void;
  clientId: string;
  programToEdit?: Program | null;
}

const DAYS_CONFIG = [
  { index: 0, fullName: 'יום ראשון', short: 'א\'', label: 'ראשון' },
  { index: 1, fullName: 'יום שני', short: 'ב\'', label: 'שני' },
  { index: 2, fullName: 'יום שלישי', short: 'ג\'', label: 'שלישי' },
  { index: 3, fullName: 'יום רביעי', short: 'ד\'', label: 'רביעי' },
  { index: 4, fullName: 'יום חמישי', short: 'ה\'', label: 'חמישי' },
  { index: 5, fullName: 'יום שישי', short: 'ו\'', label: 'שישי' },
  { index: 6, fullName: 'יום שבת', short: 'ש\'', label: 'שבת' },
];

export const ProgramModal: React.FC<ProgramModalProps> = ({
  isOpen,
  onClose,
  onSave,
  clientId,
  programToEdit,
}) => {
  const { members } = useOrganization();

  const [title, setTitle] = useState('');
  const [totalSessions, setTotalSessions] = useState(10);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [weeklyDays, setWeeklyDays] = useState<number[]>([0, 3]); // Default Sun & Wed
  const [timeMode, setTimeMode] = useState<'uniform' | 'per_day'>('uniform');
  const [globalTimes, setGlobalTimes] = useState<string[]>(['10:00']);
  const [dayTimesMap, setDayTimesMap] = useState<Record<number, string[]>>({
    0: ['10:00'],
    3: ['16:00'],
  });
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (programToEdit) {
      setTitle(programToEdit.title || '');
      setTotalSessions(programToEdit.total_sessions || 10);
      setStartDate(programToEdit.start_date || new Date().toISOString().split('T')[0]);
      setWeeklyDays(programToEdit.weekly_days || [0, 3]);
      setAssignedTo(programToEdit.assigned_to || '');

      if (programToEdit.day_times && Object.keys(programToEdit.day_times).length > 0) {
        setTimeMode('per_day');
        setDayTimesMap(programToEdit.day_times);
        setGlobalTimes(programToEdit.session_times || ['10:00']);
      } else {
        setTimeMode('uniform');
        setGlobalTimes(
          programToEdit.session_times && programToEdit.session_times.length > 0
            ? programToEdit.session_times
            : [programToEdit.session_time || '10:00']
        );
      }
    } else {
      setTitle('תוכנית איזון ספירות ותיקון');
      setTotalSessions(10);
      setStartDate(new Date().toISOString().split('T')[0]);
      setWeeklyDays([0, 3]);
      setTimeMode('uniform');
      setGlobalTimes(['10:00']);
      setDayTimesMap({ 0: ['10:00'], 3: ['16:00'] });
      setAssignedTo(members[0]?.user_id || '');
    }
  }, [programToEdit, isOpen, members]);

  // Live calculated sessions preview
  const previewSessions = useMemo(() => {
    if (weeklyDays.length === 0 || totalSessions <= 0 || !startDate) return [];

    const effectiveDayTimes: Record<number, string[]> = {};
    if (timeMode === 'per_day') {
      weeklyDays.forEach((d) => {
        effectiveDayTimes[d] =
          dayTimesMap[d] && dayTimesMap[d].length > 0 ? dayTimesMap[d] : ['10:00'];
      });
    }

    return generateSessions({
      organization_id: 'preview',
      program_id: 'preview',
      client_id: clientId || 'preview',
      start_date: startDate,
      weekly_days: weeklyDays,
      total_sessions: Math.min(totalSessions, 100),
      session_times: timeMode === 'uniform' ? globalTimes : undefined,
      day_times: timeMode === 'per_day' ? effectiveDayTimes : undefined,
    });
  }, [weeklyDays, totalSessions, startDate, timeMode, globalTimes, dayTimesMap, clientId]);

  if (!isOpen) return null;

  const toggleDay = (dayIndex: number) => {
    if (weeklyDays.includes(dayIndex)) {
      setWeeklyDays(weeklyDays.filter((d) => d !== dayIndex).sort());
    } else {
      const updatedDays = [...weeklyDays, dayIndex].sort();
      setWeeklyDays(updatedDays);
      // Ensure dayTimesMap has a default time if missing
      if (!dayTimesMap[dayIndex] || dayTimesMap[dayIndex].length === 0) {
        setDayTimesMap((prev) => ({
          ...prev,
          [dayIndex]: [globalTimes[0] || '10:00'],
        }));
      }
    }
  };

  const handleDayTimeChange = (dayIndex: number, timeVal: string) => {
    setDayTimesMap((prev) => ({
      ...prev,
      [dayIndex]: [timeVal],
    }));
  };

  const handleAddGlobalTime = () => {
    setGlobalTimes([...globalTimes, '18:00']);
  };

  const handleRemoveGlobalTime = (index: number) => {
    if (globalTimes.length > 1) {
      setGlobalTimes(globalTimes.filter((_, i) => i !== index));
    }
  };

  const handleGlobalTimeChange = (index: number, val: string) => {
    const updated = [...globalTimes];
    updated[index] = val;
    setGlobalTimes(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || weeklyDays.length === 0 || totalSessions <= 0) return;

    const effectiveDayTimes: Record<number, string[]> = {};
    if (timeMode === 'per_day') {
      weeklyDays.forEach((d) => {
        effectiveDayTimes[d] =
          dayTimesMap[d] && dayTimesMap[d].length > 0 ? dayTimesMap[d] : ['10:00'];
      });
    }

    onSave({
      client_id: clientId,
      title: title.trim(),
      total_sessions: totalSessions,
      weekly_days: weeklyDays,
      start_date: startDate,
      status: 'active',
      sessions_per_day: timeMode === 'uniform' ? globalTimes.length : 1,
      session_times: timeMode === 'uniform' ? globalTimes : [],
      day_times: timeMode === 'per_day' ? effectiveDayTimes : undefined,
      assigned_to: assignedTo || undefined,
    });

    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10 shrink-0">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary" />
            {programToEdit ? 'עריכת תוכנית טיפול' : 'הגדרת תוכנית טיפולים חדשה'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5 text-right overflow-y-auto flex-1">
          {/* Program Title */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              שם / כותרת התוכנית *
            </label>
            <input
              type="text"
              required
              placeholder="תהליך איזון ספירות ותיקון נשמה"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            />
          </div>

          {/* Session Count & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-foreground">סה"כ מפגשים בסדרה *</label>
                <span className="text-[11px] text-muted-foreground font-bold">
                  {totalSessions} מפגשים
                </span>
              </div>
              <input
                type="number"
                min={1}
                max={100}
                required
                value={totalSessions}
                onChange={(e) => setTotalSessions(parseInt(e.target.value, 10) || 1)}
                className="w-full px-3.5 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-bold text-base"
              />
              {/* Preset buttons */}
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] text-muted-foreground ml-1">מהיר:</span>
                {[5, 10, 12, 15, 20].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setTotalSessions(num)}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border transition-colors ${
                      totalSessions === num
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted/40 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1.5 text-foreground">
                תאריך תחילת הסדרה *
              </label>
              <input
                type="date"
                required
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
              />
              {startDate && (
                <p className="text-[11px] text-primary font-semibold mt-1.5 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  מתחיל ב{formatHebrewDate(startDate, 'EEEE, d/MM/yyyy')}
                </p>
              )}
            </div>
          </div>

          {/* Days of Week Selection */}
          <div className="bg-muted/20 border border-border/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-primary" />
                בחירת ימי הטיפול בשבוע (שליטה מלאה) *
              </label>
              <span className="text-[11px] text-primary font-bold">
                {weeklyDays.length > 0 ? `נבחרו ${weeklyDays.length} ימים` : 'לא נבחרו ימים'}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              סימון הימים בשבוע שבהם המטופל יגיע לקליניקה. המערכת תפיק אוטומטית את לוח המפגשים לפי
              הימים שנבחרו.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {DAYS_CONFIG.map((day) => {
                const isSelected = weeklyDays.includes(day.index);
                return (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() => toggleDay(day.index)}
                    className={`p-2.5 rounded-xl border transition-all text-right relative flex flex-col justify-between h-16 ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-xs ring-1 ring-primary/30'
                        : 'bg-card hover:bg-muted/50 border-border text-muted-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        יום {day.short}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <span className="text-xs font-bold text-foreground mt-1">{day.fullName}</span>
                  </button>
                );
              })}
            </div>

            {weeklyDays.length === 0 && (
              <p className="text-[11px] text-rose-500 font-bold flex items-center gap-1">
                <Info className="w-3.5 h-3.5" />
                יש לבחור לפחות יום אחד בשבוע להגדרת התוכנית.
              </p>
            )}
          </div>

          {/* Session Times Control */}
          <div className="bg-muted/20 border border-border/80 rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                הגדרת שעות המפגש
              </label>

              {/* Mode Toggle */}
              <div className="flex items-center bg-card border border-border rounded-xl p-0.5 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setTimeMode('uniform')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    timeMode === 'uniform'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  שעה קבועה לכל הימים
                </button>
                <button
                  type="button"
                  onClick={() => setTimeMode('per_day')}
                  className={`px-2.5 py-1 rounded-lg transition-colors ${
                    timeMode === 'per_day'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  שעה מותאמת לכל יום
                </button>
              </div>
            </div>

            {timeMode === 'uniform' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">
                    שעות המפגש הקבועות (ניתן להוסיף מספר שעות ליום):
                  </span>
                  <button
                    type="button"
                    onClick={handleAddGlobalTime}
                    className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    הוסף שעה נוספת
                  </button>
                </div>
                {globalTimes.map((timeVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Clock className="w-4 h-4 absolute right-3 top-2.5 text-muted-foreground" />
                      <input
                        type="time"
                        required
                        value={timeVal}
                        onChange={(e) => handleGlobalTimeChange(idx, e.target.value)}
                        className="w-full pr-9 pl-3 py-2 text-xs bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
                      />
                    </div>
                    {globalTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGlobalTime(idx)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-xl"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <span className="text-[11px] text-muted-foreground block">
                  הגדר שעה נפרדת עבור כל יום שנבחר:
                </span>
                {weeklyDays.length === 0 ? (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    אנא בחר ימים למעלה כדי להגדיר להם שעות מפגש.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {weeklyDays.map((dIdx) => {
                      const dayConf = DAYS_CONFIG.find((d) => d.index === dIdx);
                      const timeVal = dayTimesMap[dIdx]?.[0] || '10:00';
                      return (
                        <div
                          key={dIdx}
                          className="flex items-center justify-between p-2.5 bg-card border border-border rounded-xl gap-2"
                        >
                          <span className="text-xs font-bold text-foreground">
                            {dayConf?.fullName}:
                          </span>
                          <div className="relative w-32">
                            <Clock className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground" />
                            <input
                              type="time"
                              required
                              value={timeVal}
                              onChange={(e) => handleDayTimeChange(dIdx, e.target.value)}
                              className="w-full pr-8 pl-2 py-1.5 text-xs bg-muted/40 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Assigned Therapist */}
          <div>
            <label className="block text-xs font-bold mb-1.5 text-foreground">
              מטפל אחראי לתוכנית
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary font-medium"
            >
              <option value="">ללא שיוך מיוחד (משויך לקליניקה)</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_name || m.user_email}
                </option>
              ))}
            </select>
          </div>

          {/* Live Sessions Generated Preview */}
          {previewSessions.length > 0 && (
            <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  תצוגה מקדימה של סדרת המפגשים שתיווצר
                </span>
                <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400">
                  סה"כ {previewSessions.length} מפגשים מתוזמנים
                </span>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1 pr-1 text-[11px]">
                {previewSessions.map((s, idx) => {
                  const dObj = new Date(s.session_date);
                  const dayName = HEBREW_DAYS[dObj.getDay()];
                  const dateFormatted = formatHebrewDate(dObj, 'dd/MM/yyyy');
                  const timeFormatted = formatHebrewDate(dObj, 'HH:mm');
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-1.5 bg-card/80 border border-indigo-500/10 rounded-lg text-foreground font-medium"
                    >
                      <span>
                        <strong>מפגש {idx + 1}:</strong> יום {dayName}, {dateFormatted}
                      </span>
                      <span className="text-indigo-600 dark:text-indigo-300 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-md">
                        {timeFormatted}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-4 border-t border-border flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-border rounded-xl text-xs font-bold hover:bg-muted transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={weeklyDays.length === 0}
              className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              {programToEdit ? 'עדכן תוכנית ומפגשים' : 'צור תוכנית ומפגשים במערכת'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
