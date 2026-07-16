const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const publicFiles = [
  ...fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html') && !['admin.html', 'test.html'].includes(entry.name))
    .map((entry) => entry.name),
  ...fs.readdirSync(path.join(root, 'services'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => `services/${entry.name}`),
].sort();

const errors = [];
const titles = new Map();
const h1Texts = new Map();
const canonicals = new Map();
const htmlCache = new Map(publicFiles.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const voidElements = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

const textOnly = (value) => value.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const capture = (content, pattern) => content.match(pattern)?.[1]?.trim() || '';

function addUnique(map, value, file, label) {
  if (!value) return;
  if (map.has(value)) errors.push(`${file}: ${label} дублирует ${map.get(value)} — ${value}`);
  else map.set(value, file);
}

function resolveLocal(sourceFile, ref) {
  const clean = decodeURIComponent(ref.split(/[?#]/)[0]);
  return path.normalize(path.join(path.dirname(sourceFile), clean)).replaceAll('\\', '/');
}

function validateJsonLd(file, content) {
  const blocks = [...content.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, json] of blocks) {
    try { JSON.parse(json); }
    catch (error) { errors.push(`${file}: некорректный JSON-LD — ${error.message}`); }
  }
}

function validateTagNesting(file, content) {
  const withoutComments = content.replace(/<!--[\s\S]*?-->/g, '');
  const stack = [];
  for (const match of withoutComments.matchAll(/<\/?([a-z][a-z0-9-]*)(?:\s[^<>]*?)?\/?>/gi)) {
    const raw = match[0];
    const name = match[1].toLowerCase();
    if (voidElements.has(name) || raw.endsWith('/>')) continue;
    if (raw.startsWith('</')) {
      const opened = stack.pop();
      if (opened !== name) errors.push(`${file}: </${name}> закрывает <${opened || 'нет открывающего тега'}>`);
    } else {
      stack.push(name);
    }
  }
  if (stack.length) errors.push(`${file}: не закрыты теги ${stack.join(', ')}`);
}

for (const [file, content] of htmlCache) {
  if (!/^<!doctype html>/i.test(content)) errors.push(`${file}: нет doctype`);
  if (!/<html[^>]+lang=["']ru["']/i.test(content)) errors.push(`${file}: отсутствует lang=ru`);
  if (!/<meta[^>]+charset=["']?utf-8/i.test(content)) errors.push(`${file}: отсутствует UTF-8 charset`);

  const title = capture(content, /<title>([\s\S]*?)<\/title>/i);
  const description = capture(content, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  const canonical = capture(content, /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  const ogUrl = capture(content, /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i);
  const h1 = [...content.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => textOnly(match[1]));

  if (!title) errors.push(`${file}: пустой title`);
  if (!description) errors.push(`${file}: пустой meta description`);
  if (!canonical) errors.push(`${file}: нет canonical`);
  if (!ogUrl) errors.push(`${file}: нет og:url`);
  if (canonical && ogUrl && canonical !== ogUrl) errors.push(`${file}: canonical и og:url различаются`);
  if (h1.length !== 1) errors.push(`${file}: найдено H1: ${h1.length}`);
  addUnique(titles, title, file, 'title');
  addUnique(h1Texts, h1[0], file, 'H1');
  addUnique(canonicals, canonical, file, 'canonical');
  validateJsonLd(file, content);
  validateTagNesting(file, content);

  const ids = new Set([...content.matchAll(/\bid=["']([^"']+)["']/gi)].map((match) => match[1]));
  const duplicateIds = [...ids].filter((id) => (content.match(new RegExp(`\\bid=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'gi')) || []).length > 1);
  if (duplicateIds.length) errors.push(`${file}: дублируются id ${duplicateIds.join(', ')}`);

  for (const match of content.matchAll(/\b(?:href|src)=["']([^"']*)["']/gi)) {
    const ref = match[1];
    if (!ref) { errors.push(`${file}: пустая ссылка или ресурс`); continue; }
    if (/^javascript:/i.test(ref)) { errors.push(`${file}: javascript-ссылка ${ref}`); continue; }
    if (/^(?:https?:|tel:|mailto:|data:)/i.test(ref)) continue;

    const [pathname, anchor = ''] = ref.split('#');
    if (!pathname) {
      if (anchor && !ids.has(anchor)) errors.push(`${file}: нет якоря #${anchor}`);
      continue;
    }

    const target = resolveLocal(file, ref);
    const absolute = path.join(root, target);
    if (!fs.existsSync(absolute)) { errors.push(`${file}: не найден ${ref}`); continue; }
    if (anchor && target.endsWith('.html')) {
      const targetContent = htmlCache.get(target) || fs.readFileSync(absolute, 'utf8');
      if (!new RegExp(`\\bid=["']${anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(targetContent)) errors.push(`${file}: в ${target} нет якоря #${anchor}`);
    }
  }

  for (const img of content.matchAll(/<img\b([^>]*)>/gi)) {
    if (!/\balt=["'][^"']*["']/i.test(img[1])) errors.push(`${file}: img без alt`);
    if (!/\bwidth=["']\d+["']/i.test(img[1]) || !/\bheight=["']\d+["']/i.test(img[1])) errors.push(`${file}: img без width/height`);
  }
}

const cssFile = 'assets/css/main.css';
const css = fs.readFileSync(path.join(root, cssFile), 'utf8');
const openBraces = (css.match(/{/g) || []).length;
const closeBraces = (css.match(/}/g) || []).length;
if (openBraces !== closeBraces) errors.push(`${cssFile}: фигурные скобки ${openBraces}/${closeBraces}`);
for (const [, ref] of css.matchAll(/url\(["']?([^"')]+)["']?\)/gi)) {
  if (/^(?:data:|https?:)/i.test(ref)) continue;
  const target = path.resolve(path.dirname(path.join(root, cssFile)), ref);
  if (!fs.existsSync(target)) errors.push(`${cssFile}: не найден ${ref}`);
}

const allPublic = [...htmlCache.values()].join('\n').toLowerCase();
for (const claim of ['с 2010 года', 'наценка на запчасти — до 10%', 'фотоэтапы по запросу', '4.9/5', '100% гарантия', 'лучший автосервис', 'тысячи довольных клиентов']) {
  if (allPublic.includes(claim.toLowerCase())) errors.push(`неподтверждённое утверждение: ${claim}`);
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
for (const file of publicFiles) {
  const urlPath = file === 'index.html' ? '/' : `/${file}`;
  if (!sitemap.includes(`https://vn-masters.ru${urlPath}`)) errors.push(`sitemap.xml: нет ${file}`);
}
if (/admin\.html|test\.html/i.test(sitemap)) errors.push('sitemap.xml: содержит служебную страницу');

if (errors.length) {
  console.error(`Проверка не пройдена (${errors.length}):\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Проверено публичных HTML: ${publicFiles.length}`);
console.log(`Уникальных title/H1/canonical: ${titles.size}/${h1Texts.size}/${canonicals.size}`);
console.log('Локальные ссылки, anchors, изображения, CSS, JSON-LD, sitemap и метаданные корректны.');
