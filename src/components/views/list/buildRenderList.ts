import type { Task } from '../../../store/useTaskStore';

export interface AncestorItem {
  id: string;
  title: string;
}

export interface RenderRow {
  task: Task;
  level: number;
  childCount: number;
  doneChildCount: number;
  ancestors?: AncestorItem[];
}

export function buildRenderList(
  allTasks: Task[],
  doneSet: Set<string>,
  parentId: string | null,
  level: number,
): RenderRow[] {
  const siblings = allTasks
    .filter((t) => (t.parent_id ?? null) === parentId)
    .sort((a, b) => a.position - b.position || a.created_at - b.created_at);

  const result: RenderRow[] = [];
  for (const task of siblings) {
    const children = allTasks.filter((t) => t.parent_id === task.id);
    const doneChildCount = children.filter((c) => doneSet.has(c.status_id)).length;
    result.push({ task, level, childCount: children.length, doneChildCount });
    if (!task.collapsed && children.length > 0) {
      result.push(...buildRenderList(allTasks, doneSet, task.id, level + 1));
    }
  }
  return result;
}

export function getAncestorChain(task: Task, allTasks: Task[]): AncestorItem[] {
  const chain: AncestorItem[] = [];
  const visited = new Set<string>();
  let current = task;
  while (current.parent_id) {
    if (visited.has(current.parent_id)) break;
    visited.add(current.parent_id);
    const parent = allTasks.find((t) => t.id === current.parent_id);
    if (!parent) break;
    chain.unshift({ id: parent.id, title: parent.title });
    current = parent;
  }
  return chain;
}
