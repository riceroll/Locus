import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, Play, Square, Eye, EyeOff, Clock3, Flag } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { useProjectStore } from '../../../store/useProjectStore';
import { useStatusStore } from '../../../store/useStatusStore';
import { useTaskStore, type Task } from '../../../store/useTaskStore';
import { useTimerStore } from '../../../store/useTimerStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { formatDurationCompact } from '../../../lib/utils';
import { PillSelect } from '../../ui/PillSelect';
import { EstimatePicker } from '../../ui/EstimatePicker';
import type { Project } from '../../../store/useProjectStore';

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

interface TaskCardCoreProps {
  task: Task;
  isOverlay?: boolean;
  onOpenDetail?: (id: string) => void;
  childCount?: number;
  doneChildCount?: number;
  totalTimeSec?: number;
  showSubtasks?: boolean;
}

export const TaskCardCore = ({
  task,
  isOverlay,
  onOpenDetail,
  childCount = 0,
  doneChildCount = 0,
  totalTimeSec = 0,
  showSubtasks = true,
}: TaskCardCoreProps) => {
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const { updateTaskStatus, updateTask, toggleVisible, tasks } = useTaskStore();
  const { isRunning, activeTaskId, startTimer, stopTimer, addManualEntry } = useTimerStore();
  const { showKanbanEstimate, showKanbanSubtasks, enableVisibilityFeature } = useSettingsStore();
  const [showSpentMenu, setShowSpentMenu] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [priorityMenuPos, setPriorityMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const spentMenuRef = useRef<HTMLDivElement | null>(null);
  const priorityMenuRef = useRef<HTMLDivElement | null>(null);
  const priorityButtonRef = useRef<HTMLButtonElement | null>(null);
  const tagMeasureRef = useRef<HTMLDivElement | null>(null);
  const [useSingleTagRow, setUseSingleTagRow] = useState(true);

  const parentTask = task.parent_id ? tasks.find((t) => t.id === task.parent_id) : null;
  const isActive = isRunning && activeTaskId === task.id;
  const project = projects.find((p) => p.id === task.project_id);
  const projectColor = project?.color || '#94a3b8';
  const isHidden = !task.visible;
  const currentStatus = statuses.find((s) => s.id === task.status_id);

  const doneStatus = statuses.find((s) => Number(s.is_done) === 1);
  const isDone = doneStatus ? task.status_id === doneStatus.id : false;

  useEffect(() => {
    if (!showSpentMenu && !showPriorityMenu) return;
    const onPointerDown = (e: PointerEvent) => {
      if (showSpentMenu && !spentMenuRef.current?.contains(e.target as Node)) {
        setShowSpentMenu(false);
      }
      if (showPriorityMenu && !priorityMenuRef.current?.contains(e.target as Node)) {
        setShowPriorityMenu(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [showSpentMenu, showPriorityMenu]);

  useEffect(() => {
    if (!showPriorityMenu) return;

    const updatePriorityMenuPosition = () => {
      const btn = priorityButtonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      setPriorityMenuPos({
        top: rect.bottom + 4,
        left: rect.right,
      });
    };

    updatePriorityMenuPosition();
    window.addEventListener('resize', updatePriorityMenuPosition);
    window.addEventListener('scroll', updatePriorityMenuPosition, true);
    return () => {
      window.removeEventListener('resize', updatePriorityMenuPosition);
      window.removeEventListener('scroll', updatePriorityMenuPosition, true);
    };
  }, [showPriorityMenu]);

  useLayoutEffect(() => {
    const row = tagMeasureRef.current;
    if (!row) return;
    const shouldSingle = row.scrollWidth <= row.clientWidth + 1;
    if (shouldSingle !== useSingleTagRow) {
      setUseSingleTagRow(shouldSingle);
    }
  }, [
    useSingleTagRow,
    task.id,
    task.project_id,
    task.status_id,
    task.priority,
    task.estimate,
    totalTimeSec,
    showKanbanEstimate,
  ]);

  const statusOptions = statuses.map((s) => ({
    value: s.id,
    label: s.name,
    color: s.color || '#94a3b8',
  }));

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: p.name,
    color: p.color || '#94a3b8',
    icon: p.icon,
    icon_type: p.icon_type,
    icon_color: p.icon_color,
  }));

  const priorityOptions = [
    { value: 'low', label: 'Low', color: '#94a3b8' },
    { value: 'medium', label: 'Medium', color: '#60a5fa' },
    { value: 'high', label: 'High', color: '#f59e0b' },
    { value: 'urgent', label: 'Urgent', color: '#ef4444' },
  ];
  const priorityColor = priorityOptions.find((p) => p.value === task.priority)?.color || '#94a3b8';

  if (isOverlay) {
    return (
      <div className="bg-white dark:bg-neutral-800 rounded-lg border-2 border-brand-400 shadow-xl dark:shadow-neutral-900/20 p-3 w-[272px]">
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
      <div className="flex items-center gap-2 p-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <button
              type="button"
              className={`task-checkbox shrink-0 ${isDone ? 'task-checkbox-on' : 'task-checkbox-off'}`}
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
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDetail) onOpenDetail(task.id);
                else window.dispatchEvent(new CustomEvent('open-task-detail', { detail: { taskId: task.id } }));
              }}
              className={`flex-1 min-w-0 truncate whitespace-nowrap text-sm font-medium text-left hover:text-brand-600 hover:underline transition ${
                isDone ? 'line-through text-slate-400 dark:text-neutral-500' : isHidden ? 'text-slate-400 dark:text-neutral-500' : 'text-slate-800 dark:text-neutral-200'
              }`}
              title={task.title}
            >
              {task.title}
            </button>
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

          {parentTask && (
            <div className="mt-0.5">
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
            </div>
          )}

          {(project || currentStatus || task.priority || (showKanbanEstimate && task.estimate != null) || totalTimeSec > 0) && (
            <div className="mt-1.5 flex items-start gap-2 min-w-0">
              <div className="flex-1 min-w-0">
                <div className="absolute pointer-events-none opacity-0 h-0 overflow-hidden min-w-0 w-full">
                  <div ref={tagMeasureRef} className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0">
                    {project && (
                      <div>
                        <PillSelect
                          value={task.project_id ?? null}
                          options={projectOptions}
                          onChange={() => undefined}
                          nullable
                          placeholder="—"
                          compact
                          showChevron={false}
                        />
                      </div>
                    )}
                    {currentStatus && (
                      <div>
                        <PillSelect
                          value={task.status_id}
                          options={statusOptions}
                          onChange={() => undefined}
                          compact
                          showChevron={false}
                          showIcon={false}
                        />
                      </div>
                    )}
                    {showKanbanEstimate && task.estimate != null && (
                      <div>
                        <EstimatePicker
                          value={task.estimate}
                          onChange={() => undefined}
                          compact
                        />
                      </div>
                    )}
                    {totalTimeSec > 0 && (
                      <div>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 text-brand-500/90 dark:text-brand-300/90"
                        >
                          <Clock3 className="w-2.5 h-2.5" />
                          {formatDurationCompact(totalTimeSec)}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {useSingleTagRow ? (
                  <div className="flex items-center gap-1 whitespace-nowrap overflow-hidden min-w-0">
                    {project && (
                      <div onPointerDown={(e) => e.stopPropagation()}>
                        <PillSelect
                          value={task.project_id ?? null}
                          options={projectOptions}
                          onChange={(val) => updateTask(task.id, { project_id: val })}
                          nullable
                          placeholder="—"
                          compact
                          showChevron={false}
                        />
                      </div>
                    )}
                    {currentStatus && (
                      <div onPointerDown={(e) => e.stopPropagation()}>
                        <PillSelect
                          value={task.status_id}
                          options={statusOptions}
                          onChange={(val) => { if (val) void updateTaskStatus(task.id, val); }}
                          compact
                          showChevron={false}
                          showIcon={false}
                        />
                      </div>
                    )}
                    {showKanbanEstimate && task.estimate != null && (
                      <div onPointerDown={(e) => e.stopPropagation()}>
                        <EstimatePicker
                          value={task.estimate}
                          onChange={(val) => updateTask(task.id, { estimate: val })}
                          compact
                        />
                      </div>
                    )}
                    {totalTimeSec > 0 && (
                      <div className="relative" ref={spentMenuRef} onPointerDown={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowSpentMenu((prev) => !prev);
                          }}
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 text-brand-500/90 dark:text-brand-300/90 hover:border-neutral-300 dark:hover:border-neutral-500 transition-colors"
                          title="Time Spent"
                        >
                          <Clock3 className="w-2.5 h-2.5" />
                          {formatDurationCompact(totalTimeSec)}
                        </button>
                        {showSpentMenu && (
                          <div className="absolute top-full left-0 mt-1 z-40 min-w-[150px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg p-1.5 space-y-1">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await addManualEntry(task.id, 15);
                                setShowSpentMenu(false);
                              }}
                              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              + 15m
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await addManualEntry(task.id, 30);
                                setShowSpentMenu(false);
                              }}
                              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              + 30m
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await addManualEntry(task.id, 60);
                                setShowSpentMenu(false);
                              }}
                              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              + 1h
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                window.dispatchEvent(new CustomEvent('open-task-detail', { detail: { taskId: task.id } }));
                                setShowSpentMenu(false);
                              }}
                              className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              Open details...
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {(project || currentStatus) && (
                      <div className="flex items-center gap-1 flex-wrap">
                        {project && (
                          <div onPointerDown={(e) => e.stopPropagation()}>
                            <PillSelect
                              value={task.project_id ?? null}
                              options={projectOptions}
                              onChange={(val) => updateTask(task.id, { project_id: val })}
                              nullable
                              placeholder="—"
                              compact
                              showChevron={false}
                            />
                          </div>
                        )}
                        {currentStatus && (
                          <div onPointerDown={(e) => e.stopPropagation()}>
                            <PillSelect
                              value={task.status_id}
                              options={statusOptions}
                              onChange={(val) => { if (val) void updateTaskStatus(task.id, val); }}
                              compact
                              showChevron={false}
                              showIcon={false}
                            />
                          </div>
                        )}
                      </div>
                    )}
                    {((showKanbanEstimate && task.estimate != null) || totalTimeSec > 0) && (
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {showKanbanEstimate && task.estimate != null && (
                          <div onPointerDown={(e) => e.stopPropagation()}>
                            <EstimatePicker
                              value={task.estimate}
                              onChange={(val) => updateTask(task.id, { estimate: val })}
                              compact
                            />
                          </div>
                        )}
                        {totalTimeSec > 0 && (
                          <div className="relative" ref={spentMenuRef} onPointerDown={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSpentMenu((prev) => !prev);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-medium border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 text-brand-500/90 dark:text-brand-300/90 hover:border-neutral-300 dark:hover:border-neutral-500 transition-colors"
                              title="Time Spent"
                            >
                              <Clock3 className="w-2.5 h-2.5" />
                              {formatDurationCompact(totalTimeSec)}
                            </button>
                            {showSpentMenu && (
                              <div className="absolute top-full left-0 mt-1 z-40 min-w-[150px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg p-1.5 space-y-1">
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await addManualEntry(task.id, 15);
                                    setShowSpentMenu(false);
                                  }}
                                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                >
                                  + 15m
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await addManualEntry(task.id, 30);
                                    setShowSpentMenu(false);
                                  }}
                                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                >
                                  + 30m
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await addManualEntry(task.id, 60);
                                    setShowSpentMenu(false);
                                  }}
                                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                >
                                  + 1h
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.dispatchEvent(new CustomEvent('open-task-detail', { detail: { taskId: task.id } }));
                                    setShowSpentMenu(false);
                                  }}
                                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                >
                                  Open details...
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {task.priority && (
                <div className="shrink-0 relative" ref={priorityMenuRef} onPointerDown={(e) => e.stopPropagation()}>
                  <button
                    ref={priorityButtonRef}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPriorityMenu((prev) => !prev);
                    }}
                    className="inline-flex items-center justify-center p-0.5 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition-colors"
                    title="Priority"
                  >
                    <Flag className="w-3 h-3 fill-current" style={{ color: priorityColor }} />
                  </button>
                  {showPriorityMenu && (
                    <div
                      className="fixed z-[120] min-w-[120px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg p-1"
                      style={{ top: `${priorityMenuPos.top}px`, left: `${priorityMenuPos.left}px`, transform: 'translateX(-100%)' }}
                    >
                      {priorityOptions.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await updateTask(task.id, { priority: opt.value as 'low' | 'medium' | 'high' | 'urgent' });
                            setShowPriorityMenu(false);
                          }}
                          className="w-full text-left text-xs px-2 py-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-1.5"
                        >
                          <Flag className="w-3 h-3 fill-current" style={{ color: opt.color }} />
                          <span>{opt.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showSubtasks && showKanbanSubtasks && childCount > 0 && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-slate-400 dark:text-neutral-500">
              <span className={`inline-block w-2 h-2 rounded-full ${doneChildCount === childCount ? 'bg-green-400' : 'bg-slate-300 dark:bg-neutral-600'}`} />
              {doneChildCount}/{childCount} subtasks
            </div>
          )}
        </div>

        {enableVisibilityFeature && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
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
        )}

      </div>
    </>
  );
};