import { type Task } from '../../../store/useTaskStore';
import { TreeCard } from './TreeCard';
import { useSortable, SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStore } from '../../../store/useTaskStore';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DragOverlay, type DragStartEvent } from '@dnd-kit/core';

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
}

export const TreeNode = ({ node, isRoot = true, isFirst = true, isLast = true, isOnly = true, isOverlay = false, isSiblingDragging = false, canvasScale = 1, forcedCollapsedIds }: TreeNodeProps) => {
  const hasChildren = node.children && node.children.length > 0;
  const isCollapsed = node.collapsed === 1 || (forcedCollapsedIds?.has(node.id.toString()) ?? false);
  const { tasks, batchUpdatePositions } = useTaskStore();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const [activeChildId, setActiveChildId] = useState<string | null>(null);
  // Local set of child IDs forced collapsed during drag (no DB writes)
  const [childForcedCollapsedIds, setChildForcedCollapsedIds] = useState<Set<string> | null>(null);

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
        <div className="flex flex-col relative ml-[24px] z-0">
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
        </div>
      )}
    </div>
  );
};
