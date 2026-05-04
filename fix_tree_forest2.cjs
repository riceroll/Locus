const fs = require('fs');
let content = fs.readFileSync('src/components/views/TreeView.tsx', 'utf8');

const regex = /const treeForest = useMemo\(\(\) => \{[\s\S]*?\}, \[tasks, filteredTasks\]\);/;
const match = content.match(regex);
if (match) {
  const newTreeForest = `const treeForest = useMemo(() => {
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

  content = content.replace(regex, newTreeForest);
  fs.writeFileSync('src/components/views/TreeView.tsx', content);
  console.log("Successfully replaced");
} else {
  console.log("Not found");
}
