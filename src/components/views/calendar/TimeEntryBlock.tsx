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

  const rawTop = timeToPx(entry.startTime, dayStart, hourHeight);
  const rawBottom = timeToPx(entry.endTime, dayStart, hourHeight);
  const maxPx = 24 * hourHeight;
  
  // Clamp logic for cross-day tasks
  const top = Math.max(0, Math.min(rawTop, maxPx));
  const bottom = Math.max(0, Math.min(rawBottom, maxPx));
  
  const MIN_BLOCK_PX = 1; // Allow down to ~1 min visually
  const height = Math.max(MIN_BLOCK_PX, bottom - top);
  const isShort = height < 38;
  const isTiny = height < 14;
  const durationSec = Math.round((entry.endTime - entry.startTime) / 1000);

  // Column layout: divide width evenly among overlapping cols
  const gutterPx = 2;
  const colLeft = colCount > 0 ? `calc(${(col / colCount) * 100}% + ${gutterPx}px)` : `${gutterPx}px`;
  const colRight = colCount > 0 ? `calc(${((colCount - col - 1) / colCount) * 100}% + ${gutterPx}px)` : `${gutterPx}px`;

  return (
    <div
      className={`group absolute cursor-pointer select-none
        transition-opacity hover:opacity-90 active:opacity-75 hover:!z-[100]
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
        borderTopWidth: rawTop < 0 ? 0 : '1px',
        borderBottomWidth: rawBottom > maxPx ? 0 : '1px',
        borderTopLeftRadius: rawTop < 0 ? 0 : '2px',
        borderTopRightRadius: rawTop < 0 ? 0 : '2px',
        borderBottomLeftRadius: rawBottom > maxPx ? 0 : '2px',
        borderBottomRightRadius: rawBottom > maxPx ? 0 : '2px',
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
        // Only start drag from the middle zone (not top/bottom 3 px which are resize handles)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const relY = e.clientY - rect.top;
        if (relY < 3 || relY > rect.height - 3) return;
        e.stopPropagation();
        onDragStart(entry.id, e);
      }}
    >
      {/* Top resize handle — tight 3px zone */}
      {onResizeStart && rawTop >= 0 && (
        <div
          className="absolute top-[-1px] left-0 right-0 h-[4px] cursor-ns-resize z-10"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(entry.id, 'top', e); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      {/* Bottom resize handle — tight 3px zone */}
      {onResizeStart && !entry.isActive && rawBottom <= maxPx && (
        <div
          className="absolute bottom-[-1px] left-0 right-0 h-[4px] cursor-ns-resize z-10"
          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); onResizeStart(entry.id, 'bottom', e); }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className={`px-1.5 h-full flex flex-col justify-start overflow-hidden relative z-10 pointer-events-none ${isTiny ? 'py-0' : 'py-0.5'}`}>
        {!isTiny && (
          <div className="text-slate-900 dark:text-neutral-200 text-[11px] font-semibold leading-tight truncate">
            {entry.taskTitle}
          </div>
        )}
        {!isShort && !isTiny && (
          <div className="text-slate-700 dark:text-neutral-200 text-[10px] leading-tight truncate mt-0.5">
            {formatTime(entry.startTime)} – {entry.isActive ? `▶ ${t(language, 'text_running')}` : formatTime(entry.endTime)}
          </div>
        )}
        {!isShort && !isTiny && durationSec >= 60 && (
          <div className="text-slate-600 dark:text-neutral-300 text-[10px] leading-tight">
            {formatDuration(durationSec)}
          </div>
        )}
      </div>

      {/* Hover Concise Info Popup */}
      <div
        className={`pointer-events-none absolute left-full ml-2 w-max max-w-[260px] z-[110] transition-all duration-200 origin-left opacity-0 invisible group-hover:scale-100 group-hover:opacity-100 group-hover:visible ${
          height < 40 ? 'top-0 scale-95' : 'top-1/2 -translate-y-1/2 scale-95'
        }`}
      >
        <div className="bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-[0_12px_32px_-8px_rgba(0,0,0,0.2)] dark:shadow-black/60 rounded-xl p-3 flex flex-col gap-1.5 ring-1 ring-black/5 dark:ring-white/10">
          <div className="text-[13px] font-bold text-neutral-900 dark:text-neutral-50 leading-snug break-words">
            {entry.taskTitle}
          </div>
          <div className="flex items-center justify-between gap-4 text-[11px] font-medium text-neutral-500 dark:text-neutral-400 border-t border-neutral-100 dark:border-neutral-700/50 pt-1.5">
            <span className="flex-shrink-0">
              {formatTime(entry.startTime)} – {entry.isActive ? t(language, 'text_running') : formatTime(entry.endTime)}
            </span>
            {durationSec >= 60 && (
              <span className="text-brand-600 dark:text-brand-400 font-semibold bg-brand-50 dark:bg-brand-900/30 px-1.5 py-0.5 rounded">
                {formatDuration(durationSec)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
