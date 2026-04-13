import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import * as LucideIcons from 'lucide-react';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';

export type IconType = 'color' | 'emoji' | 'lucide';

export interface ProjectIcon {
  type: IconType;
  value: string | null;    // emoji char or lucide icon name
  color: string | null;    // color hex (for lucide icons or tint)
}

interface Props {
  icon: ProjectIcon;
  projectColor: string | null;
  onChange: (icon: ProjectIcon) => void;
}

const COMMON_EMOJIS = [
  '🎯','🚀','⚡','💡','🔥','✨','🌟','💎','🎨','🎬',
  '📚','📝','📊','📈','🛠️','🔧','⚙️','🌐','🏠','💼',
  '🎮','🏆','🌱','🍀','🦁','🐉','🌈','🎵','💫','🔮',
  '🧩','🌊','🏔️','🦋','❤️','🧠','🔑','🌙','☀️','🎪',
];

const LUCIDE_ICON_NAMES: Array<keyof typeof LucideIcons> = [
  'Folder', 'FolderOpen', 'Star', 'Heart', 'Zap', 'Code', 'Terminal',
  'Database', 'Briefcase', 'Building', 'BookOpen', 'FileText', 'Music',
  'Camera', 'Globe', 'Map', 'Compass', 'Rocket', 'Plane', 'Home',
  'Settings', 'Users', 'Target', 'Award', 'Trophy', 'Lightbulb',
  'Leaf', 'Layers', 'Package', 'Puzzle',
] as Array<keyof typeof LucideIcons>;

const COLOR_OPTS = [
  '#f87171','#fb923c','#fbbf24','#4ade80','#34d399','#2dd4bf',
  '#22d3ee','#60a5fa','#818cf8','#a78bfa','#c084fc','#f472b6',
  '#94a3b8','#6366f1','#10b981','#347285',
];

export const IconPicker = ({ icon, projectColor, onChange }: Props) => {
  const { language } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'emoji' | 'icon'>('emoji');
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const anchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', close), 0);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const openPicker = () => {
    if (anchorRef.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left });
    }
    setOpen((v) => !v);
  };

  const displayColor = icon.color || projectColor || '#94a3b8';

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        onClick={openPicker}
        title={t(language, 'tooltip_change_icon')}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:scale-110 transition-transform border border-transparent hover:border-neutral-200 dark:hover:border-neutral-600 flex-shrink-0"
        style={icon.type === 'color' ? { backgroundColor: displayColor + '33', border: `1.5px solid ${displayColor}66` } : {}}
      >
        {icon.type === 'emoji' && icon.value ? (
          <span>{icon.value}</span>
        ) : icon.type === 'lucide' && icon.value ? (
          (() => {
            const LIcon = (LucideIcons as unknown as Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>>)[icon.value];
            return LIcon ? <LIcon className="w-4 h-4" style={{ color: displayColor }} /> : null;
          })()
        ) : (
          <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: displayColor }} />
        )}
      </button>

      {open && pos && createPortal(
        <div
          className="fixed z-[99999] bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-3 w-[260px]"
          style={{ top: pos.top, left: pos.left }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* Tabs */}
          <div className="flex gap-1 mb-3">
            {(['emoji', 'icon'] as const).map((tabType) => (
              <button
                key={tabType}
                type="button"
                onClick={() => setTab(tabType)}
                className={`flex-1 text-xs py-1.5 rounded-lg font-medium transition ${
                  tab === tabType
                    ? 'bg-brand-500 text-white'
                    : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-500 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                }`}
              >
                {tabType === 'emoji' ? t(language, 'tab_emoji') : t(language, 'tab_icon')}
              </button>
            ))}
            <button
              type="button"
              title={t(language, 'tooltip_remove_icon')}
              onClick={() => { onChange({ type: 'color', value: null, color: icon.color }); setOpen(false); }}
              className="px-2 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition"
            >
              ×
            </button>
          </div>

          {tab === 'emoji' ? (
            <div className="grid grid-cols-8 gap-1">
              {COMMON_EMOJIS.map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => { onChange({ type: 'emoji', value: em, color: icon.color }); setOpen(false); }}
                  className="w-7 h-7 text-base flex items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 transition"
                >
                  {em}
                </button>
              ))}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1 mb-3">
                {LUCIDE_ICON_NAMES.map((name) => {
                  const LIcon = (LucideIcons as unknown as Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>>)[name];
                  if (!LIcon) return null;
                  const selected = icon.type === 'lucide' && icon.value === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      title={name as string}
                      onClick={() => onChange({ type: 'lucide', value: name as string, color: icon.color || projectColor || '#347285' })}
                      className={`w-10 h-10 flex items-center justify-center rounded-lg transition ${
                        selected
                          ? 'bg-brand-100 dark:bg-brand-900/40'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                    >
                      <LIcon
                        className="w-4 h-4"
                        style={{ color: icon.color || projectColor || '#347285' }}
                      />
                    </button>
                  );
                })}
              </div>
              {/* Color picker for lucide icons */}
              <div>
                <p className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 uppercase tracking-wider mb-1.5">{t(language, 'section_icon_color')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {COLOR_OPTS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => onChange({ ...icon, color: c })}
                      className={`w-5 h-5 rounded-full border-2 transition-transform hover:scale-110 ${
                        (icon.color || projectColor) === c ? 'border-neutral-800 dark:border-neutral-100 scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
};
