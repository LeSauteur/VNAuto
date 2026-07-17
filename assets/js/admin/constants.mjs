export const APP_NAME = 'VN-MASTERS';
export const DB_NAME = 'vn-masters-demo';
export const DB_VERSION = 2;
export const SCHEMA_VERSION = 2;
export const DRAFT_VERSION = 2;
export const DRAFT_KEY = 'vnmasters.admin.workOrderDraft.v2';
export const UI_STATE_KEY = 'vnmasters.admin.ui.v2';

export const ENTITY_STORES = [
  'appointments',
  'clients',
  'vehicles',
  'workOrders',
  'workOrderItems',
  'payments',
  'expenses',
  'employees',
  'servicesCatalog',
  'partsCatalog',
  'suppliers',
  'expenseCategories',
  'paymentMethods',
  'auditLog',
  'settings',
  'trash',
];

export const BUSINESS_STORES = ENTITY_STORES.filter((name) => !['auditLog', 'settings', 'trash'].includes(name));

export const ORDER_STATUSES = [
  ['draft', 'Черновик'],
  ['diagnostics', 'Ожидает диагностики'],
  ['approval', 'Ожидает согласования'],
  ['approved', 'Согласован'],
  ['planned', 'Запланирован'],
  ['in_progress', 'В работе'],
  ['quality', 'Контроль качества'],
  ['ready', 'Готов к выдаче'],
  ['delivered', 'Выдан'],
  ['closed', 'Закрыт'],
  ['cancelled', 'Отменён'],
];

export const REALIZED_ORDER_STATUSES = new Set(['quality', 'ready', 'delivered', 'closed']);

export const APPROVAL_STATUSES = [
  ['not_requested', 'Не запрашивалось'],
  ['waiting', 'Ожидает ответа'],
  ['partial', 'Согласовано частично'],
  ['approved', 'Согласовано'],
  ['declined', 'Отклонено'],
];

export const APPOINTMENT_STATUSES = [
  ['new', 'Новая запись'],
  ['confirmed', 'Подтверждена'],
  ['arrived', 'Клиент приехал'],
  ['cancelled', 'Отменена'],
  ['no_show', 'Не приехал'],
  ['converted', 'Преобразована в заказ'],
];

export const PAYMENT_TYPES = [
  ['payment', 'Оплата'],
  ['prepayment', 'Предоплата'],
  ['surcharge', 'Доплата'],
  ['refund', 'Возврат'],
  ['adjustment', 'Корректировка'],
];

export const DEFAULT_PAYMENT_METHODS = [
  'Наличные',
  'Банковская карта',
  'СБП',
  'Перевод',
  'Безналичный расчёт',
  'Другое',
];

export const ITEM_TYPES = [
  ['work', 'Работа'],
  ['part', 'Запчасть'],
  ['material', 'Материал'],
  ['extra', 'Дополнительная услуга'],
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Закупка запчастей',
  'Расходные материалы',
  'Зарплата',
  'Аренда',
  'Коммунальные услуги',
  'Реклама',
  'Налоги',
  'Оборудование',
  'Ремонт помещения',
  'Банковские комиссии',
  'Возврат клиенту',
  'Прочее',
];

export const EMPLOYEE_ROLES = [
  'Собственник',
  'Администратор',
  'Мастер-приёмщик',
  'Механик',
  'Бухгалтер',
  'Другое',
];

export const ROUTES = [
  ['dashboard', 'Обзор'],
  ['appointments', 'Запись'],
  ['clients', 'Клиенты'],
  ['vehicles', 'Автомобили'],
  ['work-orders', 'Заказ-наряды'],
  ['payments', 'Платежи'],
  ['expenses', 'Расходы'],
  ['reports', 'Отчёты'],
  ['directories', 'Справочники'],
  ['employees', 'Сотрудники'],
  ['trash', 'Корзина и журнал'],
  ['settings', 'Настройки'],
];

export const ROUTE_TITLES = Object.fromEntries(ROUTES);

