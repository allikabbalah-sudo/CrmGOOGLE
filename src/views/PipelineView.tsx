import React, { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Kanban, ChevronDown, ChevronUp, Phone, BookOpen, MessageCircle } from 'lucide-react';
import { dataStore } from '../lib/dataStore';
import { Client, ClientStatus, CLIENT_STATUS_LABELS } from '../types';
import { toWhatsAppUrl } from '../lib/utils';
import confetti from 'canvas-confetti';

interface PipelineViewProps {
  onNavigate: (path: string) => void;
}

const COLUMNS: ClientStatus[] = ['lead', 'consultation', 'active', 'waiting', 'paid', 'inactive'];

const SortableClientCard: React.FC<{
  client: Client;
  sortableId: string;
  onNavigate: (path: string) => void;
}> = ({
  client,
  sortableId,
  onNavigate,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const whatsappUrl = toWhatsAppUrl(client.phone, `Hello ${client.full_name}, How are you? Are you ready for today's session?`);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-card border border-border hover:border-primary/50 p-3 rounded-xl shadow-2xs hover:shadow-sm cursor-grab active:cursor-grabbing transition-all space-y-2 group"
    >
      <div className="flex items-center justify-between gap-2">
        <h4
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(`/clients/${client.id}`);
          }}
          className="font-bold text-xs text-foreground group-hover:text-primary transition-colors hover:underline cursor-pointer truncate"
        >
          {client.full_name}
        </h4>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="p-1 text-emerald-600 hover:bg-emerald-500/10 rounded"
          title="WhatsApp"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      </div>

      {client.selected_reading && (
        <p className="text-[10px] text-primary font-medium truncate flex items-center gap-1">
          <BookOpen className="w-3 h-3 shrink-0" />
          {client.selected_reading}
        </p>
      )}

      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/40 pt-1.5">
        <span>{client.phone}</span>
        {client.mother_name && <span>אם: {client.mother_name}</span>}
      </div>
    </div>
  );
}

export const PipelineView: React.FC<PipelineViewProps> = ({ onNavigate }) => {
  const [openMobileCols, setOpenMobileCols] = useState<Record<string, boolean>>({
    lead: true,
    consultation: true,
    active: true,
  });

  const clients = dataStore.getClients() || [];

  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 6, // 6px drag distance requirement
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(pointerSensor, keyboardSensor);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const clientId = String(active.id).replace('desktop-client-', '').replace('mobile-client-', '');
    let targetStatusRaw = String(over.id)
      .replace('desktop-col-', '')
      .replace('mobile-col-', '');

    // If dragged over another client card, find that client's status
    if (targetStatusRaw.includes('desktop-client-') || targetStatusRaw.includes('mobile-client-')) {
      const overClientId = targetStatusRaw.replace('desktop-client-', '').replace('mobile-client-', '');
      const overClient = dataStore.getClientById(overClientId);
      if (overClient) {
        targetStatusRaw = overClient.status;
      }
    }

    const targetStatus = targetStatusRaw as ClientStatus;

    if (COLUMNS.includes(targetStatus)) {
      const client = dataStore.getClientById(clientId);
      if (client && client.status !== targetStatus) {
        dataStore.updateClient(clientId, { status: targetStatus });

        // Celebrate paid or active conversion!
        if (targetStatus === 'paid' || targetStatus === 'active') {
          try {
            confetti({ particleCount: 40, spread: 50, origin: { y: 0.6 } });
          } catch {}
        }
      }
    }
  };

  const toggleMobileCol = (colKey: string) => {
    setOpenMobileCols((p) => ({ ...p, [colKey]: !p[colKey] }));
  };

  return (
    <div className="space-y-5">
      {/* Top Bar */}
      <div className="flex items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Kanban className="w-5 h-5 text-primary" />
            פייפליין ומעקב לידים (קנבן)
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            גרור מטופל בין העמודות לעדכון סטטוס קליני מהיר ולוג פעילות אוטומטי
          </p>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        {/* Desktop Kanban Board (6 columns) */}
        <div className="hidden lg:grid grid-cols-6 gap-3 min-h-[600px] items-start">
          {COLUMNS.map((colStatus) => {
            const colClients = clients.filter((c) => c?.status === colStatus);
            const statusInfo = CLIENT_STATUS_LABELS[colStatus] || {
              label: colStatus,
              color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
              badge: 'bg-slate-500',
            };

            return (
              <div
                key={`desktop-col-${colStatus}`}
                id={`desktop-col-${colStatus}`}
                className="bg-card/70 border border-border rounded-2xl p-3 flex flex-col h-full space-y-3"
                style={colStatus === 'paid' ? { backgroundColor: '#baefd1' } : undefined}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.badge}`}></span>
                    <h3 className="font-bold text-xs text-foreground">{statusInfo.label}</h3>
                  </div>
                  <span className="text-[11px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {colClients.length}
                  </span>
                </div>

                {/* Sortable List */}
                <SortableContext
                  items={colClients.map((c) => `desktop-client-${c.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-2 flex-1 min-h-[200px]">
                    {colClients.map((client) => (
                      <SortableClientCard
                        key={`desktop-card-${client.id}`}
                        sortableId={`desktop-client-${client.id}`}
                        client={client}
                        onNavigate={onNavigate}
                      />
                    ))}
                    {colClients.length === 0 && (
                      <div className="p-4 text-center text-[11px] text-muted-foreground border border-dashed border-border/60 rounded-xl my-2">
                        עמודה ריקה
                      </div>
                    )}
                  </div>
                </SortableContext>
              </div>
            );
          })}
        </div>

        {/* Mobile Accordion View */}
        <div className="lg:hidden space-y-3">
          {COLUMNS.map((colStatus) => {
            const colClients = clients.filter((c) => c?.status === colStatus);
            const statusInfo = CLIENT_STATUS_LABELS[colStatus] || {
              label: colStatus,
              color: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
              badge: 'bg-slate-500',
            };
            const isOpen = !!openMobileCols[colStatus];

            return (
              <div
                key={`mobile-col-${colStatus}`}
                id={`mobile-col-${colStatus}`}
                className="bg-card border border-border rounded-2xl p-3 shadow-xs"
              >
                <button
                  onClick={() => toggleMobileCol(colStatus)}
                  className="w-full flex items-center justify-between font-bold text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${statusInfo.badge}`}></span>
                    <span>{statusInfo.label}</span>
                    <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
                      ({colClients.length})
                    </span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {isOpen && (
                  <div className="mt-3 space-y-2 pt-2 border-t border-border">
                    <SortableContext
                      items={colClients.map((c) => `mobile-client-${c.id}`)}
                      strategy={verticalListSortingStrategy}
                    >
                      {colClients.map((client) => (
                        <SortableClientCard
                          key={`mobile-card-${client.id}`}
                          sortableId={`mobile-client-${client.id}`}
                          client={client}
                          onNavigate={onNavigate}
                        />
                      ))}
                    </SortableContext>
                    {colClients.length === 0 && (
                      <p className="text-[11px] text-muted-foreground text-center py-2">אין לקוחות בסטטוס זה</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
};
