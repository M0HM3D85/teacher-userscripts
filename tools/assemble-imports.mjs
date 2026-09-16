import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const IMPORTS = path.join(ROOT, 'imports');

if (!fs.existsSync(IMPORTS)) {
  console.log('ℹ️ لا يوجد مجلد imports.');
  process.exit(0);
}

const jobs = fs.readdirSync(IMPORTS, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(IMPORTS, entry.name))
  .filter((dir) => fs.existsSync(path.join(dir, 'READY')));

if (!jobs.length) {
  console.log('ℹ️ لا توجد عمليات استيراد جاهزة.');
  process.exit(0);
}

for (const dir of jobs) {
  const id = path.basename(dir);
  const targetFile = path.join(dir, 'target.txt');
  const hashFile = path.join(dir, 'sha256.txt');
  const encodingFile = path.join(dir, 'encoding.txt');

  if (!fs.existsSync(targetFile) || !fs.existsSync(hashFile)) {
    throw new Error(`${id}: target.txt أو sha256.txt مفقود`);
  }

  const target = fs.readFileSync(targetFile, 'utf8').trim();
  const expected = fs.readFileSync(hashFile, 'utf8').trim().toLowerCase();
  const encoding = fs.existsSync(encodingFile)
    ? fs.readFileSync(encodingFile, 'utf8').trim()
    : 'utf8';

  const parts = fs.readdirSync(dir)
    .filter((name) => /^part-\d+\.txt$/.test(name))
    .sort();

  if (!parts.length) throw new Error(`${id}: لا توجد أجزاء`);

  const joined = parts.map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('');

  let contentBuffer;
  if (encoding === 'gzip-base64') {
    contentBuffer = zlib.gunzipSync(Buffer.from(joined, 'base64'));
  } else if (encoding === 'utf8') {
    contentBuffer = Buffer.from(joined, 'utf8');
  } else {
    throw new Error(`${id}: ترميز غير مدعوم: ${encoding}`);
  }

  const actual = crypto.createHash('sha256').update(contentBuffer).digest('hex');
  if (actual !== expected) {
    throw new Error(`${id}: SHA-256 غير مطابق\nexpected=${expected}\nactual=${actual}`);
  }

  const destination = path.join(ROOT, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, contentBuffer);

  console.log(`✅ ${id} -> ${target}`);
  console.log(`   Encoding: ${encoding}`);
  console.log(`   SHA-256: ${actual}`);

  fs.rmSync(dir, { recursive: true, force: true });
}
