import React, { useState, useEffect } from 'react';
import { X, CheckSquare, Calendar, Clock, User, AlertTriangle } from 'lucide-react';
import { Task, TaskPriority, TASK_PRIORITY_LABELS, Client } from '../../types';
import { useOrganization } from '../../context/OrganizationContext';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskData: Partial<Task>) => void;
  taskToEdit?: Task | null;
  clients: Client[];
}

export const TaskModal: React.FC<TaskModalProps> = ({
  isOpen,
  onClose,
  onSave,
  taskToEdit,
  clients,
}) => {
  const { members } = useOrganization();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('12:00');
  const [clientId, setClientId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');

  useEffect(() => {
    if (taskToEdit) {
      setTitle(taskToEdit.title || '');
      setDescription(taskToEdit.description || '');
      setPriority(taskToEdit.priority || 'medium');
      setClientId(taskToEdit.client_id || '');
      setAssignedTo(taskToEdit.assigned_to || '');

      if (taskToEdit.due_date) {
        const parts = taskToEdit.due_date.split('T');
        setDueDate(parts[0] || '');
        setDueTime(parts[1] ? parts[1].substring(0, 5) : '12:00');
      } else {
        setDueDate('');
        setDueTime('12:00');
      }
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate(new Date().toISOString().split('T')[0]);
      setDueTime('12:00');
      setClientId('');
      setAssignedTo(members[0]?.user_id || '');
    }
  }, [taskToEdit, isOpen, members]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let fullDueISO: string | undefined = undefined;
    if (dueDate) {
      fullDueISO = new Date(`${dueDate}T${dueTime || '12:00'}:00`).toISOString();
    }

    onSave({
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      status: taskToEdit?.status || 'todo',
      due_date: fullDueISO,
      client_id: clientId || undefined,
      assigned_to: assignedTo || undefined,
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-slate-900 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <h3 className="font-bold text-base text-foreground flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            {taskToEdit ? 'עריכת משימה' : 'משימה חדשה למרפאה'}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-right">
          <div>
            <label className="block text-xs font-semibold mb-1">כותרת המשימה *</label>
            <input
              type="text"
              required
              placeholder="דוגמה: להתקשר למטופל דוד לבדוק הרגשה"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1">תיאור ופרטים נוספים</label>
            <textarea
              rows={3}
              placeholder="פירוט המשימה..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold mb-1">רמת דחיפות *</label>
            <div className="grid grid-cols-4 gap-1.5">
              {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => {
                const info = TASK_PRIORITY_LABELS[p];
                const isSelected = priority === p;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-2 px-1 text-xs font-bold rounded-xl border transition-all text-center ${
                      isSelected
                        ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                        : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted'
                    }`}
                  >
                    {info.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date & Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">תאריך יעד</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">שעת יעד</label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Link to Client */}
          <div>
            <label className="block text-xs font-semibold mb-1">שיוך ללקוח (אופציונלי)</label>
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">משימה כללית (ללא שיוך לקוח)</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name} ({c.phone})
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Therapist */}
          <div>
            <label className="block text-xs font-semibold mb-1">משויך למטפל</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">ללא שיוך מיוחד</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_name || m.user_email}
                </option>
              ))}
            </select>
          </div>

          <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-xl text-xs font-semibold hover:bg-muted"
            >
              ביטול
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all"
            >
              {taskToEdit ? 'עדכן משימה' : 'צור משימה'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
