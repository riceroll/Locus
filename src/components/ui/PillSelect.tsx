import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

export interface PillOption {
  value: string;
  label: string;
  /** Hex color for the dot + tinted background */
  color?: string;
  /** Project icon fields (optional) */
  icon?: string | null;
  icon_type?: string | null;
  icon_color?: string | null;
}

// Renders the small icon for a project pill: emoji, lucide icon, or colored circle
function PillIcon({ opt, size = 'sm' }: { opt: PillOption; size?: 'sm' | 'xs' }) {
  const c = opt.icon_color || opt.color || '#94a3b8';
  const cls = size === 'xs' ? 'w-2.5 h-2.5' : 'w-3 h-3';
  if (opt.icon_type === 'emoji' && opt.icon) {
    return <span className={size === 'xs' ? 'text-[10px]' : 'text-[11px]'} style={{ lineHeight: 1 }}>{opt.icon}</span>;
  }
  if (opt.icon_type === 'lucide' && opt.icon) {
    const LIcon = (LucideIcons as unknown as Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>>)[opt.icon];
    if (LIcon) return <LIcon className={cls} style={{ color: c, flexShrink: 0 }} />;
  }
  // Default: colored circle
  return <span className={`${cls} rounded-full flex-shrink-0`} style={{ background: c }} />;
}

interface PillSelectProps {
  value: string | null;
  options: PillOption[];
  onChange: (val: string | null) => Promise<void> | void;
  /** Whether a "no selection" (null) option is shown. Default false. */
  nullable?: boolean;
  /** Label shown when value is null or no match found */
  placeholder?: string;
}

export function PillSelect({
  value,
  options,
  onChange,
  nullable = false,
  placeholder = '—',
}: PillSelectProps) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const allOptions: PillOption[] = nullable
    ? [{ value: '', label: placeholder }, ...options]
    : options;

  const selected = options.find((o) => o.value === (value ?? '')) ?? null;

  const openMenu = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    // Adjust if too close to bottom of viewport
    const spaceBelow = window.innerHeight - rect.bottom;
    const menuH = Math.min(allOptions.length * 34 + 8, 280);
    const top = spaceBelow > menuH ? rect.bottom + 4 : rect.top - menuH - 4;
    setMenuPos({ top, left: rect.left });
    setHighlightIdx(Math.max(0, allOptions.findIndex((o) => o.value === (value ?? ''))));
    setOpen(true);
  };

  const closeMenu = () => {
    setOpen(false);
  };

  const pick = async (val: string) => {
    await onChange(val || null);
    closeMenu();
  };

  useEffect(() => {
    if (!open) return;
    const onMouse = (e: MouseEvent) => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) closeMenu();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { closeMenu(); return; }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightIdx((i) => Math.min(i + 1, allOptions.length - 1));
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightIdx((i) => Math.max(i - 1, 0));
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        void pick(allOptions[highlightIdx]?.value ?? '');
      }
    };
    document.addEventListener('mousedown', onMouse);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onMouse);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, highlightIdx, allOptions]);

  const color = selected?.color;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={open ? closeMenu : openMenu}
        className="inline-flex w-full min-w-0 items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border"
        style={
          color
            ? { backgroundColor: color + '22', color, borderColor: color + '55' }
            : undefined
        }
        // fallback classes when no color
        data-no-color={!color ? '' : undefined}
      >
        <style>{`button[data-no-color]{background:#f4f4f5;border-color:#e4e4e7;color:#52525b;}
          .dark button[data-no-color]{background:#3f3f46;border-color:#52525b;color:#a1a1aa;}`}</style>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          {color && (
            <PillIcon opt={selected} size="xs" />
          )}
          <span className="truncate">{selected?.label ?? placeholder}</span>
        </span>
        <ChevronDown className="w-3 h-3 opacity-50 flex-shrink-0 ml-0.5" />
      </button>

      {open && menuPos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[99998] min-w-[160px] max-h-[280px] overflow-y-auto bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-xl dark:shadow-neutral-900/40 py-1"
            style={{ top: menuPos.top, left: menuPos.left }}
          >
            {allOptions.map((opt, idx) => {
              const isSelected = opt.value === (value ?? '');
              const isHi = idx === highlightIdx;
              return (
                <button
                  key={opt.value || '__null__'}
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-left transition-colors ${
                    isHi
                      ? 'bg-neutral-100 dark:bg-neutral-700'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-700/60'
                  }`}
                  onMouseEnter={() => setHighlightIdx(idx)}
                  onClick={() => void pick(opt.value)}
                >
                  {opt.color || opt.icon_type ? (
                    <PillIcon opt={opt} size="xs" />
                  ) : (
                    <span className="w-2 h-2 rounded-full flex-shrink-0 bg-neutral-300 dark:bg-neutral-600" />
                  )}                  <span
                    className={`flex-1 text-xs ${isSelected ? 'font-semibold' : 'font-normal'}`}
                    style={opt.color && opt.value ? { color: opt.color } : { color: '#71717a' }}
                  >
                    {opt.label}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 ml-auto flex-shrink-0 text-brand-500" />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
