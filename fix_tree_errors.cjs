const fs = require('fs');
let content = fs.readFileSync('src/components/views/TreeView.tsx', 'utf8');

content = content.replace("import { t } from '../../lib/i18n';", "import { t } from '../../i18n';");
content = content.replace("  const { batchUpdatePositions } = useTaskStore();\n", "");

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
    const markKeep = (id) => {
      let current = id;
      while (current && !keepNode.has(current)) {
        keepNode.add(current);
        const node = map.get(current);
        current = node?.parent_id || null;
      }
    };
    
    for (const t of tasks) {
      if (filteredTasks.has(t.id)) {
        markKeep(t.id);
      }
    }

    for (const t of tasks) {
      if (!keepNode.has(t.id)) continue;
      const node = map.get(t.id);
      if (t.parent_id && map.has(t.parent_id) && keepNode.has(t.parent_id)) {
        map.get(t.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  }, [tasks, filteredTasks]);`;

content = content.replace(oldTreeForest, newTreeForest);
fs.writeFileSync('src/components/views/TreeView.tsx', content);
