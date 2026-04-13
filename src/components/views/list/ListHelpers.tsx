import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';

export const QuickAddRow = ({
  parentId,
  colCount,
  level,
  onAdd,
  onCancel,
}: {
  parentId: string | null;
  colCount: number;
  projectId: string | null;
  level: number;
  onAdd: (title: string) => Promise<void>;
  onCancel: () => void;
}) => {
  const [value, setValue] = useState('');
  return (
    <tr className="bg-brand-50/40 dark:bg-brand-900/20">
      <td className="px-0 py-1.5 border-b border-slate-100 dark:border-neutral-600/70 w-7">&nbsp;</td>
      <td className="px-0 py-1.5 border-b border-slate-100 dark:border-neutral-600/70 w-8">&nbsp;</td>
      <td
        className="py-1.5 border-b border-slate-100 dark:border-neutral-600/70"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter' && value.trim()) await onAdd(value.trim());
            if (e.key === 'Escape') onCancel();
          }}
          placeholder={parentId ? 'Subtask name…' : 'Task name…'}
          className="w-full text-sm border border-brand-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-400 dark:bg-neutral-900 dark:border-neutral-500 dark:text-neutral-100 dark:placeholder:text-neutral-400"
        />
      </td>
      <td className="border-b border-slate-100 dark:border-neutral-600/70" colSpan={Math.max(1, colCount - 3)}>
        <div className="flex gap-1 px-2">
          <button
            type="button"
            onClick={async () => { if (value.trim()) await onAdd(value.trim()); }}
            className="text-xs px-2 py-1 rounded bg-brand-500 text-white hover:bg-brand-600"
          >Add</button>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700"
          >Cancel</button>
        </div>
      </td>
    </tr>
  );
};

export const ConfirmDeleteRow = ({
  title,
  hasChildren,
  onConfirm,
  onConfirmRecursive,
  onCancel,
  colCount,
}: {
  title: string;
  hasChildren: boolean;
  onConfirm: () => void;
  onConfirmRecursive: () => void;
  onCancel: () => void;
  colCount: number;
}) => (
  <tr className="bg-red-50 dark:bg-red-900/20">
    <td colSpan={colCount} className="px-6 py-2 border-b border-slate-100 dark:border-neutral-600/70">
      <div className="flex items-center gap-2 text-sm flex-wrap">
        <span className="text-slate-600 dark:text-neutral-200 mr-1">
          Delete <span className="font-medium">"{title}"</span>?
        </span>
        <button type="button" onClick={onConfirm}
          className="px-3 py-1 rounded bg-orange-500 text-white hover:bg-orange-600 text-xs">
          {hasChildren ? 'Delete task only (keep subtasks)' : 'Yes, delete'}
        </button>
        {hasChildren && (
          <button type="button" onClick={onConfirmRecursive}
            className="px-3 py-1 rounded bg-red-500 text-white hover:bg-red-600 text-xs">
            Delete task + all subtasks
          </button>
        )}
        <button type="button" onClick={onCancel}
          className="px-3 py-1 rounded bg-slate-100 dark:bg-neutral-800 text-slate-600 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-700 text-xs">Cancel</button>
      </div>
    </td>
  </tr>
);

export const DropBetweenRow = ({ id, colCount }: { id: string; colCount: number }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <tr ref={setNodeRef}>
      <td
        colSpan={colCount}
        className={`transition-all duration-100 ${isOver ? 'h-1 bg-brand-500' : 'h-0 bg-transparent'}`}
      />
    </tr>
  );
};
