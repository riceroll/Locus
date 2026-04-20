import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, ChevronDown, ChevronRight, FolderOpen, GripVertical, Star, StarOff, Pencil, X } from 'lucide-react';
import { useProjectStore, type Project } from '../../store/useProjectStore';
import { useAreaStore } from '../../store/useAreaStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import { IconPicker, type ProjectIcon } from '../ui/IconPicker';

/* ─── Color presets ─────────────────────────────────────────────── */
import { UnifiedColorPicker } from '../ui/UnifiedColorPicker';

const ColorPicker = ({ anchorRef, current, onSelect }: { anchorRef: React.RefObject<HTMLButtonElement | null>; current: string | null; onSelect: (c: string) => void }) => {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
  }, [anchorRef]);
  if (!pos) return null;
  return (
    <UnifiedColorPicker
      current={current || ''}
      onSelect={onSelect}
      variant="floating"
      position={pos}
    />
  );
};

/* ─── Types ─────────────────────────────────────────────────────── */
type ProjectType = Project & { area_id: string | null };
type AreaType = { id: string; name: string; color: string | null; position: number };

/* ─── Project Settings Panel ────────────────────────────────────── */
const ProjectPanel = ({
  project,
  areas,
  onClose,
  onRename,
  onColorChange,
  onDescriptionChange,
  onAreaChange,
  onSetDefault,
  onDelete,
  onIconChange,
}: {
  project: ProjectType;
  areas: AreaType[];
  onClose: () => void;
  onRename: (id: string, name: string) => Promise<void>;
  onColorChange: (id: string, color: string) => Promise<void>;
  onDescriptionChange: (id: string, desc: string) => Promise<void>;
  onAreaChange: (id: string, areaId: string | null) => Promise<void>;
  onSetDefault: (id: string | null) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onIconChange: (id: string, icon: string | null, iconType: string, iconColor: string | null) => Promise<void>;
}) => {
  const { language } = useSettingsStore();
  const [draftName, setDraftName] = useState(project.name);
  const [draftDesc, setDraftDesc] = useState(project.description ?? '');
  const [showPicker, setShowPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colorBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDraftName(project.name);
    setDraftDesc(project.description ?? '');
    setConfirmDelete(false);
  }, [project.id, project.name, project.description]);

  const dotColor = project.color || '#94a3b8';
  const isDefault = project.is_default === 1;

  const commitName = async () => {
    const next = draftName.trim();
    if (!next || next === project.name) { setDraftName(project.name); return; }
    await onRename(project.id, next);
  };

  const commitDesc = async () => {
    if (draftDesc === (project.description ?? '')) return;
    await onDescriptionChange(project.id, draftDesc);
  };

  return (
    <div className="h-full min-h-0 flex flex-col bg-white dark:bg-neutral-800">
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100 dark:border-neutral-700">
        <div
          className="w-3 h-3 rounded-full shrink-0 border-2 border-white dark:border-neutral-800"
          style={{ backgroundColor: dotColor, boxShadow: `0 0 0 1.5px ${dotColor}` }}
        />
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200 truncate flex-1">{project.name}</span>
        <button type="button" onClick={onClose} className="p-1 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t(language, 'label_name')}</label>
          <input
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') void commitName(); if (e.key === 'Escape') setDraftName(project.name); }}
            className="w-full text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:text-neutral-100"
          />
        </div>

        {/* Color + Icon */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t(language, 'label_color_and_icon')}</label>
          <div className="flex items-center gap-3">
            <div className="relative inline-flex items-center gap-2">
              <button
                ref={colorBtnRef}
                type="button"
                onClick={() => setShowPicker((v) => !v)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-500 transition text-sm text-neutral-600 dark:text-neutral-300"
              >
                <span className="w-4 h-4 rounded-full" style={{ backgroundColor: dotColor }} />
                <span>{dotColor}</span>
              </button>
              {showPicker && <div className="fixed inset-0 z-30" onClick={() => setShowPicker(false)} />}
              {showPicker && (
                <ColorPicker
                  anchorRef={colorBtnRef}
                  current={project.color}
                  onSelect={(c) => { void onColorChange(project.id, c); setShowPicker(false); }}
                />
              )}
            </div>
            <IconPicker
              icon={{
                type: (project.icon_type as ProjectIcon['type']) || 'color',
                value: project.icon || null,
                color: project.icon_color || project.color,
              }}
              projectColor={project.color}
              onChange={(ic) => void onIconChange(project.id, ic.value, ic.type, ic.color)}
            />
          </div>
        </div>

        {/* Area */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t(language, 'label_area')}</label>
          <select
            value={project.area_id ?? ''}
            onChange={(e) => void onAreaChange(project.id, e.target.value || null)}
            className="w-full text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:text-neutral-100"
          >
            <option value="">{t(language, 'option_no_area')}</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>

        {/* Default */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t(language, 'label_default_project')}</label>
          <button
            type="button"
            onClick={() => void onSetDefault(isDefault ? null : project.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition w-full ${
              isDefault
                ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-400'
                : 'bg-neutral-50 dark:bg-neutral-700 border-neutral-200 dark:border-neutral-600 text-neutral-600 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-500'
            }`}
          >
            {isDefault ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
            {isDefault ? t(language, 'btn_unset_default_project') : t(language, 'btn_set_default_project')}
          </button>
          <p className="mt-1.5 text-xs text-neutral-400 dark:text-neutral-500">{t(language, 'hint_default_project')}</p>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t(language, 'label_description')}</label>
          <textarea
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            onBlur={commitDesc}
            rows={3}
            placeholder={t(language, 'placeholder_description')}
            className="w-full text-sm bg-neutral-50 dark:bg-neutral-700 border border-neutral-200 dark:border-neutral-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:text-neutral-100 resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
        </div>
      </div>

      {/* Footer: Delete */}
      <div className="sticky bottom-0 shrink-0 px-4 py-3 border-t border-neutral-100 dark:border-neutral-700 bg-white dark:bg-neutral-800">
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="flex items-center gap-2 text-sm text-red-400 hover:text-red-500 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {t(language, 'btn_delete_project')}
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">{t(language, 'btn_delete_project')} "{project.name}"?</span>
            <button type="button" onClick={async () => { onClose(); await onDelete(project.id); }} className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600">{t(language, 'yes')}</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600">{t(language, 'cancel')}</button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── Project row (left list) ───────────────────────────────────── */
const ProjectRow = ({
  id,
  name,
  color,
  isDefault,
  isSelected,
  isDragging,
  dragAttributes,
  dragListeners,
  onClick,
}: {
  id: string;
  name: string;
  color: string | null;
  isDefault: boolean;
  isSelected: boolean;
  isDragging?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragAttributes?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dragListeners?: any;
  onClick: (id: string) => void;
}) => {
  const dotColor = color || '#94a3b8';
  return (
    <div
      {...dragAttributes}
      {...dragListeners}
      onClick={() => onClick(id)}
      className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md group cursor-pointer touch-none transition-all ${
        isDragging ? 'opacity-0' : isSelected
          ? 'bg-brand-50 dark:bg-brand-900/20 ring-1 ring-brand-200 dark:ring-brand-700'
          : 'hover:bg-slate-50 dark:hover:bg-neutral-700/60'
      }`}
    >
      {/* Double-ring dot: fill → white gap (border) → outer ring */}
      <div
        className="w-2.5 h-2.5 rounded-full shrink-0 border-[2px] border-white dark:border-neutral-800"
        style={{ backgroundColor: dotColor, boxShadow: `0 0 0 1.5px ${dotColor}` }}
      />
      <span className={`flex-1 text-sm font-medium truncate ${
        isSelected ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-neutral-200'
      }`}>
        {name}
      </span>
      {isDefault && <Star className="w-3 h-3 text-amber-400 fill-current shrink-0" />}
      <Pencil className="w-3 h-3 text-neutral-300 dark:text-neutral-600 opacity-0 group-hover:opacity-100 shrink-0 transition" />
    </div>
  );
};

/* ─── Sortable project wrapper ──────────────────────────────────── */
const SortableProject = ({
  project,
  isSelected,
  onSelect,
}: {
  project: ProjectType;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: project.id,
    data: { type: 'project', areaId: project.area_id },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : (transition ?? undefined),
  };
  return (
    <div ref={setNodeRef} style={style}>
      <ProjectRow
        id={project.id}
        name={project.name}
        color={project.color}
        isDefault={project.is_default === 1}
        isSelected={isSelected}
        isDragging={isDragging}
        dragAttributes={attributes}
        dragListeners={listeners}
        onClick={onSelect}
      />
    </div>
  );
};

/* ─── Area section ──────────────────────────────────────────────── */
const AreaSection = ({
  areaId,
  areaName,
  areaColor,
  projects,
  selectedId,
  handleProps,
  isDraggingArea,
  onRenameArea,
  onDeleteArea,
  onColorChangeArea,
  onSelectProject,
}: {
  areaId: string | null;
  areaName: string;
  areaColor: string | null;
  projects: ProjectType[];
  selectedId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleProps?: { attributes: any; listeners: any };
  isDraggingArea?: boolean;
  onRenameArea: ((id: string, name: string) => Promise<void>) | null;
  onDeleteArea: ((id: string) => Promise<void>) | null;
  onColorChangeArea: ((id: string, color: string) => Promise<void>) | null;
  onSelectProject: (id: string) => void;
}) => {
  const { language } = useSettingsStore();
  const droppableId = areaId ?? '__none__';
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: droppableId, data: { type: 'area-body', areaId } });
  const [expanded, setExpanded] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [draft, setDraft] = useState(areaName);
  const [showAreaPicker, setShowAreaPicker] = useState(false);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);
  const areaBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { setDraft(areaName); }, [areaName]);

  const commitAreaRename = async () => {
    const next = draft.trim();
    if (!next || next === areaName || !areaId || !onRenameArea) { setDraft(areaName); setEditingName(false); return; }
    await onRenameArea(areaId, next);
    setEditingName(false);
  };

  const dotColor = areaColor || '#94a3b8';
  const projectIds = projects.map((p) => p.id);

  return (
    <div className={`mb-3 transition-opacity ${isDraggingArea ? 'opacity-40' : ''}`}>
      {/* Area header row */}
      <div className={`flex items-center gap-1.5 px-2 py-1.5 group rounded-lg transition-colors ${
        areaId ? 'hover:bg-slate-50 dark:hover:bg-neutral-700/40' : ''
      }`}>
        {areaId ? (
          <button
            type="button"
            {...(handleProps?.attributes as object)}
            {...((handleProps?.listeners as object) || {})}
            className="p-0.5 text-slate-300 dark:text-neutral-600 hover:text-slate-500 dark:hover:text-neutral-400 cursor-grab active:cursor-grabbing shrink-0 transition touch-none opacity-0 group-hover:opacity-100"
          >
            <GripVertical className="w-3 h-3" />
          </button>
        ) : (
          <div className="w-4" />
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="text-slate-300 dark:text-neutral-600 hover:text-slate-500 dark:hover:text-neutral-400 transition shrink-0"
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {areaId && onColorChangeArea ? (
          <div className="relative">
            <button
              ref={areaBtnRef}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); setShowAreaPicker((v) => !v); }}
              className="w-3 h-3 rounded-full shrink-0 transition hover:opacity-80"
              style={{ backgroundColor: dotColor }}
              title={t(language, 'tooltip_change_area_color')}
            />
            {showAreaPicker && <div className="fixed inset-0 z-30" onClick={() => setShowAreaPicker(false)} />}
            {showAreaPicker && (
              <ColorPicker
                anchorRef={areaBtnRef}
                current={areaColor}
                onSelect={(c) => { void onColorChangeArea(areaId, c); setShowAreaPicker(false); }}
              />
            )}
          </div>
        ) : (
          <FolderOpen className="w-3 h-3 text-slate-300 dark:text-neutral-600 shrink-0" />
        )}

        {editingName && areaId ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitAreaRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitAreaRename();
              if (e.key === 'Escape') { setDraft(areaName); setEditingName(false); }
            }}
            className="flex-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 dark:text-neutral-400 border border-slate-300 dark:border-neutral-600 dark:bg-neutral-700 rounded px-1.5 py-0.5 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => areaId && setEditingName(true)}
            className={`flex-1 text-[11px] font-bold uppercase tracking-[0.1em] text-left ${
              areaId
                ? 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 cursor-pointer'
                : 'text-slate-400 dark:text-neutral-600 cursor-default'
            }`}
          >
            {areaName}
          </button>
        )}

        {/* Count badge */}
        <span className="shrink-0 text-[10px] font-semibold min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full bg-slate-100 dark:bg-neutral-700/80 text-slate-400 dark:text-neutral-500">
          {projects.length}
        </span>

        {areaId && onDeleteArea && (
          !confirmDeleteArea ? (
            <button
              type="button"
              onClick={() => setConfirmDeleteArea(true)}
              className="opacity-0 group-hover:opacity-100 text-slate-300 dark:text-neutral-600 hover:text-red-400 transition p-0.5 rounded shrink-0"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-500 dark:text-neutral-400">{t(language, 'confirm_delete_area')}</span>
              <button type="button" onClick={async () => { setConfirmDeleteArea(false); await onDeleteArea(areaId); }} className="text-xs px-1.5 py-0.5 rounded bg-red-500 text-white hover:bg-red-600">{t(language, 'yes')}</button>
              <button type="button" onClick={() => setConfirmDeleteArea(false)} className="text-xs px-1.5 py-0.5 rounded bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300">{t(language, 'no')}</button>
            </div>
          )
        )}
      </div>

      {expanded && (
        <div
          ref={dropRef}
          className={`ml-6 pl-2 ${
            areaId ? 'border-l-2 border-slate-100 dark:border-neutral-700/50' : ''
          } rounded-sm transition-colors min-h-[28px] ${isOver ? 'bg-brand-50/60 dark:bg-brand-900/10 ring-1 ring-brand-200 dark:ring-brand-700 rounded-lg' : ''}`}
        >
          <SortableContext items={projectIds} strategy={verticalListSortingStrategy}>
            {projects.map((p) => (
              <SortableProject
                key={p.id}
                project={p}
                isSelected={selectedId === p.id}
                onSelect={onSelectProject}
              />
            ))}
          </SortableContext>
          {projects.length === 0 && (
            <p className={`text-xs px-4 py-2 italic ${isOver ? 'text-brand-400' : 'text-slate-400 dark:text-neutral-500'}`}>
              {isOver ? t(language, 'text_drop_here') : areaId ? t(language, 'text_no_projects_drag') : t(language, 'text_no_unassigned_projects')}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

/* ─── Sortable area wrapper ─────────────────────────────────────── */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AreaHandleProps = { attributes: any; listeners: any };

const SortableAreaWrapper = ({
  area,
  children,
}: {
  area: AreaType;
  children: (props: { handleProps: AreaHandleProps; isDragging: boolean }) => React.ReactNode;
}) => {
  const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
    id: area.id,
    data: { type: 'area' },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : (transition ?? undefined),
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ handleProps: { attributes, listeners }, isDragging })}
    </div>
  );
};

/* ─── Main Projects Page ────────────────────────────────────────── */
export const ProjectsPage = () => {
  const { projects, fetchProjects, addProject, renameProject, deleteProject, updateProjectColor, updateProjectDescription, setDefaultProject, reorderProjects, updateProjectIcon } = useProjectStore();
  const { areas, fetchAreas, addArea, renameArea, deleteArea, updateAreaColor, reorderAreas } = useAreaStore();
  const { language } = useSettingsStore();

  const [newProjectName, setNewProjectName] = useState('');
  const [newAreaName, setNewAreaName] = useState('');
  const [showAddProject, setShowAddProject] = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'area' | 'project' | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    fetchProjects();
    fetchAreas();
  }, []);

  const handleAddProject = async () => {
    if (!newProjectName.trim()) return;
    await addProject(newProjectName.trim(), null);
    setNewProjectName('');
    setShowAddProject(false);
  };

  const handleAddArea = async () => {
    if (!newAreaName.trim()) return;
    await addArea(newAreaName.trim());
    setNewAreaName('');
    setShowAddArea(false);
  };

  const handleDragStart = (e: DragStartEvent) => {
    setActiveId(e.active.id as string);
    setActiveType(e.active.data.current?.type ?? null);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    setActiveId(null);
    setActiveType(null);
    if (!over || active.id === over.id) return;

    const type = active.data.current?.type;

    if (type === 'area') {
      const areaIds = areas.map((a) => a.id);
      const oldIdx = areaIds.indexOf(active.id as string);
      const newIdx = areaIds.indexOf(over.id as string);
      if (oldIdx !== -1 && newIdx !== -1 && oldIdx !== newIdx) {
        await reorderAreas(arrayMove(areaIds, oldIdx, newIdx));
      }
      return;
    }

    if (type === 'project') {
      const projectId = active.id as string;
      const activeProject = projects.find((p) => p.id === projectId);
      if (!activeProject) return;

      const overType = over.data.current?.type;
      let targetAreaId: string | null;

      if (overType === 'project') {
        const overProject = projects.find((p) => p.id === over.id);
        targetAreaId = overProject?.area_id ?? null;
      } else if (overType === 'area-body') {
        targetAreaId = over.data.current?.areaId ?? null;
      } else if (overType === 'area') {
        targetAreaId = over.id as string;
      } else {
        return;
      }

      const sortedProjects = [...projects].sort((a, b) => a.position - b.position);
      const groupMap = new Map<string | null, ProjectType[]>();
      groupMap.set(null, []);
      for (const a of areas) groupMap.set(a.id, []);
      for (const p of sortedProjects) {
        const key = p.area_id ?? null;
        if (!groupMap.has(key)) groupMap.set(key, []);
        groupMap.get(key)!.push(p as ProjectType);
      }

      const srcGroup = groupMap.get(activeProject.area_id ?? null) ?? [];
      const srcIdx = srcGroup.findIndex((p) => p.id === projectId);
      if (srcIdx !== -1) srcGroup.splice(srcIdx, 1);

      const tgtGroup = groupMap.get(targetAreaId) ?? [];
      const insertBeforeId = overType === 'project' ? (over.id as string) : null;
      const insertIdx = insertBeforeId ? tgtGroup.findIndex((p) => p.id === insertBeforeId) : -1;
      if (insertIdx === -1) {
        tgtGroup.push(activeProject as ProjectType);
      } else {
        tgtGroup.splice(insertIdx, 0, activeProject as ProjectType);
      }
      groupMap.set(targetAreaId, tgtGroup);

      const flatIds: string[] = [];
      for (const a of areas) flatIds.push(...(groupMap.get(a.id) ?? []).map((p) => p.id));
      flatIds.push(...(groupMap.get(null) ?? []).map((p) => p.id));

      const areaChanged = (activeProject.area_id ?? null) !== targetAreaId;
      await reorderProjects(flatIds, areaChanged ? projectId : undefined, areaChanged ? targetAreaId : undefined);
    }
  };

  const handleAreaChange = async (projectId: string, areaId: string | null) => {
    const flatIds = projects.map((p) => p.id);
    await reorderProjects(flatIds, projectId, areaId);
  };

  const sortedProjects = [...projects].sort((a, b) => a.position - b.position);
  const projectsByArea: Record<string, ProjectType[]> = { __none__: [] };
  for (const a of areas) projectsByArea[a.id] = [];
  for (const p of sortedProjects) {
    const key = p.area_id || '__none__';
    if (!projectsByArea[key]) projectsByArea[key] = [];
    projectsByArea[key].push(p as ProjectType);
  }

  const dndActiveProject = activeType === 'project' && activeId ? projects.find((p) => p.id === activeId) : null;
  const activeArea = activeType === 'area' && activeId ? areas.find((a) => a.id === activeId) : null;
  const areaIds = areas.map((a) => a.id);
  const selectedProject = selectedProjectId ? (projects.find((p) => p.id === selectedProjectId) as ProjectType | undefined) ?? null : null;
  const panelOpen = selectedProject !== null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="bg-white dark:bg-neutral-900 h-full min-h-0 flex flex-col">
        {/* Toolbar */}
        <div className="px-6 py-3 border-b border-neutral-100 dark:border-neutral-700/50 flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-neutral-200">{t(language, 'page_projects_heading')}</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => { setShowAddArea(true); setShowAddProject(false); }}
              className="btn-secondary flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> {t(language, 'btn_add_area')}
            </button>
            <button
              type="button"
              onClick={() => { setShowAddProject(true); setShowAddArea(false); }}
              className="btn-primary flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> {t(language, 'btn_add_project')}
            </button>
          </div>
        </div>

        {/* Body: left list + right panel */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Left: project tree */}
          <div className={`flex flex-col min-h-0 overflow-y-auto transition-all duration-200 ${panelOpen ? 'w-[55%]' : 'w-full'}`}>
            <div className="px-4 py-3">
              {showAddProject && (
                <div className="card mb-3 p-3 flex gap-2 items-center">
                  <input
                    autoFocus
                    type="text"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleAddProject(); if (e.key === 'Escape') setShowAddProject(false); }}
                    placeholder={t(language, 'placeholder_project_name')}
                    className="flex-1 form-input"
                  />
                  <button type="button" onClick={handleAddProject} className="btn-primary">{t(language, 'add')}</button>
                  <button type="button" onClick={() => setShowAddProject(false)} className="btn-secondary">{t(language, 'cancel')}</button>
                </div>
              )}

              {showAddArea && (
                <div className="card mb-3 p-3 flex gap-2 items-center">
                  <input
                    autoFocus
                    type="text"
                    value={newAreaName}
                    onChange={(e) => setNewAreaName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') void handleAddArea(); if (e.key === 'Escape') setShowAddArea(false); }}
                    placeholder={t(language, 'placeholder_area_name')}
                    className="flex-1 form-input"
                  />
                  <button type="button" onClick={handleAddArea} className="btn-primary">{t(language, 'add')}</button>
                  <button type="button" onClick={() => setShowAddArea(false)} className="btn-secondary">{t(language, 'cancel')}</button>
                </div>
              )}

              <SortableContext items={areaIds} strategy={verticalListSortingStrategy}>
                {areas.map((area) => (
                  <SortableAreaWrapper key={area.id} area={area}>
                    {({ handleProps, isDragging }) => (
                      <AreaSection
                        areaId={area.id}
                        areaName={area.name}
                        areaColor={area.color}
                        projects={projectsByArea[area.id] || []}
                        selectedId={selectedProjectId}
                        handleProps={handleProps}
                        isDraggingArea={isDragging}
                        onRenameArea={renameArea}
                        onDeleteArea={deleteArea}
                        onColorChangeArea={updateAreaColor}
                        onSelectProject={setSelectedProjectId}
                      />
                    )}
                  </SortableAreaWrapper>
                ))}
              </SortableContext>

              <AreaSection
                areaId={null}
                areaName={t(language, 'option_no_area')}
                areaColor={null}
                projects={projectsByArea['__none__'] || []}
                selectedId={selectedProjectId}
                onRenameArea={null}
                onDeleteArea={null}
                onColorChangeArea={null}
                onSelectProject={setSelectedProjectId}
              />

              {projects.length === 0 && areas.length === 0 && (
                <div className="py-16 text-center">
                  <FolderOpen className="w-10 h-10 text-slate-300 dark:text-neutral-600 mx-auto mb-3" />
                  <p className="text-slate-400 dark:text-neutral-500 text-sm">{t(language, 'empty_projects')}</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: settings panel */}
          {panelOpen && selectedProject && (
            <div className="w-[45%] h-full min-h-0 flex flex-col border-l border-neutral-100 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-800">
              <ProjectPanel
                project={selectedProject}
                areas={areas}
                onClose={() => setSelectedProjectId(null)}
                onRename={renameProject}
                onColorChange={updateProjectColor}
                onDescriptionChange={updateProjectDescription}
                onAreaChange={handleAreaChange}
                onSetDefault={setDefaultProject}
                onDelete={async (id) => {
                  try {
                    await deleteProject(id);
                    setSelectedProjectId(null);
                  } catch (error) {
                    console.error('[ProjectDelete]', error);
                    window.alert('Failed to delete project. Please try again.');
                  }
                }}
                onIconChange={async (id, icon, iconType, iconColor) => updateProjectIcon(id, icon, iconType, iconColor)}
              />
            </div>
          )}
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {dndActiveProject ? (
          <div className="card flex items-center gap-2.5 px-3 py-2 shadow-lg opacity-90 w-56">
            <div
              className="w-2.5 h-2.5 rounded-full shrink-0 border-[2px] border-white dark:border-neutral-800"
              style={{ backgroundColor: dndActiveProject.color || '#94a3b8', boxShadow: `0 0 0 1.5px ${dndActiveProject.color || '#94a3b8'}` }}
            />
            <span className="text-sm font-medium text-slate-800 dark:text-neutral-200 truncate">{dndActiveProject.name}</span>
          </div>
        ) : activeArea ? (
          <div className="bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-lg px-3 py-2 flex items-center gap-2 w-64 opacity-90">
            <GripVertical className="w-3.5 h-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
            <div
              className="w-3.5 h-3.5 rounded-full border-2 border-white dark:border-neutral-800 shadow ring-1 ring-slate-200 dark:ring-neutral-600 shrink-0"
              style={{ backgroundColor: activeArea.color || '#94a3b8' }}
            />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-neutral-300 truncate">
              {activeArea.name}
            </span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
};
