import type { Task } from '../store/useTaskStore';
import type { ViewFilters } from '../store/useViewStore';

export const applyTaskFilters = (
  tasks: Task[],
  filters: ViewFilters,
  options?: { projects?: { id: string; area_id: string | null }[] },
): Task[] => {
  if (!filters.rules || filters.rules.length === 0) {
    return tasks;
  }

  const areaByProjectId = new Map<string, string | null>();
  for (const project of options?.projects ?? []) {
    areaByProjectId.set(project.id, project.area_id ?? null);
  }

  return tasks.filter(task => {
    for (const rule of filters.rules) {
      if (!rule.values || rule.values.length === 0) {
        continue;
      }

      const raw =
        rule.field === 'area_id'
          ? (task.project_id ? areaByProjectId.get(task.project_id) : null)
          : (task as any)[rule.field];
      const value = raw == null ? '' : String(raw);
      const has = rule.values.includes(value);

      if (rule.operator === 'include' && !has) {
        return false;
      }
      if (rule.operator === 'exclude' && has) {
        return false;
      }
    }

    return true;
  });
};
