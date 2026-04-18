const fs = require('fs');
let content = fs.readFileSync('src/components/layout/Sidebar.tsx', 'utf8');

// Fix typing of view creation menu
content = content.replace(/const \[newType, setNewType\] = useState<'list' \| 'kanban' \| 'calendar'>\('list'\);/g, "const [newType, setNewType] = useState<'list' | 'kanban' | 'calendar' | 'tree'>('list');");

// Fix typing in SortableViewRowProps
content = content.replace(/onChangeType: \(id: string, viewType: 'list' \| 'kanban' \| 'calendar'\) => void;/g, "onChangeType: (id: string, viewType: 'list' | 'kanban' | 'calendar' | 'tree') => void;");


fs.writeFileSync('src/components/layout/Sidebar.tsx', content);
