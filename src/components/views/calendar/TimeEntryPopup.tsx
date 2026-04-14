import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Trash2, Clock } from 'lucide-react';
import { useTimerStore, type TimeEntry } from '../../../store/useTimerStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { t } from '../../../i18n';
import { formatDateTimeLocal, parseDateTimeLocal, formatDuration } from './calendarUtils';

interface Props {
  entryId: string;
  /** Position the popup near the clicked element */
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onOpenTask: (taskId: string) => void;
  /** Called after any mutation so the grid can re-fetch */
  onDataChanged: () => void;
}

interface EntryWithTask extends TimeEntry {
  title: string;
  task_id: string;
}

export const TimeEntryPopup = ({ entryId, anchorEl, onClose, onOpenTask, onDataChanged }: Props) => {
  const { updateEntry, deleteEntry } = useTimerStore();
  const { language } = useSettingsStore();
  const [entry, setEntry] = useState<EntryWithTask | null>(null);
  const [startVal, setStartVal] = useState('');
  const [endVal, setEndVal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);

  // Load entry data
  useEffect(() => {
    const load = async () => {
      const { getDb } = await import('../../../db');
      const db = await getDb();
      const rows = await db.select<EntryWithTask[]>(
        `SELECT te.*, t.title FROM time_entries te JOIN tasks t ON te.task_id = t.id WHERE te.id = $1`,
        [entryId],
      );
      if (rows[0]) {
        setEntry(rows[0]);
        setStartVal(formatDateTimeLocal(rows[0].start_time));
        setEndVal(rows[0].end_time ? formatDateTimeLocal(rows[0].end_time) : '');
      }
    };
    load();
  }, [entryId]);

  // Click-outside and Escape to close
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Compute popup position near anchor
  const popupStyle = (() => {
    if (!anchorEl) return { top: 120, right: 40 };
    const rect = anchorEl.getBoundingClientRect();
    let top = rect.top + window.scrollY;
    let left = rect.right + 8;
    // Keep within viewport
    if (left + 320 > window.innerWidth) left = rect.left - 328;
    if (top + 280 > window.innerHeight) top = Math.max(8, window.innerHeight - 288);
    return { top, left };
  })();

  const handleStartBlur = async () => {
    if (!entry || !startVal) return;
    const newStart = parseDateTimeLocal(startVal);
    if (isNaN(newStart)) return;
    await updateEntry(entryId, { start_time: newStart });
    setEntry((prev) => prev ? { ...prev, start_time: newStart } : null);
    onDataChanged();
  };

  const handleEndBlur = async () => {
    if (!entry || !endVal) return;
    const newEnd = parseDateTimeLocal(endVal);
    if (isNaN(newEnd)) return;
    await updateEntry(entryId, { end_time: newEnd });
    setEntry((prev) => prev ? { ...prev, end_time: newEnd } : null);
    onDataChanged();
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    await deleteEntry(entryId);
    onDataChanged();
    onClose();
  };

  const durationSec = entry?.end_time ? Math.round((entry.end_time - entry.start_time) / 1000) : null;

  return (
    <div
      ref={popupRef}
      className="fixed z-50 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-xl shadow-xl w-80 p-4"
      style={{ top: popupStyle.top, left: (popupStyle as any).left ?? undefined, right: (popupStyle as any).right ?? undefined }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <button
          type="button"
          onClick={onClose}
          className="btn-ghost"
          title={t(language, 'tooltip_close')}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => { if (entry) { onOpenTask(entry.task_id); onClose(); } }}
          className="flex-1 text-left text-sm font-semibold text-slate-800 dark:text-neutral-200 truncate hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          title={t(language, 'tooltip_open_task')}
        >
          {entry?.title ?? '…'}
        </button>
      </div>

      {/* Duration badge */}
      {durationSec !== null && (
        <div className="flex items-center gap-1.5 mb-3 text-slate-500 dark:text-neutral-400">
          <Clock className="w-3.5 h-3.5 shrink-0" />
          <span className="text-sm font-medium">{formatDuration(durationSec)}</span>
        </div>
      )}

      {/* Start */}
      <div className="mb-2">
        <label className="label-section block mb-1">{t(language, 'label_start')}</label>
        <input
          type="datetime-local"
          value={startVal}
          onChange={(e) => setStartVal(e.target.value)}
          onBlur={handleStartBlur}
          className="w-full form-input"
        />
      </div>

      {/* End */}
      {entry?.end_time !== null && (
        <div className="mb-4">
          <label className="label-section block mb-1">{t(language, 'label_end')}</label>
          <input
            type="datetime-local"
            value={endVal}
            onChange={(e) => setEndVal(e.target.value)}
            onBlur={handleEndBlur}
            className="w-full form-input"
          />
        </div>
      )}

      {/* Delete — icon button at bottom-right */}
      <div className="flex justify-end items-center gap-2">
        {confirmDelete && (
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 transition"
          >
            {t(language, 'cancel')}
          </button>
        )}
        <button
          type="button"
          onClick={handleDelete}
          title={confirmDelete ? t(language, 'tooltip_confirm_delete') : t(language, 'tooltip_delete_entry')}
          className={`btn-icon ${
            confirmDelete
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'text-slate-400 dark:text-neutral-500 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
