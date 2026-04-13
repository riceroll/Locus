import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Format minutes as a compact string: 30 → "30m", 60 → "1h", 90 → "1h 30m" */
export function formatEstimate(min: number): string {
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export function formatDurationCompact(totalSeconds: number): string {
  if (totalSeconds <= 0) return '0m';
  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    if (totalMinutes === 0) return `${Math.max(1, totalSeconds)}s`;
    return `${totalMinutes}m`;
  }
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
