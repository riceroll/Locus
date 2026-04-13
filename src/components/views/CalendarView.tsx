import { useCallback, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { CalendarGrid } from './calendar/CalendarGrid';
import { TaskSidebar } from './calendar/TaskSidebar';
import { TimeEntryPopup } from './calendar/TimeEntryPopup';
import { TaskDetailModal } from './TaskDetailModal';
import { TaskCard } from './calendar/TaskCard';
import { useTaskStore } from '../../store/useTaskStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useTimerStore } from '../../store/useTimerStore';
import { snapToMinutes } from './calendar/calendarUtils';

export const CalendarView = () => {
  const { tasks } = useTaskStore();
  const { statuses } = useStatusStore();
  const { createEntry } = useTimerStore();

  const [popupEntryId, setPopupEntryId] = useState<string | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<HTMLElement | null>(null);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{ day: Date; time: number } | null>(null);

  const triggerRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  const dropTimeRef = useRef<{ time: number; day: Date } | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragStart = (e: DragStartEvent) => {
    const id = e.active.id as string;
    if (id.startsWith('sidebar-task:')) setDraggingTaskId(id.slice(13));
  };

  const handleDragMove = (e: DragMoveEvent) => {
    if (!e.active.id.toString().startsWith('sidebar-task:')) return;
    const event = e.activatorEvent as MouseEvent;
    const x = event.clientX + e.delta.x;
    const y = event.clientY + e.delta.y;
    // elementsFromPoint returns all elements stacked at x,y (top-to-bottom),
    // so we can find the DayColumn underneath the DragOverlay ghost.
    const stack = document.elementsFromPoint(x, y);
    const dayColEl = stack.find((el) => (el as HTMLElement).dataset?.dayCol) as HTMLElement | null;
    if (dayColEl) {
      const dayStr = dayColEl.dataset.dayCol!;
      const day = new Date(dayStr);
      const rect = dayColEl.getBoundingClientRect();
      const relY = y - rect.top;
      // totalHeight = 24 * hourHeight, so ms per px = 24 * 3600000 / totalHeight
      const rawTime = day.getTime() + (relY / dayColEl.clientHeight) * 86_400_000;
      const snapped = snapToMinutes(rawTime, 15);
      dropTimeRef.current = { time: snapped, day };
      setDropIndicator({ day, time: snapped });
    } else {
      dropTimeRef.current = null;
      setDropIndicator(null);
    }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setDraggingTaskId(null);
    setDropIndicator(null);
    if (!e.active.id.toString().startsWith('sidebar-task:')) return;
    const taskId = e.active.id.toString().slice(13);
    if (!dropTimeRef.current) return;
    const { time } = dropTimeRef.current;
    dropTimeRef.current = null;
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const durationMs = (task.estimate ?? 30) * 60_000;
    const startTime = snapToMinutes(time, 15);
    await createEntry(taskId, startTime, startTime + durationMs);
    triggerRefresh();
  };

  const draggingTask = draggingTaskId ? tasks.find((t) => t.id === draggingTaskId) : null;
  const draggingStatus = draggingTask ? statuses.find((s) => s.id === draggingTask.status_id) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-hidden bg-white dark:bg-neutral-900">
        <div className="flex-1 min-w-0 border-r border-neutral-200 dark:border-neutral-700/50">
          <CalendarGrid
            onEntryClick={(id, el) => { setPopupEntryId(id); setPopupAnchor(el); }}
            onSlotClick={(time, day) => { dropTimeRef.current = { time, day }; }}
            refreshKey={refreshKey}
            dropIndicator={dropIndicator}
          />
        </div>
        <TaskSidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((v) => !v)}
          onTaskClick={(taskId) => setDetailTaskId(taskId)}
        />
      </div>

      {popupEntryId && (
        <TimeEntryPopup
          entryId={popupEntryId}
          anchorEl={popupAnchor}
          onClose={() => { setPopupEntryId(null); setPopupAnchor(null); }}
          onOpenTask={(taskId) => setDetailTaskId(taskId)}
          onDataChanged={triggerRefresh}
        />
      )}

      {detailTaskId && (
        <TaskDetailModal taskId={detailTaskId} onClose={() => setDetailTaskId(null)} />
      )}

      <DragOverlay dropAnimation={null}>
        {draggingTask && draggingStatus ? (
          <div className="opacity-80 rotate-2 scale-105">
            <TaskCard
              task={draggingTask}
              statusName={draggingStatus.name}
              statusColor={draggingStatus.color}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
