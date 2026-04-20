import { useEffect, useState, useRef } from 'react';
import { useViewStore } from '../../store/useViewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SavedView } from '../../store/useViewStore';
import {
  LayoutList,
  Columns3,
  Calendar,
  Plus,
  Inbox,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Settings,
  MoreHorizontal,
  Trash2,
  Pencil,
  Network
} from 'lucide-react';

import { ColorPickerDropdown } from '../ui/UnifiedColorPicker';

const VIEW_ICONS = {
  list: LayoutList,
  kanban: Columns3,
  calendar: Calendar,
  tree: Network,
} as const;

// Locus app icon — concentric rings focal point
const LocusIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
    <circle cx="12" cy="12" r="6"  stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
  </svg>
);

interface SortableViewRowProps {
  view: SavedView;
  active: boolean;
  language: 'en' | 'zh';
  isEditing: boolean;
  editingName: string;
  onEditingNameChange: (name: string) => void;
  onStartRename: (view: SavedView) => void;
  onSaveRename: (view: SavedView) => void;
  onCancelRename: (view: SavedView) => void;
  openMenuId: string | null;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onChangeType: (id: string, type: 'list' | 'kanban' | 'calendar') => void;
  onSetColor: (id: string, color: string | null) => void;
  onDelete: (id: string) => void;
}

const SortableViewRow = ({
  view,
  active,
  language,
  isEditing,
  editingName,
  onEditingNameChange,
  onStartRename,
  onSaveRename,
  onCancelRename,
  openMenuId,
  menuRef,
  onSelect,
  onToggleMenu,
  onCloseMenu,
  onChangeType,
  onSetColor,
  onDelete,
}: SortableViewRowProps) => {
  const Icon = VIEW_ICONS[view.view_type];
  const renameInputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({ id: view.id, disabled: isEditing });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  useEffect(() => {
    if (!isEditing) return;
    const id = requestAnimationFrame(() => {
      if (!renameInputRef.current) return;
      renameInputRef.current.focus();
      renameInputRef.current.select();
    });
    return () => cancelAnimationFrame(id);
  }, [isEditing]);

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={`group flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer transition ${
        active
          ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
          : 'text-slate-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'
      }`}
      onClick={() => {
        if (isEditing) return;
        onSelect(view.id);
      }}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: view.color || '#94a3b8' }}
      />
      <Icon className="w-4 h-4 shrink-0" />
      {isEditing ? (
        <input
          ref={renameInputRef}
          type="text"
          value={editingName}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onEditingNameChange(e.target.value)}
          onBlur={() => { void onSaveRename(view); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void onSaveRename(view);
            }
            if (e.key === 'Escape') {
              e.preventDefault();
              onCancelRename(view);
            }
          }}
          className="flex-1 min-w-0 text-sm border border-brand-300 dark:border-brand-500 rounded px-2 py-1 bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand-300"
        />
      ) : (
        <span className="truncate flex-1">{view.name}</span>
      )}
      <div className="relative" ref={openMenuId === view.id ? menuRef : undefined}>
        {!isEditing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleMenu(view.id);
            }}
            className="opacity-0 group-hover:opacity-100 text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-200 transition rounded p-0.5"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
        {openMenuId === view.id && (
          <div
            className="absolute right-0 top-full mt-1 z-50 w-44 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg py-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">{t(language, 'section_views')}</div>
            {(['list', 'kanban', 'calendar', 'tree'] as const).map(vt => {
              const TIcon = VIEW_ICONS[vt];
              return (
                <button
                  key={vt}
                  onClick={() => { onChangeType(view.id, vt as any); onCloseMenu(); }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-sm capitalize transition ${
                    view.view_type === vt
                      ? 'text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-900/30'
                      : 'text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700'
                  }`}
                >
                  <TIcon className="w-3.5 h-3.5" />
                  {t(language, vt === 'list' ? 'view_type_list' : vt === 'kanban' ? 'view_type_kanban' : 'view_type_calendar')}
                </button>
              );
            })}
            <div className="my-1 border-t border-slate-100 dark:border-neutral-700" />
            <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider">{t(language, 'btn_change_color')}</div>
            <div className="px-3 pb-1.5 pt-0.5 mt-2 flex flex-col gap-2">
              <ColorPickerDropdown
                current={view.color || ''}
                onSelect={(c) => { onSetColor(view.id, c); onCloseMenu(); }}
              />
              <button
                type="button"
                onClick={() => { onSetColor(view.id, null); onCloseMenu(); }}
                className="mt-2 w-full text-center text-[10px] py-1 rounded bg-slate-100 dark:bg-neutral-700 text-slate-500 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-600"
              >
                {t(language, 'btn_clear')}
              </button>
            </div>
            <div className="my-1 border-t border-slate-100 dark:border-neutral-700" />
            <button
              onClick={() => { onStartRename(view); onCloseMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 transition"
            >
              <Pencil className="w-3.5 h-3.5" />
              {t(language, 'btn_rename')}
            </button>
            <div className="my-1 border-t border-slate-100 dark:border-neutral-700" />
            <button
              onClick={() => { onDelete(view.id); onCloseMenu(); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {t(language, 'delete')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const Sidebar = ({ onOpenSettings }: { onOpenSettings?: () => void }) => {
  const { views, activeViewId, activePage, fetchViews, createView, deleteView, changeViewType, setViewColor, reorderViews, renameView, selectView, setActivePage } = useViewStore();
  const { appName, language } = useSettingsStore();
  const [expanded, setExpanded] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'list' | 'kanban' | 'calendar' | 'tree'>('list');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingViewName, setEditingViewName] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  useEffect(() => {
    fetchViews();
  }, []);

  useEffect(() => {
    if (!openMenuId) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openMenuId]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createView(newName.trim(), newType);
    setNewName('');
    setShowCreate(false);
  };

  const handleViewDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = views.findIndex((v) => v.id === String(active.id));
    const newIndex = views.findIndex((v) => v.id === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(views, oldIndex, newIndex);
    await reorderViews(reordered.map((v) => v.id));
  };

  const handleStartRename = (view: SavedView) => {
    setEditingViewId(view.id);
    setEditingViewName(view.name);
  };

  const handleCancelRename = (view: SavedView) => {
    setEditingViewId(null);
    setEditingViewName(view.name);
  };

  const handleSaveRename = async (view: SavedView) => {
    const trimmed = editingViewName.trim();
    if (!trimmed) {
      setEditingViewName(view.name);
      setEditingViewId(null);
      return;
    }
    if (trimmed !== view.name) {
      await renameView(view.id, trimmed);
    }
    setEditingViewId(null);
  };

  return (
    <aside className="w-full shrink-0 bg-white dark:bg-neutral-800 border-r border-slate-200 dark:border-neutral-700 flex flex-col h-full select-none">
      {/* Logo / app name — pt-7 gives room for macOS traffic lights */}
      <div className="px-4 py-5 flex items-center gap-2" data-tauri-drag-region>
        <LocusIcon className="w-5 h-5 text-brand-500" />
        <h1 className="text-[19px] text-slate-800 dark:text-neutral-200 tracking-[0.04em] leading-none" style={{ fontFamily: '"Space Grotesk", sans-serif', fontWeight: 400 }}>
          {appName || 'Locus'}
        </h1>
      </div>

      {/* Default view */}
      <div className="px-2 pt-3">
        <button
          onClick={() => { setActivePage('tasks'); selectView(null); }}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition ${
            activePage === 'tasks' && activeViewId === null
              ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
              : 'text-slate-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <Inbox className="w-4 h-4" />
          {t(language, 'nav_all_tasks')}
        </button>
        <button
          onClick={() => setActivePage('projects')}
          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition mt-0.5 ${
            activePage === 'projects'
              ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 font-medium'
              : 'text-slate-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700'
          }`}
        >
          <FolderOpen className="w-4 h-4" />
          {t(language, 'nav_projects')}
        </button>
      </div>

      {/* Saved views section */}
      <div className="px-2 mt-4 flex-1 overflow-y-auto">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wider w-full hover:text-slate-600 dark:hover:text-neutral-300 transition"
        >
          {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          {t(language, 'section_views')}
        </button>

        {expanded && (
          <div className="mt-1 space-y-0.5">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleViewDragEnd}>
              <SortableContext items={views.map((v) => v.id)} strategy={verticalListSortingStrategy}>
                {views.map((view) => (
                  <SortableViewRow
                    key={view.id}
                    view={view}
                    active={activePage === 'tasks' && activeViewId === view.id}
                    language={language}
                    isEditing={editingViewId === view.id}
                    editingName={editingViewName}
                    onEditingNameChange={setEditingViewName}
                    onStartRename={handleStartRename}
                    onSaveRename={handleSaveRename}
                    onCancelRename={handleCancelRename}
                    openMenuId={openMenuId}
                    menuRef={menuRef}
                    onSelect={(id) => { setActivePage('tasks'); selectView(id); }}
                    onToggleMenu={(id) => setOpenMenuId(openMenuId === id ? null : id)}
                    onCloseMenu={() => setOpenMenuId(null)}
                    onChangeType={changeViewType}
                    onSetColor={setViewColor}
                    onDelete={deleteView}
                  />
                ))}
              </SortableContext>
            </DndContext>

            {/* Create new view */}
            {showCreate ? (
              <div className="px-2 py-2 space-y-2">
                <input
                  type="text"
                  autoFocus
                  placeholder={t(language, 'placeholder_view_name')}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreate()}
                  className="w-full text-sm border border-neutral-300 dark:border-neutral-600 rounded px-2 py-1.5 bg-white dark:bg-neutral-700 dark:text-neutral-200 focus:ring-1 focus:ring-brand-300 outline-none"
                />
                <div className="flex gap-1">
                  {(['list', 'kanban', 'calendar', 'tree'] as const).map(t => {
                    const Icon = VIEW_ICONS[t];
                    return (
                      <button
                        key={t}
                        onClick={() => setNewType(t)}
                        title={t}
                        className={`flex items-center justify-center gap-1 text-xs w-8 h-7 rounded capitalize ${
                          newType === t
                            ? 'bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-300'
                            : 'bg-slate-100 dark:bg-neutral-700 text-slate-500 dark:text-neutral-400 hover:bg-slate-200 dark:hover:bg-neutral-600'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={handleCreate}
                    className="text-xs px-2.5 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 transition"
                  >
                    {t(language, 'save')}
                  </button>
                  <button
                    onClick={() => { setShowCreate(false); setNewName(''); }}
                    className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded hover:bg-slate-200 dark:hover:bg-neutral-600 transition"
                  >
                    {t(language, 'cancel')}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-700 rounded-md transition"
              >
                <Plus className="w-4 h-4" />
                {t(language, 'btn_new_view')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Bottom — Settings button */}
      <div className="px-2 py-3 border-t border-slate-100 dark:border-neutral-700">
        <button
          type="button"
          onClick={onOpenSettings}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-slate-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 hover:text-slate-700 dark:hover:text-neutral-200 transition"
        >
          <Settings className="w-4 h-4" />
          {t(language, 'nav_settings')}
        </button>
      </div>
    </aside>
  );
};
