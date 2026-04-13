import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Circle, Filter, Plus, Save, Trash2 } from 'lucide-react';
import { useProjectStore } from '../../store/useProjectStore';
import { useStatusStore } from '../../store/useStatusStore';
import { useAreaStore } from '../../store/useAreaStore';
import { useViewStore, type ViewFilters } from '../../store/useViewStore';
import { useSettingsStore } from '../../store/useSettingsStore';
import { t } from '../../i18n';

type RuleField = 'status_id' | 'project_id' | 'area_id';
type RuleOperator = 'include' | 'exclude';

const emptyRule = () => ({
  field: 'status_id' as RuleField,
  operator: 'include' as RuleOperator,
  values: [] as string[],
});

export const ViewControls = () => {
  const { activeFilters, activeViewId, setFilters, createView, updateView, activeViewType } = useViewStore();
  const { statuses, fetchStatuses, addStatus, renameStatus, removeStatus, setDoneStatus } = useStatusStore();
  const { projects, fetchProjects } = useProjectStore();
  const { areas, fetchAreas } = useAreaStore();
  const { language } = useSettingsStore();

  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ViewFilters>(activeFilters);
  const [newStatusName, setNewStatusName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panels on click-outside or Escape
  useEffect(() => {
    if (!open && !showSaveForm) return;
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSaveForm(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setShowSaveForm(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, showSaveForm]);

  useEffect(() => {
    fetchStatuses();
    fetchProjects();
    fetchAreas();
  }, []);

  useEffect(() => {
    setDraftFilters(activeFilters);
  }, [activeFilters]);

  const statusOptions = useMemo(() => statuses.map((s) => ({ value: s.id, label: s.name })), [statuses]);
  const projectOptions = useMemo(() => projects.map((p) => ({ value: p.id, label: p.name })), [projects]);
  const areaOptions = useMemo(() => areas.map((a) => ({ value: a.id, label: a.name })), [areas]);

  const getOptions = (field: RuleField) => {
    if (field === 'status_id') {
      return statusOptions;
    }
    if (field === 'area_id') {
      return areaOptions;
    }
    return projectOptions;
  };

  const updateRule = (idx: number, patch: Partial<ViewFilters['rules'][number]>) => {
    const rules = draftFilters.rules.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setDraftFilters({ rules });
  };

  const toggleValue = (idx: number, value: string) => {
    const rule = draftFilters.rules[idx];
    const has = rule.values.includes(value);
    const values = has ? rule.values.filter((v) => v !== value) : [...rule.values, value];
    updateRule(idx, { values });
  };

  const applyFilters = () => {
    setFilters(draftFilters);
  };

  const handleSaveView = async () => {
    // Apply draft filters first in case user forgot to click Apply
    setFilters(draftFilters);

    if (activeViewId) {
      // Update existing saved view
      await updateView(activeViewId, draftFilters);
      setShowSaveForm(false);
    } else {
      // Show inline form to name new view
      setShowSaveForm(true);
    }
  };

  const handleConfirmSave = async () => {
    if (!saveName.trim()) return;
    await createView(saveName.trim(), activeViewType, draftFilters);
    setSaveName('');
    setShowSaveForm(false);
  };

  return (
    <div ref={panelRef} className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors ${
          activeFilters.rules.length > 0
            ? 'bg-brand-100 border-brand-300 text-brand-700'
            : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
        }`}
      >
        <Filter className="w-3.5 h-3.5" />
        {t(language, 'btn_filters')}
        {activeFilters.rules.length > 0 && (
          <span className="ml-0.5 text-[10px] bg-brand-600 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center">
            {activeFilters.rules.length}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={handleSaveView}
        className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600 bg-white dark:bg-neutral-800 transition-colors"
      >
        <Save className="w-3.5 h-3.5" />
        {activeViewId ? t(language, 'btn_update_view') : t(language, 'btn_save_view')}
      </button>

      {showSaveForm && (
        <div className="absolute right-0 top-12 z-40 bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-xl dark:shadow-neutral-900/50 p-3 w-64">
          <p className="text-xs font-semibold text-slate-700 dark:text-neutral-200 mb-2">{t(language, 'save_as_new_view_title')}</p>
          <input
            type="text"
            autoFocus
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmSave()}
            placeholder={t(language, 'placeholder_view_name')}
            className="w-full border border-neutral-300 dark:border-neutral-600 rounded px-2.5 py-1.5 text-sm mb-2 outline-none focus:ring-1 focus:ring-brand-300 bg-white dark:bg-neutral-700 dark:text-neutral-200"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmSave}
              className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded hover:bg-brand-700"
            >
              {t(language, 'save')}
            </button>
            <button
              type="button"
              onClick={() => { setShowSaveForm(false); setSaveName(''); }}
              className="text-xs px-3 py-1.5 bg-slate-100 dark:bg-neutral-700 text-slate-600 dark:text-neutral-300 rounded hover:bg-slate-200 dark:hover:bg-neutral-600"
            >
              {t(language, 'cancel')}
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="absolute right-0 top-12 z-30 w-[420px] bg-white dark:bg-neutral-800 border border-slate-200 dark:border-neutral-700 rounded-lg shadow-xl dark:shadow-neutral-900/50 p-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-200">{t(language, 'btn_filters')}</h3>
              <button
                type="button"
                onClick={() => setDraftFilters({ rules: [...draftFilters.rules, emptyRule()] })}
                className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-600"
              >
                <Plus className="w-3 h-3 inline mr-1" /> {t(language, 'btn_add_filter')}
              </button>
            </div>

            {draftFilters.rules.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-neutral-400">{t(language, 'no_filter_rules')}</p>
            )}

            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {draftFilters.rules.map((rule, idx) => {
                const options = getOptions(rule.field);
                return (
                  <div key={idx} className="border border-slate-200 dark:border-neutral-700 rounded p-2 space-y-2 bg-slate-50/40 dark:bg-neutral-700/50">
                    <div className="flex items-center gap-2">
                      <select
                        value={rule.field}
                        onChange={(e) => updateRule(idx, { field: e.target.value as RuleField, values: [] })}
                        className="text-xs border border-slate-300 dark:border-neutral-600 rounded px-2 py-1 dark:bg-neutral-700 dark:text-neutral-200"
                      >
                        <option value="status_id">{t(language, 'filter_field_status')}</option>
                        <option value="project_id">{t(language, 'filter_field_project')}</option>
                        <option value="area_id">{t(language, 'filter_field_area')}</option>
                      </select>
                      <select
                        value={rule.operator}
                        onChange={(e) => updateRule(idx, { operator: e.target.value as RuleOperator })}
                        className="text-xs border border-slate-300 dark:border-neutral-600 rounded px-2 py-1 dark:bg-neutral-700 dark:text-neutral-200"
                      >
                        <option value="include">{t(language, 'filter_include')}</option>
                        <option value="exclude">{t(language, 'filter_exclude')}</option>
                      </select>
                      <button
                        type="button"
                        onClick={() =>
                          setDraftFilters({
                            rules: draftFilters.rules.filter((_, i) => i !== idx),
                          })
                        }
                        className="ml-auto text-slate-400 dark:text-neutral-500 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-1">
                      {options.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-neutral-200">
                          <input
                            type="checkbox"
                            checked={rule.values.includes(opt.value)}
                            onChange={() => toggleValue(idx, opt.value)}
                            className="w-3.5 h-3.5"
                          />
                          <span className="truncate">{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={applyFilters}
                className="text-xs px-2.5 py-1.5 rounded bg-brand-600 text-white hover:bg-brand-700"
              >
                {t(language, 'btn_apply_filters')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftFilters({ rules: [] });
                  setFilters({ rules: [] });
                }}
                className="text-xs px-2.5 py-1.5 rounded bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-600"
              >
                {t(language, 'btn_clear')}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 dark:border-neutral-700 pt-3">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-neutral-200 mb-2">{t(language, 'status_manager_title')}</h3>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {statuses.map((s) => (
                <div key={s.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    defaultValue={s.name}
                    onBlur={async (e) => {
                      const newName = e.target.value.trim();
                      if (!newName || newName === s.name) return;
                      await renameStatus(s.id, newName);
                    }}
                    className="text-xs border border-slate-300 dark:border-neutral-600 rounded px-2 py-1 flex-1 dark:bg-neutral-700 dark:text-neutral-200"
                  />
                  {s.is_done ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setDoneStatus(s.id)}
                      title={t(language, 'tooltip_set_done_status')}
                      className="text-slate-300 dark:text-neutral-600 hover:text-green-500 flex-shrink-0"
                    >
                      <Circle className="w-4 h-4" />
                    </button>
                  )}
                  {!s.is_done && (
                    <button
                      type="button"
                      onClick={async () => removeStatus(s.id)}
                      className="text-slate-400 dark:text-neutral-500 hover:text-red-600"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={newStatusName}
                onChange={(e) => setNewStatusName(e.target.value)}
                placeholder={t(language, 'placeholder_new_status')}
                className="text-xs border border-slate-300 dark:border-neutral-600 rounded px-2 py-1 flex-1 dark:bg-neutral-700 dark:text-neutral-200"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!newStatusName.trim()) return;
                  await addStatus(newStatusName.trim());
                  setNewStatusName('');
                }}
                className="text-xs px-2.5 py-1 rounded bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-600"
              >
                {t(language, 'add')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
