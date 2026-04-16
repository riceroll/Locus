import { create } from 'zustand';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status_id: string;
  status: string;
  project_id: string | null;
  priority: string | null;
  estimate: number | null;
  parent_id: string | null;
  visible: number;
  position: number;
  collapsed: number;
  due_date: number | null;
  created_at: number;
  updated_at: number;
}

interface TaskState {
  tasks: Task[];
  isLoading: boolean;
  error: string | null;
  fetchTasks: () => Promise<void>;
  addTask: (title: string, projectId?: string, parentId?: string | null, statusId?: string) => Promise<string>;
  updateTask: (id: string, fields: Partial<Pick<Task, 'title' | 'description' | 'status_id' | 'project_id' | 'priority' | 'estimate' | 'parent_id' | 'collapsed' | 'due_date' | 'visible'>>) => Promise<void>;
  updateTaskStatus: (id: string, statusId: string) => Promise<void>;
  updateTaskProject: (id: string, projectId: string | null) => Promise<void>;
  toggleCollapsed: (id: string) => Promise<void>;
  toggleVisible: (id: string) => Promise<void>;
  setChildrenVisibility: (id: string, visible: boolean) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  deleteTaskRecursive: (id: string) => Promise<void>;
  addNextTask: (afterTaskId: string, title: string) => Promise<void>;
  moveTask: (taskId: string, newParentId: string | null, afterSiblingId: string | null) => Promise<void>;
  batchUpdatePositions: (orderedIds: { id: string; position: number }[]) => Promise<void>;
  moveTaskToColumn: (taskIds: string | string[], targetStatusId: string, positionUpdates: { id: string; position: number }[]) => Promise<void>;
}

// ── Relationship helpers ─────────────────────────────────────────

function wouldCycleParent(taskId: string, newParentId: string | null, tasks: Task[]): boolean {
  if (!newParentId) return false;
  const visited = new Set<string>();
  let cur: string | null = newParentId;
  while (cur) {
    if (cur === taskId) return true;
    if (visited.has(cur)) return true;
    visited.add(cur);
    cur = tasks.find((t) => t.id === cur)?.parent_id ?? null;
  }
  return false;
}

export function collectDescendantIds(taskId: string, tasks: Task[]): string[] {
  const result: string[] = [];
  const queue = [taskId];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const t of tasks) {
      if (t.parent_id === cur) {
        result.push(t.id);
        queue.push(t.id);
      }
    }
  }
  return result;
}

function collectLeafDescendantIds(taskId: string, tasks: Task[]): string[] {
  const allDesc = collectDescendantIds(taskId, tasks);
  const parentIds = new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!));
  return allDesc.filter((id) => !parentIds.has(id));
}

// ── Startup repair ───────────────────────────────────────────────

type Db = Awaited<ReturnType<typeof import('../db').getDb>>;

async function repairRelationships(db: Db, tasks: Task[]): Promise<void> {
  const now = Date.now();
  const idSet = new Set(tasks.map((t) => t.id));
  for (const task of tasks) {
    if (task.parent_id && !idSet.has(task.parent_id)) {
      console.warn(`[repair] Task ${task.id} has dangling parent_id — clearing`);
      await db.execute('UPDATE tasks SET parent_id = NULL, updated_at = $1 WHERE id = $2', [now, task.id]);
    }
    if (task.parent_id && wouldCycleParent(task.id, task.parent_id, tasks)) {
      console.warn(`[repair] Task ${task.id} circular parent chain — clearing`);
      await db.execute('UPDATE tasks SET parent_id = NULL, updated_at = $1 WHERE id = $2', [now, task.id]);
    }
  }
}

// ── Store ────────────────────────────────────────────────────────

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,

  fetchTasks: async () => {
    set({ isLoading: true, error: null });
    try {
      const db = await getDb();
      const rows = await db.select<Task[]>(
        `SELECT
          t.id, t.title, t.description, t.status_id,
          COALESCE(ts.name, 'Unknown') AS status,
          t.project_id, t.priority, t.estimate,
          COALESCE(t.parent_id, NULL) AS parent_id,
          COALESCE(t.visible, 1) AS visible,
          COALESCE(t.position, 0) AS position,
          COALESCE(t.collapsed, 0) AS collapsed,
          t.due_date, t.created_at, t.updated_at
        FROM tasks t
        LEFT JOIN task_statuses ts ON ts.id = t.status_id
        ORDER BY t.position ASC, t.created_at DESC`
      );
      set({ tasks: rows, isLoading: false });
      await repairRelationships(db, rows);
    } catch (e: any) {
      console.error('fetchTasks error:', e);
      set({ error: e.message, isLoading: false });
    }
  },

  addTask: async (title, projectId, parentId = null, statusId) => {
    try {
      const db = await getDb();
      const id = uuidv4();
      const now = Date.now();
      let resolvedProjectId = projectId || null;
      let defaultStatusId = statusId;
      
      if (parentId) {
        const parent = get().tasks.find((t) => t.id === parentId);
        if (parent) {
          resolvedProjectId = parent.project_id;
          if (!defaultStatusId) defaultStatusId = parent.status_id;
        }
      } 
      
      if (!parentId && !resolvedProjectId) {
        // Use default project if set
        const { useProjectStore } = await import('./useProjectStore');
        resolvedProjectId = useProjectStore.getState().getDefaultProjectId();
      }

      if (!defaultStatusId) {
        const openRows = await db.select<{ id: string }[]>(
          'SELECT id FROM task_statuses WHERE is_done = 0 ORDER BY position ASC LIMIT 1'
        );
        const anyRows = await db.select<{ id: string }[]>(
          'SELECT id FROM task_statuses ORDER BY position ASC LIMIT 1'
        );
        defaultStatusId = openRows[0]?.id || anyRows[0]?.id || 'status-todo';
      }
      const posRows = await db.select<{ maxPos: number }[]>(
        'SELECT COALESCE(MAX(position), -1) + 1 AS maxPos FROM tasks WHERE COALESCE(parent_id, \'\') = COALESCE($1, \'\')',
        [parentId]
      );
      const position = posRows[0]?.maxPos ?? 0;
      await db.execute(
        'INSERT INTO tasks (id, title, description, status_id, project_id, priority, estimate, parent_id, visible, position, collapsed, due_date, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
        [id, title, null, defaultStatusId, resolvedProjectId, null, null, parentId, 1, position, 0, null, now, now]
      );
      await get().fetchTasks();
      return id;
    } catch (e: any) {
      console.error('addTask error:', e);
      set({ error: e.message });
      return '';
    }
  },

  updateTask: async (id, fields) => {
    try {
      const db = await getDb();
      const tasks = get().tasks;
      const allowed = ['title', 'description', 'status_id', 'project_id', 'priority', 'estimate', 'parent_id', 'collapsed', 'due_date', 'visible'] as const;
      const safeFields = { ...fields };

      if ('parent_id' in safeFields) {
        const newParent = safeFields.parent_id ?? null;
        if (wouldCycleParent(id, newParent, tasks)) {
          console.warn(`updateTask: parent_id cycle — skipped`);
          delete safeFields.parent_id;
        }
      }

      const entries = Object.entries(safeFields).filter(([k]) => allowed.includes(k as typeof allowed[number]));
      if (entries.length === 0) return;
      const sets = entries.map(([k], i) => `${k} = $${i + 2}`).join(', ');
      const vals = entries.map(([, v]) => v);
      await db.execute(`UPDATE tasks SET ${sets}, updated_at = $1 WHERE id = $${entries.length + 2}`, [Date.now(), ...vals, id]);
      await get().fetchTasks();
    } catch (e: any) {
      console.error('updateTask error:', e);
      set({ error: e.message });
    }
  },

  updateTaskStatus: async (id, statusId) => {
    try {
      const now = Date.now();
      // Optimistic update: reflect status change immediately
      set({ tasks: get().tasks.map((t) => t.id === id ? { ...t, status_id: statusId, updated_at: now } : t) });
      const db = await getDb();
      await db.execute('UPDATE tasks SET status_id = $1, updated_at = $2 WHERE id = $3', [statusId, now, id]);
      await get().fetchTasks();
    } catch (e: any) {
      console.error('updateTaskStatus error:', e);
      set({ error: e.message });
    }
  },

  updateTaskProject: async (id, projectId) => {
    try {
      const db = await getDb();
      await db.execute('UPDATE tasks SET project_id = $1, updated_at = $2 WHERE id = $3', [projectId, Date.now(), id]);
      const descendants = collectDescendantIds(id, get().tasks);
      for (const descId of descendants) {
        await db.execute('UPDATE tasks SET project_id = $1, updated_at = $2 WHERE id = $3', [projectId, Date.now(), descId]);
      }
      await get().fetchTasks();
    } catch (e: any) {
      console.error('updateTaskProject error:', e);
      set({ error: e.message });
    }
  },

  toggleCollapsed: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await get().updateTask(id, { collapsed: task.collapsed ? 0 : 1 });
  },

  toggleVisible: async (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (!task) return;
    await get().updateTask(id, { visible: task.visible ? 0 : 1 });
  },

  setChildrenVisibility: async (id, visible) => {
    try {
      const db = await getDb();
      const tasks = get().tasks;
      const leafIds = collectLeafDescendantIds(id, tasks);
      if (leafIds.length === 0) return;
      const now = Date.now();
      const val = visible ? 1 : 0;
      for (const leafId of leafIds) {
        await db.execute('UPDATE tasks SET visible = $1, updated_at = $2 WHERE id = $3', [val, now, leafId]);
      }
      await get().fetchTasks();
    } catch (e: any) {
      console.error('setChildrenVisibility error:', e);
      set({ error: e.message });
    }
  },

  deleteTask: async (id) => {
    try {
      const db = await getDb();
      const tasks = get().tasks;
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const grandparentId = task.parent_id ?? null;
      const children = tasks.filter((t) => t.parent_id === id);
      if (children.length > 0) {
        const posRows = await db.select<{ maxPos: number }[]>(
          `SELECT COALESCE(MAX(position), -1) + 1 AS maxPos FROM tasks WHERE COALESCE(parent_id, '') = COALESCE($1, '') AND id != $2`,
          [grandparentId, id]
        );
        let nextPos = posRows[0]?.maxPos ?? 0;
        for (const child of children) {
          await db.execute('UPDATE tasks SET parent_id = $1, position = $2, updated_at = $3 WHERE id = $4', [grandparentId, nextPos, Date.now(), child.id]);
          nextPos++;
        }
      }
      await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
      await get().fetchTasks();
    } catch (e: any) {
      console.error('deleteTask error:', e);
      set({ error: e.message });
    }
  },

  deleteTaskRecursive: async (id) => {
    try {
      const db = await getDb();
      const tasks = get().tasks;
      const task = tasks.find((t) => t.id === id);
      if (!task) return;
      const descendantIds = collectDescendantIds(id, tasks);
      for (const descId of descendantIds) {
        await db.execute('DELETE FROM tasks WHERE id = $1', [descId]);
      }
      await db.execute('DELETE FROM tasks WHERE id = $1', [id]);
      await get().fetchTasks();
    } catch (e: any) {
      console.error('deleteTaskRecursive error:', e);
      set({ error: e.message });
    }
  },

  addNextTask: async (afterTaskId, title) => {
    try {
      const db = await getDb();
      const afterTask = get().tasks.find((t) => t.id === afterTaskId);
      if (!afterTask) return;
      const id = uuidv4();
      const now = Date.now();
      
      // Inherit the sibling's status id automatically
      const defaultStatusId = afterTask.status_id;
      
      await db.execute(
        `UPDATE tasks SET position = position + 1 WHERE COALESCE(parent_id, '') = COALESCE($1, '') AND position > $2`,
        [afterTask.parent_id, afterTask.position]
      );
      const newPosition = afterTask.position + 1;
      await db.execute(
        'INSERT INTO tasks (id, title, description, status_id, project_id, priority, estimate, parent_id, visible, position, collapsed, due_date, created_at, updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
        [id, title, null, defaultStatusId, afterTask.project_id, null, null, afterTask.parent_id, 1, newPosition, 0, null, now, now]
      );
      await get().fetchTasks();
    } catch (e: any) {
      console.error('addNextTask error:', e);
      set({ error: e.message });
    }
  },

  moveTask: async (taskId, newParentId, afterSiblingId) => {
    try {
      const db = await getDb();
      const allTasks = get().tasks;
      const task = allTasks.find((t) => t.id === taskId);
      if (!task) return;

      // Prevent nesting under own descendants
      if (newParentId) {
        const visited = new Set<string>();
        let cur = newParentId;
        while (cur) {
          if (cur === taskId) return;
          if (visited.has(cur)) break;
          visited.add(cur);
          const parent = allTasks.find((t) => t.id === cur);
          cur = parent?.parent_id ?? '';
        }
      }

      const oldParentId = task.parent_id;
      const parentChanged = (oldParentId ?? null) !== (newParentId ?? null);
      const now = Date.now();

      // Build new sibling order for the target parent group
      const targetSiblings = allTasks
        .filter((t) => (t.parent_id ?? null) === (newParentId ?? null) && t.id !== taskId)
        .sort((a, b) => a.position - b.position);

      let insertIdx = 0;
      if (afterSiblingId) {
        const afterIdx = targetSiblings.findIndex((t) => t.id === afterSiblingId);
        insertIdx = afterIdx >= 0 ? afterIdx + 1 : targetSiblings.length;
      }
      targetSiblings.splice(insertIdx, 0, task);

      // Write new positions for target group
      for (let i = 0; i < targetSiblings.length; i++) {
        await db.execute('UPDATE tasks SET position = $1, updated_at = $2 WHERE id = $3', [i, now, targetSiblings[i].id]);
      }

      // If parent changed, also reindex old parent group and update parent_id + project
      if (parentChanged) {
        const oldSiblings = allTasks
          .filter((t) => (t.parent_id ?? null) === (oldParentId ?? null) && t.id !== taskId)
          .sort((a, b) => a.position - b.position);
        for (let i = 0; i < oldSiblings.length; i++) {
          await db.execute('UPDATE tasks SET position = $1, updated_at = $2 WHERE id = $3', [i, now, oldSiblings[i].id]);
        }

        // Inherit project from new root ancestor
        let newProjectId = task.project_id;
        if (newParentId) {
          let root = allTasks.find((t) => t.id === newParentId);
          while (root?.parent_id) {
            root = allTasks.find((t) => t.id === root!.parent_id);
          }
          newProjectId = root?.project_id ?? task.project_id;
        }

        await db.execute('UPDATE tasks SET parent_id = $1, project_id = $2, updated_at = $3 WHERE id = $4', [newParentId, newProjectId, now, taskId]);

        const allDescendants = collectDescendantIds(taskId, allTasks);
        for (const descId of allDescendants) {
          await db.execute('UPDATE tasks SET project_id = $1, updated_at = $2 WHERE id = $3', [newProjectId, now, descId]);
        }
      }

      await get().fetchTasks();
    } catch (e: any) {
      console.error('moveTask error:', e);
      set({ error: e.message });
    }
  },

  batchUpdatePositions: async (orderedIds) => {
    try {
      const now = Date.now();
      // Optimistic update: reflect new positions immediately before DB round-trip
      const posMap = new Map(orderedIds.map(({ id, position }) => [id, position]));
      set({ tasks: get().tasks.map((t) => posMap.has(t.id) ? { ...t, position: posMap.get(t.id)!, updated_at: now } : t) });

      const db = await getDb();
      for (const { id, position } of orderedIds) {
        await db.execute('UPDATE tasks SET position = $1, updated_at = $2 WHERE id = $3', [position, now, id]);
      }
      await get().fetchTasks();
    } catch (e: any) {
      console.error('batchUpdatePositions error:', e);
      set({ error: e.message });
    }
  },

  moveTaskToColumn: async (taskIdOrIds, targetStatusId, positionUpdates) => {
    try {
      const taskIds = Array.isArray(taskIdOrIds) ? taskIdOrIds : [taskIdOrIds];
      const now = Date.now();
      const posMap = new Map(positionUpdates.map(({ id, position }) => [id, position]));
      const idsSet = new Set(taskIds);

      // Single atomic optimistic update: status change + all position changes at once
      set({
        tasks: get().tasks.map((t) => {
          if (idsSet.has(t.id)) return { ...t, status_id: targetStatusId, position: posMap.get(t.id) ?? t.position, updated_at: now };
          if (posMap.has(t.id)) return { ...t, position: posMap.get(t.id)!, updated_at: now };
          return t;
        }),
      });
      const db = await getDb();
      for (const id of taskIds) {
        await db.execute('UPDATE tasks SET status_id = $1, updated_at = $2 WHERE id = $3', [targetStatusId, now, id]);
      }
      for (const { id, position } of positionUpdates) {
        await db.execute('UPDATE tasks SET position = $1, updated_at = $2 WHERE id = $3', [position, now, id]);
      }
      // Re-fetch to ensure sync with subtasks / position triggers
      await get().fetchTasks();
    } catch (e: any) {
      console.error('moveTaskToColumn error:', e);
      set({ error: e.message });
    }
  },
}));
