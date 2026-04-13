import { create } from 'zustand';
import { getDb } from '../db';
import { v4 as uuidv4 } from 'uuid';

export interface TimeEntry {
  id: string;
  task_id: string;
  start_time: number;
  end_time: number | null;
  duration: number | null;
}

interface TimerState {
  activeTaskId: string | null;
  activeTaskTitle: string | null;
  activeEntryId: string | null;
  startTime: number | null;
  elapsed: number; // seconds
  isRunning: boolean;
  intervalId: number | null;

  startTimer: (taskId: string, taskTitle: string) => Promise<void>;
  stopTimer: () => Promise<void>;
  tick: () => void;

  getEntriesForTask: (taskId: string) => Promise<TimeEntry[]>;
  getAllEntries: () => Promise<TimeEntry[]>;
  addManualEntry: (taskId: string, durationMin: number) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  updateEntry: (id: string, fields: { start_time?: number; end_time?: number }) => Promise<void>;
  createEntry: (taskId: string, startTime: number, endTime: number) => Promise<string>;
}

const emitTimeEntriesChanged = () => {
  window.dispatchEvent(new CustomEvent('time-entries-changed'));
};

export const useTimerStore = create<TimerState>((set, get) => ({
  activeTaskId: null,
  activeTaskTitle: null,
  activeEntryId: null,
  startTime: null,
  elapsed: 0,
  isRunning: false,
  intervalId: null,

  startTimer: async (taskId, taskTitle) => {
    const state = get();
    // If already running, stop current timer first
    if (state.isRunning) {
      await get().stopTimer();
    }

    const db = await getDb();
    const entryId = uuidv4();
    const now = Date.now();

    await db.execute(
      'INSERT INTO time_entries (id, task_id, start_time, end_time, duration) VALUES ($1, $2, $3, $4, $5)',
      [entryId, taskId, now, null, null]
    );
    emitTimeEntriesChanged();

    // Start JS interval for live elapsed counter
    const intervalId = window.setInterval(() => {
      get().tick();
    }, 1000);

    set({
      activeTaskId: taskId,
      activeTaskTitle: taskTitle,
      activeEntryId: entryId,
      startTime: now,
      elapsed: 0,
      isRunning: true,
      intervalId,
    });
  },

  stopTimer: async () => {
    const state = get();
    if (!state.isRunning || !state.activeEntryId || !state.startTime) return;

    if (state.intervalId) {
      window.clearInterval(state.intervalId);
    }

    const now = Date.now();
    const durationSec = Math.round((now - state.startTime) / 1000);

    const db = await getDb();
    await db.execute(
      'UPDATE time_entries SET end_time = $1, duration = $2 WHERE id = $3',
      [now, durationSec, state.activeEntryId]
    );
    emitTimeEntriesChanged();

    set({
      activeTaskId: null,
      activeTaskTitle: null,
      activeEntryId: null,
      startTime: null,
      elapsed: 0,
      isRunning: false,
      intervalId: null,
    });
  },

  tick: () => {
    const state = get();
    if (state.startTime) {
      set({ elapsed: Math.round((Date.now() - state.startTime) / 1000) });
    }
  },

  getEntriesForTask: async (taskId) => {
    const db = await getDb();
    return await db.select<TimeEntry[]>(
      'SELECT * FROM time_entries WHERE task_id = $1 ORDER BY start_time DESC',
      [taskId]
    );
  },

  getAllEntries: async () => {
    const db = await getDb();
    return await db.select<TimeEntry[]>(
      'SELECT * FROM time_entries ORDER BY start_time DESC'
    );
  },

  addManualEntry: async (taskId, durationMin) => {
    const db = await getDb();
    const id = uuidv4();
    const durationSec = Math.round(durationMin * 60);
    const endTime = Date.now();
    const startTime = endTime - durationSec * 1000;
    await db.execute(
      'INSERT INTO time_entries (id, task_id, start_time, end_time, duration) VALUES ($1, $2, $3, $4, $5)',
      [id, taskId, startTime, endTime, durationSec]
    );
    emitTimeEntriesChanged();
  },

  deleteEntry: async (id) => {
    const db = await getDb();
    await db.execute('DELETE FROM time_entries WHERE id = $1', [id]);
    emitTimeEntriesChanged();
  },

  updateEntry: async (id, fields) => {
    const db = await getDb();
    const existing = await db.select<TimeEntry[]>(
      'SELECT * FROM time_entries WHERE id = $1',
      [id],
    );
    if (!existing[0]) return;
    const newStart = fields.start_time ?? existing[0].start_time;
    const newEnd = fields.end_time ?? existing[0].end_time;
    const duration = newEnd !== null ? Math.round((newEnd - newStart) / 1000) : null;
    await db.execute(
      'UPDATE time_entries SET start_time=$1, end_time=$2, duration=$3 WHERE id=$4',
      [newStart, newEnd, duration, id],
    );
    emitTimeEntriesChanged();
  },

  createEntry: async (taskId, startTime, endTime) => {
    const db = await getDb();
    const id = uuidv4();
    const duration = Math.round((endTime - startTime) / 1000);
    await db.execute(
      'INSERT INTO time_entries (id, task_id, start_time, end_time, duration) VALUES ($1,$2,$3,$4,$5)',
      [id, taskId, startTime, endTime, duration],
    );
    emitTimeEntriesChanged();
    return id;
  },
}));

export const formatDuration = (totalSeconds: number): string => {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};
