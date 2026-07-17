# VN-MASTERS: модель данных демо-панели

Версия схемы данных: `2`.

Основное правило: каждая сущность имеет устойчивый `id`. Телефон, VIN, госномер и номер заказ-наряда являются атрибутами и индексами поиска, но не первичными ключами.

## Общие поля записей

Большинство записей содержит:

- `id` — UUID или устойчивый ID демонстрационной/импортированной записи;
- `recordVersion` — версия формата конкретной записи;
- `localRevision` — номер локального изменения;
- `createdAt`;
- `updatedAt`;
- `deletedAt` — `null` для активной записи или время мягкого удаления;
- `demo` — признак вымышленной демонстрационной записи, когда применимо.

## Сущности и связи

### `clients`

Карточка клиента:

- `name`;
- `normalizedPhone`;
- `phoneDisplay`;
- `secondaryPhone`;
- `email`;
- `preferredContact`;
- `notes`.

Показатели `visits`, `totalBilled`, `received`, `debt` и `averageOrder` в карточке не хранятся — они рассчитываются по заказам и платежам.

### `vehicles`

- `clientId` → `clients.id`;
- `make`, `model`, `generation`, `year`;
- `vin`, `plate`;
- `mileage`;
- `engineType`;
- `mileageHistory`;
- `notes`.

Один клиент может иметь несколько автомобилей.

### `appointments`

- `clientId` → `clients.id`;
- `vehicleId` → `vehicles.id`;
- `date`, `time`;
- `reason`;
- `status`;
- `note`;
- `workOrderId` — после преобразования в заказ.

Преобразование записи создаёт связанный заказ и ставит статус `converted`.

### `workOrders`

- `number`;
- `clientId` → `clients.id`;
- `vehicleId` → `vehicles.id`;
- `acceptedDate`, `plannedReadyDate`;
- `mileage`;
- `complaint`;
- `diagnosis`;
- `recommendations`;
- `internalNote`;
- `status`;
- `approvalStatus`;
- `employeeId` → `employees.id`;
- `discountBps`;
- `sourceAppointmentId` → `appointments.id`.

Сумма, себестоимость, прибыль и статус оплаты не хранятся как редактируемые поля.

### `workOrderItems`

- `workOrderId` → `workOrders.id`;
- `type`: `work`, `part`, `material`, `extra`;
- `name`, `description`;
- `quantityMilli` — количество в тысячных долях;
- `unit`;
- `unitPriceCents`;
- `discountBps`;
- для работы: `laborHoursMilli`, `rateCents`, `actualMinutes`, `employeeId`, `laborCostCents`;
- для детали/материала: `purchasePriceCents`, `sku`, `supplierId`, `warrantyNote`;
- для прочей строки: `directCostCents`;
- `approved`, `completed`;
- `sortOrder`.

Отдельная сущность строк позволяет изменять документ атомарно и рассчитывать сумму без накопительных ошибок.

### `payments`

- `workOrderId` → `workOrders.id`;
- `date`;
- `amountCents`;
- `method`;
- `type`: `payment`, `prepayment`, `surcharge`, `refund`, `adjustment`;
- `comment`.

Возврат — отдельная операция с положительным `amountCents`; знак применяется расчётной функцией по `type`.

### `expenses`

- `date`;
- `category`;
- `amountCents`;
- `method`;
- `recipient`;
- `workOrderId` → `workOrders.id`, необязательно;
- `comment`;
- `recurring`;
- `documentNote`;
- `includedInOrderCost`.

`includedInOrderCost=true` означает, что сумма уже представлена закупочной/прямой себестоимостью строк заказа. В финансовом результате она показывается справочно и второй раз не вычитается.

### `employees`

- `name`;
- `role`;
- `phone`;
- `active`;
- `rateNote`;
- `notes`.

Это справочник исполнителей, а не учётные записи. В публичной демо-версии нет ролей доступа.

### `servicesCatalog`

- `name`, `category`;
- `recommendedHoursMilli`;
- `rateCents`;
- `suggestedPriceCents`;
- `active`.

### `partsCatalog`

- `name`, `sku`;
- `supplierId` → `suppliers.id`;
- `purchasePriceCents`;
- `suggestedPriceCents`;
- `unit`;
- `notes`.

Это подсказки ввода. Остатки, резервирование и складские движения не моделируются.

### `suppliers`

- `name`;
- `phone`;
- `email`;
- `notes`.

### `expenseCategories`

- `name`;
- `active`.

### `paymentMethods`

- `name`;
- `active`.

### `auditLog`

- `action`;
- `entity`;
- `entityId`;
- `details`;
- `createdAt`;
- `demoOnly`.

Журнал локальный и доступен владельцу браузера. Он не является защищённым серверным audit log.

### `settings`

Записи key/value:

- `onboardingComplete`;
- `databaseMode`;
- `installationId`;
- другие версионированные локальные настройки.

### `trash`

- `id` в формате `${entity}:${sourceId}`;
- `entity`;
- `sourceId`;
- `label`;
- `snapshot`;
- `deletedAt`.

У `trash.deletedAt` другое смысловое значение: это дата помещения в корзину, поэтому она не скрывает запись корзины.

## Индексы IndexedDB

Индексы созданы для часто используемых связей и фильтров:

- дата, статус и клиент записи;
- нормализованный телефон клиента;
- клиент, VIN и госномер автомобиля;
- номер, клиент, автомобиль, статус и дата заказа;
- заказ и тип строки;
- заказ, дата и тип платежа;
- дата, заказ и категория расхода;
- имя/active в справочниках;
- дата и сущность журнала;
- сущность и дата корзины.

Индексы не объявлены unique: демо-панель предупреждает о возможном дубле телефона, но не принимает бизнес-решение за пользователя.

## Версионирование и миграции

- IndexedDB `DB_VERSION=2`;
- backup `schemaVersion=2`;
- черновик `DRAFT_VERSION=2`.

Миграция v1 → v2 добавляет отдельный store `paymentMethods`, значения по умолчанию и недостающие индексы. Импортированные записи получают отсутствующие технические поля без замены стабильного ID.
