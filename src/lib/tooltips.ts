export interface TooltipContent {
  title: string;
  body: string;
}

/**
 * Central tooltip registry. Add an entry here and reference it by key
 * in <Tooltip id="key">…</Tooltip> anywhere in the UI.
 */
export const TOOLTIPS: Record<string, TooltipContent> = {
  actionable: {
    title: 'Actionable',
    body: 'Shows only leaf tasks (no subtasks) that are not yet completed — tasks you can act on right now.',
  },
  viewable: {
    title: 'Visible Only',
    body: 'Hides tasks that have been manually hidden with the eye icon.',
  },
  'column-visibility': {
    title: 'Column Visibility',
    body: 'Toggle which columns are shown in the table.',
  },
  sort: {
    title: 'Sort',
    body: 'Apply a one-time sort to the task list. Click the active column header again to reverse or clear.',
  },
  'new-task': {
    title: 'New Task',
    body: 'Create a new top-level task.',
  },
  'task-timer': {
    title: 'Timer',
    body: 'Start tracking time spent on this task.',
  },
  'task-drag': {
    title: 'Drag to Reorder',
    body: 'Drag this handle to reorder or nest tasks.',
  },
  'delete-task': {
    title: 'Delete Task',
    body: 'Permanently removes this task. Cannot be undone.',
  },
  'task-visible': {
    title: 'Visibility',
    body: 'Visible tasks appear in the default list view. Hidden tasks are filtered out unless "Show Hidden" is on.',
  },
};
