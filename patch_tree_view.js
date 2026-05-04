const fs = require('fs');

let content = fs.readFileSync('src/components/views/TreeView.tsx', 'utf8');

// 1. Add imports
content = content.replace(
  "import { createPortal, flushSync } from 'react-dom';",
  `import { createPortal, flushSync } from 'react-dom';
import { useViewStore } from '../../store/useViewStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { applyTaskFilters } from '../../lib/taskFilters';
import { Tooltip } from '../ui/Tooltip';
import { Zap, Eye } from 'lucide-react';
import { t } from '../../lib/i18n';`
);

// 2. Add hooks to TreeView inside export const TreeView = () => {
content = content.replace(
  "const { mouseWheelZoom, invertMouseWheelZoom } = useSettingsStore();",
  `const { mouseWheelZoom, invertMouseWheelZoom, language } = useSettingsStore();
  const { activeFilters, setFilters } = useViewStore();
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  
  const doneSet = useMemo(() => new Set(statuses.filter((s) => Number(s.is_done) === 1).map((s) => s.id)), [statuses]);
  
  const incompleteDescendants = useMemo(() => {
    const parentMap = new Map<string, Task[]>();
    for (const t of tasks) {
      if (t.parent_id) {
        let arr = parentMap.get(t.parent_id);
        if (!arr) { arr = []; parentMap.set(t.parent_id, arr); }
        arr.push(t);
      }
    }
    const incomp = new Set<string>();
    const check = (id: string): boolean => {
      if (incomp.has(id)) return true;
      const children = parentMap.get(id);
      if (!children) return false;
      for (const c of children) {
        if (!doneSet.has(c.status_id) || check(c.id)) {
          incomp.add(id);
          return true;
        }
      }
      return false;
    };
    for (const t of tasks) check(t.id);
    return incomp;
  }, [tasks, doneSet]);

  const filteredTasks = useMemo(() => {
    let pool = applyTaskFilters(tasks, activeFilters, { projects });
    if (activeFilters.actionableOnly) {
      pool = pool.filter((t) => {
        if (incompleteDescendants.has(t.id)) return false;
        if (doneSet.has(t.status_id)) return false;
        return true;
      });
    } else {
      pool = pool.filter((t) => t.parent_id === null || doneSet.has(t.status_id));
    }
    if (activeFilters.viewableOnly) {
      pool = pool.filter((t) => !!t.visible);
    }
    return new Set(pool.map((t) => t.id));
  }, [tasks, activeFilters, projects, incompleteDescendants, doneSet]);
`
).replace(
  "const { tasks } = useTaskStore();", 
  "const { tasks } = useTaskStore();\n"
);
content = content.replace("const { mouseWheelZoom, invertMouseWheelZoom, language } = useSettingsStore();", `const { tasks } = useTaskStore();\n  const { mouseWheelZoom, invertMouseWheelZoom, language } = useSettingsStore();`);
// Remove duplicate useTaskStore pull if any
content = content.replace(/const \{ tasks \} = useTaskStore\(\);\s+const \{ tasks \} = useTaskStore\(\);/g, 'const { tasks } = useTaskStore();');

// 3. Update treeForest
const oldTreeForest = `  const treeForest = useMemo(() => {
    const map = new Map<string, Task & { children: (Task & { children: any[] })[] }>();
    const roots: (Task & { children: any[] })[] = [];

    for (const t of tasks) {
      map.set(t.id, { ...t, children: [] });
    }

    for (const t of tasks) {
      const node = map.get(t.id)!;
      if (t.parent_id && map.has(t.parent_id)) {
        map.get(t.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }, [tasks]);`;

const newTreeForest = `  const treeForest = useMemo(() => {
    const map = new Map<string, Task & { children: (Task & { children: any[] })[] }>();
    const roots: (Task & { children: any[] })[] = [];

    for (const t of tasks) {
      map.set(t.id, { ...t, children: [] });
    }

    const keepNode = new Set<string>();
    const markKeep = (id: string) => {
      let current: string | null = id;
      while (current && !keepNode.has(current)) {
        keepNode.add(current);
        const node = map.get(current);
        current = node?.parent_id || null;
      }
    };
    
    // Only matching tasks act as seeds for the tree
    for (const t of tasks) {
      if (filteredTasks.has(t.id)) {
        markKeep(t.id);
      }
    }

    for (const t of tasks) {
      if (!keepNode.has(t.id)) continue;
      const node = map.get(t.id)!;
      if (t.parent_id && map.has(t.parent_id) && keepNode.has(t.parent_id)) {
        map.get(t.parent_id)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }, [tasks, filteredTasks]);`;

content = content.replace(oldTreeForest, newTreeForest);

// 4. Wrap the return statement with a flexible-column layout that includes the toolbar
content = content.replace(
  /<div\s+ref=\{viewportRef\}\s+onPointerDownCapture=\{handleViewportPointerDownCapture\}\s+onPointerMove=\{handleViewportPointerMove\}\s+onPointerUp=\{handleViewportPointerUp\}\s+onPointerCancel=\{handleViewportPointerCancel\}\s+onLostPointerCapture=\{([^}]+)\}\s+className=\{`h-full overflow-auto bg-slate-50 dark:bg-neutral-900 \$\{isPanning \? 'cursor-grabbing' : 'cursor-grab'\}`\}\s+>/,
  \`<div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-neutral-900">
      <div className="shrink-0 px-4 py-2 border-b-2 border-neutral-200 dark:border-neutral-700 flex items-center gap-2 flex-wrap bg-white dark:bg-neutral-800">
        <Tooltip id="actionable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, actionableOnly: !activeFilters.actionableOnly, viewableOnly: false })}
            className={\\\`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors \${
              activeFilters.actionableOnly
                ? 'bg-amber-100 border-amber-300 text-amber-700 dark:bg-amber-900/30 dark:border-amber-700 dark:text-amber-400'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
            }\\\`}
          >
            <Zap className="w-3.5 h-3.5" />
            {t(language, 'btn_actionable')}
          </button>
        </Tooltip>
        <Tooltip id="viewable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, viewableOnly: !activeFilters.viewableOnly, actionableOnly: false })}
            className={\\\`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors \${
              activeFilters.viewableOnly
                ? 'bg-brand-100 border-brand-300 text-brand-700'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
            }\\\`}
          >
            <Eye className="w-3.5 h-3.5" />
            {t(language, 'btn_viewable')}
          </button>
        </Tooltip>
      </div>

    <div
      ref={viewportRef}
      onPointerDownCapture={handleViewportPointerDownCapture}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerUp}
      onPointerCancel={handleViewportPointerCancel}
      onLostPointerCapture=$1
      className={\\\`flex-1 overflow-auto bg-slate-50 dark:bg-neutral-900 \${isPanning ? 'cursor-grabbing' : 'cursor-grab'}\\\`}
    >\`
);

content = content.replace("export const TreeView = () => {", "export const TreeView = () => {\n  const { tasks } = useTaskStore();");

fs.writeFileSync('src/components/views/TreeView.tsx', content);

