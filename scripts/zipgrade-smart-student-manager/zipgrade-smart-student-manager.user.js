// ==UserScript==
// @name         ZipGrade Smart Student Manager
// @name:en      ZipGrade Smart Student Manager
// @name:ar      مدير طلاب ZipGrade الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.9.3
// @description  Smart ZipGrade student import/management with quiz auditing, included-class scope, outside-class/no-response detection, plus instant student search, class/status filters, and result sorting.
// @description:en Smart ZipGrade student import/management with quiz auditing, included-class scope, outside-class/no-response detection, plus instant student search, class/status filters, and result sorting.
// @description:ar استيراد وإدارة طلاب ZipGrade بذكاء، مع مدقق اختبار شامل للفصول والحالات، وبحث فوري عن الطالب، وتصفية حسب الفصل والحالة، وفرز نتائج الطلاب داخل الصفحة.
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
 ZipGrade Smart Student Manager v0.9.3 — Final Release

 إصلاح v0.9.3: إعادة تخطيط شريط البحث والتصفية ليبقى داخل حاوية جدول النتائج بدون تداخل مع أعمدة الصفحة المجاورة.

 إضافة v0.9.3: بحث فوري عن الطالب، تصفية حسب الفصل والحالة، وفرز جدول النتائج مع عدادات لحظية دون تغيير ملف التصدير.

 إصلاح v0.9.3: دعم روابط أوراق فلاتر الفصول /subject/<class-id>/ ومنع تلوث اسم الطالب بشارات التدقيق.

 الإصدار النهائي لهذه المرحلة يجمع في سكربت Tampermonkey واحد:
 1) الاستيراد الذكي وإدارة الطلاب.
 2) حذف الطالب من داخل مدير الطلاب مع تأكيد وتحقق بعد الحذف.
 3) مدقق الاختبار المعتمد على Full Format CSV.
 4) كشف التكرار ومشاكل CustomID والتظليل المتعدد والإجابات الفارغة والدرجات الجزئية.
 5) تمييز صفوف الطلاب والتنقل بين أوراق الاختبار.
 6) فحص الفصول المشمولة واكتشاف أي استجابة من خارجها.
 7) قراءة قائمة الطلاب مرة واحدة في كل فحص وإظهار طلاب الفصول المشمولة بلا استجابة.
 8) حماية تصدير Full XLSX حتى اكتمال المراجعات المانعة.

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
=========================================================================
*/

/*
=========================================================================
 ZipGrade Smart Student Manager - Quiz Auditor Module v0.9.3

 بنية مدقق الاختبار:
 - لم نعد نجلب صفحة كل طالب في الخلفية كي نحللها.
 - التحليل الكامل يعتمد على Full Format CSV الرسمي من ZipGrade.
 - Full CSV يحتوي StudentID / CustomID وإجابة كل سؤال ودرجته وحالته.
 - نطابق StudentID مع صف الطالب في #gradedPapers، وبالتالي نعرف الطالب
   صاحب كل تظليل متعدد أو إجابة فارغة أو درجة جزئية بدقة.
 - Item Analysis لا يتم تلوينه ولا يُستخدم لتحديد اسم الطالب.
 - كل التلوين يكون على صفوف الطلاب في جدول gradedPapers.
 - صفحة الطالب تحتوي فقط على شريط تنقل مدمج + ملخص مشاكله الحالية.
 - فحص نطاق الفصول يعتمد على روابط Filter for الموجودة في صفحة الاختبار.
 - قائمة /students/ تُقرأ مرة واحدة فقط في كل فحص لمعرفة الطلاب بلا استجابة.

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
=========================================================================
*/

(() => {
    'use strict';

    const APP = 'zgssm-audit3';
    const VERSION = '0.9.3';
    const FRESH_MS = 30 * 60 * 1000;

    const ROUTE = parseRoute();
    if (!ROUTE.quizId || !['quiz-all', 'paper-all'].includes(ROUTE.type)) return;

    const STORE = {
        audit: `ZGSSM_AUDIT_V3_${ROUTE.quizId}`,
        reviews: `ZGSSM_AUDIT_REVIEWS_V3_${ROUTE.quizId}`,
        papers: `ZGSSM_AUDIT_PAPERS_V3_${ROUTE.quizId}`,
        coverage: `ZGSSM_CLASS_COVERAGE_V093_${ROUTE.quizId}`,
        coverageReviews: `ZGSSM_CLASS_COVERAGE_REVIEWS_V093_${ROUTE.quizId}`
    };

    let RUNNING = false;

    // Result-table view controls (display only; never alter exported data).
    const RESULT_VIEW = {
        search: '',
        classKey: 'all',
        status: 'all',
        sort: 'original',
        direction: 'asc'
    };

    const ORIGINAL_ROW_INDEX = new WeakMap();
    let ORIGINAL_ROW_SEQUENCE = 0;

    // ---------------------------------------------------------------------
    // Helpers
    // ---------------------------------------------------------------------

    function parseRoute(pathname = location.pathname) {
        const paper = pathname.match(
            /^\/quiz\/([^/]+)\/paper\/([^/]+)\/subject\/all\/?/i
        );
        if (paper) {
            return {
                type: 'paper-all',
                quizId: decodeURIComponent(paper[1]),
                paperId: decodeURIComponent(paper[2])
            };
        }

        const all = pathname.match(/^\/quiz\/([^/]+)\/all\/?/i);
        if (all) {
            return {
                type: 'quiz-all',
                quizId: decodeURIComponent(all[1]),
                paperId: ''
            };
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
        return clean(v)
            .normalize('NFKC')
            .toLowerCase()
            .replace(/\s+/g, '');
    }

    function esc(v) {
        return String(v ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function num(v, fallback = 0) {
        const n = Number(
            String(v ?? '')
                .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
                .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
                .replace(',', '.')
                .replace(/[^0-9.+-]/g, '')
        );
        return Number.isFinite(n) ? n : fallback;
    }

    function abs(href) {
        try {
            return new URL(href, location.href).href;
        } catch (_) {
            return '';
        }
    }

    function paperIdFromUrl(url) {
        try {
            const m = new URL(url, location.href).pathname.match(
                /\/paper\/([^/]+)\/subject\/[^/]+\/?/i
            );
            return m ? decodeURIComponent(m[1]) : '';
        } catch (_) {
            return '';
        }
    }

    function quizUrl() {
        return `${location.origin}/quiz/${encodeURIComponent(ROUTE.quizId)}/all/`;
    }

    function load(key, fallback = null) {
        try {
            const v = JSON.parse(localStorage.getItem(key) || 'null');
            return v == null ? fallback : v;
        } catch (_) {
            return fallback;
        }
    }

    function save(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }

    function remove(key) {
        localStorage.removeItem(key);
    }

    function uniq(arr) {
        return [...new Set(arr)];
    }

    function isEmailish(v) {
        const s = canon(v);
        return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
    }

    function normHeader(v) {
        return clean(v)
            .replace(/^\uFEFF/, '')
            .toLowerCase()
            .replace(/[\s_.-]+/g, '');
    }

    function auditFresh(audit) {
        return Boolean(audit?.createdAt && Date.now() - audit.createdAt <= FRESH_MS);
    }

    function auditAge(audit) {
        if (!audit?.createdAt) return '';
        const m = Math.max(0, Math.round((Date.now() - audit.createdAt) / 60000));
        if (m < 1) return 'الآن';
        if (m < 60) return `منذ ${m} دقيقة`;
        return `منذ ${Math.round(m / 60)} ساعة`;
    }

    function notify(message, type = 'info') {
        const host = document.getElementById(`${APP}-root`)
            || document.getElementById(`${APP}-paper`)
            || document.querySelector('.page-content .container')
            || document.body;

        host.querySelector?.(`#${APP}-notice`)?.remove();

        const box = document.createElement('div');
        box.id = `${APP}-notice`;
        box.className = `alert ${
            type === 'error'
                ? 'alert-danger'
                : type === 'success'
                    ? 'alert-success'
                    : 'alert-info'
        }`;
        box.style.cssText = 'direction:rtl;text-align:right;margin:10px 0;';
        box.textContent = message;

        host.prepend(box);
        setTimeout(() => box.remove(), 4500);
    }

    // ---------------------------------------------------------------------
    // CSS
    // ---------------------------------------------------------------------

    function injectCss() {
        if (document.getElementById(`${APP}-css`)) return;

        const style = document.createElement('style');
        style.id = `${APP}-css`;
        style.textContent = `
            #${APP}-root, #${APP}-paper {
                direction: rtl;
                text-align: right;
                font-family: Tahoma, Arial, sans-serif;
            }

            .${APP}-toolbar {
                display:flex;
                flex-wrap:wrap;
                gap:7px;
                align-items:center;
            }

            .${APP}-summary {
                display:flex;
                flex-wrap:wrap;
                gap:7px;
                margin:10px 0;
            }

            .${APP}-chip {
                display:inline-flex;
                gap:5px;
                align-items:center;
                border:1px solid #ddd;
                background:#fff;
                border-radius:999px;
                padding:5px 10px;
                font-size:12px;
            }

            .${APP}-chip strong { font-size:14px; }

            .${APP}-legend {
                display:flex;
                flex-wrap:wrap;
                gap:6px;
                margin:10px 0 14px;
            }

            .${APP}-badge {
                display:inline-block;
                border-radius:999px;
                padding:3px 8px;
                font-size:11px;
                font-weight:700;
                line-height:1.35;
                white-space:nowrap;
            }

            .${APP}-critical { background:#f2dede; color:#a94442; }
            .${APP}-outside  { background:#f8d7da; color:#842029; }
            .${APP}-multi    { background:#fcf8e3; color:#8a6d3b; }
            .${APP}-blank    { background:#fff4cc; color:#7a5a00; }
            .${APP}-partial  { background:#d9edf7; color:#31708f; }
            .${APP}-reviewed { background:#dff0d8; color:#3c763d; }
            .${APP}-absence  { background:#eef2f7; color:#475569; }

            #gradedPapers tr.${APP}-row-outside > td  { background:#f8d7da !important; }
            #gradedPapers tr.${APP}-row-critical > td { background:#fbe6e5 !important; }
            #gradedPapers tr.${APP}-row-multi > td    { background:#fff0d0 !important; }
            #gradedPapers tr.${APP}-row-blank > td    { background:#fff9df !important; }
            #gradedPapers tr.${APP}-row-partial > td  { background:#e7f5fb !important; }
            #gradedPapers tr.${APP}-row-reviewed > td { background:#edf8ed !important; }

            #gradedPapers tr.${APP}-row-outside > td:first-child  { box-shadow:inset 5px 0 0 #b02a37; }
            #gradedPapers tr.${APP}-row-critical > td:first-child { box-shadow:inset 4px 0 0 #d9534f; }
            #gradedPapers tr.${APP}-row-multi > td:first-child    { box-shadow:inset 4px 0 0 #f0ad4e; }
            #gradedPapers tr.${APP}-row-blank > td:first-child    { box-shadow:inset 4px 0 0 #d6b932; }
            #gradedPapers tr.${APP}-row-partial > td:first-child  { box-shadow:inset 4px 0 0 #5bc0de; }
            #gradedPapers tr.${APP}-row-reviewed > td:first-child { box-shadow:inset 4px 0 0 #5cb85c; }

            .${APP}-rowbadges {
                display:inline-flex;
                flex-wrap:wrap;
                gap:4px;
                margin-right:6px;
                vertical-align:middle;
            }

            .${APP}-status {
                margin:10px 0;
                padding:10px 12px;
                border-radius:4px;
                font-weight:700;
            }

            .${APP}-status-ok {
                background:#dff0d8;
                border:1px solid #d6e9c6;
                color:#3c763d;
            }

            .${APP}-status-warn {
                background:#fcf8e3;
                border:1px solid #faebcc;
                color:#8a6d3b;
            }

            .${APP}-progress { display:none; margin-top:10px; }
            .${APP}-progress[data-show="1"] { display:block; }
            .${APP}-progress .progress { height:12px; margin:6px 0 0; }

            .${APP}-issues td,
            .${APP}-issues th {
                text-align:right !important;
                vertical-align:middle !important;
            }

            .${APP}-paper-nav {
                display:flex;
                flex-wrap:wrap;
                gap:6px;
                align-items:center;
                margin:8px 0 12px;
            }

            .${APP}-paper-pos {
                border:1px solid #ddd;
                background:#fff;
                border-radius:4px;
                padding:6px 10px;
                font-weight:700;
            }

            .${APP}-paper-problems {
                margin:8px 0 0;
            }

            .${APP}-coverage-note {
                font-size:12px;
                color:#64748b;
                line-height:1.7;
            }

            .${APP}-absence-table td,
            .${APP}-absence-table th {
                white-space:nowrap;
            }

            #${APP}-result-tools {
                direction:rtl;
                text-align:right;
                margin:10px 0 12px;
                padding:10px 12px;
                border:1px solid #d9e2ec;
                border-radius:6px;
                background:#f8fafc;
                font-family:Tahoma,Arial,sans-serif;
            }

            .${APP}-result-tools-grid {
                display:grid;
                grid-template-columns:repeat(3,minmax(0,1fr));
                gap:7px;
                align-items:stretch;
                width:100%;
                max-width:100%;
                min-width:0;
                box-sizing:border-box;
            }

            .${APP}-result-tools-grid > * {
                min-width:0;
                max-width:100%;
                box-sizing:border-box;
            }

            .${APP}-result-tools-grid input,
            .${APP}-result-tools-grid select,
            .${APP}-result-tools-grid button {
                width:100%;
                min-width:0;
                max-width:100%;
                min-height:34px;
                box-sizing:border-box;
            }

            .${APP}-result-tools-grid input,
            .${APP}-result-tools-grid select {
                border:1px solid #cbd5e1;
                border-radius:4px;
                background:#fff;
                padding:6px 8px;
            }

            #${APP}-result-tools {
                width:100%;
                max-width:100%;
                min-width:0;
                overflow:hidden;
                box-sizing:border-box;
            }

            .${APP}-result-tools-count {
                margin-top:7px;
                font-size:12px;
                font-weight:700;
                color:#475569;
                overflow-wrap:anywhere;
            }

            .${APP}-result-tools-note {
                margin-top:4px;
                font-size:11px;
                color:#64748b;
                line-height:1.6;
                overflow-wrap:anywhere;
            }

            @media (max-width: 760px) {
                .${APP}-result-tools-grid {
                    grid-template-columns:repeat(2,minmax(0,1fr));
                }
            }

            @media (max-width: 480px) {
                .${APP}-result-tools-grid {
                    grid-template-columns:minmax(0,1fr);
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ---------------------------------------------------------------------
    // CSV parser
    // ---------------------------------------------------------------------

    function parseCSV(text) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;

        for (let i = 0; i < text.length; i++) {
            const ch = text[i];

            if (quoted) {
                if (ch === '"') {
                    if (text[i + 1] === '"') {
                        field += '"';
                        i++;
                    } else {
                        quoted = false;
                    }
                } else {
                    field += ch;
                }
                continue;
            }

            if (ch === '"') {
                quoted = true;
            } else if (ch === ',') {
                row.push(field);
                field = '';
            } else if (ch === '\n') {
                row.push(field.replace(/\r$/, ''));
                rows.push(row);
                row = [];
                field = '';
            } else {
                field += ch;
            }
        }

        if (field.length || row.length) {
            row.push(field.replace(/\r$/, ''));
            rows.push(row);
        }

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
                headers.forEach((h, i) => {
                    obj[h] = values[i] ?? '';
                });
                return obj;
            })
        };
    }

    function questionNumbers(headers) {
        return headers
            .map(h => {
                const m = h.match(/^stu(\d+)$/);
                return m ? Number(m[1]) : 0;
            })
            .filter(Boolean)
            .sort((a, b) => a - b);
    }

    // ---------------------------------------------------------------------
    // Main quiz table
    // ---------------------------------------------------------------------

    function gradedTable(doc = document) {
        return doc.querySelector('table#gradedPapers');
    }

    function headerInfo(table) {
        const candidates = [...table.querySelectorAll('tr')];
        const headerRow = candidates.find(row => {
            const t = clean(row.textContent).toLowerCase();
            return t.includes('name') && t.includes('id') && t.includes('pts');
        });

        if (!headerRow) return { row: null, headers: [] };

        return {
            row: headerRow,
            headers: [...headerRow.querySelectorAll('th,td')].map(c => clean(c.textContent).toLowerCase())
        };
    }

    function findIndex(headers, words) {
        return headers.findIndex(h => words.some(w => h === w || h.includes(w)));
    }

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

            const link = row.querySelector('a[href*="/paper/"][href*="/subject/"]');
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
                name: clean(link.textContent).replace(/^[,،\s]+/, '') || (nameI >= 0 ? clean(cells[nameI]).replace(/^[,،\s]+/, '') : ''),
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
        const a = [...doc.querySelectorAll('a[href]')].find(link =>
            /full format \(with student responses\)\s*-\s*csv/i.test(clean(link.textContent)) ||
            /\/quiz\/full\/all\/.+\.csv(?:$|\?)/i.test(link.href || '')
        );

        return a ? abs(a.getAttribute('href')) :
            `${location.origin}/quiz/full/all/${ROUTE.quizId}.CSV`;
    }

    function findFullXlsx(doc = document) {
        const a = [...doc.querySelectorAll('a[href]')].find(link =>
            /full format \(with student responses\)\s*-\s*xlsx/i.test(clean(link.textContent)) ||
            /\/quiz\/full\/all\/.+\.xlsx(?:$|\?)/i.test(link.href || '')
        );

        return a ? abs(a.getAttribute('href')) :
            `${location.origin}/quiz/full/all/${ROUTE.quizId}.XLSX`;
    }

    // ---------------------------------------------------------------------
    // Issue detection from Full CSV
    // ---------------------------------------------------------------------

    function isBlankResponse(v) {
        const s = clean(v);
        return !s || s === '_';
    }

    function isMultiResponse(v) {
        const raw = clean(v).replace(/\s+/g, '');
        if (!raw) return false;

        const single = new Set([
            'ص', 'خ',
            'أ', 'ا', 'ب', 'ج', 'د', 'هـ', 'ه',
            'A', 'B', 'C', 'D', 'E', 'F',
            'a', 'b', 'c', 'd', 'e', 'f',
            '0', '1', '½', '0.5', '.5', '0,5'
        ]);

        if (single.has(raw)) return false;

        const normalized = raw
            .replace(/[،,;/|+\-]/g, '')
            .replace(/ا/g, 'أ')
            .replace(/هـ/g, 'ه');

        const choices = [];
        for (const ch of normalized) {
            if (/[أبجدهصخA-Fa-f]/.test(ch)) {
                choices.push(ch.toUpperCase());
            }
        }

        return new Set(choices).size >= 2;
    }

    function getReviews() {
        return load(STORE.reviews, {});
    }

    function reviewKey(issue) {
        return [
            issue.paperId || issue.studentId,
            issue.question,
            canon(issue.response),
            canon(issue.primary)
        ].join('|');
    }

    function setReviewed(issue, yes) {
        const all = getReviews();
        const key = reviewKey(issue);

        if (yes) {
            all[key] = {
                at: Date.now(),
                paperId: issue.paperId,
                studentId: issue.studentId,
                question: issue.question,
                response: issue.response,
                primary: issue.primary
            };
        } else {
            delete all[key];
        }

        save(STORE.reviews, all);
    }

    function hydrate(audit) {
        if (!audit) return null;

        const reviews = getReviews();
        const multi = (audit.multi || []).map(x => ({
            ...x,
            reviewed: Boolean(reviews[reviewKey(x)])
        }));

        const unresolvedMulti = multi.filter(x => !x.reviewed).length;

        const blockers =
            (audit.duplicates?.length || 0) +
            (audit.identityProblems?.length || 0) +
            (audit.unmappedRecords?.length || 0);

        return {
            ...audit,
            multi,
            unresolvedMulti,
            blockers,
            ready: blockers === 0 && unresolvedMulti === 0
        };
    }

    function assignPapersToRecords(records, papers) {
        const byId = new Map();
        const byName = new Map();

        for (const paper of papers) {
            const idKey = canon(paper.studentId);
            const nameKey = canon(paper.name);

            if (idKey) {
                if (!byId.has(idKey)) byId.set(idKey, []);
                byId.get(idKey).push(paper);
            }

            if (nameKey) {
                if (!byName.has(nameKey)) byName.set(nameKey, []);
                byName.get(nameKey).push(paper);
            }
        }

        const idCursor = new Map();
        const nameCursor = new Map();

        return records.map(record => {
            let paper = null;
            const idKey = canon(record.studentId);

            if (idKey && byId.has(idKey)) {
                const list = byId.get(idKey);
                const pos = idCursor.get(idKey) || 0;
                paper = list[Math.min(pos, list.length - 1)] || null;
                idCursor.set(idKey, pos + 1);
            }

            if (!paper) {
                const nameKey = canon(record.name);
                if (nameKey && byName.has(nameKey)) {
                    const list = byName.get(nameKey);
                    const pos = nameCursor.get(nameKey) || 0;
                    paper = list[Math.min(pos, list.length - 1)] || null;
                    nameCursor.set(nameKey, pos + 1);
                }
            }

            return {
                ...record,
                paperId: paper?.paperId || '',
                paperUrl: paper?.paperUrl || ''
            };
        });
    }

    function duplicateGroups(records) {
        const raw = [];

        for (const basis of [
            { label: 'CustomID / الحساب', getter: r => r.externalRef },
            { label: 'StudentID', getter: r => r.studentId }
        ]) {
            const map = new Map();

            records.forEach((r, index) => {
                const key = canon(basis.getter(r));
                if (!key) return;
                if (!map.has(key)) map.set(key, []);
                map.get(key).push({ ...r, recordIndex: index });
            });

            for (const [key, items] of map.entries()) {
                if (items.length > 1) {
                    raw.push({
                        key,
                        basis: basis.label,
                        value: basis.getter(items[0]),
                        items
                    });
                }
            }
        }

        // Merge groups that describe the same underlying rows.
        const merged = new Map();

        for (const g of raw) {
            const signature = g.items.map(x => x.recordIndex).sort((a,b) => a-b).join('|');

            if (!merged.has(signature)) {
                merged.set(signature, {
                    bases: [g.basis],
                    value: g.value,
                    items: g.items
                });
            } else {
                const current = merged.get(signature);
                if (!current.bases.includes(g.basis)) current.bases.push(g.basis);
            }
        }

        return [...merged.values()];
    }

    async function fetchFullCsv() {
        const url = findFullCsv(document);
        const response = await fetch(url, {
            credentials: 'include',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`تعذر قراءة Full CSV (HTTP ${response.status})`);
        }

        return {
            url,
            text: await response.text()
        };
    }

    async function buildAudit() {
        const papers = parsePaperRows(document);
        if (!papers.length) throw new Error('لم يتم العثور على صفوف الطلاب في gradedPapers.');

        const csv = await fetchFullCsv();
        const parsed = csvToObjects(csv.text);
        const qNumbers = questionNumbers(parsed.headers);

        if (!qNumbers.length) {
            throw new Error('Full CSV لا يحتوي أعمدة Stu1 / Stu2 ...');
        }

        const rawRecords = parsed.objects.map((row, rowIndex) => {
            const first = clean(row.firstname);
            const last = clean(row.lastname);
            const name = clean(`${first} ${last}`) || clean(row.name);

            return {
                sourceRow: rowIndex + 2,
                studentId: clean(row.studentid || row.zipgradeid),
                externalRef: clean(row.customid || row.externalid),
                name,
                earnedPoints: clean(row.earnedpoints),
                possiblePoints: clean(row.possiblepoints),
                percent: clean(row.percentcorrect),
                keyVersion: clean(row.keyversion),
                row
            };
        });

        const records = assignPapersToRecords(rawRecords, papers);

        const multi = [];
        const blanks = [];
        const partials = [];
        const identityProblems = [];
        const unmappedRecords = [];

        for (const record of records) {
            if (!record.externalRef || !isEmailish(record.externalRef)) {
                identityProblems.push({
                    studentId: record.studentId,
                    externalRef: record.externalRef,
                    name: record.name,
                    paperId: record.paperId,
                    paperUrl: record.paperUrl,
                    type: !record.externalRef ? 'missing' : 'invalid'
                });
            }

            if (!record.paperId) {
                unmappedRecords.push({
                    studentId: record.studentId,
                    externalRef: record.externalRef,
                    name: record.name,
                    sourceRow: record.sourceRow
                });
            }

            for (const q of qNumbers) {
                const response = clean(record.row[`stu${q}`]);
                const primary = clean(record.row[`prikey${q}`]);
                const pointsRaw = clean(record.row[`points${q}`]);
                const mark = clean(record.row[`mark${q}`]).toUpperCase();

                const issueBase = {
                    studentId: record.studentId,
                    externalRef: record.externalRef,
                    name: record.name,
                    paperId: record.paperId,
                    paperUrl: record.paperUrl,
                    question: q,
                    response,
                    primary,
                    points: pointsRaw,
                    mark
                };

                if (isMultiResponse(response)) {
                    multi.push(issueBase);
                    continue;
                }

                if (isBlankResponse(response)) {
                    blanks.push(issueBase);
                    continue;
                }

                if (mark === 'P') {
                    partials.push(issueBase);
                }
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
            papers: papers.map(p => ({
                index: p.index,
                paperId: p.paperId,
                paperUrl: p.paperUrl,
                studentId: p.studentId,
                name: p.name,
                points: p.points,
                percent: p.percent,
                keyVersion: p.keyVersion,
                scannedAt: p.scannedAt
            })),
            records: records.map(r => ({
                studentId: r.studentId,
                externalRef: r.externalRef,
                name: r.name,
                paperId: r.paperId,
                paperUrl: r.paperUrl,
                earnedPoints: r.earnedPoints,
                possiblePoints: r.possiblePoints,