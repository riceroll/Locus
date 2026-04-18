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
  const { mouseWheelZoom } = useSettingsStore();

  const [activeId, setActiveId] = useState<string | null>(null);

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
  const { tasks, batchUpdatePositions } = useTaskStore();
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

    for (const t of tasks) {
      const node = map.get(t.id)!;
      if (t.parent_id && map.has(t.parent_id)) {
        map.get(t.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortByPos = (a: Task, b: Task) => (a.position - b.position) || (b.updated_at - a.updated_at);
    roots.sort(sortByPos);
    for (const node of map.values()) {
      node.children.sort(sortByPos);
    }

    return roots;
  }, [tasks]);

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
        zoomAtPoint(event.clientX, event.clientY, scaleRef.current - event.deltaY * 0.0015);
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
  }, [zoomAtPoint, mouseWheelZoom]);

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
        target.closest('[role="button"]')
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

  return (
    <div
      ref={viewportRef}
      onPointerDownCapture={handleViewportPointerDownCapture}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerUp}
      onPointerCancel={handleViewportPointerCancel}
      onLostPointerCapture={() => stopPanning()}
      className={`h-full overflow-auto bg-slate-50 dark:bg-neutral-900 ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
    >
      <div
        className="relative"
        style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        data-canvas-bg="true"
      >
        <div data-canvas-bg="true" className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(148,163,184,0.16)_1px,transparent_1px)] [background-size:32px_32px] dark:bg-[radial-gradient(circle_at_center,rgba(82,82,91,0.24)_1px,transparent_1px)]" />
        <div
        ref={contentRef}
        className="absolute flex flex-col gap-6 p-8"
        style={{
          left: CANVAS_ORIGIN,
          top: CANVAS_ORIGIN,
          transform: `scale(${scale})`,
            transformOrigin: '0 0',
            width: 'max-content',
          }}
        >
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

          {treeForest.length === 0 && (
            <div className="flex min-h-[240px] min-w-[320px] items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white/80 p-12 text-slate-400 shadow-sm backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-800/70">
              No tasks found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
