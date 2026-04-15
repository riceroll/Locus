import { Play, Square, Check } from 'lucide-react';
import { useTimerStore } from '../../../store/useTimerStore';
import { useTaskStore, type Task } from '../../../store/useTaskStore';
import { useStatusStore } from '../../../store/useStatusStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { t } from '../../../i18n';
import { formatEstimate } from '../../../lib/utils';

const PRIORITY_COLOR: Record<string, string> = {
  urgent: '#ef4444',
  high:   '#f97316',
  medium: '#f59e0b',
  low:    '#94a3b8',
};
interface Props {
  task: Task;
  statusName: string;
  statusColor: string | null;
  dragRef?: (el: HTMLElement | null) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: any;
  isDragging?: boolean;
  onClick?: (taskId: string) => void;
}

export const TaskCard = ({
  task,
  dragRef,
  dragAttributes,
  dragListeners,
  isDragging = false,
  onClick,
}: Props) => {
  const { activeTaskId, isRunning, startTimer, stopTimer } = useTimerStore();
  const { updateTaskStatus } = useTaskStore();
  const { statuses } = useStatusStore();
  const { projects } = useProjectStore();
  const { language } = useSettingsStore();
  const running = isRunning && activeTaskId === task.id;

  const doneStatus = statuses.find((s) => Number(s.is_done) === 1);
  const isDone = doneStatus ? task.status_id === doneStatus.id : false;

  const project = projects.find((p) => p.id === task.project_id);
  const projectColor = project?.color || '#94a3b8';
  const priorityColor = task.priority ? PRIORITY_COLOR[task.priority] : null;
  const priorityLabel = task.priority
    ? t(language, task.priority === 'urgent'
      ? 'priority_urgent'
      : task.priority === 'high'
        ? 'priority_high'
        : task.priority === 'medium'
          ? 'priority_medium'
          : 'priority_low')
    : null;

  return (
    <div
      ref={dragRef as any}
      {...(dragAttributes as any)}
      {...(dragListeners as any)}
      className={`card flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing select-none touch-none ${
        isDragging ? 'opacity-40 shadow-lg' : 'card-hover'
      }`}
      onClick={() => onClick?.(task.id)}
    >
      {/* Checkbox */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        className={`task-checkbox ${isDone ? 'task-checkbox-on' : 'task-checkbox-off'}`}
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
        <div className={`text-xs font-medium leading-snug truncate ${isDone ? 'line-through text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-neutral-200'}`}>
          {task.title}
        </div>
        {(project || task.estimate != null || priorityColor) && (
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            {project && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                style={{ backgroundColor: projectColor + '22', color: projectColor }}
              >
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: projectColor }} />
                {project.name}
              </span>
            )}
            {task.estimate != null && (
              <span className="text-[11px] text-slate-400 dark:text-neutral-500 font-mono">
                {formatEstimate(task.estimate)}
              </span>
            )}
            {priorityColor && (
              <span
                className="inline-flex items-center gap-0.5 text-[11px] font-medium ml-auto"
                style={{ color: priorityColor }}
              >
                <span className="font-bold">!</span>{priorityLabel}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Play/Stop — round icon-only button on right */}
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        className={`shrink-0 btn-icon ${running ? 'bg-red-50 text-red-500' : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-brand-600 hover:bg-brand-50'}`}
        title={running ? t(language, 'tooltip_stop_timer') : t(language, 'tooltip_start_timer')}
        onClick={async (e) => {
          e.stopPropagation();
          if (running) {
            await stopTimer();
          } else {
            await startTimer(task.id, task.title);
          }
        }}
      >
        {running ? <Square className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5 mt-px" />}
      </button>
    </div>
  );
};
