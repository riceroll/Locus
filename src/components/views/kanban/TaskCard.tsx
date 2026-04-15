import { Check, Play, Square, Eye, EyeOff } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore, type Task } from '../../../store/useTaskStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useStatusStore } from '../../../store/useStatusStore';
import { useTimerStore } from '../../../store/useTimerStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { formatDurationCompact, formatEstimate } from '../../../lib/utils';
import { DropLine } from './kanbanUtils';
import type { Project } from '../../../store/useProjectStore';

// Renders the project icon: emoji, lucide, or colored circle (default)
function ProjectPillIcon({ project }: { project: Project }) {
  const c = project.icon_color || project.color || '#94a3b8';
  if (project.icon_type === 'emoji' && project.icon) {
    return <span className="text-[10px]" style={{ lineHeight: 1 }}>{project.icon}</span>;
  }
  if (project.icon_type === 'lucide' && project.icon) {
    const LIcon = (LucideIcons as unknown as Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>>)[project.icon];
    if (LIcon) return <LIcon className="w-2.5 h-2.5" style={{ color: c, flexShrink: 0 }} />;
  }
  return <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c }} />;
}

export const SortableTaskCard = ({
  task,
  isOverlay,
  onOpenDetail,
  childCount = 0,
  doneChildCount = 0,
  totalTimeSec = 0,
}: {
  task: Task;
  isOverlay?: boolean;
  onOpenDetail?: (id: string) => void;
  childCount?: number;
  doneChildCount?: number;
  totalTimeSec?: number;
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    isDragging,
    isOver,
  } = useSortable({
    id: task.id,
    data: { type: 'task', status_id: task.status_id },
  });
  const { isRunning, activeTaskId, startTimer, stopTimer } = useTimerStore();
  const { showKanbanEstimate, showKanbanTimeSpent } = useSettingsStore();
  const { updateTaskStatus, toggleVisible, tasks } = useTaskStore();
  const parentTask = task.parent_id ? tasks.find(t => t.id === task.parent_id) : null;
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const isActive = isRunning && activeTaskId === task.id;
  const project = projects.find((p) => p.id === task.project_id);
  const projectColor = project?.color || '#94a3b8';
  const isHidden = !task.visible;

  const PRIORITY_COLORS: Record<string, string> = {
    urgent: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#94a3b8',
  };
  const priorityColor = task.priority ? PRIORITY_COLORS[task.priority] : null;

  const doneStatus = statuses.find((s) => Number(s.is_done) === 1);
  const isDone = doneStatus ? task.status_id === doneStatus.id : false;

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: 'none',
    opacity: isDragging ? 0 : 1,
  };

  if (isOverlay) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border-2 border-brand-400 shadow-xl dark:shadow-neutral-900/20 p-3 w-[272px] rotate-1">
        <p className="text-sm font-medium text-slate-800 dark:text-neutral-200">{task.title}</p>
        {project && (
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium mt-1"
            style={{ backgroundColor: projectColor + '22', color: projectColor }}
          >
            <ProjectPillIcon project={project} />
            {project.name}
          </span>
        )}
      </div>
    );
  }

  return (
    <>
      <DropLine active={isOver} />
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={style}
        className="group card card-hover cursor-grab active:cursor-grabbing touch-none"
      >
        <div className="flex items-center gap-2 p-3">
          {/* Checkbox */}
          <button
            type="button"
            className={`task-checkbox ${isDone ? 'task-checkbox-on' : 'task-checkbox-off'}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={async (e) => {
              e.stopPropagation();
              if (!doneStatus) return;
              if (isDone) {
                const defaultStatus =
                  statuses.find((s) => Number(s.is_default) === 1 && Number(s.is_done) !== 1) ||
                  statuses.find((s) => Number(s.is_done) !== 1);
                if (defaultStatus) await updateTaskStatus(task.id, defaultStatus.id);
              } else {
                await updateTaskStatus(task.id, doneStatus.id);
              }
            }}
          >
            {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => { e.stopPropagation(); onOpenDetail?.(task.id); }}
                className={`text-sm font-medium text-left hover:text-brand-600 hover:underline transition ${
                  isDone ? 'line-through text-slate-400 dark:text-neutral-500' : isHidden ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-neutral-200'
                }`}
              >
                {task.title}
              </button>
              {parentTask && (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.dispatchEvent(new CustomEvent('open-task-detail', { detail: { taskId: parentTask.id } }));
                  }}
                  className="text-[11px] font-medium text-slate-400 dark:text-neutral-500 hover:text-brand-500 hover:underline inline-flex items-center gap-1 transition"
                >
                  {'<'} {parentTask.title}
                </button>
              )}
            </div>
            {/* Project pill + estimate + priority */}
            {(project || (showKanbanEstimate && task.estimate != null) || (showKanbanTimeSpent && totalTimeSec > 0) || priorityColor) && (
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {project && (
                  <span
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                    style={{ backgroundColor: projectColor + '22', color: projectColor }}
                  >
                    <ProjectPillIcon project={project} />
                    {project.name}
                  </span>
                )}
                {showKanbanEstimate && task.estimate != null && (
                  <span className="text-[11px] text-slate-400 dark:text-neutral-500 font-mono">{formatEstimate(task.estimate)}</span>
                )}
                {showKanbanTimeSpent && totalTimeSec > 0 && (
                  <span className="text-[11px] text-brand-500/80 dark:text-brand-300/80 font-mono">{formatDurationCompact(totalTimeSec)}</span>
                )}
                {priorityColor && (
                  <span
                    className="ml-auto text-[13px] font-black leading-none"
                    style={{ color: priorityColor }}
                    title={`${task.priority?.[0]?.toUpperCase()}${task.priority?.slice(1)} priority`}
                  >
                    !
                  </span>
                )}
              </div>
            )}
            {childCount > 0 && (
              <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 dark:text-neutral-500">
                <span className={`inline-block w-2 h-2 rounded-full ${
                  doneChildCount === childCount ? 'bg-green-400' : 'bg-slate-300 dark:bg-neutral-600'
                }`} />
                {doneChildCount}/{childCount} subtasks
              </div>
            )}
          </div>

          {/* Visibility toggle */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className={`shrink-0 p-1 rounded transition-colors ${
              isHidden
                ? 'text-slate-300 dark:text-neutral-600 hover:text-slate-500 dark:hover:text-neutral-400'
                : 'text-slate-400 dark:text-neutral-500 hover:text-brand-500 opacity-0 group-hover:opacity-100'
            }`}
            title={isHidden ? 'Show task' : 'Hide task'}
            onClick={(e) => { e.stopPropagation(); toggleVisible(task.id); }}
          >
            {isHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Play/Stop */}
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className={`shrink-0 btn-icon min-w-[28px] min-h-[28px] flex items-center justify-center ${
              isActive
                ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30'
            }`}
            title={isActive ? 'Stop timer' : 'Start timer'}
            onClick={(e) => { e.stopPropagation(); isActive ? stopTimer() : startTimer(task.id, task.title); }}
          >
            {isActive ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
        </div>
      </div>
    </>
  );
};
