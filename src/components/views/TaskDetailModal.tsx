import { useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronRight, ChevronDown, Clock, ExternalLink, Trash2, Calendar, Play, Square, Eye, EyeOff, Check } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore, type Task } from '../../store/useTaskStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useTimerStore, type TimeEntry, formatDuration } from '../../store/useTimerStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import { PillSelect } from '../ui/PillSelect';
import { EstimatePicker } from '../ui/EstimatePicker';
import { Tooltip } from '../ui/Tooltip';

const PRIORITIES = [
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'high', label: 'High', color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low', label: 'Low', color: '#94a3b8' },
];

/* ─── Draggable subtask card (Kanban-style) ─────────────────────── */
const SortableSubtaskCard = ({
  sub,
  statuses,
  language,
  onOpenSub,
  onToggleDone,
  onToggleVisible,
}: {
  sub: Task;
  statuses: { id: string; name: string; is_done: number | boolean; color?: string | null }[];
  language: 'en' | 'zh';
  onOpenSub: (id: string) => void;
  onToggleDone: (sub: Task) => void;
  onToggleVisible: (id: string) => void;
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: sub.id });
  const style = { transform: CSS.Transform.toString(transform), transition: isDragging ? 'none' : transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 999 : 'auto' };

  const subStatus = statuses.find((s) => s.id === sub.status_id);
  const isDone = subStatus && Number(subStatus.is_done);
  const subHidden = !sub.visible;
  const subPriority = PRIORITIES.find((p) => p.value === sub.priority);

  return (
    <div
      ref={setNodeRef}
      style={style as any}
      {...attributes}
      {...listeners}
      className={`rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm group transition-shadow cursor-grab active:cursor-grabbing touch-none ${subHidden ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">

        {/* Checkbox */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleDone(sub)}
          className={`shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition ${
            isDone ? 'bg-brand-500 border-brand-500 text-white' : 'border-neutral-300 dark:border-neutral-500 hover:border-brand-400'
          }`}
        >
          {isDone ? <Check className="w-2.5 h-2.5" strokeWidth={3} /> : null}
        </button>

        {/* Title */}
        <div className="flex-1 min-w-0 pr-2 flex items-center">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => onOpenSub(sub.id)}
            className={`text-sm text-left leading-snug truncate max-w-full hover:text-brand-600 dark:hover:text-brand-400 transition cursor-pointer ${
              isDone ? 'line-through text-neutral-400 dark:text-neutral-500' : subHidden ? 'text-neutral-400 dark:text-neutral-500' : 'text-neutral-800 dark:text-neutral-200'
            }`}
          >
            {sub.title}
          </button>
        </div>

        {/* Visibility toggle */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleVisible(sub.id)}
          className={`shrink-0 p-0.5 rounded transition ${
            subHidden ? 'text-neutral-300 dark:text-neutral-600' : 'opacity-0 group-hover:opacity-100 text-neutral-400 dark:text-neutral-500 hover:text-brand-500'
          }`}
          title={subHidden ? t(language, 'tooltip_show_task') : t(language, 'tooltip_hide_task')}
        >
          {subHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
        </button>

        {/* Open detail */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOpenSub(sub.id)}
          className="opacity-0 group-hover:opacity-100 text-neutral-400 dark:text-neutral-500 hover:text-brand-500 transition shrink-0 cursor-pointer"
          title={t(language, 'tooltip_open_subtask')}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status + priority row */}
      <div className="flex items-center gap-2 px-9 pb-2.5" onPointerDown={(e) => e.stopPropagation()}>
        <PillSelect
          value={sub.status_id}
          options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color || '#94a3b8' }))}
          onChange={async (val) => { if (val) await useTaskStore.getState().updateTask(sub.id, { status_id: val }); }}
        />
        {subPriority && (
          <span className="text-[11px] font-bold ml-auto pointer-events-none" style={{ color: subPriority.color }}>!</span>
        )}
      </div>
    </div>
  );
};

interface Props {
  taskId: string;
  onClose: () => void;
}

export const TaskDetailModal = ({ taskId, onClose }: Props) => {
  const [currentTaskId, setCurrentTaskId] = useState(taskId);
  const { tasks, updateTask, updateTaskProject, addTask, deleteTask, deleteTaskRecursive, toggleVisible, setChildrenVisibility, batchUpdatePositions } = useTaskStore();
  const { statuses } = useStatusStore();
  const { projects } = useProjectStore();
  const { getEntriesForTask, addManualEntry, deleteEntry, isRunning, activeTaskId, startTimer, stopTimer } = useTimerStore();
  const { language } = useSettingsStore();

  const task = tasks.find((t) => t.id === currentTaskId);
  const subtasks = tasks
    .filter((t) => t.parent_id === currentTaskId)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [subtasksExpanded, setSubtasksExpanded] = useState(true);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [timeEntriesExpanded, setTimeEntriesExpanded] = useState(true);
  const [manualDurationMin, setManualDurationMin] = useState('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Sync if store changes
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description ?? '');
    }
  }, [task?.title, task?.description]);

  // Load time entries; re-fetch when timer stops (isRunning changes)
  useEffect(() => {
    getEntriesForTask(currentTaskId).then(setTimeEntries);
  }, [currentTaskId, isRunning]);

  // Focus and select title when modal opens or when navigating to another task in modal.
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (!titleInputRef.current) return;
      titleInputRef.current.focus();
      titleInputRef.current.select();
    });
    return () => cancelAnimationFrame(id);
  }, [currentTaskId]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  if (!task) return null;
  const running = isRunning && activeTaskId === currentTaskId;
  if (!task) return null;

  const handleDescBlur = async () => {
    if (description !== (task.description ?? '')) {
      await updateTask(currentTaskId, { description: description || null });
    }
  };

  const handleAddSubtask = async () => {
    if (!newSubtaskTitle.trim()) return;
    await addTask(newSubtaskTitle.trim(), task.project_id ?? undefined, currentTaskId);
    setNewSubtaskTitle('');
    setShowSubtaskInput(false);
  };

  const doneCount = subtasks.filter((s) => {
    const st = statuses.find((x) => x.id === s.status_id);
    return st && Number(st.is_done);
  }).length;

  const totalTimeSec = timeEntries.reduce((acc, e) => acc + (e.duration ?? 0), 0);

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
    setTimeEntries(await getEntriesForTask(currentTaskId));
  };

  const handleAddManualEntry = async () => {
    const min = Number(manualDurationMin);
    if (!min || min <= 0) return;
    await addManualEntry(currentTaskId, min);
    setTimeEntries(await getEntriesForTask(currentTaskId));
    setManualDurationMin('');
    setShowManualInput(false);
  };

  // priorityInfo is used by subtask display below
  const priorityInfo = PRIORITIES.find((p) => p.value === task.priority);
  void priorityInfo; // still used in subtask rows via PRIORITIES lookup above

  // (old modal return removed)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-2xl dark:shadow-neutral-900/50 w-[520px] max-w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-100 dark:border-neutral-700">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
          {task.parent_id && (() => {
            const parent = tasks.find((t) => t.id === task.parent_id);
            return parent ? (
              <button
                type="button"
                onClick={() => setCurrentTaskId(parent.id)}
                className="inline-flex items-center gap-1 text-xs text-neutral-400 dark:text-neutral-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors border-b border-transparent hover:border-brand-400 pb-0.5"
                title={`Go to parent: ${parent.title}`}
              >
                <ChevronRight className="w-3 h-3 opacity-60" />
                <span className="max-w-[120px] truncate">{parent.title}</span>
              </button>
            ) : null;
          })()}
          <input
            ref={titleInputRef}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={async () => {
              const trimmed = title.trim();
              if (trimmed && trimmed !== task.title) {
                await updateTask(currentTaskId, { title: trimmed });
              } else {
                setTitle(task.title);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
              if (e.key === 'Escape') { setTitle(task.title); (e.target as HTMLInputElement).blur(); }
            }}
            className="flex-1 text-base font-semibold text-slate-800 dark:text-neutral-200 bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-neutral-600 focus:border-brand-400 focus:outline-none px-0.5 py-0.5 min-w-0 transition-colors"
          />
          <button
            type="button"
            className={`ml-2 btn-icon ${running ? 'bg-red-50 text-red-500' : 'bg-brand-50 text-brand-600'}`}
            title={running ? t(language, 'tooltip_stop_timer') : t(language, 'tooltip_start_timer')}
            onClick={async () => {
              if (running) {
                await stopTimer();
              } else {
                await startTimer(currentTaskId, title);
              }
            }}
          >
            {running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* Metadata */}
          <div className="space-y-3">
            {/* Row 1: 4 equal-width controls */}
            <div className="grid grid-cols-4 gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="label-section">{t(language, 'label_status')}</label>
                <PillSelect
                  value={task.status_id}
                  options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color || '#94a3b8' }))}
                  onChange={async (val) => { if (val) await updateTask(currentTaskId, { status_id: val }); }}
                />
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label className="label-section">{t(language, 'label_priority')}</label>
                <PillSelect
                  value={task.priority ?? null}
                  options={PRIORITIES.map((p) => ({ value: p.value, label: p.label, color: p.color }))}
                  onChange={async (val) => { await updateTask(currentTaskId, { priority: val }); }}
                  nullable
                  placeholder={t(language, 'placeholder_no_priority')}
                />
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label className="label-section">{t(language, 'label_project')}</label>
                {task.parent_id ? (
                  <span className="inline-block w-full truncate text-sm text-slate-500 dark:text-neutral-400 italic px-2.5 py-1.5 rounded-md bg-neutral-50 dark:bg-neutral-700">
                    {projects.find((p) => p.id === task.project_id)?.name ?? t(language, 'placeholder_no_project')}
                    <span className="text-xs text-slate-400 dark:text-neutral-500 ml-1">{t(language, 'text_project_inherited')}</span>
                  </span>
                ) : (
                  <PillSelect
                    value={task.project_id ?? null}
                    options={projects.map((p) => ({ value: p.id, label: p.name, color: p.color || '#94a3b8', icon: p.icon, icon_type: p.icon_type, icon_color: p.icon_color }))}
                    onChange={async (val) => { await updateTaskProject(currentTaskId, val); }}
                    nullable
                    placeholder={t(language, 'placeholder_no_project')}
                  />
                )}
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label className="label-section">{task.visible ? t(language, 'btn_visible') : t(language, 'btn_hidden')}</label>
                <Tooltip id="task-visible">
                  <button
                    type="button"
                    onClick={() => toggleVisible(currentTaskId)}
                    className={`inline-flex w-full items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors truncate ${
                      task.visible
                        ? 'bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100'
                        : 'bg-slate-100 dark:bg-neutral-700 border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 hover:bg-slate-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    {task.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span className="truncate">{task.visible ? t(language, 'btn_visible') : t(language, 'btn_hidden')}</span>
                  </button>
                </Tooltip>
              </div>
            </div>

            {/* Row 2: Estimate + Due Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <label className="label-section flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {t(language, 'label_estimate')}
                </label>
                <EstimatePicker
                  value={task.estimate ?? null}
                  onChange={async (val) => { await updateTask(currentTaskId, { estimate: val }); }}
                />
              </div>

              <div className="flex flex-col gap-1 min-w-0">
                <label className="label-section flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {t(language, 'label_due_date')}
                </label>
                <input
                  type="date"
                  value={task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : ''}
                  onChange={async (e) => {
                    const val = e.target.value ? new Date(e.target.value).getTime() : null;
                    await updateTask(currentTaskId, { due_date: val });
                  }}
                  className="w-full h-[34px] text-sm border border-neutral-200 dark:border-neutral-600 rounded-md px-3 bg-white dark:bg-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-300"
                />
              </div>
            </div>

          </div>

          {/* Description */}
          <div>
            <label className="label-section">{t(language, 'label_description')}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescBlur}
              placeholder={t(language, 'placeholder_description')}
              rows={4}
              className="mt-1.5 w-full form-input resize-none placeholder-slate-300 dark:placeholder-neutral-500 text-slate-700 dark:text-neutral-200 py-2.5"
            />
          </div>

          {/* Subtasks */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setSubtasksExpanded((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-neutral-300 transition"
              >
                {subtasksExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {t(language, 'section_subtasks')}
                {subtasks.length > 0 && (
                  <span className="ml-1 text-slate-500 dark:text-neutral-400 normal-case font-normal">
                    ({doneCount}/{subtasks.length})
                  </span>
                )}
              </button>

              {subtasks.length > 0 && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setChildrenVisibility(currentTaskId, true)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-brand-300 hover:text-brand-600 transition-colors"
                    title={t(language, 'btn_show_children')}
                  >
                    <Eye className="w-3 h-3" /> {t(language, 'btn_show_children')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setChildrenVisibility(currentTaskId, false)}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-full border border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-slate-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors"
                    title={t(language, 'btn_hide_children')}
                  >
                    <EyeOff className="w-3 h-3" /> {t(language, 'btn_hide_children')}
                  </button>
                </div>
              )}
            </div>

            {subtasksExpanded && (
              <div className="mt-2 space-y-2">
                <DndContext
                  sensors={sensors}
                  onDragEnd={async (event: DragEndEvent) => {
                    const { active, over } = event;
                    if (!over || active.id === over.id) return;
                    const oldIdx = subtasks.findIndex((s) => s.id === active.id);
                    const newIdx = subtasks.findIndex((s) => s.id === over.id);
                    if (oldIdx === -1 || newIdx === -1) return;
                    const reordered = arrayMove(subtasks, oldIdx, newIdx);
                    await batchUpdatePositions(reordered.map((s, i) => ({ id: s.id, position: i })));
                  }}
                >
                  <SortableContext items={subtasks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                    {subtasks.map((sub) => (
                      <SortableSubtaskCard
                        key={sub.id}
                        sub={sub}
                        statuses={statuses}
                        language={language}
                        onOpenSub={(id) => {
                          onClose();
                          setTimeout(() => {
                            window.dispatchEvent(new CustomEvent('open-task-detail', { detail: { taskId: id } }));
                          }, 50);
                        }}
                        onToggleDone={async (s) => {
                          const subStatus = statuses.find((x) => x.id === s.status_id);
                          const isDone = subStatus && Number(subStatus.is_done);
                          const target = isDone
                            ? statuses.find((x) => !Number(x.is_done))
                            : statuses.find((x) => Number(x.is_done));
                          if (target) await updateTask(s.id, { status_id: target.id });
                        }}
                        onToggleVisible={toggleVisible}
                      />
                    ))}
                  </SortableContext>
                </DndContext>

                {showSubtaskInput ? (
                  <div className="flex gap-2 mt-1">
                    <input
                      autoFocus
                      type="text"
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddSubtask();
                        if (e.key === 'Escape') { setShowSubtaskInput(false); setNewSubtaskTitle(''); }
                      }}
                      placeholder={t(language, 'placeholder_subtask_name')}
                      className="flex-1 text-sm border border-neutral-300 dark:border-neutral-600 rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 dark:bg-neutral-700 dark:text-neutral-200"
                    />
                    <button type="button" onClick={handleAddSubtask} className="btn-primary">{t(language, 'add')}</button>
                    <button type="button" onClick={() => { setShowSubtaskInput(false); setNewSubtaskTitle(''); }} className="btn-secondary">{t(language, 'cancel')}</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowSubtaskInput(true)}
                    className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-neutral-500 hover:text-brand-500 px-1 py-1.5 rounded hover:bg-neutral-50 dark:hover:bg-neutral-700 transition"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t(language, 'btn_add_subtask')}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Time Entries */}
          <div>
            <button
              type="button"
              onClick={() => setTimeEntriesExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-slate-400 dark:text-neutral-500 uppercase tracking-wider hover:text-slate-600 dark:hover:text-neutral-300 transition"
            >
              {timeEntriesExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <Clock className="w-3 h-3" />
              {t(language, 'section_time_entries')}
              {totalTimeSec > 0 && (
                <span className="ml-2 text-slate-500 dark:text-neutral-400 normal-case font-normal inline-flex items-center gap-1.5">
                  <span className="text-slate-400 dark:text-neutral-500">{t(language, 'label_total')}</span>
                  <span className="font-mono text-slate-600 dark:text-neutral-300">{formatDuration(totalTimeSec)}</span>
                </span>
              )}
            </button>

            {timeEntriesExpanded && (
              <div className="mt-2 space-y-1">
                {timeEntries
                  .filter((e) => e.end_time !== null)
                  .map((entry) => (
                  <div key={entry.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-slate-50 dark:bg-neutral-900 hover:bg-slate-100 dark:hover:bg-neutral-700 group transition">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
                    <span className="flex-1 text-sm text-slate-500 dark:text-neutral-400">
                      {new Date(entry.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-sm font-mono text-slate-700 dark:text-neutral-200">
                      {formatDuration(entry.duration ?? 0)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-neutral-500 hover:text-red-500 transition p-0.5 rounded"
                      title={t(language, 'tooltip_delete_entry')}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {timeEntries.length === 0 && (
                  <p className="text-xs text-slate-400 dark:text-neutral-500 px-3 py-1">{t(language, 'no_time_logged')}</p>
                )}

                {showManualInput ? (
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
                    <input
                      autoFocus
                      type="number"
                      min={1}
                      value={manualDurationMin}
                      onChange={(e) => setManualDurationMin(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleAddManualEntry();
                        if (e.key === 'Escape') { setShowManualInput(false); setManualDurationMin(''); }
                      }}
                      placeholder={t(language, 'placeholder_duration_min')}
                      className="w-32 text-sm form-input"
                    />
                    <button
                      type="button"
                      onClick={handleAddManualEntry}
                      className="btn-primary"
                    >{t(language, 'add')}</button>
                    <button
                      type="button"
                      onClick={() => { setShowManualInput(false); setManualDurationMin(''); }}
                      className="btn-secondary"
                    >{t(language, 'cancel')}</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowManualInput(true)}
                    className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-neutral-500 hover:text-brand-500 px-3 py-1.5 rounded hover:bg-neutral-50 dark:hover:bg-neutral-700 transition mt-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> {t(language, 'btn_add_manual_entry')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-neutral-700 bg-slate-50/50 dark:bg-neutral-800/50">
          {showDeleteConfirm ? (
            <div className="flex flex-col gap-2">
              <span className="text-xs text-slate-600 dark:text-neutral-300 font-medium">
                {subtasks.length > 0
                  ? `${t(language, 'section_subtasks')}: ${subtasks.length}`
                  : t(language, 'confirm_delete_task')}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={async () => { onClose(); await deleteTask(currentTaskId); }}
                  className="text-xs px-3 py-1.5 rounded bg-orange-500 text-white hover:bg-orange-600 transition"
                >
                  {subtasks.length > 0 ? t(language, 'btn_delete_task_only') : t(language, 'btn_yes_delete')}
                </button>
                {subtasks.length > 0 && (
                  <button
                    type="button"
                    onClick={async () => { onClose(); await deleteTaskRecursive(currentTaskId); }}
                    className="text-xs px-3 py-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition"
                  >
                    {t(language, 'btn_delete_task_and_subtasks')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="text-xs px-3 py-1.5 rounded bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-600 transition"
                >
                  {t(language, 'cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 dark:text-neutral-500">
                {t(language, 'task_created_prefix')} {new Date(task.created_at).toLocaleDateString()}
                {task.parent_id && <span className="ml-2 text-slate-300 dark:text-neutral-600">{t(language, 'text_subtask_indicator')}</span>}
              </span>
              <Tooltip id="delete-task">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded text-slate-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
