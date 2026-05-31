import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useTimerStore, formatDuration } from '../../store/useTimerStore';
import { useTaskStore } from '../../store/useTaskStore';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';
import { Square, Briefcase, Clock3, Flag, Minimize2 } from 'lucide-react';

interface FocusModeProps {
  onClose: () => void;
}

export const FocusMode = ({ onClose }: FocusModeProps) => {
  const { isRunning, activeTaskId, elapsed, stopTimer } = useTimerStore();
  const { tasks } = useTaskStore();
  const { projects } = useProjectStore();
  const { statuses } = useStatusStore();
  const { language, theme } = useSettingsStore();

  const activeTask = activeTaskId ? tasks.find((t) => t.id === activeTaskId) : null;
  const activeStatus = activeTask ? statuses.find((s) => s.id === activeTask.status_id) : null;
  const activeProject = activeTask?.project_id ? projects.find((p) => p.id === activeTask.project_id) : null;

  const estimatedCompletionText = useMemo(() => {
    if (!isRunning || !activeTask || activeTask.estimate == null) return null;
    const estimateSec = activeTask.estimate * 60;
    const remainingSec = Math.max(0, estimateSec - elapsed);
    const eta = new Date(Date.now() + remainingSec * 1000);
    const hour = eta.getHours().toString().padStart(2, '0');
    const minute = eta.getMinutes().toString().padStart(2, '0');
    return `${hour}:${minute}`;
  }, [isRunning, activeTask, elapsed]);

  const progressPercent = useMemo(() => {
    if (!activeTask || activeTask.estimate == null) return null;
    const estimateSec = activeTask.estimate * 60;
    if (estimateSec <= 0) return null;
    return Math.min(100, (elapsed / estimateSec) * 100);
  }, [activeTask, elapsed]);

  const prefersDark = typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-2xl ${
        isDark ? 'dark bg-neutral-900/96' : 'bg-slate-50/95'
      }`}
      data-tauri-drag-region
    >
      {/* Ambient glow */}
      {isRunning && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] h-[140%] bg-[radial-gradient(ellipse_at_center,rgb(var(--brand-500)/0.06),transparent_70%)]" />
        </div>
      )}

      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-5 right-5 flex items-center justify-center w-9 h-9 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-neutral-500 dark:text-neutral-400 transition-all hover:scale-105 active:scale-95"
        title="退出专注模式"
      >
        <Minimize2 className="w-4.5 h-4.5" />
      </button>

      <div className="flex flex-col items-center gap-8 w-full max-w-lg px-8">
        <div className="flex items-center gap-2.5 flex-wrap justify-center">
          {activeStatus && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{
                backgroundColor: `${activeStatus.color || '#64748b'}1A`,
                color: activeStatus.color || '#64748b',
              }}
            >
              <Flag className="w-3.5 h-3.5" />
              {activeStatus.name}
            </span>
          )}
          {activeProject ? (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{ backgroundColor: (activeProject.color || '#94a3b8') + '1A', color: activeProject.color || '#94a3b8' }}
            >
              <Briefcase className="w-3.5 h-3.5" />
              {activeProject.name}
            </span>
          ) : activeTask ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-neutral-400 dark:text-neutral-500 bg-black/5 dark:bg-white/5">
              <Briefcase className="w-3.5 h-3.5" />
              {t(language, 'no_project')}
            </span>
          ) : null}
          {isRunning && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold text-neutral-600 dark:text-neutral-400 bg-black/5 dark:bg-white/5">
              <Clock3 className="w-3.5 h-3.5" />
              {estimatedCompletionText ? `ETA ${estimatedCompletionText}` : 'ETA --:--'}
            </span>
          )}
        </div>

        {/* Task title */}
        <h1 className="text-3xl font-bold text-center text-neutral-900 dark:text-neutral-50 leading-tight">
          {activeTask?.title ?? activeTaskId ?? '—'}
        </h1>

        {/* Timer display */}
        <div className="flex flex-col items-center gap-4">
          <span className="font-mono text-7xl font-bold tabular-nums tracking-tight text-brand-600 dark:text-brand-400 leading-none">
            {formatDuration(elapsed)}
          </span>

          {/* Progress bar */}
          {progressPercent !== null && (
            <div className="w-full h-1.5 rounded-full bg-black/8 dark:bg-white/8 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-1000"
                style={{ width: `${progressPercent}%`, opacity: progressPercent >= 100 ? 0.5 : 1 }}
              />
            </div>
          )}
        </div>

        {/* Stop button */}
        <button
          type="button"
          onClick={() => { stopTimer(); onClose(); }}
          className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white font-semibold text-sm transition-all hover:scale-105 active:scale-95 shadow-sm"
        >
          <Square className="w-4 h-4 fill-current" />
          {t(language, 'tooltip_stop_timer')}
        </button>
      </div>
    </div>,
    document.body,
  );
};
