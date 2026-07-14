const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const forms = read('forms.html');
const prices = read('prices.html');
const services = read('services.html');
const contacts = read('contacts.html');
const privacy = read('privacy.html');
const css = read('assets/css/main.css');

test('главная использует утверждённое позиционирование и безопасные claims', () => {
  assert.match(index, /Автосервис в[\s\S]*Ростове-на-Дону[\s\S]*с диагностикой и сметой до ремонта/);
  assert.match(index, /class="nowrap">Ростове-на-Дону/);
  assert.match(index, /Проверяем автомобиль, объясняем причину неисправности/);
  assert.doesNotMatch(index, /4\.9\/5/);
  assert.doesNotMatch(index, /08:00[–-]20:00/);
  assert.match(index, /Режим работы уточняйте по телефону/);
});

test('подтверждённая наценка до 10% вынесена в ключевые коммерческие блоки', () => {
  const claim = 'Наценка на запчасти — до 10%';
  const occurrences = index.split(claim).length - 1;
  assert.ok(occurrences >= 3, `формулировка должна встречаться минимум 3 раза, сейчас ${occurrences}`);
});

test('ROLF Motor Oil подан как подтверждённая точка продаж, а не автомобильный сервис бренда', () => {
  assert.match(index, /Замена масла и расходников/);
  assert.match(index, /ROLF Motor Oil/);
  assert.match(index, /авторизованной точки продаж ROLF Motor Oil/);
  assert.doesNotMatch(index, /официальный сервис ROLF/i);
  assert.match(index, /assets\/images\/real-service\/rolf-motor-oil\.png/);
});

test('три локальных доказательных фото подключены с понятными именами', () => {
  const files = [
    'assets/images/real-service/entry-door.png',
    'assets/images/real-service/services-banner.png',
    'assets/images/real-service/rolf-motor-oil.png',
  ];
  for (const file of files) {
    assert.ok(fs.existsSync(path.join(root, file)), `${file} должен существовать`);
    assert.match(index, new RegExp(file.replace(/[./]/g, '\\$&')));
  }
  const doorUses = index.split('assets/images/real-service/entry-door.png').length - 1;
  assert.ok(doorUses >= 2, 'фото входа должно использоваться в галерее и блоке «Как нас найти»');
});

test('витрина запчастей подписана по фактическому содержимому', () => {
  assert.match(index, /Оригинальные запчасти всегда в наличии/);
  assert.doesNotMatch(index, /Автомобиль в работе/);
});

test('номера карточек проблем оформлены как заметный графический элемент без искусственного провала', () => {
  assert.match(css, /\.problem-card > span\s*\{[^}]*font-size:\s*34px/s);
  assert.match(css, /\.problem-card > span::after\s*\{/);
  assert.doesNotMatch(css, /\.problem-card h3\s*\{[^}]*margin:\s*auto/s);
});

test('карточки услуг используют равную адаптивную сетку и локальные WebP', () => {
  const serviceImages = [
    'diagnostics',
    'maintenance',
    'suspension',
    'auto-electrician',
    'engine-repair',
    'transmission-service',
    'tire-service',
    'parts',
  ];
  assert.match(css, /\.service-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,/s);
  assert.match(css, /@media\s*\(max-width:\s*1180px\)[\s\S]*?\.service-grid\s*\{[^}]*repeat\(2,/s);
  assert.match(css, /@media\s*\(max-width:\s*680px\)[\s\S]*?\.service-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
  assert.match(css, /\.service-card a\s*\{[^}]*margin-top:\s*auto/s);
  assert.doesNotMatch(css + index, /service-card-wide/);
  for (const name of serviceImages) {
    const file = `assets/images/services/${name}.webp`;
    assert.ok(fs.existsSync(path.join(root, file)), `${file} должен существовать`);
    assert.match(index, new RegExp(`${name}\\.webp`));
    assert.match(services, new RegExp(`${name}\\.webp`));
  }
  for (const html of [index, services]) {
    assert.match(html, /width="1200" height="800" loading="lazy" decoding="async"/);
  }
});

test('главная содержит полный блок частых обращений', () => {
  const expected = [
    'Подвеска стучит или машину уводит в сторону',
    'На панели появилась ошибка',
    'Нужно плановое ТО без лишних услуг',
    'Кондиционер охлаждает слабо или появился запах',
    'Появилась вибрация, гул или посторонние звуки',
    'Нужно переобуться или подготовить машину к сезону',
  ];
  for (const text of expected) assert.match(index, new RegExp(text));
});

test('ключевые секции главной расположены в утверждённом порядке', () => {
  const ids = [
    'home',
    'trust',
    'problems',
    'services',
    'steps',
    'proof',
    'workshop',
    'prices',
    'parts',
    'reviews',
    'bonus',
    'brands',
    'contacts',
  ];
  let last = -1;
  for (const id of ids) {
    const current = index.indexOf(`id="${id}"`);
    assert.ok(current > last, `секция #${id} должна идти после предыдущей`);
    last = current;
  }
});

test('скидочная программа сохраняет уровни, проценты и точные условия', () => {
  const levels = [
    ['Бронза', '3%', 'После первого обслуживания', 'Базовая скидка на работы и запчасти'],
    ['Серебро', '5%', 'От 60 000 ₽ за год', 'Для клиентов, которые обслуживают автомобиль регулярно'],
    ['Золото', '7%', 'От 100 000 ₽ за год', 'Повышенная выгода и приоритетная запись при свободных окнах'],
    ['Платина', '10%', 'От 180 000 ₽ за год', 'Максимальная скидка для постоянных клиентов сервиса'],
  ];
  assert.match(index, /Скидки для постоянных клиентов/);
  for (const level of levels) {
    for (const text of level) assert.match(index, new RegExp(text.replace('%', '%')));
  }
  assert.match(
    index,
    /Условия программы и применение скидки уточняются при записи\. Скидки не суммируются с отдельными спецпредложениями, если иное не согласовано\./,
  );
});

test('форма сохраняет endpoint и использует терминологию заявки', () => {
  assert.match(forms, /action="https:\/\/formspree\.io\/f\/mldqndzq"/);
  assert.match(forms, /Заявка на запись в сервис/);
  assert.match(forms, /Марка, модель и год/);
  assert.match(forms, /Что беспокоит/);
  assert.match(forms, /Желаемый день/);
  assert.match(forms, /Мы подтвердим время визита по телефону/);
  assert.match(forms, /type="tel" inputmode="tel" autocomplete="tel"/);
  assert.match(forms, /Введите полный российский номер из 11 цифр/);
  assert.match(forms, /date\.min = getLocalDate\(\)/);
  assert.match(forms, /URLSearchParams\(window\.location\.search\)\.get\('service'\)/);
  for (const option of [
    'Обслуживание и ремонт МКПП',
    'Обслуживание и ремонт АКПП',
    'Обслуживание кондиционера',
    'Ремонт рулевого управления',
    'Ремонт тормозной системы',
  ]) {
    assert.match(forms, new RegExp(option));
  }
});

test('технические контейнеры учитывают липкую шапку и узкие таблицы', () => {
  assert.match(css, /section\[id\]\s*\{[^}]*scroll-margin-top:\s*96px/s);
  assert.match(prices, /<div class="table-wrap"><table class="price-table">/);
});

test('вторичные страницы поддерживают новый тон и не обещают график', () => {
  assert.match(prices, /Итоговая стоимость зависит от состояния автомобиля, состава работ и выбранных запчастей/);
  assert.doesNotMatch(services, />Подробнее</);
  for (const html of [forms, prices, services, contacts, privacy]) {
    assert.doesNotMatch(html, /Онлайн-запись/);
    assert.doesNotMatch(html, /08:00[–-]20:00/);
  }
});

test('контакты, карта и внешние ссылки сохранены', () => {
  for (const text of ['tel:+78632600345', 'tel:+79045057390', 'tel:+79185900199']) {
    assert.match(index + contacts, new RegExp(text.replace('+', '\\+')));
  }
  assert.match(index, /https:\/\/yandex\.ru\/maps\/org\/vn_masters\/42750637752\//);
  assert.match(index, /https:\/\/2gis\.ru\/rostov-on-don\/firm\/70000001095146498/);
  assert.match(index, /https:\/\/yandex\.ru\/map-widget\/v1\//);
});
