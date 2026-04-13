import { useState, useEffect, useRef, useMemo } from 'react';
import { useTimerStore, formatDuration } from '../../store/useTimerStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import { Square } from 'lucide-react';

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
      className="group/timerbar sticky top-0 z-50 flex items-center justify-between px-6 py-3 bg-white dark:bg-neutral-800 border-2 border-neutral-200 dark:border-neutral-700 transition-all duration-200 relative"
    >
      {/* ── Fancy 4-edge inset gradient border ─────────────────────────── */}
      {/* Inner box-shadow glow on all sides */}
      <div
        className={`pointer-events-none absolute inset-0 z-10 transition-opacity duration-300 ${
          isRunning ? 'opacity-100' : 'opacity-0 group-hover/timerbar:opacity-100'
        }`}
        style={{
          boxShadow: [
            'inset 0  3px  8px -4px rgb(var(--brand-500)/0.10)',
            'inset 4px 0 12px -6px rgb(var(--brand-500)/0.14)',
            'inset -4px 0 12px -6px rgb(var(--brand-500)/0.14)',
          ].join(', ')
        }}
      />
      {/* Top gradient line */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px z-10 opacity-0 group-hover/timerbar:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(90deg, transparent 5%, rgb(var(--brand-400)/0.3) 30%, rgb(var(--brand-300)/0.45) 50%, rgb(var(--brand-400)/0.3) 70%, transparent 95%)' }}
      />
      {/* Left gradient line */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-px z-10 opacity-0 group-hover/timerbar:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(180deg, transparent 0%, rgb(var(--brand-400)/0.38) 50%, transparent 100%)' }}
      />
      {/* Right gradient line */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-px z-10 opacity-0 group-hover/timerbar:opacity-100 transition-opacity duration-300"
        style={{ background: 'linear-gradient(180deg, transparent 0%, rgb(var(--brand-400)/0.38) 50%, transparent 100%)' }}
      />
      <div className="relative flex items-center gap-3 min-w-0 flex-1">
        {isRunning && activeTask ? (
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={commitTitle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void commitTitle();
              if (e.key === 'Escape') setDraftTitle(activeTaskTitle ?? '');
            }}
            className="text-sm font-semibold text-brand-600 dark:text-brand-400 bg-transparent focus:outline-none min-w-0 flex-1"
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
              className="text-sm text-neutral-500 dark:text-neutral-400 font-medium bg-transparent focus:outline-none min-w-0 flex-1 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
              placeholder={t(language, 'timer_idle_placeholder')}
            />
            {showDropdown && suggestions.length > 0 && (
              <div
                ref={dropdownRef}
                className="absolute left-0 top-full mt-1 min-w-[320px] max-w-[480px] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg shadow-lg overflow-hidden z-[9999]"
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
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-700 border-b border-neutral-100 dark:border-neutral-700/50"
                  >
                    <span className="text-brand-500 font-semibold text-xs">{t(language, 'timer_new_task_prefix')}</span>
                    <span className="truncate text-neutral-700 dark:text-neutral-200 font-medium">{query.trim()}</span>
                  </button>
                )}
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
                      className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition ${
                        isHighlighted ? 'bg-brand-50 dark:bg-brand-900/20' : 'hover:bg-neutral-50 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <span className="truncate flex-1 text-neutral-800 dark:text-neutral-100">{task.title}</span>
                      {proj && (
                        <span
                          className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                          style={{ backgroundColor: color + '22', color }}
                        >
                          <span className="w-1 h-1 rounded-full" style={{ background: color }} />
                          {proj.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-4 shrink-0">
        {isRunning && activeTask && (
          <div className="relative inline-flex shrink-0">
            {activeTask.project_id ? (() => {
              const proj = projects.find((p) => p.id === activeTask.project_id);
              const color = proj?.color || '#94a3b8';
              return (
                <span
                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium cursor-pointer"
                  style={{ backgroundColor: color + '22', color }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  {proj?.name ?? '—'}
                </span>
              );
            })() : (
              <span className="text-xs text-neutral-400 dark:text-neutral-500 cursor-pointer px-2 py-0.5">{t(language, 'no_project')}</span>
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
        <span className={`font-mono text-sm font-semibold tabular-nums ${isRunning ? 'text-neutral-700 dark:text-neutral-200' : 'text-transparent'}`}>
          {isRunning ? formatDuration(elapsed) : '00:00:00'}
        </span>
        <button
          onClick={stopTimer}
          className={`flex items-center justify-center w-6 h-6 rounded transition ${isRunning ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-neutral-200 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-600 cursor-default'}`}
          title={t(language, isRunning ? 'tooltip_stop_timer' : 'tooltip_start_timer')}
          disabled={!isRunning}
        >
          <Square className="w-3 h-3 fill-current" />
        </button>
      </div>
    </div>
  );
};
