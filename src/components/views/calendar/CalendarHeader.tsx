import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateRange, isToday } from './calendarUtils';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { t } from '../../../i18n';

interface Props {
  currentDate: Date;
  viewMode: 'day' | 'week';
  days: Date[];
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onViewModeChange: (mode: 'day' | 'week') => void;
}

export const CalendarHeader = ({
  currentDate,
  viewMode,
  days,
  onPrev,
  onNext,
  onToday,
  onViewModeChange,
}: Props) => {
  const { language } = useSettingsStore();
  const weekdayFormatter = new Intl.DateTimeFormat(language === 'zh' ? 'zh-CN' : 'en-US', { weekday: 'short' });

  return (
  <div className="shrink-0 bg-white dark:bg-neutral-800 border-b border-slate-200 dark:border-neutral-700">
    {/* Top toolbar */}
    <div className="flex items-center gap-3 px-4 py-2.5">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          onClick={onPrev}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 transition"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onNext}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200 transition"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={onToday}
        className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 transition font-medium"
      >
        {t(language, 'btn_today')}
      </button>

      <h2 className="text-sm font-semibold text-slate-800 dark:text-neutral-200 select-none">
        {formatDateRange(currentDate, viewMode)}
      </h2>

      {/* Day / Week toggle */}
      <div className="ml-auto flex items-center gap-0.5 bg-slate-100 dark:bg-neutral-700 rounded-lg p-0.5">
        {(['day', 'week'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onViewModeChange(m)}
            className={`px-3 py-1 text-sm rounded-md capitalize transition ${
              viewMode === m
                ? 'bg-white dark:bg-neutral-600 shadow-sm text-slate-800 dark:text-neutral-200 font-semibold'
                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200'
            }`}
          >
            {m === 'day' ? t(language, 'view_mode_day') : t(language, 'view_mode_week')}
          </button>
        ))}
      </div>
    </div>

    {/* Day headers row (sticky, rendered here so it scrolls with the container as sticky) */}
    <div className="flex border-t border-slate-100 dark:border-neutral-700/50">
      <div className="w-14 shrink-0" /> {/* gutter spacer */}
      {days.map((day) => {
        const today = isToday(day);
        return (
          <div
            key={day.toISOString()}
            className="flex-1 flex flex-col items-center py-1.5 select-none"
          >
            <span className={`text-[11px] font-medium uppercase tracking-wide ${today ? 'text-brand-600' : 'text-slate-400 dark:text-neutral-500'}`}>
              {viewMode === 'week' ? weekdayFormatter.format(day) : ''}
            </span>
            <div
              className={`w-7 h-7 flex items-center justify-center rounded-full text-sm font-semibold ${
                today ? 'bg-brand-600 text-white' : 'text-slate-700 dark:text-neutral-200'
              }`}
            >
              {day.getDate()}
            </div>
          </div>
        );
      })}
    </div>
  </div>
  );
};
