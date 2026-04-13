import React from 'react';
import { ChevronDown, ChevronRight, Play, Square, Trash2, Plus, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { useTaskStore, type Task } from '../../../store/useTaskStore';
import type { RenderRow } from './buildRenderList';
import { PillSelect } from '../../ui/PillSelect';
import { formatDurationCompact, formatEstimate } from '../../../lib/utils';

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  { value: 'high',   label: 'High',   color: '#f97316' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'low',    label: 'Low',    color: '#94a3b8' },
];

export const TaskRow = ({
  row,
  doneStatusId,
  statuses,
  projects,
  isRunning,
  activeTaskId,
  isDragging,
  isNestTarget,
  onToggleDone,
  onToggleCollapsed,
  onStartStop,
  onOpenDetail,
  onDeleteRequest,
  onAddSubtask,
  isSelected,
  onToggleSelect,
  totalTimeSec,
  visibleCols,
  colOrder,
}: {
  row: RenderRow;
  doneStatusId: string;
  statuses: { id: string; name: string; color: string | null }[];
  projects: { id: string; name: string; color: string | null; icon?: string | null; icon_type?: string | null; icon_color?: string | null }[];
  isRunning: boolean;
  activeTaskId: string | null;
  isDragging: boolean;
  isNestTarget: boolean;
  onToggleDone: (task: Task, checked: boolean) => void;
  onToggleCollapsed: (id: string) => void;
  onStartStop: (task: Task) => void;
  onOpenDetail: (id: string) => void;
  onDeleteRequest: (task: Task) => void;
  onAddSubtask: (parentId: string, projectId: string | null) => void;
  isSelected: boolean;
  onToggleSelect: (id: string, checked: boolean) => void;
  totalTimeSec: number;
  visibleCols: Record<string, boolean>;
  colOrder: string[];
}) => {
  const { task, level, childCount, doneChildCount } = row;
  const ancestors = row.ancestors;
  const { updateTask, updateTaskStatus, updateTaskProject, toggleVisible } = useTaskStore();
  const isDone = task.status_id === doneStatusId;
  const isTimerActive = isRunning && activeTaskId === task.id;
  const isHidden = !task.visible;

  const { attributes, listeners, setNodeRef: dragRef } = useDraggable({ id: task.id });
  const { setNodeRef: nestRef, isOver: isNestOver } = useDroppable({ id: `nest:${task.id}` });

  const INDENT = 24;

  return (
    <tr
      className={`transition group ${isDragging ? 'opacity-40' : ''} ${
        isNestTarget || isNestOver ? 'bg-brand-50/60 dark:bg-brand-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
      }`}
    >
      <td className="px-0 py-2 border-b border-neutral-100 dark:border-neutral-600/70 text-center align-middle">
        <button
          ref={dragRef}
          {...attributes}
          {...listeners}
          type="button"
          className="inline-flex items-center justify-center w-6 h-6 rounded opacity-0 group-hover:opacity-100 text-slate-300 dark:text-neutral-500 hover:text-slate-500 dark:hover:text-neutral-200 cursor-grab active:cursor-grabbing transition touch-none"
          tabIndex={-1}
          aria-label="Drag"
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </td>

      <td className="px-0 py-2 border-b border-neutral-100 dark:border-neutral-600/70 text-center align-middle">
        <button
          type="button"
          onClick={() => onToggleSelect(task.id, !isSelected)}
          className={`inline-flex items-center justify-center w-4 h-4 rounded-[4px] border transition ${
            isSelected
              ? 'bg-brand-500 border-brand-500 text-white'
                : 'border-neutral-300 dark:border-neutral-500 hover:border-neutral-400 dark:hover:border-neutral-300'
          }`}
          aria-label="Select task"
        >
          {isSelected && (
            <svg className="w-3 h-3" strokeWidth={3} stroke="currentColor" fill="none" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </td>

      <td
        ref={nestRef}
        className={`py-2 border-b border-neutral-100 dark:border-neutral-600/70 max-w-[360px] ${isNestOver ? 'bg-brand-50 dark:bg-brand-900/20' : ''}`}
        style={{ paddingLeft: `${level * INDENT + 6}px` }}
      >
        <div className="flex items-center min-w-0 gap-1.5">
          <button
            type="button"
            onClick={() => childCount > 0 && onToggleCollapsed(task.id)}
            className={`shrink-0 w-5 h-5 flex items-center justify-center rounded text-slate-400 dark:text-neutral-400 hover:text-slate-600 dark:hover:text-neutral-100 transition ${childCount === 0 ? 'cursor-default opacity-0' : 'cursor-pointer'}`}
          >
            {task.collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          <button
            type="button"
            className={`task-checkbox ${isDone ? 'task-checkbox-on' : 'task-checkbox-off'} shrink-0`}
            onClick={() => onToggleDone(task, !isDone)}
            tabIndex={-1}
            aria-label="Toggle done"
          >
            {isDone && (
              <svg className="w-3 h-3" strokeWidth={3} stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          <div className="flex-1 min-w-0 flex items-center gap-1 whitespace-nowrap overflow-hidden">
            {ancestors && ancestors.length > 0 && (
              <>
                {ancestors.map((ancestor, i) => (
                  <React.Fragment key={ancestor.id}>
                    {i > 0 && <span className="text-slate-300 dark:text-neutral-600 text-xs">&lt;</span>}
                    <button
                      type="button"
                      onClick={() => onOpenDetail(ancestor.id)}
                      className="text-sm text-slate-500 dark:text-neutral-300 hover:text-brand-600 hover:underline truncate max-w-[150px]"
                      title={ancestor.title}
                    >
                      {ancestor.title}
                    </button>
                  </React.Fragment>
                ))}
                <span className="text-slate-300 dark:text-neutral-600 text-xs">&lt;</span>
              </>
            )}
            <button
              type="button"
              onClick={() => onOpenDetail(task.id)}
              className={`text-sm text-left truncate font-medium transition hover:text-brand-600 hover:underline ${
                isDone ? 'line-through text-slate-400 dark:text-neutral-500' : isHidden ? 'text-slate-400 dark:text-neutral-400' : 'text-slate-800 dark:text-neutral-100'
              }`}
              title={task.title}
            >
              {task.title}
            </button>
          </div>

          {childCount > 0 && (
            <span className="shrink-0 ml-1 text-xs text-slate-400 dark:text-neutral-400 font-normal">{doneChildCount}/{childCount}</span>
          )}

          <button
            type="button"
            onClick={() => onAddSubtask(task.id, task.project_id)}
            className="shrink-0 ml-2 opacity-0 group-hover:opacity-100 text-slate-400 dark:text-neutral-400 hover:text-brand-500 transition"
            title="Add subtask"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

        </div>
      </td>

      {colOrder.map((key) => {
        if (!visibleCols[key]) return null;
        switch (key) {
          case 'status':
            return (
              <td key="status" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <PillSelect
                  value={task.status_id}
                  options={statuses.map((s) => ({ value: s.id, label: s.name, color: s.color || '#94a3b8' }))}
                  onChange={(val) => { if (val) updateTaskStatus(task.id, val); }}
                />
              </td>
            );
          case 'project':
            return (
              <td key="project" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                {task.parent_id ? (
                  <span className="text-xs text-slate-400 dark:text-neutral-400 italic">
                    {projects.find((p) => p.id === task.project_id)?.name ?? '—'}
                  </span>
                ) : (
                  <PillSelect
                    value={task.project_id ?? null}
                    options={projects.map((p) => ({ value: p.id, label: p.name, color: p.color || '#94a3b8', icon: p.icon, icon_type: p.icon_type, icon_color: p.icon_color }))}
                    onChange={(val) => updateTaskProject(task.id, val)}
                    nullable
                    placeholder="—"
                  />
                )}
              </td>
            );
          case 'priority':
            return (
              <td key="priority" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <PillSelect
                  value={task.priority ?? null}
                  options={PRIORITY_OPTIONS}
                  onChange={(val) => updateTask(task.id, { priority: val })}
                  nullable
                  placeholder="—"
                />
              </td>
            );
          case 'visible':
            return (
              <td key="visible" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70 text-center">
                <button
                  type="button"
                  onClick={() => toggleVisible(task.id)}
                  className={`p-1 rounded transition ${
                    isHidden
                      ? 'text-slate-300 dark:text-neutral-500 hover:text-slate-500 dark:hover:text-neutral-300'
                      : 'text-brand-400 hover:text-brand-600'
                  }`}
                  title={isHidden ? 'Show task' : 'Hide task'}
                >
                  {isHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </td>
            );
          case 'estimate':
            return (
              <td key="estimate" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <span className="text-xs text-neutral-500 dark:text-neutral-300 whitespace-nowrap font-mono">
                  {task.estimate != null ? formatEstimate(task.estimate) : '—'}
                </span>
              </td>
            );
          case 'time_spent':
            return (
              <td key="time_spent" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <span className="text-xs text-brand-500/85 dark:text-brand-300/85 whitespace-nowrap font-mono">
                  {totalTimeSec > 0 ? formatDurationCompact(totalTimeSec) : '—'}
                </span>
              </td>
            );
          case 'due_date':
            return (
              <td key="due_date" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <span className="text-xs text-neutral-500 dark:text-neutral-300 whitespace-nowrap">
                  {task.due_date
                    ? new Date(task.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </span>
              </td>
            );
          case 'created':
            return (
              <td key="created" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <span className="text-xs text-neutral-400 dark:text-neutral-400 whitespace-nowrap">
                  {new Date(task.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </td>
            );
          case 'updated':
            return (
              <td key="updated" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <span className="text-xs text-neutral-400 dark:text-neutral-400 whitespace-nowrap">
                  {new Date(task.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </td>
            );
          case 'actions':
            return (
              <td key="actions" className="px-3 py-2 border-b border-neutral-100 dark:border-neutral-600/70">
                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition">
                  <button
                    type="button"
                    onClick={() => onStartStop(task)}
                    className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition ${isTimerActive ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50' : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700'}`}
                  >
                    {isTimerActive ? <><Square className="w-3 h-3 fill-current" /> Stop</> : <><Play className="w-3 h-3" /> Start</>}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteRequest(task)}
                    className="text-xs p-1 rounded text-slate-400 dark:text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </td>
            );
          default:
            return null;
        }
      })}
    </tr>
  );
};
