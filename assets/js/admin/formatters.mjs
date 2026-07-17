const rublesFormatter = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat('ru-RU', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});

export function formatMoney(cents = 0) {
  const safe = Number.isFinite(Number(cents)) ? Math.trunc(Number(cents)) : 0;
  return rublesFormatter.format(safe / 100);
}

export function parseMoney(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return value;
  const normalized = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/(?:₽|руб(?:\.|ля|лей)?|р\.)/gi, '')
    .replace(',', '.');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : 0;
}

export function formatQuantityMilli(value = 0) {
  return numberFormatter.format((Number(value) || 0) / 1000);
}

export function parseQuantityMilli(value) {
  const numeric = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(numeric) ? Math.max(0, Math.round(numeric * 1000)) : 0;
}

export function formatDate(value, options = { day: '2-digit', month: '2-digit', year: 'numeric' }) {
  if (!value) return '—';
  const source = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU', options);
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function formatPhone(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const normalized = digits.length === 10 ? `7${digits}` : digits;
  if (normalized.length !== 11) return value || '—';
  return `+${normalized[0]} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`;
}

export function pluralize(count, forms) {
  const mod10 = Math.abs(count) % 10;
  const mod100 = Math.abs(count) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
