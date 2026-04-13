# Calendar View Rework — Design & Implementation Plan

## Overview

Replace the current FullCalendar-based `CalendarView` with a custom-built calendar that matches the app's existing UI style (slate/white/blue palette, rounded-xl cards, `border-slate-200` borders). The new calendar is a **time-log** focused view with a task sidebar, pinch/scroll zoom, draggable entries, and a time-entry popup editor.

---

## Current State

- **CalendarView.tsx** (202 lines): wraps `@fullcalendar/react` with two modes — "Time Log" (timeGridDay/Week) and "Tasks by Due Date" (dayGridMonth). Clicking a task-event opens `TaskDetailModal`.
- **Data**: `time_entries` table (`id, task_id, start_time, end_time, duration`). Queried via raw SQL in CalendarView + `useTimerStore`.
- **Dependencies**: `@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/interaction`, `@fullcalendar/timegrid`.
- **DnD already in project**: `@dnd-kit/core` used in ListView & KanbanView.

---

## Feature List

### F1 — Custom Time-Grid Calendar (replace FullCalendar)

Remove FullCalendar. Build a custom `<CalendarGrid>` component:

| Sub-feature | Detail |
|---|---|
| **F1.1** Day / Week toggle | Header: `< prev` `today` `next >` + `Day | Week` segment control |
| **F1.2** Time column | Left gutter: hour labels 00–24 (or configurable `slotMinTime`/`slotMaxTime`) |
| **F1.3** Day columns | 1 column (Day view) or 7 columns (Week view), headers show `Mon 4/10` etc. |
| **F1.4** Current-time indicator | Red horizontal line at "now", updated every 60s |
| **F1.5** Time-entry blocks | Absolutely-positioned `<div>`s inside each day column, sized by `(end-start)/totalSlotHeight` |
| **F1.6** Scroll to current hour | On mount, auto-scroll so "now" is visible |
| **F1.7** Style | `bg-white rounded-xl shadow-sm border border-slate-200`, hour lines `border-slate-100`, entry blocks `rounded-lg` with task color or blue default |

### F2 — Pinch / Ctrl+Scroll Zoom

| Sub-feature | Detail |
|---|---|
| **F2.1** Zoom state | `hourHeight` (px per hour), range 40–200, default 64 |
| **F2.2** Ctrl+Wheel | `onWheel` on grid container: if `e.ctrlKey` or `e.metaKey`, `e.preventDefault()` and adjust `hourHeight` by `deltaY * -0.5` |
| **F2.3** Pinch (trackpad) | Same `wheel` event (macOS trackpad pinch fires `wheel` with `ctrlKey=true`) — no extra gesture API needed |
| **F2.4** Smooth transition | `transition: height 50ms` on slot rows, or just direct state without transition (smoother) |

### F3 — Draggable Time Entries on Calendar

| Sub-feature | Detail |
|---|---|
| **F3.1** Vertical drag to reschedule | Drag an entry block up/down to change its start/end time (keep duration). Snap to 15-min grid. |
| **F3.2** Resize handle | Bottom edge of entry block: drag to change `end_time` (minimum 5 min) |
| **F3.3** Cross-day drag (Week view) | Drag entry to a different day column |
| **F3.4** Persist | On drop: `UPDATE time_entries SET start_time=$1, end_time=$2, duration=$3 WHERE id=$4` |
| **F3.5** DnD implementation | Use `@dnd-kit/core` (already installed). Each entry = draggable; calendar grid = droppable with coordinate-based snapping. Custom `collisionDetection` that maps pointer Y → time. |

### F4 — Right Sidebar: Task List Panel

| Sub-feature | Detail |
|---|---|
| **F4.1** Layout | Calendar view becomes a flex row: `<CalendarGrid flex-1>` + `<TaskSidebar w-72>`, with a draggable splitter or fixed width |
| **F4.2** Task cards | Reuse the same task-row style from ListView — task title, status badge, priority dot, project tag. Compact card format. |
| **F4.3** View selection | Dropdown at top of sidebar: pick any saved view (from `useViewStore.views`) or "All Tasks". Filters from the selected view apply to the sidebar list. |
| **F4.4** Sorting | Sort dropdown: `Title`, `Priority`, `Status`, `Created`, `Due Date`. Direction toggle (asc/desc). Local state only (doesn't affect saved view). |
| **F4.5** Search / filter | Optional text search input to quick-filter by title |
| **F4.6** Collapse | Toggle button to hide/show the sidebar (saves screen space) |

### F5 — Drag Task from Sidebar → Calendar

| Sub-feature | Detail |
|---|---|
| **F5.1** Sidebar tasks are draggable | Each task card in sidebar is a dnd-kit `useDraggable` |
| **F5.2** Drop on calendar grid | Dropping a task card onto a time slot creates a new `time_entry` for that task: `start_time` = snapped drop position, `duration` = task estimate or default 30 min, `end_time` = start + duration |
| **F5.3** Visual feedback | During drag: ghost card follows cursor; calendar column highlights the target time slot; snap guide lines at 15-min intervals |
| **F5.4** Single DndContext | Wrap both sidebar and calendar in one `<DndContext>` so cross-container drag works |

### F6 — Time-Entry Popup (click entry on calendar)

| Sub-feature | Detail |
|---|---|
| **F6.1** Trigger | Click a time-entry block on the calendar |
| **F6.2** Popup content | A floating panel (not full modal) anchored near the clicked entry. Shows: |
| | — Task title (read-only, links to task) |
| | — Start time (editable, datetime-local input) |
| | — End time (editable, datetime-local input) |
| | — Duration (computed, read-only) |
| | — Delete button (trash icon, with confirm) |
| **F6.3** Back arrow → Task detail | A `←` button at top of popup that opens the full `TaskDetailModal` for the parent task, then closes the popup |
| **F6.4** Edit persist | On blur of start/end inputs: update `time_entries` row. Recompute duration = `(end - start) / 1000`. |
| **F6.5** Delete | `DELETE FROM time_entries WHERE id = $1`. Confirm inline ("Are you sure?") or just a brief undo toast. |
| **F6.6** Style | `bg-white rounded-xl shadow-lg border border-slate-200 p-4`, consistent with TaskDetailModal style |

### F7 — Click Empty Calendar Slot to Create Entry

| Sub-feature | Detail |
|---|---|
| **F7.1** Click on empty grid | Opens a mini-form: select task (dropdown or search), auto-fills start time from click position, duration default 30m |
| **F7.2** Drag-to-create | Click+drag on empty area to define start→end range, then pick task |

---

## Architecture

### Component Tree

```
CalendarView (layout wrapper)
├── DndContext (shared between sidebar + calendar)
│   ├── CalendarGrid
│   │   ├── CalendarHeader (nav: prev/today/next + day/week toggle)
│   │   ├── CalendarTimeGrid (scrollable)
│   │   │   ├── TimeGutter (hour labels)
│   │   │   ├── DayColumn[] (one per visible day)
│   │   │   │   ├── TimeEntryBlock[] (draggable, resizable)
│   │   │   │   └── DropZone (for external drops)
│   │   │   └── NowIndicator
│   │   └── DragOverlay (ghost during drag)
│   └── TaskSidebar
│       ├── SidebarHeader (view selector, sort, search)
│       └── TaskCardList
│           └── TaskCard[] (draggable)
├── TimeEntryPopup (floating, conditional)
└── TaskDetailModal (reused from existing)
```

### File Structure

```
src/components/views/
├── CalendarView.tsx           ← layout shell (sidebar + grid + DndContext)
├── calendar/
│   ├── CalendarGrid.tsx       ← header + time grid container + zoom handler
│   ├── CalendarHeader.tsx     ← navigation + day/week toggle
│   ├── DayColumn.tsx          ← single day column with drop zone
│   ├── TimeEntryBlock.tsx     ← one time-entry block (draggable + resizable)
│   ├── TimeGutter.tsx         ← hour labels column
│   ├── NowIndicator.tsx       ← red "now" line
│   ├── TimeEntryPopup.tsx     ← click-to-edit popup for a time entry
│   ├── TaskSidebar.tsx        ← right sidebar with task list
│   ├── TaskCard.tsx           ← draggable task card for sidebar
│   └── calendarUtils.ts       ← shared helpers (time→px, snap, date math)
```

### State Management

- **`useTimerStore`**: Already has `getAllEntries()`, `getEntriesForTask()`, `deleteEntry()`, `addManualEntry()`. Need to add:
  - `updateEntry(id, { start_time, end_time })` — for drag-reposition and popup editing
  - `createEntry(taskId, startTime, endTime)` — for drag-from-sidebar creation
- **Calendar local state** (in `CalendarView` or a `useCalendarState` hook):
  - `currentDate: Date` — anchor date
  - `viewMode: 'day' | 'week'`
  - `hourHeight: number` — zoom level (px per hour)
  - `activePopupEntryId: string | null`
  - `sidebarCollapsed: boolean`
  - `sidebarViewId: string | null` — which saved view to apply to sidebar
  - `sidebarSort: { field, direction }`
- **No new DB tables** needed. `time_entries` schema is sufficient as-is.

### Zoom Implementation Detail

```tsx
const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    setHourHeight(h => Math.min(200, Math.max(40, h - e.deltaY * 0.5)));
  }
};
// Attach via ref + useEffect (passive: false required for preventDefault)
```

### DnD Strategy

One `<DndContext>` wraps everything. Discriminate drop targets by ID prefix:
- Calendar day columns: `id="cal-day:2026-04-10"`
- Task sidebar cards: `id="sidebar-task:{taskId}"`
- Time entry blocks: `id="entry:{entryId}"`

The `onDragEnd` handler checks:
1. If source is `sidebar-task:*` and target is `cal-day:*` → create new time entry
2. If source is `entry:*` and target is `cal-day:*` → move entry to new time/day
3. Otherwise ignore

Pointer Y position → time mapping: `time = slotMinHour + (pointerY - gridTop) / hourHeight`

### Entry Positioning Math

```ts
// Given an entry with start_time and end_time (epoch ms):
const startOfDay = new Date(entry.start_time).setHours(0, 0, 0, 0);
const startOffsetHours = (entry.start_time - startOfDay) / 3_600_000;
const durationHours = (entry.end_time - entry.start_time) / 3_600_000;

const top = startOffsetHours * hourHeight;    // px from grid top
const height = durationHours * hourHeight;     // px tall
```

---

## Implementation Order

### Phase 1 — Core Calendar Grid (F1, F2)
1. Create `calendarUtils.ts` (time→px helpers, date range, snap-to-15min)
2. Create `TimeGutter.tsx` (hour labels)
3. Create `DayColumn.tsx` (single column, renders entry blocks)
4. Create `TimeEntryBlock.tsx` (positioned div, click handler)
5. Create `NowIndicator.tsx`
6. Create `CalendarHeader.tsx` (nav + view toggle)
7. Create `CalendarGrid.tsx` (assembles above, zoom handler)
8. Rewrite `CalendarView.tsx` to use `CalendarGrid` (no sidebar yet)
9. Remove FullCalendar dependencies

### Phase 2 — Time Entry Popup (F6)
1. Create `TimeEntryPopup.tsx` — floating panel with start/end editors, delete, back→task
2. Add `updateEntry()` to `useTimerStore`
3. Wire click on `TimeEntryBlock` → show popup

### Phase 3 — Draggable Entries (F3)
1. Wrap grid in `DndContext`
2. Make `TimeEntryBlock` draggable
3. Add drop detection on `DayColumn` (Y→time snapping)
4. Resize handle on entry bottom edge
5. Persist time changes on drop

### Phase 4 — Task Sidebar (F4)
1. Create `TaskCard.tsx` (compact task card)
2. Create `TaskSidebar.tsx` (view selector, sort, search, card list)
3. Update `CalendarView.tsx` layout: flex row with sidebar
4. Add sidebar collapse toggle

### Phase 5 — Drag Task → Calendar (F5)
1. Make `TaskCard` draggable
2. Extend `DndContext.onDragEnd` to handle sidebar→calendar drops
3. Add `createEntry()` to `useTimerStore`
4. Visual feedback (slot highlight during drag)

### Phase 6 — Polish (F7 + refinements)
1. Click-to-create on empty slot
2. Drag-to-create time range
3. Active timer entry (pulsing red, live-updating)
4. Keyboard nav (arrow keys to move between days)
5. Remove `@fullcalendar/*` from `package.json`

---

## Store Changes Summary

### `useTimerStore.ts` — new methods

```ts
updateEntry: async (id: string, fields: { start_time?: number; end_time?: number }) => {
  const db = await getDb();
  const entry = /* fetch current entry */;
  const newStart = fields.start_time ?? entry.start_time;
  const newEnd = fields.end_time ?? entry.end_time;
  const duration = Math.round((newEnd - newStart) / 1000);
  await db.execute(
    'UPDATE time_entries SET start_time=$1, end_time=$2, duration=$3 WHERE id=$4',
    [newStart, newEnd, duration, id]
  );
},

createEntry: async (taskId: string, startTime: number, endTime: number) => {
  const db = await getDb();
  const id = uuidv4();
  const duration = Math.round((endTime - startTime) / 1000);
  await db.execute(
    'INSERT INTO time_entries (id, task_id, start_time, end_time, duration) VALUES ($1,$2,$3,$4,$5)',
    [id, taskId, startTime, endTime, duration]
  );
},
```

---

## Dependencies

- **Remove**: `@fullcalendar/core`, `@fullcalendar/react`, `@fullcalendar/daygrid`, `@fullcalendar/interaction`, `@fullcalendar/timegrid`
- **Keep**: `@dnd-kit/core` (already used), `lucide-react`, `zustand`
- **No new packages needed**

---

## UI Style Reference

Match existing app patterns:
- Containers: `bg-white rounded-xl shadow-sm border border-slate-200`
- Inner dividers: `border-slate-100`
- Text: `text-slate-800` primary, `text-slate-500` secondary, `text-slate-400` tertiary
- Buttons: `bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg`
- Active/selected: `bg-blue-50 text-blue-600 border-blue-500`
- Entry blocks: `rounded-lg shadow-sm` with task color or `bg-blue-500 text-white`
- Popup: `bg-white rounded-xl shadow-lg border border-slate-200`
- Sidebar: `bg-white border-l border-slate-200` mirroring the left `Sidebar`
