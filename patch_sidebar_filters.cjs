const fs = require('fs');
let content = fs.readFileSync('src/components/views/calendar/TaskSidebar.tsx', 'utf8');

// 1. Get activeFilters and setFilters from useViewStore
content = content.replace(
  "const { tasks } = useTaskStore();",
  "const { tasks } = useTaskStore();\n  const { activeFilters, setFilters } = useViewStore();"
);

// 2. Remove local sidebarViewId, actionableOnly, viewableOnly
content = content.replace(
  /  const \[sidebarViewId, setSidebarViewId\] = useState<string \| null>\(null\);\n  const \[projectId, setProjectId\] = useState<string>\(''\);\n  const \[actionableOnly, setActionableOnly\] = useState\(false\);\n  const \[viewableOnly, setViewableOnly\] = useState\(false\);\n/,
  "  const [projectId, setProjectId] = useState<string>('');\n"
);
content = content.replace(
  "  const selectedView: SavedView | undefined = views.find((v) => v.id === sidebarViewId);\n",
  ""
);

content = content.replace(
  "style={selectedView?.color ? { backgroundColor: `${selectedView.color}20` } : {}}",
  "// Removed inline dynamic bg since we use global filter"
);

// 3. Update the displayed logic:
const oldDisplayed = `  const displayed = useMemo(() => {
    let list = tasks;
    // Apply saved view filters
    if (selectedView) {
      list = applyTaskFilters(list, selectedView.filters, { projects });
    }
    // Only top-level tasks (no parent) to keep sidebar clean, unless filtered
    if (!selectedView) {
      list = list.filter((t) => t.parent_id === null);
    }

    if (actionableOnly) {
      const parentIds = new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!));
      const doneStatusIds = new Set(statuses.filter((s) => Number(s.is_done)).map((s) => s.id));
      list = list.filter((t) => !parentIds.has(t.id) && !doneStatusIds.has(t.status_id));
    }
    if (viewableOnly) {
      list = list.filter((t) => !!t.visible);
    }
    if (projectId) {
      list = list.filter((t) => t.project_id === projectId);
    }
    list = sortTasks(list, sortField, sortDir);
    return list;
  }, [tasks, selectedView, projects, actionableOnly, viewableOnly, projectId, statuses, sortField, sortDir]);`;

const newDisplayed = `  const displayed = useMemo(() => {
    let list = applyTaskFilters(tasks, activeFilters, { projects });

    if (activeFilters.actionableOnly) {
      const parentIds = new Set(tasks.filter((t) => t.parent_id).map((t) => t.parent_id!));
      const doneStatusIds = new Set(statuses.filter((s) => Number(s.is_done)).map((s) => s.id));
      list = list.filter((t) => !parentIds.has(t.id) && !doneStatusIds.has(t.status_id));
    } else {
      // Because we apply rules directly, if no actionableOnly, maybe we just show top level like before? No, let's keep all matching rules or default to top level if no rules.
      if (activeFilters.rules.length === 0) {
        list = list.filter((t) => t.parent_id === null || Number(statuses.find(s => s.id === t.status_id)?.is_done));
      }
    }
    if (activeFilters.viewableOnly) {
      list = list.filter((t) => !!t.visible);
    }
    if (projectId) {
      list = list.filter((t) => t.project_id === projectId);
    }
    list = sortTasks(list, sortField, sortDir);
    return list;
  }, [tasks, activeFilters, projects, projectId, statuses, sortField, sortDir]);`;

content = content.replace(oldDisplayed, newDisplayed);

// 4. Update the Select block. Since we use ViewControls logic via activeFilters directly, we can remove the View dropdown and add the filter Actionable buttons.
// Wait, `TaskSidebar` imports ViewControls? The user can switch views using Sidebar.tsx on the left or ViewControls globally.
const oldSelectBlock = `        <div className="flex items-center justify-between">
          <select
            value={sidebarViewId ?? ''}
            onChange={(e) => setSidebarViewId(e.target.value || null)}
            className="text-xs font-medium text-neutral-600 dark:text-neutral-300 bg-transparent hover:bg-neutral-100 dark:hover:bg-neutral-600 px-2 py-1.5 rounded cursor-pointer outline-none appearance-none focus:ring-1 focus:ring-brand-300"
          >
            <option value="">{t(language, 'option_all_tasks')}</option>
            {views.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>`;

const newSelectBlock = `        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Tooltip id="actionable_sidebar">
              <button
                type="button"
                onClick={() => setFilters({ ...activeFilters, actionableOnly: !activeFilters.actionableOnly, viewableOnly: false })}
                className={\`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors \${
                  activeFilters.actionableOnly
                    ? 'bg-amber-100 border-amber-300 text-amber-700'
                    : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300'
                }\`}
              >
                <Zap className="w-3 h-3" />
                {t(language, 'btn_actionable')}
              </button>
            </Tooltip>
            <Tooltip id="viewable_sidebar">
              <button
                type="button"
                onClick={() => setFilters({ ...activeFilters, viewableOnly: !activeFilters.viewableOnly, actionableOnly: false })}
                className={\`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border transition-colors \${
                  activeFilters.viewableOnly
                    ? 'bg-brand-100 border-brand-300 text-brand-700'
                    : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300'
                }\`}
              >
                <Eye className="w-3 h-3" />
                {t(language, 'btn_viewable')}
              </button>
            </Tooltip>
          </div>`;

content = content.replace(oldSelectBlock, newSelectBlock);

// 5. Remove the old quick toggles line that was below sorting
const oldTogglesBlockRegex = /<div className="flex items-center gap-2">[\s\S]*?onClick=\{\(\) => setViewableOnly\(\(v\) => !v\)\}[\s\S]*?<\/button>[\s\S]*?<\/Tooltip>[\s\S]*?<\/div>/;
content = content.replace(oldTogglesBlockRegex, "");

fs.writeFileSync('src/components/views/calendar/TaskSidebar.tsx', content);
