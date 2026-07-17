import { DB_NAME, DB_VERSION, SCHEMA_VERSION } from '../constants.mjs';
import { formatAudit } from '../ui.mjs';
import { button, emptyState, formatDateTime, panel, statusBadge, table, textCell, viewHeader, el } from '../ui.mjs';

export function renderTrash(state) {
  const trash = [...state.data.trash].sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  const audit = [...state.data.auditLog].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 80);

  return el('div', { class: 'view-stack' },
    viewHeader('Безопасное удаление', 'Корзина и журнал', 'Обычное удаление можно отменить. Полная очистка корзины необратима в рамках текущей базы браузера.', [
      trash.length ? button('Очистить корзину', 'empty-trash', { class: 'button button--danger' }) : null,
    ].filter(Boolean)),
    el('div', { class: 'content-grid' },
      panel('Корзина', trash.length ? table([
        { label: 'Запись', render: (row) => textCell(row.label || row.sourceId, row.entity) },
        { label: 'Удалена', render: (row) => formatDateTime(row.deletedAt) },
        { label: '', class: 'table-actions', render: (row) => el('div', { class: 'table-actions' },
          button('Восстановить', 'restore-record', { class: 'table-action', dataset: { id: row.sourceId, entity: row.entity } }),
          button('Навсегда', 'purge-record', { class: 'table-action table-action--danger', dataset: { id: row.sourceId, entity: row.entity } }),
        ) },
      ], trash) : emptyState('Корзина пуста', 'Удалённые записи будут появляться здесь.'), { subtitle: `${trash.length} записей` }),
      panel('Принцип хранения', el('div', { class: 'notice notice--info' },
        el('span', { text: 'i' }),
        el('p', { text: 'Это журнал действий одной локальной демо-установки. Он не является защищённым аудиторским журналом: пользователь этого браузера может очистить базу.' }),
      ), { subtitle: 'Ограничение публичной демонстрации' }),
    ),
    panel('Журнал действий', audit.length ? el('ol', { class: 'timeline' }, audit.map((entry) => el('li', null,
      el('strong', { text: formatAudit(entry) }),
      el('small', { text: `${formatDateTime(entry.createdAt)} · ${entry.entity || 'система'}${entry.entityId ? ` · ${entry.entityId}` : ''}` }),
    ))) : emptyState('Журнал пуст', 'После создания, изменения, импорта и удаления здесь появятся локальные записи.'), { subtitle: `${audit.length} последних событий` }),
  );
}

export function renderSettings(state, installationId = '') {
  const counts = Object.entries(state.data)
    .filter(([name]) => !['settings', 'auditLog', 'trash'].includes(name))
    .reduce((sum, [, records]) => sum + records.length, 0);
  const mode = state.get('settings', 'databaseMode')?.value || 'empty';

  return el('div', { class: 'view-stack' },
    viewHeader('Локальная конфигурация', 'Настройки и резервные копии', 'Импорт и экспорт переносят рабочую демо-базу между браузерами. Перед импортом автоматически скачивается резервная копия текущего состояния.', [
      button('Экспорт JSON', 'export-backup', { class: 'button button--primary' }),
      button('Импорт JSON', 'import-backup'),
    ]),
    el('div', { class: 'content-grid content-grid--equal' },
      panel('Состояние базы', el('div', { class: 'list' },
        settingLine('Режим', mode === 'demo-sample' ? 'Пример базы' : 'Пустая / пользовательская'),
        settingLine('Записей', String(counts)),
        settingLine('Версия схемы', String(SCHEMA_VERSION)),
        settingLine('IndexedDB', `${DB_NAME} · v${DB_VERSION}`),
        settingLine('ID установки', installationId || 'создаётся…'),
      ), { subtitle: 'Только текущий профиль браузера' }),
      panel('Перенос данных', el('div', { class: 'record-cards' },
        settingAction('Скачать резервную копию', 'JSON со всеми сущностями, версиями и настройками.', 'export-backup', 'Экспорт JSON'),
        settingAction('Импортировать копию', 'Файл сначала проверяется и мигрируется. Текущая база сохраняется автоматически.', 'import-backup', 'Выбрать JSON'),
        settingAction('Экспортировать CSV', 'Отдельные реестры доступны из разделов клиентов, заказов, платежей и расходов.', 'go-clients', 'Открыть клиентов'),
      ), { subtitle: 'Файлы сохраняются на устройстве пользователя' }),
    ),
    panel('Ограничения демо-режима', el('div', { class: 'notice' },
      el('span', { text: '!' }),
      el('p', { text: 'Нет общей базы, синхронизации, серверной резервной копии, разграничения ролей и защищённой авторизации. Очистка данных браузера удалит рабочую базу, если ранее не сделан экспорт.' }),
    ), { subtitle: 'Перед использованием реальных данных нужна серверная архитектура' }),
    panel('Опасная зона', el('div', { class: 'record-card' },
      el('div', null, el('h3', { text: 'Очистить локальную базу' }), el('p', { text: 'Все сущности, журнал и настройки будут удалены. После очистки снова откроется выбор примера или пустой базы.' })),
      button('Очистить базу', 'reset-database', { class: 'button button--danger' }),
    ), { class: 'danger-zone' }),
  );
}

function settingLine(label, value) {
  return el('div', { class: 'list-item' },
    el('div', { class: 'list-item-main' }, el('strong', { text: label })),
    el('span', { class: 'list-item-value', text: value }),
  );
}

function settingAction(title, text, action, label) {
  return el('div', { class: 'record-card' },
    el('div', null, el('h3', { text: title }), el('p', { text })),
    button(label, action, { class: 'button button--ghost button--compact' }),
  );
}
