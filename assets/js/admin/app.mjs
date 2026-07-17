import {
  APPOINTMENT_STATUSES, APPROVAL_STATUSES, DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PAYMENT_METHODS,
  DRAFT_KEY, DRAFT_VERSION, EMPLOYEE_ROLES, ORDER_STATUSES, PAYMENT_TYPES, ROUTES,
} from './constants.mjs';
import { calculateOrder, calculatePaymentState, PAYMENT_STATUS_LABELS } from './calculations.mjs';
import { createDemoBackup } from './demo-data.mjs';
import { formatPhone, parseMoney } from './formatters.mjs';
import { navigate, startRouter } from './router.mjs';
import { AdminState } from './state.mjs';
import { createDemoStorage } from './storage/demo-storage.mjs';
import {
  backupFilename, createRecord, debounce, downloadFile, normalizePhone, normalizePlate, normalizeSearch,
  normalizeText, normalizeVin, nowIso, toCsv, todayIso, updateRecord, uuid,
} from './utils.mjs';
import {
  validateAppointment, validateBackup, validateClient, validateExpense, validatePayment,
  validateVehicle, validateWorkOrder,
} from './validation.mjs';
import {
  button, checkbox, el, field, formDataObject, formatMoney, icon, setPageMeta, toast,
} from './ui.mjs';
import { renderDashboard } from './modules/dashboard.mjs';
import { renderAppointments, renderClients, renderEmployees, renderVehicles } from './modules/records.mjs';
import { buildWorkOrderEditor, readWorkOrderForm, renderWorkOrders } from './modules/work-orders.mjs';
import { renderExpenses, renderPayments, renderReports } from './modules/finance.mjs';
import { renderDirectories } from './modules/directories.mjs';
import { renderSettings, renderTrash } from './modules/settings.mjs';

const storage = createDemoStorage();
const state = new AdminState(storage);
const view = document.querySelector('[data-admin-view]');
const dialog = document.querySelector('[data-admin-dialog]');
const dialogBody = dialog.querySelector('[data-dialog-body]');
const dialogTitle = dialog.querySelector('[data-dialog-title]');
const dialogEyebrow = dialog.querySelector('[data-dialog-eyebrow]');
const dialogSubmit = dialog.querySelector('[data-dialog-submit]');
const dialogFooter = dialog.querySelector('[data-dialog-footer]');
const onboarding = document.querySelector('[data-onboarding]');
const backupFile = document.querySelector('[data-backup-file]');
const globalSearch = document.querySelector('[data-global-search]');
const routeFilters = {};
let currentRoute = 'dashboard';
let installationId = '';
let dialogSubmitHandler = null;
let activeWorkOrderForm = null;

const routeDescriptions = {
  dashboard: 'Рабочая область',
  appointments: 'Планирование',
  clients: 'Клиентская база',
  vehicles: 'Автопарк',
  'work-orders': 'Ремонт и обслуживание',
  payments: 'Финансы',
  expenses: 'Финансы',
  reports: 'Аналитика',
  directories: 'Настройка данных',
  employees: 'Команда',
  trash: 'Системные записи',
  settings: 'Локальная база',
};

const renderers = {
  dashboard: () => renderDashboard(state),
  appointments: () => renderAppointments(state, routeFilters.appointments),
  clients: () => renderClients(state, routeFilters.clients),
  vehicles: () => renderVehicles(state, routeFilters.vehicles),
  'work-orders': () => renderWorkOrders(state, routeFilters['work-orders']),
  payments: () => renderPayments(state, routeFilters.payments),
  expenses: () => renderExpenses(state, routeFilters.expenses),
  reports: () => renderReports(state, routeFilters.reports),
  directories: () => renderDirectories(state, routeFilters.directories),
  employees: () => renderEmployees(state, routeFilters.employees),
  trash: () => renderTrash(state),
  settings: () => renderSettings(state, installationId),
};

async function init() {
  try {
    await storage.init();
    installationId = await storage.ensureInstallationId();
    await state.load();
    buildNavigation();
    bindGlobalEvents();
    startRouter(renderRoute);
    const complete = await storage.getSetting('onboardingComplete', false);
    if (!complete) onboarding.showModal();
    else notifyDraft();
  } catch (error) {
    showFatalError(error);
  }
}

function bindGlobalEvents() {
  document.addEventListener('click', handleClick);
  view.addEventListener('input', handleViewInput);
  view.addEventListener('change', handleViewChange);
  document.querySelector('[data-sidebar-toggle]').addEventListener('click', toggleSidebar);
  document.querySelector('[data-sidebar-scrim]').addEventListener('click', closeSidebar);
  document.querySelector('[data-quick-create]').addEventListener('click', openQuickCreate);
  document.querySelector('[data-open-backup]').addEventListener('click', () => navigate('settings'));
  dialog.querySelectorAll('[data-dialog-close]').forEach((node) => node.addEventListener('click', closeDialog));
  dialog.addEventListener('close', () => {
    dialogSubmitHandler = null;
    activeWorkOrderForm = null;
  });
  dialog.addEventListener('cancel', () => {
    if (activeWorkOrderForm) saveActiveDraft();
  });
  dialogSubmit.addEventListener('click', () => dialogSubmitHandler?.());
  onboarding.querySelector('[data-onboarding-demo]').addEventListener('click', loadDemoOnboarding);
  onboarding.querySelector('[data-onboarding-empty]').addEventListener('click', loadEmptyOnboarding);
  backupFile.addEventListener('change', importSelectedBackup);
  globalSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      showGlobalSearch(globalSearch.value);
    }
  });
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      globalSearch.closest('.global-search').classList.add('search-open');
      globalSearch.focus();
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's' && activeWorkOrderForm) {
      event.preventDefault();
      saveActiveDraft();
      toast('Черновик заказ-наряда сохранён локально.', 'success');
    }
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && activeWorkOrderForm) saveActiveDraft();
  });
}

function buildNavigation() {
  const list = el('ul', { class: 'admin-nav-list' });
  for (const [route, title] of ROUTES) {
    list.append(el('li', null,
      el('a', { class: 'admin-nav-link', href: `#/${route}`, dataset: { navRoute: route } },
        el('span', { class: 'admin-nav-icon', 'aria-hidden': 'true', text: icon(route) }),
        el('span', { text: title }),
        el('span', { class: 'nav-count', dataset: { navCount: route }, text: countForRoute(route) }),
      ),
    ));
  }
  document.querySelector('[data-admin-nav]').replaceChildren(list);
}

function updateNavigation() {
  document.querySelectorAll('[data-nav-route]').forEach((link) => {
    if (link.dataset.navRoute === currentRoute) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  document.querySelectorAll('[data-nav-count]').forEach((node) => {
    node.textContent = countForRoute(node.dataset.navCount);
  });
}

function countForRoute(route) {
  if (route === 'appointments') return String(state.data.appointments?.filter((item) => item.date >= todayIso() && !['cancelled', 'converted'].includes(item.status)).length || 0);
  if (route === 'work-orders') return String(state.data.workOrders?.filter((item) => !['closed', 'delivered', 'cancelled'].includes(item.status)).length || 0);
  if (route === 'trash') return String(state.data.trash?.length || 0);
  const store = { clients: 'clients', vehicles: 'vehicles', payments: 'payments', expenses: 'expenses', employees: 'employees' }[route];
  return store ? String(state.data[store]?.length || 0) : '';
}

function renderRoute(route) {
  currentRoute = route;
  routeFilters[route] ||= {};
  const renderer = renderers[route] || renderers.dashboard;
  view.replaceChildren(renderer());
  setPageMeta(Object.fromEntries(ROUTES)[route] || 'Обзор', routeDescriptions[route]);
  updateNavigation();
  closeSidebar();
  view.focus({ preventScroll: true });
}

function rerender() {
  renderRoute(currentRoute);
}

async function loadDemoOnboarding() {
  try {
    setOnboardingBusy(true);
    await storage.importDatabase(createDemoBackup());
    installationId = await storage.ensureInstallationId();
    await state.load();
    onboarding.close();
    buildNavigation();
    rerender();
    toast('Вымышленная демонстрационная база загружена.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setOnboardingBusy(false);
  }
}

async function loadEmptyOnboarding() {
  try {
    setOnboardingBusy(true);
    await storage.resetDatabase();
    const operations = [
      ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ type: 'put', entity: 'expenseCategories', record: createRecord({ name, active: true }) })),
      ...DEFAULT_PAYMENT_METHODS.map((name) => ({ type: 'put', entity: 'paymentMethods', record: createRecord({ name, active: true }) })),
      { type: 'put', entity: 'settings', record: createRecord({ id: 'onboardingComplete', value: true }, 'onboardingComplete') },
      { type: 'put', entity: 'settings', record: createRecord({ id: 'databaseMode', value: 'empty' }, 'databaseMode') },
    ];
    await storage.transaction(operations);
    installationId = await storage.ensureInstallationId();
    await state.load();
    onboarding.close();
    buildNavigation();
    rerender();
    toast('Создана пустая локальная база.', 'success');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    setOnboardingBusy(false);
  }
}

function setOnboardingBusy(busy) {
  onboarding.querySelectorAll('button').forEach((node) => { node.disabled = busy; });
}

async function handleClick(event) {
  const trigger = event.target.closest('[data-action]');
  if (!trigger) return;
  const { action, id, entity, tab } = trigger.dataset;
  if (!action) return;

  const routeAction = action.match(/^go-(.+)$/);
  if (routeAction) {
    closeDialog();
    navigate(routeAction[1]);
    return;
  }

  const actions = {
    'create-client': () => openEntityEditor('client'),
    'edit-client': () => openEntityEditor('client', id),
    'delete-client': () => deleteEntity('clients', id),
    'create-vehicle': () => openEntityEditor('vehicle'),
    'edit-vehicle': () => openEntityEditor('vehicle', id),
    'delete-vehicle': () => deleteEntity('vehicles', id),
    'create-appointment': () => openEntityEditor('appointment'),
    'edit-appointment': () => openEntityEditor('appointment', id),
    'delete-appointment': () => deleteEntity('appointments', id),
    'convert-appointment': () => convertAppointment(id),
    'create-employee': () => openEntityEditor('employee'),
    'edit-employee': () => openEntityEditor('employee', id),
    'delete-employee': () => deleteEntity('employees', id),
    'create-work-order': () => openWorkOrderEditor(),
    'edit-work-order': () => openWorkOrderEditor(id),
    'delete-work-order': () => deleteEntity('workOrders', id),
    'create-payment': () => openEntityEditor('payment'),
    'create-payment-for-order': () => openEntityEditor('payment', null, { workOrderId: id }),
    'create-refund': () => openEntityEditor('payment', null, { type: 'refund' }),
    'edit-payment': () => openEntityEditor('payment', id),
    'delete-payment': () => deleteEntity('payments', id),
    'create-expense': () => openEntityEditor('expense'),
    'edit-expense': () => openEntityEditor('expense', id),
    'delete-expense': () => deleteEntity('expenses', id),
    'directory-tab': () => setDirectoryTab(tab),
    'create-directory-record': () => openDirectoryEditor(entity),
    'edit-directory-record': () => openDirectoryEditor(entity, id),
    'delete-directory-record': () => deleteEntity(entity, id),
    'restore-record': () => restoreEntity(entity, id),
    'purge-record': () => purgeEntity(entity, id),
    'empty-trash': () => emptyTrash(),
    'export-backup': () => exportBackup(true),
    'import-backup': () => backupFile.click(),
    'reset-database': () => resetDatabase(),
    'print-report': () => window.print(),
    'export-clients-csv': () => exportCsv('clients'),
    'export-vehicles-csv': () => exportCsv('vehicles'),
    'export-appointments-csv': () => exportCsv('appointments'),
    'export-work-orders-csv': () => exportCsv('workOrders'),
    'export-payments-csv': () => exportCsv('payments'),
    'export-expenses-csv': () => exportCsv('expenses'),
    'export-reports-csv': () => exportReportCsv(),
    'search-open': () => openSearchResult(entity, id),
  };
  if (actions[action]) {
    event.preventDefault();
    await actions[action]();
  }
}

const runListSearch = debounce((entity, value) => {
  routeFilters[entity] ||= {};
  routeFilters[entity].query = value;
  renderRoute(entity);
  const input = view.querySelector(`[data-list-search="${entity}"]`);
  input?.focus();
  if (input) input.setSelectionRange(input.value.length, input.value.length);
}, 280);

function handleViewInput(event) {
  const input = event.target.closest('[data-list-search]');
  if (input) runListSearch(input.dataset.listSearch, input.value);
}

function handleViewChange(event) {
  const target = event.target;
  if (target.dataset.action === 'appointment-status-filter') {
    routeFilters.appointments.status = target.value;
    rerender();
  }
  if (target.dataset.action === 'work-order-status-filter') {
    routeFilters['work-orders'].status = target.value;
    rerender();
  }
  if (target.dataset.reportFrom !== undefined || target.dataset.reportTo !== undefined) {
    routeFilters.reports = {
      from: view.querySelector('[data-report-from]').value,
      to: view.querySelector('[data-report-to]').value,
    };
    rerender();
  }
}

function openDialog({ title, eyebrow = 'VN-MASTERS', body, submitLabel = 'Сохранить', onSubmit = null, wide = false }) {
  activeWorkOrderForm = null;
  dialogTitle.textContent = title;
  dialogEyebrow.textContent = eyebrow;
  dialogBody.replaceChildren(body);
  dialogSubmit.textContent = submitLabel;
  dialogSubmit.hidden = !onSubmit;
  dialogFooter.hidden = !onSubmit;
  dialogSubmitHandler = onSubmit;
  dialog.classList.toggle('admin-dialog--wide', wide);
  dialog.showModal();
  dialogBody.querySelector('input:not([type="hidden"]), select, textarea, button')?.focus();
}

function closeDialog() {
  if (activeWorkOrderForm) saveActiveDraft();
  if (dialog.open) dialog.close();
  dialogSubmitHandler = null;
  activeWorkOrderForm = null;
}

function openQuickCreate() {
  const body = el('div', { class: 'quick-actions' },
    quickChoice('◎', 'Новый клиент', 'create-client'),
    quickChoice('◇', 'Новый автомобиль', 'create-vehicle'),
    quickChoice('◷', 'Предварительная запись', 'create-appointment'),
    quickChoice('▤', 'Новый заказ-наряд', 'create-work-order'),
    quickChoice('₽', 'Принять оплату', 'create-payment'),
    quickChoice('↘', 'Добавить расход', 'create-expense'),
  );
  openDialog({ title: 'Создать запись', eyebrow: 'Быстрое действие', body });
}

function quickChoice(symbol, title, action) {
  return el('button', { type: 'button', class: 'quick-action', dataset: { action } },
    el('span', { text: symbol }),
    el('strong', { text: title }),
  );
}

function openEntityEditor(type, id = null, seed = {}) {
  const config = entityConfig(type, id, seed);
  if (!config) return;
  const form = config.form;
  openDialog({
    title: config.title,
    eyebrow: config.eyebrow,
    body: form,
    submitLabel: config.submitLabel || 'Сохранить',
    onSubmit: async () => {
      if (!form.reportValidity()) return;
      const raw = formDataObject(form);
      const record = config.parse(raw);
      const validation = config.validate(record);
      if (!validation.valid) {
        showFormError(form, validation.errors.join(' '));
        return;
      }
      if (validation.warnings?.length && !window.confirm(`${validation.warnings.join(' ')} Всё равно сохранить?`)) return;
      try {
        const existing = id ? state.get(config.store, id) : null;
        const saved = existing
          ? await storage.update(config.store, id, record)
          : await storage.create(config.store, record);
        await storage.log(existing ? 'updated' : config.auditAction || 'created', config.store, saved.id, config.auditDetails?.(saved) || config.title);
        await state.refresh(config.store, 'auditLog');
        closeDialog();
        rerender();
        toast(existing ? 'Изменения сохранены.' : 'Запись создана.', 'success');
      } catch (error) {
        showFormError(form, error.message);
      }
    },
  });
}

function entityConfig(type, id, seed) {
  if (type === 'client') {
    const existing = state.get('clients', id) || seed;
    const form = formGrid([
      { name: 'name', label: 'Имя клиента', required: true, autocomplete: 'name' },
      { name: 'phoneDisplay', label: 'Основной телефон', type: 'tel', required: true, autocomplete: 'tel', placeholder: '+7 (___) ___-__-__' },
      { name: 'secondaryPhone', label: 'Дополнительный телефон', type: 'tel' },
      { name: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
      { name: 'preferredContact', label: 'Предпочтительный способ связи', type: 'select', placeholder: 'Не выбран', options: ['Звонок', 'SMS', 'Мессенджер', 'Email'].map((value) => [value, value]) },
      { name: 'notes', label: 'Заметка', type: 'textarea', wide: true },
    ], existing);
    return {
      title: id ? 'Редактировать клиента' : 'Новый клиент', eyebrow: 'Клиентская база', form, store: 'clients',
      parse: (raw) => ({ ...raw, name: normalizeText(raw.name), normalizedPhone: normalizePhone(raw.phoneDisplay), phoneDisplay: formatPhone(raw.phoneDisplay) }),
      validate: (record) => validateClient({ ...record, id }, state.data.clients),
    };
  }
  if (type === 'vehicle') {
    const existing = state.get('vehicles', id) || seed;
    const form = formGrid([
      { name: 'clientId', label: 'Владелец', type: 'select', required: true, placeholder: 'Выберите клиента', options: state.data.clients.map((client) => [client.id, `${client.name} · ${client.phoneDisplay}`]) },
      { name: 'make', label: 'Марка', required: true },
      { name: 'model', label: 'Модель', required: true },
      { name: 'generation', label: 'Поколение / кузов' },
      { name: 'year', label: 'Год', type: 'number', min: 1950, max: new Date().getFullYear() + 1 },
      { name: 'plate', label: 'Госномер' },
      { name: 'vin', label: 'VIN', help: '17 латинских букв и цифр; I, O и Q не используются.' },
      { name: 'mileage', label: 'Текущий пробег, км', type: 'number', min: 0, step: 1 },
      { name: 'engineType', label: 'Тип двигателя', type: 'select', placeholder: 'Не выбран', options: ['Бензин', 'Дизель', 'Гибрид', 'Электрический', 'Другое'].map((value) => [value, value]) },
      { name: 'notes', label: 'Заметка', type: 'textarea', wide: true },
    ], existing);
    return {
      title: id ? 'Редактировать автомобиль' : 'Новый автомобиль', eyebrow: 'Автопарк', form, store: 'vehicles',
      parse: (raw) => ({
        ...raw, make: normalizeText(raw.make), model: normalizeText(raw.model), vin: normalizeVin(raw.vin),
        plate: normalizePlate(raw.plate), year: raw.year ? Number(raw.year) : '', mileage: raw.mileage ? Math.trunc(Number(raw.mileage)) : 0,
        mileageHistory: existing.mileageHistory || [],
      }),
      validate: validateVehicle,
    };
  }
  if (type === 'appointment') {
    const existing = state.get('appointments', id) || { date: todayIso(), status: 'new', ...seed };
    const form = formGrid([
      { name: 'date', label: 'Дата', type: 'date', required: true },
      { name: 'time', label: 'Время', type: 'time', required: true },
      { name: 'clientId', label: 'Клиент', type: 'select', required: true, placeholder: 'Выберите клиента', options: state.data.clients.map((client) => [client.id, client.name]) },
      { name: 'vehicleId', label: 'Автомобиль', type: 'select', required: true, placeholder: 'Выберите автомобиль', options: state.data.vehicles.map((vehicle) => [vehicle.id, `${vehicle.make} ${vehicle.model} · ${vehicle.plate || state.clientName(vehicle.clientId)}`]) },
      { name: 'reason', label: 'Причина обращения', type: 'textarea', required: true, wide: true, placeholder: 'Можно описать симптом простыми словами' },
      { name: 'status', label: 'Статус', type: 'select', options: APPOINTMENT_STATUSES },
      { name: 'note', label: 'Заметка', type: 'textarea' },
    ], existing);
    return {
      title: id ? 'Редактировать запись' : 'Новая предварительная запись', eyebrow: 'Планирование', form, store: 'appointments',
      parse: (raw) => raw, validate: validateAppointment,
    };
  }
  if (type === 'employee') {
    const existing = state.get('employees', id) || { active: true, ...seed };
    const form = formGrid([
      { name: 'name', label: 'Имя сотрудника', required: true },
      { name: 'role', label: 'Роль', type: 'select', required: true, options: EMPLOYEE_ROLES.map((value) => [value, value]) },
      { name: 'phone', label: 'Телефон', type: 'tel' },
      { name: 'rateNote', label: 'Условия / ставка', help: 'Свободная справочная заметка, без расчёта зарплаты.' },
      { name: 'notes', label: 'Заметка', type: 'textarea', wide: true },
    ], existing, [checkbox('active', 'Активен и доступен для назначения', existing.active !== false)]);
    return {
      title: id ? 'Редактировать сотрудника' : 'Новый сотрудник', eyebrow: 'Команда', form, store: 'employees',
      parse: (raw) => ({ ...raw, name: normalizeText(raw.name) }),
      validate: (record) => ({ valid: Boolean(record.name && record.role), errors: record.name && record.role ? [] : ['Укажите имя и роль сотрудника.'] }),
    };
  }
  if (type === 'payment') {
    const existing = state.get('payments', id) || { date: todayIso(), type: 'payment', ...seed };
    const methods = state.data.paymentMethods.filter((item) => item.active !== false).map((item) => [item.name, item.name]);
    const orderOptions = state.data.workOrders.filter((order) => order.status !== 'cancelled').map((order) => {
      const total = calculateOrder(order, state.by('workOrderItems', 'workOrderId', order.id)).totalCents;
      const paymentState = calculatePaymentState(total, state.by('payments', 'workOrderId', order.id).filter((payment) => payment.id !== id));
      return [order.id, `${order.number} · ${state.clientName(order.clientId)} · остаток ${formatMoney(paymentState.debtCents)}`];
    });
    const form = formGrid([
      { name: 'workOrderId', label: 'Заказ-наряд', type: 'select', required: true, placeholder: 'Выберите заказ', options: orderOptions },
      { name: 'date', label: 'Дата операции', type: 'date', required: true },
      { name: 'amountRubles', label: 'Сумма, ₽', type: 'number', min: .01, step: .01, required: true },
      { name: 'method', label: 'Способ оплаты', type: 'select', required: true, placeholder: 'Выберите способ', options: methods },
      { name: 'type', label: 'Тип операции', type: 'select', required: true, options: PAYMENT_TYPES },
      { name: 'comment', label: 'Комментарий', type: 'textarea', wide: true },
    ], { ...existing, amountRubles: existing.amountCents ? Number(existing.amountCents) / 100 : '' });
    return {
      title: id ? 'Редактировать платёж' : existing.type === 'refund' ? 'Оформить возврат' : 'Новая оплата', eyebrow: 'Движение денег', form, store: 'payments',
      parse: ({ amountRubles, ...raw }) => ({ ...raw, amountCents: parseMoney(amountRubles) }),
      validate: (record) => validatePayment(record, state.data.workOrders.map((order) => order.id)),
      auditAction: existing.type === 'refund' ? 'refund_created' : 'payment_created',
      auditDetails: (record) => `${record.type}: ${formatMoney(record.amountCents)}`,
    };
  }
  if (type === 'expense') {
    const existing = state.get('expenses', id) || { date: todayIso(), recurring: false, includedInOrderCost: false, ...seed };
    const categories = state.data.expenseCategories.filter((item) => item.active !== false).map((item) => [item.name, item.name]);
    const methods = state.data.paymentMethods.filter((item) => item.active !== false).map((item) => [item.name, item.name]);
    const form = formGrid([
      { name: 'date', label: 'Дата', type: 'date', required: true },
      { name: 'category', label: 'Категория', type: 'select', required: true, placeholder: 'Выберите категорию', options: categories },
      { name: 'amountRubles', label: 'Сумма, ₽', type: 'number', min: .01, step: .01, required: true },
      { name: 'method', label: 'Способ оплаты', type: 'select', placeholder: 'Не указан', options: methods },
      { name: 'recipient', label: 'Получатель' },
      { name: 'workOrderId', label: 'Связанный заказ', type: 'select', placeholder: 'Не связан', options: state.data.workOrders.map((order) => [order.id, order.number]) },
      { name: 'documentNote', label: 'Документ / номер' },
      { name: 'comment', label: 'Комментарий', type: 'textarea', wide: true },
    ], { ...existing, amountRubles: existing.amountCents ? Number(existing.amountCents) / 100 : '' }, [
      checkbox('recurring', 'Регулярный расход', Boolean(existing.recurring)),
      checkbox('includedInOrderCost', 'Эта сумма уже включена в себестоимость строк связанного заказа', Boolean(existing.includedInOrderCost)),
    ]);
    return {
      title: id ? 'Редактировать расход' : 'Новый расход', eyebrow: 'Операционные затраты', form, store: 'expenses',
      parse: ({ amountRubles, ...raw }) => ({ ...raw, amountCents: parseMoney(amountRubles) }),
      validate: (record) => validateExpense(record, state.data.workOrders.map((order) => order.id)),
    };
  }
  return null;
}

function formGrid(definitions, values = {}, extras = []) {
  const form = el('form', { class: 'form-grid', noValidate: false });
  definitions.forEach((definition) => form.append(field(definition, values[definition.name])));
  extras.forEach((node) => form.append(node));
  return form;
}

function showFormError(form, message) {
  form.querySelector('[data-form-error]')?.remove();
  const notice = el('div', { class: 'notice notice--danger field--wide', dataset: { formError: 'true' } },
    el('span', { text: '!' }),
    el('p', { text: message }),
  );
  form.prepend(notice);
  notice.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function openWorkOrderEditor(id = null, seed = null) {
  const existing = id ? state.get('workOrders', id) : null;
  let draft = null;
  if (!existing && !seed) {
    draft = readDraft();
    if (draft && !window.confirm(`Найден локальный черновик от ${new Date(draft.savedAt).toLocaleString('ru-RU')}. Восстановить его?`)) {
      localStorage.removeItem(DRAFT_KEY);
      draft = null;
    }
  }
  const form = buildWorkOrderEditor(state, existing || seed, draft);
  activeWorkOrderForm = form;
  const saveDraftDebounced = debounce(saveActiveDraft, 450);
  form.addEventListener('input', saveDraftDebounced);
  openDialog({
    title: existing ? `Заказ ${existing.number}` : 'Новый заказ-наряд',
    eyebrow: existing ? 'Редактирование документа' : 'Приём автомобиля',
    body: form,
    submitLabel: existing ? 'Сохранить изменения' : 'Создать заказ',
    wide: true,
    onSubmit: async () => {
      if (!form.reportValidity()) return;
      const value = readWorkOrderForm(form);
      const validation = validateWorkOrder(value.order, value.items);
      if (!validation.valid) {
        showFormError(form, validation.errors.join(' '));
        return;
      }
      try {
        const orderId = existing?.id || seed?.id || uuid();
        const orderRecord = existing
          ? updateRecord(existing, value.order)
          : createRecord({ ...seed, ...value.order, id: orderId }, orderId);
        const previousItems = existing ? state.by('workOrderItems', 'workOrderId', orderId) : [];
        const previousById = new Map(previousItems.map((item) => [item.id, item]));
        const operations = [{ type: 'put', entity: 'workOrders', record: orderRecord }];
        for (const item of value.items) {
          const prior = previousById.get(item.id);
          const record = prior
            ? updateRecord(prior, { ...item, workOrderId: orderId })
            : createRecord({ ...item, workOrderId: orderId }, item.id);
          operations.push({ type: 'put', entity: 'workOrderItems', record });
          previousById.delete(item.id);
        }
        for (const removed of previousById.values()) operations.push({ type: 'delete', entity: 'workOrderItems', id: removed.id });
        await storage.transaction(operations);
        await storage.log(existing ? 'updated' : 'created', 'workOrders', orderId, orderRecord.number);
        if (seed?.sourceAppointmentId) {
          await storage.update('appointments', seed.sourceAppointmentId, { status: 'converted', workOrderId: orderId });
        }
        activeWorkOrderForm = null;
        localStorage.removeItem(DRAFT_KEY);
        await state.refresh('workOrders', 'workOrderItems', 'appointments', 'auditLog');
        closeDialog();
        navigate('work-orders');
        rerender();
        toast(existing ? 'Заказ обновлён без дублирования строк.' : 'Заказ-наряд создан.', 'success');
      } catch (error) {
        showFormError(form, error.message);
      }
    },
  });
  activeWorkOrderForm = form;
}

function saveActiveDraft() {
  if (!activeWorkOrderForm?.isConnected) return;
  const value = readWorkOrderForm(activeWorkOrderForm);
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    version: DRAFT_VERSION,
    savedAt: nowIso(),
    recordId: activeWorkOrderForm.dataset.recordId || '',
    order: value.order,
    items: value.items,
  }));
}

function readDraft() {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY));
    return value?.version === DRAFT_VERSION && !value.recordId ? value : null;
  } catch {
    localStorage.removeItem(DRAFT_KEY);
    return null;
  }
}

function notifyDraft() {
  if (readDraft()) toast('Есть несохранённый черновик заказ-наряда. Нажмите «Новый заказ», чтобы восстановить его.');
}

async function convertAppointment(id) {
  const appointment = state.get('appointments', id);
  if (!appointment) return;
  await openWorkOrderEditor(null, {
    clientId: appointment.clientId,
    vehicleId: appointment.vehicleId,
    acceptedDate: appointment.date || todayIso(),
    complaint: appointment.reason,
    internalNote: appointment.note,
    sourceAppointmentId: appointment.id,
    status: 'draft',
    approvalStatus: 'not_requested',
  });
}

function openDirectoryEditor(entity, id = null) {
  const existing = state.get(entity, id) || {};
  const definitions = directoryFields(entity, existing);
  const form = formGrid(definitions, {
    ...existing,
    rateRubles: existing.rateCents ? existing.rateCents / 100 : '',
    suggestedPriceRubles: existing.suggestedPriceCents ? existing.suggestedPriceCents / 100 : '',
    purchasePriceRubles: existing.purchasePriceCents ? existing.purchasePriceCents / 100 : '',
    recommendedHours: existing.recommendedHoursMilli ? existing.recommendedHoursMilli / 1000 : '',
  }, ['servicesCatalog', 'expenseCategories', 'paymentMethods'].includes(entity) ? [checkbox('active', 'Активная запись', existing.active !== false)] : []);
  openDialog({
    title: id ? 'Изменить запись справочника' : 'Новая запись справочника',
    eyebrow: 'Справочники',
    body: form,
    onSubmit: async () => {
      if (!form.reportValidity()) return;
      const raw = formDataObject(form);
      const record = parseDirectoryRecord(entity, raw);
      if (!record.name) {
        showFormError(form, 'Укажите название.');
        return;
      }
      const saved = id ? await storage.update(entity, id, record) : await storage.create(entity, record);
      await storage.log(id ? 'updated' : 'created', entity, saved.id, saved.name);
      await state.refresh(entity, 'auditLog');
      closeDialog();
      rerender();
      toast('Справочник обновлён.', 'success');
    },
  });
}

function directoryFields(entity) {
  if (entity === 'servicesCatalog') return [
    { name: 'name', label: 'Название услуги', required: true },
    { name: 'category', label: 'Категория' },
    { name: 'recommendedHours', label: 'Норматив, часов', type: 'number', min: 0, step: .001 },
    { name: 'rateRubles', label: 'Ставка, ₽', type: 'number', min: 0, step: .01 },
    { name: 'suggestedPriceRubles', label: 'Подсказка цены, ₽', type: 'number', min: 0, step: .01 },
  ];
  if (entity === 'partsCatalog') return [
    { name: 'name', label: 'Название детали', required: true },
    { name: 'sku', label: 'Артикул' },
    { name: 'supplierId', label: 'Поставщик', type: 'select', placeholder: 'Не выбран', options: state.data.suppliers.map((supplier) => [supplier.id, supplier.name]) },
    { name: 'purchasePriceRubles', label: 'Закупочная цена, ₽', type: 'number', min: 0, step: .01 },
    { name: 'suggestedPriceRubles', label: 'Цена клиенту, ₽', type: 'number', min: 0, step: .01 },
    { name: 'unit', label: 'Единица', placeholder: 'шт.' },
    { name: 'notes', label: 'Заметка', type: 'textarea', wide: true },
  ];
  if (entity === 'suppliers') return [
    { name: 'name', label: 'Название поставщика', required: true },
    { name: 'phone', label: 'Телефон', type: 'tel' },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'notes', label: 'Заметка', type: 'textarea', wide: true },
  ];
  return [{ name: 'name', label: 'Название', required: true }];
}

function parseDirectoryRecord(entity, raw) {
  const record = { ...raw, name: normalizeText(raw.name) };
  if (entity === 'servicesCatalog') {
    record.recommendedHoursMilli = Math.max(0, Math.round((Number(raw.recommendedHours) || 0) * 1000));
    record.rateCents = parseMoney(raw.rateRubles);
    record.suggestedPriceCents = parseMoney(raw.suggestedPriceRubles);
    delete record.recommendedHours;
    delete record.rateRubles;
    delete record.suggestedPriceRubles;
  }
  if (entity === 'partsCatalog') {
    record.purchasePriceCents = parseMoney(raw.purchasePriceRubles);
    record.suggestedPriceCents = parseMoney(raw.suggestedPriceRubles);
    delete record.purchasePriceRubles;
    delete record.suggestedPriceRubles;
  }
  return record;
}

function setDirectoryTab(tab) {
  routeFilters.directories ||= {};
  routeFilters.directories.tab = tab;
  rerender();
}

async function deleteEntity(entity, id) {
  const record = state.get(entity, id);
  if (!record) return;
  if (entity === 'clients' && (state.by('vehicles', 'clientId', id).length || state.by('workOrders', 'clientId', id).length)) {
    toast('Клиента нельзя удалить, пока с ним связаны автомобили или заказы.', 'error');
    return;
  }
  if (entity === 'vehicles' && state.by('workOrders', 'vehicleId', id).length) {
    toast('Автомобиль нельзя удалить, пока с ним связаны заказы.', 'error');
    return;
  }
  if (!window.confirm('Переместить запись в корзину? Её можно будет восстановить.')) return;
  await storage.softDelete(entity, id);
  await storage.log('deleted', entity, id, record.name || record.number || id);
  await state.refresh(entity, 'trash', 'auditLog');
  rerender();
  toast('Запись перемещена в корзину.');
}

async function restoreEntity(entity, id) {
  await storage.restore(entity, id);
  await storage.log('restored', entity, id, 'Восстановлено из корзины');
  await state.refresh(entity, 'trash', 'auditLog');
  rerender();
  toast('Запись восстановлена.', 'success');
}

async function purgeEntity(entity, id) {
  if (!window.confirm('Удалить запись навсегда? Отменить это действие нельзя.')) return;
  if (entity === 'workOrders') {
    const operations = [
      ...state.by('workOrderItems', 'workOrderId', id).map((item) => ({ type: 'delete', entity: 'workOrderItems', id: item.id })),
      ...state.by('payments', 'workOrderId', id).map((item) => ({ type: 'delete', entity: 'payments', id: item.id })),
      { type: 'delete', entity, id },
      { type: 'delete', entity: 'trash', id: `${entity}:${id}` },
    ];
    await storage.transaction(operations);
  } else {
    await storage.remove(entity, id);
  }
  await storage.log('purged', entity, id, 'Необратимое удаление');
  await state.load();
  rerender();
  toast('Запись удалена навсегда.');
}

async function emptyTrash() {
  if (!window.confirm('Безвозвратно удалить все записи из корзины?')) return;
  await storage.clearTrash();
  await storage.log('trash_cleared', 'trash', '', 'Корзина очищена');
  await state.load();
  rerender();
  toast('Корзина очищена.');
}

async function exportBackup(notify = false) {
  const backup = await storage.exportDatabase();
  downloadFile(JSON.stringify(backup, null, 2), backupFilename(), 'application/json;charset=utf-8');
  await storage.log('backup_exported', 'settings', '', `Схема ${backup.schemaVersion}`);
  await state.refresh('auditLog');
  if (notify) toast('Резервная копия JSON скачана.', 'success');
  return backup;
}

async function importSelectedBackup() {
  const file = backupFile.files?.[0];
  backupFile.value = '';
  if (!file) return;
  try {
    const input = JSON.parse(await file.text());
    const validation = validateBackup(input);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    if (!window.confirm(`Импортировать файл «${file.name}»? Текущая база будет автоматически скачана перед заменой.`)) return;
    await exportBackup(false);
    await storage.importDatabase(input);
    await storage.log('backup_imported', 'settings', '', file.name);
    installationId = await storage.ensureInstallationId();
    await state.load();
    rerender();
    toast('Резервная копия импортирована.', 'success');
  } catch (error) {
    toast(`Импорт отменён: ${error.message}`, 'error');
  }
}

async function resetDatabase() {
  if (!window.confirm('Очистить всю локальную базу? Перед продолжением рекомендуется экспортировать JSON.')) return;
  if (!window.confirm('Подтвердите окончательную очистку. Это действие нельзя отменить без резервной копии.')) return;
  await storage.resetDatabase();
  localStorage.removeItem(DRAFT_KEY);
  await state.load();
  onboarding.showModal();
  rerender();
}

function exportCsv(entity) {
  const definitions = {
    clients: [
      { label: 'ID', value: 'id' }, { label: 'Имя', value: 'name' }, { label: 'Телефон', value: 'phoneDisplay' },
      { label: 'Email', value: 'email' }, { label: 'Связь', value: 'preferredContact' }, { label: 'Заметка', value: 'notes' },
    ],
    vehicles: [
      { label: 'ID', value: 'id' }, { label: 'Владелец', value: (row) => state.clientName(row.clientId) }, { label: 'Марка', value: 'make' },
      { label: 'Модель', value: 'model' }, { label: 'Год', value: 'year' }, { label: 'VIN', value: 'vin' }, { label: 'Госномер', value: 'plate' }, { label: 'Пробег', value: 'mileage' },
    ],
    appointments: [
      { label: 'Дата', value: 'date' }, { label: 'Время', value: 'time' }, { label: 'Клиент', value: (row) => state.clientName(row.clientId) },
      { label: 'Автомобиль', value: (row) => state.vehicleName(row.vehicleId) }, { label: 'Причина', value: 'reason' }, { label: 'Статус', value: 'status' },
    ],
    workOrders: [
      { label: 'Номер', value: 'number' }, { label: 'Дата', value: 'acceptedDate' }, { label: 'Клиент', value: (row) => state.clientName(row.clientId) },
      { label: 'Автомобиль', value: (row) => state.vehicleName(row.vehicleId) }, { label: 'Статус', value: 'status' },
      { label: 'Сумма, коп.', value: (row) => calculateOrder(row, state.by('workOrderItems', 'workOrderId', row.id)).totalCents },
      { label: 'Оплата', value: (row) => {
        const total = calculateOrder(row, state.by('workOrderItems', 'workOrderId', row.id)).totalCents;
        return PAYMENT_STATUS_LABELS[calculatePaymentState(total, state.by('payments', 'workOrderId', row.id)).status];
      } },
    ],
    payments: [
      { label: 'Дата', value: 'date' }, { label: 'Заказ', value: (row) => state.get('workOrders', row.workOrderId)?.number || '' },
      { label: 'Тип', value: 'type' }, { label: 'Сумма, коп.', value: 'amountCents' }, { label: 'Способ', value: 'method' }, { label: 'Комментарий', value: 'comment' },
    ],
    expenses: [
      { label: 'Дата', value: 'date' }, { label: 'Категория', value: 'category' }, { label: 'Сумма, коп.', value: 'amountCents' },
      { label: 'Получатель', value: 'recipient' }, { label: 'Заказ', value: (row) => state.get('workOrders', row.workOrderId)?.number || '' },
      { label: 'Уже в себестоимости', value: (row) => row.includedInOrderCost ? 'Да' : 'Нет' },
    ],
  };
  const rows = state.data[entity] || [];
  const columns = definitions[entity];
  if (!columns) return;
  downloadFile(toCsv(rows, columns), `VN-MASTERS-${entity}-${todayIso()}.csv`, 'text/csv;charset=utf-8');
  toast('CSV-файл подготовлен.', 'success');
}

function exportReportCsv() {
  const report = renderReportValues();
  const rows = Object.entries(report).map(([name, value]) => ({ name, value }));
  downloadFile(toCsv(rows, [{ label: 'Показатель', value: 'name' }, { label: 'Сумма, коп.', value: 'value' }]), `VN-MASTERS-report-${todayIso()}.csv`, 'text/csv;charset=utf-8');
  toast('CSV-отчёт подготовлен.', 'success');
}

function renderReportValues() {
  const filters = routeFilters.reports || {};
  const today = todayIso();
  const from = filters.from || `${today.slice(0, 8)}01`;
  const to = filters.to || today;
  const orders = state.data.workOrders.filter((order) => ['quality', 'ready', 'delivered', 'closed'].includes(order.status) && order.acceptedDate >= from && order.acceptedDate <= to);
  const accrued = orders.reduce((sum, order) => sum + calculateOrder(order, state.by('workOrderItems', 'workOrderId', order.id)).totalCents, 0);
  return {
    'Начисленная выручка': accrued,
    'Количество реализованных заказов': orders.length,
    'Получено оплат': state.data.payments.filter((p) => p.date >= from && p.date <= to).reduce((sum, p) => sum + (p.type === 'refund' ? -p.amountCents : p.amountCents), 0),
    'Операционные расходы': state.data.expenses.filter((e) => e.date >= from && e.date <= to && !e.includedInOrderCost).reduce((sum, e) => sum + e.amountCents, 0),
  };
}

function showGlobalSearch(rawQuery) {
  const query = normalizeSearch(rawQuery);
  if (query.length < 2) {
    toast('Введите не менее двух символов для поиска.');
    return;
  }
  const results = [
    ...state.data.clients.filter((item) => normalizeSearch(`${item.name} ${item.phoneDisplay} ${item.email}`).includes(query)).map((item) => ({ entity: 'client', id: item.id, type: 'К', title: item.name, subtitle: item.phoneDisplay || 'Клиент' })),
    ...state.data.vehicles.filter((item) => normalizeSearch(`${item.make} ${item.model} ${item.plate} ${item.vin}`).includes(query)).map((item) => ({ entity: 'vehicle', id: item.id, type: 'А', title: `${item.make} ${item.model}`, subtitle: `${item.plate || 'без номера'} · ${state.clientName(item.clientId)}` })),
    ...state.data.workOrders.filter((item) => normalizeSearch(`${item.number} ${item.complaint} ${state.clientName(item.clientId)}`).includes(query)).map((item) => ({ entity: 'work-order', id: item.id, type: 'З', title: item.number, subtitle: `${state.clientName(item.clientId)} · ${item.complaint}` })),
  ].slice(0, 30);
  const body = results.length ? el('div', { class: 'search-results' }, results.map((result) => el('button', {
    type: 'button', class: 'search-result', dataset: { action: 'search-open', entity: result.entity, id: result.id },
  },
  el('span', { class: 'search-result-type', text: result.type }),
  el('span', null, el('strong', { text: result.title }), el('small', { text: result.subtitle })),
  el('span', { text: '→' }),
  ))) : el('div', { class: 'empty-state' }, el('strong', { text: 'Ничего не найдено' }), el('p', { text: 'Проверьте запрос или откройте нужный реестр.' }));
  openDialog({ title: `Поиск: ${rawQuery.trim()}`, eyebrow: `${results.length} результатов`, body });
}

function openSearchResult(entity, id) {
  closeDialog();
  if (entity === 'client') {
    navigate('clients');
    window.setTimeout(() => openEntityEditor('client', id), 30);
  } else if (entity === 'vehicle') {
    navigate('vehicles');
    window.setTimeout(() => openEntityEditor('vehicle', id), 30);
  } else {
    navigate('work-orders');
    window.setTimeout(() => openWorkOrderEditor(id), 30);
  }
}

function toggleSidebar() {
  const open = document.body.classList.toggle('sidebar-open');
  document.querySelector('[data-sidebar-toggle]').setAttribute('aria-expanded', String(open));
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  document.querySelector('[data-sidebar-toggle]').setAttribute('aria-expanded', 'false');
}

function showFatalError(error) {
  view.replaceChildren(el('div', { class: 'empty-state' },
    el('strong', { text: 'Локальную базу не удалось открыть' }),
    el('p', { text: error?.message || 'Неизвестная ошибка IndexedDB.' }),
    el('p', { text: 'Проверьте, что браузер разрешает локальное хранилище, и перезагрузите страницу.' }),
  ));
}

init();
