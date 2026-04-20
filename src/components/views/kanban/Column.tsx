import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { MoreHorizontal, Star, Palette, Trash2, ChevronRight } from 'lucide-react';
import type { Task } from '../../../store/useTaskStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { ColorPickerDropdown } from '../../ui/UnifiedColorPicker';
import { t } from '../../../i18n';

/* ─── Column header + body ────────────────────────────────────── */
interface ColumnProps {
  id: string;
  name: string;
  color: string;
  tasks: Task[];
  isDefault: boolean;
  isDone: boolean;
  canDelete: boolean;
  collapsed?: boolean;
  isMenuOpen: boolean;
  width?: number;
  onResizeStart?: (e: React.MouseEvent) => void;
  onToggleMenu: (id: string) => void;
  onRename: (id: string, next: string) => Promise<void>;
  onDelete: (id: string, name: string) => Promise<void>;
  onSetDefault: (id: string) => Promise<void>;
  onChangeColor: (id: string, color: string) => Promise<void>;
  onToggleCollapse?: (id: string) => void;
  columnHandleProps: {
    attributes: Record<string, any>;
    listeners: Record<string, any> | undefined;
  };
  children: ReactNode;
}

export const Column = ({
  id,
  name,
  color,
  tasks,
  isDefault,
  isDone,
  canDelete,
  collapsed = false,
  isMenuOpen,
  width,
  onResizeStart,
  onToggleMenu,
  onRename,
  onDelete,
  onSetDefault,
  onChangeColor,
  onToggleCollapse,
  columnHandleProps,
  children,
}: ColumnProps) => {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column' } });
  const { language } = useSettingsStore();
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const updateMenuPosition = () => {
    const btn = menuButtonRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 224; // w-56
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.right - menuWidth),
      window.innerWidth - menuWidth - margin,
    );
    const top = Math.min(rect.bottom + 6, window.innerHeight - margin);
    setMenuPos({ top, left });
  };

  useEffect(() => {
    if (!isMenuOpen) return;
    updateMenuPosition();
    const handleMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onToggleMenu('');
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onToggleMenu('');
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updateMenuPosition);
    window.addEventListener('scroll', updateMenuPosition, true);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updateMenuPosition);
      window.removeEventListener('scroll', updateMenuPosition, true);
    };
  }, [isMenuOpen, onToggleMenu]);

  useEffect(() => {
    setDraftName(name);
  }, [name]);

  useEffect(() => {
    if (isMenuOpen) updateMenuPosition();
  }, [isMenuOpen, width]);

  const commitRename = async () => {
    const next = draftName.trim();
    if (!next || next === name) {
      setDraftName(name);
      setIsEditing(false);
      return;
    }
    await onRename(id, next);
    setIsEditing(false);
  };

  if (collapsed) {
    return (
      <div
        ref={setNodeRef}
        onClick={() => onToggleCollapse?.(id)}
        className={`group flex flex-col items-center shrink-0 relative rounded-xl border transition-colors cursor-pointer ${
          isOver ? 'border-brand-300 bg-brand-50/40 dark:border-brand-700/60 dark:bg-brand-900/20' : 'border-neutral-200/70 dark:border-neutral-700/80 bg-white/60 dark:bg-neutral-800/60 hover:bg-neutral-50 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
        }`}
        style={{ width: 36, minHeight: 180 }}
      >
        <div className="w-full h-10 flex items-center justify-center text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-700 dark:group-hover:text-neutral-200 transition" title={t(language, 'btn_expand_column')}>
          <ChevronRight className="w-3.5 h-3.5" />
        </div>
        <div
          {...columnHandleProps.attributes}
          {...(columnHandleProps.listeners || {})}
          className="flex-1 w-full flex flex-col items-center pt-2 pb-4 cursor-grab active:cursor-grabbing overflow-hidden rounded-b-xl"
        >
          <div
            className="flex items-center gap-2.5 select-none"
            style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <span className="text-xs font-semibold tracking-wide text-neutral-700 dark:text-neutral-200 whitespace-nowrap">{name}</span>
            <span className="text-[11px] font-medium text-neutral-400 dark:text-neutral-500 whitespace-nowrap">{tasks.length}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group flex flex-col min-h-0 shrink-0 relative rounded-xl border border-transparent hover:border-neutral-200/80 dark:hover:border-neutral-700 transition-colors max-h-full"
      style={{ width: width ?? 320 }}
    >
      {/* Header — whole bar is draggable */}
      <div
        {...columnHandleProps.attributes}
        {...(columnHandleProps.listeners || {})}
        className="flex items-center gap-1.5 px-2 pt-2 pb-1 cursor-grab active:cursor-grabbing"
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
        {isEditing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitRename();
              if (e.key === 'Escape') { setDraftName(name); setIsEditing(false); }
            }}
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 rounded px-1.5 py-0.5 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-brand-300"
          />
        ) : (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setIsEditing(true)}
            className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 hover:text-neutral-900 dark:hover:text-neutral-100 text-left truncate flex-1"
            title={t(language, 'tooltip_click_to_rename')}
          >
            {name}
          </button>
        )}
        {isDefault && !isDone && <span className="text-[10px] text-neutral-400 dark:text-neutral-500 shrink-0">{t(language, 'text_default_column_indicator')}</span>}
        {isDone && <span className="text-[10px] text-green-600/70 shrink-0">{t(language, 'text_done_column_indicator')}</span>}
        <span className="ml-auto text-xs text-neutral-400 dark:text-neutral-500 shrink-0">{tasks.length}</span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapse?.(id);
          }}
          className="p-0.5 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 shrink-0 transition opacity-0 group-hover:opacity-100"
          title={t(language, 'btn_collapse_column')}
        >
          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
        </button>
        <button
          ref={menuButtonRef}
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onToggleMenu(id)}
          className="p-0.5 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 shrink-0 transition opacity-0 group-hover:opacity-100"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      {isMenuOpen && (
        <div
          ref={menuRef}
          className="fixed z-30 w-56 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg dark:shadow-neutral-900/20 p-1.5 space-y-1"
          style={menuPos ? { top: menuPos.top, left: menuPos.left } : undefined}
        >
          <button
            type="button"
            disabled={isDone || isDefault}
            onClick={() => { void onSetDefault(id); onToggleMenu(''); }}
            className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:text-neutral-300 dark:disabled:text-neutral-600 disabled:hover:bg-transparent dark:text-neutral-200"
          >
              <Star className="w-3.5 h-3.5 inline mr-1" /> {t(language, 'btn_set_as_default_column')}
          </button>
          <div className="px-2 py-1.5 flex items-center justify-between">
              <span className="text-xs text-neutral-700 dark:text-neutral-200">
                <Palette className="w-3.5 h-3.5 inline mr-1" /> {t(language, 'btn_change_color')}
              </span>
              <ColorPickerDropdown
                current={color}
                onSelect={(c) => onChangeColor(id, c)}
              />
          </div>
          {!confirmingDelete ? (
            <button
              type="button"
              disabled={!canDelete}
              onClick={() => setConfirmingDelete(true)}
              className="w-full text-left text-xs px-2 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 disabled:text-neutral-300 dark:disabled:text-neutral-600 disabled:hover:bg-transparent"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />
              {canDelete ? t(language, 'btn_delete_column') : t(language, 'btn_cannot_delete_column')}
            </button>
          ) : (
            <div className="space-y-1">
              <p className="text-[11px] text-neutral-600 dark:text-neutral-300 px-2">{t(language, 'text_delete_column_warning')}</p>
              <div className="flex gap-1 px-1">
                <button
                  type="button"
                  onClick={async () => { setConfirmingDelete(false); onToggleMenu(''); await onDelete(id, name); }}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-red-500 text-white hover:bg-red-600 transition"
                >{ t(language, 'confirm') }</button>
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  className="flex-1 btn-secondary text-xs"
                >{t(language, 'cancel')}</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Body */}
      <div
        ref={setNodeRef}
        className={`flex-1 overflow-y-auto min-h-0 rounded-lg border p-2 pt-2 transition-colors flex flex-col gap-2 ${
          isOver ? 'bg-brand-50/30 border-brand-200 dark:border-brand-700/50' : 'border-transparent'
        }`}
      >
        {children}
      </div>

      {/* Resize handle — right edge */}
      {onResizeStart && (
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-20 rounded-r-xl hover:bg-brand-400/30 transition-colors"
          onMouseDown={(e) => { e.stopPropagation(); onResizeStart(e); }}
        />
      )}

    </div>
  );
};
