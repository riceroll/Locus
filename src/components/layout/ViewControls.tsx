import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Plus, Save, Trash2 } from 'lucide-react';
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
  const { statuses, fetchStatuses } = useStatusStore();
  const { projects, fetchProjects } = useProjectStore();
  const { areas, fetchAreas } = useAreaStore();
  const { language } = useSettingsStore();

  const [open, setOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState<ViewFilters>({
    rules: activeFilters.rules,
    actionableOnly: activeFilters.actionableOnly ?? false,
    viewableOnly: activeFilters.viewableOnly ?? false,
  });
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
    setDraftFilters({
      rules: activeFilters.rules,
      actionableOnly: activeFilters.actionableOnly ?? false,
      viewableOnly: activeFilters.viewableOnly ?? false,
    });
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
                  <div key={idx} className="border border-slate-200 dark:border-neutral-700 rounded-lg p-3 space-y-3 bg-slate-50/40 dark:bg-neutral-800/50">
                    <div className="flex items-center gap-2">
                      <div className="flex bg-slate-100/80 dark:bg-neutral-900/80 p-0.5 rounded-md border border-slate-200/50 dark:border-neutral-800">
                        {(['status_id', 'project_id', 'area_id'] as RuleField[]).map(field => (
                          <button
                            key={field}
                            type="button"
                            onClick={() => updateRule(idx, { field, values: [] })}
                            className={`text-[11px] px-2 py-1 rounded transition-all ${
                              rule.field === field
                                ? 'bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-100 shadow-[0_1px_2px_rgba(0,0,0,0.05)] font-medium'
                                : 'text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300'
                            }`}
                          >
                            {field === 'status_id' ? t(language, 'filter_field_status') : field === 'project_id' ? t(language, 'filter_field_project') : t(language, 'filter_field_area')}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => updateRule(idx, { operator: rule.operator === 'include' ? 'exclude' : 'include' })}
                        className={`text-[11px] px-2 py-1 rounded-md font-medium border transition-colors ${
                          rule.operator === 'include' 
                            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800/50 dark:text-blue-400'
                            : 'bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-900/20 dark:border-orange-800/50 dark:text-orange-400'
                        }`}
                      >
                        {rule.operator === 'include' ? t(language, 'filter_include') : t(language, 'filter_exclude')}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setDraftFilters({
                            rules: draftFilters.rules.filter((_, i) => i !== idx),
                          })
                        }
                        className="ml-auto p-1 rounded-md text-slate-400 dark:text-neutral-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {options.length === 0 && (
                        <span className="text-xs text-slate-400 dark:text-neutral-500 italic pb-1">
                          No items available.
                        </span>
                      )}
                      {options.map((opt) => {
                        const isSelected = rule.values.includes(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => toggleValue(idx, opt.value)}
                            className={`text-[11px] px-2.5 py-1 rounded-full transition-all border ${
                              isSelected
                                ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700/50 dark:text-brand-300 font-medium'
                                : 'bg-white border-slate-200 text-slate-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50 dark:hover:bg-neutral-700/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-200 dark:border-neutral-700 pt-3">
              <button
                type="button"
                onClick={() => setDraftFilters({ ...draftFilters, actionableOnly: !draftFilters.actionableOnly })}
                className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                  draftFilters.actionableOnly
                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700/50 dark:text-brand-300 font-medium'
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50 dark:hover:bg-neutral-700/50'
                }`}
              >
                {t(language, 'filter_actionable_only')}
              </button>
              <button
                type="button"
                onClick={() => setDraftFilters({ ...draftFilters, viewableOnly: !draftFilters.viewableOnly })}
                className={`text-xs px-3 py-1.5 rounded-full transition-all border ${
                  draftFilters.viewableOnly
                    ? 'bg-brand-50 border-brand-200 text-brand-700 dark:bg-brand-900/30 dark:border-brand-700/50 dark:text-brand-300 font-medium'
                    : 'bg-white border-slate-200 text-slate-600 dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-slate-50 dark:hover:bg-neutral-700/50'
                }`}
              >
                {t(language, 'filter_viewable_only')}
              </button>
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
                  setDraftFilters({ rules: [], actionableOnly: false, viewableOnly: false });
                  setFilters({ rules: [], actionableOnly: false, viewableOnly: false });
                }}
                className="text-xs px-2.5 py-1.5 rounded bg-slate-100 dark:bg-neutral-700 text-slate-700 dark:text-neutral-200 hover:bg-slate-200 dark:hover:bg-neutral-600"
              >
                {t(language, 'btn_clear')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
