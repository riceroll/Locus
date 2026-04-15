import { useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { Plus, Zap, Eye } from 'lucide-react';
import { applyTaskFilters } from '../../lib/taskFilters';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useTaskStore, type Task } from '../../store/useTaskStore';
import { useTimerStore } from '../../store/useTimerStore';
import { useViewStore } from '../../store/useViewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import { ViewControls } from '../layout/ViewControls';
import { TaskDetailModal } from './TaskDetailModal';
import { typedCollisionDetection } from './kanban/kanbanUtils';
import { SortableTaskCard } from './kanban/TaskCard';
import { Column } from './kanban/Column';
import { SortableColumnWrapper } from './kanban/ColumnWrapper';
import { Tooltip } from '../ui/Tooltip';

const KANBAN_COL_MIN_WIDTH = 200;
const KANBAN_COL_MAX_WIDTH = 600;

const ColumnEndDropZone = ({
  columnId,
  language,
  addingTitle,
  onStartAdding,
  onChangeAddingTitle,
  onConfirmAdding,
  onCancelAdding,
}: {
  columnId: string;
  language: 'en' | 'zh';
  addingTitle: string | null;
  onStartAdding: () => void;
  onChangeAddingTitle: (v: string) => void;
  onConfirmAdding: () => void;
  onCancelAdding: () => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-end:${columnId}`,
    data: { type: 'column-end', status_id: columnId },
  });

  return (
    <div
      ref={setNodeRef}
      className={`mt-1 rounded-md border transition-colors ${
        isOver
          ? 'border-brand-300 bg-brand-50/70 dark:bg-brand-900/30 dark:border-brand-600'
          : 'border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
      }`}
    >
      {addingTitle !== null ? (
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-sm px-2.5 py-2">
          <input
            autoFocus
            type="text"
            value={addingTitle}
            onChange={(e) => onChangeAddingTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void onConfirmAdding();
              if (e.key === 'Escape') onCancelAdding();
            }}
            placeholder={t(language, 'placeholder_task_name')}
            className="w-full text-sm bg-transparent text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onClick={onConfirmAdding}
              className="text-xs px-2.5 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 transition"
            >
              {t(language, 'add')}
            </button>
            <button
              type="button"
              onClick={onCancelAdding}
              className="text-xs px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
            >
              {t(language, 'cancel')}
            </button>
          </div>
        </div>
      ) : (
        isOver ? (
          <div className="w-full h-8" />
        ) : (
          <button
            type="button"
            onClick={onStartAdding}
            className="w-full h-8 inline-flex items-center justify-start px-2 text-xs text-neutral-400 dark:text-neutral-500 hover:text-brand-600 transition"
          >
            + {t(language, 'btn_add_task')}
          </button>
        )
      )}
    </div>
  );
};

export const KanbanView = () => {
  const { tasks, fetchTasks, addTask, batchUpdatePositions, moveTaskToColumn } = useTaskStore();
  const { getAllEntries, isRunning, activeTaskId, elapsed } = useTimerStore();
  const { activeFilters, setFilters } = useViewStore();
  const { language } = useSettingsStore();
  const {
    statuses,
    fetchStatuses,
    addStatus,
    renameStatus,
    removeStatus,
    setDefaultStatus,
    reorderStatuses,
    updateStatusColor,
  } = useStatusStore();
  const { projects, fetchProjects } = useProjectStore();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'task' | 'column' | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [newColumnName, setNewColumnName] = useState('');
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  // columnId → title being typed (null = button visible, '' = input active)
  const [addingInCol, setAddingInCol] = useState<Record<string, string | null>>({});
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [colWidths, setColWidths] = useState<Record<string, number>>({});
  const [collapsedCols, setCollapsedCols] = useState<Record<string, boolean>>({});
  const [taskTimeTotals, setTaskTimeTotals] = useState<Record<string, number>>({});
  const colResizingId = useRef<string | null>(null);
  const colResizeStartX = useRef(0);
  const colResizeStartW = useRef(0);
  const getColWidth = (id: string) => colWidths[id] ?? 320;
  const startColResize = (colId: string, e: React.MouseEvent) => {
    e.preventDefault();
    colResizingId.current = colId;
    colResizeStartX.current = e.clientX;
    colResizeStartW.current = getColWidth(colId);
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - colResizeStartX.current;
      setColWidths((prev) => ({
        ...prev,
        [colResizingId.current!]: Math.max(KANBAN_COL_MIN_WIDTH, Math.min(KANBAN_COL_MAX_WIDTH, colResizeStartW.current + delta)),
      }));
    };
    const onUp = () => {
      colResizingId.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  useEffect(() => {
    const handler = (e: Event) => {
      const { taskId } = (e as CustomEvent<{ taskId: string }>).detail;
      setActiveDetailId(taskId);
    };
    window.addEventListener('open-task-detail', handler);
    return () => window.removeEventListener('open-task-detail', handler);
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchStatuses();
    fetchProjects();
  }, []);

  useEffect(() => {
    const loadTimeTotals = async () => {
      const entries = await getAllEntries();
      const totals: Record<string, number> = {};
      for (const entry of entries) {
        if (entry.duration == null) continue;
        totals[entry.task_id] = (totals[entry.task_id] ?? 0) + entry.duration;
      }
      setTaskTimeTotals(totals);
    };

    void loadTimeTotals();

    const handle = () => { void loadTimeTotals(); };
    window.addEventListener('time-entries-changed', handle);
    return () => window.removeEventListener('time-entries-changed', handle);
  }, [getAllEntries, isRunning, elapsed]);

  const getTaskTotalTime = (taskId: string) => {
    const saved = taskTimeTotals[taskId] ?? 0;
    if (isRunning && activeTaskId === taskId) return saved + elapsed;
    return saved;
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filtered = useMemo(
    () => applyTaskFilters(tasks, activeFilters, { projects }),
    [tasks, activeFilters, projects],
  );

  const filterDefaultProjectId = useMemo(() => {
    const rule = activeFilters.rules.find((r) => r.field === 'project_id' && r.operator === 'include' && r.values.length > 0);
    return rule?.values[0] ?? undefined;
  }, [activeFilters]);

  const columns = useMemo(
    () =>
      statuses.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color || '#64748b',
        is_done: Number(s.is_done),
        is_default: Number(s.is_default),
      })),
    [statuses],
  );

  useEffect(() => {
    // Clean up stale collapse state when statuses are removed.
    const validIds = new Set(statuses.map((s) => s.id));
    setCollapsedCols((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (const [id, collapsed] of Object.entries(prev)) {
        if (validIds.has(id)) next[id] = collapsed;
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [statuses]);
  const openStatusCount = useMemo(
    () => statuses.filter((s) => Number(s.is_done) !== 1).length,
    [statuses],
  );
  const columnIds = useMemo(() => columns.map((c) => c.id), [columns]);

  const grouped = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const col of columns) map[col.id] = [];

    const doneStatusIds = new Set(statuses.filter((s) => Number(s.is_done)).map((s) => s.id));
    const parentIds = new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!));

    let candidates = filtered;

    if (activeFilters.actionableOnly) {
      // Actionable: leaf + incomplete
      candidates = candidates.filter((t) => {
        if (parentIds.has(t.id)) return false;
        if (doneStatusIds.has(t.status_id)) return false;
        return true;
      });
    } else {
      candidates = candidates.filter((t) => t.parent_id === null || doneStatusIds.has(t.status_id));
    }

    if (activeFilters.viewableOnly) {
      // Only visible tasks
      candidates = candidates.filter((t) => !!t.visible);
    }

    for (const task of candidates) {
      const col = columnIds.includes(task.status_id) ? task.status_id : columnIds[0];
      if (!col) continue;
      map[col].push(task);
    }
    return map;
  }, [filtered, columnIds, columns, activeFilters, tasks, statuses]);

  const subtaskCounts = useMemo(() => {
    const map: Record<string, { total: number; done: number }> = {};
    const doneIds = new Set(
      tasks.filter((t) => {
        const s = statuses.find((x) => x.id === t.status_id);
        return s && Number(s.is_done);
      }).map((t) => t.id),
    );
    for (const task of tasks) {
      if (!task.parent_id) continue;
      if (!map[task.parent_id]) map[task.parent_id] = { total: 0, done: 0 };
      map[task.parent_id].total++;
      if (doneIds.has(task.id)) map[task.parent_id].done++;
    }
    return map;
  }, [tasks, statuses]);

  const activeTask = activeId && activeType === 'task' ? tasks.find((t) => t.id === activeId) : null;
  const activeColumn = activeId && activeType === 'column' ? columns.find((c) => c.id === activeId) : null;

  const handleDragStart = (e: DragStartEvent) => {
    const type = e.active.data.current?.type as 'task' | 'column' | undefined;
    setActiveId(e.active.id as string);
    setActiveType(type || 'task');
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    const type = active.data.current?.type;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    if (type === 'column') {
      const oldIndex = columnIds.indexOf(active.id as string);
      const newIndex = columnIds.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(columnIds, oldIndex, newIndex);
        await reorderStatuses(newOrder);
      }
      return;
    }

    const taskId = active.id as string;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const overId = over.id as string;
    const isColumnEndDrop = overId.startsWith('column-end:');

    // Determine target column
    let targetStatusId: string;
    if (isColumnEndDrop) {
      targetStatusId = overId.slice('column-end:'.length);
    } else if (columnIds.includes(overId)) {
      targetStatusId = overId;
    } else {
      const overTask = tasks.find((t) => t.id === overId);
      targetStatusId = overTask?.status_id || columnIds[0] || 'status-todo';
    }

    const sameColumn = task.status_id === targetStatusId;
    const columnTasks = grouped[targetStatusId] || [];

    if (sameColumn) {
      // Reorder within same column
      const oldIndex = columnTasks.findIndex((t) => t.id === taskId);
      let newIndex: number;
      if (isColumnEndDrop || columnIds.includes(overId)) {
        newIndex = columnTasks.length - 1;
      } else {
        newIndex = columnTasks.findIndex((t) => t.id === overId);
      }
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(columnTasks, oldIndex, newIndex);
      await batchUpdatePositions(reordered.map((t, i) => ({ id: t.id, position: i })));
    } else {
      // Move to different column
      // Build desired order for target column BEFORE the status change
      const targetTasks = [...columnTasks];
      let insertIdx = targetTasks.length; // default: end
      if (!isColumnEndDrop && !columnIds.includes(overId)) {
        const overIndex = targetTasks.findIndex((t) => t.id === overId);
        if (overIndex !== -1) {
          // For cross-column drops, place after hovered card when dropping in its lower half.
          const overMidY = over.rect.top + over.rect.height / 2;
          const activeY = e.activatorEvent instanceof MouseEvent
            ? e.activatorEvent.clientY
            : (e.active.rect.current.translated?.top ?? e.active.rect.current.initial?.top ?? overMidY);
          insertIdx = activeY >= overMidY ? overIndex + 1 : overIndex;
        }
      }
      // Insert dragged task at the target position
      targetTasks.splice(insertIdx, 0, task);

      // Atomic cross-column move: single optimistic update + single fetchTasks
      await moveTaskToColumn(taskId, targetStatusId, targetTasks.map((t, i) => ({ id: t.id, position: i })));
    }
  };

  const handleAddColumn = async () => {
    if (!newColumnName.trim()) {
      setIsAddingColumn(false);
      return;
    }
    await addStatus(newColumnName.trim());
    setNewColumnName('');
    setIsAddingColumn(false);
  };

  const handleAddTaskInColumn = async (statusId: string, title: string) => {
    if (!title.trim()) return;
    await addTask(title.trim(), filterDefaultProjectId, null, statusId);
    setAddingInCol((prev) => ({ ...prev, [statusId]: null }));
  };

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-neutral-900">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2 border-b-2 border-neutral-200 dark:border-neutral-700 flex items-center gap-2 flex-wrap bg-white dark:bg-neutral-800">
        <Tooltip id="actionable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, actionableOnly: !activeFilters.actionableOnly, viewableOnly: false })}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilters.actionableOnly
                ? 'bg-amber-100 border-amber-300 text-amber-700'
                : 'bg-white dark:bg-neutral-800 border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            {t(language, 'btn_actionable')}
          </button>
        </Tooltip>
        <Tooltip id="viewable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, viewableOnly: !activeFilters.viewableOnly, actionableOnly: false })}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilters.viewableOnly
                ? 'bg-brand-100 border-brand-300 text-brand-700'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            {t(language, 'btn_viewable')}
          </button>
        </Tooltip>
        <div className="ml-auto">
          <ViewControls />
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={typedCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="kanban-scroll flex-1 min-h-0 flex gap-3 overflow-x-auto overflow-y-hidden pl-2 pr-4 pt-2 pb-4 items-start">
            {columns.map((column) => (
              <SortableColumnWrapper key={column.id} id={column.id} draggingColumn={activeType === 'column'}>
                {(handleProps) => (
                  <SortableContext
                    id={column.id}
                    items={(grouped[column.id] || []).map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <Column
                      id={column.id}
                      name={column.name}
                      color={column.color}
                      tasks={grouped[column.id] || []}
                      isDefault={column.is_default === 1}
                      isDone={column.is_done === 1}
                      canDelete={column.is_done !== 1 && openStatusCount > 1}
                      collapsed={!!collapsedCols[column.id]}
                      isMenuOpen={openMenuId === column.id}
                      width={getColWidth(column.id)}
                      onResizeStart={(e) => startColResize(column.id, e)}
                      onToggleMenu={(id) => setOpenMenuId((prev) => (prev === id ? null : id || null))}
                      onRename={async (id, name) => { await renameStatus(id, name); }}
                      onDelete={async (id) => { try { await removeStatus(id); await fetchTasks(); } catch (e: any) { console.error('[KanbanDelete]', e?.message || e); } }}
                      onSetDefault={setDefaultStatus}
                      onChangeColor={async (id, color) => { await updateStatusColor(id, color); }}
                      onToggleCollapse={(id) => setCollapsedCols((prev) => ({ ...prev, [id]: !prev[id] }))}
                      columnHandleProps={handleProps}
                    >
                      {(grouped[column.id] || []).map((task) => (
                        <SortableTaskCard
                          key={task.id}
                          task={task}
                          onOpenDetail={setActiveDetailId}
                          childCount={subtaskCounts[task.id]?.total ?? 0}
                          doneChildCount={subtaskCounts[task.id]?.done ?? 0}
                          totalTimeSec={getTaskTotalTime(task.id)}
                        />
                      ))}
                      <ColumnEndDropZone
                        columnId={column.id}
                        language={language}
                        addingTitle={addingInCol[column.id] ?? null}
                        onStartAdding={() => setAddingInCol((prev) => ({ ...prev, [column.id]: '' }))}
                        onChangeAddingTitle={(v) => setAddingInCol((prev) => ({ ...prev, [column.id]: v }))}
                        onConfirmAdding={() => handleAddTaskInColumn(column.id, addingInCol[column.id] ?? '')}
                        onCancelAdding={() => setAddingInCol((prev) => ({ ...prev, [column.id]: null }))}
                      />
                      {(grouped[column.id] || []).length === 0 && (
                        <p className="text-xs text-slate-400 dark:text-neutral-500 text-center py-6">{t(language, 'empty_kanban_column')}</p>
                      )}
                    </Column>
                  </SortableContext>
                )}
              </SortableColumnWrapper>
            ))}

            {/* Add new column */}
            <div className="w-80 shrink-0 pt-0.5">
              {!isAddingColumn ? (
                <button
                  type="button"
                  onClick={() => setIsAddingColumn(true)}
                  className="w-full flex items-center gap-1.5 px-3 py-2.5 text-sm font-semibold text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 rounded-lg transition"
                >
                  <Plus className="w-4 h-4" />
                  {t(language, 'btn_add_column')}
                </button>
              ) : (
                <div className="p-2 space-y-2 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/60 dark:bg-neutral-800/60 shadow-sm dark:shadow-neutral-900/20">
                  <input
                    autoFocus
                    type="text"
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleAddColumn();
                      if (e.key === 'Escape') {
                        setIsAddingColumn(false);
                        setNewColumnName('');
                      }
                    }}
                    placeholder={t(language, 'placeholder_column_name')}
                    className="w-full text-sm border border-brand-300 rounded px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white dark:bg-neutral-800 dark:text-neutral-200"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={handleAddColumn}
                      className="text-xs px-2.5 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 transition"
                    >
                      {t(language, 'add')}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAddingColumn(false);
                        setNewColumnName('');
                      }}
                      className="text-xs px-2.5 py-1.5 rounded text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                    >
                      {t(language, 'cancel')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </SortableContext>

        <DragOverlay dropAnimation={null}>
          {activeTask ? <SortableTaskCard task={activeTask} isOverlay /> : null}
          {activeColumn ? (
            <div
              className="w-80 h-20 rounded-lg border-2 bg-white/90 dark:bg-neutral-800/90 shadow-xl dark:shadow-neutral-900/20 flex items-center justify-center gap-2 rotate-1"
              style={{ borderColor: activeColumn.color }}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: activeColumn.color }} />
              <span className="text-sm font-semibold" style={{ color: activeColumn.color }}>{activeColumn.name}</span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {activeDetailId && (
        <TaskDetailModal taskId={activeDetailId} onClose={() => setActiveDetailId(null)} />
      )}
    </div>
  );
};
