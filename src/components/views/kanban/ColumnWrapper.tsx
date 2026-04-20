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
    transform: draggingColumn && isDragging ? undefined : CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  return (
    <div className="flex items-stretch max-h-full min-h-0 shrink-0">
      <ColumnDropLine active={draggingColumn && isOver && !isDragging} />
      <div ref={setNodeRef} style={style} className="max-h-full min-h-0 flex flex-col shrink-0 flex-1">
        {children({ attributes, listeners })}
      </div>
    </div>
  );
};
