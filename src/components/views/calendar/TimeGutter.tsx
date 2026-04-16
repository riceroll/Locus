import { formatHour } from './calendarUtils';

const HOURS = Array.from({ length: 25 }, (_, i) => i); // 0..24

export const TimeGutter = ({ hourHeight }: { hourHeight: number }) => (
  <div
    className="w-14 shrink-0 relative select-none border-r border-slate-200 dark:border-neutral-700/50 bg-slate-50 dark:bg-neutral-900"
    style={{ height: 24 * hourHeight }}
  >
    {HOURS.map((h) => (
      <div
        key={h}
        className="absolute right-0 left-0 flex justify-end pr-2"
        style={{ top: h * hourHeight - 9 }}
      >
        {h < 24 && (
          <span className="text-[10px] text-slate-400 dark:text-neutral-500 leading-none font-medium">
            {formatHour(h)}
          </span>
        )}
      </div>
    ))}
  </div>
);
