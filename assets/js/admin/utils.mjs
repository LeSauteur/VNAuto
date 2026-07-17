import { SCHEMA_VERSION } from './constants.mjs';

export function uuid() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) globalThis.crypto.getRandomValues(bytes);
  else for (let index = 0; index < bytes.length; index += 1) bytes[index] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const nowIso = () => new Date().toISOString();
export const todayIso = () => {
  const date = new Date();
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
};

export function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return date.toISOString().slice(0, 10);
}

export function createRecord(data = {}, id = data.id || uuid()) {
  const timestamp = nowIso();
  return {
    ...data,
    id,
    recordVersion: Number(data.recordVersion) || 1,
    localRevision: Number(data.localRevision) || 1,
    createdAt: data.createdAt || timestamp,
    updatedAt: timestamp,
    deletedAt: data.deletedAt || null,
  };
}

export function updateRecord(record, patch = {}) {
  return {
    ...record,
    ...patch,
    id: record.id,
    recordVersion: Number(record.recordVersion) || 1,
    localRevision: (Number(record.localRevision) || 0) + 1,
    createdAt: record.createdAt || nowIso(),
    updatedAt: nowIso(),
  };
}

export function normalizePhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `7${digits}`;
  if (digits.length === 11 && digits.startsWith('8')) return `7${digits.slice(1)}`;
  return digits;
}

export function normalizeVin(value) {
  return String(value ?? '').toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, '').slice(0, 17);
}

export function normalizePlate(value) {
  return String(value ?? '').toUpperCase().replace(/\s+/g, '').slice(0, 12);
}

export function normalizeText(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeSearch(value) {
  return String(value ?? '').toLocaleLowerCase('ru-RU').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function isSamePhone(left, right) {
  const a = normalizePhone(left);
  const b = normalizePhone(right);
  return Boolean(a && b && a === b);
}

export function debounce(callback, delay = 350) {
  let timer = 0;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => callback(...args), delay);
  };
}

export function makeOrderNumber(date = todayIso()) {
  const compactDate = date.replaceAll('-', '');
  return `VN-${compactDate}-${uuid().replaceAll('-', '').slice(0, 4).toUpperCase()}`;
}

export function toCsv(rows, columns) {
  const escapeCell = (value) => {
    const normalized = value == null ? '' : String(value);
    return `"${normalized.replaceAll('"', '""')}"`;
  };
  const header = columns.map((column) => escapeCell(column.label)).join(';');
  const body = rows.map((row) => columns.map((column) => escapeCell(typeof column.value === 'function' ? column.value(row) : row[column.value])).join(';'));
  return `\uFEFF${[header, ...body].join('\r\n')}`;
}

export function downloadFile(content, filename, type = 'application/octet-stream') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function backupFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return `VN-MASTERS-demo-backup-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${pad(date.getHours())}-${pad(date.getMinutes())}.json`;
}

export function backupSummary(data = {}) {
  return Object.fromEntries(Object.entries(data).map(([entity, records]) => [entity, Array.isArray(records) ? records.length : 0]));
}

export function createBackup(data, settings = {}) {
  return {
    product: 'VN-MASTERS demo admin',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: nowIso(),
    demoOnly: true,
    data,
    settings,
    summary: backupSummary(data),
  };
}

export function clone(value) {
  if (globalThis.structuredClone) return globalThis.structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

