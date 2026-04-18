import { type Task } from '../../../store/useTaskStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useStatusStore } from '../../../store/useStatusStore';
import { ChevronRight, AlertCircle, Calendar, Plus } from 'lucide-react';
import { useTaskStore } from '../../../store/useTaskStore';

function format(date: Date, _fmt: string) { return date.toLocaleDateString(); }

interface TreeCardProps {
  task: Task;
  hasChildren: boolean;
  isCollapsed: boolean;
  dragAttributes?: any;
  dragListeners?: any;
}

export const TreeCard = ({ task, hasChildren, isCollapsed, dragAttributes, dragListeners }: TreeCardProps) => {
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const { updateTask, addTask } = useTaskStore();

  const project = projects.find(p => p.id === task.project_id);
  const status = statuses.find(s => s.id === task.status_id);
  const color = project?.color || '#94a3b8';
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
      <div className="flex items-start gap-2">
        <div 
          className="w-3.5 h-3.5 mt-0.5 rounded-full shrink-0 border-[2px]"
          style={{ borderColor: status?.color || color, backgroundColor: isDone ? status?.color || color : 'transparent' }}
        />
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-semibold truncate leading-tight ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-100'}`}>
            {task.title}
          </h3>
          
          <div className="flex items-center gap-2 mt-2 break-words">
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
        
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleAddChild}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"
            title="Add Child Task"
          >
            <Plus className="w-4 h-4" />
          </button>
          {hasChildren && (
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleCollapse();
              }}
              className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-neutral-700 text-slate-400 focus:outline-none"
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${!isCollapsed ? 'rotate-90' : ''}`} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
