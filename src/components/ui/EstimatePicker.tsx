import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock } from 'lucide-react';
import { formatEstimate } from '../../lib/utils';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';

const PRESETS = [15, 30, 60, 120, 240, 480];
const RECENT_KEY = 'jax_recent_estimates';

function parseInput(raw: string): number | null {
  const s = raw.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  // "1h30m" / "1h30" / "2h30m"
  const hm = s.match(/^(\d+)h(\d+)m?$/);
  if (hm) return Math.round(parseInt(hm[1]) * 60 + parseInt(hm[2]));
  // "1:30"
  const colon = s.match(/^(\d+):(\d+)$/);
  if (colon) return Math.round(parseInt(colon[1]) * 60 + parseInt(colon[2]));
  // "1h"
  const ho = s.match(/^(\d+)h$/);
  if (ho) return parseInt(ho[1]) * 60;
  // "30m" or plain number "30"
  const mo = s.match(/^(\d+)m?$/);
  if (mo) return parseInt(mo[1]);
  return null;
}

function getRecent(): number[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as number[]) : [];
  } catch {
    return [];
  }
}

function saveRecent(val: number) {
  const prev = getRecent().filter((v) => v !== val);
  localStorage.setItem(RECENT_KEY, JSON.stringify([val, ...prev].slice(0, 5)));
}

interface EstimatePickerProps {
  value: number | null;
  onChange: (val: number | null) => Promise<void> | void;
}

export function EstimatePicker({ value, onChange }: EstimatePickerProps) {
  const { language } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPicker = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const panelH = 230; // approx panel height
    const top = rect.bottom + 4 + panelH > window.innerHeight
      ? rect.top - panelH - 4
      : rect.bottom + 4;
    setMenuPos({ top, left: Math.min(rect.left, window.innerWidth - 240) });
    setInputVal(value != null ? String(value) : '');
    setRecent(getRecent());
    setOpen(true);
    setTimeout(() => inputRef.current?.select(), 30);
  };

  const closePicker = () => setOpen(false);

  const commit = async (min: number | null) => {
    if (min !== null && min > 0) saveRecent(min);
    await onChange(min);
    closePicker();
  };

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) closePicker();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker();
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? closePicker : openPicker}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-500 transition-colors"
      >
        <Clock className="w-3 h-3 opacity-50 flex-shrink-0" />
        {value != null ? (
          <span>{formatEstimate(value)}</span>
        ) : (
          <span className="text-neutral-400 dark:text-neutral-500">—</span>
        )}
      </button>

      {open && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99998] w-[220px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl dark:shadow-neutral-900/40 p-3 space-y-3"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {/* Free-text input */}
            <div className="flex gap-1.5 items-center">
              <input
                ref={inputRef}
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const parsed = parseInput(inputVal);
                    void commit(parsed);
                  }
                  if (e.key === 'Escape') closePicker();
                }}
                placeholder={t(language, 'placeholder_estimate')}
                className="min-w-0 flex-1 text-xs border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-300 dark:bg-neutral-700 dark:text-neutral-200 placeholder-neutral-400"
              />
              <button
                type="button"
                onClick={() => void commit(parseInput(inputVal))}
                className="shrink-0 text-xs px-2.5 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700 transition"
              >
                {t(language, 'btn_set')}
              </button>
            </div>

            {/* Recent chips — shown first if available */}
            {recent.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-medium mb-1.5">
                  {t(language, 'section_recent')}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {recent.map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => void commit(min)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        value === min
                          ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                          : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-500'
                      }`}
                    >
                      {formatEstimate(min)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Preset chips */}
            <div>
              <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-medium mb-1.5">
                {t(language, 'section_common')}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((min) => (
                  <button
                    key={min}
                    type="button"
                    onClick={() => void commit(min)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      value === min
                        ? 'border-brand-400 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                        : 'border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-500'
                    }`}
                  >
                    {formatEstimate(min)}
                  </button>
                ))}
              </div>
            </div>

            {/* Clear */}
            {value != null && (
              <button
                type="button"
                onClick={() => void commit(null)}
                className="text-xs text-neutral-400 dark:text-neutral-500 hover:text-red-500 transition"
              >
                {t(language, 'btn_clear_estimate')}
              </button>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}
