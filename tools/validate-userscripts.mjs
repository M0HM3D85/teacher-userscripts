import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const AUTHOR_FILE = path.join(ROOT, 'config', 'author.json');
const CATALOG_FILE = path.join(SCRIPTS_DIR, 'catalog.json');

if (!fs.existsSync(AUTHOR_FILE)) {
  console.error('❌ config/author.json غير موجود.');
  process.exit(1);
}

const AUTHOR = JSON.parse(fs.readFileSync(AUTHOR_FILE, 'utf8'));
const CATALOG = fs.existsSync(CATALOG_FILE)
  ? JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  : { scripts: [] };
const CATALOG_BY_PATH = new Map(
  (CATALOG.scripts || []).map((item) => [item.sourcePath, item])
);

const REQUIRED = [
  '@name', '@namespace', '@version', '@description', '@author',
  '@homepageURL', '@supportURL', '@copyright', '@license', '@match'
];

const EXACT_META = Object.freeze({
  '@namespace': AUTHOR.namespace,
  '@author': AUTHOR.author,
  '@homepageURL': AUTHOR.website,
  '@supportURL': AUTHOR.support,
  '@copyright': AUTHOR.copyrightHeader,
  '@license': AUTHOR.license
});

const REQUIRED_IDENTITY_TEXT = Object.freeze([
  ['GreasyFork', AUTHOR.website],
  ['GitHub support/source', AUTHOR.repository],
  ['X / Twitter', AUTHOR.x],
  ['Snapchat', AUTHOR.snapchat],
  ['حقوق المطور', AUTHOR.copyrightNotice]
]);

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function readHeader(text) {
  const start = text.indexOf('// ==UserScript==');
  const end = text.indexOf('// ==/UserScript==');
  if (start === -1 || end === -1 || end < start) return null;
  return text.slice(start, end + '// ==/UserScript=='.length);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getMeta(header, key) {
  const match = header.match(new RegExp(`^\\s*//\\s*${escapeRegExp(key)}\\s+(.+)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

const files = walk(SCRIPTS_DIR).filter((file) => file.endsWith('.user.js'));
let failed = false;

if (!files.length) {
  console.log('ℹ️ لا توجد ملفات .user.js بعد.');
  process.exit(0);
}

const ids = new Set();
const sourcePaths = new Set();
const additionalInfoPaths = new Set();

for (const item of CATALOG.scripts || []) {
  const errors = [];

  if (!item.id) errors.push('id مفقود');
  if (item.id && ids.has(item.id)) errors.push(`id مكرر: ${item.id}`);
  if (item.id) ids.add(item.id);

  if (!item.sourcePath) errors.push('sourcePath مفقود');
  if (item.sourcePath && sourcePaths.has(item.sourcePath)) errors.push(`sourcePath مكرر: ${item.sourcePath}`);
  if (item.sourcePath) sourcePaths.add(item.sourcePath);

  if (!item.additionalInfoPath) {
    errors.push('additionalInfoPath مفقود');
  } else {
    if (additionalInfoPaths.has(item.additionalInfoPath)) {
      errors.push(`additionalInfoPath مكرر: ${item.additionalInfoPath}`);
    }
    additionalInfoPaths.add(item.additionalInfoPath);

    const infoFile = path.join(ROOT, item.additionalInfoPath);
    if (!fs.existsSync(infoFile)) {
      errors.push(`ملف Additional info غير موجود: ${item.additionalInfoPath}`);
    } else {
      const infoText = fs.readFileSync(infoFile, 'utf8');
      const expectedVersion = `**الإصدار الحالي:** \`${item.version}\``;
      if (!infoText.includes(expectedVersion)) {
        errors.push(`README لا يعرض الإصدار الحالي المتوقع: ${item.version}`);
      }
      if (!infoText.includes(AUTHOR.author)) {
        errors.push('README لا يحتوي اسم المطور الموحد');
      }
      if (!infoText.includes(AUTHOR.support)) {
        errors.push('README لا يحتوي رابط الدعم الموحد');
      }
      if (!infoText.includes(AUTHOR.copyrightNotice)) {
        errors.push('README لا يحتوي نص الحقوق الموحد');
      }
    }
  }

  if (errors.length) {
    failed = true;
    console.error(`❌ catalog: ${item.id || '(بدون id)'}`);
    for (const error of errors) console.error(`   - ${error}`);
  }
}

for (const file of files) {
  const rel = path.relative(ROOT, file).replaceAll('\\', '/');
  const text = fs.readFileSync(file, 'utf8');
  const header = readHeader(text);
  const errors = [];
  const catalogEntry = CATALOG_BY_PATH.get(rel);

  if (!header) {
    errors.push('UserScript header مفقود أو غير مكتمل');
  } else {
    for (const key of REQUIRED) {
      if (!getMeta(header, key)) errors.push(`${key} مفقود`);
    }

    const version = getMeta(header, '@version');
    const semver = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
    const legacyTwoPart = /^\d+\.\d+$/;
    if (version && !semver.test(version)) {
      const allowedLegacy = catalogEntry?.legacyVersionFormat === true && legacyTwoPart.test(version);
      if (!allowedLegacy) {
        errors.push(`@version غير مطابق لـ SemVer: ${version}`);
      } else {
        console.warn(`⚠️ ${rel}: إصدار Legacy مؤقت (${version}) — يجب تحويله إلى SemVer في أول تحديث جديد.`);
      }
    }

    if (catalogEntry && catalogEntry.version !== version) {
      errors.push(`الإصدار في catalog.json (${catalogEntry.version}) لا يطابق @version (${version})`);
    }

    const matches = [...header.matchAll(/^\s*\/\/\s*@match\s+(.+)$/gm)].map((m) => m[1].trim());
    if (!matches.length) errors.push('@match واحد على الأقل مطلوب');

    for (const [key, expected] of Object.entries(EXACT_META)) {
      const actual = getMeta(header, key);
      if (actual && actual !== expected) {
        errors.push(`${key} يجب أن يكون موحدًا: ${expected}`);
      }
    }
  }

  for (const [label, value] of REQUIRED_IDENTITY_TEXT) {
    if (!text.includes(value)) {
      errors.push(`بيانات الهوية ناقصة: ${label} (${value})`);
    }
  }

  if (!catalogEntry) {
    errors.push('السكربت غير مسجل في scripts/catalog.json');
  }

  if (errors.length) {
    failed = true;
    console.error(`❌ ${rel}`);
    for (const error of errors) console.error(`   - ${error}`);
  } else {
    console.log(`✅ ${rel} — v${getMeta(header, '@version')} — الهوية موحدة`);
  }
}

if (failed) process.exit(1);
console.log(`\n✅ تم فحص ${files.length} سكربت وملفات Additional info بنجاح.`);
