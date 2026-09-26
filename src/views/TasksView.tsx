import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
  User,
  Archive,
} from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { Task, TaskPriority, TASK_PRIORITY_LABELS } from '../types';
import { formatHebrewDate } from '../lib/utils';
import { TaskModal } from '../components/dialogs/TaskModal';

interface TasksViewProps {
  onNavigate: (path: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onNavigate }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);

  const tasks = dataStore.getTasks() || [];
  const clients = dataStore.getClients() || [];

  // Priority order weight
  const priorityWeight: Record<TaskPriority, number> = {
    urgent: 1,
    high: 2,
    medium: 3,
    low: 4,
  };

  const openTasks = tasks
    .filter((t) => t.status === 'todo')
    .sort((a, b) => {
      const pDiff = (priorityWeight[a.priority] || 9) - (priorityWeight[b.priority] || 9);
      if (pDiff !== 0) return pDiff;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

  const completedTasks = tasks
    .filter((t) => t.status === 'done')
    .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime());

  const handleToggleTask = (task: Task) => {
    dataStore.updateTask(task.id, {
      status: task.status === 'todo' ? 'done' : 'todo',
    });
  };

  const handleDeleteTask = (id: string) => {
    if (confirm('האם למחוק משימה זו?')) {
      dataStore.deleteTask(id);
    }
  };

  const handleSaveTask = (data: Partial<Task>) => {
    if (taskToEdit) {
      dataStore.updateTask(taskToEdit.id, data);
    } else {
      dataStore.addTask(data as any);
    }
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CheckSquare className="w-5 h-5 text-primary" />
            ניהול משימות ותזכורות בקליניקה
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            מעקב משימות לפי דחיפות, מועדי יעד ושיוך למטופלים
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setShowCompleted((p) => !p)}
            className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-colors flex items-center gap-1.5 ${
              showCompleted ? 'bg-primary/15 text-primary border-primary/30' : 'bg-muted border-border text-muted-foreground'
            }`}
          >
            <Archive className="w-4 h-4" />
            {showCompleted ? 'הסתר משימות שבוצעו' : `משימות שבוצעו (${completedTasks.length})`}
          </button>

          <button
            onClick={() => {
              setTaskToEdit(null);
              setIsTaskModalOpen(true);
            }}
            className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            משימה חדשה
          </button>
        </div>
      </div>

      {/* Main Open Tasks List */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-foreground">
          משימות פתוחות לביצוע ({openTasks.length})
        </h3>

        {openTasks.length === 0 ? (
          <div className="p-8 text-center bg-card border border-dashed border-border rounded-2xl text-muted-foreground text-xs">
            אין משימות פתוחות לביצוע!
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {openTasks.map((t) => {
              const priorityInfo = TASK_PRIORITY_LABELS[t.priority] || {
                label: t.priority || 'בינונית',
                class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
              };
              const client = t.client_id ? dataStore.getClientById(t.client_id) : null;
              const dueDateStr = t.due_date ? formatHebrewDate(t.due_date, 'dd/MM/yyyy HH:mm') : 'ללא תאריך יעד';

              return (
                <div
                  key={t.id}
                  className="bg-card border border-border hover:border-primary/40 rounded-2xl p-4 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2.5">
                        <button
                          onClick={() => handleToggleTask(t)}
                          className="mt-0.5 text-muted-foreground hover:text-emerald-600 transition-colors"
                        >
                          <div className="w-5 h-5 rounded border-2 border-muted-foreground/60 flex items-center justify-center hover:border-emerald-600"></div>
                        </button>
                        <div>
                          <h4 className="font-bold text-sm text-foreground">{t.title}</h4>
                          {t.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                              {t.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full ${priorityInfo.class}`}>
                        {priorityInfo.label}
                      </span>
                    </div>

                    {client && (
                      <div
                        onClick={() => onNavigate(`/clients/${client.id}`)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg hover:underline cursor-pointer"
                      >
                        <User className="w-3.5 h-3.5" />
                        <span>{client.full_name || 'מטופל'}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono text-[11px] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {dueDateStr}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setTaskToEdit(t);
                          setIsTaskModalOpen(true);
                        }}
                        className="p-1 hover:bg-muted text-muted-foreground hover:text-foreground rounded"
                        title="ערוך"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1 hover:bg-rose-500/10 text-muted-foreground hover:text-rose-600 rounded"
                        title="מחק"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed Tasks Archive */}
      {showCompleted && (
        <div className="space-y-3 pt-4 border-t border-border">
          <h3 className="font-bold text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            ארכיון משימות שבוצעו ({completedTasks.length})
          </h3>

          <div className="space-y-2">
            {completedTasks.map((t) => (
              <div
                key={t.id}
                className="bg-muted/30 border border-border/60 p-3 rounded-xl flex items-center justify-between text-xs line-through text-muted-foreground"
              >
                <div className="flex items-center gap-2">
                  <button onClick={() => handleToggleTask(t)} className="text-emerald-600">
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <span>{t.title}</span>
                </div>
                <button onClick={() => handleDeleteTask(t.id)} className="p-1 text-rose-500 hover:bg-rose-500/10 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal */}
      <TaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        onSave={handleSaveTask}
        taskToEdit={taskToEdit}
        clients={clients}
      />
    </div>
  );
};
