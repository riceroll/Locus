import { create } from 'zustand';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface Project {
  id: string;
  name: string;
  color: string | null;
  area_id: string | null;
  position: number;
  description: string | null;
  is_default: number;
  icon: string | null;
  icon_type: string | null;  // 'color' | 'emoji' | 'lucide'
  icon_color: string | null;
}

interface ProjectState {
  projects: Project[];
  fetchProjects: () => Promise<void>;
  addProject: (name: string, areaId?: string | null) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateProjectColor: (id: string, color: string) => Promise<void>;
  updateProjectArea: (id: string, areaId: string | null) => Promise<void>;
  updateProjectDescription: (id: string, description: string) => Promise<void>;
  updateProjectIcon: (id: string, icon: string | null, iconType: string, iconColor: string | null) => Promise<void>;
  reorderProjects: (orderedIds: string[], movedId?: string, newAreaId?: string | null) => Promise<void>;
  getDefaultProjectId: () => string | null;
  setDefaultProject: (id: string | null) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],

  fetchProjects: async () => {
    const db = await getDb();
    const rows = await db.select<any[]>('SELECT * FROM projects ORDER BY position ASC, name ASC');
    set({ projects: rows.map((r) => ({ ...r, position: Number(r.position ?? 0) })) });
  },

  addProject: async (name, areaId = null) => {
    if (!name.trim()) return;
    const db = await getDb();
    const maxRows = await db.select<{ max_pos: number | null }[]>('SELECT MAX(position) as max_pos FROM projects');
    const nextPos = (maxRows[0]?.max_pos ?? -1) + 1;
    await db.execute(
      'INSERT INTO projects (id, name, color, area_id, position, description) VALUES ($1, $2, $3, $4, $5, $6)',
      [uuidv4(), name.trim(), null, areaId, nextPos, null]
    );
    await get().fetchProjects();
  },

  renameProject: async (id, name) => {
    if (!name.trim()) return;
    const db = await getDb();
    await db.execute('UPDATE projects SET name = $1 WHERE id = $2', [name.trim(), id]);
    await get().fetchProjects();
  },

  deleteProject: async (id) => {
    const db = await getDb();
    const project = get().projects.find((p) => p.id === id) ?? null;

    if (project?.is_default === 1) {
      await db.execute('UPDATE projects SET is_default = 0 WHERE id = $1', [id]);
    }

    // Unlink tasks from this project (set project_id = NULL)
    await db.execute('UPDATE tasks SET project_id = NULL WHERE project_id = $1', [id]);

    const views = await db.select<{ id: string; filters: string | null }[]>('SELECT id, filters FROM saved_views');
    for (const view of views) {
      try {
        const parsed = JSON.parse(view.filters || '{}');
        if (!Array.isArray(parsed.rules)) continue;

        let changed = false;
        for (const rule of parsed.rules) {
          if (rule.field !== 'project_id' || !Array.isArray(rule.values)) continue;
          const nextValues = rule.values.filter((value: string) => value !== id);
          if (nextValues.length !== rule.values.length) {
            rule.values = nextValues;
            changed = true;
          }
        }

        if (changed) {
          await db.execute('UPDATE saved_views SET filters = $1 WHERE id = $2', [JSON.stringify(parsed), view.id]);
        }
      } catch {
        // Keep malformed legacy filters untouched.
      }
    }

    await db.execute('DELETE FROM projects WHERE id = $1', [id]);

    const remaining = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM projects WHERE id = $1', [id]);
    if ((remaining[0]?.count ?? 0) > 0) {
      throw new Error(`Failed to delete project ${id}`);
    }

    await get().fetchProjects();
  },

  updateProjectColor: async (id, color) => {
    const db = await getDb();
    await db.execute('UPDATE projects SET color = $1 WHERE id = $2', [color, id]);
    await get().fetchProjects();
  },

  updateProjectArea: async (id, areaId) => {
    const db = await getDb();
    await db.execute('UPDATE projects SET area_id = $1 WHERE id = $2', [areaId, id]);
    await get().fetchProjects();
  },

  reorderProjects: async (orderedIds, movedId, newAreaId) => {
    const db = await getDb();
    for (let i = 0; i < orderedIds.length; i++) {
      const id = orderedIds[i];
      if (id === movedId && newAreaId !== undefined) {
        await db.execute('UPDATE projects SET position = $1, area_id = $2 WHERE id = $3', [i, newAreaId, id]);
      } else {
        await db.execute('UPDATE projects SET position = $1 WHERE id = $2', [i, id]);
      }
    }
    await get().fetchProjects();
  },
  updateProjectDescription: async (id, description) => {
    const db = await getDb();
    await db.execute('UPDATE projects SET description = $1 WHERE id = $2', [description, id]);
    await get().fetchProjects();
  },

  updateProjectIcon: async (id, icon, iconType, iconColor) => {
    const db = await getDb();
    await db.execute('UPDATE projects SET icon = $1, icon_type = $2, icon_color = $3 WHERE id = $4', [icon, iconType, iconColor, id]);
    await get().fetchProjects();
  },

  getDefaultProjectId: () => {
    return get().projects.find((p) => p.is_default === 1)?.id ?? null;
  },

  setDefaultProject: async (id) => {
    const db = await getDb();
    await db.execute('UPDATE projects SET is_default = 0');
    if (id) {
      await db.execute('UPDATE projects SET is_default = 1 WHERE id = $1', [id]);
    }
    await get().fetchProjects();
  },}));

