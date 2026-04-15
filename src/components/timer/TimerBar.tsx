import { useState, useEffect, useRef, useMemo } from 'react';
import { useTimerStore, formatDuration } from '../../store/useTimerStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import { Square, Search, Briefcase, Plus } from 'lucide-react';

// Score a task for suggestion ranking given a query string
function scoreTask(task: { title: string; updated_at: number; status_id: string }, query: string, doneStatusIds: Set<string>): number {
  const title = task.title.toLowerCase();
  const q = query.toLowerCase();
  let score = 0;
  if (q) {
    if (title.startsWith(q)) score += 60;
    else if (title.includes(q)) score += 30;
    else return -1; // no match
  }
  // Recency bonus (up to 30 points)
  const ageMs = Date.now() - task.updated_at;
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  score += Math.max(0, 30 - ageDays * 2);
  // Not-done bonus
  if (!doneStatusIds.has(task.status_id)) score += 10;
  return score;
}

export const TimerBar = () => {
  const { isRunning, activeTaskId, activeTaskTitle, elapsed, startTimer, stopTimer } = useTimerStore();
  const { tasks, updateTask, updateTaskProject, addTask } = useTaskStore();
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const { language } = useSettingsStore();

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;

  // Active timer title editing
  const [draftTitle, setDraftTitle] = useState('');
  useEffect(() => {
    if (activeTaskTitle) setDraftTitle(activeTaskTitle);
  }, [activeTaskTitle]);

  const commitTitle = async () => {
    const trimmed = draftTitle.trim();
    if (!trimmed || !activeTaskId || trimmed === activeTaskTitle) return;
    await updateTask(activeTaskId, { title: trimmed });
  };

  // Idle search / autocomplete
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const doneStatusIds = useMemo(
    () => new Set(statuses.filter((s) => s.is_done === 1).map((s) => s.id)),
    [statuses],
  );

  const suggestions = useMemo(() => {
    const scored = tasks
      .map((t) => ({ task: t, score: scoreTask(t, query, doneStatusIds) }))
      .filter((x) => x.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((x) => x.task);
    return scored;
  }, [tasks, query, doneStatusIds]);

  // Reset highlight when suggestions change
  useEffect(() => { setHighlightIdx(-1); }, [suggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectTask = async (task: typeof tasks[number]) => {
    setQuery('');
    setShowDropdown(false);
    await startTimer(task.id, task.title);
  };

  const handleIdleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setQuery('');
      setShowDropdown(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, suggestions.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, -1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightIdx >= 0 && suggestions[highlightIdx]) {
        await selectTask(suggestions[highlightIdx]);
      } else if (query.trim()) {
        // Create new task and start timer
        const newId = await addTask(query.trim());
        if (newId) {
          await startTimer(newId, query.trim());
        }
        setQuery('');
        setShowDropdown(false);
      }
    }
  };

  return (
    <div
      data-tauri-drag-region
      className={`group/timerbar sticky top-0 z-50 flex items-center justify-between px-5 py-3 transition-colors duration-400 relative border-b ${
        isRunning
          ? 'bg-brand-50/70 dark:bg-brand-950/30 border-brand-200/50 dark:border-brand-800/40 backdrop-blur-xl'
          : 'bg-white/80 dark:bg-neutral-900/80 border-slate-200 dark:border-neutral-800 backdrop-blur-xl'
      }`}
    >
      {/* Active Top Glow Line */}
      {isRunning && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-brand-500/70 to-transparent opacity-80" />
      )}

      <div className="relative flex items-center gap-3.5 min-w-0 flex-1">
        {isRunning ? (
          <div className="relative flex items-center justify-center w-3.5 h-3.5 shrink-0 ml-1">
            <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-60 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
          </div>
        ) : (
          <Search className="w-4 h-4 text-neutral-400 shrink-0 ml-1" />
        )}

        {isRunning && activeTask ? (
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitTitle();
              if (e.key === 'Escape') setDraftTitle(activeTaskTitle ?? '');
            }}
            className="text-[15px] font-medium text-brand-800 dark:text-brand-200 bg-transparent py-0.5 focus:outline-none min-w-0 flex-1 placeholder:text-brand-600/40 dark:placeholder:text-brand-400/40"
            placeholder={t(language, 'placeholder_task_name')}
          />
        ) : (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onKeyDown={handleIdleKeyDown}
              className="text-[15px] text-neutral-600 dark:text-neutral-300 font-medium bg-transparent py-0.5 focus:outline-none min-w-0 flex-1 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder={t(language, 'timer_idle_placeholder')}
            />
            {showDropdown && (suggestions.length > 0 || query.trim()) && (
              <div
                ref={dropdownRef}
                className="absolute left-0 top-full mt-3 w-full max-w-[560px] bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.15)] dark:shadow-black/50 overflow-hidden z-[9999] flex flex-col origin-top animate-in fade-in slide-in-from-top-2 duration-200"
              >
                {query.trim() && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={async () => {
                      const newId = await addTask(query.trim());
                      if (newId) await startTimer(newId, query.trim());
                      setQuery(''); setShowDropdown(false);
                    }}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm hover:bg-black/5 dark:hover:bg-white/5 border-b border-black/5 dark:border-white/5 transition-colors group/new"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-md bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400">
                      <Plus className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-brand-600 dark:text-brand-400 font-medium whitespace-nowrap">{t(language, 'timer_new_task_prefix')}</span>
                    <span className="truncate text-neutral-800 dark:text-neutral-200 font-medium">{query.trim()}</span>
                  </button>
                )}
                <div className="py-1">
                  {suggestions.map((task, idx) => {
                    const proj = projects.find((p) => p.id === task.project_id);
                    const color = proj?.color || '#94a3b8';
                    const isHighlighted = idx === highlightIdx;
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectTask(task)}
                        onMouseEnter={() => setHighlightIdx(idx)}
                        className={`w-full flex items-center gap-3 px-3.5 py-2 text-sm text-left transition-colors ${
                          isHighlighted ? 'bg-black/5 dark:bg-white/5' : 'hover:bg-black/5 dark:hover:bg-white/5'
                        }`}
                      >
                        <div className="flex items-center justify-center w-6 h-6 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 shrink-0">
                          <Square className="w-3.5 h-3.5" />
                        </div>
                        <span className="truncate flex-1 text-neutral-700 dark:text-neutral-200 font-medium">{task.title}</span>
                        {proj && (
                          <span
                            className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium tracking-wide"
                            style={{ backgroundColor: color + '15', color }}
                          >
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                            {proj.name}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-5 shrink-0 px-2">
        {isRunning && activeTask && (
          <div className="relative inline-flex shrink-0 group/project">
            {activeTask.project_id ? (() => {
              const proj = projects.find((p) => p.id === activeTask.project_id);
              const color = proj?.color || '#94a3b8';
              return (
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold cursor-pointer transition-transform hover:scale-105"
                  style={{ backgroundColor: color + '1A', color }}
                >
                  <Briefcase className="w-3.5 h-3.5" style={{ color }} />
                  {proj?.name ?? '—'}
                </span>
              );
            })() : (
              <span className="inline-flex items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500 cursor-pointer px-2.5 py-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors">
                <Briefcase className="w-3.5 h-3.5" />
                {t(language, 'no_project')}
              </span>
            )}
            <select
              value={activeTask.project_id || ''}
              onChange={(e) => updateTaskProject(activeTask.id, e.target.value || null)}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            >
              <option value="">{t(language, 'no_project')}</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        )}
        <div className="flex items-center gap-3 bg-white/50 dark:bg-black/20 rounded-lg pr-1 pl-3 shadow-inner shadow-black/5 dark:shadow-white/5 border border-black/5 dark:border-white/5">
          <span className={`font-mono text-[14px] leading-none font-bold tabular-nums tracking-wide ${isRunning ? 'text-brand-700 dark:text-brand-300' : 'text-transparent'}`}>
            {isRunning ? formatDuration(elapsed) : '00:00:00'}
          </span>
          <button
            onClick={stopTimer}
            className={`flex items-center justify-center w-7 h-7 rounded-md transition-all ${
              isRunning
                ? 'bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 shadow-sm'
                : 'bg-transparent text-neutral-300 dark:text-neutral-700 cursor-default opacity-0'
            }`}
            title={t(language, isRunning ? 'tooltip_stop_timer' : 'tooltip_start_timer')}
            disabled={!isRunning}
          >
            <Square className="w-3.5 h-3.5 fill-current" />
          </button>
        </div>
      </div>
    </div>
  );
};
