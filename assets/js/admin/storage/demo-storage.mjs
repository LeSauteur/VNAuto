import { IndexedDbStorage } from './indexeddb-storage.mjs';
import { upgradeDatabase } from '../migrations.mjs';

export function createDemoStorage(options = {}) {
  return new IndexedDbStorage({ ...options, upgrade: upgradeDatabase });
}

