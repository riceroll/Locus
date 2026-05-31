import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DropLine } from './kanbanUtils';
import { TaskCardCore } from '../shared/TaskCardCore';
import { type Task } from '../../../store/useTaskStore';

export const SortableTaskCard = ({
  task,
  isOverlay,
  onOpenDetail,
  childCount = 0,
  doneChildCount = 0,
  totalTimeSec = 0,
}: {
  task: Task;
  isOverlay?: boolean;
  onOpenDetail?: (id: string) => void;
  childCount?: number;
  doneChildCount?: number;
  totalTimeSec?: number;
}) => {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: task.id,
    data: { type: 'task', status_id: task.status_id },
  });

  const style = {
    transform: isOverlay ? undefined : (isDragging ? undefined : CSS.Translate.toString(transform)),
    transition: isOverlay ? undefined : (isDragging ? 'none' : transition),
    opacity: isDragging ? 0 : 1,
  };

  if (isOverlay) {
    return <TaskCardCore task={task} isOverlay />;
  }

  return (
    <>
      <DropLine active={isOver} />
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        style={style}
        className="group card card-hover cursor-grab active:cursor-grabbing touch-none"
      >
        <TaskCardCore
          task={task}
          onOpenDetail={onOpenDetail}
          childCount={childCount}
          doneChildCount={doneChildCount}
          totalTimeSec={totalTimeSec}
        />
      </div>
    </>
  );
};
