import { APPROVAL_STATUSES, ITEM_TYPES, ORDER_STATUSES } from '../constants.mjs';
import { calculateOrder, calculatePaymentState, PAYMENT_STATUS_LABELS } from '../calculations.mjs';
import { parseMoney, parseQuantityMilli } from '../formatters.mjs';
import { makeOrderNumber, normalizeSearch, todayIso, uuid } from '../utils.mjs';
import { button, checkbox, emptyState, field, formatDate, formatMoney, panel, statusBadge, table, textCell, viewHeader, el } from '../ui.mjs';

const orderLabels = Object.fromEntries(ORDER_STATUSES);
const approvalLabels = Object.fromEntries(APPROVAL_STATUSES);

export function renderWorkOrders(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const status = filters.status || '';
  const rows = state.data.workOrders
    .filter((order) => (!status || order.status === status) && (!query || normalizeSearch(`${order.number} ${state.clientName(order.clientId)} ${state.vehicleName(order.vehicleId)} ${order.complaint}`).includes(query)))
    .sort((a, b) => String(b.acceptedDate || b.createdAt).localeCompare(String(a.acceptedDate || a.createdAt)))
    .map((order) => {
      const metrics = calculateOrder(order, state.by('workOrderItems', 'workOrderId', order.id));
      const payment = calculatePaymentState(metrics.totalCents, state.by('payments', 'workOrderId', order.id));
      return { ...order, metrics, payment };
    });

  const toolbar = el('div', { class: 'toolbar' },
    el('label', { class: 'toolbar-search' },
      el('span', { text: '⌕', 'aria-hidden': 'true' }),
      el('input', { type: 'search', value: filters.query || '', placeholder: 'Номер, клиент, автомобиль, жалоба', dataset: { listSearch: 'work-orders' }, 'aria-label': 'Поиск заказ-нарядов' }),
    ),
    selectFilter('work-order-status-filter', ORDER_STATUSES, status),
    button('CSV', 'export-work-orders-csv', { class: 'button button--ghost button--compact' }),
  );

  const content = rows.length ? table([
    { label: 'Заказ-наряд', render: (row) => el('div', { class: 'primary-cell' },
      el('button', { class: 'row-link', type: 'button', dataset: { action: 'edit-work-order', id: row.id }, text: row.number }),
      el('small', { text: formatDate(row.acceptedDate) }),
    ) },
    { label: 'Клиент и автомобиль', render: (row) => textCell(state.clientName(row.clientId), state.vehicleName(row.vehicleId)) },
    { label: 'Статус', render: (row) => statusBadge(row.status, orderLabels[row.status]) },
    { label: 'Согласование', render: (row) => statusBadge(row.approvalStatus, approvalLabels[row.approvalStatus]) },
    { label: 'Сумма', render: (row) => formatMoney(row.metrics.totalCents) },
    { label: 'Оплата', render: (row) => statusBadge(row.payment.status, PAYMENT_STATUS_LABELS[row.payment.status]) },
    { label: '', class: 'table-actions', render: (row) => el('div', { class: 'table-actions' },
      button('Оплата', 'create-payment-for-order', { class: 'table-action', dataset: { id: row.id } }),
      button('Изменить', 'edit-work-order', { class: 'table-action', dataset: { id: row.id } }),
      button('Удалить', 'delete-work-order', { class: 'table-action table-action--danger', dataset: { id: row.id } }),
    ) },
  ], rows) : emptyState('Заказ-нарядов пока нет', 'Создайте документ: данные клиента и автомобиля, жалоба, работы, запчасти и согласование будут храниться связанно.',
    button('Создать заказ', 'create-work-order', { class: 'button button--primary' }));

  return el('div', { class: 'view-stack' },
    viewHeader('Основной рабочий документ', 'Заказ-наряды', 'Редактирование не создаёт повторных визитов и не увеличивает суммы: итоги всегда вычисляются из актуальных строк и платежей.', [
      button('＋ Новый заказ', 'create-work-order', { class: 'button button--primary' }),
    ]),
    panel('Реестр заказов', el('div', null, toolbar, content), { flush: true, subtitle: `${rows.length} документов` }),
  );
}

export function buildWorkOrderEditor(state, existing = null, draft = null) {
  const defaults = {
    number: makeOrderNumber(),
    acceptedDate: todayIso(),
    plannedReadyDate: '',
    status: 'draft',
    approvalStatus: 'not_requested',
    discountBps: 0,
    clientId: '',
    vehicleId: '',
    employeeId: '',
  };
  const source = draft?.order || { ...defaults, ...(existing || {}) };
  const sourceItems = draft?.items || (existing
    ? [...state.by('workOrderItems', 'workOrderId', existing.id)].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0))
    : []);
  const form = el('form', { id: 'work-order-form', dataset: { workOrderForm: 'true', recordId: existing?.id || '' } });

  const clientOptions = state.data.clients.map((client) => [client.id, `${client.name} · ${client.phoneDisplay || 'без телефона'}`]);
  const vehicleOptions = state.data.vehicles.map((vehicle) => [vehicle.id, `${vehicle.make} ${vehicle.model} · ${vehicle.plate || 'без номера'} · ${state.clientName(vehicle.clientId)}`]);
  const employeeOptions = state.data.employees.filter((employee) => employee.active !== false).map((employee) => [employee.id, `${employee.name} · ${employee.role}`]);

  const general = el('section', { class: 'dialog-section' },
    el('h3', { class: 'dialog-section-title', text: 'Документ и участники' }),
    el('div', { class: 'form-grid form-grid--three' },
      field({ name: 'number', label: 'Номер заказа', required: true }, source.number),
      field({ name: 'acceptedDate', label: 'Дата приёма', type: 'date', required: true }, source.acceptedDate),
      field({ name: 'plannedReadyDate', label: 'Плановая готовность', type: 'date' }, source.plannedReadyDate),
      field({ name: 'clientId', label: 'Клиент', type: 'select', required: true, placeholder: 'Выберите клиента', options: clientOptions }, source.clientId),
      field({ name: 'vehicleId', label: 'Автомобиль', type: 'select', required: true, placeholder: 'Выберите автомобиль', options: vehicleOptions }, source.vehicleId),
      field({ name: 'employeeId', label: 'Ответственный', type: 'select', placeholder: 'Не назначен', options: employeeOptions }, source.employeeId),
      field({ name: 'status', label: 'Статус работ', type: 'select', options: ORDER_STATUSES }, source.status),
      field({ name: 'approvalStatus', label: 'Статус согласования', type: 'select', options: APPROVAL_STATUSES }, source.approvalStatus),
      field({ name: 'mileage', label: 'Пробег, км', type: 'number', min: 0, step: 1 }, source.mileage || ''),
    ),
  );

  const communication = el('section', { class: 'dialog-section' },
    el('h3', { class: 'dialog-section-title', text: 'Обращение, диагностика и результат' }),
    el('div', { class: 'form-grid' },
      field({ name: 'complaint', label: 'Жалоба или задача клиента', type: 'textarea', required: true, wide: true, placeholder: 'Опишите словами клиента, что происходит с автомобилем' }, source.complaint),
      field({ name: 'diagnosis', label: 'Результат диагностики', type: 'textarea', wide: true }, source.diagnosis),
      field({ name: 'recommendations', label: 'Рекомендации клиенту', type: 'textarea' }, source.recommendations),
      field({ name: 'internalNote', label: 'Внутренняя заметка', type: 'textarea' }, source.internalNote),
    ),
  );

  const itemsWrap = el('div', { class: 'work-items', dataset: { workItems: 'true' } });
  (sourceItems.length ? sourceItems : [blankItem()]).forEach((item) => itemsWrap.append(buildItemRow(item)));
  const itemsSection = el('section', { class: 'dialog-section' },
    el('div', { class: 'panel-header', style: { padding: '0 0 14px', borderBottom: '0', minHeight: '0' } },
      el('div', null, el('h3', { class: 'dialog-section-title', style: { margin: '0' }, text: 'Работы, запчасти и материалы' })),
      button('＋ Добавить строку', 'work-item-add', { class: 'button button--ghost button--compact' }),
    ),
    itemsWrap,
    el('div', { class: 'form-grid', style: { marginTop: '12px' } },
      field({ name: 'discountPercent', label: 'Скидка на заказ, %', type: 'number', min: 0, max: 100, step: .01 }, Number(source.discountBps || 0) / 100),
      el('div', { class: 'order-total-strip' }, el('span', { text: 'Итого по заказу' }), el('strong', { dataset: { orderTotal: 'true' }, text: formatMoney(0) })),
    ),
  );

  form.append(general, communication, itemsSection);

  const recalculate = () => {
    const value = readWorkOrderForm(form);
    const total = calculateOrder(value.order, value.items).totalCents;
    form.querySelector('[data-order-total]').textContent = formatMoney(total);
  };
  form.addEventListener('input', recalculate);
  form.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-action]');
    if (!trigger) return;
    if (trigger.dataset.action === 'work-item-add') {
      event.preventDefault();
      itemsWrap.append(buildItemRow(blankItem()));
      recalculate();
    }
    if (trigger.dataset.action === 'work-item-remove') {
      event.preventDefault();
      trigger.closest('.work-item')?.remove();
      if (!itemsWrap.children.length) itemsWrap.append(buildItemRow(blankItem()));
      recalculate();
    }
  });
  recalculate();
  return form;
}

export function readWorkOrderForm(form) {
  const get = (name) => form.elements.namedItem(name);
  const order = {
    number: get('number')?.value.trim(),
    acceptedDate: get('acceptedDate')?.value,
    plannedReadyDate: get('plannedReadyDate')?.value,
    clientId: get('clientId')?.value,
    vehicleId: get('vehicleId')?.value,
    employeeId: get('employeeId')?.value,
    status: get('status')?.value,
    approvalStatus: get('approvalStatus')?.value,
    mileage: Math.max(0, Math.trunc(Number(get('mileage')?.value) || 0)),
    complaint: get('complaint')?.value.trim(),
    diagnosis: get('diagnosis')?.value.trim(),
    recommendations: get('recommendations')?.value.trim(),
    internalNote: get('internalNote')?.value.trim(),
    discountBps: Math.max(0, Math.min(10_000, Math.round((Number(get('discountPercent')?.value) || 0) * 100))),
  };
  const items = [...form.querySelectorAll('.work-item')].map((row, index) => {
    const type = row.querySelector('[name="itemType"]').value;
    const costCents = parseMoney(row.querySelector('[name="itemCost"]').value);
    return {
      id: row.dataset.id || uuid(),
      type,
      name: row.querySelector('[name="itemName"]').value.trim(),
      quantityMilli: parseQuantityMilli(row.querySelector('[name="itemQuantity"]').value),
      unit: type === 'work' ? 'нормо-час' : 'шт.',
      unitPriceCents: parseMoney(row.querySelector('[name="itemPrice"]').value),
      purchasePriceCents: ['part', 'material'].includes(type) ? costCents : 0,
      laborCostCents: type === 'work' ? costCents : 0,
      directCostCents: type === 'extra' ? costCents : 0,
      discountBps: 0,
      approved: row.querySelector('[name="itemApproved"]').checked,
      completed: row.querySelector('[name="itemCompleted"]').checked,
      sortOrder: index * 10,
    };
  });
  return { order, items };
}

function buildItemRow(item) {
  const type = item.type || 'work';
  const directCost = type === 'work' ? item.laborCostCents : ['part', 'material'].includes(type) ? item.purchasePriceCents : item.directCostCents;
  const row = el('div', { class: 'work-item', dataset: { id: item.id || '' } },
    compactField('itemName', 'Наименование', item.name || '', 'text'),
    compactSelect('itemType', 'Тип', ITEM_TYPES, type),
    compactField('itemQuantity', 'Количество', quantityInput(item.quantityMilli || 1000), 'number', .001),
    compactField('itemPrice', 'Цена, ₽', moneyInput(item.unitPriceCents), 'number', .01),
    compactField('itemCost', 'Себестоимость, ₽', moneyInput(directCost), 'number', .01),
    el('div', { style: { display: 'grid', gap: '5px' } },
      checkbox('itemApproved', 'Согласовано', item.approved !== false),
      checkbox('itemCompleted', 'Выполнено', Boolean(item.completed)),
    ),
    button('×', 'work-item-remove', { class: 'icon-button work-item-remove', title: 'Удалить строку' }),
  );
  return row;
}

function compactField(name, label, value, type, step = undefined) {
  return el('div', { class: 'field' },
    el('label', { text: label }),
    el('input', { name, type, value, min: type === 'number' ? 0 : undefined, step }),
  );
}

function compactSelect(name, label, options, value) {
  return el('div', { class: 'field' },
    el('label', { text: label }),
    el('select', { name }, options.map(([id, text]) => el('option', { value: id, text, selected: id === value }))),
  );
}

function blankItem() {
  return { id: '', type: 'work', name: '', quantityMilli: 1000, unitPriceCents: 0, laborCostCents: 0, approved: true, completed: false };
}

function moneyInput(cents) {
  return cents ? String(Number(cents) / 100) : '';
}

function quantityInput(milli) {
  return String((Number(milli) || 0) / 1000);
}

function selectFilter(action, options, value) {
  const select = el('select', { dataset: { action }, 'aria-label': 'Фильтр по статусу' },
    el('option', { value: '', text: 'Все статусы' }),
  );
  for (const [id, label] of options) select.append(el('option', { value: id, text: label, selected: id === value }));
  return select;
}
