import { DEFAULT_PAYMENT_METHODS, ENTITY_STORES, SCHEMA_VERSION } from './constants.mjs';
import { clone, createRecord, nowIso, uuid } from './utils.mjs';
import { validateBackup } from './validation.mjs';

const V1_STORES = [
  'appointments', 'clients', 'vehicles', 'workOrders', 'workOrderItems', 'payments',
  'expenses', 'employees', 'servicesCatalog', 'partsCatalog', 'suppliers',
  'expenseCategories', 'auditLog', 'settings', 'trash',
];

const INDEXES = {
  appointments: [['date', 'date'], ['clientId', 'clientId'], ['status', 'status']],
  clients: [['normalizedPhone', 'normalizedPhone'], ['updatedAt', 'updatedAt']],
  vehicles: [['clientId', 'clientId'], ['vin', 'vin'], ['plate', 'plate']],
  workOrders: [['number', 'number'], ['clientId', 'clientId'], ['vehicleId', 'vehicleId'], ['status', 'status'], ['acceptedDate', 'acceptedDate']],
  workOrderItems: [['workOrderId', 'workOrderId'], ['type', 'type']],
  payments: [['workOrderId', 'workOrderId'], ['date', 'date'], ['type', 'type']],
  expenses: [['date', 'date'], ['workOrderId', 'workOrderId'], ['category', 'category']],
  employees: [['name', 'name'], ['active', 'active']],
  servicesCatalog: [['name', 'name'], ['category', 'category'], ['active', 'active']],
  partsCatalog: [['name', 'name'], ['sku', 'sku'], ['supplierId', 'supplierId']],
  suppliers: [['name', 'name']],
  expenseCategories: [['name', 'name'], ['active', 'active']],
  paymentMethods: [['name', 'name'], ['active', 'active']],
  auditLog: [['createdAt', 'createdAt'], ['entity', 'entity'], ['action', 'action']],
  settings: [['updatedAt', 'updatedAt']],
  trash: [['entity', 'entity'], ['deletedAt', 'deletedAt']],
};

function ensureStore(database, name) {
  return database.objectStoreNames.contains(name)
    ? null
    : database.createObjectStore(name, { keyPath: 'id' });
}

function ensureIndexes(store, name) {
  for (const [indexName, keyPath] of INDEXES[name] || []) {
    if (!store.indexNames.contains(indexName)) store.createIndex(indexName, keyPath, { unique: false });
  }
}

export function upgradeDatabase(database, oldVersion, transaction) {
  if (oldVersion < 1) {
    V1_STORES.forEach((name) => {
      const store = ensureStore(database, name);
      if (store) ensureIndexes(store, name);
    });
  }

  if (oldVersion < 2) {
    const paymentMethods = ensureStore(database, 'paymentMethods');
    if (paymentMethods) {
      ensureIndexes(paymentMethods, 'paymentMethods');
      DEFAULT_PAYMENT_METHODS.forEach((name) => paymentMethods.put(createRecord({ name, active: true, demo: true })));
    }
    for (const name of V1_STORES) {
      const store = transaction.objectStore(name);
      ensureIndexes(store, name);
    }
  }
}

function normalizeRecord(record) {
  const timestamp = nowIso();
  return {
    ...clone(record),
    id: record.id || uuid(),
    recordVersion: Number(record.recordVersion) || 1,
    localRevision: Number(record.localRevision) || 1,
    createdAt: record.createdAt || timestamp,
    updatedAt: record.updatedAt || timestamp,
    deletedAt: record.deletedAt || null,
  };
}

export function migrateBackup(input) {
  const backup = clone(input);
  const validation = validateBackup(backup);
  if (!validation.valid) throw new Error(validation.errors.join(' '));

  if (backup.schemaVersion === 1) {
    backup.data.paymentMethods = backup.data.paymentMethods || DEFAULT_PAYMENT_METHODS.map((name) => createRecord({ name, active: true, demo: true }));
    backup.schemaVersion = 2;
  }

  for (const entity of ENTITY_STORES) {
    backup.data[entity] = (backup.data[entity] || []).map(normalizeRecord);
  }
  backup.schemaVersion = SCHEMA_VERSION;
  backup.migratedAt = nowIso();
  return backup;
}

export function migrationPlan() {
  return [
    { from: 0, to: 1, description: 'Создание основных хранилищ сущностей.' },
    { from: 1, to: 2, description: 'Отдельный справочник способов оплаты и индексы связей.' },
  ];
}

