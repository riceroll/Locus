import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ColumnDropLine } from './kanbanUtils';

export const SortableColumnWrapper = ({
  id,
  draggingColumn,
  children,
}: {
  id: string;
  draggingColumn: boolean;
  children: (handleProps: {
    attributes: Record<string, any>;
    listeners: Record<string, any> | undefined;
  }) => ReactNode;
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    isDragging,
    isOver,
  } = useSortable({
    id,
    data: { type: 'column' },
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div className="flex items-stretch">
      <ColumnDropLine active={draggingColumn && isOver && !isDragging} />
      <div ref={setNodeRef} style={style}>
        {children({ attributes, listeners })}
      </div>
    </div>
  );
};
