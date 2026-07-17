import { APPOINTMENT_STATUSES, EMPLOYEE_ROLES } from '../constants.mjs';
import { clientStatistics } from '../calculations.mjs';
import { normalizeSearch } from '../utils.mjs';
import { button, emptyState, formatDate, formatMoney, panel, statusBadge, table, textCell, viewHeader, el } from '../ui.mjs';

const appointmentLabels = Object.fromEntries(APPOINTMENT_STATUSES);

export function renderClients(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const records = state.data.clients
    .filter((client) => !query || normalizeSearch(`${client.name} ${client.phoneDisplay} ${client.email}`).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const rows = records.map((client) => ({
    ...client,
    stats: clientStatistics(client.id, state.data),
    vehicles: state.by('vehicles', 'clientId', client.id),
  }));
  return listingView({
    eyebrow: 'Клиентская база',
    title: 'Клиенты',
    description: 'Карточка клиента связана с автомобилями, заказами и оплатами. Показатели считаются по связанным документам.',
    action: button('＋ Новый клиент', 'create-client', { class: 'button button--primary' }),
    entity: 'clients',
    placeholder: 'Имя, телефон или email',
    query: filters.query,
    columns: [
      { label: 'Клиент', render: (row) => textCell(row.name, `${row.phoneDisplay || 'Телефон не указан'} · ${row.preferredContact || 'Способ связи не выбран'}`) },
      { label: 'Автомобили', render: (row) => row.vehicles.length ? row.vehicles.map((vehicle) => `${vehicle.make} ${vehicle.model}`).join(', ') : '—' },
      { label: 'Визиты', render: (row) => String(row.stats.visits) },
      { label: 'Начислено', render: (row) => formatMoney(row.stats.totalBilledCents) },
      { label: 'Долг', render: (row) => formatMoney(row.stats.debtCents) },
      { label: '', class: 'table-actions', render: (row) => actions('client', row.id) },
    ],
    rows,
    emptyTitle: 'Клиентов пока нет',
    emptyText: 'Создайте первую карточку клиента. Телефон используется для связи, а не как идентификатор.',
  });
}

export function renderVehicles(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const rows = state.data.vehicles
    .filter((vehicle) => !query || normalizeSearch(`${vehicle.make} ${vehicle.model} ${vehicle.plate} ${vehicle.vin} ${state.clientName(vehicle.clientId)}`).includes(query))
    .sort((a, b) => `${a.make} ${a.model}`.localeCompare(`${b.make} ${b.model}`, 'ru'));
  return listingView({
    eyebrow: 'Автопарк клиентов',
    title: 'Автомобили',
    description: 'VIN и госномер нормализуются для поиска, но не заменяют устойчивый внутренний идентификатор.',
    action: button('＋ Новый автомобиль', 'create-vehicle', { class: 'button button--primary' }),
    entity: 'vehicles',
    placeholder: 'Марка, модель, VIN, госномер',
    query: filters.query,
    columns: [
      { label: 'Автомобиль', render: (row) => textCell(`${row.make} ${row.model}`, `${row.year || 'Год не указан'} · ${row.engineType || 'Тип двигателя не указан'}`) },
      { label: 'Владелец', render: (row) => state.clientName(row.clientId) },
      { label: 'Госномер', render: (row) => row.plate || '—' },
      { label: 'VIN', render: (row) => row.vin || '—' },
      { label: 'Пробег', render: (row) => row.mileage ? `${Number(row.mileage).toLocaleString('ru-RU')} км` : '—' },
      { label: '', class: 'table-actions', render: (row) => actions('vehicle', row.id) },
    ],
    rows,
    emptyTitle: 'Автомобилей пока нет',
    emptyText: 'Добавьте автомобиль и свяжите его с карточкой клиента.',
  });
}

export function renderAppointments(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const status = filters.status || '';
  const rows = state.data.appointments
    .filter((item) => (!status || item.status === status) && (!query || normalizeSearch(`${state.clientName(item.clientId)} ${state.vehicleName(item.vehicleId)} ${item.reason}`).includes(query)))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  return listingView({
    eyebrow: 'Планирование загрузки',
    title: 'Предварительная запись',
    description: 'Запись фиксирует обращение. После приезда её можно преобразовать в заказ-наряд без повторного ввода клиента и автомобиля.',
    action: button('＋ Новая запись', 'create-appointment', { class: 'button button--primary' }),
    entity: 'appointments',
    placeholder: 'Клиент, автомобиль, причина',
    query: filters.query,
    filters: statusSelect('appointment-status-filter', APPOINTMENT_STATUSES, status),
    columns: [
      { label: 'Дата и время', render: (row) => textCell(formatDate(row.date), row.time || 'Время не указано') },
      { label: 'Клиент', render: (row) => textCell(state.clientName(row.clientId), state.vehicleName(row.vehicleId)) },
      { label: 'Причина', render: (row) => row.reason || '—' },
      { label: 'Статус', render: (row) => statusBadge(row.status, appointmentLabels[row.status]) },
      { label: '', class: 'table-actions', render: (row) => appointmentActions(row) },
    ],
    rows,
    emptyTitle: 'Записей не найдено',
    emptyText: 'Измените фильтр или создайте новую предварительную запись.',
  });
}

export function renderEmployees(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const rows = state.data.employees
    .filter((employee) => !query || normalizeSearch(`${employee.name} ${employee.role} ${employee.phone}`).includes(query))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  return listingView({
    eyebrow: 'Команда',
    title: 'Сотрудники',
    description: 'Справочные карточки для назначения исполнителей. Демо-панель не содержит ролей доступа и авторизации.',
    action: button('＋ Новый сотрудник', 'create-employee', { class: 'button button--primary' }),
    entity: 'employees',
    placeholder: 'Имя, роль или телефон',
    query: filters.query,
    columns: [
      { label: 'Сотрудник', render: (row) => textCell(row.name, row.phone || 'Телефон не указан') },
      { label: 'Роль', render: (row) => row.role || EMPLOYEE_ROLES.at(-1) },
      { label: 'Статус', render: (row) => statusBadge(row.active ? 'approved' : 'cancelled', row.active ? 'Активен' : 'Неактивен') },
      { label: 'Примечание', render: (row) => row.notes || '—' },
      { label: '', class: 'table-actions', render: (row) => actions('employee', row.id) },
    ],
    rows,
    emptyTitle: 'Сотрудников пока нет',
    emptyText: 'Добавьте карточки исполнителей или оставьте раздел пустым.',
  });
}

function listingView(config) {
  const root = el('div', { class: 'view-stack' });
  const search = el('label', { class: 'toolbar-search' },
    el('span', { text: '⌕', 'aria-hidden': 'true' }),
    el('input', { type: 'search', placeholder: config.placeholder, value: config.query || '', dataset: { listSearch: config.entity }, 'aria-label': config.placeholder }),
  );
  const toolbar = el('div', { class: 'toolbar' }, search, config.filters || null, button('CSV', `export-${config.entity}-csv`, { class: 'button button--ghost button--compact' }));
  const content = config.rows.length
    ? table(config.columns, config.rows)
    : emptyState(config.emptyTitle, config.emptyText, config.action.cloneNode(true));
  root.append(
    viewHeader(config.eyebrow, config.title, config.description, [config.action]),
    panel(config.title, el('div', null, toolbar, content), { flush: true, subtitle: `${config.rows.length} записей` }),
  );
  return root;
}

function actions(entity, id) {
  return el('div', { class: 'table-actions' },
    button('Изменить', `edit-${entity}`, { class: 'table-action', dataset: { id } }),
    button('Удалить', `delete-${entity}`, { class: 'table-action table-action--danger', dataset: { id } }),
  );
}

function appointmentActions(row) {
  return el('div', { class: 'table-actions' },
    row.status !== 'converted' ? button('В заказ', 'convert-appointment', { class: 'table-action', dataset: { id: row.id } }) : null,
    button('Изменить', 'edit-appointment', { class: 'table-action', dataset: { id: row.id } }),
    button('Удалить', 'delete-appointment', { class: 'table-action table-action--danger', dataset: { id: row.id } }),
  );
}

function statusSelect(action, options, value) {
  const select = el('select', { dataset: { action }, 'aria-label': 'Фильтр по статусу' });
  select.append(el('option', { value: '', text: 'Все статусы' }));
  for (const [id, label] of options) select.append(el('option', { value: id, text: label, selected: id === value }));
  return select;
}
