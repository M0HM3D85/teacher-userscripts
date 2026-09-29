// ==UserScript==
// @name         ZipGrade Smart Student Manager
// @name:en      ZipGrade Smart Student Manager
// @name:ar      مدير طلاب ZipGrade الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.8.1
// @description  Smart ZipGrade student import/management with in-manager student deletion plus an inline quiz auditor for duplicates, identity, multi-answer, blank, and partial-response review.
// @description:en Smart ZipGrade student import/management with in-manager student deletion plus an inline quiz auditor for duplicates, identity, multi-answer, blank, and partial-response review.
// @description:ar استيراد وإدارة طلاب ZipGrade بذكاء، مع حذف الطالب من داخل المدير ومدقق اختبار مدمج لفحص التكرار والحسابات والتظليل المتعدد والإجابات الفارغة والدرجات الجزئية قبل التصدير.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://github.com/M0HM3D85/teacher-userscripts/tree/main/scripts/zipgrade-smart-student-manager
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://www.zipgrade.com/students/*
// @match        https://www.zipgrade.com/importStudents*
// @match        https://www.zipgrade.com/quiz/*/all/*
// @match        https://www.zipgrade.com/quiz/*/paper/*/subject/all/*
// @run-at       document-idle
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @require      https://cdn.jsdelivr.net/gh/M0HM3D85/teacher-userscripts@7cd9b5a395ae64b5317160d8dca05dfe56f9eecf/scripts/zipgrade-smart-student-manager/zipgrade-smart-student-manager.user.js
// @grant        none
// ==/UserScript==

/*
=========================================================================
 ZipGrade Smart Student Manager v0.8.1 — Final Release

 الإصدار النهائي لهذه المرحلة يجمع في سكربت Tampermonkey واحد:
 1) الاستيراد الذكي وإدارة الطلاب.
 2) حذف الطالب من داخل مدير الطلاب مع تأكيد وتحقق بعد الحذف.
 3) مدقق الاختبار المعتمد على Full Format CSV.
 4) كشف التكرار ومشاكل CustomID والتظليل المتعدد والإجابات الفارغة والدرجات الجزئية.
 5) تمييز صفوف الطلاب والتنقل بين أوراق الاختبار.
 6) حماية تصدير Full XLSX حتى اكتمال المراجعة.

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
=========================================================================
*/

/*
=========================================================================
 ZipGrade Smart Student Manager - Quiz Auditor Module v0.8.1

 بنية مدقق الاختبار:
 - التحليل الكامل يعتمد على Full Format CSV الرسمي من ZipGrade.
 - Full CSV يحتوي StudentID / CustomID وإجابة كل سؤال ودرجته وحالته.
 - نطابق StudentID مع صف الطالب في #gradedPapers، وبالتالي نعرف الطالب
   صاحب كل تظليل متعدد أو إجابة فارغة أو درجة جزئية بدقة.
 - Item Analysis لا يتم تلوينه ولا يُستخدم لتحديد اسم الطالب.
 - كل التلوين يكون على صفوف الطلاب في جدول gradedPapers.
 - صفحة الطالب تحتوي على شريط تنقل مدمج + ملخص مشاكله الحالية.
=========================================================================
*/

(() => {
    'use strict';

    const APP = 'zgssm-audit3';
    const VERSION = '0.8.1';
    const FRESH_MS = 30 * 60 * 1000;

    const ROUTE = parseRoute();
    if (!ROUTE.quizId || !['quiz-all', 'paper-all'].includes(ROUTE.type)) return;

    const STORE = {
        audit: `ZGSSM_AUDIT_V3_${ROUTE.quizId}`,
        reviews: `ZGSSM_AUDIT_REVIEWS_V3_${ROUTE.quizId}`,
        papers: `ZGSSM_AUDIT_PAPERS_V3_${ROUTE.quizId}`
    };

    let RUNNING = false;

    function parseRoute(pathname = location.pathname) {
        const paper = pathname.match(/^\/quiz\/([^/]+)\/paper\/([^/]+)\/subject\/all\/?/i);
        if (paper) {
            return { type: 'paper-all', quizId: decodeURIComponent(paper[1]), paperId: decodeURIComponent(paper[2]) };
        }
        const all = pathname.match(/^\/quiz\/([^/]+)\/all\/?/i);
        if (all) {
            return { type: 'quiz-all', quizId: decodeURIComponent(all[1]), paperId: '' };
        }
        return { type: 'other', quizId: '', paperId: '' };
    }

    function clean(v) {
        return String(v ?? '')
            .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function canon(v) {
        return clean(v).normalize('NFKC').toLowerCase().replace(/\s+/g, '');
    }

    function esc(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function abs(href) {
        try { return new URL(href, location.href).href; }
        catch (_) { return ''; }
    }

    function paperIdFromUrl(url) {
        try {
            const m = new URL(url, location.href).pathname.match(/\/paper\/([^/]+)\/subject\/all\/?/i);
            return m ? decodeURIComponent(m[1]) : '';
        } catch (_) { return ''; }
    }

    function quizUrl() {
        return `${location.origin}/quiz/${encodeURIComponent(ROUTE.quizId)}/all/`;
    }

    function load(key, fallback = null) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || 'null');
            return v == null ? fallback : v;
        } catch (_) { return fallback; }
    }

    function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
    function remove(key) { localStorage.removeItem(key); }
    function isEmailish(v) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(canon(v)); }
    function normHeader(v) { return clean(v).replace(/^\uFEFF/, '').toLowerCase().replace(/[\s_.-]+/g, ''); }
    function auditFresh(audit) { return Boolean(audit?.createdAt && Date.now() - audit.createdAt <= FRESH_MS); }

    function auditAge(audit) {
        if (!audit?.createdAt) return '';
        const m = Math.max(0, Math.round((Date.now() - audit.createdAt) / 60000));
        if (m < 1) return 'الآن';
        if (m < 60) return `منذ ${m} دقيقة`;
        return `منذ ${Math.round(m / 60)} ساعة`;
    }

    function notify(message, type = 'info') {
        const host = document.getElementById(`${APP}-root`) || document.getElementById(`${APP}-paper`) || document.querySelector('.page-content .container') || document.body;
        host.querySelector?.(`#${APP}-notice`)?.remove();
        const box = document.createElement('div');
        box.id = `${APP}-notice`;
        box.className = `alert ${type === 'error' ? 'alert-danger' : type === 'success' ? 'alert-success' : 'alert-info'}`;
        box.style.cssText = 'direction:rtl;text-align:right;margin:10px 0;';
        box.textContent = message;
        host.prepend(box);
        setTimeout(() => box.remove(), 4500);
    }

    function injectCss() {
        if (document.getElementById(`${APP}-css`)) return;
        const style = document.createElement('style');
        style.id = `${APP}-css`;
        style.textContent = `
#${APP}-root,#${APP}-paper{direction:rtl;text-align:right;font-family:Tahoma,Arial,sans-serif}
.${APP}-toolbar{display:flex;flex-wrap:wrap;gap:7px;align-items:center}
.${APP}-summary{display:flex;flex-wrap:wrap;gap:7px;margin:10px 0}
.${APP}-chip{display:inline-flex;gap:5px;align-items:center;border:1px solid #ddd;background:#fff;border-radius:999px;padding:5px 10px;font-size:12px}
.${APP}-chip strong{font-size:14px}
.${APP}-legend{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}
.${APP}-badge{display:inline-block;border-radius:999px;padding:3px 8px;font-size:11px;font-weight:700;line-height:1.35;white-space:nowrap}
.${APP}-critical{background:#f2dede;color:#a94442}. ${APP}-multi{background:#fcf8e3;color:#8a6d3b}
.${APP}-multi{background:#fcf8e3;color:#8a6d3b}.${APP}-blank{background:#fff4cc;color:#7a5a00}.${APP}-partial{background:#d9edf7;color:#31708f}.${APP}-reviewed{background:#dff0d8;color:#3c763d}
#gradedPapers tr.${APP}-row-critical>td{background:#fbe6e5!important}#gradedPapers tr.${APP}-row-multi>td{background:#fff0d0!important}#gradedPapers tr.${APP}-row-blank>td{background:#fff9df!important}#gradedPapers tr.${APP}-row-partial>td{background:#e7f5fb!important}#gradedPapers tr.${APP}-row-reviewed>td{background:#edf8ed!important}
#gradedPapers tr.${APP}-row-critical>td:first-child{box-shadow:inset 4px 0 0 #d9534f}#gradedPapers tr.${APP}-row-multi>td:first-child{box-shadow:inset 4px 0 0 #f0ad4e}#gradedPapers tr.${APP}-row-blank>td:first-child{box-shadow:inset 4px 0 0 #d6b932}#gradedPapers tr.${APP}-row-partial>td:first-child{box-shadow:inset 4px 0 0 #5bc0de}#gradedPapers tr.${APP}-row-reviewed>td:first-child{box-shadow:inset 4px 0 0 #5cb85c}
.${APP}-rowbadges{display:inline-flex;flex-wrap:wrap;gap:4px;margin-right:6px;vertical-align:middle}.${APP}-status{margin:10px 0;padding:10px 12px;border-radius:4px;font-weight:700}.${APP}-status-ok{background:#dff0d8;border:1px solid #d6e9c6;color:#3c763d}.${APP}-status-warn{background:#fcf8e3;border:1px solid #faebcc;color:#8a6d3b}.${APP}-progress{display:none;margin-top:10px}.${APP}-progress[data-show="1"]{display:block}.${APP}-progress .progress{height:12px;margin:6px 0 0}.${APP}-issues td,.${APP}-issues th{text-align:right!important;vertical-align:middle!important}.${APP}-paper-nav{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:8px 0 12px}.${APP}-paper-pos{border:1px solid #ddd;background:#fff;border-radius:4px;padding:6px 10px;font-weight:700}.${APP}-paper-problems{margin:8px 0 0}`;
        document.head.appendChild(style);
    }

    function parseCSV(text) {
        const rows = [];
        let row = [], field = '', quoted = false;
        for (let i = 0; i < text.length; i++) {
            const ch = text[i];
            if (quoted) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { field += '"'; i++; }
                    else quoted = false;
                } else field += ch;
                continue;
            }
            if (ch === '"') quoted = true;
            else if (ch === ',') { row.push(field); field = ''; }
            else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
            else field += ch;
        }
        if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
        return rows.filter(r => r.some(v => clean(v) !== ''));
    }

    function csvToObjects(text) {
        const rows = parseCSV(text);
        if (rows.length < 2) throw new Error('ملف Full CSV لا يحتوي بيانات كافية.');
        const rawHeaders = rows[0].map((h, i) => i === 0 ? h.replace(/^\uFEFF/, '') : h);
        const headers = rawHeaders.map(normHeader);
        return {
            rawHeaders,
            headers,
            objects: rows.slice(1).map(values => {
                const obj = {};
                headers.forEach((h, i) => { obj[h] = values[i] ?? ''; });
                return obj;
            })
        };
    }

    function questionNumbers(headers) {
        return headers.map(h => { const m = h.match(/^stu(\d+)$/); return m ? Number(m[1]) : 0; }).filter(Boolean).sort((a, b) => a - b);
    }

    function gradedTable(doc = document) { return doc.querySelector('table#gradedPapers'); }

    function headerInfo(table) {
        const headerRow = [...table.querySelectorAll('tr')].find(row => {
            const t = clean(row.textContent).toLowerCase();
            return t.includes('name') && t.includes('id') && t.includes('pts');
        });
        if (!headerRow) return { row: null, headers: [] };
        return { row: headerRow, headers: [...headerRow.querySelectorAll('th,td')].map(c => clean(c.textContent).toLowerCase()) };
    }

    function findIndex(headers, words) { return headers.findIndex(h => words.some(w => h === w || h.includes(w))); }

    function parsePaperRows(doc = document) {
        const table = gradedTable(doc);
        if (!table) return [];
        const hi = headerInfo(table);
        const idI = findIndex(hi.headers, ['id']);
        const nameI = findIndex(hi.headers, ['name']);
        const ptsI = findIndex(hi.headers, ['pts', 'points']);
        const pctI = findIndex(hi.headers, ['%']);
        const keyI = findIndex(hi.headers, ['key']);
        const timeI = findIndex(hi.headers, ['time']);
        const result = [];
        for (const row of table.querySelectorAll('tr')) {
            if (row === hi.row) continue;
            const link = row.querySelector('a[href*="/paper/"][href*="/subject/all/"]');
            if (!link) continue;
            const cells = [...row.querySelectorAll(':scope > td')].map(td => clean(td.textContent));
            const url = abs(link.getAttribute('href'));
            const paperId = paperIdFromUrl(url);
            if (!paperId) continue;
            result.push({
                index: result.length,
                paperId,
                paperUrl: url,
                studentId: idI >= 0 ? clean(cells[idI]) : '',
                name: nameI >= 0 ? clean(cells[nameI]).replace(/^[,،\s]+/, '') : clean(link.textContent).replace(/^[,،\s]+/, ''),
                points: ptsI >= 0 ? clean(cells[ptsI]) : '',
                percent: pctI >= 0 ? clean(cells[pctI]) : '',
                keyVersion: keyI >= 0 ? clean(cells[keyI]) : '',
                scannedAt: timeI >= 0 ? clean(cells[timeI]) : '',
                row: doc === document ? row : null
            });
        }
        return result;
    }

    function findFullCsv(doc = document) {
        const a = [...doc.querySelectorAll('a[href]')].find(link => /full format \(with student responses\)\s*-\s*csv/i.test(clean(link.textContent)) || /\/quiz\/full\/all\/.+\.csv(?:$|\?)/i.test(link.href || ''));
        return a ? abs(a.getAttribute('href')) : `${location.origin}/quiz/full/all/${ROUTE.quizId}.CSV`;
    }

    function findFullXlsx(doc = document) {
        const a = [...doc.querySelectorAll('a[href]')].find(link => /full format \(with student responses\)\s*-\s*xlsx/i.test(clean(link.textContent)) || /\/quiz\/full\/all\/.+\.xlsx(?:$|\?)/i.test(link.href || ''));
        return a ? abs(a.getAttribute('href')) : `${location.origin}/quiz/full/all/${ROUTE.quizId}.XLSX`;
    }

    function isBlankResponse(v) { const s = clean(v); return !s || s === '_'; }

    function isMultiResponse(v) {
        const raw = clean(v).replace(/\s+/g, '');
        if (!raw) return false;
        const single = new Set(['ص','خ','أ','ا','ب','ج','د','هـ','ه','A','B','C','D','E','F','a','b','c','d','e','f','0','1','½','0.5','.5','0,5']);
        if (single.has(raw)) return false;
        const normalized = raw.replace(/[،,;/|+\-]/g, '').replace(/ا/g, 'أ').replace(/هـ/g, 'ه');
        const choices = [];
        for (const ch of normalized) if (/[أبجدهصخA-Fa-f]/.test(ch)) choices.push(ch.toUpperCase());
        return new Set(choices).size >= 2;
    }

    function getReviews() { return load(STORE.reviews, {}); }
    function reviewKey(issue) { return [issue.paperId || issue.studentId, issue.question, canon(issue.response), canon(issue.primary)].join('|'); }

    function setReviewed(issue, yes) {
        const all = getReviews();
        const key = reviewKey(issue);
        if (yes) all[key] = { at: Date.now(), paperId: issue.paperId, studentId: issue.studentId, question: issue.question, response: issue.response, primary: issue.primary };
        else delete all[key];
        save(STORE.reviews, all);
    }

    function hydrate(audit) {
        if (!audit) return null;
        const reviews = getReviews();
        const multi = (audit.multi || []).map(x => ({ ...x, reviewed: Boolean(reviews[reviewKey(x)]) }));
        const unresolvedMulti = multi.filter(x => !x.reviewed).length;
        const blockers = (audit.duplicates?.length || 0) + (audit.identityProblems?.length || 0) + (audit.unmappedRecords?.length || 0);
        return { ...audit, multi, unresolvedMulti, blockers, ready: blockers === 0 && unresolvedMulti === 0 };
    }

    function assignPapersToRecords(records, papers) {
        const byId = new Map(), byName = new Map(), idCursor = new Map(), nameCursor = new Map();
        for (const paper of papers) {
            const idKey = canon(paper.studentId), nameKey = canon(paper.name);
            if (idKey) { if (!byId.has(idKey)) byId.set(idKey, []); byId.get(idKey).push(paper); }
            if (nameKey) { if (!byName.has(nameKey)) byName.set(nameKey, []); byName.get(nameKey).push(paper); }
        }
        return records.map(record => {
            let paper = null;
            const idKey = canon(record.studentId);
            if (idKey && byId.has(idKey)) {
                const list = byId.get(idKey), pos = idCursor.get(idKey) || 0;
                paper = list[Math.min(pos, list.length - 1)] || null;
                idCursor.set(idKey, pos + 1);
            }
            if (!paper) {
                const nameKey = canon(record.name);
                if (nameKey && byName.has(nameKey)) {
                    const list = byName.get(nameKey), pos = nameCursor.get(nameKey) || 0;
                    paper = list[Math.min(pos, list.length - 1)] || null;
                    nameCursor.set(nameKey, pos + 1);
                }
            }
            return { ...record, paperId: paper?.paperId || '', paperUrl: paper?.paperUrl || '' };
        });
    }

    function duplicateGroups(records) {
        const raw = [];
        for (const basis of [{ label: 'CustomID / الحساب', getter: r => r.externalRef }, { label: 'StudentID', getter: r => r.studentId }]) {
            const map = new Map();
            records.forEach((r, index) => {
                const key = canon(basis.getter(r));
                if (!key) return;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push({ ...r, recordIndex: index });
            });
            for (const [key, items] of map.entries()) if (items.length > 1) raw.push({ key, basis: basis.label, value: basis.getter(items[0]), items });
        }
        const merged = new Map();
        for (const g of raw) {
            const signature = g.items.map(x => x.recordIndex).sort((a,b) => a-b).join('|');
            if (!merged.has(signature)) merged.set(signature, { bases: [g.basis], value: g.value, items: g.items });
            else {
                const current = merged.get(signature);
                if (!current.bases.includes(g.basis)) current.bases.push(g.basis);
            }
        }
        return [...merged.values()];
    }

    async function fetchFullCsv() {
        const url = findFullCsv(document);
        const response = await fetch(url, { credentials: 'include', cache: 'no-store' });
        if (!response.ok) throw new Error(`تعذر قراءة Full CSV (HTTP ${response.status})`);
        return { url, text: await response.text() };
    }

    async function buildAudit() {
        const papers = parsePaperRows(document);
        if (!papers.length) throw new Error('لم يتم العثور على صفوف الطلاب في gradedPapers.');
        const csv = await fetchFullCsv();
        const parsed = csvToObjects(csv.text);
        const qNumbers = questionNumbers(parsed.headers);
        if (!qNumbers.length) throw new Error('Full CSV لا يحتوي أعمدة Stu1 / Stu2 ...');
        const rawRecords = parsed.objects.map((row, rowIndex) => {
            const first = clean(row.firstname), last = clean(row.lastname);
            return {
                sourceRow: rowIndex + 2,
                studentId: clean(row.studentid || row.zipgradeid),
                externalRef: clean(row.customid || row.externalid),
                name: clean(`${first} ${last}`) || clean(row.name),
                earnedPoints: clean(row.earnedpoints),
                possiblePoints: clean(row.possiblepoints),
                percent: clean(row.percentcorrect),
                keyVersion: clean(row.keyversion),
                row
            };
        });
        const records = assignPapersToRecords(rawRecords, papers);
        const multi = [], blanks = [], partials = [], identityProblems = [], unmappedRecords = [];
        for (const record of records) {
            if (!record.externalRef || !isEmailish(record.externalRef)) {
                identityProblems.push({ studentId: record.studentId, externalRef: record.externalRef, name: record.name, paperId: record.paperId, paperUrl: record.paperUrl, type: !record.externalRef ? 'missing' : 'invalid' });
            }
            if (!record.paperId) unmappedRecords.push({ studentId: record.studentId, externalRef: record.externalRef, name: record.name, sourceRow: record.sourceRow });
            for (const q of qNumbers) {
                const response = clean(record.row[`stu${q}`]), primary = clean(record.row[`prikey${q}`]), points = clean(record.row[`points${q}`]), mark = clean(record.row[`mark${q}`]).toUpperCase();
                const issue = { studentId: record.studentId, externalRef: record.externalRef, name: record.name, paperId: record.paperId, paperUrl: record.paperUrl, question: q, response, primary, points, mark };
                if (isMultiResponse(response)) multi.push(issue);
                else if (isBlankResponse(response)) blanks.push(issue);
                else if (mark === 'P') partials.push(issue);
            }
        }
        const audit = {
            schema: 3,
            appVersion: VERSION,
            createdAt: Date.now(),
            quizId: ROUTE.quizId,
            paperCount: papers.length,
            csvRecordCount: records.length,
            questionCount: qNumbers.length,
            fullCsvUrl: csv.url,
            fullXlsxUrl: findFullXlsx(document),
            papers: papers.map(p => ({ index:p.index,paperId:p.paperId,paperUrl:p.paperUrl,studentId:p.studentId,name:p.name,points:p.points,percent:p.percent,keyVersion:p.keyVersion,scannedAt:p.scannedAt })),
            records: records.map(r => ({ studentId:r.studentId,externalRef:r.externalRef,name:r.name,paperId:r.paperId,paperUrl:r.paperUrl,earnedPoints:r.earnedPoints,possiblePoints:r.possiblePoints,percent:r.percent })),
            duplicates: duplicateGroups(records),
            identityProblems,
            unmappedRecords,
            multi,
            blanks,
            partials
        };
        save(STORE.audit, audit);
        save(STORE.papers, audit.papers);
        return hydrate(audit);
    }

    function findInsertPoint() {
        const table = gradedTable(document);
        if (!table) return null;
        const portlet = table.closest('.portlet');
        if (portlet?.parentElement) return { parent: portlet.parentElement, before: portlet };
        return { parent: table.parentElement, before: table };
    }

    function createInlineRoot() {
        if (document.getElementById(`${APP}-root`)) return;
        const point = findInsertPoint();
        if (!point) return;
        const root = document.createElement('div');
        root.id = `${APP}-root`;
        root.className = 'portlet light bordered';
        root.innerHTML = `<div class="portlet-title"><div class="caption"><i class="fa fa-stethoscope font-blue-sharp"></i><span class="caption-subject font-blue-sharp bold uppercase"> مدقق الاختبار </span><span style="font-size:11px;color:#999;margin-right:8px">v${VERSION}</span></div><div class="actions ${APP}-toolbar"><button type="button" class="btn btn-circle btn-primary" data-action="scan"><i class="fa fa-search"></i> فحص النتائج</button><button type="button" class="btn btn-circle btn-default" data-action="refresh"><i class="fa fa-refresh"></i> تحديث العرض</button><button type="button" class="btn btn-circle btn-default" data-action="reset-reviews">إعادة ضبط المراجعات</button><button type="button" class="btn btn-circle btn-default" data-action="clear">مسح نتيجة الفحص</button></div></div><div class="portlet-body"><div class="${APP}-progress" data-role="progress"><strong>جارٍ قراءة Full CSV وتحليل إجابات الطلاب...</strong><div class="progress progress-striped active"><div class="progress-bar progress-bar-info" style="width:100%"></div></div></div><div data-role="content"></div></div>`;
        point.parent.insertBefore(root, point.before);
        root.addEventListener('click', async event => {
            const el = event.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            if (action === 'scan') return runScan();
            if (action === 'refresh') return renderQuiz();
            if (action === 'reset-reviews') { if (confirm('إلغاء جميع علامات المراجعة لهذا الاختبار؟')) { remove(STORE.reviews); renderQuiz(); } return; }
            if (action === 'clear') { if (confirm('مسح نتيجة الفحص المحفوظة لهذا الاختبار فقط؟')) { remove(STORE.audit); renderQuiz(); } return; }
            if (action === 'keep' || action === 'unreview') {
                const audit = hydrate(load(STORE.audit));
                const issue = audit?.multi?.find(x => reviewKey(x) === el.dataset.issue);
                if (!issue) return;
                setReviewed(issue, action === 'keep');
                renderQuiz();
                if (action === 'keep') notify(`تم اعتماد مراجعة ${issue.name} — السؤال ${issue.question} مع إبقاء الإجابة كما هي.`, 'success');
                return;
            }
            if (action === 'export') exportXlsx();
        });
        renderQuiz();
    }

    async function runScan() {
        if (RUNNING) return;
        RUNNING = true;
        const button = document.querySelector(`#${APP}-root [data-action="scan"]`);
        const progress = document.querySelector(`#${APP}-root [data-role="progress"]`);
        if (button) button.disabled = true;
        if (progress) progress.dataset.show = '1';
        try {
            const audit = await buildAudit();
            renderQuiz(audit);
            notify(audit.ready ? 'اكتمل الفحص: النتائج جاهزة للتصدير.' : 'اكتمل الفحص وتوجد عناصر تحتاج مراجعة.', audit.ready ? 'success' : 'info');
        } catch (error) {
            console.error('[ZGSSM Audit v0.8.1]', error);
            notify(clean(error?.message || error), 'error');
        } finally {
            RUNNING = false;
            if (button) button.disabled = false;
            if (progress) progress.dataset.show = '0';
        }
    }

    function renderQuiz(prepared = null) {
        const content = document.querySelector(`#${APP}-root [data-role="content"]`);
        if (!content) return;
        const audit = prepared || hydrate(load(STORE.audit));
        content.innerHTML = renderAudit(audit);
        highlightStudentRows(audit);
    }

    function chip(label, value, note = '') { return `<span class="${APP}-chip">${esc(label)}: <strong>${esc(value)}</strong>${note ? `<small style="color:#888">${esc(note)}</small>` : ''}</span>`; }
    function badge(text, type) { return `<span class="${APP}-badge ${APP}-${type}">${esc(text)}</span>`; }
    function panel(type, title, body) { return `<div class="panel panel-${type}" style="margin-bottom:10px"><div class="panel-heading"><strong>${esc(title)}</strong></div><div class="panel-body" style="padding:0;overflow:auto">${body}</div></div>`; }

    function renderAudit(audit) {
        if (!audit) return `<div class="alert alert-info">سيعتمد الفحص على <strong>Full Format CSV</strong> نفسه. اضغط <strong>فحص النتائج</strong> لربط كل مشكلة باسم الطالب وصفه في الجدول.</div>`;
        const stale = !auditFresh(audit), reviewed = audit.multi.filter(x => x.reviewed).length;
        return `<div class="${APP}-status ${audit.ready ? `${APP}-status-ok` : `${APP}-status-warn`}">${audit.ready ? '✅ الاختبار جاهز للتصدير إلى المحلل.' : `⚠️ توجد عناصر تحتاج مراجعة. المشاكل المانعة: ${audit.blockers}، والتظليل المتعدد غير المراجع: ${audit.unresolvedMulti}.`}</div><div style="color:#999;font-size:12px;margin-bottom:7px">آخر فحص: ${esc(auditAge(audit))}${stale ? ' — النتيجة قديمة ويجب إعادة الفحص قبل التصدير.' : ''}</div><div class="${APP}-summary">${chip('أوراق الصفحة', audit.paperCount)}${chip('سجلات Full CSV', audit.csvRecordCount)}${chip('الأسئلة', audit.questionCount)}${chip('التكرارات', audit.duplicates.length)}${chip('مشاكل الحساب', audit.identityProblems.length)}${chip('غير مرتبط بصف', audit.unmappedRecords.length)}${chip('تظليل متعدد', audit.multi.length, `${reviewed} تمت مراجعته`)}${chip('إجابات فارغة', audit.blanks.length)}${chip('درجات جزئية', audit.partials.length)}</div><div class="${APP}-legend">${badge('أحمر: تكرار / مشكلة حساب / عدم تطابق','critical')}${badge('برتقالي: تظليل متعدد يحتاج قرارك','multi')}${badge('أصفر: إجابة فارغة','blank')}${badge('أزرق: درجة جزئية','partial')}${badge('أخضر: تمت مراجعة التظليل المتعدد','reviewed')}</div>${renderDuplicates(audit.duplicates)}${renderIdentity(audit.identityProblems)}${renderUnmapped(audit.unmappedRecords)}${renderMulti(audit.multi)}${renderBlanks(audit.blanks)}${renderPartials(audit.partials)}<div class="panel panel-default"><div class="panel-heading"><strong>التصدير للمحلل</strong></div><div class="panel-body"><button type="button" class="btn btn-primary" data-action="export" ${audit.ready && !stale ? '' : 'disabled'}><i class="fa fa-download"></i> تنزيل Full XLSX الجاهز للمحلل</button><span style="color:#777;font-size:12px;margin-right:8px">التحليل يتم من CSV، والتصدير النهائي يبقى ملف XLSX الأصلي من ZipGrade.</span></div></div>`;
    }

    function paperLink(x) { return x.paperUrl ? `<a href="${esc(x.paperUrl)}"><strong>${esc(x.name || x.studentId)}</strong></a>` : `<strong>${esc(x.name || x.studentId || '—')}</strong>`; }

    function renderDuplicates(groups) {
        if (!groups.length) return '';
        return panel('danger', `الأوراق / السجلات المكررة (${groups.length})`, `<table class="table table-bordered table-condensed ${APP}-issues"><thead><tr><th>المعرّف</th><th>سبب التطابق</th><th>الطلاب / الأوراق</th></tr></thead><tbody>${groups.map(g => `<tr><td><strong>${esc(g.value)}</strong></td><td>${esc(g.bases.join(' + '))}</td><td>${g.items.map(x => x.paperUrl ? `<a class="btn btn-xs btn-default" href="${esc(x.paperUrl)}">${esc(x.name || x.studentId)}</a>` : `<span>${esc(x.name || x.studentId)}</span>`).join(' ')}</td></tr>`).join('')}</tbody></table>`);
    }

    function renderIdentity(items) {
        if (!items.length) return '';
        return panel('danger', `مشاكل CustomID / الحساب (${items.length})`, `<table class="table table-bordered table-condensed ${APP}-issues"><thead><tr><th>الطالب</th><th>StudentID</th><th>CustomID</th><th>المشكلة</th></tr></thead><tbody>${items.map(x => `<tr><td>${paperLink(x)}</td><td>${esc(x.studentId || '—')}</td><td>${esc(x.externalRef || '—')}</td><td>${x.type === 'missing' ? 'الحساب مفقود' : 'الحساب ليس بصيغة بريد صالحة للربط'}</td></tr>`).join('')}</tbody></table>`);
    }

    function renderUnmapped(items) {
        if (!items.length) return '';
        return panel('danger', `سجلات Full CSV لم أجد لها صف طالب في الصفحة (${items.length})`, `<table class="table table-bordered table-condensed ${APP}-issues"><thead><tr><th>الطالب</th><th>StudentID</th><th>CustomID</th><th>صف CSV</th></tr></thead><tbody>${items.map(x => `<tr><td>${esc(x.name || '—')}</td><td>${esc(x.studentId || '—')}</td><td>${esc(x.externalRef || '—')}</td><td>${esc(x.sourceRow)}</td></tr>`).join('')}</tbody></table>`);
    }

    function renderMulti(items) {
        if (!items.length) return '';
        return panel('warning', `التظليل المتعدد — قرار المعلم (${items.length})`, `<table class="table table-bordered table-condensed ${APP}-issues"><thead><tr><th>الطالب</th><th>السؤال</th><th>إجابة الطالب</th><th>الصحيحة</th><th>الحالة</th></tr></thead><tbody>${items.map(x => { const key = reviewKey(x); return `<tr><td>${paperLink(x)}<br><small>${esc(x.externalRef || '')}</small></td><td>س${esc(x.question)}</td><td><strong>${esc(x.response)}</strong></td><td>${esc(x.primary || '—')}</td><td>${x.reviewed ? `${badge('تمت المراجعة','reviewed')} <button type="button" class="btn btn-xs btn-default" data-action="unreview" data-issue="${esc(key)}">إلغاء</button>` : `${badge('يحتاج قرارك','multi')} <button type="button" class="btn btn-xs btn-warning" data-action="keep" data-issue="${esc(key)}">راجعتها — أبقها كما هي</button>`}</td></tr>`; }).join('')}</tbody></table>`);
    }

    function groupByStudent(items) {
        const map = new Map();
        for (const x of items) {
            const key = x.paperId || canon(x.studentId) || canon(x.name);
            if (!map.has(key)) map.set(key, { name:x.name, studentId:x.studentId, externalRef:x.externalRef, paperId:x.paperId, paperUrl:x.paperUrl, questions:[] });
            map.get(key).questions.push(x.question);
        }
        return [...map.values()];
    }

    function renderBlanks(items) {
        if (!items.length) return '';
        const groups = groupByStudent(items);
        return panel('warning', `الإجابات الفارغة (${items.length})`, `<table class="table table-bordered table-condensed ${APP}-issues"><thead><tr><th>الطالب</th><th>الأسئلة الفارغة</th></tr></thead><tbody>${groups.map(g => `<tr><td>${paperLink(g)}</td><td>${g.questions.map(q => `س${q}`).join('، ')}</td></tr>`).join('')}</tbody></table>`);
    }

    function renderPartials(items) {
        if (!items.length) return '';
        return panel('info', `الدرجات الجزئية (${items.length})`, `<table class="table table-bordered table-condensed ${APP}-issues"><thead><tr><th>الطالب</th><th>السؤال</th><th>الإجابة</th><th>النقاط</th></tr></thead><tbody>${items.map(x => `<tr><td>${paperLink(x)}</td><td>س${esc(x.question)}</td><td>${esc(x.response || '—')}</td><td>${esc(x.points || '—')}</td></tr>`).join('')}</tbody></table>`);
    }

    function clearStudentHighlights() {
        const table = gradedTable(document);
        if (!table) return;
        for (const row of table.querySelectorAll('tr')) {
            row.classList.remove(`${APP}-row-critical`,`${APP}-row-multi`,`${APP}-row-blank`,`${APP}-row-partial`,`${APP}-row-reviewed`);
            row.querySelectorAll(`.${APP}-rowbadges`).forEach(el => el.remove());
        }
    }

    function highlightStudentRows(audit) {
        clearStudentHighlights();
        if (!audit) return;
        const papers = parsePaperRows(document), byPaper = new Map(papers.map(p => [p.paperId, p])), duplicatePaperIds = new Set();
        for (const g of audit.duplicates) for (const x of g.items) if (x.paperId) duplicatePaperIds.add(x.paperId);
        for (const [paperId, paper] of byPaper.entries()) {
            const row = paper.row;
            if (!row) continue;
            const badges = [], hasDup = duplicatePaperIds.has(paperId), identity = audit.identityProblems.filter(x => x.paperId === paperId), multis = audit.multi.filter(x => x.paperId === paperId), blanks = audit.blanks.filter(x => x.paperId === paperId), partials = audit.partials.filter(x => x.paperId === paperId), unreviewed = multis.filter(x => !x.reviewed), reviewed = multis.filter(x => x.reviewed);
            if (hasDup || identity.length) { row.classList.add(`${APP}-row-critical`); if (hasDup) badges.push(badge('مكرر','critical')); if (identity.length) badges.push(badge('مشكلة الحساب','critical')); }
            else if (unreviewed.length) row.classList.add(`${APP}-row-multi`);
            else if (blanks.length) row.classList.add(`${APP}-row-blank`);
            else if (partials.length) row.classList.add(`${APP}-row-partial`);
            else if (reviewed.length) row.classList.add(`${APP}-row-reviewed`);
            if (unreviewed.length) badges.push(badge(`تظليل متعدد: ${unreviewed.map(x => `س${x.question}`).join('، ')}`,'multi'));
            if (reviewed.length) badges.push(badge(`تمت مراجعة: ${reviewed.map(x => `س${x.question}`).join('، ')}`,'reviewed'));
            if (blanks.length) badges.push(badge(`فارغ: ${blanks.map(x => `س${x.question}`).join('، ')}`,'blank'));
            if (partials.length) badges.push(badge(`جزئي: ${partials.map(x => `س${x.question}`).join('، ')}`,'partial'));
            if (badges.length) {
                const link = row.querySelector('a[href*="/paper/"][href*="/subject/all/"]');
                if (link) { const wrap = document.createElement('span'); wrap.className = `${APP}-rowbadges`; wrap.innerHTML = badges.join(''); link.insertAdjacentElement('afterend', wrap); }
            }
        }
    }

    function exportXlsx() {
        const audit = hydrate(load(STORE.audit));
        if (!audit) return notify('نفّذ فحص النتائج أولًا.', 'error');
        if (!auditFresh(audit)) return notify('نتيجة الفحص قديمة. أعد الفحص قبل التصدير.', 'error');
        if (!audit.ready) return notify('لا يزال هناك ما يحتاج مراجعة قبل التصدير.', 'error');
        location.href = audit.fullXlsxUrl || findFullXlsx(document);
    }

    function guardNativeXlsx() {
        document.addEventListener('click', event => {
            const a = event.target.closest('a[href]');
            if (!a) return;
            const isFullXlsx = /\/quiz\/full\/all\/.+\.xlsx(?:$|\?)/i.test(a.href || '') || /full format \(with student responses\)\s*-\s*xlsx/i.test(clean(a.textContent));
            if (!isFullXlsx) return;
            const audit = hydrate(load(STORE.audit));
            if (audit?.ready && auditFresh(audit)) return;
            event.preventDefault(); event.stopPropagation();
            document.getElementById(`${APP}-root`)?.scrollIntoView({ behavior:'smooth', block:'start' });
            notify(!audit ? 'نفّذ فحص النتائج قبل تصدير Full XLSX.' : !auditFresh(audit) ? 'أعد الفحص قبل التصدير.' : 'هناك مشاكل تحتاج مراجعة قبل التصدير.', 'error');
        }, true);
    }

    async function fetchPaperListFromQuiz() {
        const response = await fetch(quizUrl(), { credentials:'include', cache:'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
        const list = parsePaperRows(doc).map(p => ({ index:p.index,paperId:p.paperId,paperUrl:p.paperUrl,studentId:p.studentId,name:p.name,points:p.points,percent:p.percent }));
        if (list.length) save(STORE.papers, list);
        return list;
    }

    async function navigationPapers() {
        const cached = load(STORE.papers, []);
        if (cached?.length && cached.some(x => x.paperId === ROUTE.paperId)) return cached;
        return fetchPaperListFromQuiz();
    }

    function issuePaperIds() {
        const audit = hydrate(load(STORE.audit));
        if (!audit) return new Set();
        const set = new Set();
        for (const g of audit.duplicates) for (const x of g.items) if (x.paperId) set.add(x.paperId);
        audit.identityProblems.forEach(x => x.paperId && set.add(x.paperId));
        audit.multi.filter(x => !x.reviewed).forEach(x => x.paperId && set.add(x.paperId));
        return set;
    }

    function nextIssue(papers, currentIndex) {
        const ids = issuePaperIds();
        if (!ids.size) return null;
        for (let step = 1; step <= papers.length; step++) {
            const i = (currentIndex + step) % papers.length;
            if (ids.has(papers[i]?.paperId)) return papers[i];
        }
        return null;
    }

    function findPaperInsertPoint() {
        const edit = [...document.querySelectorAll('a,button')].find(el => /edit responses/i.test(clean(el.textContent)));
        if (edit) {
            const group = edit.closest('.btn-group') || edit.parentElement;
            if (group?.parentElement) return { parent:group.parentElement, before:group };
        }
        const zipText = [...document.querySelectorAll('.portlet-body,.panel-body,.col-md-6,.col-md-5')].find(el => /zipgrade id/i.test(clean(el.textContent)) && /external ref/i.test(clean(el.textContent)));
        if (zipText) return { parent:zipText, before:zipText.firstElementChild };
        return null;
    }

    function currentPaperAudit() {
        const audit = hydrate(load(STORE.audit));
        if (!audit) return null;
        return { multi:audit.multi.filter(x => x.paperId === ROUTE.paperId), blanks:audit.blanks.filter(x => x.paperId === ROUTE.paperId), partials:audit.partials.filter(x => x.paperId === ROUTE.paperId), identity:audit.identityProblems.filter(x => x.paperId === ROUTE.paperId), duplicate:audit.duplicates.some(g => g.items.some(x => x.paperId === ROUTE.paperId)) };
    }

    function renderCurrentPaperProblems(issues) {
        if (!issues) return '<span style="color:#777;font-size:12px">لم يتم العثور على فحص محفوظ لهذا الاختبار. نفّذ الفحص من صفحة الاختبار لعرض مشاكل هذا الطالب هنا.</span>';
        const tags = [];
        if (issues.duplicate) tags.push(badge('ورقة/طالب مكرر','critical'));
        if (issues.identity.length) tags.push(badge('مشكلة CustomID / الحساب','critical'));
        for (const x of issues.multi) tags.push(badge(`${x.reviewed ? 'تمت مراجعة' : 'تظليل متعدد'} س${x.question}: ${x.response}`, x.reviewed ? 'reviewed' : 'multi'));
        if (issues.blanks.length) tags.push(badge(`فارغ: ${issues.blanks.map(x => `س${x.question}`).join('، ')}`,'blank'));
        if (issues.partials.length) tags.push(badge(`جزئي: ${issues.partials.map(x => `س${x.question}`).join('، ')}`,'partial'));
        return tags.length ? tags.join(' ') : `<span class="${APP}-badge ${APP}-reviewed">لا توجد مشكلة مسجلة لهذا الطالب</span>`;
    }

    async function mountPaperNavigation() {
        document.getElementById(`${APP}-paper`)?.remove();
        const point = findPaperInsertPoint();
        if (!point) return false;
        let papers = [];
        try { papers = await navigationPapers(); }
        catch (error) { console.warn('[ZGSSM v0.8.1] navigation list failed', error); }
        const index = papers.findIndex(x => x.paperId === ROUTE.paperId), prev = index > 0 ? papers[index - 1] : null, next = index >= 0 && index < papers.length - 1 ? papers[index + 1] : null, issueNext = index >= 0 ? nextIssue(papers,index) : null, current = index >= 0 ? papers[index] : null, issues = currentPaperAudit();
        const box = document.createElement('div');
        box.id = `${APP}-paper`; box.className = 'well well-sm';
        box.innerHTML = `<div class="${APP}-paper-nav"><a class="btn btn-default btn-sm" href="${prev ? esc(prev.paperUrl) : '#'}" ${prev ? '' : 'onclick="return false;" style="opacity:.45;pointer-events:none"'}>◀ السابق</a><span class="${APP}-paper-pos">${index >= 0 ? `${index + 1} / ${papers.length} — ${esc(current?.name || '')}` : 'تعذر تحديد ترتيب هذه الورقة'}</span><a class="btn btn-default btn-sm" href="${next ? esc(next.paperUrl) : '#'}" ${next ? '' : 'onclick="return false;" style="opacity:.45;pointer-events:none"'}>التالي ▶</a>${issueNext ? `<a class="btn btn-warning btn-sm" href="${esc(issueNext.paperUrl)}">⚠ التالي للمراجعة</a>` : '<span class="btn btn-success btn-sm disabled">✓ لا مراجعات معلقة</span>'}<a class="btn btn-default btn-sm" href="${esc(quizUrl())}">العودة لصفحة الاختبار</a></div><div class="${APP}-paper-problems">${renderCurrentPaperProblems(issues)}</div>`;
        point.parent.insertBefore(box, point.before);
        return true;
    }

    async function robustMountPaperNavigation() {
        for (let i = 0; i < 20; i++) {
            if (await mountPaperNavigation()) return;
            await new Promise(r => setTimeout(r, 350));
        }
        console.warn('[ZGSSM v0.8.1] Could not find insertion point for paper navigation.');
    }

    injectCss();
    if (ROUTE.type === 'quiz-all') {
        createInlineRoot();
        guardNativeXlsx();
        setTimeout(() => { if (!RUNNING) runScan(); }, 700);
    }
    if (ROUTE.type === 'paper-all') robustMountPaperNavigation();
})();

/* Student Manager Delete Extension */
(() => {
    'use strict';
    const PATCH = 'zgssm-delete-ext';
    const MANAGER_APP = 'zgssm';
    const REOPEN_KEY = 'ZGSSM_REOPEN_MANAGER_AFTER_DELETE_V081';
    if (!/^\/students\/?$/i.test(location.pathname)) return;

    const cleanText = value => String(value ?? '').replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g,'').replace(/\s+/g,' ').trim();
    const language = () => { try { const saved = localStorage.getItem('ZGSSM_LANG'); if (saved === 'en' || saved === 'ar') return saved; } catch (_) {} return /^ar\b/i.test(navigator.language || '') ? 'ar' : 'en'; };
    const STRINGS = {
        ar:{deleteStudent:'🗑 حذف الطالب',deleting:'جارٍ حذف الطالب...',confirm:'سيتم حذف الطالب "{name}" من ZipGrade باستخدام أمر الحذف الأصلي في الموقع.\n\nStudent ID: {id}\n\nهذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟',dirtyConfirm:'لديك تعديلات غير محفوظة لهذا الطالب. الحذف سيتجاهل هذه التعديلات ويحذف الطالب نفسه.\n\nهل تريد المتابعة؟',noUrl:'تعذر تحديد رابط صفحة الطالب الأصلية.',noNativeDelete:'لم أتمكن من العثور على أمر الحذف الأصلي في صفحة هذا الطالب. لم يتم تنفيذ أي حذف.',sentButNotVerified:'تم إرسال طلب الحذف، لكن لم أتمكن من التحقق من اختفاء الطالب.',success:'✅ تم حذف الطالب بنجاح. جارٍ تحديث قائمة الطلاب...',failed:'❌ تعذر حذف الطالب:',aboutVersion:'v0.8.1'},
        en:{deleteStudent:'🗑 Delete student',deleting:'Deleting student...',confirm:'This will delete "{name}" from ZipGrade using the site’s native delete action.\n\nStudent ID: {id}\n\nThis cannot be undone. Continue?',dirtyConfirm:'You have unsaved changes for this student. Deleting will discard those edits and delete the student record.\n\nContinue?',noUrl:'Could not determine the original student page URL.',noNativeDelete:'Could not locate ZipGrade’s native delete action on this student page. Nothing was deleted.',sentButNotVerified:'The delete request was sent, but the student could not be verified as removed.',success:'✅ Student deleted successfully. Refreshing the student list...',failed:'❌ Could not delete student:',aboutVersion:'v0.8.1'}
    };
    const t = key => STRINGS[language()]?.[key] ?? STRINGS.en[key] ?? key;
    const format = (template,vars) => Object.entries(vars||{}).reduce((out,[k,v]) => out.replaceAll(`{${k}}`,String(v??'')),String(template));
    const absoluteUrl = (value,base=location.href) => { try { return new URL(value,base).href; } catch (_) { return ''; } };
    const normalizedPath = url => { try { return new URL(url,location.href).pathname.replace(/\/+$/,'').toLowerCase(); } catch (_) { return ''; } };
    const currentEditor = () => document.querySelector(`#${MANAGER_APP}-managerMain .zgm-editor`);

    function currentStudentUrl() {
        const editor = currentEditor();
        if (!editor) return '';
        const originalLink = [...editor.querySelectorAll('a[href]')].find(a => { const label = cleanText(a.textContent).toLowerCase(); return label.includes('فتح صفحة الطالب الأصلية') || label.includes('open original student page'); });
        if (originalLink?.href) return originalLink.href;
        const raw = cleanText(editor.querySelector('.zgm-editor-head .zg-muted')?.textContent || '');
        if (raw && /\/student/i.test(raw)) return absoluteUrl(raw);
        return [...editor.querySelectorAll('a[href]')].find(a => /\/student/i.test(a.getAttribute('href') || ''))?.href || '';
    }

    const currentStudentName = () => cleanText(currentEditor()?.querySelector('.zgm-editor-head h3')?.textContent || '');
    const currentStudentId = () => cleanText(document.getElementById(`${MANAGER_APP}-editId`)?.value || '');
    const hasUnsavedChanges = () => Boolean(cleanText(document.getElementById(`${MANAGER_APP}-dirtyWrap`)?.textContent || ''));

    function statusElement() {
        let el = document.getElementById(`${PATCH}-status`);
        if (el) return el;
        const actions = document.getElementById(`${MANAGER_APP}-saveStudent`)?.closest('.zg-actions');
        if (!actions) return null;
        el = document.createElement('div');
        el.id = `${PATCH}-status`;
        el.style.cssText = 'width:100%;margin-top:8px;font-size:12px;line-height:1.7;color:#475569;';
        actions.insertAdjacentElement('afterend',el);
        return el;
    }

    function setStatus(message,type='info') {
        const el = statusElement();
        if (!el) return;
        el.textContent = message;
        el.style.fontWeight = type === 'error' || type === 'success' ? '700' : '400';
        el.style.color = type === 'error' ? '#991b1b' : type === 'success' ? '#166534' : '#475569';
    }

    function controlLabel(el) { return cleanText([el?.textContent,el?.value,el?.getAttribute?.('aria-label'),el?.getAttribute?.('title')].filter(Boolean).join(' ')); }

    function scoreDeleteControl(control, form=null) {
        const label = controlLabel(control).toLowerCase();
        const action = cleanText(form?.getAttribute('action') || control?.getAttribute?.('href') || control?.getAttribute?.('formaction') || '').toLowerCase();
        let score = 0;
        if (/delete\s+(?:this\s+)?student|remove\s+(?:this\s+)?student|حذف\s+(?:هذا\s+)?الطالب|حذف\s+طالب/i.test(label)) score += 120;
        else if (/\bdelete\b|\bremove\b|حذف/i.test(label)) score += 55;
        if (/delete|remove|destroy/i.test(action)) score += 50;
        if (/student/i.test(action)) score += 20;
        if (/paper|quiz|class|assessment|response|ورقة|اختبار|فصل|إجابة/i.test(label)) score -= 120;
        if (/paper|quiz|response/i.test(action)) score -= 120;
        return score;
    }

    function findNativeDeleteAction(doc,pageUrl) {
        const candidates = [];
        for (const form of doc.querySelectorAll('form')) {
            const controls = [...form.querySelectorAll('button,input[type="submit"],input[type="button"],a[href]')];
            for (const control of controls) {
                const score = scoreDeleteControl(control,form);
                if (score >= 50) candidates.push({ kind:control.tagName === 'A' ? 'link' : 'form',score,control,form,pageUrl });
            }
        }
        for (const link of doc.querySelectorAll('a[href]')) {
            if (link.closest('form')) continue;
            const score = scoreDeleteControl(link,null);
            if (score >= 70) candidates.push({ kind:'link',score,control:link,form:null,pageUrl });
        }
        candidates.sort((a,b) => b.score - a.score);
        return candidates[0] || null;
    }

    function formParams(form,submitter) {
        const params = new URLSearchParams();
        for (const control of form.querySelectorAll('input,select,textarea')) {
            if (!control.name || control.disabled) continue;
            const tag = control.tagName.toLowerCase(), type = (control.type || '').toLowerCase();
            if (type === 'file' || ((type === 'checkbox' || type === 'radio') && !control.checked) || (['submit','button','reset','image'].includes(type) && control !== submitter)) continue;
            if (tag === 'select' && control.multiple) { [...control.selectedOptions].forEach(option => params.append(control.name,option.value)); continue; }
            params.append(control.name,control.value ?? '');
        }
        if (submitter?.name && !params.has(submitter.name)) params.append(submitter.name,submitter.value ?? '');
        return params;
    }

    async function executeNativeDelete(action) {
        if (action.kind === 'link') {
            const target = absoluteUrl(action.control?.getAttribute('href'),action.pageUrl);
            if (!target) throw new Error(t('noNativeDelete'));
            const response = await fetch(target,{credentials:'include',cache:'no-store',redirect:'follow'});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        }
        const form = action.form;
        if (!form) throw new Error(t('noNativeDelete'));
        const method = (form.getAttribute('method') || 'GET').toUpperCase();
        const actionUrl = absoluteUrl(action.control?.getAttribute('formaction') || form.getAttribute('action') || action.pageUrl,action.pageUrl);
        const params = formParams(form,action.control);
        if (method === 'GET') {
            const url = new URL(actionUrl);
            for (const [key,value] of params.entries()) url.searchParams.append(key,value);
            const response = await fetch(url.href,{credentials:'include',cache:'no-store',redirect:'follow'});
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        }
        const response = await fetch(actionUrl,{method,credentials:'include',cache:'no-store',redirect:'follow',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:params.toString()});
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    }

    async function verifyDeleted(studentUrl,studentId) {
        const response = await fetch(`${location.origin}/students/`,{credentials:'include',cache:'no-store',redirect:'follow'});
        if (!response.ok) return false;
        const doc = new DOMParser().parseFromString(await response.text(),'text/html');
        const targetPath = normalizedPath(studentUrl);
        const stillLinked = [...doc.querySelectorAll('a[href]')].some(a => normalizedPath(absoluteUrl(a.getAttribute('href'),response.url)) === targetPath);
        if (stillLinked) return false;
        if (studentId) {
            const stillById = [...doc.querySelectorAll('tr')].some(row => cleanText(row.textContent).includes(studentId) && row.querySelector('a[href*="student"],a[href*="Student"]'));
            if (stillById) return false;
        }
        return true;
    }

    async function deleteCurrentStudent(button) {
        const studentUrl = currentStudentUrl(), name = currentStudentName() || currentStudentId() || '—', id = currentStudentId() || '—';
        if (!studentUrl) return setStatus(t('noUrl'),'error');
        if (hasUnsavedChanges() && !confirm(t('dirtyConfirm'))) return;
        if (!confirm(format(t('confirm'),{name,id}))) return;
        const oldText = button.textContent;
        button.disabled = true; button.textContent = t('deleting'); setStatus(t('deleting'));
        try {
            const pageResponse = await fetch(studentUrl,{credentials:'include',cache:'no-store',redirect:'follow'});
            if (!pageResponse.ok) throw new Error(`HTTP ${pageResponse.status}`);
            const doc = new DOMParser().parseFromString(await pageResponse.text(),'text/html');
            const nativeAction = findNativeDeleteAction(doc,pageResponse.url || studentUrl);
            if (!nativeAction) throw new Error(t('noNativeDelete'));
            await executeNativeDelete(nativeAction);
            if (!(await verifyDeleted(studentUrl,id))) throw new Error(t('sentButNotVerified'));
            setStatus(t('success'),'success');
            try { sessionStorage.setItem(REOPEN_KEY,'1'); } catch (_) {}
            setTimeout(() => location.reload(),650);
        } catch (error) {
            console.error('[ZGSSM Delete Extension]',error);
            setStatus(`${t('failed')} ${cleanText(error?.message || error)}`,'error');
            button.disabled = false; button.textContent = oldText;
        }
    }

    function patchVisibleVersion() {
        const about = document.getElementById(`${MANAGER_APP}-about`);
        if (about) for (const el of about.querySelectorAll('div,span,strong')) if (cleanText(el.textContent) === 'v0.7.0') el.textContent = t('aboutVersion');
    }

    function injectDeleteButton() {
        patchVisibleVersion();
        const saveButton = document.getElementById(`${MANAGER_APP}-saveStudent`), editor = currentEditor();
        if (!saveButton || !editor) return;
        let deleteButton = document.getElementById(`${PATCH}-button`);
        if (!deleteButton) {
            deleteButton = document.createElement('button');
            deleteButton.id = `${PATCH}-button`; deleteButton.type = 'button'; deleteButton.className = 'zg-btn zg-danger'; deleteButton.textContent = t('deleteStudent');
            deleteButton.addEventListener('click',() => deleteCurrentStudent(deleteButton));
            saveButton.insertAdjacentElement('afterend',deleteButton);
        } else deleteButton.textContent = t('deleteStudent');
    }

    const observer = new MutationObserver(() => { injectDeleteButton(); patchVisibleVersion(); });
    observer.observe(document.documentElement,{childList:true,subtree:true});
    injectDeleteButton();

    let shouldReopen = false;
    try { shouldReopen = sessionStorage.getItem(REOPEN_KEY) === '1'; if (shouldReopen) sessionStorage.removeItem(REOPEN_KEY); } catch (_) {}
    if (shouldReopen) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;
            const launch = document.getElementById(`${MANAGER_APP}-managerLaunch`);
            if (launch) { clearInterval(timer); launch.click(); return; }
            if (attempts >= 40) clearInterval(timer);
        },250);
    }
})();
