import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

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

  if (!fs.existsSync(targetFile) || !fs.existsSync(hashFile)) {
    throw new Error(`${id}: target.txt أو sha256.txt مفقود`);
  }

  const target = fs.readFileSync(targetFile, 'utf8').trim();
  const expected = fs.readFileSync(hashFile, 'utf8').trim().toLowerCase();
  const parts = fs.readdirSync(dir)
    .filter((name) => /^part-\d+\.txt$/.test(name))
    .sort();

  if (!parts.length) throw new Error(`${id}: لا توجد أجزاء`);

  const content = parts.map((name) => fs.readFileSync(path.join(dir, name), 'utf8')).join('');
  const actual = crypto.createHash('sha256').update(content, 'utf8').digest('hex');

  if (actual !== expected) {
    throw new Error(`${id}: SHA-256 غير مطابق\nexpected=${expected}\nactual=${actual}`);
  }

  const destination = path.join(ROOT, target);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, 'utf8');

  console.log(`✅ ${id} -> ${target}`);
  console.log(`   SHA-256: ${actual}`);

  fs.rmSync(dir, { recursive: true, force: true });
}
