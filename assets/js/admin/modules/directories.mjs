import { formatMoney } from '../formatters.mjs';
import { button, emptyState, panel, statusBadge, table, textCell, viewHeader, el } from '../ui.mjs';

const directoryDefinitions = [
  ['servicesCatalog', 'Услуги', 'Нормативы и рекомендуемые ставки для строк работ'],
  ['partsCatalog', 'Запчасти', 'Подсказки наименований и закупочных цен без складского учёта'],
  ['suppliers', 'Поставщики', 'Контакты поставщиков и заметки'],
  ['expenseCategories', 'Категории расходов', 'Классификация операционных затрат'],
  ['paymentMethods', 'Способы оплаты', 'Список способов для финансовых операций'],
];

export function renderDirectories(state, filters = {}) {
  const active = directoryDefinitions.some(([id]) => id === filters.tab) ? filters.tab : 'servicesCatalog';
  const definition = directoryDefinitions.find(([id]) => id === active);
  const records = state.data[active] || [];

  const tabs = el('div', { class: 'segmented', style: { flexWrap: 'wrap' } },
    directoryDefinitions.map(([id, label]) => el('button', {
      type: 'button',
      text: label,
      'aria-pressed': id === active ? 'true' : 'false',
      dataset: { action: 'directory-tab', tab: id },
    })),
  );

  const content = records.length ? table(columnsFor(active, state), records) : emptyState(
    'Справочник пуст',
    'Добавьте первую запись. Справочники ускоряют ввод, но не подменяют документ заказа.',
    button('Добавить запись', 'create-directory-record', { class: 'button button--primary', dataset: { entity: active } }),
  );

  return el('div', { class: 'view-stack' },
    viewHeader('Настраиваемые подсказки', 'Справочники', 'Локальные справочники ускоряют создание документов. Остатки склада, бронирование деталей и закупочные заказы в этот этап не входят.', [
      button(`＋ Добавить: ${definition[1].toLowerCase()}`, 'create-directory-record', { class: 'button button--primary', dataset: { entity: active } }),
    ]),
    panel(definition[1], el('div', null,
      el('div', { class: 'toolbar' }, tabs),
      content,
    ), { flush: true, subtitle: `${records.length} записей · ${definition[2]}` }),
  );
}

function columnsFor(entity, state) {
  const actionColumn = { label: '', class: 'table-actions', render: (row) => el('div', { class: 'table-actions' },
    button('Изменить', 'edit-directory-record', { class: 'table-action', dataset: { id: row.id, entity } }),
    button('Удалить', 'delete-directory-record', { class: 'table-action table-action--danger', dataset: { id: row.id, entity } }),
  ) };
  if (entity === 'servicesCatalog') return [
    { label: 'Услуга', render: (row) => textCell(row.name, row.category || 'Без категории') },
    { label: 'Норматив', render: (row) => row.recommendedHoursMilli ? `${Number(row.recommendedHoursMilli) / 1000} ч` : '—' },
    { label: 'Ставка', render: (row) => formatMoney(row.rateCents) },
    { label: 'Подсказка цены', render: (row) => formatMoney(row.suggestedPriceCents) },
    { label: 'Статус', render: (row) => statusBadge(row.active === false ? 'cancelled' : 'approved', row.active === false ? 'Скрыта' : 'Активна') },
    actionColumn,
  ];
  if (entity === 'partsCatalog') return [
    { label: 'Деталь', render: (row) => textCell(row.name, row.sku || 'Артикул не указан') },
    { label: 'Поставщик', render: (row) => state.get('suppliers', row.supplierId)?.name || '—' },
    { label: 'Закупка', render: (row) => formatMoney(row.purchasePriceCents) },
    { label: 'Цена клиенту', render: (row) => formatMoney(row.suggestedPriceCents) },
    { label: 'Единица', render: (row) => row.unit || 'шт.' },
    actionColumn,
  ];
  if (entity === 'suppliers') return [
    { label: 'Поставщик', render: (row) => textCell(row.name, row.notes || '') },
    { label: 'Телефон', render: (row) => row.phone || '—' },
    { label: 'Email', render: (row) => row.email || '—' },
    actionColumn,
  ];
  return [
    { label: 'Название', render: (row) => row.name },
    { label: 'Статус', render: (row) => statusBadge(row.active === false ? 'cancelled' : 'approved', row.active === false ? 'Скрыт' : 'Активен') },
    actionColumn,
  ];
}
