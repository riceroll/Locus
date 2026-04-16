import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { getDb } from '../../../db';
import { useTimerStore } from '../../../store/useTimerStore';
import { CalendarHeader } from './CalendarHeader';
import { DayColumn } from './DayColumn';
import { TimeGutter } from './TimeGutter';
import { NewEntryDialog } from './NewEntryDialog';
import {
  addDays,
  type CalendarEntry,
  getDaysForView,
  isSameDay,
  pxToTime,
  snapToMinutes,
  startOfDay,
} from './calendarUtils';

export const DEFAULT_HOUR_HEIGHT = 72;
const MIN_HOUR_HEIGHT = 36;
const MAX_HOUR_HEIGHT = 220;

interface DragState {
  entryId: string;
  /** pointer Y at drag start */
  startY: number;
  /** original entry startTime */
  origStartTime: number;
  /** original entry endTime */
  origEndTime: number;
  /** which day column the drag started in */
  origDay: Date;
  /** day index in current view at drag start */
  origDayIndex: number;
  /** current ghost time (epoch ms) */
  ghostStartTime: number;
}

interface ResizeState {
  entryId: string;
  edge: 'top' | 'bottom';
  startY: number;
  origStartTime: number;
  origEndTime: number;
  /** Live-updated ghost times shown during drag */
  ghostStartTime: number;
  ghostEndTime: number;
}

interface DrawState {
  /** epoch ms where the draw started (anchor) */
  anchorTime: number;
  /** day this draw belongs to */
  day: Date;
  /** current ghost start / end (min/max of anchor+cursor) */
  ghostStartTime: number;
  ghostEndTime: number;
  /** whether the pointer actually moved (if not → click → 15 min entry) */
  moved: boolean;
  /** screen Y of initial mousedown */
  startClientY: number;
  /** snap resolution: 1 or 15 minutes */
  snapMin: number;
}

interface Props {
  /** Called when user clicks a time-entry block */
  onEntryClick: (entryId: string, anchorEl: HTMLElement) => void;
  /** Called when user clicks an empty slot — create new entry */
  onSlotClick?: (time: number, day: Date) => void;
  /** Bump this to force a data re-fetch (e.g. after popup edits) */
  refreshKey?: number;
  /** Drop indicator for sidebar drag: which time+day to highlight */
  dropIndicator?: { day: Date; time: number } | null;
}

export const CalendarGrid = ({ onEntryClick, onSlotClick, refreshKey = 0, dropIndicator }: Props) => {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('week');
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [resize, setResize] = useState<ResizeState | null>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);
  const [newEntryDialog, setNewEntryDialog] = useState<{
    startTime: number; endTime: number; anchorX: number; anchorY: number;
  } | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { isRunning, activeTaskId, activeTaskTitle, activeEntryId, startTime, updateEntry } = useTimerStore();

  const days = useMemo(() => getDaysForView(currentDate, viewMode), [currentDate, viewMode]);

  // ── Fetch entries for visible range ─────────────────────────────────────────
  const loadEntries = useCallback(async () => {
    const db = await getDb();
    const rangeStart = days[0].getTime();
    const rangeEnd = addDays(days[days.length - 1], 1).getTime();

    const rows = await db.select<{
      id: string;
      task_id: string;
      start_time: number;
      end_time: number | null;
      title: string;
      project_color: string | null;
    }[]>(
      `SELECT te.id, te.task_id, te.start_time, te.end_time,
              t.title, p.color AS project_color
       FROM time_entries te
       JOIN tasks t ON te.task_id = t.id
       LEFT JOIN projects p ON t.project_id = p.id
       WHERE te.start_time >= $1 AND te.start_time < $2
       ORDER BY te.start_time ASC`,
      [rangeStart, rangeEnd],
    );

    const DEFAULT_COLOR = '#347285'; // Brand teal

    const mapped: CalendarEntry[] = rows
      .filter((r) => r.end_time !== null && r.id !== activeEntryId)
      .map((r) => ({
        id: r.id,
        taskId: r.task_id,
        taskTitle: r.title,
        color: r.project_color ?? DEFAULT_COLOR,
        startTime: r.start_time,
        endTime: r.end_time!,
        isActive: false,
      }));

    // Active running entry
    if (isRunning && activeEntryId && startTime && activeTaskTitle) {
      const activeStart = startTime;
      if (activeStart >= rangeStart && activeStart < rangeEnd) {
        mapped.push({
          id: activeEntryId,
          taskId: activeTaskId ?? '',
          taskTitle: activeTaskTitle,
          color: '#ef4444',
          startTime: activeStart,
          endTime: Date.now(),
          isActive: true,
        });
      }
    }

    setEntries(mapped);
  }, [days, refreshKey, isRunning, activeEntryId, activeTaskId, activeTaskTitle, startTime]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // Tick active entry end time every 30s
  useEffect(() => {
    if (!isRunning) return;
    const id = setInterval(() => {
      setEntries((prev) =>
        prev.map((e) => (e.isActive ? { ...e, endTime: Date.now() } : e)),
      );
    }, 30_000);
    return () => clearInterval(id);
  }, [isRunning]);

  // ── Scroll to current hour on mount ──────────────────────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      const now = new Date();
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - 2) * hourHeight);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ctrl/Meta+Wheel zoom ──────────────────────────────────────────────────────
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setHourHeight((h) => Math.min(MAX_HOUR_HEIGHT, Math.max(MIN_HOUR_HEIGHT, h - e.deltaY * 0.45)));
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Navigation ────────────────────────────────────────────────────────────────
  const step = viewMode === 'day' ? 1 : 7;
  const handlePrev = () => setCurrentDate((d) => addDays(d, -step));
  const handleNext = () => setCurrentDate((d) => addDays(d, step));
  const handleToday = () => setCurrentDate(new Date());

  // ── Per-day entry lookup ──────────────────────────────────────────────────────
  // ── Mouse-drag to reposition entries ─────────────────────────────────────────
  const handleEntryDragStart = useCallback((entryId: string, e: React.MouseEvent, columnDay: Date) => {
    e.preventDefault();
    const entry = entries.find((en) => en.id === entryId);
    if (!entry || entry.isActive) return;
    const entryDay = startOfDay(columnDay);
    const origDayIndex = Math.max(0, days.findIndex((d) => isSameDay(d, entryDay)));
    setDrag({
      entryId,
      startY: e.clientY,
      origStartTime: entry.startTime,
      origEndTime: entry.endTime,
      origDay: entryDay,
      origDayIndex,
      ghostStartTime: entry.startTime,
    });
  }, [entries, days]);

  const handleResizeStart = useCallback((entryId: string, edge: 'top' | 'bottom', e: React.MouseEvent, _columnDay: Date) => {
    e.preventDefault();
    const entry = entries.find((en) => en.id === entryId);
    if (!entry || (entry.isActive && edge === 'bottom')) return;
    setResize({
      entryId,
      edge,
      startY: e.clientY,
      origStartTime: entry.startTime,
      origEndTime: entry.endTime,
      ghostStartTime: entry.startTime,
      ghostEndTime: entry.endTime,
    });
  }, [entries]);

  useEffect(() => {
    if (!drag) return;

    const onMove = (e: MouseEvent) => {
      const deltaY = e.clientY - drag.startY;
      const deltaMs = (deltaY / hourHeight) * 3_600_000;
      // Detect which day column is under cursor, then shift by whole days.
      let dayOffset = 0;
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const dayColEl = stack.find((el) => (el as HTMLElement).dataset?.dayCol) as HTMLElement | undefined;
      if (dayColEl?.dataset.dayCol) {
        const hoverDay = new Date(dayColEl.dataset.dayCol);
        const hoverDayIndex = days.findIndex((d) => isSameDay(d, hoverDay));
        if (hoverDayIndex >= 0) {
          dayOffset = hoverDayIndex - drag.origDayIndex;
        }
      }
      const rawStart = drag.origStartTime + deltaMs + dayOffset * 86_400_000;
      const snapMin = e.metaKey || e.ctrlKey ? 1 : 15;
      const snapped = snapToMinutes(rawStart, snapMin);
      setDrag((prev) => prev ? { ...prev, ghostStartTime: snapped } : null);
    };

    const onUp = async (e: MouseEvent) => {
      if (!drag) return;
      const duration = drag.origEndTime - drag.origStartTime;
      const snapMin = e.metaKey || e.ctrlKey ? 1 : 15;
      const newStart = snapToMinutes(drag.ghostStartTime, snapMin);
      const newEnd = newStart + duration;
      setDrag(null);
      // Optimistic update
      setEntries((prev) =>
        prev.map((e) =>
          e.id === drag.entryId ? { ...e, startTime: newStart, endTime: newEnd } : e,
        ),
      );
      // Persist
      await updateEntry(drag.entryId, { start_time: newStart, end_time: newEnd });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [drag, days, hourHeight, updateEntry]);

  // ── Mouse resize (top/bottom edge) ───────────────────────────────────────────
  useEffect(() => {
    if (!resize) return;
    const MIN_DURATION = 1 * 60_000; // 1 min

    const onMove = (e: MouseEvent) => {
      const deltaY = e.clientY - resize.startY;
      const deltaMs = (deltaY / hourHeight) * 3_600_000;
      const snapMin = e.metaKey || e.ctrlKey ? 1 : 15;
      
      if (resize.edge === 'top') {
        const newStart = snapToMinutes(resize.origStartTime + deltaMs, snapMin);
        const clamped = Math.min(newStart, resize.origEndTime - MIN_DURATION);
        setResize((prev) => prev ? { ...prev, ghostStartTime: clamped } : null);
      } else {
        const newEnd = snapToMinutes(resize.origEndTime + deltaMs, snapMin);
        const clamped = Math.max(newEnd, resize.origStartTime + MIN_DURATION);
        setResize((prev) => prev ? { ...prev, ghostEndTime: clamped } : null);
      }
    };

    const onUp = async () => {
      if (!resize) return;
      const { entryId, ghostStartTime: newStart, ghostEndTime: newEnd } = resize;
      setResize(null);
      setEntries((prev) =>
        prev.map((e) => e.id === entryId ? { ...e, startTime: newStart, endTime: newEnd } : e),
      );
      await updateEntry(entryId, { start_time: newStart, end_time: newEnd });
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [resize, hourHeight, updateEntry]);

  // ── Draw-to-create (mousedown on empty grid background) ──────────────────────
  const handleDrawStart = useCallback((anchorTime: number, day: Date, e: React.MouseEvent) => {
    const snapMin = e.metaKey || e.ctrlKey ? 1 : 15;
    setDraw({
      anchorTime,
      day,
      ghostStartTime: anchorTime,
      ghostEndTime: anchorTime + 15 * 60_000,
      moved: false,
      startClientY: e.clientY,
      snapMin,
    });
  }, []);

  useEffect(() => {
    if (!draw) return;

    const onMove = (e: MouseEvent) => {
      const snapMin = e.metaKey || e.ctrlKey ? 1 : 15;
      // find the day column under cursor
      const stack = document.elementsFromPoint(e.clientX, e.clientY);
      const dayColEl = stack.find((el) => (el as HTMLElement).dataset?.dayCol) as HTMLElement | null;
      if (!dayColEl) return;
      const rect = dayColEl.getBoundingClientRect();
      const relY = e.clientY - rect.top;
      const cursorTime = snapToMinutes(pxToTime(relY, draw.day, hourHeight), snapMin);
      const moved = Math.abs(e.clientY - draw.startClientY) > 4;
      const startAnchor = moved ? snapToMinutes(draw.anchorTime, snapMin) : draw.anchorTime;
      const ghost = {
        ghostStartTime: Math.min(startAnchor, cursorTime),
        ghostEndTime: Math.max(startAnchor, cursorTime) || startAnchor + 15 * 60_000,
      };
      // Enforce minimum 1-minute height
      if (ghost.ghostEndTime <= ghost.ghostStartTime) ghost.ghostEndTime = ghost.ghostStartTime + 60_000;
      setDraw((prev) => prev ? { ...prev, ...ghost, moved, snapMin } : null);
    };

    const onUp = (e: MouseEvent) => {
      if (!draw) return;
      const { ghostStartTime, ghostEndTime, moved, anchorTime, day } = draw;
      setDraw(null);

      let finalStart: number;
      let finalEnd: number;
      if (!moved) {
        // Treat as click → exactly click time entry
        finalStart = anchorTime;
        finalEnd = finalStart + 15 * 60_000;
      } else {
        finalStart = ghostStartTime;
        finalEnd = Math.max(ghostEndTime, ghostStartTime + 60_000);
      }

      setNewEntryDialog({ startTime: finalStart, endTime: finalEnd, anchorX: e.clientX, anchorY: e.clientY });
      // Also call legacy onSlotClick if provided (e.g. for sidebar drag)
      onSlotClick?.(finalStart, day);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [draw, hourHeight, onSlotClick]);

  // Merge ghost position into entries during drag or resize
  const displayEntries = useMemo(() => {
    let result = entries;
    if (drag) {
      const duration = drag.origEndTime - drag.origStartTime;
      result = result.map((e) =>
        e.id === drag.entryId
          ? { ...e, startTime: drag.ghostStartTime, endTime: drag.ghostStartTime + duration }
          : e,
      );
    }
    if (resize) {
      result = result.map((e) =>
        e.id === resize.entryId
          ? { ...e, startTime: resize.ghostStartTime, endTime: resize.ghostEndTime }
          : e,
      );
    }
    return result;
  }, [entries, drag, resize]);

  const displayEntriesForDay = useCallback(
    (day: Date) => {
      const msDayStart = day.getTime();
      const msDayEnd = msDayStart + 24 * 3600 * 1000;
      return displayEntries.filter((e) => e.startTime < msDayEnd && e.endTime > msDayStart);
    },
    [displayEntries],
  );

  // ── Slot click ────────────────────────────────────────────────────────────────
  const handleSlotClick = useCallback((time: number, day: Date) => {
    onSlotClick?.(time, day);
  }, [onSlotClick]);

  return (
    <div ref={gridRef} className="flex flex-col h-full min-h-0 bg-slate-50 dark:bg-neutral-900">
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        days={days}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onViewModeChange={setViewMode}
      />

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ cursor: drag ? 'grabbing' : resize ? 'ns-resize' : draw ? 'crosshair' : 'default' }}
      >
        <div className="flex" style={{ minHeight: 24 * hourHeight }}>
          <TimeGutter hourHeight={hourHeight} />
          {days.map((day) => (
            <DayColumn
              key={day.toISOString()}
              day={day}
              hourHeight={hourHeight}
              entries={displayEntriesForDay(day)}
              onEntryClick={(id, e) => onEntryClick(id, e.currentTarget as HTMLElement)}
              onEntryDragStart={handleEntryDragStart}
              onEntryResizeStart={handleResizeStart}
              onSlotClick={(time) => handleSlotClick(time, day)}
              onDrawStart={handleDrawStart}
              drawGhost={draw && isSameDay(draw.day, day) ? { startTime: draw.ghostStartTime, endTime: draw.ghostEndTime } : null}
              dropIndicatorTime={
                dropIndicator && isSameDay(dropIndicator.day, day) ? dropIndicator.time : null
              }
            />
          ))}
        </div>
      </div>

      {/* Drag / resize / draw cursor overlay — prevents cursor flicker over child elements */}
      {(drag || resize || draw) && (
        <div className={`fixed inset-0 z-50 pointer-events-none ${drag ? 'cursor-grabbing' : draw ? 'cursor-crosshair' : 'cursor-ns-resize'}`} />
      )}

      {/* New entry dialog — shown after draw or click */}
      {newEntryDialog && (
        <NewEntryDialog
          startTime={newEntryDialog.startTime}
          endTime={newEntryDialog.endTime}
          anchorX={newEntryDialog.anchorX}
          anchorY={newEntryDialog.anchorY}
          onClose={() => setNewEntryDialog(null)}
          onCreated={loadEntries}
        />
      )}
    </div>
  );
};
