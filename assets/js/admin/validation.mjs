import { ENTITY_STORES, SCHEMA_VERSION } from './constants.mjs';
import { normalizePhone, normalizeText, normalizeVin } from './utils.mjs';

const currentYear = () => new Date().getFullYear();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const vinPattern = /^[A-HJ-NPR-Z0-9]{17}$/;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function result(errors = [], warnings = []) {
  return { valid: errors.length === 0, errors, warnings };
}

export function validatePhone(value, { required = true } = {}) {
  const normalized = normalizePhone(value);
  if (!normalized && !required) return result();
  if (!/^7\d{10}$/.test(normalized)) return result(['Введите российский телефон из 11 цифр, начинающийся с +7.']);
  return result();
}

export function validateEmail(value) {
  if (!value) return result();
  return emailPattern.test(String(value).trim()) ? result() : result(['Проверьте адрес электронной почты.']);
}

export function validateVin(value) {
  if (!value) return result();
  return vinPattern.test(normalizeVin(value))
    ? result()
    : result(['VIN должен содержать 17 допустимых латинских букв и цифр без I, O и Q.']);
}

export function validateYear(value) {
  if (value === '' || value == null) return result();
  const year = Number(value);
  return Number.isInteger(year) && year >= 1950 && year <= currentYear() + 1
    ? result()
    : result([`Год должен быть от 1950 до ${currentYear() + 1}.`]);
}

export function validateDate(value, { required = false } = {}) {
  if (!value && !required) return result();
  if (!datePattern.test(String(value))) return result(['Дата должна быть в формате ГГГГ-ММ-ДД.']);
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? result(['Указана некорректная дата.']) : result();
}

export function combineResults(...results) {
  return result(results.flatMap((entry) => entry.errors), results.flatMap((entry) => entry.warnings));
}

export function validateClient(client = {}, existingClients = []) {
  const errors = [];
  const warnings = [];
  if (!normalizeText(client.name)) errors.push('Укажите имя клиента.');
  errors.push(...validatePhone(client.phoneDisplay || client.normalizedPhone).errors);
  errors.push(...validatePhone(client.secondaryPhone, { required: false }).errors);
  errors.push(...validateEmail(client.email).errors);

  const normalized = normalizePhone(client.phoneDisplay || client.normalizedPhone);
  const duplicate = existingClients.find((candidate) => !candidate.deletedAt && candidate.id !== client.id && candidate.normalizedPhone === normalized);
  if (duplicate) warnings.push(`Возможный дубль: ${duplicate.name}. Проверьте карточку перед сохранением.`);
  return result(errors, warnings);
}

export function validateVehicle(vehicle = {}) {
  const errors = [];
  if (!vehicle.clientId) errors.push('Выберите владельца автомобиля.');
  if (!normalizeText(vehicle.make)) errors.push('Укажите марку.');
  if (!normalizeText(vehicle.model)) errors.push('Укажите модель.');
  errors.push(...validateYear(vehicle.year).errors);
  errors.push(...validateVin(vehicle.vin).errors);
  if (vehicle.mileage != null && vehicle.mileage !== '' && (!Number.isFinite(Number(vehicle.mileage)) || Number(vehicle.mileage) < 0)) errors.push('Пробег не может быть отрицательным.');
  return result(errors);
}

export function validateAppointment(appointment = {}) {
  const errors = [];
  if (!appointment.clientId) errors.push('Выберите клиента.');
  if (!appointment.vehicleId) errors.push('Выберите автомобиль.');
  errors.push(...validateDate(appointment.date, { required: true }).errors);
  if (!/^\d{2}:\d{2}$/.test(String(appointment.time || ''))) errors.push('Укажите время записи.');
  if (!normalizeText(appointment.reason)) errors.push('Опишите причину обращения.');
  return result(errors);
}

export function validateWorkOrder(order = {}, items = []) {
  const errors = [];
  if (!order.clientId) errors.push('Выберите клиента.');
  if (!order.vehicleId) errors.push('Выберите автомобиль.');
  errors.push(...validateDate(order.acceptedDate, { required: true }).errors);
  if (order.plannedReadyDate) errors.push(...validateDate(order.plannedReadyDate).errors);
  if (order.mileage != null && order.mileage !== '' && (!Number.isFinite(Number(order.mileage)) || Number(order.mileage) < 0)) errors.push('Пробег при приёме не может быть отрицательным.');
  if (!normalizeText(order.complaint)) errors.push('Запишите жалобу или задачу клиента.');
  if (!Array.isArray(items) || items.length === 0) errors.push('Добавьте хотя бы одну строку работы, запчасти или материала.');
  items.forEach((item, index) => {
    if (!normalizeText(item.name)) errors.push(`Строка ${index + 1}: укажите название.`);
    if (!Number.isInteger(Number(item.quantityMilli)) || Number(item.quantityMilli) <= 0) errors.push(`Строка ${index + 1}: количество должно быть больше нуля.`);
    if (!Number.isInteger(Number(item.unitPriceCents)) || Number(item.unitPriceCents) < 0) errors.push(`Строка ${index + 1}: проверьте цену клиенту.`);
    if (Number(item.discountBps) < 0 || Number(item.discountBps) > 10_000) errors.push(`Строка ${index + 1}: скидка должна быть от 0 до 100%.`);
  });
  return result(errors);
}

export function validatePayment(payment = {}, orderIds = []) {
  const errors = [];
  if (!payment.workOrderId || (orderIds.length && !orderIds.includes(payment.workOrderId))) errors.push('Выберите существующий заказ.');
  errors.push(...validateDate(payment.date, { required: true }).errors);
  if (!Number.isInteger(Number(payment.amountCents)) || Number(payment.amountCents) <= 0) errors.push('Сумма платежа должна быть больше нуля.');
  if (!payment.method) errors.push('Выберите способ оплаты.');
  if (!payment.type) errors.push('Выберите тип операции.');
  return result(errors);
}

export function validateExpense(expense = {}, orderIds = []) {
  const errors = [];
  errors.push(...validateDate(expense.date, { required: true }).errors);
  if (!Number.isInteger(Number(expense.amountCents)) || Number(expense.amountCents) <= 0) errors.push('Сумма расхода должна быть больше нуля.');
  if (!expense.category) errors.push('Выберите категорию.');
  if (expense.workOrderId && orderIds.length && !orderIds.includes(expense.workOrderId)) errors.push('Привязанный заказ не найден.');
  return result(errors);
}

export function validateBackup(value) {
  const errors = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result(['Файл не содержит объект резервной копии.']);
  if (value.product !== 'VN-MASTERS demo admin') errors.push('Файл создан не демонстрационной панелью VN-MASTERS.');
  if (!Number.isInteger(value.schemaVersion) || value.schemaVersion < 1 || value.schemaVersion > SCHEMA_VERSION) errors.push(`Неподдерживаемая версия схемы: ${value.schemaVersion ?? 'не указана'}.`);
  if (!value.data || typeof value.data !== 'object' || Array.isArray(value.data)) errors.push('В файле отсутствует раздел data.');
  if (value.data) {
    for (const [entity, records] of Object.entries(value.data)) {
      if (!ENTITY_STORES.includes(entity)) errors.push(`Неизвестная сущность: ${entity}.`);
      else if (!Array.isArray(records)) errors.push(`Раздел ${entity} должен быть массивом.`);
      else if (records.some((record) => !record || typeof record !== 'object' || Array.isArray(record) || !record.id)) errors.push(`В разделе ${entity} есть запись без устойчивого ID.`);
    }
  }
  return result(errors);
}

