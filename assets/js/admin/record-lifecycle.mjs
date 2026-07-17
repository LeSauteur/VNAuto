import { createRecord, nowIso, updateRecord } from './utils.mjs';

export function createDeletionBundle(entity, record, deletedAt = nowIso()) {
  const deleted = updateRecord(record, { deletedAt });
  const trash = createRecord({
    id: `${entity}:${record.id}`,
    entity,
    sourceId: record.id,
    label: record.name || record.number || record.title || record.recipient || record.id,
    snapshot: record,
    deletedAt,
  }, `${entity}:${record.id}`);
  return { deleted, trash };
}

export function restoreRecord(record) {
  return updateRecord(record, { deletedAt: null });
}
