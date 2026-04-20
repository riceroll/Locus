import { create } from 'zustand';
import type { Language } from '../i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type { Language };

export type AccentKey = string;

// ── Accent presets: swatch-only, no hand-coded vars ─────────────────────────
// Brand vars are computed dynamically via generateBrandVars().
// Palette mirrors the project color swatches (TW-400 variants) + pure grays.
export const ACCENT_PRESETS: Array<{ key: string; swatch: string }> = [
  // Row 1: light vibrant (Tailwind -400 variants)
  { key: '#f87171', swatch: '#f87171' },
  { key: '#fb923c', swatch: '#fb923c' },
  { key: '#fbbf24', swatch: '#fbbf24' },
  { key: '#4ade80', swatch: '#4ade80' },
  { key: '#34d399', swatch: '#34d399' },
  { key: '#2dd4bf', swatch: '#2dd4bf' },
  { key: '#22d3ee', swatch: '#22d3ee' },
  // Row 2: cool blues → purples → pinks (-400 variants)
  { key: '#60a5fa', swatch: '#60a5fa' },
  { key: '#818cf8', swatch: '#818cf8' },
  { key: '#a78bfa', swatch: '#a78bfa' },
  { key: '#c084fc', swatch: '#c084fc' },
  { key: '#e879f9', swatch: '#e879f9' },
  { key: '#f472b6', swatch: '#f472b6' },
  { key: '#fb7185', swatch: '#fb7185' },
  // Row 3: saturated -500 variants + brand teal
  { key: '#ef4444', swatch: '#ef4444' },
  { key: '#f97316', swatch: '#f97316' },
  { key: '#f59e0b', swatch: '#f59e0b' },
  { key: '#22c55e', swatch: '#22c55e' },
  { key: '#0ea5e9', swatch: '#0ea5e9' },
  { key: '#6366f1', swatch: '#6366f1' },
  { key: '#347285', swatch: '#347285' },
  // Row 4: pure neutral grays (light → dark)
  { key: '#d4d4d4', swatch: '#d4d4d4' },
  { key: '#a3a3a3', swatch: '#a3a3a3' },
  { key: '#737373', swatch: '#737373' },
  { key: '#525252', swatch: '#525252' },
  { key: '#404040', swatch: '#404040' },
  { key: '#262626', swatch: '#262626' },
  { key: '#171717', swatch: '#171717' },
];

// ── Dynamic brand-scale generator ───────────────────────────────────────────
// Converts any hex color → 10 CSS custom property values (brand-50 … brand-900)
// using HSL interpolation.
function generateBrandVars(hex: string): Record<string, string> {
  // Parse hex → normalized RGB
  const h6 = hex.replace('#', '').padEnd(6, '0');
  const rn = parseInt(h6.slice(0, 2), 16) / 255;
  const gn = parseInt(h6.slice(2, 4), 16) / 255;
  const bn = parseInt(h6.slice(4, 6), 16) / 255;

  // RGB → HSL
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const LF = (max + min) / 2;
  let hF = 0;
  let sF = 0;
  if (max !== min) {
    const d = max - min;
    sF = LF > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === rn) hF = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) hF = ((bn - rn) / d + 2) / 6;
    else hF = ((rn - gn) / d + 4) / 6;
  }
  const L = LF * 100;
  const S = sF * 100;

  // HSL → RGB string helper
  const hslStr = (hi: number, si: number, li: number): string => {
    si /= 100; li /= 100;
    if (si === 0) { const v = Math.round(Math.max(0, Math.min(1, li)) * 255); return `${v} ${v} ${v}`; }
    const q = li < 0.5 ? li * (1 + si) : li + si - li * si;
    const p = 2 * li - q;
    const t2r = (t: number) => {
      t = ((t % 1) + 1) % 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    return `${Math.round(t2r(hi + 1/3) * 255)} ${Math.round(t2r(hi) * 255)} ${Math.round(t2r(hi - 1/3) * 255)}`;
  };

  // Build stops: [css-var, lightness%, saturation%]
  const stops: [string, number, number][] = [
    ['--brand-50',  Math.min(L + 47, 97),  S * 0.12],
    ['--brand-100', Math.min(L + 38, 95),  S * 0.25],
    ['--brand-200', Math.min(L + 27, 90),  S * 0.45],
    ['--brand-300', Math.min(L + 17, 83),  S * 0.65],
    ['--brand-400', Math.min(L + 8,  76),  S * 0.85],
    ['--brand-500', L,                      S],
    ['--brand-600', Math.max(L - 7,  4),   Math.min(S * 1.04, 100)],
    ['--brand-700', Math.max(L - 16, 3),   Math.min(S * 1.07, 100)],
    ['--brand-800', Math.max(L - 24, 2),   Math.min(S * 1.09, 100)],
    ['--brand-900', Math.max(L - 32, 1),   Math.min(S * 1.11, 100)],
  ];

  return Object.fromEntries(stops.map(([k, li, si]) => [k, hslStr(hF, si, li)]));
}



const STORAGE_KEY = 'locus-settings';

interface SavedSettings {
  theme: ThemeMode;
  accentColor: AccentKey;
  appName: string;
  language: Language;
  showKanbanEstimate: boolean;
  showKanbanSubtasks: boolean;
  kanbanCanvasDrag: boolean;
  showKanbanTimeSpent: boolean;
  showTotalTime: boolean;
  mouseWheelZoom: boolean;
  invertMouseWheelZoom: boolean;
  customColors?: string[];
}

interface SettingsState extends SavedSettings {
  setTheme: (theme: ThemeMode) => void;
  setAccentColor: (accent: AccentKey) => void;
  setAppName: (name: string) => void;
  setLanguage: (lang: Language) => void;
  setShowKanbanEstimate: (show: boolean) => void;
  setShowKanbanSubtasks: (show: boolean) => void;
  setKanbanCanvasDrag: (show: boolean) => void;
  setShowKanbanTimeSpent: (show: boolean) => void;
    setShowTotalTime: (show: boolean) => void;
  setMouseWheelZoom: (zoom: boolean) => void;
  setInvertMouseWheelZoom: (invert: boolean) => void;
  setCustomColors: (colors: string[]) => void;
  initTheme: () => void;
}

function loadSettings(): SavedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return {
      theme: 'system',
      accentColor: 'teal',
      appName: 'Locus',
      language: 'en',
      showKanbanEstimate: true,
      showKanbanSubtasks: true,
      kanbanCanvasDrag: true,
      showKanbanTimeSpent: true, 
      showTotalTime: false,
      mouseWheelZoom: false,
      invertMouseWheelZoom: false,
      customColors: [],
      ...JSON.parse(raw),
    };
  } catch { /* ignore */ }
  return { theme: 'system', accentColor: 'teal', appName: 'Locus', language: 'en', showKanbanEstimate: true, showKanbanSubtasks: true, kanbanCanvasDrag: true, showKanbanTimeSpent: true, showTotalTime: false, mouseWheelZoom: false, invertMouseWheelZoom: false, customColors: [] };
}

function save(s: SavedSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

function applyTheme(theme: ThemeMode) {
  const html = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  if (theme === 'dark' || (theme === 'system' && prefersDark)) {
    html.classList.add('dark');
  } else {
    html.classList.remove('dark');
  }
}

function applyAccentColor(accent: AccentKey) {
  const vars = generateBrandVars(accent.match(/^#[0-9a-fA-F]{6}$/) ? accent : '#347285');
  const root = document.documentElement;
  for (const [key, val] of Object.entries(vars)) {
    root.style.setProperty(key, val);
  }
}

let _mediaListener: (() => void) | null = null;

export const useSettingsStore = create<SettingsState>((set, get) => {
  const initial = loadSettings();
  return {
    ...initial,

    initTheme: () => {
      const { theme, accentColor } = get();
      applyAccentColor(accentColor);
      applyTheme(theme);

      // System theme: watch for OS changes
      if (_mediaListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', _mediaListener);
      }
      _mediaListener = () => { if (get().theme === 'system') applyTheme('system'); };
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', _mediaListener);
    },

    setTheme: (theme) => {
      set({ theme });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
      applyTheme(theme);
    },

    setAccentColor: (accentColor) => {
      set({ accentColor });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
      applyAccentColor(accentColor);
    },

    setAppName: (appName) => {
      set({ appName });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setLanguage: (language) => {
      set({ language });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    
    setShowKanbanEstimate: (showKanbanEstimate) => {
      set({ showKanbanEstimate });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setShowKanbanSubtasks: (showKanbanSubtasks) => {
      set({ showKanbanSubtasks });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setKanbanCanvasDrag: (kanbanCanvasDrag) => {
      set({ kanbanCanvasDrag });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setShowKanbanTimeSpent: (showKanbanTimeSpent) => {
      set({ showKanbanTimeSpent });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setShowTotalTime: (showTotalTime) => {
      set({ showTotalTime });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setMouseWheelZoom: (mouseWheelZoom) => {
      set({ mouseWheelZoom });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setInvertMouseWheelZoom: (invertMouseWheelZoom) => {
      set({ invertMouseWheelZoom });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },

    setCustomColors: (colors) => {
      set({ customColors: colors.slice(0, 7) });
      const state = get();
      save({ theme: state.theme, accentColor: state.accentColor, appName: state.appName, language: state.language, showKanbanEstimate: state.showKanbanEstimate, showKanbanSubtasks: state.showKanbanSubtasks, kanbanCanvasDrag: state.kanbanCanvasDrag, showKanbanTimeSpent: state.showKanbanTimeSpent, showTotalTime: state.showTotalTime, mouseWheelZoom: state.mouseWheelZoom, invertMouseWheelZoom: state.invertMouseWheelZoom, customColors: state.customColors });
    },
  };
});
