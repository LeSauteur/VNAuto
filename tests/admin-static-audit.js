const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const admin = read('admin.html');
const moduleFiles = fs.readdirSync(path.join(root, 'assets/js/admin'), { recursive: true })
  .filter((name) => String(name).endsWith('.mjs'))
  .map((name) => path.join(root, 'assets/js/admin', name));

test('новая панель не содержит Firebase, формы пароля и внешних SDK', () => {
  assert.doesNotMatch(admin, /firebase|firestore|authentication|type=["']password|chart\.js|cdn\./i);
  assert.match(admin, /Публичная демо-версия/);
  assert.match(admin, /IndexedDB|локальн/i);
  for (const file of moduleFiles) {
    const source = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(source, /firebase|firestore|authentication|eval\s*\(|new\s+Function|\.innerHTML\s*=/i, path.relative(root, file));
  }
});

test('старый admin сохранён побайтово', () => {
  const value = fs.readFileSync(path.join(root, 'archive/admin-legacy.html'));
  const hash = crypto.createHash('sha256').update(value).digest('hex').toUpperCase();
  assert.equal(hash, '82817BD216C8B15A425AE6F5896DDEB1ABD16DA2088BA966D952FF1423C12581');
});

test('все локальные CSS, JS и изображения admin.html существуют', () => {
  const refs = [...admin.matchAll(/(?:href|src)=["']([^"'#?]+)["']/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(?:https?:|mailto:|tel:)/.test(ref)) continue;
    assert.ok(fs.existsSync(path.resolve(root, ref)), `Не найден ресурс ${ref}`);
  }
});

test('все относительные импорты ES-модулей существуют', () => {
  for (const file of moduleFiles) {
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"](\.[^'"]+)['"]/g)) {
      const target = path.resolve(path.dirname(file), match[1]);
      assert.ok(fs.existsSync(target), `${path.relative(root, file)} -> ${match[1]}`);
    }
  }
});

test('в shell присутствуют доступная навигация, диалоги и предупреждение о локальном хранении', () => {
  for (const text of ['К основному содержанию', 'Разделы панели', 'Данные сохраняются только в этом браузере', 'Резервная копия', 'Вернуться на сайт']) {
    assert.match(admin, new RegExp(text));
  }
  assert.match(admin, /aria-live="polite"/);
  assert.match(admin, /data-onboarding/);
  assert.match(admin, /type="module"/);
});

test('каждый объявленный маршрут подключён к рендереру приложения', () => {
  const constants = read('assets/js/admin/constants.mjs');
  const app = read('assets/js/admin/app.mjs');
  const routeBlock = constants.match(/export const ROUTES = \[([\s\S]*?)\];/);
  assert.ok(routeBlock);
  const routes = [...routeBlock[1].matchAll(/\['([^']+)'/g)].map((match) => match[1]);
  assert.ok(routes.length >= 12);
  for (const route of routes) assert.match(app, new RegExp(`['"]?${route.replace('-', '\\-')}['"]?\\s*:`), `Нет renderer для ${route}`);
});
