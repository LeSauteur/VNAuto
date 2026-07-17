import { DB_NAME, DB_VERSION, ENTITY_STORES } from '../constants.mjs';
import { createBackup, createRecord, nowIso, updateRecord, uuid } from '../utils.mjs';
import { migrateBackup } from '../migrations.mjs';
import { createDeletionBundle, restoreRecord } from '../record-lifecycle.mjs';
import { StorageAdapter } from './storage-adapter.mjs';

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Ошибка IndexedDB.'));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('Транзакция IndexedDB не выполнена.'));
    transaction.onabort = () => reject(transaction.error || new Error('Транзакция IndexedDB отменена.'));
  });
}

export class IndexedDbStorage extends StorageAdapter {
  constructor({ name = DB_NAME, version = DB_VERSION, upgrade } = {}) {
    super();
    this.name = name;
    this.version = version;
    this.upgrade = upgrade;
    this.db = null;
  }

  async init() {
    if (this.db) return this;
    this.db = await new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = (event) => this.upgrade?.(request.result, event.oldVersion, request.transaction);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Не удалось открыть локальную базу.'));
      request.onblocked = () => reject(new Error('Обновление базы заблокировано другой вкладкой.'));
    });
    this.db.onversionchange = () => {
      this.db.close();
      this.db = null;
    };
    return this;
  }

  assertEntity(entity) {
    if (!ENTITY_STORES.includes(entity)) throw new Error(`Неизвестное хранилище: ${entity}`);
  }

  async get(entity, id) {
    this.assertEntity(entity);
    await this.init();
    const tx = this.db.transaction(entity, 'readonly');
    return requestResult(tx.objectStore(entity).get(id));
  }

  async list(entity, options = {}) {
    this.assertEntity(entity);
    await this.init();
    const tx = this.db.transaction(entity, 'readonly');
    const records = await requestResult(tx.objectStore(entity).getAll());
    let output = options.includeDeleted || entity === 'trash' ? records : records.filter((record) => !record.deletedAt);
    if (options.filter) output = output.filter(options.filter);
    if (options.sortBy) {
      const direction = options.direction === 'asc' ? 1 : -1;
      output.sort((a, b) => String(a[options.sortBy] ?? '').localeCompare(String(b[options.sortBy] ?? '')) * direction);
    }
    return output;
  }

  async create(entity, data) {
    this.assertEntity(entity);
    const record = createRecord(data);
    await this.transaction([{ type: 'create', entity, record }]);
    return record;
  }

  async update(entity, id, patch) {
    this.assertEntity(entity);
    const existing = await this.get(entity, id);
    if (!existing) throw new Error('Запись не найдена.');
    const record = updateRecord(existing, patch);
    await this.transaction([{ type: 'put', entity, record }]);
    return record;
  }

  async softDelete(entity, id) {
    this.assertEntity(entity);
    const record = await this.get(entity, id);
    if (!record || record.deletedAt) return record;
    const { deleted, trash: trashRecord } = createDeletionBundle(entity, record);
    await this.transaction([
      { type: 'put', entity, record: deleted },
      { type: 'put', entity: 'trash', record: trashRecord },
    ]);
    return deleted;
  }

  async restore(entity, id) {
    this.assertEntity(entity);
    const record = await this.get(entity, id);
    if (!record) throw new Error('Запись для восстановления не найдена.');
    const restored = restoreRecord(record);
    await this.transaction([
      { type: 'put', entity, record: restored },
      { type: 'delete', entity: 'trash', id: `${entity}:${id}` },
    ]);
    return restored;
  }

  async remove(entity, id) {
    this.assertEntity(entity);
    await this.transaction([
      { type: 'delete', entity, id },
      ...(entity === 'trash' ? [] : [{ type: 'delete', entity: 'trash', id: `${entity}:${id}` }]),
    ]);
  }

  async transaction(operations = []) {
    await this.init();
    if (!operations.length) return [];
    const stores = [...new Set(operations.map((operation) => operation.entity))];
    stores.forEach((entity) => this.assertEntity(entity));
    const tx = this.db.transaction(stores, 'readwrite');
    const results = [];
    for (const operation of operations) {
      const store = tx.objectStore(operation.entity);
      if (operation.type === 'create') results.push(requestResult(store.add(operation.record)));
      else if (operation.type === 'put' || operation.type === 'update') results.push(requestResult(store.put(operation.record)));
      else if (operation.type === 'delete') results.push(requestResult(store.delete(operation.id)));
      else if (operation.type === 'clear') results.push(requestResult(store.clear()));
      else throw new Error(`Неизвестная операция транзакции: ${operation.type}`);
    }
    await transactionDone(tx);
    await Promise.all(results);
    return operations.map((operation) => operation.record || operation.id);
  }

  async exportDatabase() {
    const data = {};
    for (const entity of ENTITY_STORES) data[entity] = await this.list(entity, { includeDeleted: true });
    const settings = Object.fromEntries((data.settings || []).map((entry) => [entry.id, entry.value]));
    return createBackup(data, settings);
  }

  async importDatabase(input) {
    const backup = migrateBackup(input);
    await this.init();
    const tx = this.db.transaction(ENTITY_STORES, 'readwrite');
    for (const entity of ENTITY_STORES) {
      const store = tx.objectStore(entity);
      store.clear();
      for (const record of backup.data[entity] || []) store.put(record);
    }
    await transactionDone(tx);
    return backup;
  }

  async resetDatabase() {
    await this.init();
    const tx = this.db.transaction(ENTITY_STORES, 'readwrite');
    ENTITY_STORES.forEach((entity) => tx.objectStore(entity).clear());
    await transactionDone(tx);
  }

  async getSetting(id, fallback = null) {
    const record = await this.get('settings', id);
    return record ? record.value : fallback;
  }

  async setSetting(id, value) {
    const existing = await this.get('settings', id);
    const record = existing
      ? updateRecord(existing, { value })
      : createRecord({ id, value }, id);
    await this.transaction([{ type: 'put', entity: 'settings', record }]);
    return value;
  }

  async log(action, entity = '', entityId = '', details = '') {
    return this.create('auditLog', {
      action,
      entity,
      entityId,
      details,
      createdAt: nowIso(),
      demoOnly: true,
    });
  }

  async clearTrash() {
    const trash = await this.list('trash', { includeDeleted: true });
    const operations = trash.flatMap((entry) => [
      { type: 'delete', entity: entry.entity, id: entry.sourceId },
      { type: 'delete', entity: 'trash', id: entry.id },
    ]);
    if (operations.length) await this.transaction(operations);
  }

  async ensureInstallationId() {
    let id = await this.getSetting('installationId');
    if (!id) {
      id = uuid();
      await this.setSetting('installationId', id);
    }
    return id;
  }
}
