import { REALIZED_ORDER_STATUSES } from './constants.mjs';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const asInt = (value) => (Number.isFinite(Number(value)) ? Math.trunc(Number(value)) : 0);

export function calculateDiscount(baseCents, discountBps = 0) {
  const base = Math.max(0, asInt(baseCents));
  const bps = clamp(asInt(discountBps), 0, 10_000);
  return Math.round((base * bps) / 10_000);
}

export function calculateItem(item = {}) {
  const quantityMilli = Math.max(0, asInt(item.quantityMilli ?? 1000));
  const unitPriceCents = Math.max(0, asInt(item.unitPriceCents));
  const grossCents = Math.round((quantityMilli * unitPriceCents) / 1000);
  const discountCents = calculateDiscount(grossCents, item.discountBps);
  const totalCents = Math.max(0, grossCents - discountCents);

  let directCostCents = 0;
  if (item.type === 'work') {
    directCostCents = Math.max(0, asInt(item.laborCostCents));
  } else if (['part', 'material'].includes(item.type)) {
    directCostCents = Math.round((quantityMilli * Math.max(0, asInt(item.purchasePriceCents))) / 1000);
  } else {
    directCostCents = Math.max(0, asInt(item.directCostCents));
  }

  return {
    ...item,
    quantityMilli,
    unitPriceCents,
    grossCents,
    discountCents,
    totalCents,
    directCostCents,
    marginCents: totalCents - directCostCents,
  };
}

export function calculateOrder(order = {}, items = []) {
  const calculatedItems = items.filter((item) => !item.deletedAt).map(calculateItem);
  const subtotalCents = calculatedItems.reduce((sum, item) => sum + item.totalCents, 0);
  const orderDiscountCents = calculateDiscount(subtotalCents, order.discountBps);
  const totalCents = Math.max(0, subtotalCents - orderDiscountCents);
  const directCostCents = calculatedItems.reduce((sum, item) => sum + item.directCostCents, 0);
  const grossProfitCents = totalCents - directCostCents;
  const workRevenueCents = calculatedItems.filter((item) => item.type === 'work').reduce((sum, item) => sum + item.totalCents, 0);
  const partsRevenueCents = calculatedItems.filter((item) => ['part', 'material'].includes(item.type)).reduce((sum, item) => sum + item.totalCents, 0);
  return {
    items: calculatedItems,
    subtotalCents,
    orderDiscountCents,
    totalCents,
    directCostCents,
    grossProfitCents,
    workRevenueCents,
    partsRevenueCents,
  };
}

export function paymentEffect(payment = {}) {
  const amount = Math.abs(asInt(payment.amountCents));
  if (payment.type === 'refund') return -amount;
  if (payment.type === 'adjustment') return asInt(payment.amountCents);
  return amount;
}

export function calculatePaymentState(orderTotalCents = 0, payments = []) {
  const totalCents = Math.max(0, asInt(orderTotalCents));
  const activePayments = payments.filter((payment) => !payment.deletedAt);
  const receivedCents = activePayments.reduce((sum, payment) => sum + paymentEffect(payment), 0);
  const hasRefund = activePayments.some((payment) => payment.type === 'refund');
  const debtCents = Math.max(0, totalCents - receivedCents);
  const overpaymentCents = Math.max(0, receivedCents - totalCents);

  let status = 'unpaid';
  if (receivedCents > totalCents) status = 'overpaid';
  else if (totalCents > 0 && receivedCents === totalCents) status = 'paid';
  else if (hasRefund && receivedCents < totalCents) status = 'refund';
  else if (receivedCents > 0) status = 'partial';

  return { status, receivedCents, debtCents, overpaymentCents, hasRefund };
}

export const PAYMENT_STATUS_LABELS = {
  unpaid: 'Не оплачено',
  partial: 'Частично оплачено',
  paid: 'Оплачено',
  overpaid: 'Переплата',
  refund: 'Возврат / есть остаток',
};

function inDateRange(dateValue, from, to) {
  if (!dateValue) return false;
  const date = String(dateValue).slice(0, 10);
  return (!from || date >= from) && (!to || date <= to);
}

export function calculateFinanceReport({
  orders = [],
  items = [],
  payments = [],
  expenses = [],
  from = '',
  to = '',
} = {}) {
  const activeOrders = orders.filter((order) => !order.deletedAt && order.status !== 'cancelled');
  const realizedOrders = activeOrders.filter((order) => REALIZED_ORDER_STATUSES.has(order.status) && inDateRange(order.acceptedDate || order.createdAt, from, to));
  const orderById = new Map(activeOrders.map((order) => [order.id, order]));
  const itemsByOrder = new Map();
  items.filter((item) => !item.deletedAt).forEach((item) => {
    if (!itemsByOrder.has(item.workOrderId)) itemsByOrder.set(item.workOrderId, []);
    itemsByOrder.get(item.workOrderId).push(item);
  });

  const orderMetrics = realizedOrders.map((order) => ({
    order,
    ...calculateOrder(order, itemsByOrder.get(order.id) || []),
  }));

  const accruedRevenueCents = orderMetrics.reduce((sum, metric) => sum + metric.totalCents, 0);
  const workRevenueCents = orderMetrics.reduce((sum, metric) => sum + metric.workRevenueCents, 0);
  const partsRevenueCents = orderMetrics.reduce((sum, metric) => sum + metric.partsRevenueCents, 0);
  const directCostCents = orderMetrics.reduce((sum, metric) => sum + metric.directCostCents, 0);
  const grossProfitCents = accruedRevenueCents - directCostCents;

  const periodPayments = payments.filter((payment) => !payment.deletedAt && orderById.has(payment.workOrderId) && inDateRange(payment.date, from, to));
  const receivedCents = periodPayments.reduce((sum, payment) => sum + paymentEffect(payment), 0);

  const clientDebtCents = activeOrders.reduce((sum, order) => {
    const total = calculateOrder(order, itemsByOrder.get(order.id) || []).totalCents;
    const orderPayments = payments.filter((payment) => !payment.deletedAt && payment.workOrderId === order.id);
    return sum + calculatePaymentState(total, orderPayments).debtCents;
  }, 0);

  const periodExpenses = expenses.filter((expense) => !expense.deletedAt && inDateRange(expense.date, from, to));
  const operatingExpensesCents = periodExpenses
    .filter((expense) => !expense.includedInOrderCost)
    .reduce((sum, expense) => sum + Math.max(0, asInt(expense.amountCents)), 0);
  const linkedCostNotesCents = periodExpenses
    .filter((expense) => expense.includedInOrderCost)
    .reduce((sum, expense) => sum + Math.max(0, asInt(expense.amountCents)), 0);
  const operatingResultCents = grossProfitCents - operatingExpensesCents;

  return {
    orderMetrics,
    periodPayments,
    periodExpenses,
    accruedRevenueCents,
    receivedCents,
    clientDebtCents,
    workRevenueCents,
    partsRevenueCents,
    directCostCents,
    grossProfitCents,
    operatingExpensesCents,
    linkedCostNotesCents,
    operatingResultCents,
    ordersCount: realizedOrders.length,
    averageOrderCents: realizedOrders.length ? Math.round(accruedRevenueCents / realizedOrders.length) : 0,
  };
}

export function clientStatistics(clientId, { orders = [], items = [], payments = [] } = {}) {
  const clientOrders = orders.filter((order) => !order.deletedAt && order.clientId === clientId && order.status !== 'cancelled');
  const itemsByOrder = new Map();
  items.filter((item) => !item.deletedAt).forEach((item) => {
    if (!itemsByOrder.has(item.workOrderId)) itemsByOrder.set(item.workOrderId, []);
    itemsByOrder.get(item.workOrderId).push(item);
  });
  const totalBilledCents = clientOrders.reduce((sum, order) => sum + calculateOrder(order, itemsByOrder.get(order.id) || []).totalCents, 0);
  const receivedCents = payments
    .filter((payment) => !payment.deletedAt && clientOrders.some((order) => order.id === payment.workOrderId))
    .reduce((sum, payment) => sum + paymentEffect(payment), 0);
  const lastOrder = [...clientOrders].sort((a, b) => String(b.acceptedDate || b.createdAt).localeCompare(String(a.acceptedDate || a.createdAt)))[0];
  return {
    visits: clientOrders.length,
    totalBilledCents,
    receivedCents,
    debtCents: Math.max(0, totalBilledCents - receivedCents),
    averageOrderCents: clientOrders.length ? Math.round(totalBilledCents / clientOrders.length) : 0,
    lastOrderDate: lastOrder?.acceptedDate || lastOrder?.createdAt || '',
  };
}
