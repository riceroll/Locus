import { type Task } from '../../../store/useTaskStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useStatusStore } from '../../../store/useStatusStore';
import { ChevronRight, AlertCircle, Calendar, Plus, Check, Play, Square } from 'lucide-react';
import { useTimerStore } from '../../../store/useTimerStore';
import { useTaskStore } from '../../../store/useTaskStore';

function format(date: Date, _fmt: string) { return date.toLocaleDateString(); }

interface TreeCardProps {
  task: Task;
  hasChildren: boolean;
  isCollapsed: boolean;
  isRoot?: boolean;
  dragAttributes?: any;
  dragListeners?: any;
}

export const TreeCard = ({ task, hasChildren, isCollapsed, isRoot = false, dragAttributes, dragListeners }: TreeCardProps) => {
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const { updateTask, addTask, updateTaskStatus } = useTaskStore();
  const { activeTaskId, isRunning, startTimer, stopTimer } = useTimerStore();
  const isActive = isRunning && activeTaskId === task.id;

  const project = projects.find(p => p.id === task.project_id);
  const status = statuses.find(s => s.id === task.status_id);
  const color = project?.color || '#94a3b8';
  const doneStatus = statuses.find((s) => Number(s.is_done) === 1);
  const isDone = status?.is_done === 1;

  const toggleCollapse = () => {
    updateTask(task.id, { collapsed: isCollapsed ? 0 : 1 });
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    addTask('New Task', undefined, task.id);
    if (isCollapsed) {
      updateTask(task.id, { collapsed: 0 });
    }
  };

  return (
    <div 
      {...dragAttributes}
      {...dragListeners}
      data-tree-card="true"
      data-task-id={task.id}
      className={`relative w-[280px] bg-white dark:bg-neutral-800 rounded-lg shadow-sm border cursor-grab ${
        isDone ? 'border-neutral-200 dark:border-neutral-700 opacity-60' : 'border-neutral-300 dark:border-neutral-600'
      } flex flex-col p-3 transition-all hover:shadow-md hover:border-brand-400 group z-10 shrink-0`}
      style={{ zIndex: 10 }}
    >
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          className={`task-checkbox mt-0.5 ${isDone ? 'task-checkbox-on' : 'task-checkbox-off'}`}
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
        <div className="flex-1 min-w-0 flex flex-col">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              window.dispatchEvent(new CustomEvent('open-task-detail', { detail: { taskId: task.id } }));
            }}
            className={`text-sm font-semibold line-clamp-3 leading-tight break-words text-left hover:text-brand-600 hover:underline transition ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-100'}`}
          >
            {task.title}
          </button>
          
          <div className="flex items-center gap-2 mt-auto break-words w-full">
            {project && (
              <span 
                className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                style={{ backgroundColor: color + '20', color }}
              >
                {project.name}
              </span>
            )}
            {task.priority === 'urgent' && (
              <span className="inline-flex items-center text-red-500 gap-0.5">
                <AlertCircle className="w-3 h-3" />
                <span className="text-[10px] font-medium leading-none uppercase">Urgent</span>
              </span>
            )}
            {task.due_date && (
              <span className="inline-flex items-center text-orange-500 gap-0.5">
                <Calendar className="w-3 h-3" />
                <span className="text-[10px] font-medium leading-none">{format(new Date(task.due_date), 'MMM d')}</span>
              </span>
            )}
            {status && (
              <span className="text-[10px] text-neutral-500 dark:text-neutral-400 ml-auto whitespace-nowrap overflow-hidden text-ellipsis">
                {status.name}
              </span>
            )}
          </div>
        </div>
        
        <div className="flex flex-col items-center gap-1 shrink-0 self-stretch justify-center">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className={`shrink-0 btn-icon w-6 h-6 flex items-center justify-center ${
              isActive
                ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30'
            }`}
            title={isActive ? 'Stop timer' : 'Start timer'}
            onClick={(e) => { e.stopPropagation(); isActive ? stopTimer() : startTimer(task.id, task.title); }}
          >
            {isActive ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>
          {!hasChildren && (
            <button
              type="button"
              onClick={handleAddChild}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
              title="Add Child Task"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {hasChildren && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              className={`flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400 focus:outline-none transition-opacity ${isRoot ? 'opacity-0 group-hover:opacity-100' : ''}`}
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${!isCollapsed ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
