import { create } from 'zustand';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface Area {
  id: string;
  name: string;
  color: string | null;
  position: number;
}

interface AreaState {
  areas: Area[];
  fetchAreas: () => Promise<void>;
  addArea: (name: string) => Promise<void>;
  renameArea: (id: string, name: string) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;
  updateAreaColor: (id: string, color: string) => Promise<void>;
  reorderAreas: (orderedIds: string[]) => Promise<void>;
}

export const useAreaStore = create<AreaState>((set, get) => ({
  areas: [],

  fetchAreas: async () => {
    const db = await getDb();
    const rows = await db.select<any[]>('SELECT * FROM areas ORDER BY position ASC');
    set({ areas: rows.map((r) => ({ ...r, position: Number(r.position ?? 0) })) });
  },

  addArea: async (name) => {
    if (!name.trim()) return;
    const db = await getDb();
    const maxRows = await db.select<{ max_pos: number | null }[]>('SELECT MAX(position) as max_pos FROM areas');
    const nextPos = (maxRows[0]?.max_pos ?? -1) + 1;
    await db.execute(
      'INSERT INTO areas (id, name, color, position) VALUES ($1, $2, $3, $4)',
      [uuidv4(), name.trim(), null, nextPos]
    );
    await get().fetchAreas();
  },

  renameArea: async (id, name) => {
    if (!name.trim()) return;
    const db = await getDb();
    await db.execute('UPDATE areas SET name = $1 WHERE id = $2', [name.trim(), id]);
    await get().fetchAreas();
  },

  deleteArea: async (id) => {
    const db = await getDb();
    await db.execute('UPDATE projects SET area_id = NULL WHERE area_id = $1', [id]);
    await db.execute('DELETE FROM areas WHERE id = $1', [id]);
    await get().fetchAreas();
  },

  updateAreaColor: async (id, color) => {
    const db = await getDb();
    await db.execute('UPDATE areas SET color = $1 WHERE id = $2', [color, id]);
    await get().fetchAreas();
  },

  reorderAreas: async (orderedIds) => {
    const db = await getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      await db.execute('UPDATE areas SET position = $1 WHERE id = $2', [i, orderedIds[i]]);
    }
    await get().fetchAreas();
  },
}));
