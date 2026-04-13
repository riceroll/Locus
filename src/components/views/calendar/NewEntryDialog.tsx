import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from 'lucide-react';
import { useTaskStore } from '../../../store/useTaskStore';
import { useTimerStore } from '../../../store/useTimerStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { t } from '../../../i18n';
import { formatTime } from './calendarUtils';

interface Props {
  /** Screen coordinates where the dialog should appear */
  anchorX: number;
  anchorY: number;
  startTime: number;
  endTime: number;
  onClose: () => void;
  onCreated: () => void;
}

export const NewEntryDialog = ({ anchorX, anchorY, startTime, endTime, onClose, onCreated }: Props) => {
  const { tasks, addTask } = useTaskStore();
  const { createEntry } = useTimerStore();
  const { language } = useSettingsStore();

  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? tasks.filter((t) => t.title.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
    : tasks.slice(0, 6);

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Close on outside click or Escape
  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  const handleSelect = async (taskId: string) => {
    await createEntry(taskId, startTime, endTime);
    onCreated();
    onClose();
  };

  const handleCreate = async () => {
    const title = query.trim();
    if (!title) return;
    const taskId = await addTask(title);
    await createEntry(taskId, startTime, endTime);
    onCreated();
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, filtered.length)); // last item = "create new"
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlighted < filtered.length) {
        handleSelect(filtered[highlighted].id);
      } else {
        handleCreate();
      }
    }
  };

  // Position dialog — keep within viewport
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const W = 260;
  const left = Math.min(anchorX + 8, vw - W - 8);
  const estimatedH = 160;
  const top = anchorY + estimatedH > vh ? Math.max(8, anchorY - estimatedH) : anchorY;

  const durationMin = Math.round((endTime - startTime) / 60_000);

  return createPortal(
    <div
      ref={dialogRef}
      className="fixed z-[200] bg-white dark:bg-neutral-800 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden"
      style={{ left, top, width: W }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 pt-2.5 pb-1.5 border-b border-neutral-100 dark:border-neutral-700/60">
        <span className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
          {formatTime(startTime)} – {formatTime(endTime)} · {durationMin}m
        </span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Input */}
      <div className="px-2 pt-2 pb-1">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlighted(0); }}
          onKeyDown={handleKeyDown}
          placeholder={t(language, 'placeholder_task_name')}
          className="w-full text-[13px] px-2.5 py-1.5 rounded-lg bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 focus:outline-none focus:ring-1 focus:ring-brand-400 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
        />
      </div>

      {/* Task list */}
      <div className="px-2 pb-1 flex flex-col gap-0.5 max-h-[180px] overflow-y-auto">
        {filtered.map((t, i) => (
          <button
            key={t.id}
            className={`w-full text-left text-[12px] px-2.5 py-1.5 rounded-lg truncate transition-colors
              ${i === highlighted
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-700/60'
              }`}
            onMouseEnter={() => setHighlighted(i)}
            onClick={() => handleSelect(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>

      {/* Create new */}
      <div className="px-2 pb-2">
        <button
          className={`w-full flex items-center gap-1.5 text-[12px] px-2.5 py-1.5 rounded-lg transition-colors
            ${highlighted === filtered.length
              ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
              : 'text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700/60'
            }`}
          onMouseEnter={() => setHighlighted(filtered.length)}
          onClick={handleCreate}
        >
          <Check className="w-3 h-3 shrink-0" />
          {query.trim()
            ? t(language, 'btn_create_task_named').replace('{name}', query.trim())
            : t(language, 'btn_create_new_task')}
        </button>
      </div>
    </div>,
    document.body,
  );
};
