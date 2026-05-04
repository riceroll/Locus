import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTaskStore, type Task } from '../../store/useTaskStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { TreeNode } from './tree/TreeNode';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type Modifier,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';

import { createPortal, flushSync } from 'react-dom';
import { TaskDetailModal } from './TaskDetailModal';
import { useViewStore } from '../../store/useViewStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { applyTaskFilters } from '../../lib/taskFilters';
import { Tooltip } from '../ui/Tooltip';
import { Zap, Eye, ChevronsLeftRight, ChevronsRightLeft, Plus } from 'lucide-react';
import { t } from '../../i18n';

const MIN_SCALE = 0.05;
const MAX_SCALE = 2.4;
const CANVAS_SIZE = 8000;
const CANVAS_ORIGIN = 3400;

type PanState = {
  startX: number;
  startY: number;
  startScrollLeft: number;
  startScrollTop: number;
};

type WebKitGestureEvent = Event & {
  scale: number;
  clientX: number;
  clientY: number;
};

export const TreeView = () => {
  const { tasks, batchUpdatePositions, updateTask, addTask } = useTaskStore();
  const { mouseWheelZoom, invertMouseWheelZoom, language } = useSettingsStore();

  const { activeFilters, setFilters } = useViewStore();
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  
  const doneSet = useMemo(() => new Set(statuses.filter((s) => Number(s.is_done) === 1).map((s) => s.id)), [statuses]);
  
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
    for (const t of tasks) check(t.id);
    return incomp;
  }, [tasks, doneSet]);

  const filteredTasks = useMemo(() => {
    let pool = applyTaskFilters(tasks, activeFilters, { projects });
    if (activeFilters.actionableOnly) {
      pool = pool.filter((t) => {
        if (incompleteDescendants.has(t.id)) return false;
        if (doneSet.has(t.status_id)) return false;
        return true;
      });
    }
    if (activeFilters.viewableOnly) {
      pool = pool.filter((t) => !!t.visible);
    }
    return new Set(pool.map((t) => t.id));
  }, [tasks, activeFilters, projects, incompleteDescendants, doneSet]);

  const parentTaskIds = useMemo(() => {
    return new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!));
  }, [tasks]);

  const filterDefaultProjectId = useMemo(() => {
    const projectRule = activeFilters.rules.find((r) => r.field === 'project_id' && r.operator === 'include' && r.values.length > 0);
    if (projectRule?.values[0]) return projectRule.values[0];

    const areaRule = activeFilters.rules.find((r) => r.field === 'area_id' && r.operator === 'include' && r.values.length > 0);
    if (!areaRule?.values[0]) return undefined;

    return projects.find((project) => project.area_id === areaRule.values[0])?.id;
  }, [activeFilters, projects]);

  const filterDefaultStatusId = useMemo(() => {
    const statusRule = activeFilters.rules.find((r) => r.field === 'status_id' && r.operator === 'include' && r.values.length > 0);
    if (statusRule?.values[0]) return statusRule.values[0];

    if (activeFilters.actionableOnly) {
      return statuses.find((status) => Number(status.is_done) !== 1)?.id;
    }

    return undefined;
  }, [activeFilters, statuses]);

  const collapseAll = useCallback(async () => {
    const targets = tasks.filter((t) => parentTaskIds.has(t.id) && Number(t.collapsed) !== 1);
    await Promise.all(targets.map((t) => updateTask(t.id, { collapsed: 1 })));
  }, [tasks, parentTaskIds, updateTask]);

  const expandAll = useCallback(async () => {
    const targets = tasks.filter((t) => parentTaskIds.has(t.id) && Number(t.collapsed) !== 0);
    await Promise.all(targets.map((t) => updateTask(t.id, { collapsed: 0 })));
  }, [tasks, parentTaskIds, updateTask]);

  const [addingRootPosition, setAddingRootPosition] = useState<'top' | 'bottom' | null>(null);
  const [addingRootTitle, setAddingRootTitle] = useState('');

  const addRootTaskAtBottom = useCallback(async (title: string) => {
    if (!title.trim()) return;
    await addTask(title.trim(), filterDefaultProjectId, null, filterDefaultStatusId);
  }, [addTask, filterDefaultProjectId, filterDefaultStatusId]);

  const addRootTaskAtTop = useCallback(async (title: string) => {
    if (!title.trim()) return;
    const newId = await addTask(title.trim(), filterDefaultProjectId, null, filterDefaultStatusId);
    if (!newId) return;

    const rootIds = tasks
      .filter((t) => t.parent_id === null)
      .sort((a, b) => a.position - b.position)
      .map((t) => t.id)
      .filter((id) => id !== newId);

    await batchUpdatePositions([
      { id: newId, position: 0 },
      ...rootIds.map((id, index) => ({ id, position: index + 1 })),
    ]);
  }, [addTask, filterDefaultProjectId, filterDefaultStatusId, tasks, batchUpdatePositions]);

  const addRootTaskAfter = useCallback(async (afterId: string, title: string) => {
    if (!title.trim()) return;
    const sortedRoots = tasks
      .filter((t) => t.parent_id === null)
      .sort((a, b) => a.position - b.position);
    const afterIdx = sortedRoots.findIndex((t) => t.id === afterId);
    const newId = await addTask(title.trim(), filterDefaultProjectId, null, filterDefaultStatusId);
    if (!newId) return;
    const idsWithout = sortedRoots.map((t) => t.id).filter((id) => id !== newId);
    const insertAt = afterIdx + 1;
    const reordered = [
      ...idsWithout.slice(0, insertAt),
      newId,
      ...idsWithout.slice(insertAt),
    ];
    await batchUpdatePositions(reordered.map((id, index) => ({ id, position: index })));
  }, [addTask, filterDefaultProjectId, filterDefaultStatusId, tasks, batchUpdatePositions]);

  const startAddingRoot = useCallback((position: 'top' | 'bottom') => {
    setAddingRootPosition(position);
    setAddingRootTitle('');
  }, []);

  const cancelAddingRoot = useCallback(() => {
    setAddingRootPosition(null);
    setAddingRootTitle('');
  }, []);

  const confirmAddingRoot = useCallback(async () => {
    if (!addingRootTitle.trim() || !addingRootPosition) return;
    if (addingRootPosition === 'top') {
      await addRootTaskAtTop(addingRootTitle);
    } else {
      await addRootTaskAtBottom(addingRootTitle);
    }
    cancelAddingRoot();
  }, [addingRootTitle, addingRootPosition, addRootTaskAtTop, addRootTaskAtBottom, cancelAddingRoot]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDetailId, setActiveDetailId] = useState<string | null>(null);

  useEffect(() => {
    const handleOpenDetail = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveDetailId(customEvent.detail.taskId);
    };
    window.addEventListener('open-task-detail', handleOpenDetail);
    return () => window.removeEventListener('open-task-detail', handleOpenDetail);
  }, []);

  const dragOverlayModifier: Modifier = ({ transform }) => {
    return transform;
  };

  const [scale, setScale] = useState(1);
  const [forcedCollapsedRootIds, setForcedCollapsedRootIds] = useState<Set<string> | null>(null);
  // Scroll correction: after collapse/restore, move viewport so the card stays under the mouse
  const scrollCorrectionRef = useRef<{
    cardId: string;
    cardScreenX: number;
    cardScreenY: number;
  } | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const panStateRef = useRef<PanState | null>(null);
  const panPointerIdRef = useRef<number | null>(null);
  const scaleRef = useRef(1);
  const centeredRef = useRef(false);
  const gestureBaseScaleRef = useRef(1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const clampScale = useCallback((nextScale: number) => {
    let lowerBound = MIN_SCALE;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (viewport && content) {
      // Get the true width/height of the content box regardless of CSS transform
      const rect = content.getBoundingClientRect();
      const currentScale = scaleRef.current;
      
      const unscaledHeight = rect.height / currentScale;
      const unscaledWidth = rect.width / currentScale;
      
      const vh = viewport.clientHeight;
      const vw = viewport.clientWidth;
      
      const padding = 100;
      // The scale needed to exactly fit the content
      const fitScale = Math.min((vh - padding) / (unscaledHeight || 1), (vw - padding) / (unscaledWidth || 1));
      
      // Stop zooming out when content fits the viewport
      lowerBound = Math.max(fitScale, 0.05);
    }
    
    return Math.min(MAX_SCALE, Math.max(lowerBound, nextScale));
  }, []);

  const zoomAtPoint = useCallback((clientX: number, clientY: number, nextScale: number) => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const clampedScale = clampScale(nextScale);
    const currentScale = scaleRef.current;
    if (Math.abs(clampedScale - currentScale) < 0.0001) return;

    const rect = viewport.getBoundingClientRect();
    const offsetX = clientX - rect.left;
    const offsetY = clientY - rect.top;
    const contentX = ((viewport.scrollLeft + offsetX) - CANVAS_ORIGIN) / currentScale;
    const contentY = ((viewport.scrollTop + offsetY) - CANVAS_ORIGIN) / currentScale;
    const nextScrollLeft = CANVAS_ORIGIN + contentX * clampedScale - offsetX;
    const nextScrollTop = CANVAS_ORIGIN + contentY * clampedScale - offsetY;

    scaleRef.current = clampedScale;
    flushSync(() => {
      setScale(clampedScale);
    });
    viewport.scrollLeft = nextScrollLeft;
    viewport.scrollTop = nextScrollTop;
  }, [clampScale]);

  const treeForest = useMemo(() => {
    const map = new Map<string, Task & { children: (Task & { children: any[] })[] }>();
    const roots: (Task & { children: any[] })[] = [];

    for (const t of tasks) {
      map.set(t.id, { ...t, children: [] });
    }

    const keepNode = new Set<string>();
    const markKeep = (id: string) => {
      let current: string | null = id;
      while (current && !keepNode.has(current)) {
        keepNode.add(current);
        const node = map.get(current);
        current = node?.parent_id || null;
      }
    };
    
    for (const t of tasks) {
      if (filteredTasks.has(t.id)) {
        markKeep(t.id);
      }
    }

    for (const t of tasks) {
      if (!keepNode.has(t.id)) continue;
      const node = map.get(t.id)!;
      if (t.parent_id && map.has(t.parent_id) && keepNode.has(t.parent_id)) {
        map.get(t.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }, [tasks, filteredTasks]);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || centeredRef.current) return;

    centeredRef.current = true;
    requestAnimationFrame(() => {
      const current = viewportRef.current;
      if (!current) return;
      current.scrollLeft = CANVAS_ORIGIN - current.clientWidth / 2;
      current.scrollTop = CANVAS_ORIGIN - current.clientHeight / 2;
    });
  }, []);

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const handleWheel = (event: WheelEvent) => {
      // Zoom with Cmd/Ctrl
      if (mouseWheelZoom || event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const factor = invertMouseWheelZoom ? 1 : -1;
        zoomAtPoint(event.clientX, event.clientY, scaleRef.current + event.deltaY * 0.0015 * factor);
        return;
      }
      
      // Pan manually to bypass macOS native scroll axis-locking
      event.preventDefault();
      
      // Handle different delta modes (pixels vs lines) for mouse wheels over trackpads
      const multiplier = event.deltaMode === 1 ? 40 : 1;
      let dx = event.deltaX * multiplier;
      let dy = event.deltaY * multiplier;

      // Map Shift+Wheel to horizontal scrolling for standard mice
      if (event.shiftKey && event.deltaX === 0) {
        dx = event.deltaY * multiplier;
        dy = 0;
      }

      viewport.scrollLeft += dx;
      viewport.scrollTop += dy;
    };

    const handleGestureStart = (event: Event) => {
      event.preventDefault();
      gestureBaseScaleRef.current = scaleRef.current;
    };

    const handleGestureChange = (event: Event) => {
      const gestureEvent = event as WebKitGestureEvent;
      event.preventDefault();
      zoomAtPoint(
        gestureEvent.clientX,
        gestureEvent.clientY,
        gestureBaseScaleRef.current * gestureEvent.scale
      );
    };

    viewport.addEventListener('wheel', handleWheel, { passive: false });
    viewport.addEventListener('gesturestart', handleGestureStart as EventListener, { passive: false });
    viewport.addEventListener('gesturechange', handleGestureChange as EventListener, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleWheel);
      viewport.removeEventListener('gesturestart', handleGestureStart as EventListener);
      viewport.removeEventListener('gesturechange', handleGestureChange as EventListener);
    };
  }, [zoomAtPoint, mouseWheelZoom, invertMouseWheelZoom]);

  useEffect(() => {
    if (!isPanning) return;

    const previousUserSelect = document.body.style.userSelect;
    const previousCursor = document.body.style.cursor;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'grabbing';

    return () => {
      document.body.style.userSelect = previousUserSelect;
      document.body.style.cursor = previousCursor;
    };
  }, [isPanning]);

  const stopPanning = useCallback((pointerId?: number) => {
    if (pointerId !== undefined && panPointerIdRef.current !== pointerId) return;
    panStateRef.current = null;
    panPointerIdRef.current = null;
    setIsPanning(false);
  }, []);

  const handleViewportPointerDownCapture = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const isLeftClick = event.button === 0;
    const isMiddleClick = event.button === 1;

    // We only care about left or middle clicks for panning
    if (!isLeftClick && !isMiddleClick) return;

    // For left clicks, ensure we are not clicking on a tree card or interactable element.
    if (isLeftClick) {
      const target = event.target as HTMLElement;
      // We allow panning on empty spaces, gaps, padding, and connector lines.
      // But prevent it if clicked explicitly on a TreeCard or a button component.
      if (
        target.closest('[data-tree-card="true"]') ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('[data-modal="true"]') ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('select')
      ) {
        return; // Clicked on a card or interactive element, let normal click/drag handle it
      }
      
      // Prevent panning if clicking near the scrollbars
      const viewport = viewportRef.current;
      if (viewport) {
        const rect = viewport.getBoundingClientRect();
        const scrollbarSize = Math.max(viewport.offsetWidth - viewport.clientWidth, 16);
        if (event.clientX >= rect.right - scrollbarSize || event.clientY >= rect.bottom - scrollbarSize) {
          return;
        }
      }
    }

    const viewport = viewportRef.current;
    if (!viewport) return;

    event.preventDefault();
    event.stopPropagation();
    viewport.setPointerCapture(event.pointerId);
    panPointerIdRef.current = event.pointerId;
    panStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: viewport.scrollLeft,
      startScrollTop: viewport.scrollTop,
    };
    setIsPanning(true);
  }, []);

  const handleViewportPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (panPointerIdRef.current !== event.pointerId) return;

    const viewport = viewportRef.current;
    const panState = panStateRef.current;
    if (!viewport || !panState) return;

    event.preventDefault();
    event.stopPropagation();

    viewport.scrollLeft = panState.startScrollLeft - (event.clientX - panState.startX);
    viewport.scrollTop = panState.startScrollTop - (event.clientY - panState.startY);
  }, []);

  const handleViewportPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (panPointerIdRef.current !== event.pointerId) return;

    const viewport = viewportRef.current;
    if (viewport && viewport.hasPointerCapture(event.pointerId)) {
      viewport.releasePointerCapture(event.pointerId);
    }
    stopPanning(event.pointerId);
  }, [stopPanning]);

  const handleViewportPointerCancel = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    stopPanning(event.pointerId);
  }, [stopPanning]);

  const handleDragStart = (event: DragStartEvent) => {
    const draggedId = event.active.id.toString();

    // Record the card's current screen position before collapsing
    const cardEl = viewportRef.current?.querySelector(`[data-task-id="${draggedId}"]`);
    if (cardEl) {
      const rect = cardEl.getBoundingClientRect();
      scrollCorrectionRef.current = {
        cardId: draggedId,
        cardScreenX: rect.left,
        cardScreenY: rect.top,
      };
    }

    setActiveId(draggedId);

    // Force-collapse all expanded root trees (locally, no DB writes)
    const expanded = new Set<string>();
    for (const root of treeForest) {
      if (root.children?.length > 0 && root.collapsed !== 1) {
        expanded.add(root.id.toString());
      }
    }
    if (expanded.size > 0) {
      setForcedCollapsedRootIds(expanded);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const draggedId = activeId;
    // Record card position before restoring
    if (draggedId) {
      const activeRect = event.active.rect.current.translated;
      if (activeRect) {
        scrollCorrectionRef.current = {
          cardId: draggedId,
          cardScreenX: activeRect.left,
          cardScreenY: activeRect.top,
        };
      } else {
        const cardEl = viewportRef.current?.querySelector(`[data-task-id="${draggedId}"]`);
        if (cardEl) {
          const rect = cardEl.getBoundingClientRect();
          scrollCorrectionRef.current = {
            cardId: draggedId,
            cardScreenX: rect.left,
            cardScreenY: rect.top,
          };
        }
      }
    }

    setActiveId(null);
    setForcedCollapsedRootIds(null);

    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = treeForest.map(r => r.id.toString());
    const oldIndex = ids.indexOf(active.id.toString());
    const newIndex = ids.indexOf(over.id.toString());
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    const updates: { id: string; position: number }[] = [];
    reordered.forEach((id, i) => {
      const task = tasks.find(t => t.id === id);
      if (task && task.position !== i) updates.push({ id, position: i });
    });
    if (updates.length > 0) batchUpdatePositions(updates);
  };

  const handleDragCancel = () => {
    const draggedId = activeId;
    if (draggedId) {
      const cardEl = viewportRef.current?.querySelector(`[data-task-id="${draggedId}"]`);
      if (cardEl) {
        const rect = cardEl.getBoundingClientRect();
        scrollCorrectionRef.current = {
          cardId: draggedId,
          cardScreenX: rect.left,
          cardScreenY: rect.top,
        };
      }
    }
    setActiveId(null);
    setForcedCollapsedRootIds(null);
  };

  // After collapse/restore re-render, adjust scroll so card stays in place
  useLayoutEffect(() => {
    const correction = scrollCorrectionRef.current;
    if (!correction) return;
    const viewport = viewportRef.current;
    if (!viewport) return;

    const cardEl = viewport.querySelector(`[data-task-id="${correction.cardId}"]`);
    if (!cardEl) {
      scrollCorrectionRef.current = null;
      return;
    }

    const newRect = cardEl.getBoundingClientRect();
    const deltaX = newRect.left - correction.cardScreenX;
    const deltaY = newRect.top - correction.cardScreenY;

    viewport.scrollLeft += deltaX;
    viewport.scrollTop += deltaY;
    scrollCorrectionRef.current = null;
  }, [forcedCollapsedRootIds, activeId]);

  const findNode = (nodes: any[], id: string): any => {
    for (const node of nodes) {
      if (node.id.toString() === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const rootAddStripClassName = 'w-[280px] h-10 rounded-xl border border-dashed border-slate-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 text-slate-400 dark:text-neutral-500 flex items-center justify-center opacity-0 hover:opacity-100 hover:border-brand-300 hover:bg-white dark:hover:bg-neutral-800 hover:text-brand-500 dark:hover:text-brand-400 transition-all shadow-sm self-start';

  const rootAddInput = () => (
    <div className="w-[280px] self-start rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 shadow-sm px-2.5 py-2">
      <input
        autoFocus
        type="text"
        value={addingRootTitle}
        onChange={(e) => setAddingRootTitle(e.target.value)}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void confirmAddingRoot();
          if (e.key === 'Escape') cancelAddingRoot();
        }}
        placeholder={t(language, 'placeholder_task_name')}
        className="w-full text-sm bg-transparent text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => void confirmAddingRoot()}
          className="text-xs px-2.5 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 transition"
        >
          {t(language, 'add')}
        </button>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={cancelAddingRoot}
          className="text-xs px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
        >
          {t(language, 'cancel')}
        </button>
      </div>
    </div>
  );

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
        <Tooltip id="collapse-all">
          <button
            type="button"
            onClick={() => void collapseAll()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
          >
            <ChevronsRightLeft className="w-3.5 h-3.5" />
            {t(language, 'btn_collapse_all')}
          </button>
        </Tooltip>
        <Tooltip id="expand-all">
          <button
            type="button"
            onClick={() => void expandAll()}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600"
          >
            <ChevronsLeftRight className="w-3.5 h-3.5" />
            {t(language, 'btn_expand_all')}
          </button>
        </Tooltip>
      </div>

      <div
        ref={viewportRef}
        onPointerDownCapture={handleViewportPointerDownCapture}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerCancel}
        onLostPointerCapture={() => stopPanning()}
        className={`flex-1 overflow-auto bg-slate-50 dark:bg-neutral-900 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
      <div
        className="relative"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        data-canvas-bg="true"
      >
        <div data-canvas-bg="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:32px_32px] dark:bg-[radial-gradient(circle_at_center,rgba(82,82,91,0.24)_1px,transparent_1px)]" />
        <div
        ref={contentRef}
        className="group/tree absolute flex flex-col gap-6 p-8"
        style={{
          left: CANVAS_ORIGIN,
          top: CANVAS_ORIGIN,
          transform: `scale(${scale})`,
            transformOrigin: '0 0',
            width: 'max-content',
          }}
        >
          {treeForest.length > 0 && addingRootPosition === 'top' && (
            <div className="self-start -mb-2">
              {rootAddInput()}
            </div>
          )}
          {treeForest.length > 0 && addingRootPosition !== 'top' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => startAddingRoot('top')}
              className={rootAddStripClassName}
              title="Add root task at top"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={treeForest.map(r => r.id.toString())}
              strategy={verticalListSortingStrategy}
            >
                {treeForest.map((root: any, idx: number, arr: any[]) => (
                  <TreeNode
                    key={root.id}
                    node={root}
                    isRoot={true}
                    isLast={idx === arr.length - 1}
                    canvasScale={scale}
                    isSiblingDragging={!!activeId}
                    forcedCollapsedIds={forcedCollapsedRootIds ?? undefined}
                    onAddSiblingBelow={(title) => addRootTaskAfter(root.id, title)}
                  />
                ))}
            </SortableContext>
            {typeof window !== 'undefined' && createPortal(
              <DragOverlay zIndex={20} dropAnimation={null} modifiers={[dragOverlayModifier]}>
                {activeId ? (() => {
                  const activeTree = findNode(treeForest, activeId);
                  if (!activeTree) return null;

                  return (
                    <div style={{ opacity: 1, pointerEvents: 'none', transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                      <TreeNode
                        node={activeTree}
                        isRoot={activeTree.parent_id === null}
                        isOverlay={true}
                        canvasScale={scale}
                      />
                    </div>
                  );
                })() : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>

          {treeForest.length > 0 && addingRootPosition === 'bottom' && (
            <div className="self-start -mt-2">
              {rootAddInput()}
            </div>
          )}
          {treeForest.length > 0 && addingRootPosition !== 'bottom' && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => startAddingRoot('bottom')}
              className={rootAddStripClassName}
              title="Add root task at bottom"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}

          {treeForest.length === 0 && (
            <div className="flex min-h-[240px] min-w-[320px] flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-slate-200 bg-white/80 p-12 text-slate-400 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/70">
              {addingRootPosition === 'top' ? (
                rootAddInput()
              ) : (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => startAddingRoot('top')}
                  className="w-8 h-8 rounded-full border border-dashed border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 flex items-center justify-center hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400 transition-all shadow-sm"
                  title="Add root task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
              <div>No tasks found.</div>
            </div>
          )}
        </div>
      </div>
      {activeDetailId && (
        <TaskDetailModal taskId={activeDetailId} onClose={() => setActiveDetailId(null)} />
      )}
    </div>
    </div>
  );
};
