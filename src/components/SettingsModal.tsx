import { X, Monitor, Sun, Moon } from 'lucide-react';
import { useSettingsStore, ACCENT_PRESETS, type ThemeMode } from '../store/useSettingsStore';
import { t, type Language } from '../i18n';

interface Props {
  onClose: () => void;
}

export const SettingsModal = ({ onClose }: Props) => {
  const {
    theme,
    accentColor,
    appName,
    language,
    showKanbanEstimate,
    showKanbanTimeSpent,
    setTheme,
    setAccentColor,
    setAppName,
    setLanguage,
    setShowKanbanEstimate,
    setShowKanbanTimeSpent,
  } = useSettingsStore();

  const THEME_OPTIONS: { value: ThemeMode; label: string; Icon: React.FC<{ className?: string }> }[] = [
    { value: 'light', label: t(language, 'theme_light'), Icon: Sun },
    { value: 'system', label: t(language, 'theme_system'), Icon: Monitor },
    { value: 'dark', label: t(language, 'theme_dark'), Icon: Moon },
  ];

  const LANG_OPTIONS: { value: Language; label: string }[] = [
    { value: 'en', label: 'English' },
    { value: 'zh', label: '中文' },
  ];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl dark:shadow-neutral-900/60 w-[400px] max-w-[95vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 dark:border-neutral-700">
          <h2 className="text-base font-semibold text-neutral-800 dark:text-neutral-200">{t(language, 'settings')}</h2>
          <button type="button" onClick={onClose} className="btn-ghost">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* ── Appearance ──────────────────────── */}
          <section>
            <h3 className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">{t(language, 'appearance')}</h3>

            {/* Theme */}
            <div className="mb-4">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2 block">{t(language, 'theme')}</label>
              <div className="flex gap-2">
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setTheme(value)}
                    className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border-2 transition-all text-xs font-medium ${
                      theme === value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                        : 'border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-500'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Accent Color */}
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2 block">{t(language, 'accent_color')}</label>
              <div className="grid grid-cols-7 gap-2">
                {ACCENT_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    title={preset.key}
                    onClick={() => setAccentColor(preset.key)}
                    className={`w-7 h-7 rounded-full border-2 transition-all hover:scale-110 ${
                      accentColor === preset.key ? 'border-neutral-800 dark:border-white scale-110 shadow-md' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: preset.swatch }}
                  />
                ))}
              </div>
              {/* Custom color picker */}
              <div className="mt-3 flex items-center gap-2.5">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">{t(language, 'custom_color')}</span>
                <label
                  className={`relative w-7 h-7 rounded-full border-2 cursor-pointer transition-all hover:scale-110 overflow-hidden ${
                    !ACCENT_PRESETS.some(p => p.key === accentColor) ? 'border-neutral-800 dark:border-white scale-110 shadow-md' : 'border-neutral-300 dark:border-neutral-600'
                  }`}
                  style={{ background: !ACCENT_PRESETS.some(p => p.key === accentColor) ? accentColor : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
                  title="Pick custom color"
                >
                  <input
                    type="color"
                    value={accentColor.match(/^#[0-9a-fA-F]{6}$/) ? accentColor : '#347285'}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  />
                </label>
              </div>
            </div>
          </section>

          {/* ── Workspace ──────────────────────── */}
          <section>
            <h3 className="text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-3">{t(language, 'workspace')}</h3>
            <div>
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1.5 block">{t(language, 'app_name_label')}</label>
              <input
                type="text"
                value={appName}
                onChange={(e) => setAppName(e.target.value)}
                placeholder="Locus"
                className="w-full form-input"
              />
              <p className="text-[11px] text-neutral-400 dark:text-neutral-500 mt-1">{t(language, 'app_name_hint')}</p>
            </div>

            <div className="mt-4">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2 block">{t(language, 'kanban_card_display')}</label>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowKanbanEstimate(!showKanbanEstimate)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500 transition text-sm"
                >
                  <span className="text-neutral-700 dark:text-neutral-200">{t(language, 'show_estimate_time')}</span>
                  <span className={`inline-flex h-5 w-9 rounded-full transition ${showKanbanEstimate ? 'bg-brand-500 justify-end' : 'bg-neutral-300 dark:bg-neutral-600 justify-start'} p-0.5`}>
                    <span className="h-4 w-4 rounded-full bg-white" />
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowKanbanTimeSpent(!showKanbanTimeSpent)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 hover:border-neutral-300 dark:hover:border-neutral-500 transition text-sm"
                >
                  <span className="text-neutral-700 dark:text-neutral-200">{t(language, 'show_time_spent')}</span>
                  <span className={`inline-flex h-5 w-9 rounded-full transition ${showKanbanTimeSpent ? 'bg-brand-500 justify-end' : 'bg-neutral-300 dark:bg-neutral-600 justify-start'} p-0.5`}>
                    <span className="h-4 w-4 rounded-full bg-white" />
                  </span>
                </button>
              </div>
            </div>

            {/* Language */}
            <div className="mt-4">
              <label className="text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-2 block">{t(language, 'language')}</label>
              <div className="flex gap-2">
                {LANG_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLanguage(value)}
                    className={`flex-1 py-2 rounded-xl border-2 transition-all text-xs font-medium ${
                      language === value
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300'
                        : 'border-neutral-200 dark:border-neutral-600 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-neutral-100 dark:border-neutral-700 bg-neutral-50/50 dark:bg-neutral-800/50 flex justify-end">
          <button type="button" onClick={onClose} className="btn-secondary">{t(language, 'done')}</button>
        </div>
      </div>
    </div>
  );
};
