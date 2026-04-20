import Database from '@tauri-apps/plugin-sql';

export const runMigrations = async (db: Awaited<ReturnType<typeof Database.load>>) => {
  const tables = `
    CREATE TABLE IF NOT EXISTS task_statuses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT,
      position INTEGER NOT NULL,
      is_done INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS areas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT,
      position INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      status_id TEXT NOT NULL,
      project_id TEXT,
      priority TEXT,
      estimate INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (status_id) REFERENCES task_statuses(id)
    );
    CREATE TABLE IF NOT EXISTS time_entries (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      duration INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS saved_views (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      view_type TEXT NOT NULL DEFAULT 'list',
      position INTEGER NOT NULL DEFAULT 0,
      color TEXT,
      filters TEXT DEFAULT '{}',
      sort_by TEXT,
      sort_dir TEXT DEFAULT 'asc',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `;
  try {
      const qs = tables.split(';');
      for(let q of qs) {
          if (q.trim()) await db.execute(q);
      }

      const existingStatuses = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM task_statuses');
      if (!existingStatuses[0] || existingStatuses[0].count === 0) {
        await db.execute(
          'INSERT INTO task_statuses (id, name, color, position, is_done, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
          ['status-todo', 'Todo', '#94a3b8', 0, 0, 1]
        );
        await db.execute(
          'INSERT INTO task_statuses (id, name, color, position, is_done, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
          ['status-progress', 'In Progress', '#3b82f6', 1, 0, 0]
        );
        await db.execute(
          'INSERT INTO task_statuses (id, name, color, position, is_done, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
          ['status-review', 'Review', '#f59e0b', 2, 0, 0]
        );
        await db.execute(
          'INSERT INTO task_statuses (id, name, color, position, is_done, is_default) VALUES ($1, $2, $3, $4, $5, $6)',
          ['status-done', 'Done', '#22c55e', 3, 1, 0]
        );
      }

      const statusCols = await db.select<{ name: string }[]>('PRAGMA table_info(task_statuses)');
      const hasIsDefault = statusCols.some((c) => c.name === 'is_default');
      if (!hasIsDefault) {
        await db.execute('ALTER TABLE task_statuses ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
      }

      const defaultRows = await db.select<{ count: number }[]>(
        'SELECT COUNT(*) as count FROM task_statuses WHERE is_default = 1 AND is_done = 0'
      );
      if ((defaultRows[0]?.count ?? 0) === 0) {
        const firstOpen = await db.select<{ id: string }[]>(
          'SELECT id FROM task_statuses WHERE is_done = 0 ORDER BY position ASC LIMIT 1'
        );
        if (firstOpen[0]?.id) {
          await db.execute('UPDATE task_statuses SET is_default = 0');
          await db.execute('UPDATE task_statuses SET is_default = 1 WHERE id = $1', [firstOpen[0].id]);
        }
      }

      const duplicateDefaultRows = await db.select<{ id: string }[]>(
        'SELECT id FROM task_statuses WHERE is_default = 1 AND is_done = 0 ORDER BY position ASC'
      );
      if (duplicateDefaultRows.length > 1) {
        const keepId = duplicateDefaultRows[0].id;
        await db.execute('UPDATE task_statuses SET is_default = 0 WHERE is_default = 1 AND id != $1', [keepId]);
      }

      // Backfill NULL colors with a default
      await db.execute("UPDATE task_statuses SET color = '#64748b' WHERE color IS NULL");

      const doneStatusRow = await db.select<{ id: string }[]>(
        'SELECT id FROM task_statuses WHERE is_done = 1 ORDER BY position ASC LIMIT 1'
      );
      const openStatusRow = await db.select<{ id: string }[]>(
        'SELECT id FROM task_statuses WHERE is_done = 0 ORDER BY position ASC LIMIT 1'
      );
      const fallbackStatusId = openStatusRow[0]?.id || doneStatusRow[0]?.id || 'status-todo';

      const taskCols = await db.select<{ name: string }[]>('PRAGMA table_info(tasks)');
      const hasStatusId = taskCols.some((c) => c.name === 'status_id');
      const hasStatusName = taskCols.some((c) => c.name === 'status');

      if (!hasStatusId && hasStatusName) {
        await db.execute('PRAGMA foreign_keys = OFF');
        await db.execute(`
          CREATE TABLE tasks_new (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            status_id TEXT NOT NULL,
            project_id TEXT,
            priority TEXT,
            estimate INTEGER,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY (project_id) REFERENCES projects(id),
            FOREIGN KEY (status_id) REFERENCES task_statuses(id)
          )
        `);
        await db.execute(
          `INSERT INTO tasks_new (id, title, description, status_id, project_id, priority, estimate, created_at, updated_at)
           SELECT
             t.id,
             t.title,
             t.description,
             COALESCE(ts.id, $1) AS status_id,
             t.project_id,
             t.priority,
             t.estimate,
             t.created_at,
             t.updated_at
           FROM tasks t
           LEFT JOIN task_statuses ts ON ts.name = CASE WHEN t.status = 'Completed' THEN 'Done' ELSE t.status END`,
          [fallbackStatusId]
        );
        await db.execute('DROP TABLE tasks');
        await db.execute('ALTER TABLE tasks_new RENAME TO tasks');
        await db.execute('PRAGMA foreign_keys = ON');
      }

      const timeEntryFkRows = await db.select<{ sql: string }[]>(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'time_entries'"
      );
      const timeEntriesSql = timeEntryFkRows[0]?.sql || '';
      const hasCascade = /ON DELETE CASCADE/i.test(timeEntriesSql);
      if (!hasCascade) {
        await db.execute('PRAGMA foreign_keys = OFF');
        await db.execute(`
          CREATE TABLE time_entries_new (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            start_time INTEGER NOT NULL,
            end_time INTEGER,
            duration INTEGER,
            FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
          )
        `);
        await db.execute(
          'INSERT INTO time_entries_new (id, task_id, start_time, end_time, duration) SELECT id, task_id, start_time, end_time, duration FROM time_entries'
        );
        await db.execute('DROP TABLE time_entries');
        await db.execute('ALTER TABLE time_entries_new RENAME TO time_entries');
        await db.execute('PRAGMA foreign_keys = ON');
      }

      // Convert legacy saved view status filters (by name) to status_id filters.
      const savedViewCols = await db.select<{ name: string }[]>('PRAGMA table_info(saved_views)');
      const hasSavedViewColor = savedViewCols.some((c) => c.name === 'color');
      if (!hasSavedViewColor) {
        await db.execute('ALTER TABLE saved_views ADD COLUMN color TEXT');
      }
      const hasSavedViewPosition = savedViewCols.some((c) => c.name === 'position');
      if (!hasSavedViewPosition) {
        await db.execute('ALTER TABLE saved_views ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
        await db.execute('UPDATE saved_views SET position = rowid');
      }

      const statusRows = await db.select<{ id: string; name: string }[]>('SELECT id, name FROM task_statuses');
      const statusIdByName = new Map(statusRows.map((r) => [r.name, r.id]));
      const views = await db.select<{ id: string; filters: string }[]>('SELECT id, filters FROM saved_views');
      for (const view of views) {
        try {
          const parsed = JSON.parse(view.filters || '{}');
          if (!Array.isArray(parsed.rules)) continue;
          let changed = false;
          for (const rule of parsed.rules) {
            if (rule.field === 'status') {
              rule.field = 'status_id';
              changed = true;
            }
            if (rule.field === 'status_id' && Array.isArray(rule.values)) {
              const mappedValues = rule.values
                .map((v: string) => statusIdByName.get(v) || v)
                .filter((v: string) => !!v);
              if (JSON.stringify(mappedValues) !== JSON.stringify(rule.values)) {
                rule.values = mappedValues;
                changed = true;
              }
            }
          }
          if (changed) {
            await db.execute('UPDATE saved_views SET filters = $1 WHERE id = $2', [JSON.stringify(parsed), view.id]);
          }
        } catch {
          // Ignore malformed legacy rows and keep them untouched.
        }
      }

      // ── Projects new columns migration ─────────────────────────────
      const projectCols = await db.select<{ name: string }[]>('PRAGMA table_info(projects)');
      const projectColNames = projectCols.map((c) => c.name);
      if (!projectColNames.includes('area_id')) {
        await db.execute('ALTER TABLE projects ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL');
      }
      if (!projectColNames.includes('position')) {
        await db.execute('ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
        // Backfill positions using rowid order
        await db.execute('UPDATE projects SET position = rowid');
      }
      if (!projectColNames.includes('description')) {
        await db.execute('ALTER TABLE projects ADD COLUMN description TEXT');
      }
      if (!projectColNames.includes('is_default')) {
        await db.execute('ALTER TABLE projects ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
      }

      // ── Tasks hierarchy columns migration ──────────────────────────
      const taskColsHier = await db.select<{ name: string }[]>('PRAGMA table_info(tasks)');
      const taskColNames = taskColsHier.map((c) => c.name);
      if (!taskColNames.includes('parent_id')) {
        await db.execute('ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE SET NULL');
      }
      if (!taskColNames.includes('depends_on_id')) {
        await db.execute('ALTER TABLE tasks ADD COLUMN depends_on_id TEXT REFERENCES tasks(id) ON DELETE SET NULL');
      }
      if (!taskColNames.includes('position')) {
        await db.execute('ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0');
        await db.execute('UPDATE tasks SET position = rowid');
      }
      if (!taskColNames.includes('collapsed')) {
        await db.execute('ALTER TABLE tasks ADD COLUMN collapsed INTEGER NOT NULL DEFAULT 0');
      }
      if (!taskColNames.includes('due_date')) {
        await db.execute('ALTER TABLE tasks ADD COLUMN due_date INTEGER');
      }
      if (!taskColNames.includes('visible')) {
        await db.execute('ALTER TABLE tasks ADD COLUMN visible INTEGER NOT NULL DEFAULT 1');
      }

      // Cleanup dangling temporary migration tables
      await db.execute('PRAGMA foreign_keys = OFF');
      await db.execute('DROP TABLE IF EXISTS tasks_new');
      await db.execute('DROP TABLE IF EXISTS time_entries_new');
      await db.execute('PRAGMA foreign_keys = ON');

      console.log('Database initialized');
  } catch(e) {
      console.error('Failed to initialize db', e);
  }
};