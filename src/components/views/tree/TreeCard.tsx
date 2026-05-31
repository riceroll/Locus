import { type Task } from '../../../store/useTaskStore';
import { useTaskStore } from '../../../store/useTaskStore';
import { ChevronRight, Plus } from 'lucide-react';
import { TaskCardCore } from '../shared/TaskCardCore';

interface TreeCardProps {
  task: Task;
  hasChildren: boolean;
  isCollapsed: boolean;
  isGhost?: boolean;
  isRoot?: boolean;
  dragAttributes?: any;
  dragListeners?: any;
}

export const TreeCard = ({ task, hasChildren, isCollapsed, isGhost = false, isRoot = false, dragAttributes, dragListeners }: TreeCardProps) => {
  const { updateTask, addTask } = useTaskStore();

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
      data-tree-root={isRoot ? 'true' : 'false'}
      data-task-id={task.id}
      className={`group relative w-[280px] shrink-0 overflow-visible cursor-grab active:cursor-grabbing touch-none ${isGhost ? 'opacity-50' : ''}`}
      style={{ zIndex: 10 }}
    >
      <div className="relative overflow-visible">
        <div className="card card-hover cursor-grab active:cursor-grabbing touch-none overflow-visible">
          <TaskCardCore
            task={task}
            showSubtasks={false}
          />
        </div>
        <div className="pointer-events-none absolute top-1/2 right-[-20px] -translate-y-1/2 z-20 opacity-0 transition-opacity group-hover:opacity-100">
          <div className="pointer-events-auto flex flex-col overflow-hidden rounded-r-full border border-l-0 border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={handleAddChild}
              className="flex h-6 w-5 items-center justify-center text-slate-400 hover:bg-slate-50 dark:text-neutral-500 dark:hover:bg-neutral-700 hover:text-brand-500 transition-colors"
              title="Add Child Task"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
            {hasChildren && (
              <button 
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCollapse();
                }}
                className="flex h-6 w-5 items-center justify-center border-t border-neutral-200 text-slate-400 hover:bg-slate-50 dark:border-neutral-700 dark:text-neutral-500 dark:hover:bg-neutral-700 hover:text-brand-500 transition-colors"
                title={isCollapsed ? 'Expand' : 'Collapse'}
              >
                <ChevronRight className={`w-3.5 h-3.5 transition-transform duration-200 ${!isCollapsed ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
