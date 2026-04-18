const fs = require('fs');
let content = fs.readFileSync('src/i18n.ts', 'utf8');

content = content.replace(/tab_view_calendar: 'Calendar',\n  tab_view_tree: 'Tree',/g, "tab_view_calendar: 'Calendar',");
content = content.replace(/tab_view_calendar: '日历',\n  tab_view_tree: '树状图',/g, "tab_view_calendar: '日历',");

content = content.replace(/tab_view_calendar: 'Calendar',/g, "tab_view_calendar: 'Calendar',\n  tab_view_tree: 'Tree',");
content = content.replace(/tab_view_calendar: '日历',/g, "tab_view_calendar: '日历',\n  tab_view_tree: '树状图',");

fs.writeFileSync('src/i18n.ts', content);
