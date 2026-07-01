const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const htmlFiles = ['index.html', 'forms.html', 'prices.html', 'services.html', 'contacts.html', 'privacy.html'];
const cssFiles = ['assets/css/main.css'];
const missing = [];
const structureErrors = [];
const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function validateHtml(file, content) {
  for (const required of ['<!DOCTYPE html>', '<html', '<head', '<body', '</body>', '</html>']) {
    if (!content.includes(required)) structureErrors.push(`${file}: отсутствует ${required}`);
  }

  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  const tags = withoutComments.matchAll(/<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*?)?\/?>/gi);
  for (const match of tags) {
    const raw = match[0];
    const name = match[1].toLowerCase();
    if (voidElements.has(name) || raw.endsWith('/>')) continue;
    if (raw.startsWith('</')) {
      const open = stack.pop();
      if (open !== name) structureErrors.push(`${file}: закрывающий </${name}> не соответствует <${open || 'нет'}>`);
    } else {
      stack.push(name);
    }
  }
  if (stack.length) structureErrors.push(`${file}: не закрыты теги ${stack.join(', ')}`);

  const ids = [...content.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicateIds.length) structureErrors.push(`${file}: повторяются id ${[...new Set(duplicateIds)].join(', ')}`);

  const inlineScripts = [...content.matchAll(/<script(?![^>]*type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, script] of inlineScripts) {
    if (!script.trim()) continue;
    try {
      new Function(script);
    } catch (error) {
      structureErrors.push(`${file}: ошибка синтаксиса inline-script — ${error.message}`);
    }
  }
}

for (const file of htmlFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  validateHtml(file, content);
  const refs = [...content.matchAll(/(?:src|href)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(?:https?:|tel:|mailto:|#)/.test(ref)) continue;
    const clean = ref.split(/[?#]/)[0];
    if (!fs.existsSync(path.join(root, clean))) missing.push(`${file}: ${clean}`);
  }
}

for (const file of cssFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  const openBraces = (content.match(/{/g) || []).length;
  const closeBraces = (content.match(/}/g) || []).length;
  if (openBraces !== closeBraces) structureErrors.push(`${file}: несбалансированные фигурные скобки ${openBraces}/${closeBraces}`);
  const refs = [...content.matchAll(/url\(["']?([^"')]+)["']?\)/g)].map((match) => match[1]);
  for (const ref of refs) {
    if (/^(?:data:|https?:)/.test(ref)) continue;
    const target = path.resolve(path.dirname(path.join(root, file)), ref);
    if (!fs.existsSync(target)) missing.push(`${file}: ${ref}`);
  }
}

if (missing.length) {
  console.error(`Не найдены локальные ресурсы:\n${missing.join('\n')}`);
  process.exit(1);
}

if (structureErrors.length) {
  console.error(`Найдены структурные ошибки HTML:\n${structureErrors.join('\n')}`);
  process.exit(1);
}

const allHtml = htmlFiles.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
const forbidden = ['4.9/5', 'федеральная сеть', '08:00–20:00', '08:00-20:00', 'Онлайн-запись'];
const found = forbidden.filter((claim) => allHtml.toLowerCase().includes(claim.toLowerCase()));
if (found.length) {
  console.error(`Найдены запрещённые или неподтверждённые утверждения: ${found.join(', ')}`);
  process.exit(1);
}

console.log(`Проверено HTML-файлов: ${htmlFiles.length}`);
console.log('Структура HTML согласована; локальные ресурсы существуют; запрещённые claims не найдены.');
