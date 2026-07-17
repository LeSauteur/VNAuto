import { DEFAULT_EXPENSE_CATEGORIES, DEFAULT_PAYMENT_METHODS } from './constants.mjs';
import { createBackup, createRecord, addDays, todayIso } from './utils.mjs';

const rec = (id, data) => createRecord({ ...data, id, demo: true }, id);
const work = (id, workOrderId, name, quantityMilli, unitPriceCents, laborCostCents, employeeId = 'emp-mechanic') => rec(id, {
  workOrderId,
  type: 'work',
  name,
  description: '',
  quantityMilli,
  unit: 'нормо-час',
  unitPriceCents,
  discountBps: 0,
  laborHoursMilli: quantityMilli,
  rateCents: unitPriceCents,
  actualMinutes: Math.round(quantityMilli * 60 / 1000),
  employeeId,
  laborCostCents,
  approved: true,
  completed: true,
  sortOrder: 10,
});

const part = (id, workOrderId, name, quantityMilli, unitPriceCents, purchasePriceCents, sku, supplierId = 'sup-1') => rec(id, {
  workOrderId,
  type: 'part',
  name,
  description: '',
  quantityMilli,
  unit: 'шт.',
  unitPriceCents,
  purchasePriceCents,
  discountBps: 0,
  sku,
  supplierId,
  warrantyNote: 'Демонстрационная строка — условия уточняются по документам заказа.',
  approved: true,
  completed: true,
  sortOrder: 20,
});

function demoClients() {
  const names = [
    'Демо: Алексей Северин',
    'Демо: Марина Ветрова',
    'Демо: Илья Берестов',
    'Демо: Ольга Ясная',
    'Демо: Тимофей Гранатов',
    'Демо: Софья Ладова',
    'Демо: Роман Полянский',
    'Демо: Вера Соколова',
  ];
  return names.map((name, index) => rec(`client-${index + 1}`, {
    name,
    normalizedPhone: `7000100000${index + 1}`,
    phoneDisplay: `+7 (000) 100-00-0${index + 1}`,
    secondaryPhone: '',
    email: `demo-client${index + 1}@example.invalid`,
    preferredContact: index % 2 ? 'SMS' : 'Звонок',
    notes: 'Вымышленная карточка для демонстрации.',
  }));
}

function demoVehicles() {
  const rows = [
    ['vehicle-1', 'client-1', 'Kia', 'Rio', 2018, 'VNMSTRS1A2B300001', 'ДЕМО01', 84200, 'Бензин'],
    ['vehicle-2', 'client-1', 'Ford', 'Focus', 2014, 'VNMSTRS1A2B300002', 'ДЕМО02', 132400, 'Бензин'],
    ['vehicle-3', 'client-2', 'Hyundai', 'Solaris', 2020, 'VNMSTRS1A2B300003', 'ДЕМО03', 61500, 'Бензин'],
    ['vehicle-4', 'client-2', 'Škoda', 'Octavia', 2017, 'VNMSTRS1A2B300004', 'ДЕМО04', 109700, 'Бензин'],
    ['vehicle-5', 'client-3', 'Volkswagen', 'Polo', 2019, 'VNMSTRS1A2B300005', 'ДЕМО05', 77500, 'Бензин'],
    ['vehicle-6', 'client-4', 'Nissan', 'Qashqai', 2016, 'VNMSTRS1A2B300006', 'ДЕМО06', 121800, 'Бензин'],
    ['vehicle-7', 'client-5', 'Honda', 'Civic', 2012, 'VNMSTRS1A2B300007', 'ДЕМО07', 166300, 'Бензин'],
    ['vehicle-8', 'client-6', 'BMW', '3 серия', 2015, 'VNMSTRS1A2B300008', 'ДЕМО08', 148900, 'Бензин'],
    ['vehicle-9', 'client-7', 'Mitsubishi', 'Outlander', 2018, 'VNMSTRS1A2B300009', 'ДЕМО09', 96300, 'Бензин'],
    ['vehicle-10', 'client-8', 'Opel', 'Astra', 2013, 'VNMSTRS1A2B300010', 'ДЕМО10', 173600, 'Бензин'],
    ['vehicle-11', 'client-8', 'Peugeot', '308', 2016, 'VNMSTRS1A2B300011', 'ДЕМО11', 118400, 'Дизель'],
  ];
  return rows.map(([id, clientId, make, model, year, vin, plate, mileage, engineType]) => rec(id, {
    clientId, make, model, year, vin, plate, mileage, engineType,
    generation: '',
    notes: 'Вымышленный автомобиль демонстрационной базы.',
    mileageHistory: [{ date: addDays(todayIso(), -60), mileage: Math.max(0, mileage - 3200) }, { date: todayIso(), mileage }],
  }));
}

function demoEmployees() {
  return [
    rec('emp-owner', { name: 'Демо: Андрей Мастеровой', role: 'Собственник', phone: '+7 (000) 200-00-01', active: true, rateNote: 'Справочно', notes: '' }),
    rec('emp-advisor', { name: 'Демо: Елена Приёмова', role: 'Мастер-приёмщик', phone: '+7 (000) 200-00-02', active: true, rateNote: 'Справочно', notes: '' }),
    rec('emp-mechanic', { name: 'Демо: Павел Механиков', role: 'Механик', phone: '+7 (000) 200-00-03', active: true, rateNote: 'Справочно', notes: '' }),
    rec('emp-electric', { name: 'Демо: Кирилл Токов', role: 'Механик', phone: '+7 (000) 200-00-04', active: true, rateNote: 'Справочно', notes: 'Автоэлектрика' }),
  ];
}

function demoOrders(today) {
  const definitions = [
    ['order-1', 'DEMO-VN-001', 'client-1', 'vehicle-1', -12, 'closed', 'approved', 'Неровная работа двигателя на холодном запуске.'],
    ['order-2', 'DEMO-VN-002', 'client-2', 'vehicle-3', -9, 'closed', 'approved', 'Плановое техническое обслуживание.'],
    ['order-3', 'DEMO-VN-003', 'client-3', 'vehicle-5', -2, 'in_progress', 'approved', 'Стук спереди на неровной дороге.'],
    ['order-4', 'DEMO-VN-004', 'client-4', 'vehicle-6', 0, 'approval', 'waiting', 'Изменилось усилие на педали тормоза.'],
    ['order-5', 'DEMO-VN-005', 'client-5', 'vehicle-7', -4, 'ready', 'approved', 'Не включалась часть наружного освещения.'],
    ['order-6', 'DEMO-VN-006', 'client-6', 'vehicle-8', -18, 'delivered', 'approved', 'Проверка и обслуживание ходовой части.'],
    ['order-7', 'DEMO-VN-007', 'client-7', 'vehicle-9', -1, 'quality', 'approved', 'Вибрация на скорости после смены колёс.'],
    ['order-8', 'DEMO-VN-008', 'client-8', 'vehicle-10', 1, 'planned', 'approved', 'Замена расходников по согласованному перечню.'],
    ['order-9', 'DEMO-VN-009', 'client-1', 'vehicle-2', 0, 'diagnostics', 'not_requested', 'Периодически горит индикатор неисправности.'],
    ['order-10', 'DEMO-VN-010', 'client-2', 'vehicle-4', -25, 'closed', 'approved', 'Обслуживание тормозной системы.'],
    ['order-11', 'DEMO-VN-011', 'client-8', 'vehicle-11', -31, 'closed', 'approved', 'Диагностика затруднённого запуска.'],
    ['order-12', 'DEMO-VN-012', 'client-3', 'vehicle-5', -6, 'cancelled', 'declined', 'Клиент отменил работы до начала ремонта.'],
  ];
  return definitions.map(([id, number, clientId, vehicleId, offset, status, approvalStatus, complaint], index) => rec(id, {
    number,
    clientId,
    vehicleId,
    acceptedDate: addDays(today, offset),
    plannedReadyDate: addDays(today, offset + 2),
    mileage: 60_000 + index * 8_700,
    complaint,
    diagnosis: status === 'diagnostics' ? '' : 'Демонстрационный результат проверки по описанной задаче.',
    recommendations: 'Следующий контроль — по состоянию и рекомендациям заказ-наряда.',
    internalNote: 'Демонстрационная запись. Не содержит данных реального клиента.',
    status,
    approvalStatus,
    employeeId: index % 4 === 4 ? 'emp-electric' : 'emp-mechanic',
    discountBps: index === 9 ? 500 : 0,
    sourceAppointmentId: '',
  }));
}

function demoItems() {
  return [
    work('item-1a', 'order-1', 'Диагностика и проверка двигателя', 2000, 150000, 80000),
    part('item-1b', 'order-1', 'Комплект расходных элементов', 1000, 250000, 200000, 'DEMO-P-001'),

    work('item-2a', 'order-2', 'Плановое техническое обслуживание', 2500, 160000, 110000),
    part('item-2b', 'order-2', 'Моторное масло и фильтры', 1000, 780000, 610000, 'DEMO-P-002'),

    work('item-3a', 'order-3', 'Диагностика ходовой части', 1500, 150000, 65000),
    part('item-3b', 'order-3', 'Втулки стабилизатора', 2000, 120000, 76000, 'DEMO-P-003'),

    work('item-4a', 'order-4', 'Проверка тормозной системы', 1200, 170000, 55000),
    part('item-4b', 'order-4', 'Тормозные колодки', 1000, 520000, 390000, 'DEMO-P-004'),

    work('item-5a', 'order-5', 'Диагностика электрической цепи', 2200, 180000, 95000, 'emp-electric'),
    part('item-5b', 'order-5', 'Лампы наружного освещения', 2000, 95000, 56000, 'DEMO-P-005'),

    work('item-6a', 'order-6', 'Работы по ходовой части', 3000, 170000, 135000),
    part('item-6b', 'order-6', 'Комплект деталей ходовой', 1000, 490000, 360000, 'DEMO-P-006'),

    work('item-7a', 'order-7', 'Шиномонтаж и балансировка', 1000, 280000, 90000),
    part('item-7b', 'order-7', 'Грузики и расходные материалы', 1000, 60000, 24000, 'DEMO-P-007'),

    work('item-8a', 'order-8', 'Замена расходных материалов', 1800, 150000, 72000),
    part('item-8b', 'order-8', 'Фильтры', 1000, 330000, 245000, 'DEMO-P-008'),

    work('item-9a', 'order-9', 'Комплексная диагностика', 1000, 180000, 50000),
    part('item-9b', 'order-9', 'Диагностические материалы', 1000, 30000, 12000, 'DEMO-P-009'),

    work('item-10a', 'order-10', 'Обслуживание тормозных механизмов', 2600, 160000, 120000),
    part('item-10b', 'order-10', 'Тормозные диски и колодки', 1000, 1120000, 840000, 'DEMO-P-010'),

    work('item-11a', 'order-11', 'Диагностика системы запуска', 2000, 170000, 85000, 'emp-electric'),
    part('item-11b', 'order-11', 'Электрический компонент', 1000, 470000, 330000, 'DEMO-P-011'),

    work('item-12a', 'order-12', 'Первичная проверка', 1000, 120000, 35000),
    part('item-12b', 'order-12', 'Материалы не устанавливались', 1000, 0, 0, 'DEMO-P-012'),
  ];
}

function demoPayments(today) {
  return [
    rec('payment-1', { workOrderId: 'order-1', date: addDays(today, -12), amountCents: 300000, method: 'СБП', type: 'payment', comment: 'Частичная оплата — контрольный пример.' }),
    rec('payment-2', { workOrderId: 'order-2', date: addDays(today, -9), amountCents: 1180000, method: 'Банковская карта', type: 'payment', comment: '' }),
    rec('payment-3', { workOrderId: 'order-3', date: addDays(today, -2), amountCents: 200000, method: 'Наличные', type: 'prepayment', comment: '' }),
    rec('payment-4', { workOrderId: 'order-5', date: addDays(today, -3), amountCents: 586000, method: 'СБП', type: 'payment', comment: '' }),
    rec('payment-5', { workOrderId: 'order-6', date: addDays(today, -18), amountCents: 1000000, method: 'Банковская карта', type: 'payment', comment: 'Полная оплата до возврата.' }),
    rec('payment-6', { workOrderId: 'order-6', date: addDays(today, -17), amountCents: 50000, method: 'Банковская карта', type: 'refund', comment: 'Демонстрационный возврат 500 ₽.' }),
    rec('payment-7', { workOrderId: 'order-7', date: addDays(today, -1), amountCents: 340000, method: 'Наличные', type: 'payment', comment: '' }),
    rec('payment-8', { workOrderId: 'order-10', date: addDays(today, -24), amountCents: 1500000, method: 'Безналичный расчёт', type: 'payment', comment: '' }),
    rec('payment-9', { workOrderId: 'order-11', date: addDays(today, -30), amountCents: 810000, method: 'Перевод', type: 'payment', comment: '' }),
  ];
}

function demoAppointments(today) {
  return [
    rec('appointment-1', { date: today, time: '10:00', clientId: 'client-4', vehicleId: 'vehicle-6', reason: 'Проверить торможение', status: 'confirmed', note: '' }),
    rec('appointment-2', { date: today, time: '13:30', clientId: 'client-1', vehicleId: 'vehicle-2', reason: 'Горит индикатор', status: 'new', note: 'Позвонить перед визитом.' }),
    rec('appointment-3', { date: today, time: '17:00', clientId: 'client-7', vehicleId: 'vehicle-9', reason: 'Контроль после работ', status: 'arrived', note: '' }),
    rec('appointment-4', { date: addDays(today, 1), time: '11:00', clientId: 'client-8', vehicleId: 'vehicle-10', reason: 'Плановое ТО', status: 'confirmed', note: '' }),
    rec('appointment-5', { date: addDays(today, 3), time: '15:00', clientId: 'client-5', vehicleId: 'vehicle-7', reason: 'Шум при движении', status: 'new', note: '' }),
    rec('appointment-6', { date: addDays(today, -1), time: '09:30', clientId: 'client-3', vehicleId: 'vehicle-5', reason: 'Осмотр ходовой', status: 'converted', workOrderId: 'order-3', note: '' }),
  ];
}

function demoExpenses(today) {
  return [
    rec('expense-1', { date: addDays(today, -12), category: 'Закупка запчастей', amountCents: 200000, method: 'Банковская карта', recipient: 'Демо-поставщик Север', workOrderId: 'order-1', comment: 'Уже включено в закупочную стоимость строки заказа.', recurring: false, documentNote: 'Демо-накладная', includedInOrderCost: true }),
    rec('expense-2', { date: addDays(today, -2), category: 'Расходные материалы', amountCents: 185000, method: 'Наличные', recipient: 'Демо-поставщик Север', workOrderId: '', comment: '', recurring: false, documentNote: 'Демонстрационная отметка', includedInOrderCost: false }),
    rec('expense-3', { date: today, category: 'Коммунальные услуги', amountCents: 94000, method: 'Перевод', recipient: 'Демо-получатель', workOrderId: '', comment: '', recurring: true, documentNote: '', includedInOrderCost: false }),
    rec('expense-4', { date: addDays(today, -8), category: 'Реклама', amountCents: 120000, method: 'Безналичный расчёт', recipient: 'Демо-площадка', workOrderId: '', comment: '', recurring: false, documentNote: '', includedInOrderCost: false }),
    rec('expense-5', { date: addDays(today, -15), category: 'Аренда', amountCents: 650000, method: 'Безналичный расчёт', recipient: 'Демо-арендодатель', workOrderId: '', comment: '', recurring: true, documentNote: 'Демо-документ', includedInOrderCost: false }),
  ];
}

function demoCatalogs() {
  const services = [
    ['service-1', 'Комплексная диагностика', 'Диагностика', 1000, 180000],
    ['service-2', 'Техническое обслуживание', 'ТО', 2500, 160000],
    ['service-3', 'Диагностика ходовой', 'Ходовая', 1500, 150000],
    ['service-4', 'Обслуживание тормозов', 'Тормоза', 2500, 160000],
    ['service-5', 'Диагностика автоэлектрики', 'Электрика', 2000, 180000],
    ['service-6', 'Шиномонтаж', 'Колёса', 1000, 280000],
  ].map(([id, name, category, recommendedHoursMilli, rateCents]) => rec(id, {
    name, category, recommendedHoursMilli, rateCents,
    suggestedPriceCents: Math.round(recommendedHoursMilli * rateCents / 1000),
    active: true,
  }));
  const suppliers = [
    rec('sup-1', { name: 'Демо-поставщик Север', phone: '+7 (000) 300-00-01', email: 'supplier1@example.invalid', notes: '' }),
    rec('sup-2', { name: 'Демо-поставщик Юг', phone: '+7 (000) 300-00-02', email: 'supplier2@example.invalid', notes: '' }),
    rec('sup-3', { name: 'Демо-поставщик Мотор', phone: '+7 (000) 300-00-03', email: 'supplier3@example.invalid', notes: '' }),
  ];
  const parts = [
    ['catalog-part-1', 'Масляный фильтр', 'DEMO-FLT-01', 'sup-1', 45000, 65000, 'шт.'],
    ['catalog-part-2', 'Воздушный фильтр', 'DEMO-FLT-02', 'sup-1', 70000, 98000, 'шт.'],
    ['catalog-part-3', 'Тормозные колодки', 'DEMO-BRK-01', 'sup-2', 390000, 520000, 'компл.'],
    ['catalog-part-4', 'Втулка стабилизатора', 'DEMO-SUS-01', 'sup-2', 38000, 60000, 'шт.'],
    ['catalog-part-5', 'Лампа наружного света', 'DEMO-EL-01', 'sup-3', 28000, 48000, 'шт.'],
  ].map(([id, name, sku, supplierId, purchasePriceCents, suggestedPriceCents, unit]) => rec(id, {
    name, sku, supplierId, purchasePriceCents, suggestedPriceCents, unit,
    notes: 'Демонстрационная позиция. Остатки не ведутся.',
  }));
  return { services, suppliers, parts };
}

export function createDemoBackup(referenceDate = todayIso()) {
  const catalogs = demoCatalogs();
  const data = {
    appointments: demoAppointments(referenceDate),
    clients: demoClients(),
    vehicles: demoVehicles(),
    workOrders: demoOrders(referenceDate),
    workOrderItems: demoItems(),
    payments: demoPayments(referenceDate),
    expenses: demoExpenses(referenceDate),
    employees: demoEmployees(),
    servicesCatalog: catalogs.services,
    partsCatalog: catalogs.parts,
    suppliers: catalogs.suppliers,
    expenseCategories: DEFAULT_EXPENSE_CATEGORIES.map((name, index) => rec(`expense-category-${index + 1}`, { name, active: true })),
    paymentMethods: DEFAULT_PAYMENT_METHODS.map((name, index) => rec(`payment-method-${index + 1}`, { name, active: true })),
    auditLog: [rec('audit-demo-load', { action: 'demo_loaded', entity: 'settings', entityId: 'demo', details: 'Загружена вымышленная демонстрационная база.', createdAt: new Date().toISOString() })],
    settings: [
      rec('onboardingComplete', { value: true }),
      rec('databaseMode', { value: 'demo-sample' }),
      rec('demoNoticeAccepted', { value: true }),
    ],
    trash: [],
  };
  return createBackup(data, { onboardingComplete: true, databaseMode: 'demo-sample' });
}

