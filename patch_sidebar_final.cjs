const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

content = content.replace(/onChangeType: \(id: string, viewType: 'list' \| 'kanban' \| 'calendar'\) => void;/g, "onChangeType: (id: string, viewType: 'list' | 'kanban' | 'calendar' | 'tree') => void;");

fs.writeFileSync('src/components/layout/Sidebar.tsx', content);
