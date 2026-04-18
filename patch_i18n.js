const fs = require('fs');

let content = fs.readFileSync('src/i18n.ts', 'utf8');

// Ensure English 
let enPatch = `  // Missing keys
  section_tasks: 'Tasks',
  show_total_time: 'Show total time',
  show_total_time_desc: 'Display the sum of time spent on this item and all its sub-items.',
  btn_expand: 'Expand',
  tooltip_minimize: 'Minimize',
`;
// Ensure Chinese
let zhPatch = `  // Missing keys
  section_tasks: '任务',
  show_total_time: '显示节点总耗时',
  show_total_time_desc: '显示当前任务以及其所属所有子任务耗时总和。',
  btn_expand: '全屏',
  tooltip_minimize: '缩小',
`;

content = content.replace(/show_time_spent: 'Show time spent',/g, `show_time_spent: 'Show time spent',\n${enPatch}`);
content = content.replace(/show_time_spent: '显示已用时间',/g, `show_time_spent: '显示已用时间',\n${zhPatch}`);

fs.writeFileSync('src/i18n.ts', content);
