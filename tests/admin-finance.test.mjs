import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateFinanceReport, calculateItem, calculateOrder, calculatePaymentState,
  clientStatistics, paymentEffect,
} from '../assets/js/admin/calculations.mjs';
import { parseMoney } from '../assets/js/admin/formatters.mjs';

test('сумма заказа считается в целых копейках с количеством и скидкой', () => {
  const order = { id: 'o1', discountBps: 500 };
  const items = [
    { id: 'i1', workOrderId: 'o1', type: 'work', quantityMilli: 1500, unitPriceCents: 200000, laborCostCents: 80000 },
    { id: 'i2', workOrderId: 'o1', type: 'part', quantityMilli: 2000, unitPriceCents: 50000, purchasePriceCents: 30000 },
  ];
  const result = calculateOrder(order, items);
  assert.equal(result.subtotalCents, 400000);
  assert.equal(result.orderDiscountCents, 20000);
  assert.equal(result.totalCents, 380000);
  assert.equal(result.directCostCents, 140000);
  assert.equal(result.grossProfitCents, 240000);
});

test('повторный расчёт и редактирование не накапливают сумму', () => {
  const order = { id: 'o1', discountBps: 0 };
  const item = { id: 'i1', workOrderId: 'o1', type: 'work', quantityMilli: 1000, unitPriceCents: 150000, laborCostCents: 50000 };
  const before = calculateOrder(order, [item]);
  const after = calculateOrder({ ...order, complaint: 'Изменён текст' }, [{ ...item, name: 'Изменено название' }]);
  assert.equal(before.totalCents, 150000);
  assert.equal(after.totalCents, 150000);
});

test('частичная оплата, полная оплата и переплата вычисляются автоматически', () => {
  assert.deepEqual(calculatePaymentState(550000, [{ type: 'payment', amountCents: 300000 }]), {
    status: 'partial', receivedCents: 300000, debtCents: 250000, overpaymentCents: 0, hasRefund: false,
  });
  assert.equal(calculatePaymentState(550000, [{ type: 'payment', amountCents: 550000 }]).status, 'paid');
  assert.equal(calculatePaymentState(550000, [{ type: 'payment', amountCents: 600000 }]).status, 'overpaid');
});

test('возврат уменьшает чистое поступление и снова создаёт остаток', () => {
  const payments = [
    { type: 'payment', amountCents: 1000000 },
    { type: 'refund', amountCents: 50000 },
  ];
  assert.equal(paymentEffect(payments[1]), -50000);
  const result = calculatePaymentState(1000000, payments);
  assert.equal(result.receivedCents, 950000);
  assert.equal(result.debtCents, 50000);
  assert.equal(result.status, 'refund');
});

test('расход, уже включённый в себестоимость заказа, не вычитается второй раз', () => {
  const report = calculateFinanceReport({
    from: '2026-07-01',
    to: '2026-07-31',
    orders: [{ id: 'o1', status: 'closed', acceptedDate: '2026-07-10' }],
    items: [{ id: 'i1', workOrderId: 'o1', type: 'part', quantityMilli: 1000, unitPriceCents: 500000, purchasePriceCents: 300000 }],
    payments: [{ id: 'p1', workOrderId: 'o1', type: 'payment', amountCents: 500000, date: '2026-07-10' }],
    expenses: [
      { id: 'e1', date: '2026-07-10', amountCents: 300000, includedInOrderCost: true },
      { id: 'e2', date: '2026-07-11', amountCents: 50000, includedInOrderCost: false },
    ],
  });
  assert.equal(report.accruedRevenueCents, 500000);
  assert.equal(report.directCostCents, 300000);
  assert.equal(report.operatingExpensesCents, 50000);
  assert.equal(report.linkedCostNotesCents, 300000);
  assert.equal(report.operatingResultCents, 150000);
});

test('визиты клиента выводятся из заказов, а не увеличиваются при редактировании', () => {
  const data = {
    orders: [
      { id: 'o1', clientId: 'c1', status: 'closed', acceptedDate: '2026-07-01' },
      { id: 'o2', clientId: 'c1', status: 'in_progress', acceptedDate: '2026-07-02' },
      { id: 'o3', clientId: 'c2', status: 'closed', acceptedDate: '2026-07-03' },
    ],
    items: [],
    payments: [],
  };
  assert.equal(clientStatistics('c1', data).visits, 2);
  data.orders[0] = { ...data.orders[0], complaint: 'Редактирование' };
  assert.equal(clientStatistics('c1', data).visits, 2);
});

test('расчёт строки не мутирует исходную запись', () => {
  const source = Object.freeze({ type: 'work', quantityMilli: 1000, unitPriceCents: 10000, laborCostCents: 4000 });
  const result = calculateItem(source);
  assert.equal(result.totalCents, 10000);
  assert.equal(source.totalCents, undefined);
});

test('денежный ввод с точкой и запятой не теряет десятичный разделитель', () => {
  assert.equal(parseMoney('1234.56'), 123456);
  assert.equal(parseMoney('1 234,56 ₽'), 123456);
  assert.equal(parseMoney('2000'), 200000);
});

test('контрольный пример: 2 часа и запчасть дают 5 500 ₽, оплата 3 000 ₽ оставляет 2 500 ₽', () => {
  const order = { id: 'control-order', clientId: 'control-client', status: 'closed', acceptedDate: '2026-07-17', discountBps: 0 };
  const items = [
    { id: 'work', workOrderId: order.id, type: 'work', quantityMilli: 2000, unitPriceCents: 150000, laborCostCents: 0 },
    { id: 'part', workOrderId: order.id, type: 'part', quantityMilli: 1000, unitPriceCents: 250000, purchasePriceCents: 200000 },
  ];
  const total = calculateOrder(order, items);
  const payment = calculatePaymentState(total.totalCents, [{ workOrderId: order.id, type: 'payment', amountCents: 300000 }]);
  assert.equal(total.totalCents, 550000);
  assert.equal(total.directCostCents, 200000);
  assert.equal(payment.receivedCents, 300000);
  assert.equal(payment.debtCents, 250000);
  assert.equal(payment.status, 'partial');
});

test('контрольный пример редактирования: цена 2 700 ₽ даёт один заказ на 5 700 ₽', () => {
  const order = { id: 'control-order', clientId: 'control-client', status: 'closed', acceptedDate: '2026-07-17', discountBps: 0 };
  const items = [
    { id: 'work', workOrderId: order.id, type: 'work', quantityMilli: 2000, unitPriceCents: 150000 },
    { id: 'part', workOrderId: order.id, type: 'part', quantityMilli: 1000, unitPriceCents: 270000, purchasePriceCents: 200000 },
  ];
  const statistics = clientStatistics(order.clientId, { orders: [order], items, payments: [] });
  assert.equal(calculateOrder(order, items).totalCents, 570000);
  assert.equal(statistics.visits, 1);
  assert.equal(statistics.totalBilledCents, 570000);
  assert.notEqual(statistics.totalBilledCents, 1120000);
});
