import { timeToPx, formatTime, formatDuration, type LayoutEntry } from './calendarUtils';
import { useRef } from 'react';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { t } from '../../../i18n';

interface Props {
  layoutEntry: LayoutEntry;
  dayStart: Date;
  hourHeight: number;
  onClick: (entryId: string, e: React.MouseEvent) => void;
  onDragStart?: (entryId: string, e: React.MouseEvent) => void;
  onResizeStart?: (entryId: string, edge: 'top' | 'bottom', e: React.MouseEvent) => void;
}

export const TimeEntryBlock = ({ layoutEntry, dayStart, hourHeight, onClick, onDragStart, onResizeStart }: Props) => {
  const { entry, col, colCount } = layoutEntry;
  const { language } = useSettingsStore();
  const clickStartRef = useRef<{ x: number, y: number } | null>(null);

  const top = timeToPx(entry.startTime, dayStart, hourHeight);
  const bottom = timeToPx(entry.endTime, dayStart, hourHeight);
  const MIN_BLOCK_PX = 20; // ~one line of text
  const height = Math.max(MIN_BLOCK_PX, bottom - top);
  const isShort = height < 38;
  const durationSec = Math.round((entry.endTime - entry.startTime) / 1000);

  // Column layout: divide width evenly among overlapping cols
  const gutterPx = 2;
  const colLeft = colCount > 0 ? `calc(${(col / colCount) * 100}% + ${gutterPx}px)` : `${gutterPx}px`;
  const colRight = colCount > 0 ? `calc(${((colCount - col - 1) / colCount) * 100}% + ${gutterPx}px)` : `${gutterPx}px`;

  return (
    <div
      className={`absolute cursor-pointer select-none rounded-[2px]
        transition-opacity hover:opacity-90 active:opacity-75
        ${entry.isActive ? 'ring-2 ring-red-400 ring-offset-1' : ''}
      `}
      style={{
        top,
        height,
        left: colLeft,
        right: colRight,
        backgroundColor: `${entry.color}33`,
        borderColor: `${entry.color}99`,
        borderWidth: '1px',
        borderStyle: 'solid',
        zIndex: 5 + col,
      }}
      onClick={(e) => {
        e.stopPropagation();
        let isDrag = false;
        if (clickStartRef.current) {
          const dx = e.clientX - clickStartRef.current.x;
          const dy = e.clientY - clickStartRef.current.y;
          if (dx * dx + dy * dy > 25) { // 5px radius to distinguish drag from pure click
            isDrag = true;
          }
        }
        if (!isDrag) {
          onClick(entry.id, e);
        }
      }}
      onMouseDown={(e) => {
        clickStartRef.current = { x: e.clientX, y: e.clientY };
        if (e.button !== 0 || !onDragStart) return;
        // Only start drag from the middle zone (not top/bottom 5 px which are resize handles)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const relY = e.clientY - rect.top;
        if (relY < 5 || relY > rect.height - 5) return;
        e.stopPropagation();
        onDragStart(entry.id, e);
      }}
    >
      {/* Top resize handle — tight 5px zone */}
      {onResizeStart && (
        <div
          className="absolute top-0 left-0 right-0 h-[5px] cursor-ns-resize z-10"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(entry.id, 'top', e); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {/* Bottom resize handle — tight 5px zone */}
      {onResizeStart && (
        <div
          className="absolute bottom-0 left-0 right-0 h-[5px] cursor-ns-resize z-10"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(entry.id, 'bottom', e); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="px-1.5 py-0.5 h-full flex flex-col justify-start overflow-hidden">
        <div className="text-slate-900 dark:text-neutral-200 text-[11px] font-semibold leading-tight truncate">
          {entry.taskTitle}
        </div>
        {!isShort && (
          <div className="text-slate-700 dark:text-neutral-200 text-[10px] leading-tight truncate mt-0.5">
            {formatTime(entry.startTime)} – {entry.isActive ? `▶ ${t(language, 'text_running')}` : formatTime(entry.endTime)}
          </div>
        )}
        {!isShort && durationSec > 60 && (
          <div className="text-slate-600 dark:text-neutral-300 text-[10px] leading-tight">
            {formatDuration(durationSec)}
          </div>
        )}
      </div>
    </div>
  );
};
