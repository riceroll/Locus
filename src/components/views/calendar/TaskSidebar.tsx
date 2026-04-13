import { useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, SortAsc, SortDesc } from 'lucide-react';
import { TaskCard } from './TaskCard';
import { useTaskStore, type Task } from '../../../store/useTaskStore';
import { useStatusStore } from '../../../store/useStatusStore';
import { useProjectStore } from '../../../store/useProjectStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useViewStore, type SavedView } from '../../../store/useViewStore';
import { applyTaskFilters } from '../../../lib/taskFilters';
import { t } from '../../../i18n';

type SortField = 'title' | 'priority' | 'status' | 'due_date' | 'created_at';

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0, high: 1, medium: 2, low: 3,
};

function sortTasks(tasks: Task[], field: SortField, dir: 'asc' | 'desc'): Task[] {
  const mult = dir === 'asc' ? 1 : -1;
  return [...tasks].sort((a, b) => {
    let cmp = 0;
    if (field === 'title') cmp = a.title.localeCompare(b.title);
    else if (field === 'priority') {
      const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 99;
      const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 99;
      cmp = pa - pb;
    } else if (field === 'status') cmp = a.status.localeCompare(b.status);
    else if (field === 'due_date') cmp = (a.due_date ?? Infinity) - (b.due_date ?? Infinity);
    else if (field === 'created_at') cmp = a.created_at - b.created_at;
    return cmp * mult;
  });
}

interface DraggableTaskCardProps {
  task: Task;
  statusName: string;
  statusColor: string | null;
  onClick: (taskId: string) => void;
}

const DraggableCard = ({ task, statusName, statusColor, onClick }: DraggableTaskCardProps) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `sidebar-task:${task.id}`,
    data: { taskId: task.id, type: 'sidebar-task' },
  });

  return (
    <TaskCard
      task={task}
      statusName={statusName}
      statusColor={statusColor}
      dragRef={setNodeRef}
      dragAttributes={attributes}
      dragListeners={listeners}
      isDragging={isDragging}
      onClick={onClick}
    />
  );
};

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onTaskClick: (taskId: string) => void;
}

export const TaskSidebar = ({ collapsed, onToggleCollapsed, onTaskClick }: Props) => {
  const { tasks } = useTaskStore();
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const { views } = useViewStore();
  const { language } = useSettingsStore();

  const [sidebarViewId, setSidebarViewId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const selectedView: SavedView | undefined = views.find((v) => v.id === sidebarViewId);

  const displayed = useMemo(() => {
    let list = tasks;
    // Apply saved view filters
    if (selectedView) {
      list = applyTaskFilters(list, selectedView.filters, { projects });
    }
    // Only top-level tasks (no parent) to keep sidebar clean, unless filtered
    if (!selectedView) {
      list = list.filter((t) => t.parent_id === null);
    }
    return sortTasks(list, sortField, sortDir);
  }, [tasks, selectedView, sortField, sortDir, projects]);

  const statusById = useMemo(() => {
    const m = new Map<string, { name: string; color: string | null }>();
    statuses.forEach((s) => m.set(s.id, { name: s.name, color: s.color }));
    return m;
  }, [statuses]);

  const SORT_OPTIONS: { value: SortField; label: string }[] = [
    { value: 'created_at', label: t(language, 'sort_option_created') },
    { value: 'title', label: t(language, 'sort_option_title') },
    { value: 'priority', label: t(language, 'sort_option_priority') },
    { value: 'status', label: t(language, 'sort_option_status') },
    { value: 'due_date', label: t(language, 'sort_option_due_date') },
  ];

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 w-9 shrink-0 bg-white dark:bg-neutral-800 border-l border-neutral-200 dark:border-neutral-700/50">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="btn-ghost"
          title={t(language, 'tooltip_expand_task_list')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col w-72 shrink-0 bg-white dark:bg-neutral-800 border-l border-neutral-200 dark:border-neutral-700/50 min-h-0">
      {/* Sidebar header */}
      <div className="shrink-0 px-4 py-3 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{t(language, 'sidebar_tasks_header')}</span>
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1 rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 dark:text-neutral-500 dark:hover:text-neutral-200 dark:hover:bg-neutral-600 transition"
          title={t(language, 'tooltip_collapse')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Toolbar: View selector & Sorting */}
      <div className="shrink-0 px-3 py-2 flex items-center justify-between border-b border-neutral-100 dark:border-neutral-700/50">
        <select
          value={sidebarViewId ?? ''}
          onChange={(e) => setSidebarViewId(e.target.value || null)}
          className="text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-600 px-2 py-1.5 rounded cursor-pointer outline-none appearance-none focus:ring-1 focus:ring-brand-300"
        >
          <option value="">{t(language, 'option_all_tasks')}</option>
          {views.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <div className="relative group/sort">
          <button
            type="button"
            className="p-1.5 rounded text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:text-neutral-100 dark:hover:bg-neutral-600 transition"
          >
            {sortDir === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </button>
          
          {/* Dropdown for sorting options on hover/focus */}
          <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg p-1.5 opacity-0 invisible group-hover/sort:opacity-100 group-hover/sort:visible transition-all z-50">
            <p className="px-2 py-1 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1">{t(language, 'sort_by_label')}</p>
            {SORT_OPTIONS.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  if (sortField === o.value) {
                    setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                  } else {
                    setSortField(o.value);
                    setSortDir('asc');
                  }
                }}
                className={`w-full text-left text-xs px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-600 transition ${
                  sortField === o.value ? 'bg-brand-50 text-brand-700 font-medium' : 'text-neutral-700 dark:text-neutral-200'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Task list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0 bg-slate-50 dark:bg-neutral-900">
        {displayed.length === 0 && (
          <div className="text-xs text-slate-400 dark:text-neutral-500 text-center py-8">{t(language, 'empty_tasks_sidebar')}</div>
        )}
        {displayed.map((task) => {
          const st = statusById.get(task.status_id);
          return (
            <DraggableCard
              key={task.id}
              task={task}
              statusName={st?.name ?? '—'}
              statusColor={st?.color ?? null}
              onClick={onTaskClick}
            />
          );
        })}
      </div>
    </div>
  );
};
