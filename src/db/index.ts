import Database from '@tauri-apps/plugin-sql';
import { runMigrations } from './init';

let dbInstance: Awaited<ReturnType<typeof Database.load>> | null = null;

export const getDb = async () => {
  if (!dbInstance) {
    dbInstance = await Database.load('sqlite:jaxtracker.db');
    await runMigrations(dbInstance);
  }
  return dbInstance;
};
