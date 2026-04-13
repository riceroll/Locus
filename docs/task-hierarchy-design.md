# JaxTracker V2 — Task Hierarchy, Projects Page & Task Detail

## 1. Conceptual Model

```
Area (tag/folder for classification)
 └─ Project (a goal or effort, has color)
     └─ Task (the work unit, has status, can be completed)
         └─ Sub-task (child task, same schema — recursive)
```

### Key Definitions

| Concept | Description |
|---------|-------------|
| **Area** | Long-lived life category (e.g. "Work", "Life"). Never "completed". Acts as a tag/folder for Projects. |
| **Project** | A goal or effort. Belongs to an Area (optional). Has color, name. Not required to complete. |
| **Task** | The fundamental work unit. Belongs to a Project (optional). Has a status. Can be completed. |
| **Sub-task** | A task whose `parent_id` points to another task. Same schema as task. Recursive — sub-tasks can have sub-tasks. |

### Task Relationships (between sibling tasks under same parent)

1. **Parallel** — Independent siblings. No ordering dependency. Both can be worked on simultaneously.
2. **Sequential (Thread)** — Task B `depends_on` Task A. B cannot start until A is done. A chain of sequential tasks forms a "thread". A single standalone task is a thread of length 1.

### Completion Rule

- A task with children is **done** only when all its children are done.
- A thread task is **actionable** only when its predecessor (depends_on) is done.

---

## 2. Data Model Changes

### 2.1 New Table: `areas`

```sql
CREATE TABLE IF NOT EXISTS areas (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT,
  position INTEGER NOT NULL DEFAULT 0
);
```

### 2.2 Alter `projects`

Add columns:

```sql
ALTER TABLE projects ADD COLUMN area_id TEXT REFERENCES areas(id) ON DELETE SET NULL;
ALTER TABLE projects ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE projects ADD COLUMN description TEXT;
```

### 2.3 Alter `tasks`

Add columns:

```sql
ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE tasks ADD COLUMN depends_on_id TEXT REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN collapsed INTEGER NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN level INTEGER NOT NULL DEFAULT 0;
```

| Column | Type | Description |
|--------|------|-------------|
| `parent_id` | TEXT (FK→tasks) | Parent task. NULL = root-level task. CASCADE delete = deleting parent deletes children. |
| `depends_on_id` | TEXT (FK→tasks) | This task depends on (comes after) another sibling task. NULL = no dependency / thread-start. SET NULL on delete so chain doesn't break. |
| `position` | INTEGER | Ordering among siblings (tasks with same parent_id). |
| `collapsed` | INTEGER | 0/1 — whether children section is collapsed in UI. |
| `level` | INTEGER | Depth in hierarchy. Root = 0, child of root = 1, etc. Denormalized for fast rendering. |

### 2.4 Derived Concepts (not stored, computed)

- **Thread group**: Follow `depends_on_id` chains among siblings. Tasks with no `depends_on_id` pointing at them and no `depends_on_id` themselves (or head of a chain) start a thread.
- **Is actionable**: `depends_on_id IS NULL` or the depended task's status `is_done = 1`.
- **Is parent done**: All direct children have `is_done` status → parent can auto-mark done (or show progress).

### 2.5 Full Task Interface (TypeScript)

```typescript
interface Task {
  id: string;
  title: string;
  description: string | null;
  status_id: string;
  status: string;           // JOIN from task_statuses.name
  project_id: string | null;
  parent_id: string | null;
  depends_on_id: string | null;
  priority: string | null;
  estimate: number | null;
  position: number;
  collapsed: number;        // 0 or 1
  level: number;            // 0 = root
  created_at: number;
  updated_at: number;
  // Computed (not in DB):
  children_count?: number;  // COUNT of direct children
  done_children_count?: number; // COUNT of done children
}
```

---

## 3. Feature List

### Phase A — Projects Page & Cleanup (implement first)

| # | Feature | Description |
|---|---------|-------------|
| A1 | **Projects sidebar tab** | New "Projects" section in left sidebar. Clicking shows Projects page in main area. |
| A2 | **Projects list page** | Full CRUD: list all projects, click name to rename inline, set color (same picker as status columns), add new project, delete project. |
| A3 | **Area support for projects** | Projects can optionally belong to an Area. Areas section in Projects page (collapsible groups). CRUD for areas. |
| A4 | **Remove add-project from task list** | Delete the "add project" inline button/input from ListView. Projects are managed from Projects page only. |

### Phase B — Task Detail Page

| # | Feature | Description |
|---|---------|-------------|
| B1 | **Task detail popup** | Click any task item → modal/dialog overlay. Shows all task fields: title, description (rich text later, plain for now), status, project, priority, estimate, time entries, sub-tasks. |
| B2 | **Edit all fields** | Inline editing for title, description, dropdowns for status/project/priority, number input for estimate. |
| B3 | **Sub-tasks section** | Inside task detail: list of child tasks with checkboxes. Add new sub-task inline. Shows completion progress (e.g. "2/5 done"). |
| B4 | **Time entries section** | Show time entries for this task. Manual add/delete. |

### Phase C — Task Hierarchy in List View

| # | Feature | Description |
|---|---------|-------------|
| C1 | **Parent-child display** | Indented rows in list view. Level 0 = no indent, level 1 = 1 indent, etc. Vertical tree lines in the indent gutter. |
| C2 | **Collapse/expand toggle** | Tasks with children show a ▶/▼ toggle. Clicking collapses/expands children. Persisted via `collapsed` column. |
| C3 | **Add sub-task button** | On hover/focus of a task row, show a "+" button to add a child task. Creates task with `parent_id` set. |
| C4 | **Add next-task button** | On hover, show a button to add a sibling task after the current one. Inserts at `position + 1` with `depends_on_id` pointing to current task (sequential thread). |
| C5 | **Drag to reorder** | Drag task rows to reorder among siblings (same parent). Updates `position`. |
| C6 | **Drag to nest** | Drag a task onto another task's "lower area" → becomes its child (sets `parent_id`). Visual indicator: indent line when hovering over lower portion of a card. |
| C7 | **Drag to make sibling** | Drag to the space between tasks → becomes sibling at that position. Visual indicator: horizontal line between tasks. |
| C8 | **Thread visualization** | Sequential tasks (connected by `depends_on_id`) show a continuous vertical line on the left side connecting them. |
| C9 | **Sub-task section toggle** | A task without children shows no sub-task area. A clickable toggle (like [+] / [−]) lets user enable/disable the sub-task section, toggling between "this task can have children" mode. |
| C10 | **Auto-completion propagation** | When all children of a parent are done, optionally auto-set parent to done. Or just show a progress indicator. |

### Phase D — Kanban & Calendar Hierarchy Support (later)

| # | Feature | Description |
|---|---------|-------------|
| D1 | Only root-level tasks (level 0) show as cards on Kanban. |
| D2 | Card shows sub-task progress (e.g. "3/5 sub-tasks done"). |
| D3 | Calendar shows root tasks by due date (future: add due_date column). |

---

## 4. UI/UX Design

### 4.1 Sidebar (updated)

```
┌─────────────────────┐
│ JaxTracker           │
├─────────────────────┤
│ 📥 All Tasks         │  ← existing
│ 📁 Projects          │  ← NEW: navigates to projects page
├─────────────────────┤
│ ▼ Saved Views        │
│   📋 My List         │
│   🏛 Sprint Board    │
│   + New View         │
└─────────────────────┘
```

### 4.2 Projects Page

```
┌──────────────────────────────────────────────────┐
│ Projects                              [+ Add]    │
├──────────────────────────────────────────────────┤
│ ▼ Work (Area)                                    │
│   🔵 Website Redesign          ✏️ 🎨 🗑          │
│   🟢 API Migration             ✏️ 🎨 🗑          │
│ ▼ Personal (Area)                                │
│   🟠 Home Renovation           ✏️ 🎨 🗑          │
│ ─ No Area ──────────────────────────────          │
│   ⚫ Misc Tasks                 ✏️ 🎨 🗑          │
├──────────────────────────────────────────────────┤
│ Areas                             [+ Add Area]   │
│   Work  ✏️ 🗑                                     │
│   Personal  ✏️ 🗑                                 │
└──────────────────────────────────────────────────┘
```

- Click project name → inline rename
- Color dot → opens color picker (same presets as status columns)
- Click Area name → inline rename

### 4.3 Task Detail Popup

```
┌──────────────────────────────────────── ✕ ───┐
│ ☐ Task Title (editable, large font)          │
│                                               │
│ Status: [In Progress ▾]  Project: [API ▾]    │
│ Priority: [High ▾]       Estimate: [2h]      │
│                                               │
│ Description                                   │
│ ┌───────────────────────────────────────────┐ │
│ │ Plain text area for now...                │ │
│ └───────────────────────────────────────────┘ │
│                                               │
│ Sub-tasks (3/5 done)                  [+ Add] │
│ ├─ ☑ Design mockups                          │
│ ├─ ☑ Review with team                        │
│ ├─ ☐ Implement header                        │
│ ├─ ☐ Implement footer  (depends on ↑)        │
│ └─ ☑ Write tests                             │
│                                               │
│ Time Entries                                  │
│   Apr 8  1h 30m                               │
│   Apr 7  0h 45m                               │
│                                    Total: 2h 15m│
└───────────────────────────────────────────────┘
```

### 4.4 List View with Hierarchy

```
┌─ ☐ ▼ Build Landing Page ············· In Progress │
│  ├─ ☑   Design mockups               Done         │
│  ├─ ☐ ▼ Implement sections           In Progress  │
│  │  ├─ ☑   Hero section              Done         │
│  │  ├─ ☐   Features section          Todo    ←dep │
│  │  └─ ☐   Pricing section           Todo    ←dep │
│  └─ ☐   QA & Deploy                  Todo         │
├─ ☐   Write blog post ················ Todo         │
├─ ☑   Update DNS records ············· Done         │
└─ ☐ ▼ API Integration ················ In Progress  │
   ├─ ☐   Auth endpoints               In Progress  │
   └─ ☐   Data sync                    Todo    ←dep │
```

**Visual rules:**
- Tree lines (│ ├ └) in the gutter show hierarchy
- ▼/▶ toggle before title for tasks with children
- Indentation: 24px per level
- Sequential/thread tasks show a "←dep" badge or vertical connecting line
- Drag zones:
  - Upper 50% of row = "insert before" (sibling) → horizontal line indicator
  - Lower 25% = "make child" → indented insertion line
  - Between rows = "insert after" (sibling) → horizontal line

---

## 5. Implementation Plan

### 5.1 File Changes Overview

#### Database & Migration
| File | Change |
|------|--------|
| `src/db/init.ts` | Add `areas` table creation. Add migration for `projects` (area_id, position, description). Add migration for `tasks` (parent_id, depends_on_id, position, collapsed, level). |

#### Stores
| File | Change |
|------|--------|
| `src/store/useProjectStore.ts` | Add `renameProject`, `deleteProject`, `updateProjectColor`, `updateProjectArea`, `reorderProjects`. Update `Project` interface with area_id, position, description. |
| `src/store/useAreaStore.ts` | **NEW** — CRUD for areas (fetchAreas, addArea, renameArea, deleteArea, updateAreaColor, reorderAreas). |
| `src/store/useTaskStore.ts` | Update `Task` interface. Update `fetchTasks` query with parent_id, depends_on_id, position, collapsed, level, children_count. Add `addSubTask`, `setParentTask`, `setDependsOn`, `reorderTasks`, `toggleCollapsed`, `updateTaskTitle`, `updateTaskDescription`, `updateTaskPriority`, `updateTaskEstimate`. |
| `src/store/useViewStore.ts` | Add `activePage` state ('tasks' \| 'projects') to track which page is shown. |

#### Components — New
| File | Description |
|------|-------------|
| `src/components/views/ProjectsPage.tsx` | **NEW** — Projects list page with areas grouping, inline rename, color picker, CRUD. |
| `src/components/views/TaskDetailModal.tsx` | **NEW** — Task detail popup with all fields, sub-tasks section, time entries. |

#### Components — Modified
| File | Change |
|------|--------|
| `src/components/layout/Sidebar.tsx` | Add "Projects" navigation item. Track activePage. |
| `src/App.tsx` | Route to ProjectsPage when activePage='projects'. Pass activePage from store/sidebar. |
| `src/components/views/ListView.tsx` | Remove add-project button. Add hierarchy display (indentation, tree lines, collapse toggle). Add drag-to-nest, drag-to-reorder. Add sub-task/next-task quick-add buttons. Click task → open TaskDetailModal. |
| `src/components/views/KanbanView.tsx` | Filter to root-level tasks only (parent_id IS NULL). Show children count on cards. Click card → open TaskDetailModal. |

### 5.2 Migration Strategy

All migrations are additive (ALTER TABLE ADD COLUMN) — no destructive changes. Existing tasks get `parent_id = NULL, depends_on_id = NULL, level = 0, position = rowid, collapsed = 0`.

```sql
-- Backfill position for existing tasks
UPDATE tasks SET position = rowid WHERE position = 0;

-- Backfill position for existing projects
UPDATE projects SET position = rowid WHERE position = 0;
```

### 5.3 Implementation Order

```
Phase A (Projects Page):
  1. DB migration (areas table, projects columns)
  2. useAreaStore.ts (new)
  3. useProjectStore.ts (update with full CRUD + color)
  4. useViewStore.ts (add activePage)
  5. ProjectsPage.tsx (new)
  6. Sidebar.tsx (add Projects nav)
  7. App.tsx (routing)
  8. ListView.tsx (remove add-project button)

Phase B (Task Detail):
  1. DB migration (tasks columns)
  2. useTaskStore.ts (add new fields, sub-task methods)
  3. TaskDetailModal.tsx (new)
  4. ListView.tsx (click → open modal)
  5. KanbanView.tsx (click → open modal)

Phase C (Hierarchy in List):
  1. useTaskStore.ts (fetchTasks with hierarchy ordering, children_count)
  2. ListView.tsx (full rewrite: tree view, indentation, collapse, drag-to-nest)
  3. Quick-add buttons (sub-task, next-task)
  4. Thread visualization
  5. KanbanView.tsx (filter root-only, show progress)
```

---

## 6. Open Questions

1. **Auto-completion**: When all children are done, should parent auto-set to done status? Or just show progress and let user manually toggle?
2. **Thread enforcement**: Should sequential dependencies block status changes (can't set to "In Progress" if predecessor not done)? Or just visual?
3. **Area colors**: Should areas have colors? Current design includes them but they could be just labels.
4. **Due dates**: Not in current schema. Needed for calendar view to show tasks. Add later?
5. **Drag-to-nest depth limit**: Should we cap nesting depth (e.g. max 5 levels)?
