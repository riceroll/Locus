import { create } from 'zustand';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface TaskStatus {
  id: string;
  name: string;
  color: string | null;
  position: number;
  is_done: number;
  is_default: number;
}

interface StatusState {
  statuses: TaskStatus[];
  fetchStatuses: () => Promise<void>;
  addStatus: (name: string) => Promise<void>;
  renameStatus: (id: string, name: string) => Promise<void>;
  removeStatus: (id: string) => Promise<void>;
  setDoneStatus: (id: string) => Promise<void>;
  setDefaultStatus: (id: string) => Promise<void>;
  reorderStatuses: (orderedIds: string[]) => Promise<void>;
  updateStatusColor: (id: string, color: string) => Promise<void>;
  getDoneStatusId: () => string;
  getDefaultOpenStatusId: () => string;
  getDoneStatusName: () => string;
}

export const useStatusStore = create<StatusState>((set, get) => ({
  statuses: [],
  fetchStatuses: async () => {
    const db = await getDb();
    const rows = await db.select<any[]>('SELECT * FROM task_statuses ORDER BY position ASC');
    const normalized: TaskStatus[] = rows.map((r) => ({
      ...r,
      position: Number(r.position ?? 0),
      is_done: Number(r.is_done ?? 0),
      is_default: Number(r.is_default ?? 0),
    }));
    set({ statuses: normalized });
  },
  addStatus: async (name) => {
    if (!name.trim()) return;
    const db = await getDb();
    const maxRows = await db.select<{ max_pos: number | null }[]>('SELECT MAX(position) as max_pos FROM task_statuses');
    const nextPos = (maxRows[0]?.max_pos ?? -1) + 1;
    await db.execute(
      'INSERT INTO task_statuses (id, name, color, position, is_done, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), name.trim(), '#64748b', nextPos, 0, 0]
    );
    await get().fetchStatuses();
  },
  renameStatus: async (id, name) => {
    if (!name.trim()) return;
    const db = await getDb();
    await db.execute('UPDATE task_statuses SET name = $1 WHERE id = $2', [name.trim(), id]);
    await get().fetchStatuses();
  },
  removeStatus: async (id) => {
    console.log('[removeStatus] called with id:', id);
    const status = get().statuses.find(s => s.id === id);
    console.log('[removeStatus] found status:', status);
    if (!status) {
      throw new Error('Status not found');
    }
    if (status.is_done === 1) {
      throw new Error('Cannot remove the completed status');
    }
    const remainingOpen = get().statuses.filter((s) => s.id !== id && s.is_done !== 1);
    console.log('[removeStatus] remainingOpen count:', remainingOpen.length);
    if (remainingOpen.length === 0) {
      throw new Error('At least one non-completed status is required');
    }
    const db = await getDb();
    const fallbackId = remainingOpen[0].id;
    console.log('[removeStatus] fallbackId:', fallbackId);
    if (status.is_default === 1) {
      await db.execute('UPDATE task_statuses SET is_default = 0');
      await db.execute('UPDATE task_statuses SET is_default = 1 WHERE id = $1', [fallbackId]);
    }
    await db.execute('UPDATE tasks SET status_id = $1 WHERE status_id = $2', [fallbackId, status.id]);
    console.log('[removeStatus] migrated tasks, now deleting status');
    await db.execute('DELETE FROM task_statuses WHERE id = $1', [id]);
    console.log('[removeStatus] deleted, fetching statuses');
    await get().fetchStatuses();
    console.log('[removeStatus] done');
  },
  setDoneStatus: async (id) => {
    const status = get().statuses.find(s => s.id === id);
    if (!status || status.is_done === 1) return; // already done
    const db = await getDb();
    const oldDone = get().statuses.find((s) => s.is_done === 1);

    // If target was default open status, move default to current done status after swap.
    if (status.is_default === 1 && oldDone) {
      await db.execute('UPDATE task_statuses SET is_default = 0');
      await db.execute('UPDATE task_statuses SET is_default = 1 WHERE id = $1', [oldDone.id]);
    }

    // Clear done flag on all, then set on this one
    await db.execute('UPDATE task_statuses SET is_done = 0', []);
    await db.execute('UPDATE task_statuses SET is_done = 1 WHERE id = $1', [id]);
    await db.execute('UPDATE task_statuses SET is_default = 0 WHERE is_done = 1', []);
    await get().fetchStatuses();
  },
  setDefaultStatus: async (id) => {
    const target = get().statuses.find((s) => s.id === id);
    if (!target || target.is_done === 1 || target.is_default === 1) return;
    const db = await getDb();
    await db.execute('UPDATE task_statuses SET is_default = 0 WHERE is_done = 0', []);
    await db.execute('UPDATE task_statuses SET is_default = 1 WHERE id = $1', [id]);
    await get().fetchStatuses();
  },
  reorderStatuses: async (orderedIds) => {
    // Optimistic update: reorder in memory immediately
    const current = get().statuses;
    const sorted = orderedIds
      .map((id, i) => { const s = current.find((x) => x.id === id); return s ? { ...s, position: i } : null; })
      .filter((s): s is TaskStatus => s !== null);
    set({ statuses: sorted });

    const db = await getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute('UPDATE task_statuses SET position = $1 WHERE id = $2', [i, orderedIds[i]]);
    }
    await get().fetchStatuses();
  },
  updateStatusColor: async (id, color) => {
    const db = await getDb();
    await db.execute('UPDATE task_statuses SET color = $1 WHERE id = $2', [color, id]);
    await get().fetchStatuses();
  },
  getDoneStatusId: () => {
    const done = get().statuses.find(s => s.is_done === 1);
    return done?.id || 'status-done';
  },
  getDefaultOpenStatusId: () => {
    const open = get().statuses.find(s => s.is_done !== 1 && s.is_default === 1)
      || get().statuses.find(s => s.is_done !== 1);
    return open?.id || get().statuses[0]?.id || 'status-todo';
  },
  getDoneStatusName: () => {
    const done = get().statuses.find(s => s.is_done === 1);
    return done?.name || 'Done';
  },
}));
