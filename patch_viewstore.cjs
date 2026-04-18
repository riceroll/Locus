const fs = require('fs');
let content = fs.readFileSync('src/store/useViewStore.ts', 'utf8');

content = content.replace(/view_type: 'list' \| 'kanban' \| 'calendar'/g, "view_type: 'list' | 'kanban' | 'calendar' | 'tree'");
content = content.replace(/activeViewType: 'list' \| 'kanban' \| 'calendar'/g, "activeViewType: 'list' | 'kanban' | 'calendar' | 'tree'");
content = content.replace(/createView: \(name: string, viewType: 'list' \| 'kanban' \| 'calendar'/g, "createView: (name: string, viewType: 'list' | 'kanban' | 'calendar' | 'tree'");
content = content.replace(/changeViewType: \(id: string, viewType: 'list' \| 'kanban' \| 'calendar'/g, "changeViewType: (id: string, viewType: 'list' | 'kanban' | 'calendar' | 'tree'");
content = content.replace(/setViewType: \(type: 'list' \| 'kanban' \| 'calendar'\)/g, "setViewType: (type: 'list' | 'kanban' | 'calendar' | 'tree')");

fs.writeFileSync('src/store/useViewStore.ts', content);
