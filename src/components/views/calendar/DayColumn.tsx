import { useMemo, useRef } from 'react';
import { NowIndicator } from './NowIndicator';
import { TimeEntryBlock } from './TimeEntryBlock';
import { isToday, layoutDayEntries, pxToTime, snapToMinutes, timeToPx, type CalendarEntry } from './calendarUtils';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  day: Date;
  hourHeight: number;
  entries: CalendarEntry[];
  onEntryClick: (entryId: string, e: React.MouseEvent) => void;
  onEntryDragStart?: (entryId: string, e: React.MouseEvent) => void;
  onEntryResizeStart?: (entryId: string, edge: 'top' | 'bottom', e: React.MouseEvent) => void;
  onSlotClick?: (time: number) => void;
  /** highlight a drop indicator at this epoch ms (from external sidebar drag) */
  dropIndicatorTime?: number | null;
  /** draw-create: called when user starts drawing a new entry on the grid */
  onDrawStart?: (startTime: number, day: Date, e: React.MouseEvent) => void;
  /** draw-create: ghost block being drawn, or null */
  drawGhost?: { startTime: number; endTime: number } | null;
}

export const DayColumn = ({
  day,
  hourHeight,
  entries,
  onEntryClick,
  onEntryDragStart,
  onEntryResizeStart,
  onSlotClick,
  dropIndicatorTime,
  onDrawStart,
  drawGhost,
}: Props) => {
  const todayCol = isToday(day);
  const totalHeight = 24 * hourHeight;
  const colRef = useRef<HTMLDivElement>(null);

  const layoutEntries = useMemo(() => layoutDayEntries(entries), [entries]);

  const handleColumnMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Only fire on background (not on an entry block)
    if ((e.target as HTMLElement).closest('[data-entry]')) return;
    if (!colRef.current || !onDrawStart) return;
    const rect = colRef.current.getBoundingClientRect();
    const py = e.clientY - rect.top;
    const raw = pxToTime(py, day, hourHeight);
    onDrawStart(raw, day, e);
  };

  const handleColumnClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSlotClick || !colRef.current) return;
    if ((e.target as HTMLElement).closest('[data-entry]')) return;
    const rect = colRef.current.getBoundingClientRect();
    const py = e.clientY - rect.top;
    const raw = pxToTime(py, day, hourHeight);
    onSlotClick(snapToMinutes(raw, 15));
  };

  return (
    <div
      ref={colRef}
      data-day-col={day.toISOString()}
      className={`flex-1 relative border-l border-slate-100 dark:border-neutral-700/50 ${todayCol ? 'bg-brand-50/20 dark:bg-brand-900/10' : ''}`}
      style={{ height: totalHeight }}
      onMouseDown={handleColumnMouseDown}
      onClick={handleColumnClick}
    >
      {/* Hour lines */}
      {HOURS.map((h) => (
        <div
          key={h}
          className="absolute left-0 right-0 border-t border-slate-100 dark:border-neutral-700/50"
        />
      ))}
      {/* Half-hour lines */}
      {HOURS.map((h) => (
        <div
          key={`hh-${h}`}
          className="absolute left-0 right-0 border-t border-slate-50 dark:border-neutral-700/25"
          style={{ top: (h + 0.5) * hourHeight }}
        />
      ))}
      {/* Top border closure */}
      <div className="absolute left-0 right-0 top-0 border-t border-slate-100 dark:border-neutral-700/50" />

      {/* Now indicator */}
      {todayCol && <NowIndicator dayStart={day} hourHeight={hourHeight} />}

      {/* Drop indicator while dragging */}
      {dropIndicatorTime != null && (
        <div
          className="absolute left-1 right-1 h-0.5 bg-brand-400 z-30 pointer-events-none rounded-full"
          style={{ top: ((dropIndicatorTime - day.getTime()) / 3_600_000) * hourHeight }}
        />
      )}

      {/* Time entry blocks */}
      {layoutEntries.map((le) => (
        <div key={le.entry.id} data-entry="1">
          <TimeEntryBlock
            layoutEntry={le}
            dayStart={day}
            hourHeight={hourHeight}
            onClick={onEntryClick}
            onDragStart={onEntryDragStart}
            onResizeStart={onEntryResizeStart}
          />
        </div>
      ))}

      {/* Draw-to-create ghost block */}
      {drawGhost && (() => {
        const gTop = timeToPx(drawGhost.startTime, day, hourHeight);
        const gBottom = timeToPx(drawGhost.endTime, day, hourHeight);
        const gHeight = Math.max(4, gBottom - gTop);
        return (
          <div
            className="absolute left-1 right-1 rounded pointer-events-none z-20 border border-brand-400 bg-brand-100/40 dark:bg-brand-800/30"
            style={{ top: gTop, height: gHeight }}
          />
        );
      })()}
    </div>
  );
};
