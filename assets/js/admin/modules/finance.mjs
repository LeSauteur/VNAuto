import { PAYMENT_TYPES } from '../constants.mjs';
import { calculateFinanceReport, calculateOrder, calculatePaymentState, PAYMENT_STATUS_LABELS, paymentEffect } from '../calculations.mjs';
import { normalizeSearch, todayIso } from '../utils.mjs';
import { button, dateRangeText, emptyState, formatDate, formatMoney, metric, panel, statusBadge, table, textCell, viewHeader, el } from '../ui.mjs';

const paymentTypeLabels = Object.fromEntries(PAYMENT_TYPES);

export function renderPayments(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const rows = state.data.payments
    .filter((payment) => {
      const order = state.get('workOrders', payment.workOrderId);
      return !query || normalizeSearch(`${order?.number} ${state.clientName(order?.clientId)} ${payment.method} ${payment.comment}`).includes(query);
    })
    .sort((a, b) => String(b.date || b.createdAt).localeCompare(String(a.date || a.createdAt)));
  const net = rows.reduce((sum, payment) => sum + paymentEffect(payment), 0);

  return el('div', { class: 'view-stack' },
    viewHeader('Движение денег', 'Платежи и возвраты', 'Оплата хранится отдельной операцией. Статус заказа не редактируется вручную — он вычисляется по сумме заказа, платежам и возвратам.', [
      button('＋ Принять оплату', 'create-payment', { class: 'button button--primary' }),
      button('Оформить возврат', 'create-refund'),
    ]),
    el('section', { class: 'metric-grid' },
      metric('Операций', String(rows.length), 'В текущей выборке'),
      metric('Чистое поступление', formatMoney(net), 'Оплаты минус возвраты', net >= 0 ? 'green' : 'red'),
      metric('Возвратов', String(rows.filter((item) => item.type === 'refund').length), 'Хранятся отдельными операциями', 'purple'),
      metric('Долг клиентов', formatMoney(totalDebt(state)), 'Рассчитан по открытым заказам', 'amber'),
    ),
    panel('Журнал платежей', el('div', null,
      toolbar('payments', filters.query, 'Номер заказа, клиент, способ оплаты'),
      rows.length ? table([
        { label: 'Дата', render: (row) => formatDate(row.date) },
        { label: 'Заказ', render: (row) => {
          const order = state.get('workOrders', row.workOrderId);
          return textCell(order?.number || 'Заказ не найден', state.clientName(order?.clientId));
        } },
        { label: 'Тип', render: (row) => statusBadge(row.type === 'refund' ? 'refund' : 'paid', paymentTypeLabels[row.type] || row.type) },
        { label: 'Способ', render: (row) => row.method || '—' },
        { label: 'Сумма', render: (row) => el('strong', { style: { color: row.type === 'refund' ? 'var(--red)' : 'var(--green)' }, text: `${row.type === 'refund' ? '−' : ''}${formatMoney(Math.abs(row.amountCents))}` }) },
        { label: 'Комментарий', render: (row) => row.comment || '—' },
        { label: '', class: 'table-actions', render: (row) => actions('payment', row.id) },
      ], rows) : emptyState('Платежей пока нет', 'Добавьте оплату, предоплату, доплату или возврат, связав операцию с заказ-нарядом.'),
    ), { flush: true, subtitle: `${rows.length} операций` }),
  );
}

export function renderExpenses(state, filters = {}) {
  const query = normalizeSearch(filters.query || '');
  const rows = state.data.expenses
    .filter((expense) => !query || normalizeSearch(`${expense.category} ${expense.recipient} ${expense.comment} ${expense.documentNote}`).includes(query))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const total = rows.filter((expense) => !expense.includedInOrderCost).reduce((sum, expense) => sum + Number(expense.amountCents || 0), 0);
  const linked = rows.filter((expense) => expense.includedInOrderCost).reduce((sum, expense) => sum + Number(expense.amountCents || 0), 0);

  return el('div', { class: 'view-stack' },
    viewHeader('Операционные затраты', 'Расходы', 'Расход, уже включённый в себестоимость строки заказа, отмечается отдельно и не вычитается из результата второй раз.', [
      button('＋ Новый расход', 'create-expense', { class: 'button button--primary' }),
    ]),
    el('section', { class: 'metric-grid' },
      metric('Операционные расходы', formatMoney(total), 'Учитываются в финансовом результате', 'red'),
      metric('Связано с заказами', formatMoney(linked), 'Справочно, без повторного вычитания', 'amber'),
      metric('Операций', String(rows.length), 'В текущей выборке'),
      metric('Регулярных', String(rows.filter((item) => item.recurring).length), 'Помечены для контроля', 'purple'),
    ),
    panel('Журнал расходов', el('div', null,
      toolbar('expenses', filters.query, 'Категория, получатель, документ'),
      rows.length ? table([
        { label: 'Дата', render: (row) => formatDate(row.date) },
        { label: 'Категория', render: (row) => textCell(row.category, row.recurring ? 'Регулярный' : '') },
        { label: 'Получатель', render: (row) => row.recipient || '—' },
        { label: 'Сумма', render: (row) => formatMoney(row.amountCents) },
        { label: 'Заказ', render: (row) => row.workOrderId ? state.get('workOrders', row.workOrderId)?.number || 'Не найден' : '—' },
        { label: 'Учёт', render: (row) => statusBadge(row.includedInOrderCost ? 'amber' : 'paid', row.includedInOrderCost ? 'В себестоимости заказа' : 'Операционный') },
        { label: '', class: 'table-actions', render: (row) => actions('expense', row.id) },
      ], rows) : emptyState('Расходов пока нет', 'Добавляйте операционные затраты и при необходимости связывайте закупку с заказом.'),
    ), { flush: true, subtitle: `${rows.length} операций` }),
  );
}

export function renderReports(state, filters = {}) {
  const today = todayIso();
  const from = filters.from || `${today.slice(0, 8)}01`;
  const to = filters.to || today;
  const report = calculateFinanceReport({
    orders: state.data.workOrders,
    items: state.data.workOrderItems,
    payments: state.data.payments,
    expenses: state.data.expenses,
    from,
    to,
  });
  const categories = new Map();
  for (const expense of report.periodExpenses.filter((item) => !item.includedInOrderCost)) {
    categories.set(expense.category || 'Без категории', (categories.get(expense.category || 'Без категории') || 0) + Number(expense.amountCents || 0));
  }
  const max = Math.max(1, ...categories.values());

  return el('div', { class: 'view-stack' },
    el('div', { class: 'print-only' }, el('h1', { text: 'VN-MASTERS — демонстрационный финансовый отчёт' }), el('p', { text: dateRangeText(from, to) })),
    viewHeader('Управленческий срез', 'Финансовые отчёты', 'Начисленная выручка строится по реализованным заказам, денежный поток — по операциям оплаты. Это демонстрационный управленческий отчёт, не бухгалтерская отчётность.', [
      button('Печать / PDF', 'print-report'),
      button('CSV отчёта', 'export-reports-csv', { class: 'button button--primary' }),
    ]),
    el('div', { class: 'toolbar' },
      el('label', { class: 'field' }, el('span', { class: 'field-label', text: 'С' }), el('input', { type: 'date', value: from, dataset: { reportFrom: 'true' } })),
      el('label', { class: 'field' }, el('span', { class: 'field-label', text: 'По' }), el('input', { type: 'date', value: to, dataset: { reportTo: 'true' } })),
      el('span', { style: { color: 'var(--text-soft)', fontSize: '.72rem' }, text: dateRangeText(from, to) }),
    ),
    el('section', { class: 'metric-grid' },
      metric('Начисленная выручка', formatMoney(report.accruedRevenueCents), `${report.ordersCount} реализованных заказов`, 'green'),
      metric('Получено денег', formatMoney(report.receivedCents), 'Оплаты с учётом возвратов'),
      metric('Валовая прибыль', formatMoney(report.grossProfitCents), 'Выручка минус прямые затраты', report.grossProfitCents >= 0 ? 'green' : 'red'),
      metric('Расчётный результат', formatMoney(report.operatingResultCents), 'После операционных расходов', report.operatingResultCents >= 0 ? 'green' : 'red'),
    ),
    el('div', { class: 'content-grid content-grid--equal' },
      panel('Структура результата', el('div', { class: 'list' },
        financeLine('Работы', report.workRevenueCents),
        financeLine('Запчасти и материалы', report.partsRevenueCents),
        financeLine('Прямые затраты заказов', -report.directCostCents),
        financeLine('Операционные расходы', -report.operatingExpensesCents),
        financeLine('Результат', report.operatingResultCents, true),
      ), { subtitle: 'Метод начисления для реализованных заказов' }),
      panel('Расходы по категориям', categories.size ? el('div', { class: 'chart-bars' },
        [...categories.entries()].slice(0, 6).map(([name, amount]) => el('div', { class: 'chart-bar' },
          el('span', { style: { height: `${Math.max(4, Math.round(amount / max * 140))}px` }, title: `${name}: ${formatMoney(amount)}` }),
          el('small', { text: name }),
        )),
      ) : emptyState('Нет расходов в периоде', 'Измените диапазон или добавьте операцию.'), { subtitle: 'Без сумм, уже включённых в себестоимость заказов' }),
    ),
    panel('Контрольные показатели', el('div', { class: 'list' },
      financeLine('Средний реализованный заказ', report.averageOrderCents),
      financeLine('Общий долг клиентов', report.clientDebtCents),
      financeLine('Связанные закупки (справочно)', report.linkedCostNotesCents),
    ), { subtitle: 'Долг рассчитывается по всем незакрытым и неоплаченным заказам' }),
  );
}

function totalDebt(state) {
  return state.data.workOrders.filter((order) => order.status !== 'cancelled').reduce((sum, order) => {
    const total = calculateOrder(order, state.by('workOrderItems', 'workOrderId', order.id)).totalCents;
    return sum + calculatePaymentState(total, state.by('payments', 'workOrderId', order.id)).debtCents;
  }, 0);
}

function toolbar(entity, query, placeholder) {
  return el('div', { class: 'toolbar' },
    el('label', { class: 'toolbar-search' },
      el('span', { text: '⌕', 'aria-hidden': 'true' }),
      el('input', { type: 'search', value: query || '', placeholder, dataset: { listSearch: entity }, 'aria-label': placeholder }),
    ),
    button('CSV', `export-${entity}-csv`, { class: 'button button--ghost button--compact' }),
  );
}

function actions(entity, id) {
  return el('div', { class: 'table-actions' },
    button('Изменить', `edit-${entity}`, { class: 'table-action', dataset: { id } }),
    button('Удалить', `delete-${entity}`, { class: 'table-action table-action--danger', dataset: { id } }),
  );
}

function financeLine(label, value, emphasis = false) {
  return el('div', { class: 'list-item' },
    el('div', { class: 'list-item-main' }, el('strong', { text: label })),
    el('strong', { class: 'list-item-value', style: emphasis ? { color: value >= 0 ? 'var(--green)' : 'var(--red)' } : {}, text: formatMoney(value) }),
  );
}
