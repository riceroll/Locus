import { type Task } from '../../../store/useTaskStore';
import { TreeCard } from './TreeCard';
import { useSortable, SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore } from '../../../store/useTaskStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DragOverlay, type DragStartEvent } from '@dnd-kit/core';
import { Plus } from 'lucide-react';
import { t } from '../../../i18n';

interface TreeNodeProps {
  node: Task & { children: any[] };
  isRoot?: boolean;
  isFirst?: boolean;
  isLast?: boolean;
  isOnly?: boolean;
  isOverlay?: boolean;
  isSiblingDragging?: boolean;
  canvasScale?: number;
  forcedCollapsedIds?: Set<string>;
  onAddSiblingBelow?: (title: string) => Promise<void>;
}

export const TreeNode = ({ node, isRoot = true, isFirst = true, isLast = true, isOnly = true, isOverlay = false, isSiblingDragging = false, canvasScale = 1, forcedCollapsedIds, onAddSiblingBelow }: TreeNodeProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = node.collapsed === 1 || (forcedCollapsedIds?.has(node.id.toString()) ?? false) || isOverlay;
  const { tasks, batchUpdatePositions, addTask } = useTaskStore();
  const { language } = useSettingsStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  const [addingChildPosition, setAddingChildPosition] = useState<'top' | 'bottom' | null>(null);
  const [addingChildTitle, setAddingChildTitle] = useState('');
  const [addInputAnchor, setAddInputAnchor] = useState<{ x: number; y: number } | null>(null);
  const [addingSiblingBelow, setAddingSiblingBelow] = useState(false);
  const [addingSiblingTitle, setAddingSiblingTitle] = useState('');
  const [siblingAnchor, setSiblingAnchor] = useState<{ x: number; y: number } | null>(null);
  const siblingStripRef = useRef<HTMLButtonElement>(null);
  // Local set of child IDs forced collapsed during drag (no DB writes)
  const [childForcedCollapsedIds, setChildForcedCollapsedIds] = useState<Set<string> | null>(null);
  const stripRef = useRef<HTMLButtonElement>(null);

  const startAddingChild = (position: 'top' | 'bottom') => {
    if (stripRef.current) {
      const rect = stripRef.current.getBoundingClientRect();
      setAddInputAnchor({ x: rect.left, y: rect.top });
    }
    setAddingChildPosition(position);
    setAddingChildTitle('');
  };

  const cancelAddingChild = () => {
    setAddingChildPosition(null);
    setAddingChildTitle('');
    setAddInputAnchor(null);
  };

  const addChildAtBottom = async (title: string) => {
    if (!title.trim()) return;
    await addTask(title.trim(), undefined, node.id);
  };

  const addChildAtTop = async (title: string) => {
    if (!title.trim()) return;
    const newId = await addTask(title.trim(), undefined, node.id);
    if (!newId) return;

    const childIds = tasks
      .filter((task) => task.parent_id === node.id)
      .sort((a, b) => a.position - b.position)
      .map((task) => task.id)
      .filter((id) => id !== newId);

    await batchUpdatePositions([
      { id: newId, position: 0 },
      ...childIds.map((id, index) => ({ id, position: index + 1 })),
    ]);
  };

  const confirmAddingChild = async () => {
    if (!addingChildPosition || !addingChildTitle.trim()) return;
    if (addingChildPosition === 'top') {
      await addChildAtTop(addingChildTitle);
    } else {
      await addChildAtBottom(addingChildTitle);
    }
    cancelAddingChild();
  };

  const childAddStripClassName = 'w-[280px] h-6 rounded-lg border border-dashed border-slate-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 text-slate-400 dark:text-neutral-500 flex items-center justify-center opacity-0 hover:opacity-100 hover:border-brand-300 hover:bg-white dark:hover:bg-neutral-800 hover:text-brand-500 dark:hover:text-brand-400 transition-all shadow-sm pointer-events-auto cursor-pointer';
  const siblingAddStripClassName = 'w-[280px] h-5 rounded-md border border-dashed border-slate-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-800/80 text-slate-400 dark:text-neutral-500 flex items-center justify-center opacity-0 hover:opacity-100 hover:border-brand-300 hover:bg-white dark:hover:bg-neutral-800 hover:text-brand-500 dark:hover:text-brand-400 transition-all shadow-sm pointer-events-auto cursor-pointer';

  const childAddInputPortal = () => {
    if (!addingChildPosition || !addInputAnchor || typeof window === 'undefined') return null;
    return createPortal(
      <div
        className="fixed z-[9999] pointer-events-auto"
        style={{ left: addInputAnchor.x, top: addInputAnchor.y }}
      >
        <div className="w-[280px] rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-neutral-800 px-2.5 py-2 shadow-[0_0_0_3px_theme(colors.brand.100),0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_3px_theme(colors.brand.900/60%),0_4px_12px_rgba(0,0,0,0.3)]">
          <input
            autoFocus
            type="text"
            value={addingChildTitle}
            onChange={(e) => setAddingChildTitle(e.target.value)}
            onPointerDown={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void confirmAddingChild();
              if (e.key === 'Escape') cancelAddingChild();
            }}
            placeholder={t(language, 'placeholder_task_name')}
            className="w-full text-sm bg-transparent text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
          />
          <div className="mt-2 flex items-center gap-1.5">
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => void confirmAddingChild()}
              className="text-xs px-2.5 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 transition"
            >
              {t(language, 'add')}
            </button>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={cancelAddingChild}
              className="text-xs px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
            >
              {t(language, 'cancel')}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const handleChildDragStart = (event: DragStartEvent) => {
    setActiveChildId(event.active.id.toString());
    // Force-collapse all expanded children (locally, not in DB)
    const expanded = new Set<string>();
    for (const child of node.children) {
      if (child.children?.length > 0 && child.collapsed !== 1) {
        expanded.add(child.id.toString());
      }
    }
    if (expanded.size > 0) {
      setChildForcedCollapsedIds(expanded);
    }
  };

  const handleChildDragCancel = () => {
    setActiveChildId(null);
    setChildForcedCollapsedIds(null);
  };

  const handleChildDragEnd = (event: DragEndEvent) => {
    setActiveChildId(null);
    setChildForcedCollapsedIds(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = node.children.map((c: any) => c.id.toString());
    const oldIndex = ids.indexOf(active.id.toString());
    const newIndex = ids.indexOf(over.id.toString());
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(ids, oldIndex, newIndex);
    const updates: { id: string; position: number }[] = [];
    reordered.forEach((id, i) => {
      const task = tasks.find(t => t.id === id);
      if (task && task.position !== i) updates.push({ id, position: i });
    });
    if (updates.length > 0) batchUpdatePositions(updates);
  };

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: node.id.toString(), disabled: isOverlay });

  const style = {
    transform: isOverlay ? undefined : CSS.Translate.toString(transform),
    transition: isOverlay ? undefined : transition,
    zIndex: isDragging ? 50 : 'auto' as const,
    visibility: (isDragging && !isOverlay) ? 'hidden' as const : undefined,
  };

  // Show bounding box on sibling trees during a drag
  const showBBox = isSiblingDragging && !isOverlay;

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className={`relative flex flex-row items-center w-max ${!isRoot ? 'py-2 pl-[24px]' : ''}`}
      data-tree-node="true"
    >
      {/* Semi-transparent bounding box visible during sibling drag */}
      {showBBox && (
        <div className="absolute inset-0 rounded-lg border-2 border-dashed border-blue-400/30 bg-blue-100/10 dark:border-blue-500/25 dark:bg-blue-900/10 pointer-events-none z-0" />
      )}

      {/* Connector Lines for Non-Root Nodes */}
      {!isRoot && !isOverlay && !isSiblingDragging && (
        <div className={`pointer-events-none transition-opacity duration-300 ease-in-out ${isSiblingDragging ? 'opacity-0' : 'opacity-100'}`}>
          {isOnly ? (
            <div className="absolute left-0 top-[50%] mt-[-1px] w-[24px] border-t-2 border-slate-300 dark:border-neutral-600" />
          ) : isFirst ? (
            <div className="absolute left-0 top-[50%] mt-[-1px] bottom-0 w-[24px] border-l-2 border-t-2 border-slate-300 dark:border-neutral-600 rounded-tl-xl" />
          ) : isLast ? (
            <div className="absolute left-0 top-0 bottom-[50%] mb-[-1px] w-[24px] border-l-2 border-b-2 border-slate-300 dark:border-neutral-600 rounded-bl-xl" />
          ) : (
            <>
              <div className="absolute left-0 top-0 bottom-0 border-l-2 border-slate-300 dark:border-neutral-600" />
              <div className="absolute left-0 top-[50%] mt-[-1px] w-[24px] border-t-2 border-slate-300 dark:border-neutral-600" />
            </>
          )}
        </div>
      )}

      {/* Node Main Row */}
      <div className="relative z-10 shrink-0">
        <TreeCard  
          task={node}  
          hasChildren={hasChildren} 
          isCollapsed={isCollapsed} 
          isRoot={isRoot}
          dragAttributes={attributes} 
          dragListeners={listeners} 
        />
        {/* Parent Branch extending right if opened */}
        {hasChildren && !isCollapsed && (
          <div className="absolute top-[50%] mt-[-1px] right-[-24px] w-[24px] border-t-2 border-slate-300 dark:border-neutral-600 z-0" />
        )}
      </div>

      {/* Children Sub-Tree */}
      {hasChildren && !isCollapsed && (
        <div className="group/children flex flex-col relative ml-[24px] z-0">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleChildDragStart}
            onDragEnd={handleChildDragEnd}
            onDragCancel={handleChildDragCancel}
          >
            <SortableContext
              items={node.children.map((c: any) => c.id.toString())}
              strategy={verticalListSortingStrategy}
            >
              {node.children.map((child: any, idx: number, arr: any[]) => (
                <TreeNode 
                  key={child.id} 
                  node={child} 
                  isRoot={false} 
                  isFirst={idx === 0}
                  isLast={idx === arr.length - 1} 
                  isOnly={arr.length === 1}
                  isSiblingDragging={!!activeChildId}
                  canvasScale={canvasScale}
                  forcedCollapsedIds={childForcedCollapsedIds ?? undefined}
                />
              ))}
            </SortableContext>
            {typeof window !== 'undefined' && createPortal(
              <DragOverlay zIndex={20} dropAnimation={null}>
                {activeChildId ? (() => {
                  const activeChild = node.children.find(c => c.id.toString() === activeChildId);
                  if (!activeChild) return null;
                  return (
                    <div style={{ opacity: 1, pointerEvents: 'none', transform: `scale(${canvasScale})`, transformOrigin: 'top left' }}>
                      <TreeNode node={activeChild} isRoot={false} isOverlay={true} canvasScale={canvasScale} />
                    </div>
                  );
                })() : null}
              </DragOverlay>,
              document.body
            )}
          </DndContext>
          <div
            className="absolute left-0 bottom-0 w-[304px] pl-[24px] z-20 pointer-events-none"
            style={{ transform: 'translateY(calc(100% + 0.5px))' }}
          >
            {addingChildPosition !== 'bottom' && (
              <button
                ref={stripRef}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => startAddingChild('bottom')}
                className={childAddStripClassName}
                title="Add child at bottom"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
          {childAddInputPortal()}
        </div>
      )}

      {/* Root sibling add strip */}
      {isRoot && !isOverlay && onAddSiblingBelow && (
        <div
          className="absolute left-0 bottom-0 w-[280px] z-20 pointer-events-none"
          style={{ transform: 'translateY(calc(100% + 2px))' }}
        >
          {!addingSiblingBelow && (
            <button
              ref={siblingStripRef}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (siblingStripRef.current) {
                  const rect = siblingStripRef.current.getBoundingClientRect();
                  setSiblingAnchor({ x: rect.left, y: rect.top });
                }
                setAddingSiblingBelow(true);
                setAddingSiblingTitle('');
              }}
              className={siblingAddStripClassName}
              title="Add root task below"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {addingSiblingBelow && siblingAnchor && typeof window !== 'undefined' && createPortal(
            <div
              className="fixed z-[9999] pointer-events-auto"
              style={{ left: siblingAnchor.x, top: siblingAnchor.y }}
            >
              <div className="w-[280px] rounded-lg border border-brand-200 dark:border-brand-700 bg-white dark:bg-neutral-800 px-2.5 py-2 shadow-[0_0_0_3px_theme(colors.brand.100),0_4px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_0_0_3px_theme(colors.brand.900/60%),0_4px_12px_rgba(0,0,0,0.3)]">
                <input
                  autoFocus
                  type="text"
                  value={addingSiblingTitle}
                  onChange={(e) => setAddingSiblingTitle(e.target.value)}
                  onPointerDown={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void onAddSiblingBelow(addingSiblingTitle).then(() => {
                        setAddingSiblingBelow(false);
                        setSiblingAnchor(null);
                      });
                    }
                    if (e.key === 'Escape') {
                      setAddingSiblingBelow(false);
                      setSiblingAnchor(null);
                    }
                  }}
                  placeholder={t(language, 'placeholder_task_name')}
                  className="w-full text-sm bg-transparent text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 outline-none"
                />
                <div className="mt-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => {
                      void onAddSiblingBelow(addingSiblingTitle).then(() => {
                        setAddingSiblingBelow(false);
                        setSiblingAnchor(null);
                      });
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-brand-600 text-white hover:bg-brand-700 transition"
                  >
                    {t(language, 'add')}
                  </button>
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => { setAddingSiblingBelow(false); setSiblingAnchor(null); }}
                    className="text-xs px-2.5 py-1 rounded bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
                  >
                    {t(language, 'cancel')}
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>
      )}
    </div>
  );
};
