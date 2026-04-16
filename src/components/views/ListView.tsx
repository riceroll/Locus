import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Zap, Eye, Plus, ArrowUp, ArrowDown, ArrowUpDown, Columns3, Check, Trash2 } from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
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
import { buildRenderList, getAncestorChain, type RenderRow } from './list/buildRenderList';
import { QuickAddRow, DropBetweenRow } from './list/ListHelpers';
import { TaskRow } from './list/TaskRow';
import { Tooltip } from '../ui/Tooltip';

export const ListView = () => {
  const { tasks, isLoading, error, fetchTasks, addTask, addNextTask, updateTaskStatus, toggleCollapsed, deleteTask, deleteTaskRecursive, moveTask, batchUpdatePositions } = useTaskStore();
  const { isRunning, activeTaskId, elapsed, getAllEntries, startTimer, stopTimer } = useTimerStore();
  const { activeFilters, setFilters } = useViewStore();
  const { language } = useSettingsStore();
  const { statuses, fetchStatuses, getDoneStatusId, getDefaultOpenStatusId } = useStatusStore();
  const { projects, fetchProjects } = useProjectStore();

  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);
  const [quickAddState, setQuickAddState] = useState<{ parentId: string | null; projectId: string | null } | null>(null);
  const [quickAddNextState, setQuickAddNextState] = useState<{ afterTaskId: string; level: number } | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ tasks: Task[]; hasChildren: boolean } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [nestTargetId, setNestTargetId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);

  // Filter modes


  // Sort
  type SortField = 'title' | 'status' | 'project' | 'priority' | 'visible' | 'created' | 'updated';
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortField(null); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Column visibility
  type ColKey = 'status' | 'project' | 'priority' | 'visible' | 'estimate' | 'time_spent' | 'due_date' | 'created' | 'updated' | 'actions';
  const [visibleCols, setVisibleCols] = useState<Record<ColKey, boolean>>({
    status: true, project: true, priority: true, visible: true, estimate: false, time_spent: false, due_date: false, created: false, updated: false, actions: true,
  });
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const toggleCol = (key: ColKey) => setVisibleCols((prev) => ({ ...prev, [key]: !prev[key] }));

  // Column order (title is fixed-first; these are the reorderable right-side columns)
  const [colOrder, setColOrder] = useState<ColKey[]>(['status', 'project', 'priority', 'visible', 'estimate', 'time_spent', 'due_date', 'created', 'updated', 'actions']);

  // Column header drag-to-reorder
  const colHeaderDraggingKey = useRef<ColKey | null>(null);
  const colHeaderStartX = useRef(0);
  const colHeaderDragActive = useRef(false);
  const [draggingColKey, setDraggingColKey] = useState<ColKey | null>(null);
  const [dropColKey, setDropColKey] = useState<ColKey | null>(null);

  const handleColHeaderMouseDown = (e: React.MouseEvent, col: ColKey) => {
    if ((e.target as HTMLElement).closest('[data-resize-handle]')) return;
    colHeaderDraggingKey.current = col;
    colHeaderStartX.current = e.clientX;
    colHeaderDragActive.current = false;
    const onMove = (ev: MouseEvent) => {
      if (!colHeaderDragActive.current && Math.abs(ev.clientX - colHeaderStartX.current) > 5) {
        colHeaderDragActive.current = true;
        setDraggingColKey(col);
      }
      if (colHeaderDragActive.current) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const th = el?.closest('[data-colkey]') as HTMLElement | null;
        const target = (th?.dataset.colkey ?? null) as ColKey | null;
        setDropColKey(target && target !== col ? target : null);
      }
    };
    const onUp = (ev: MouseEvent) => {
      if (colHeaderDragActive.current) {
        const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null;
        const th = el?.closest('[data-colkey]') as HTMLElement | null;
        const target = (th?.dataset.colkey ?? null) as ColKey | null;
        if (target && target !== colHeaderDraggingKey.current) {
          setColOrder((prev) => {
            const from = prev.indexOf(colHeaderDraggingKey.current!);
            const to = prev.indexOf(target);
            if (from < 0 || to < 0) return prev;
            const next = [...prev];
            next.splice(from, 1);
            next.splice(to, 0, colHeaderDraggingKey.current!);
            return next;
          });
        }
      } else {
        // No significant movement → treat as sort click
        toggleSort(col as SortField);
      }
      setDraggingColKey(null);
      setDropColKey(null);
      colHeaderDraggingKey.current = null;
      colHeaderDragActive.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // Column resize
  const [colWidths, setColWidths] = useState<Record<string, number>>({
    title: 280, status: 55, project: 60, priority: 50, visible: 44, estimate: 72, time_spent: 84, due_date: 96, created: 55, updated: 55, actions: 60,
  });
  const [taskTimeTotals, setTaskTimeTotals] = useState<Record<string, number>>({});
  const resizingCol = useRef<string | null>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const startResize = (e: React.MouseEvent, col: string) => {
    e.preventDefault();
    e.stopPropagation();
    resizingCol.current = col;
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = colWidths[col] ?? (col === 'title' ? 280 : 80);
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientX - resizeStartX.current;
      setColWidths((prev) => ({ ...prev, [resizingCol.current!]: Math.max(40, resizeStartWidth.current + delta) }));
    };
    const onUp = () => {
      resizingCol.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  // One-time sort dropdown
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) setShowSortMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    return isRunning && activeTaskId === taskId ? saved + elapsed : saved;
  };

  const doneStatusId = getDoneStatusId();
  const openStatusId = getDefaultOpenStatusId();

  const doneSet = useMemo(
    () => new Set(statuses.filter((s) => Number(s.is_done)).map((s) => s.id)),
    [statuses],
  );

  const isFiltered = activeFilters.rules && activeFilters.rules.length > 0;
  const filteredTasks = useMemo(
    () => applyTaskFilters(tasks, activeFilters, { projects }),
    [tasks, activeFilters, projects],
  );

  const filterDefaults = useMemo(() => {
    const projectRule = activeFilters.rules.find((r) => r.field === 'project_id' && r.operator === 'include' && r.values.length > 0);
    const statusRule = activeFilters.rules.find((r) => r.field === 'status_id' && r.operator === 'include' && r.values.length > 0);
    return {
      projectId: projectRule?.values[0] ?? null,
      statusId: statusRule?.values[0] ?? null,
    };
  }, [activeFilters]);

  // Helper sets for quick-filter modes
  const parentIds = useMemo(
    () => new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!)),
    [tasks],
  );

  const incompleteDescendants = useMemo(() => {
    const parentMap = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_id) {
        let arr = parentMap.get(t.parent_id);
        if (!arr) { arr = []; parentMap.set(t.parent_id, arr); }
        arr.push(t);
      }
    }
    const incomp = new Set<string>();
    const check = (id: string): boolean => {
      if (incomp.has(id)) return true;
      const children = parentMap.get(id);
      if (!children) return false;
      for (const c of children) {
        if (!doneSet.has(c.status_id) || check(c.id)) {
          incomp.add(id);
          return true;
        }
      }
      return false;
    };
    for (const t of tasks) {
      if (!incomp.has(t.id)) check(t.id);
    }
    return incomp;
  }, [tasks, doneSet]);

  // Build tree rows (or flat list when filtering / quick-filter active)
  const renderRows = useMemo(() => {
    const useFlat = isFiltered || activeFilters.actionableOnly || activeFilters.viewableOnly;

    if (useFlat) {
      let pool = filteredTasks;

      if (activeFilters.actionableOnly) {
        // Actionable: leaf/clean-parent + incomplete + visible
        pool = pool.filter((t) => {
          if (incompleteDescendants.has(t.id)) return false;
          if (doneSet.has(t.status_id)) return false;
          return true;
        });
      }

      if (activeFilters.viewableOnly) {
        // Viewable: only visible tasks
        pool = pool.filter((t) => !!t.visible);
      }

      return pool.map((task): RenderRow => ({
        task,
        level: 0,
        childCount: tasks.filter((t) => t.parent_id === task.id).length,
        doneChildCount: tasks.filter((t) => t.parent_id === task.id && doneSet.has(t.status_id)).length,
        ancestors: task.parent_id ? getAncestorChain(task, tasks) : undefined,
      }));
    }

    return buildRenderList(tasks, doneSet, null, 0);
  }, [tasks, filteredTasks, isFiltered, doneSet, parentIds, activeFilters]);

  const PRIORITY_ORDER: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

  const sortedRows = useMemo(() => {
    if (!sortField) return renderRows;
    const mult = sortDir === 'asc' ? 1 : -1;
    return [...renderRows].sort((a, b) => {
      let cmp = 0;
      const ta = a.task, tb = b.task;
      switch (sortField) {
        case 'title': cmp = ta.title.localeCompare(tb.title); break;
        case 'status': {
          const sa = statuses.find(s => s.id === ta.status_id)?.name ?? '';
          const sb = statuses.find(s => s.id === tb.status_id)?.name ?? '';
          cmp = sa.localeCompare(sb);
          break;
        }
        case 'project': {
          const pa = projects.find(p => p.id === ta.project_id)?.name ?? '';
          const pb = projects.find(p => p.id === tb.project_id)?.name ?? '';
          cmp = pa.localeCompare(pb);
          break;
        }
        case 'priority': {
          const pa = PRIORITY_ORDER[ta.priority ?? ''] ?? 99;
          const pb = PRIORITY_ORDER[tb.priority ?? ''] ?? 99;
          cmp = pa - pb;
          break;
        }
        case 'visible': cmp = (ta.visible ? 1 : 0) - (tb.visible ? 1 : 0); break;
        case 'created': cmp = ta.created_at - tb.created_at; break;
        case 'updated': cmp = ta.updated_at - tb.updated_at; break;
      }
      return cmp * mult;
    });
  }, [renderRows, sortField, sortDir, statuses, projects]);

  const visibleTaskIds = useMemo(() => sortedRows.map((r) => r.task.id), [sortedRows]);
  const allVisibleSelected = visibleTaskIds.length > 0 && visibleTaskIds.every((id) => selectedTaskIds.has(id));
  const someVisibleSelected = visibleTaskIds.some((id) => selectedTaskIds.has(id));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = !allVisibleSelected && someVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  useEffect(() => {
    const idSet = new Set(tasks.map((t) => t.id));
    setSelectedTaskIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        if (idSet.has(id)) next.add(id);
      }
      return next;
    });
  }, [tasks]);

  const openDeleteDialog = (targetTasks: Task[]) => {
    if (targetTasks.length === 0) return;
    const childParentSet = new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!));
    const hasChildren = targetTasks.some((t) => childParentSet.has(t.id));
    setDeleteDialog({ tasks: targetTasks, hasChildren });
  };

  const handleDeleteOnly = async () => {
    if (!deleteDialog) return;
    const ids = deleteDialog.tasks.map((t) => t.id);
    setDeleteDialog(null);
    for (const id of ids) {
      await deleteTask(id);
    }
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  };

  const handleDeleteRecursive = async () => {
    if (!deleteDialog) return;
    const selectedSet = new Set(deleteDialog.tasks.map((t) => t.id));
    const taskMap = new Map(tasks.map((t) => [t.id, t] as const));
    const roots = deleteDialog.tasks.filter((task) => {
      let parentId = task.parent_id;
      while (parentId) {
        if (selectedSet.has(parentId)) return false;
        parentId = taskMap.get(parentId)?.parent_id ?? null;
      }
      return true;
    });
    const rootIds = roots.map((t) => t.id);
    setDeleteDialog(null);
    for (const id of rootIds) {
      await deleteTaskRecursive(id);
    }
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      rootIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  // One-time sort: permanently reorder positions by a field, then return to custom order
  const applyOneTimeSort = async (field: SortField, dir: 'asc' | 'desc') => {
    // Group tasks by parent_id and sort each sibling group
    const groups = new Map<string, Task[]>();
    for (const t of tasks) {
      const key = t.parent_id ?? '';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }

    const mult = dir === 'asc' ? 1 : -1;
    const cmpFn = (a: Task, b: Task): number => {
      let cmp = 0;
      switch (field) {
        case 'title': cmp = a.title.localeCompare(b.title); break;
        case 'status': {
          const sa = statuses.find(s => s.id === a.status_id)?.name ?? '';
          const sb = statuses.find(s => s.id === b.status_id)?.name ?? '';
          cmp = sa.localeCompare(sb); break;
        }
        case 'project': {
          const pa = projects.find(p => p.id === a.project_id)?.name ?? '';
          const pb = projects.find(p => p.id === b.project_id)?.name ?? '';
          cmp = pa.localeCompare(pb); break;
        }
        case 'priority': {
          const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 99;
          const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 99;
          cmp = pa - pb; break;
        }
        case 'visible': cmp = (a.visible ? 1 : 0) - (b.visible ? 1 : 0); break;
        case 'created': cmp = a.created_at - b.created_at; break;
        case 'updated': cmp = a.updated_at - b.updated_at; break;
      }
      return cmp * mult;
    };

    const updates: { id: string; position: number }[] = [];
    for (const [, siblings] of groups) {
      siblings.sort(cmpFn);
      siblings.forEach((t, i) => updates.push({ id: t.id, position: i }));
    }

    await batchUpdatePositions(updates);
    // Clear any active column sort since we've permanently reordered
    setSortField(null);
    setSortDir('asc');
    setShowSortMenu(false);
  };

  const handleQuickAdd = async (title: string) => {
    if (!quickAddState) return;
    const initialProjectId = quickAddState.projectId ?? filterDefaults.projectId ?? undefined;
    const initialStatusId = quickAddState.parentId ? undefined : (filterDefaults.statusId ?? undefined);
    await addTask(title, initialProjectId, quickAddState.parentId, initialStatusId);
    setQuickAddState(null);
  };

  const handleQuickAddNext = async (title: string) => {
    if (!quickAddNextState) return;
    await addNextTask(quickAddNextState.afterTaskId, title);
    setQuickAddNextState(null);
  };

  const quickAddNextInsertIdx = useMemo(() => {
    if (!quickAddNextState) return -1;
    const { afterTaskId } = quickAddNextState;
    const startIdx = renderRows.findIndex((r) => r.task.id === afterTaskId);
    if (startIdx === -1) return -1;
    const afterLevel = renderRows[startIdx].level;
    let lastIdx = startIdx;
    for (let i = startIdx + 1; i < renderRows.length; i++) {
      if (renderRows[i].level <= afterLevel) break;
      lastIdx = i;
    }
    return lastIdx;
  }, [quickAddNextState, renderRows]);

  const handleToggleDone = async (task: Task, checked: boolean) => {
    await updateTaskStatus(task.id, checked ? doneStatusId : openStatusId);
    if (checked && task.parent_id) {
      const siblings = tasks.filter((t) => t.parent_id === task.parent_id);
      const allSiblingsDone = siblings.every((t) =>
        t.id === task.id ? true : doneSet.has(t.status_id),
      );
      if (allSiblingsDone) {
        const parent = tasks.find((t) => t.id === task.parent_id);
        if (parent && !doneSet.has(parent.status_id)) {
          await updateTaskStatus(parent.id, doneStatusId);
        }
      }
    }
  };

  const handleStartStop = async (task: Task) => {
    if (isRunning && activeTaskId === task.id) {
      await stopTimer();
    } else {
      await startTimer(task.id, task.title);
    }
  };

  const handleDragStart = (e: DragStartEvent) => {
    setDraggingId(e.active.id as string);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingId(null);
    setNestTargetId(null);
    const { active, over } = e;
    if (!over) return;

    const draggedId = active.id as string;
    const overId = over.id as string;
    if (overId === `nest:${draggedId}`) return;

    const draggedTask = tasks.find((t) => t.id === draggedId);
    if (!draggedTask) return;

    // Nest drop
    if (overId.startsWith('nest:')) {
      const targetId = overId.slice(5);
      const isDescendant = (checkId: string): boolean =>
        tasks.filter((t) => t.parent_id === checkId).some((c) => c.id === draggedId || isDescendant(c.id));
      if (!isDescendant(targetId)) {
        await moveTask(draggedId, targetId, null);
      }
      return;
    }

    // When sorted, only allow nest drops (re-parenting), not reorder drops
    if (!overId.startsWith('dz:')) return;
    if (sortField) return; // Block reorder when a column sort is active
    const dzIndex = parseInt(overId.slice(3), 10);

    const rowAtDz = renderRows[dzIndex];
    const newParentId: string | null = rowAtDz
      ? (rowAtDz.task.parent_id ?? null)
      : (renderRows.length > 0 ? (renderRows[renderRows.length - 1].task.parent_id ?? null) : null);

    const isDescendant = (checkId: string | null): boolean => {
      if (!checkId) return false;
      if (checkId === draggedId) return true;
      return isDescendant(tasks.find((t) => t.id === checkId)?.parent_id ?? null);
    };
    if (isDescendant(newParentId)) return;

    let aboveSibling: Task | null = null;
    for (let i = dzIndex - 1; i >= 0; i--) {
      const r = renderRows[i];
      if (r.task.id === draggedId) continue;
      if ((r.task.parent_id ?? null) === newParentId) { aboveSibling = r.task; break; }
    }

    await moveTask(draggedId, newParentId, aboveSibling?.id ?? null);
  };

  // Dynamic column count: drag + task (always) + optional cols
  const COL_COUNT = 3 + (['status', 'project', 'priority', 'visible', 'estimate', 'time_spent', 'due_date', 'created', 'updated', 'actions'] as ColKey[]).filter(k => visibleCols[k]).length;

  const SORT_LABELS: { field: SortField; label: string }[] = [
    { field: 'title', label: t(language, 'col_task') },
    { field: 'status', label: t(language, 'col_status') },
    { field: 'project', label: t(language, 'col_project') },
    { field: 'priority', label: t(language, 'col_priority') },
    { field: 'visible', label: t(language, 'col_visibility') },
    { field: 'created', label: t(language, 'col_created') },
    { field: 'updated', label: t(language, 'col_updated') },
  ];
  const COL_LABELS: { key: ColKey; label: string }[] = [
    { key: 'status', label: t(language, 'col_status') },
    { key: 'project', label: t(language, 'col_project') },
    { key: 'priority', label: t(language, 'col_priority') },
    { key: 'visible', label: t(language, 'col_visibility') },
    { key: 'estimate', label: t(language, 'label_estimate') },
    { key: 'time_spent', label: t(language, 'col_time_spent') },
    { key: 'due_date', label: t(language, 'label_due_date') },
    { key: 'created', label: t(language, 'col_created') },
    { key: 'updated', label: t(language, 'col_updated') },
    { key: 'actions', label: t(language, 'col_actions') },
  ];

  return (
    <div className="bg-slate-50 dark:bg-neutral-950 h-full flex flex-col overflow-hidden">
      {/* Toolbar: quick filters + controls */}
      <div className="px-6 py-2 shrink-0 border-b-2 border-neutral-200 dark:border-neutral-600 flex items-center gap-2 flex-wrap bg-white dark:bg-neutral-900">
        {/* Quick filter buttons */}
        <Tooltip id="actionable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, actionableOnly: !activeFilters.actionableOnly, viewableOnly: false })}
            className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
              activeFilters.actionableOnly
                ? 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
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

        {selectedTaskIds.size > 0 && (
          <button
            type="button"
            onClick={() => {
              const selected = tasks.filter((t) => selectedTaskIds.has(t.id));
              openDeleteDialog(selected);
            }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-red-200 dark:border-red-800/60 text-red-600 dark:text-red-400 bg-red-50/70 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t(language, 'btn_delete_selected')} ({selectedTaskIds.size})
          </button>
        )}

        {/* One-time Sort button */}
        <div className="relative" ref={sortMenuRef}>
          <button
            type="button"
            onClick={() => { setShowSortMenu((v) => !v); setShowColMenu(false); }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            {t(language, 'btn_sort')}
          </button>
          {showSortMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">{t(language, 'sort_once_by')}</div>
              {SORT_LABELS.map(({ field, label }) => (
                <div key={field} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => applyOneTimeSort(field, 'asc')}
                    className="flex-1 text-left px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                  >
                    {label}
                  </button>
                  <button
                    type="button"
                    onClick={() => applyOneTimeSort(field, 'asc')}
                    className="px-2 py-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    title={t(language, 'tooltip_ascending')}
                  ><ArrowUp className="w-3 h-3" /></button>
                  <button
                    type="button"
                    onClick={() => applyOneTimeSort(field, 'desc')}
                    className="px-2 py-1.5 text-neutral-400 dark:text-neutral-500 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                    title={t(language, 'tooltip_descending')}
                  ><ArrowDown className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column visibility toggle */}
        <div className="relative" ref={colMenuRef}>
          <button
            type="button"
            onClick={() => { setShowColMenu((v) => !v); setShowSortMenu(false); }}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
          >
            <Columns3 className="w-3.5 h-3.5" />
            {t(language, 'btn_columns_toggle')}
          </button>
          {showColMenu && (
            <div className="absolute top-full left-0 mt-1 w-44 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg z-50 py-1">
              {COL_LABELS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleCol(key)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700 transition-colors"
                >
                  <span className={`w-4 h-4 flex items-center justify-center rounded border ${visibleCols[key] ? 'bg-brand-500 border-brand-500 text-white' : 'border-neutral-300 dark:border-neutral-600'}`}>
                    {visibleCols[key] && <Check className="w-3 h-3" />}
                  </span>
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto">
          <ViewControls />
        </div>
      </div>

      <div className="flex-1 overflow-auto min-h-0 bg-white dark:bg-neutral-950">
        {isLoading && <p className="text-slate-500 dark:text-neutral-300 text-sm p-4">{t(language, 'text_loading')}</p>}
        {error && <p className="text-red-500 text-sm p-4">Error: {error}</p>}

        {/* Table */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          const overId = e.over?.id as string | undefined;
          setNestTargetId(overId?.startsWith('nest:') ? overId.slice(5) : null);
        }}
        onDragCancel={() => { setDraggingId(null); setNestTargetId(null); }}
      >
        <div className="flex-1 w-full bg-white dark:bg-neutral-900 overflow-x-auto">
          <table className="min-w-full text-sm border-collapse table-fixed">
            <colgroup>
              <col style={{ width: 28 }} />
              <col style={{ width: 32 }} />
              <col style={{ width: colWidths.title }} />
              {colOrder.filter((k) => visibleCols[k]).map((k) => (
                <col key={k} style={{ width: colWidths[k] }} />
              ))}
            </colgroup>
            <thead className="bg-neutral-50/50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-600">
              <tr>
                <th className="w-7 px-0 py-2.5 border-r border-neutral-200/60 dark:border-neutral-600/70">&nbsp;</th>
                <th className="w-8 px-0 py-2.5 border-r border-neutral-200/60 dark:border-neutral-600/70 text-center align-middle">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setSelectedTaskIds((prev) => {
                        const next = new Set(prev);
                        if (checked) {
                          visibleTaskIds.forEach((id) => next.add(id));
                        } else {
                          visibleTaskIds.forEach((id) => next.delete(id));
                        }
                        return next;
                      });
                    }}
                    className="w-3.5 h-3.5 rounded-[4px] border-neutral-300 dark:border-neutral-600 text-brand-600 focus:ring-brand-400"
                    aria-label="Select all visible tasks"
                  />
                </th>
                <th
                  className="relative px-3 py-2.5 text-left text-[11px] font-semibold text-neutral-400 dark:text-neutral-300 uppercase tracking-wider cursor-pointer select-none hover:text-neutral-600 dark:hover:text-neutral-100 transition-colors border-r border-neutral-200/60 dark:border-neutral-600/70"
                  onClick={() => toggleSort('title')}
                >
                  <span className="inline-flex items-center gap-1 truncate">
                    {t(language, 'col_task')}
                    {sortField === 'title'
                      ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />)
                      : <ArrowUp className="w-3 h-3 opacity-0 shrink-0" />}
                  </span>
                  <div
                    data-resize-handle
                    className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/40 transition-colors"
                    onMouseDown={(e) => { e.stopPropagation(); startResize(e, 'title'); }}
                  />
                </th>
                {/* Reorderable columns — drag header to reorder, click to sort */}
                {colOrder.filter((k) => visibleCols[k]).map((k) => {
                  const LABEL: Record<string, string> = { status: t(language, 'col_status'), project: t(language, 'col_project'), priority: t(language, 'col_priority'), visible: t(language, 'col_visibility'), estimate: t(language, 'label_estimate'), time_spent: t(language, 'col_time_spent'), due_date: t(language, 'label_due_date'), created: t(language, 'col_created'), updated: t(language, 'col_updated'), actions: t(language, 'col_actions') };
                  const sortable = ['status', 'project', 'priority', 'created', 'updated'].includes(k);
                  const isDropTarget = dropColKey === k;
                  const isDraggingThis = draggingColKey === k;
                  return (
                    <th
                      key={k}
                      data-colkey={k}
                      className={`relative px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider select-none border-r border-neutral-200/60 dark:border-neutral-700/40 transition-colors ${k === 'visible' ? 'text-center' : 'text-left'} ${
                        isDraggingThis ? 'opacity-40 cursor-grabbing' : 'cursor-grab hover:text-neutral-600 dark:hover:text-neutral-100 text-neutral-400 dark:text-neutral-300'
                      } ${isDropTarget ? 'bg-brand-50/60 dark:bg-brand-900/20' : ''}`}
                      onMouseDown={(e) => handleColHeaderMouseDown(e, k)}
                    >
                      {isDropTarget && <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-brand-500" />}
                      <span className="inline-flex items-center gap-1 truncate">
                        {LABEL[k]}
                        {sortable && (sortField === k
                          ? (sortDir === 'asc' ? <ArrowUp className="w-3 h-3 shrink-0" /> : <ArrowDown className="w-3 h-3 shrink-0" />)
                          : <ArrowUp className="w-3 h-3 opacity-0 shrink-0" />)}
                      </span>
                      <div
                        data-resize-handle
                        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-brand-400/40 transition-colors"
                        onMouseDown={(e) => { e.stopPropagation(); startResize(e, k); }}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody>
              {!sortField && <DropBetweenRow id="dz:0" colCount={COL_COUNT} />}

              {sortedRows.map((row, idx) => (
                <React.Fragment key={row.task.id}>
                  <TaskRow
                    row={row}
                    doneStatusId={doneStatusId}
                    statuses={statuses}
                    projects={projects}
                    isRunning={isRunning}
                    activeTaskId={activeTaskId}
                    isDragging={draggingId === row.task.id}
                    isNestTarget={nestTargetId === row.task.id}
                    onToggleDone={handleToggleDone}
                    onToggleCollapsed={toggleCollapsed}
                    onStartStop={handleStartStop}
                    onOpenDetail={setActiveDetailId}
                    onDeleteRequest={(task) => openDeleteDialog([task])}
                    onAddSubtask={(parentId, projectId) => setQuickAddState({ parentId, projectId })}
                    isSelected={selectedTaskIds.has(row.task.id)}
                    onToggleSelect={(id, checked) => {
                      setSelectedTaskIds((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(id);
                        else next.delete(id);
                        return next;
                      });
                    }}
                    totalTimeSec={getTaskTotalTime(row.task.id)}
                    visibleCols={visibleCols}
                    colOrder={colOrder}
                  />

                  {quickAddState?.parentId === row.task.id && (
                    <QuickAddRow
                      parentId={quickAddState.parentId}
                      projectId={quickAddState.projectId}
                      colCount={COL_COUNT}
                      level={row.level + 1}
                      onAdd={handleQuickAdd}
                      onCancel={() => setQuickAddState(null)}
                    />
                  )}

                  {quickAddNextState !== null && idx === quickAddNextInsertIdx && (
                    <QuickAddRow
                      parentId={null}
                      projectId={null}
                      colCount={COL_COUNT}
                      level={quickAddNextState.level}
                      onAdd={handleQuickAddNext}
                      onCancel={() => setQuickAddNextState(null)}
                    />
                  )}

                  {!sortField && <DropBetweenRow id={`dz:${idx + 1}`} colCount={COL_COUNT} />}
                </React.Fragment>
              ))}

              {quickAddState !== null && quickAddState.parentId === null && (
                <QuickAddRow
                  parentId={null}
                  projectId={null}
                  colCount={COL_COUNT}
                  level={0}
                  onAdd={handleQuickAdd}
                  onCancel={() => setQuickAddState(null)}
                />
              )}

              {sortedRows.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-6 py-12 text-center text-slate-400 dark:text-neutral-400 text-sm">
                    {isFiltered || activeFilters.actionableOnly || activeFilters.viewableOnly ? t(language, 'no_tasks_filtered') : t(language, 'no_tasks_yet')}
                  </td>
                </tr>
              )}

              {/* Bottom add-task row */}
              {!(quickAddState !== null && quickAddState.parentId === null) && (
                <tr>
                  <td colSpan={COL_COUNT} className="px-2 py-1 border-t border-neutral-100 dark:border-neutral-600/70">
                    <button
                      type="button"
                      onClick={() => setQuickAddState({ parentId: null, projectId: null })}
                      className="inline-flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-300 hover:text-brand-600 px-2 py-1.5 rounded hover:bg-neutral-50 dark:hover:bg-neutral-800 transition w-full"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      {t(language, 'btn_add_task')}
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <DragOverlay dropAnimation={null}>
          {draggingId && (() => {
            const t = tasks.find((t) => t.id === draggingId);
            return t ? (
              <div className="bg-white dark:bg-neutral-800 border-2 border-brand-400 rounded-lg shadow-xl px-4 py-2 text-sm font-medium text-slate-800 dark:text-neutral-200 pointer-events-none rotate-1 opacity-90">
                {t.title}
              </div>
            ) : null;
          })()}
        </DragOverlay>
      </DndContext>
      </div>

      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 backdrop-blur-[2px] px-4">
          <div className="w-full max-w-md rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-2xl dark:shadow-neutral-950/40 p-4">
            <h3 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
              {deleteDialog.tasks.length === 1
                ? `Delete "${deleteDialog.tasks[0].title}"?`
                : t(language, 'text_delete_selected_count').replace('{count}', String(deleteDialog.tasks.length))}
            </h3>
            <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
              {deleteDialog.hasChildren
                ? t(language, 'text_delete_has_children_hint')
                : t(language, 'confirm_delete_task')}
            </p>
            <div className="mt-4 flex items-center justify-end gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setDeleteDialog(null)}
                className="px-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
              >
                {t(language, 'cancel')}
              </button>
              <button
                type="button"
                onClick={handleDeleteOnly}
                className="px-3 py-1.5 text-xs rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition"
              >
                {deleteDialog.hasChildren ? t(language, 'btn_delete_task_only') : t(language, 'btn_yes_delete')}
              </button>
              {deleteDialog.hasChildren && (
                <button
                  type="button"
                  onClick={handleDeleteRecursive}
                  className="px-3 py-1.5 text-xs rounded-lg bg-red-500 text-white hover:bg-red-600 transition"
                >
                  {t(language, 'btn_delete_task_and_subtasks')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {activeDetailId && (
        <TaskDetailModal taskId={activeDetailId} onClose={() => setActiveDetailId(null)} />
      )}
    </div>
  );
};
