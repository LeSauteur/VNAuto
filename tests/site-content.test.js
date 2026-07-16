const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const servicePages = ['diagnostics', 'maintenance', 'suspension', 'brakes', 'engine', 'electrics', 'transmission', 'ac-service', 'tire-service', 'parts'];

test('создан полный многостраничный каркас', () => {
  const rootPages = ['index.html', 'services.html', 'prices.html', 'about.html', 'guarantee.html', 'reviews.html', 'contacts.html', 'forms.html', 'faq.html', 'privacy.html'];
  for (const file of rootPages) assert.ok(fs.existsSync(path.join(root, file)), `${file} должен существовать`);
  for (const slug of servicePages) assert.ok(fs.existsSync(path.join(root, `services/${slug}.html`)), `${slug}.html должен существовать`);
});

test('главная стала обзорной и ведёт на внутренние страницы', () => {
  const index = read('index.html');
  for (const href of ['services.html', 'prices.html', 'about.html', 'reviews.html', 'contacts.html', 'faq.html', 'guarantee.html']) assert.match(index, new RegExp(`href="${href.replace('.', '\\.')}"`));
  for (const slug of ['diagnostics', 'maintenance', 'suspension', 'engine', 'electrics', 'transmission']) assert.match(index, new RegExp(`services/${slug}\\.html`));
  assert.match(index, /Находим причину\./);
  assert.match(index, /Согласовываем\./);
  assert.match(index, /Ремонтируем\./);
});

test('страницы услуг содержат обязательные содержательные блоки', () => {
  for (const slug of servicePages) {
    const html = read(`services/${slug}.html`);
    for (const marker of ['breadcrumbs', 'bullet-grid', 'work-flow', 'faq-list', 'related-grid']) assert.match(html, new RegExp(marker, 'i'), `${slug}: нет блока ${marker}`);
    assert.match(html, /Для оцен|Для предваритель|Для расчёт|До визита|Для записи|Для запроса/i, `${slug}: нет данных для предварительной оценки`);
    assert.match(html, /href="\.\.\/forms\.html\?service=/);
    assert.match(html, /\+7 \(863\) 260-03-45/);
  }
});

test('форма использует реальную доставку и нужные поля', () => {
  const form = read('forms.html');
  assert.match(form, /action="https:\/\/formspree\.io\/f\/mldqndzq"/);
  for (const name of ['name', 'phone', 'car', 'year', 'service', 'contact_method', 'message', 'consent']) assert.match(form, new RegExp(`name="${name}"`));
  assert.match(form, /время визита подтверждается/i);
  assert.doesNotMatch(form, /body-repair|automatic-transmission/);
});

test('неподтверждённые коммерческие заявления не возвращены', () => {
  const html = [
    ...fs.readdirSync(root).filter((file) => file.endsWith('.html') && !['admin.html', 'test.html'].includes(file)).map(read),
    ...servicePages.map((slug) => read(`services/${slug}.html`)),
  ].join('\n');
  for (const claim of ['С 2010 года', 'Наценка на запчасти — до 10%', 'Фотоэтапы по запросу', '4.9/5', '100% гарантия']) assert.doesNotMatch(html, new RegExp(claim, 'i'));
});

test('реальные фотографии оптимизированы и исходники сохранены', () => {
  const outputs = ['workshop-brand.webp', 'parts-lighting.webp', 'workshop-tools.webp', 'workshop-repair.webp', 'waiting-area.webp', 'entry-door.webp', 'services-banner.webp', 'rolf-oil.webp'];
  for (const name of outputs) {
    const file = path.join(root, 'assets/images/service', name);
    assert.ok(fs.existsSync(file));
    assert.ok(fs.statSync(file).size < 250_000, `${name} должен быть легче 250 КБ`);
  }
  assert.ok(fs.existsSync(path.join(root, 'MG2/54c8156b-9e07-499e-9495-f225db3b0b07.png')));
  assert.ok(fs.existsSync(path.join(root, 'favicon.ico')));
});

test('admin.html не изменён', () => {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'admin.html'))).digest('hex').toUpperCase();
  assert.equal(hash, '82817BD216C8B15A425AE6F5896DDEB1ABD16DA2088BA966D952FF1423C12581');
});
