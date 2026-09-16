import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SCRIPTS_DIR = path.join(ROOT, 'scripts');
const REQUIRED = ['@name', '@version', '@description', '@author', '@match'];

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

function getMeta(header, key) {
  const match = header.match(new RegExp(`^\\s*//\\s*${key.replace('@', '\\@')}\\s+(.+)$`, 'm'));
  return match?.[1]?.trim() ?? '';
}

const files = walk(SCRIPTS_DIR).filter((file) => file.endsWith('.user.js'));
let failed = false;

if (!files.length) {
  console.log('ℹ️ لا توجد ملفات .user.js بعد.');
  process.exit(0);
}

for (const file of files) {
  const rel = path.relative(ROOT, file);
  const text = fs.readFileSync(file, 'utf8');
  const header = readHeader(text);
  const errors = [];

  if (!header) {
    errors.push('UserScript header مفقود أو غير مكتمل');
  } else {
    for (const key of REQUIRED) {
      if (!getMeta(header, key)) errors.push(`${key} مفقود`);
    }

    const version = getMeta(header, '@version');
    if (version && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
      errors.push(`@version غير مطابق لـ SemVer: ${version}`);
    }

    const matches = [...header.matchAll(/^\s*\/\/\s*@match\s+(.+)$/gm)].map((m) => m[1].trim());
    if (!matches.length) errors.push('@match واحد على الأقل مطلوب');
  }

  if (errors.length) {
    failed = true;
    console.error(`❌ ${rel}`);
    for (const error of errors) console.error(`   - ${error}`);
  } else {
    console.log(`✅ ${rel} — v${getMeta(header, '@version')}`);
  }
}

if (failed) process.exit(1);
console.log(`\n✅ تم فحص ${files.length} سكربت بنجاح.`);
