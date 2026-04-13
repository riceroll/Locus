import { closestCorners, closestCenter, type CollisionDetection } from '@dnd-kit/core';

export const COLOR_PRESETS = [
  '#f87171', '#fb923c', '#fbbf24', '#4ade80', '#34d399', '#2dd4bf', '#22d3ee',
  '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185',
  '#94a3b8', '#78716c', '#a3a3a3', '#6366f1', '#0ea5e9', '#10b981', '#f59e0b',
];

export function hexToHeaderBg(hex: string): string {
  return `${hex}18`;
}

export function hexToCountBg(hex: string): string {
  return `${hex}22`;
}

export const typedCollisionDetection: CollisionDetection = (args) => {
  const type = args.active.data.current?.type;
  if (type === 'column') {
    return closestCenter({
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (c) => c.data.current?.type === 'column' && c.data.current?.sortable,
      ),
    });
  }
  return closestCorners(args);
};

export const DropLine = ({ active }: { active: boolean }) => (
  active ? (
    <div className="h-0.5 rounded-full bg-brand-500 -my-1" />
  ) : null
);

export const ColumnDropLine = ({ active }: { active: boolean }) => (
  <div
    className={`transition-all duration-150 self-stretch flex items-center shrink-0 ${
      active ? 'w-1 mx-0' : 'w-0 mx-0'
    }`}
  >
    <div
      className={`h-full rounded-full transition-all duration-150 ${
        active ? 'w-0.5 bg-brand-500 opacity-100' : 'w-0 opacity-0'
      }`}
    />
  </div>
);
