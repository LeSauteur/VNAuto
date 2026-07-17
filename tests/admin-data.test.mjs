import test from 'node:test';
import assert from 'node:assert/strict';
import { ENTITY_STORES, SCHEMA_VERSION } from '../assets/js/admin/constants.mjs';
import { createDemoBackup } from '../assets/js/admin/demo-data.mjs';
import { migrateBackup, migrationPlan } from '../assets/js/admin/migrations.mjs';
import { createDeletionBundle, restoreRecord } from '../assets/js/admin/record-lifecycle.mjs';
import { normalizePhone, normalizePlate, normalizeVin } from '../assets/js/admin/utils.mjs';
import { validateBackup, validateClient, validateVin } from '../assets/js/admin/validation.mjs';

test('демо-набор содержит только связанные сущности с устойчивыми ID', () => {
  const backup = createDemoBackup('2026-07-17');
  assert.equal(backup.schemaVersion, SCHEMA_VERSION);
  assert.equal(backup.data.clients.length, 8);
  assert.equal(backup.data.vehicles.length, 11);
  assert.equal(backup.data.workOrders.length, 12);
  assert.ok(backup.data.workOrderItems.length >= 24);
  assert.ok(backup.data.clients.every((client) => client.name.startsWith('Демо:')));
  assert.ok(backup.data.clients.every((client) => client.email.endsWith('.invalid')));
  const clients = new Set(backup.data.clients.map((row) => row.id));
  const vehicles = new Set(backup.data.vehicles.map((row) => row.id));
  const orders = new Set(backup.data.workOrders.map((row) => row.id));
  assert.ok(backup.data.vehicles.every((row) => clients.has(row.clientId)));
  assert.ok(backup.data.workOrders.every((row) => clients.has(row.clientId) && vehicles.has(row.vehicleId)));
  assert.ok(backup.data.workOrderItems.every((row) => orders.has(row.workOrderId)));
  assert.ok(backup.data.payments.every((row) => orders.has(row.workOrderId)));
});

test('резервная копия содержит каждый store и проходит строгую проверку', () => {
  const backup = createDemoBackup('2026-07-17');
  assert.deepEqual(Object.keys(backup.data).sort(), [...ENTITY_STORES].sort());
  assert.equal(validateBackup(backup).valid, true);
});

test('резервная копия v1 мигрируется до текущей схемы', () => {
  const source = createDemoBackup('2026-07-17');
  source.schemaVersion = 1;
  delete source.data.paymentMethods;
  const migrated = migrateBackup(source);
  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.ok(migrated.data.paymentMethods.length >= 1);
  assert.ok(migrated.data.clients.every((record) => record.recordVersion && record.localRevision));
  assert.deepEqual(migrationPlan().map((step) => step.to), [1, 2]);
});

test('неизвестная сущность и запись без ID блокируют импорт', () => {
  const source = createDemoBackup('2026-07-17');
  source.data.unknown = [];
  assert.equal(validateBackup(source).valid, false);
  delete source.data.unknown;
  source.data.clients[0] = { name: 'без id' };
  assert.equal(validateBackup(source).valid, false);
});

test('телефон, VIN и госномер нормализуются предсказуемо', () => {
  assert.equal(normalizePhone('8 (999) 123-45-67'), '79991234567');
  assert.equal(normalizeVin('vnmstrs1a2b300001'), 'VNMSTRS1A2B300001');
  assert.equal(normalizePlate(' а 123 вс 161 '), 'А123ВС161');
  assert.equal(validateVin('VNMSTRS1A2B300001').valid, true);
});

test('одинаковый телефон даёт предупреждение о дубле, но ID остаётся отдельным', () => {
  const existing = [{ id: 'c1', name: 'Клиент 1', normalizedPhone: '79991234567' }];
  const result = validateClient({ id: 'c2', name: 'Клиент 2', phoneDisplay: '+7 999 123-45-67' }, existing);
  assert.equal(result.valid, true);
  assert.equal(result.warnings.length, 1);
});

test('мягкое удаление создаёт видимую запись корзины, восстановление очищает deletedAt', () => {
  const record = { id: 'expense-1', recipient: 'Получатель', createdAt: '2026-07-01T10:00:00.000Z', updatedAt: '2026-07-01T10:00:00.000Z', localRevision: 1 };
  const { deleted, trash } = createDeletionBundle('expenses', record, '2026-07-17T10:00:00.000Z');
  assert.equal(deleted.deletedAt, '2026-07-17T10:00:00.000Z');
  assert.equal(trash.id, 'expenses:expense-1');
  assert.equal(trash.label, 'Получатель');
  assert.equal(trash.deletedAt, '2026-07-17T10:00:00.000Z');
  const restored = restoreRecord(deleted);
  assert.equal(restored.deletedAt, null);
  assert.ok(restored.localRevision > deleted.localRevision);
});
