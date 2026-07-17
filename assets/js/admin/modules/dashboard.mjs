import { APPOINTMENT_STATUSES, ORDER_STATUSES } from '../constants.mjs';
import { calculateFinanceReport, calculateOrder, calculatePaymentState, PAYMENT_STATUS_LABELS } from '../calculations.mjs';
import { addDays, todayIso } from '../utils.mjs';
import { button, emptyState, formatDate, formatMoney, metric, panel, statusBadge, textCell, viewHeader, el } from '../ui.mjs';

const labels = (rows) => Object.fromEntries(rows);

export function renderDashboard(state) {
  const data = state.data;
  const today = todayIso();
  const monthStart = `${today.slice(0, 8)}01`;
  const finance = calculateFinanceReport({
    orders: data.workOrders,
    items: data.workOrderItems,
    payments: data.payments,
    expenses: data.expenses,
    from: monthStart,
    to: today,
  });
  const orderLabels = labels(ORDER_STATUSES);
  const appointmentLabels = labels(APPOINTMENT_STATUSES);
  const todayAppointments = data.appointments
    .filter((item) => item.date === today)
    .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const activeOrders = data.workOrders
    .filter((order) => !['closed', 'delivered', 'cancelled'].includes(order.status))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const itemsByOrder = (id) => data.workOrderItems.filter((item) => item.workOrderId === id);

  const root = el('div', { class: 'view-stack' });
  root.append(
    viewHeader(
      'Сегодня в сервисе',
      'Рабочая картина без лишнего шума',
      'Записи, активные заказы и финансовые показатели рассчитываются из локальной базы в реальном времени.',
      [
        button('Новый заказ', 'create-work-order', { class: 'button button--primary' }),
        button('Новая запись', 'create-appointment'),
      ],
    ),
    el('section', { class: 'metric-grid', 'aria-label': 'Ключевые показатели' },
      metric('Записей сегодня', String(todayAppointments.length), `${data.appointments.filter((item) => item.date > today && item.date <= addDays(today, 7)).length} на ближайшие 7 дней`),
      metric('Активных заказов', String(activeOrders.length), `${activeOrders.filter((order) => order.status === 'approval').length} ждут согласования`, 'amber'),
      metric('Начислено за месяц', formatMoney(finance.accruedRevenueCents), `${finance.ordersCount} реализованных заказов`, 'green'),
      metric('Долг по открытым заказам', formatMoney(finance.clientDebtCents), 'Статус оплаты вычисляется автоматически', finance.clientDebtCents ? 'red' : 'green'),
    ),
  );

  const appointmentList = todayAppointments.length
    ? el('ul', { class: 'list' }, todayAppointments.map((appointment) => el('li', { class: 'list-item' },
      el('strong', { class: 'list-item-value', text: appointment.time || '—' }),
      el('div', { class: 'list-item-main' },
        el('strong', { text: state.clientName(appointment.clientId) }),
        el('small', { text: `${state.vehicleName(appointment.vehicleId)} · ${appointment.reason || 'Причина не указана'}` }),
      ),
      statusBadge(appointment.status, appointmentLabels[appointment.status]),
    )))
    : emptyState('Сегодня свободно', 'Записей на текущую дату пока нет.', button('Добавить запись', 'create-appointment', { class: 'button button--primary' }));

  const activeRows = activeOrders.slice(0, 6).map((order) => {
    const total = calculateOrder(order, itemsByOrder(order.id)).totalCents;
    const paymentState = calculatePaymentState(total, data.payments.filter((payment) => payment.workOrderId === order.id));
    return el('li', { class: 'list-item' },
      el('div', { class: 'list-item-main' },
        el('button', { class: 'row-link', type: 'button', dataset: { action: 'edit-work-order', id: order.id }, text: order.number }),
        el('small', { text: `${state.clientName(order.clientId)} · ${state.vehicleName(order.vehicleId)}` }),
      ),
      el('div', { class: 'list-item-value' },
        el('strong', { text: formatMoney(total) }),
        el('small', { text: PAYMENT_STATUS_LABELS[paymentState.status] }),
      ),
      statusBadge(order.status, orderLabels[order.status]),
    );
  });

  root.append(el('div', { class: 'content-grid' },
    panel('Расписание на сегодня', appointmentList, {
      subtitle: formatDate(today),
      action: button('Все записи', 'go-appointments', { class: 'button button--ghost button--compact' }),
    }),
    panel('Быстрые действия', el('div', { class: 'quick-actions' },
      quick('＋', 'Клиент', 'create-client'),
      quick('◇', 'Автомобиль', 'create-vehicle'),
      quick('▤', 'Заказ-наряд', 'create-work-order'),
      quick('₽', 'Принять оплату', 'create-payment'),
    ), { subtitle: 'Частые операции в один шаг' }),
  ));

  root.append(el('div', { class: 'content-grid' },
    panel('Заказы в работе', activeRows.length ? el('ul', { class: 'list' }, activeRows) : emptyState('Нет активных заказов', 'Создайте заказ-наряд, чтобы начать работу.'), {
      subtitle: 'Сумма и оплата пересчитываются из строк и платежей',
      action: button('Все заказы', 'go-work-orders', { class: 'button button--ghost button--compact' }),
    }),
    panel('Денежный поток месяца', el('div', { class: 'list' },
      financeLine('Получено оплат', finance.receivedCents),
      financeLine('Прямые затраты заказов', finance.directCostCents),
      financeLine('Операционные расходы', finance.operatingExpensesCents),
      financeLine('Расчётный результат', finance.operatingResultCents, true),
    ), { subtitle: 'Не является бухгалтерской отчётностью' }),
  ));

  return root;
}

function quick(symbol, label, action) {
  return el('button', { type: 'button', class: 'quick-action', dataset: { action } },
    el('span', { text: symbol }),
    el('strong', { text: label }),
  );
}

function financeLine(label, value, accent = false) {
  return el('div', { class: 'list-item' },
    el('div', { class: 'list-item-main' }, el('strong', { text: label })),
    el('strong', { class: 'list-item-value', style: accent ? { color: value >= 0 ? 'var(--green)' : 'var(--red)' } : {}, text: formatMoney(value) }),
  );
}
