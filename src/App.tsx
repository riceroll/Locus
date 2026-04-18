import "./App.css";
import { useEffect, useRef, useState } from "react";
import { LayoutList, Columns3, Calendar, Network } from "lucide-react";
import { ListView } from "./components/views/ListView";
import { CalendarView } from "./components/views/CalendarView";
import { KanbanView } from "./components/views/KanbanView";
import { TreeView } from "./components/views/TreeView";
import { ProjectsPage } from "./components/views/ProjectsPage";
import { TimerBar } from "./components/timer/TimerBar";
import { Sidebar } from "./components/layout/Sidebar";
import { SettingsModal } from "./components/SettingsModal";
import { useViewStore } from "./store/useViewStore";
import { useSettingsStore } from "./store/useSettingsStore";
import { t } from "./i18n";

type ViewType = 'list' | 'kanban' | 'calendar' | 'tree';

const VIEW_ICONS: Record<ViewType, React.FC<{ className?: string }>> = {
  list: LayoutList,
  kanban: Columns3,
  calendar: Calendar,
  tree: Network,
};

function App() {
  const { activeViewType, activePage, setViewType } = useViewStore();
  const { initTheme, language } = useSettingsStore();
  const [sidebarWidth, setSidebarWidth] = useState(224);
  const [showSettings, setShowSettings] = useState(false);
  const startXRef = useRef(0);
  const startWRef = useRef(0);

  // Apply theme on first render
  useEffect(() => { initTheme(); }, []);

  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    startXRef.current = e.clientX;
    startWRef.current = sidebarWidth;
    const onMove = (ev: MouseEvent) => {
      const newW = Math.max(160, Math.min(400, startWRef.current + ev.clientX - startXRef.current));
      setSidebarWidth(newW);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-neutral-900 overflow-hidden">
      <div style={{ width: sidebarWidth, flexShrink: 0 }} className="relative flex flex-col z-40 bg-slate-50 dark:bg-neutral-900">
        <Sidebar onOpenSettings={() => setShowSettings(true)} />
        <div
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-brand-400/40 active:bg-brand-400/60 transition-colors z-10"
          onMouseDown={startSidebarResize}
        />
      </div>
      <div className="flex-1 flex flex-col min-w-0">
        <TimerBar />
        {activePage === 'projects' ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            <ProjectsPage />
          </div>
        ) : (
          <>
            <div className="relative z-30 border-b-2 border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-6 flex items-center">
              <nav className="flex gap-0.5">
                {(['list', 'kanban', 'calendar', 'tree'] as ViewType[]).map(view => {
                  const Icon = VIEW_ICONS[view];
                  const active = activeViewType === view;
                  return (
                    <button
                      key={view}
                      onClick={() => setViewType(view)}
                      className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium capitalize transition border-b-2 -mb-[2px] rounded-t ${
                        active
                          ? 'border-brand-500 text-brand-600 dark:text-brand-400'
                          : 'border-transparent text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 hover:bg-slate-50 dark:hover:bg-neutral-700/50 hover:border-slate-200 dark:hover:border-neutral-600'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {t(language, view === 'list' ? 'tab_view_list' : view === 'kanban' ? 'tab_view_kanban' : view === 'calendar' ? 'tab_view_calendar' : 'tab_view_tree')}
                    </button>
                  );
                })}
              </nav>
            </div>
            <div className={`relative z-10 flex-1 min-h-0 ${activeViewType === 'calendar' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
              {activeViewType === 'list' && <ListView />}
              {activeViewType === 'kanban' && <KanbanView />}
              {activeViewType === 'calendar' && <CalendarView />}
              {activeViewType === 'tree' && <TreeView />}
            </div>
          </>
        )}
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}

export default App;
