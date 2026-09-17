import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const IMPORT_ROOT = path.join(ROOT, 'imports-official');
const CATALOG_PATH = path.join(ROOT, 'scripts', 'catalog.json');
const AUTHOR_PATH = path.join(ROOT, 'config', 'author.json');
const AUTHOR = JSON.parse(fs.readFileSync(AUTHOR_PATH, 'utf8'));
const CATALOG = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf8'));
const BY_ID = new Map(CATALOG.scripts.map((item) => [item.id, item]));

const REMOTE = [
  ['fares-plus','736ac291f06bcd5d03e0cdf8ee4d4e926a3f78108ca13a9e0a73f49f0e5d3c27','https://update.greasyfork.org/scripts/593928/Fares%2B%20%7C%20%D9%81%D8%A7%D8%B1%D8%B3%2B.user.js'],
  ['forms-smart-results-analyzer','01e5f04531c4ab0efc96f67e2f728d115a0f0c0cc0298c41c4cdbbe73c9e347c','https://update.greasyfork.org/scripts/593393/Forms%20Smart%20Results%20Analyzer%20%7C%20%D9%85%D8%AD%D9%84%D9%84%20%D9%86%D8%AA%D8%A7%D8%A6%D8%AC%20%D9%81%D9%88%D8%B1%D9%85%D8%B2%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A.user.js'],
  ['madrasati-smart-attendance','e307326d169aab1185c1b1027f341f0bf607bdf56563c681db4b1fa6724f8cae','https://update.greasyfork.org/scripts/595613/Madrasati%20Smart%20Attendance%20%7C%20%D8%A7%D9%84%D8%AA%D8%AD%D8%B6%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A%20%D9%84%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A.user.js'],
  ['microsoft-forms-question-bank','5491c6c5e657fba0fe533cb46b63cc9ffa061427157cf1d34f346c2fbdfcdf37','https://update.greasyfork.org/scripts/592704/Microsoft%20Forms%20-%20%D8%A8%D9%86%D9%83%20%D8%A7%D9%84%D8%A3%D8%B3%D8%A6%D9%84%D8%A9%20%D9%88%D8%A7%D9%84%D8%A5%D8%AF%D8%AE%D8%A7%D9%84%20%D8%A7%D9%84%D8%AC%D9%85%D8%A7%D8%B9%D9%8A.user.js'],
  ['microsoft-forms-attachment-reviewer','e2f0d2880f230a4b83d30f7f39159fbe714fc897a5b76135d1cb62f58ce568a0','https://update.greasyfork.org/scripts/595568/Microsoft%20Forms%20-%20%D8%B9%D8%A7%D8%B1%D8%B6%20%D8%A7%D9%84%D9%85%D8%B1%D9%81%D9%82%D8%A7%D8%AA%20%D9%88%D8%A7%D9%84%D8%AA%D8%B5%D8%AD%D9%8A%D8%AD%20%D8%A7%D9%84%D8%B3%D8%B1%D9%8A%D8%B9.user.js'],
  ['student-rased-madrasati-noor','b0870d8e1675bf4b88b6d093c5467a220c7685c4657d1b9842d5dbf5bba24b56','https://update.greasyfork.org/scripts/592894/%D8%B1%D8%A7%D8%B5%D8%AF%20%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8%20%7C%20%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20%2B%20%D9%86%D9%88%D8%B1.user.js'],
  ['madrasati-schedule-designer','ac4572d8d9801cd1a92cf4604c114c2aa16031f4eccfa45ec6022f3cd9ad37b5','https://update.greasyfork.org/scripts/592421/%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20-%20%D9%85%D8%B5%D9%85%D9%85%20%D8%A7%D9%84%D8%AC%D8%AF%D9%88%D9%84%20%D8%A7%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D9%8A%20%D8%A7%D9%84%D8%A7%D8%AD%D8%AA%D8%B1%D8%A7%D9%81%D9%8A.user.js'],
  ['zipgrade-smart-student-manager','3cc1ffd63998c6011c441e86f16af98240bb887ffe79876914aea100c0b90c73','https://update.greasyfork.org/scripts/593089/ZipGrade%20Smart%20Student%20Manager.user.js']
].map(([id, sha256, url]) => ({ id, sha256, url }));

const PACKED = [
  ['m85-noor-grades-assistant','86e7a114e7ade80a9a0242815966aec957381f30776917d84db93ecd37e94d91'],
  ['m85-yahoo-finance-stock-assistant','c58fe66ae417afc4875c656910f0553f20aae37809d6c565205bbd2e95671ff6'],
  ['madrasati-assignment-intelligence','8d9917e6f3e5de5cdc647412173b2633acfd9c855a09e23ca12514c5050ac091'],
  ['microsoft-forms-smart-enhancer','0c25dc2dd2abd8d5276efb4761e704dd9164051b53d1abef61aad1519f229336'],
  ['whatsapp-communication-manager','c84d8d74fd60bde70c10a085835b551509a6df15f91caebd094eb802aa0fcb3e']
].map(([id, sha256]) => ({ id, sha256 }));

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function verify(buf, expected, label) {
  const actual = sha256(buf);
  if (actual !== expected) throw new Error(`${label}: SHA-256 mismatch\nexpected=${expected}\nactual=${actual}`);
}

function canonicalRightsBlock() {
  return `\n/*\n M0HM3D85 RIGHTS BLOCK\n تصميم وتطوير: ${AUTHOR.author}\n GreasyFork  : ${AUTHOR.website}\n GitHub      : ${AUTHOR.repository}\n X / Twitter : ${AUTHOR.x}\n Snapchat    : ${AUTHOR.snapchat}\n ${AUTHOR.copyrightNotice}\n*/\n`;
}

function normalizeMetadata(text) {
  const start = text.indexOf('// ==UserScript==');
  const endToken = '// ==/UserScript==';
  const end = text.indexOf(endToken);
  if (start < 0 || end < start) throw new Error('UserScript metadata block missing');

  const headEnd = end + endToken.length;
  const header = text.slice(start, headEnd);
  const body = text.slice(headEnd);
  let lines = header.split(/\r?\n/);
  const identityKeys = new Set(['@namespace','@author','@homepageURL','@supportURL','@copyright','@license']);
  lines = lines.filter((line) => {
    const m = line.match(/^\s*\/\/\s*(@\S+)/);
    return !(m && identityKeys.has(m[1]));
  });

  const canonical = [
    `// @namespace    ${AUTHOR.namespace}`,
    `// @author       ${AUTHOR.author}`,
    `// @homepageURL  ${AUTHOR.website}`,
    `// @supportURL   ${AUTHOR.support}`,
    `// @copyright    ${AUTHOR.copyrightHeader}`,
    `// @license      ${AUTHOR.license}`
  ];

  const closeIndex = lines.findIndex((line) => line.includes('==/UserScript=='));
  lines.splice(closeIndex, 0, ...canonical);
  let out = lines.join('\n') + body;

  if (!out.includes('M0HM3D85 RIGHTS BLOCK')) {
    const newEnd = out.indexOf(endToken) + endToken.length;
    out = out.slice(0, newEnd) + canonicalRightsBlock() + out.slice(newEnd);
  }
  return out.replace(/\r\n/g, '\n');
}

async function fetchRemote(item) {
  const res = await fetch(item.url, { headers: { 'user-agent': 'M0HM3D85-teacher-userscripts-importer/1.0' } });
  if (!res.ok) throw new Error(`${item.id}: GreasyFork HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  verify(buf, item.sha256, `${item.id} GreasyFork source`);
  return buf;
}

function readPacked(item) {
  const dir = path.join(IMPORT_ROOT, item.id);
  const parts = fs.readdirSync(dir).filter((name) => /^part-\d+\.txt$/.test(name)).sort();
  if (!parts.length) throw new Error(`${item.id}: packed parts missing`);
  const b64 = parts.map((name) => fs.readFileSync(path.join(dir, name), 'utf8').trim()).join('');
  const buf = zlib.brotliDecompressSync(Buffer.from(b64, 'base64'));
  verify(buf, item.sha256, `${item.id} uploaded source`);
  return buf;
}

function writeScript(id, sourceBuf, sourceKind) {
  const item = BY_ID.get(id);
  if (!item) throw new Error(`${id}: missing catalog entry`);
  const normalized = normalizeMetadata(sourceBuf.toString('utf8'));
  const version = normalized.match(/^\s*\/\/\s*@version\s+(.+)$/m)?.[1]?.trim();
  if (version !== item.version) throw new Error(`${id}: version mismatch ${version} != ${item.version}`);
  const dest = path.join(ROOT, item.sourcePath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, normalized, 'utf8');

  const readme = `# ${item.name}\n\n**الإصدار:** ${item.version}\n\n${item.description}\n\n## الصفحات المدعومة\n\n${item.targets.map((t) => `- \`${t}\``).join('\n')}\n\n## المصدر والنشر\n\n- المصدر الرسمي: GitHub / \`main\`.\n- التثبيت والتحديث العام: ${item.greasyFork || 'لم يُربط بـ GreasyFork بعد'}.\n- الدعم: ${AUTHOR.support}\n\n© 2026 ${AUTHOR.author}. All Rights Reserved.\n`;
  fs.writeFileSync(path.join(path.dirname(dest), 'README.md'), readme, 'utf8');

  const changelog = `# Changelog\n\n## [${item.version}] - 2026-09-17\n\n- اعتماد النسخة التي سلّمها المطور كخط أساس رسمي في GitHub.\n- توحيد بيانات المطور والحقوق وروابط الدعم دون تغيير الوظائف.\n- مصدر الاستيراد: ${sourceKind}.\n\n> ابتداءً من التحديث التالي، تُسجل هنا الميزات والإصلاحات وتغييرات الاستخدام بالتفصيل قبل مزامنة GreasyFork.\n`;
  fs.writeFileSync(path.join(path.dirname(dest), 'CHANGELOG.md'), changelog, 'utf8');

  return { id, version: item.version, sourceKind, originalSha256: sha256(sourceBuf), normalizedSha256: sha256(Buffer.from(normalized)) };
}

const audit = [];
for (const item of REMOTE) audit.push(writeScript(item.id, await fetchRemote(item), 'GreasyFork verified against uploaded SHA-256'));
for (const item of PACKED) audit.push(writeScript(item.id, readPacked(item), 'user-uploaded file (Brotli pack, SHA-256 verified)'));

fs.mkdirSync(path.join(ROOT, 'docs'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'docs', 'IMPORT_AUDIT.json'), JSON.stringify({ importedAt: '2026-09-17', scripts: audit }, null, 2) + '\n');

// Remove all transport-only directories after a successful verified import.
fs.rmSync(path.join(ROOT, 'imports-official'), { recursive: true, force: true });
fs.rmSync(path.join(ROOT, 'imports-bulk'), { recursive: true, force: true });

console.log(`✅ Imported and normalized ${audit.length} official userscripts.`);
for (const row of audit) console.log(`   ${row.id} v${row.version} — ${row.normalizedSha256}`);
