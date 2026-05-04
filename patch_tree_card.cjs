const fs = require('fs');
let content = fs.readFileSync('src/components/views/tree/TreeCard.tsx', 'utf8');

// 1. imports
content = content.replace(
  "import { ChevronRight, AlertCircle, Calendar, Plus, Check } from 'lucide-react';",
  "import { ChevronRight, AlertCircle, Calendar, Plus, Check, Play, Square } from 'lucide-react';\nimport { useTimerStore } from '../../../store/useTimerStore';"
);

// 2. Add useTimerStore inside TreeCard
content = content.replace(
  "const { updateTask, addTask, updateTaskStatus } = useTaskStore();",
  "const { updateTask, addTask, updateTaskStatus } = useTaskStore();\n  const { activeTaskId, isRunning, startTimer, stopTimer } = useTimerStore();\n  const isActive = isRunning && activeTaskId === task.id;"
);

// 3. Fix text wrapping
content = content.replace(
  "className={`text-sm font-semibold truncate leading-tight text-left hover:text-brand-600 hover:underline transition ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-100'}`}",
  "className={`text-sm font-semibold line-clamp-3 leading-tight break-words text-left hover:text-brand-600 hover:underline transition ${isDone ? 'text-neutral-500 line-through' : 'text-neutral-800 dark:text-neutral-100'}`}"
);

// 4. Add play button
const targetButtonBlock = `<div className="flex items-center gap-1 shrink-0">`;
const newButtonBlock = `<div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation();
            }}
            className={\`shrink-0 btn-icon min-w-[24px] min-h-[24px] flex items-center justify-center \${
              isActive
                ? 'bg-red-50 dark:bg-red-900/30 text-red-500'
                : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-400 dark:text-neutral-500 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/30'
            }\`}
            title={isActive ? 'Stop timer' : 'Start timer'}
            onClick={(e) => { e.stopPropagation(); isActive ? stopTimer() : startTimer(task.id, task.title); }}
          >
            {isActive ? <Square className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
          </button>`;

content = content.replace(targetButtonBlock, newButtonBlock);

fs.writeFileSync('src/components/views/tree/TreeCard.tsx', content);
