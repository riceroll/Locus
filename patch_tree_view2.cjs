const fs = require('fs');
let content = fs.readFileSync('src/components/views/TreeView.tsx', 'utf8');

const targetReturn = `  return (
    <div
      ref={viewportRef}
      onPointerDownCapture={handleViewportPointerDownCapture}
      onPointerMove={handleViewportPointerMove}
      onPointerUp={handleViewportPointerUp}
      onPointerCancel={handleViewportPointerCancel}
      onLostPointerCapture={() => stopPanning()}
      className={\`h-full overflow-auto bg-slate-50 dark:bg-neutral-900 \${isPanning ? 'cursor-grabbing' : 'cursor-grab'}\`}
    >`;

const newReturn = `  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-neutral-900">
      {/* Toolbar */}
      <div className="shrink-0 px-4 py-2 border-b-2 border-neutral-200 dark:border-neutral-700 flex items-center gap-2 flex-wrap bg-white dark:bg-neutral-800">
        <Tooltip id="actionable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, actionableOnly: !activeFilters.actionableOnly, viewableOnly: false })}
            className={\`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors \${
              activeFilters.actionableOnly
                ? 'bg-amber-100 border-amber-300 text-amber-700'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
            }\`}
          >
            <Zap className="w-3.5 h-3.5" />
            {t(language, 'btn_actionable')}
          </button>
        </Tooltip>
        <Tooltip id="viewable">
          <button
            type="button"
            onClick={() => setFilters({ ...activeFilters, viewableOnly: !activeFilters.viewableOnly, actionableOnly: false })}
            className={\`inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border transition-colors \${
              activeFilters.viewableOnly
                ? 'bg-brand-100 border-brand-300 text-brand-700'
                : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-500 dark:text-neutral-400 hover:border-neutral-300 dark:hover:border-neutral-600'
            }\`}
          >
            <Eye className="w-3.5 h-3.5" />
            {t(language, 'btn_viewable')}
          </button>
        </Tooltip>
      </div>

      <div
        ref={viewportRef}
        onPointerDownCapture={handleViewportPointerDownCapture}
        onPointerMove={handleViewportPointerMove}
        onPointerUp={handleViewportPointerUp}
        onPointerCancel={handleViewportPointerCancel}
        onLostPointerCapture={() => stopPanning()}
        className={\`flex-1 overflow-auto bg-slate-50 dark:bg-neutral-900 \${isPanning ? 'cursor-grabbing' : 'cursor-grab'}\`}
      >`;

content = content.replace(targetReturn, newReturn);
fs.writeFileSync('src/components/views/TreeView.tsx', content);
