import { create } from 'zustand';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';
import Database from '@tauri-apps/plugin-sql';
import { homeDir, join } from '@tauri-apps/api/path';

const ensureSavedViewPositionColumn = async (db: Awaited<ReturnType<typeof getDb>>) => {
  const cols = await db.select<{ name: string }[]>('PRAGMA table_info(saved_views)');
  const hasPosition = cols.some((c) => c.name === 'position');
  if (!hasPosition) {
    await db.execute('ALTER TABLE saved_views ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
    await db.execute('UPDATE saved_views SET position = rowid');
  }
};

const getLegacySavedViews = async () => {
  try {
    const home = await homeDir();
    const candidates = [
      await join(home, 'Library', 'Application Support', 'com.riceroll.jaxtracker', 'jaxtracker.db'),
      await join(home, 'Library', 'Application Support', 'com.riceroll.locus', 'jaxtracker.db'),
    ];

    for (const candidate of candidates) {
      try {
        const legacyDb = await Database.load(`sqlite:${candidate}`);
        const cols = await legacyDb.select<{ name: string }[]>('PRAGMA table_info(saved_views)');
        if (cols.length === 0) continue;
        const hasPosition = cols.some((c) => c.name === 'position');
        const rows = await legacyDb.select<any[]>(
          hasPosition
            ? 'SELECT * FROM saved_views ORDER BY position ASC, created_at ASC'
            : 'SELECT * FROM saved_views ORDER BY created_at ASC',
        );
        if (rows.length > 0) return rows;
      } catch {
        // Ignore legacy DBs that are missing or inaccessible.
      }
    }
  } catch {
    // Ignore path resolution failures.
  }

  return [] as any[];
};

const hydrateSavedViewsFromLegacyDb = async (db: Awaited<ReturnType<typeof getDb>>) => {
  const countRows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM saved_views');
  if ((countRows[0]?.count ?? 0) > 0) return;

  const legacyRows = await getLegacySavedViews();
  if (legacyRows.length === 0) return;

  for (let i = 0; i < legacyRows.length; i += 1) {
    const row = legacyRows[i];
    await db.execute(
      'INSERT OR IGNORE INTO saved_views (id, name, view_type, position, color, filters, sort_by, sort_dir, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [
        row.id,
        row.name,
        row.view_type ?? 'list',
        row.position ?? i + 1,
        row.color ?? null,
        row.filters ?? '{}',
        row.sort_by ?? null,
        row.sort_dir ?? 'asc',
        row.created_at ?? Date.now(),
        row.updated_at ?? row.created_at ?? Date.now(),
      ],
    );
  }
};

export interface ViewFilters {
  rules: {
    field: 'status_id' | 'project_id' | 'area_id';
    operator: 'include' | 'exclude';
    values: string[];
  }[];
}

export interface SavedView {
  id: string;
  name: string;
  view_type: 'list' | 'kanban' | 'calendar';
  position: number;
  color: string | null;
  filters: ViewFilters;
  sort_by: string | null;
  sort_dir: 'asc' | 'desc';
  created_at: number;
  updated_at: number;
}

interface ViewState {
  views: SavedView[];
  activeViewId: string | null; // null = "All Tasks" default
  activeViewType: 'list' | 'kanban' | 'calendar';
  activeFilters: ViewFilters;
  activePage: 'tasks' | 'projects';
  fetchViews: () => Promise<void>;
  createView: (name: string, viewType: 'list' | 'kanban' | 'calendar', filters?: ViewFilters) => Promise<void>;
  updateView: (id: string, filters: ViewFilters) => Promise<void>;
  changeViewType: (id: string, viewType: 'list' | 'kanban' | 'calendar') => Promise<void>;
  setViewColor: (id: string, color: string | null) => Promise<void>;
  reorderViews: (orderedIds: string[]) => Promise<void>;
  deleteView: (id: string) => Promise<void>;
  renameView: (id: string, name: string) => Promise<void>;
  selectView: (id: string | null) => void;
  setViewType: (type: 'list' | 'kanban' | 'calendar') => void;
  setFilters: (filters: ViewFilters) => void;
  setActivePage: (page: 'tasks' | 'projects') => void;
}

export const useViewStore = create<ViewState>((set, get) => ({
  views: [],
  activeViewId: null,
  activeViewType: 'list',
  activeFilters: { rules: [] },
  activePage: 'tasks',

  fetchViews: async () => {
    const db = await getDb();
    await ensureSavedViewPositionColumn(db);
    await hydrateSavedViewsFromLegacyDb(db);
    const rows = await db.select<any[]>('SELECT * FROM saved_views ORDER BY position ASC, created_at ASC');
    const views: SavedView[] = rows.map(r => {
      const parsed = r.filters ? JSON.parse(r.filters) : {};
      const rules = Array.isArray(parsed.rules)
        ? parsed.rules.filter((rule: any) => rule.field === 'status_id' || rule.field === 'project_id' || rule.field === 'area_id')
        : [];
      return {
        ...r,
        filters: { rules },
      } as SavedView;
    });
    set({ views });
  },

  createView: async (name, viewType, filters = { rules: [] }) => {
    const db = await getDb();
    await ensureSavedViewPositionColumn(db);
    const id = uuidv4();
    const now = Date.now();
    const maxPosRows = await db.select<{ maxPos: number | null }[]>('SELECT MAX(position) as maxPos FROM saved_views');
    const nextPosition = (maxPosRows[0]?.maxPos ?? 0) + 1;
    await db.execute(
      'INSERT INTO saved_views (id, name, view_type, position, color, filters, sort_by, sort_dir, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)',
      [id, name, viewType, nextPosition, null, JSON.stringify(filters), null, 'asc', now, now]
    );
    await get().fetchViews();
    set({ activeViewId: id, activeViewType: viewType, activeFilters: filters });
  },

  updateView: async (id, filters) => {
    const db = await getDb();
    await db.execute(
      'UPDATE saved_views SET filters = $1, updated_at = $2 WHERE id = $3',
      [JSON.stringify(filters), Date.now(), id]
    );
    await get().fetchViews();
    set({ activeFilters: filters });
  },

  changeViewType: async (id, viewType) => {
    const db = await getDb();
    await db.execute(
      'UPDATE saved_views SET view_type = $1, updated_at = $2 WHERE id = $3',
      [viewType, Date.now(), id]
    );
    await get().fetchViews();
    if (get().activeViewId === id) set({ activeViewType: viewType });
  },

  setViewColor: async (id, color) => {
    const db = await getDb();
    await db.execute(
      'UPDATE saved_views SET color = $1, updated_at = $2 WHERE id = $3',
      [color, Date.now(), id],
    );
    await get().fetchViews();
  },

  reorderViews: async (orderedIds) => {
    if (orderedIds.length <= 1) return;
    const db = await getDb();
    await ensureSavedViewPositionColumn(db);
    const now = Date.now();
    for (let i = 0; i < orderedIds.length; i += 1) {
      await db.execute(
        'UPDATE saved_views SET position = $1, updated_at = $2 WHERE id = $3',
        [i + 1, now, orderedIds[i]],
      );
    }
    await get().fetchViews();
  },

  deleteView: async (id) => {
    const db = await getDb();
    await db.execute('DELETE FROM saved_views WHERE id = $1', [id]);
    if (get().activeViewId === id) {
      set({ activeViewId: null, activeViewType: 'list', activeFilters: { rules: [] } });
    }
    await get().fetchViews();
  },

  renameView: async (id, name) => {
    const db = await getDb();
    await db.execute('UPDATE saved_views SET name = $1, updated_at = $2 WHERE id = $3', [name, Date.now(), id]);
    await get().fetchViews();
  },

  selectView: (id) => {
    if (!id) {
      set({ activeViewId: null, activeViewType: 'list', activeFilters: { rules: [] } });
      return;
    }
    const view = get().views.find(v => v.id === id);
    if (view) {
      set({ activeViewId: id, activeViewType: view.view_type, activeFilters: view.filters });
    }
  },

  setViewType: (type) => set({ activeViewType: type }),

  setFilters: (filters) => set({ activeFilters: filters }),

  setActivePage: (page) => set({ activePage: page }),
}));
