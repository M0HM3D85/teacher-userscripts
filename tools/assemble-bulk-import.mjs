import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const IMPORT_ROOT = path.join(ROOT, 'imports-bulk');

if (!fs.existsSync(IMPORT_ROOT)) {
  console.log('ℹ️ لا يوجد imports-bulk.');
  process.exit(0);
}

const jobs = fs.readdirSync(IMPORT_ROOT, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(IMPORT_ROOT, entry.name))
  .filter((dir) => fs.existsSync(path.join(dir, 'READY')));

if (!jobs.length) {
  console.log('ℹ️ لا توجد حزم استيراد جماعي جاهزة.');
  process.exit(0);
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function safePath(rel) {
  if (!rel || path.isAbsolute(rel) || rel.includes('..')) return false;
  return rel.startsWith('scripts/') || rel.startsWith('docs/');
}

function unpack(buffer) {
  try {
    return zlib.gunzipSync(buffer);
  } catch (_) {
    return zlib.brotliDecompressSync(buffer);
  }
}

for (const dir of jobs) {
  const id = path.basename(dir);
  const names = fs.readdirSync(dir);
  const bulkParts = names.filter((name) => /^bulk-\d+\.txt$/.test(name)).sort();
  const legacyParts = names.filter((name) => /^part-\d+\.txt$/.test(name)).sort();
  const parts = bulkParts.length ? bulkParts : legacyParts;

  if (!parts.length) throw new Error(`${id}: لا توجد أجزاء`);

  const packedBase64 = parts
    .map((name) => fs.readFileSync(path.join(dir, name), 'utf8').trim())
    .join('');

  const packed = Buffer.from(packedBase64, 'base64');
  const jsonBuffer = unpack(packed);
  const payload = JSON.parse(jsonBuffer.toString('utf8'));

  if (![1, 2].includes(payload.schemaVersion) || !Array.isArray(payload.files)) {
    throw new Error(`${id}: صيغة الحزمة غير مدعومة`);
  }

  for (const file of payload.files) {
    if (!safePath(file.path)) throw new Error(`${id}: مسار غير مسموح ${file.path}`);

    const content = payload.schemaVersion === 1
      ? Buffer.from(file.contentBase64, 'base64')
      : Buffer.from(String(file.content ?? ''), 'utf8');

    const actual = sha256(content);
    if (actual !== String(file.sha256 || '').toLowerCase()) {
      throw new Error(`${id}: SHA-256 غير مطابق للملف ${file.path}`);
    }

    const destination = path.join(ROOT, file.path);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, content);
    console.log(`✅ ${file.path} — ${actual}`);
  }

  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`✅ اكتملت الحزمة ${id}: ${payload.files.length} ملفًا.`);
}
