/**
 * Reusable drag-and-drop utilities built on @dnd-kit.
 *
 * Provides:
 *  - SortableItem: vertical sortable wrapper with drop-indicator line
 *  - SortableColumn: horizontal sortable wrapper for columns
 *  - DropIndicator: visual line showing where the item will land
 *  - helpers for multi-container (cross-column) DnD
 */
import { type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';

// ─── Drop indicator line ────────────────────────────────────────────
export const DropIndicator = ({ isOver }: { isOver: boolean }) => (
  <div
    className={`transition-all duration-150 ${
      isOver ? 'h-0.5 my-1 bg-brand-500 rounded-full opacity-100' : 'h-0 opacity-0'
    }`}
  />
);

// ─── Sortable item (vertical, for cards inside columns) ─────────────
interface SortableItemProps {
  id: string;
  data?: Record<string, unknown>;
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    attributes: Record<string, any>;
    listeners: Record<string, any> | undefined;
    isDragging: boolean;
    isOver: boolean;
  }) => ReactNode;
}

export const SortableItem = ({ id, data, children }: SortableItemProps) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id, data });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : transition ?? undefined,
    opacity: isDragging ? 0 : 1,
    position: 'relative' as const,
    zIndex: isDragging ? 50 : undefined,
  };

  return <>{children({ setNodeRef, style, attributes, listeners, isDragging, isOver })}</>;
};

// ─── Sortable column (horizontal, for reordering columns) ───────────
interface SortableColumnProps {
  id: string;
  children: (props: {
    setNodeRef: (node: HTMLElement | null) => void;
    style: CSSProperties;
    handleProps: {
      attributes: Record<string, any>;
      listeners: Record<string, any> | undefined;
    };
    isDragging: boolean;
  }) => ReactNode;
}

export const SortableColumn = ({ id, children }: SortableColumnProps) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : transition ?? undefined,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <>
      {children({
        setNodeRef,
        style,
        handleProps: { attributes, listeners },
        isDragging,
      })}
    </>
  );
};

// ─── Droppable container (for a column body) ────────────────────────
interface DroppableContainerProps {
  id: string;
  children: ReactNode;
  className?: string;
}

export const DroppableContainer = ({ id, children, className }: DroppableContainerProps) => {
  const { setNodeRef } = useDroppable({ id });
  return (
    <div ref={setNodeRef} className={className}>
      {children}
    </div>
  );
};

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Given a list of IDs and a drag event, compute the new order after
 * moving `activeId` next to `overId`.
 */
export function reorderIds(ids: string[], activeId: string, overId: string): string[] {
  const oldIndex = ids.indexOf(activeId);
  const newIndex = ids.indexOf(overId);
  if (oldIndex === -1 || newIndex === -1) return ids;
  const result = [...ids];
  result.splice(oldIndex, 1);
  result.splice(newIndex, 0, activeId);
  return result;
}
