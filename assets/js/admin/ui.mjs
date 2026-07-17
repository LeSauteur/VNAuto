import { formatDate, formatDateTime, formatMoney } from './formatters.mjs';

export function el(tag, attributes = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'htmlFor') node.htmlFor = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'checked') node.checked = Boolean(value);
    else if (key === 'selected') node.selected = Boolean(value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

export const button = (label, action, options = {}) => el('button', {
  type: options.type || 'button',
  class: options.class || 'button button--ghost',
  dataset: { action, ...(options.dataset || {}) },
  disabled: options.disabled,
  title: options.title,
}, label);

export function icon(name) {
  const icons = {
    dashboard: '▦', appointments: '◷', clients: '◎', vehicles: '◇',
    'work-orders': '▤', payments: '₽', expenses: '↘', reports: '⌁',
    directories: '▥', employees: '♙', trash: '♲', settings: '⚙',
  };
  return icons[name] || '•';
}

export function viewHeader(eyebrow, title, description, actions = []) {
  return el('header', { class: 'view-header' },
    el('div', { class: 'view-heading' },
      el('span', { class: 'eyebrow', text: eyebrow }),
      el('h2', { text: title }),
      description ? el('p', { text: description }) : null,
    ),
    actions.length ? el('div', { class: 'view-actions' }, actions) : null,
  );
}

export function metric(label, value, note, tone = '') {
  return el('article', { class: `metric-card${tone ? ` metric-card--${tone}` : ''}` },
    el('div', { class: 'metric-label' }, label),
    el('strong', { class: 'metric-value', text: value }),
    el('small', { class: 'metric-note', text: note }),
  );
}

export function panel(title, content, options = {}) {
  return el('section', { class: `panel${options.class ? ` ${options.class}` : ''}` },
    title ? el('header', { class: 'panel-header' },
      el('div', null, el('h3', { text: title }), options.subtitle ? el('p', { text: options.subtitle }) : null),
      options.action || null,
    ) : null,
    el('div', { class: options.flush ? 'panel-body panel-body--flush' : 'panel-body' }, content),
  );
}

export function statusBadge(value, label) {
  const tones = {
    closed: 'green', delivered: 'green', ready: 'green', converted: 'green', paid: 'green',
    in_progress: 'blue', diagnostics: 'blue', confirmed: 'blue', arrived: 'blue',
    approval: 'amber', waiting: 'amber', planned: 'purple', partial: 'amber',
    cancelled: 'red', declined: 'red', no_show: 'red', overpaid: 'purple', refund: 'purple',
    draft: '', new: '', unpaid: 'red', quality: 'blue', approved: 'green',
  };
  return el('span', { class: `status${tones[value] ? ` status--${tones[value]}` : ''}`, text: label || value || '—' });
}

export function emptyState(title, text, action = null) {
  return el('div', { class: 'empty-state' },
    el('strong', { text: title }),
    el('p', { text }),
    action ? el('div', { style: { marginTop: '18px' } }, action) : null,
  );
}

export function textCell(primary, secondary = '') {
  return el('div', { class: 'primary-cell' },
    el('strong', { text: primary || '—' }),
    secondary ? el('small', { text: secondary }) : null,
  );
}

export function table(columns, rows) {
  const tableNode = el('table', { class: 'data-table' },
    el('thead', null, el('tr', null, columns.map((column) => el('th', { scope: 'col', text: column.label })))),
    el('tbody'),
  );
  const body = tableNode.tBodies[0];
  for (const row of rows) {
    body.append(el('tr', null, columns.map((column) => {
      const value = typeof column.render === 'function' ? column.render(row) : row[column.key];
      return el('td', { class: column.class || '' }, value instanceof Node ? value : String(value ?? '—'));
    })));
  }
  return el('div', { class: 'data-table-wrap' }, tableNode);
}

export function field(definition, value = '') {
  const id = `field-${definition.name}-${Math.random().toString(36).slice(2, 8)}`;
  const wrap = el('div', { class: `field${definition.wide ? ' field--wide' : ''}` });
  const label = el('label', {
    htmlFor: id,
    class: definition.required ? 'field-required' : '',
    text: definition.label,
  });
  let input;
  if (definition.type === 'textarea') {
    input = el('textarea', { id, name: definition.name, placeholder: definition.placeholder || '', required: definition.required, rows: definition.rows || 3 }, value || '');
  } else if (definition.type === 'select') {
    input = el('select', { id, name: definition.name, required: definition.required });
    if (definition.placeholder) input.append(el('option', { value: '', text: definition.placeholder }));
    for (const option of definition.options || []) {
      const normalized = Array.isArray(option) ? option : [option.value, option.label];
      input.append(el('option', { value: normalized[0], text: normalized[1], selected: String(normalized[0]) === String(value ?? '') }));
    }
  } else {
    input = el('input', {
      id,
      name: definition.name,
      type: definition.type || 'text',
      value: value ?? '',
      placeholder: definition.placeholder || '',
      required: definition.required,
      min: definition.min,
      max: definition.max,
      step: definition.step,
      inputmode: definition.inputmode,
      autocomplete: definition.autocomplete || 'off',
    });
  }
  wrap.append(label, input);
  if (definition.help) wrap.append(el('small', { text: definition.help }));
  return wrap;
}

export function checkbox(name, label, checked = false) {
  const id = `field-${name}-${Math.random().toString(36).slice(2, 8)}`;
  return el('label', { class: 'checkbox-field', htmlFor: id },
    el('input', { id, name, type: 'checkbox', checked }),
    el('span', { text: label }),
  );
}

export function formDataObject(form) {
  const output = {};
  const data = new FormData(form);
  for (const [key, value] of data.entries()) output[key] = typeof value === 'string' ? value.trim() : value;
  for (const input of form.querySelectorAll('input[type="checkbox"][name]')) output[input.name] = input.checked;
  return output;
}

export function showFieldErrors(form, errors = {}) {
  form.querySelectorAll('.field-error').forEach((node) => node.remove());
  form.querySelectorAll('[aria-invalid="true"]').forEach((node) => node.removeAttribute('aria-invalid'));
  const pairs = Object.entries(errors);
  for (const [name, message] of pairs) {
    const input = form.elements.namedItem(name);
    if (!(input instanceof HTMLElement)) continue;
    input.setAttribute('aria-invalid', 'true');
    input.closest('.field')?.append(el('small', { class: 'field-error', text: message }));
  }
  const first = form.querySelector('[aria-invalid="true"]');
  first?.focus();
  return !pairs.length;
}

export function toast(message, tone = '') {
  const region = document.querySelector('[data-toast-region]');
  if (!region) return;
  const node = el('div', { class: `toast${tone ? ` toast--${tone}` : ''}`, role: 'status' },
    el('span', { text: message }),
    el('button', { type: 'button', 'aria-label': 'Закрыть уведомление', onClick: () => node.remove() }, '×'),
  );
  region.append(node);
  window.setTimeout(() => node.remove(), 5200);
}

export function setPageMeta(title, eyebrow = 'Рабочая область') {
  document.querySelector('[data-page-title]').textContent = title;
  document.querySelector('[data-page-eyebrow]').textContent = eyebrow;
  document.title = `${title} — демо-панель VN-MASTERS`;
}

export function formatAudit(entry) {
  const names = {
    created: 'Создана запись', updated: 'Обновлена запись', deleted: 'Запись перемещена в корзину',
    restored: 'Запись восстановлена', demo_loaded: 'Загружен пример базы', database_reset: 'База очищена',
    backup_imported: 'Импортирована резервная копия', backup_exported: 'Экспортирована резервная копия',
    payment_created: 'Зарегистрирован платёж', refund_created: 'Зарегистрирован возврат',
  };
  return `${names[entry.action] || entry.action} · ${entry.details || entry.entity || ''}`;
}

export function dateRangeText(from, to) {
  if (from && to) return `${formatDate(from)} — ${formatDate(to)}`;
  if (from) return `с ${formatDate(from)}`;
  if (to) return `до ${formatDate(to)}`;
  return 'За всё время';
}

export { formatMoney, formatDate, formatDateTime };
