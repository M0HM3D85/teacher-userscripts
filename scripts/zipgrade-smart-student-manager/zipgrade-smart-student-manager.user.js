// ==UserScript==
// @name         ZipGrade Smart Student Manager
// @name:en      ZipGrade Smart Student Manager
// @name:ar      مدير طلاب ZipGrade الذكي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.9.5
// @description  Smart ZipGrade student import/management with quiz auditing, robust multiple-mark detection including numeric grading choices, included-class scope, search, filters, and sorting.
// @description:en Smart ZipGrade student import/management with quiz auditing, robust multiple-mark detection including numeric grading choices, included-class scope, search, filters, and sorting.
// @description:ar استيراد وإدارة طلاب ZipGrade بذكاء، مع مدقق اختبار يكشف التظليل المتعدد حتى في أسئلة الدرجات 0 / نصف / 1، وفحص الفصول والحالات والبحث والتصفية والفرز.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
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
 ZipGrade Smart Student Manager v0.9.5 — Final Release

 إصلاح v0.9.5: كشف التظليل المتعدد في أسئلة التقدير الرقمي/المقالي التي تستخدم خيارات 0 / نصف / 1، مع إبقاء 0.5 و0,5 و½ و1/2 كإجابة نصف واحدة وعدم اعتبار الفاصلة العشرية اختيارين.

 إضافة v0.9.4: قفل التنقل داخل فصل محدد في صفحة ورقة الطالب، مع السابق/التالي والتالي للمراجعة داخل الفصل فقط، حفظ الاختيار، والتنقل بلوحة المفاتيح Alt+← / Alt+→.

 إصلاح v0.9.4: إعادة تخطيط شريط البحث والتصفية ليبقى داخل حاوية جدول النتائج بدون تداخل مع أعمدة الصفحة المجاورة.

 إضافة v0.9.4: بحث فوري عن الطالب، تصفية حسب الفصل والحالة، وفرز جدول النتائج مع عدادات لحظية دون تغيير ملف التصدير.

 إصلاح v0.9.4: دعم روابط أوراق فلاتر الفصول /subject/<class-id>/ ومنع تلوث اسم الطالب بشارات التدقيق.

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
 ZipGrade Smart Student Manager - Quiz Auditor Module v0.9.5

 بنية مدقق الاختبار:
 - لم نعد نجلب صفحة كل طالب في الخلفية كي نحللها.
 - التحليل الكامل يعتمد على Full Format CSV الرسمي من ZipGrade.
 - Full CSV يحتوي StudentID / CustomID وإجابة كل سؤال ودرجته وحالته.
 - نطابق StudentID مع صف الطالب في #gradedPapers، وبالتالي نعرف الطالب
   صاحب كل تظليل متعدد أو إجابة فارغة أو درجة جزئية بدقة.
 - Item Analysis لا يتم تلوينه ولا يُستخدم لتحديد اسم الطالب.
 - كل التلوين يكون على صفوف الطلاب في جدول gradedPapers.
 - صفحة الطالب تحتوي فقط على شريط تنقل مدمج + ملخص مشاكله الحالية.
 - يمكن قفل التنقل على فصل محدد؛ عندها السابق/التالي/التالي للمراجعة تبقى داخل الفصل فقط.
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
    const VERSION = '0.9.5';
    const FRESH_MS = 30 * 60 * 1000;

    const ROUTE = parseRoute();
    if (!ROUTE.quizId || !['quiz-all', 'paper-all'].includes(ROUTE.type)) return;

    const STORE = {
        audit: `ZGSSM_AUDIT_V3_${ROUTE.quizId}`,
        reviews: `ZGSSM_AUDIT_REVIEWS_V3_${ROUTE.quizId}`,
        papers: `ZGSSM_AUDIT_PAPERS_V3_${ROUTE.quizId}`,
        coverage: `ZGSSM_CLASS_COVERAGE_V094_${ROUTE.quizId}`,
        coverageReviews: `ZGSSM_CLASS_COVERAGE_REVIEWS_V094_${ROUTE.quizId}`,
        navClass: `ZGSSM_NAV_CLASS_V094_${ROUTE.quizId}`,
        navScope: `ZGSSM_NAV_SCOPE_V094_${ROUTE.quizId}`
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

            .${APP}-paper-scope {
                display:flex;
                flex-wrap:wrap;
                gap:6px;
                align-items:center;
                margin:0 0 8px;
                padding:8px;
                border:1px solid #d9e2ec;
                border-radius:5px;
                background:#f8fafc;
            }

            .${APP}-paper-scope label {
                margin:0;
                font-size:12px;
                font-weight:700;
            }

            .${APP}-paper-scope select {
                min-width:190px;
                max-width:100%;
                height:32px;
                padding:4px 7px;
                border:1px solid #cbd5e1;
                border-radius:4px;
                background:#fff;
            }

            .${APP}-paper-lock {
                display:inline-flex;
                align-items:center;
                gap:4px;
                padding:4px 8px;
                border-radius:999px;
                background:#e8f2ff;
                color:#24527a;
                font-size:11px;
                font-weight:700;
            }

            .${APP}-paper-scope-note {
                font-size:11px;
                color:#64748b;
            }

            .${APP}-paper-scope-warning {
                margin:8px 0;
                padding:9px 11px;
                border:1px solid #f0ad4e;
                border-radius:5px;
                background:#fcf8e3;
                color:#8a6d3b;
                line-height:1.7;
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

    function westernResponseDigits(value) {
        return String(value ?? '')
            .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
            .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)));
    }

    function normalizeGradeScaleText(value) {
        /*
         * نعالج رمز ½ قبل NFKC لأن NFKC يحوله إلى 1⁄2
         * باستخدام Fraction Slash مختلف عن /.
         */
        let s = westernResponseDigits(clean(value))
            .replace(/½/g, 'H')
            .replace(/1[\/⁄]2/g, 'H')
            .replace(/نصف/gi, 'H')
            .normalize('NFKC')
            .replace(/٫/g, '.')
            .replace(/\s+/g, '');

        /*
         * 0,5 هنا قيمة نصف عشرية واحدة، وليس اختيارين.
         */
        s = s
            .replace(/0[.,]5/g, 'H')
            .replace(/^\.5$/g, 'H')
            .replace(/^,5$/g, 'H');

        return s;
    }

    function isSingleGradeScaleResponse(value) {
        const s = normalizeGradeScaleText(value);
        return s === '0' || s === '1' || s === 'H';
    }

    function gradeScaleChoices(value) {
        const s = normalizeGradeScaleText(value);
        if (!s) return [];

        if (s === '0' || s === '1' || s === 'H') {
            return [s];
        }

        /*
         * ZipGrade قد يجمع أكثر من اختيار في نفس الاستجابة.
         * في مقياس 0 / نصف / 1 تصبح أمثلة ذلك:
         * 01 / 0H / H1 / 0,1 / 0+H / H|1
         */
        const residue = s
            .replace(/[01H]/g, '')
            .replace(/[،,;/|+\-_:]/g, '');

        if (residue) return [];

        return [...s].filter(ch => ch === '0' || ch === '1' || ch === 'H');
    }

    function isMultiResponse(v, primary = '') {
        const rawWithSpaces = clean(v);
        const raw = rawWithSpaces.replace(/\s+/g, '');
        if (!raw) return false;

        const single = new Set([
            'ص', 'خ',
            'أ', 'ا', 'ب', 'ج', 'د', 'هـ', 'ه',
            'A', 'B', 'C', 'D', 'E', 'F',
            'a', 'b', 'c', 'd', 'e', 'f',
            '0', '1', '½', '0.5', '.5', '0,5',
            '1/2', 'نصف'
        ]);

        if (single.has(raw)) return false;

        // المسار التقليدي للحروف: AB / AC / أب ...
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

        if (new Set(choices).size >= 2) {
            return true;
        }

        /*
         * v0.9.5:
         * كشف أسئلة التقدير 0 / نصف / 1.
         *
         * وجود مفتاح أساسي من نفس المقياس يجعل الكشف آمنا حتى لو
         * كانت الاستجابة ملتصقة دون فاصل مثل 01 أو 0½.
         * وإذا لم يوجد مفتاح، لا نرفع تنبيها إلا للتركيبات الواضحة.
         */
        const gradeChoices = gradeScaleChoices(rawWithSpaces);
        const uniqueGradeChoices = new Set(gradeChoices);

        if (uniqueGradeChoices.size < 2) {
            return false;
        }

        const primaryIsGradeScale = isSingleGradeScaleResponse(primary);
        const hasHalfToken =
            /½|نصف|1\s*[\/⁄]\s*2|0\s*[.,٫]\s*5/i.test(rawWithSpaces);
        const hasExplicitChoiceSeparator =
            /[\s،,;/|+\-_:]/.test(rawWithSpaces);

        return (
            primaryIsGradeScale ||
            hasHalfToken ||
            hasExplicitChoiceSeparator
        );
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

                if (isMultiResponse(response, primary)) {
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
                percent: r.percent
            })),
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


    // ---------------------------------------------------------------------
    // Included classes & missing-response coverage audit (v0.9.4)
    // ---------------------------------------------------------------------

    function coverageReviewKey(issue) {
        return `outside|${clean(issue?.paperId || issue?.studentId || issue?.name || '')}`;
    }

    function getCoverageReviews() {
        return load(STORE.coverageReviews, {});
    }

    function setCoverageReviewed(issue, yes) {
        const all = getCoverageReviews();
        const key = coverageReviewKey(issue);

        if (yes) {
            all[key] = {
                at: Date.now(),
                paperId: issue.paperId || '',
                studentId: issue.studentId || '',
                name: issue.name || ''
            };
        } else {
            delete all[key];
        }

        save(STORE.coverageReviews, all);
    }

    function hydrateCoverage(coverage) {
        if (!coverage) return null;

        const reviews = getCoverageReviews();
        const outsideResponses = (coverage.outsideResponses || []).map(item => ({
            ...item,
            reviewed: Boolean(reviews[coverageReviewKey(item)])
        }));

        const unresolvedOutside = outsideResponses.filter(item => !item.reviewed).length;
        const scopeReady = !coverage.scopeDetected || coverage.classFilterFetchComplete === true;

        return {
            ...coverage,
            outsideResponses,
            unresolvedOutside,
            readyForExport: scopeReady && unresolvedOutside === 0
        };
    }

    function coverageFresh(coverage) {
        return Boolean(coverage?.createdAt && Date.now() - coverage.createdAt <= FRESH_MS);
    }

    function classFilters(doc = document) {
        const found = [];
        const seen = new Set();

        for (const link of doc.querySelectorAll('a[href]')) {
            const label = clean(link.textContent);
            if (!/^filter\s+for\s+/i.test(label)) continue;

            const href = abs(link.getAttribute('href'));
            if (!href || seen.has(href)) continue;

            const url = new URL(href);
            const match = url.pathname.match(/^\/quiz\/([^/]+)\/([^/]+)\/?$/i);
            if (!match || decodeURIComponent(match[1]) !== ROUTE.quizId) continue;

            seen.add(href);
            const className = label.replace(/^filter\s+for\s+/i, '').trim();

            found.push({
                className,
                classKey: canon(className),
                scopeId: decodeURIComponent(match[2]),
                url: href
            });
        }

        return found;
    }

    async function fetchHtmlDocument(url) {
        const response = await fetch(url, {
            credentials: 'include',
            cache: 'no-store',
            headers: { Accept: 'text/html,application/xhtml+xml' }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        return new DOMParser().parseFromString(
            await response.text(),
            'text/html'
        );
    }

    function rosterHeaderIndex(headers, names) {
        const normalizedNames = names.map(name => clean(name).toLowerCase());

        for (const wanted of normalizedNames) {
            const exact = headers.findIndex(header => header === wanted);
            if (exact >= 0) return exact;
        }

        for (const wanted of normalizedNames) {
            const loose = headers.findIndex(header => header.includes(wanted) || wanted.includes(header));
            if (loose >= 0) return loose;
        }

        return -1;
    }

    function parseStudentRoster(doc, filters) {
        const table = doc.querySelector('#studentTable') || [...doc.querySelectorAll('table')].find(table => {
            const headerText = clean(table.querySelector('thead')?.textContent || '').toLowerCase();
            return headerText.includes('student id') && headerText.includes('first name');
        });

        if (!table) {
            return {
                found: false,
                students: [],
                error: 'لم يتم العثور على جدول الطلاب.'
            };
        }

        const headers = [...table.querySelectorAll('thead th')].map(th =>
            clean(th.textContent).toLowerCase().replace(/[：:]/g, '').trim()
        );

        const indexes = {
            id: rosterHeaderIndex(headers, ['student id', 'zipgrade id']),
            external: rosterHeaderIndex(headers, ['external ref', 'external id']),
            first: rosterHeaderIndex(headers, ['first name']),
            last: rosterHeaderIndex(headers, ['last name']),
            classes: rosterHeaderIndex(headers, ['class(es)', 'classes', 'class'])
        };

        if (indexes.id < 0 || indexes.first < 0 || indexes.classes < 0) {
            return {
                found: false,
                students: [],
                error: 'جدول الطلاب موجود لكن أعمدة Student ID / First Name / Class(es) لم تُقرأ بشكل صحيح.'
            };
        }

        const students = [];

        for (const row of table.querySelectorAll('tbody tr')) {
            const cells = [...row.querySelectorAll('td')];
            if (!cells.length) continue;

            const cell = index => index >= 0 ? clean(cells[index]?.textContent || '') : '';
            const classesText = cell(indexes.classes);
            const classesCanon = canon(classesText);

            const matchedIncludedClasses = filters
                .filter(filter => filter.classKey && classesCanon.includes(filter.classKey))
                .map(filter => filter.className);

            const firstName = cell(indexes.first);
            const lastName = cell(indexes.last);
            const studentLink = [...row.querySelectorAll('a[href]')].find(a => {
                try {
                    const path = new URL(a.getAttribute('href'), location.href).pathname;
                    return /^\/students\/[^/]+\/?$/i.test(path) && !/\/students\/new\/?$/i.test(path);
                } catch (_) {
                    return false;
                }
            });

            students.push({
                studentId: cell(indexes.id),
                externalRef: cell(indexes.external),
                firstName,
                lastName,
                name: clean(`${firstName} ${lastName}`),
                classesText,
                matchedIncludedClasses,
                included: matchedIncludedClasses.length > 0,
                studentUrl: studentLink ? abs(studentLink.getAttribute('href')) : ''
            });
        }

        return {
            found: true,
            students,
            error: ''
        };
    }

    async function buildCoverageAudit(papers) {
        const filters = classFilters(document);
        const base = {
            schema: 1,
            appVersion: VERSION,
            createdAt: Date.now(),
            quizId: ROUTE.quizId,
            scopeDetected: filters.length > 0,
            includedClasses: filters.map(filter => ({
                className: filter.className,
                scopeId: filter.scopeId,
                url: filter.url
            })),
            classFilterFetchComplete: true,
            classFilterErrors: [],
            classResults: [],
            outsideResponses: [],
            rosterFetchedOnce: false,
            rosterFetchComplete: false,
            rosterError: '',
            rosterStudentCount: null,
            eligibleStudentCount: null,
            respondedEligibleStudentCount: null,
            noResponseCount: null,
            studentsWithoutResponses: []
        };

        // No assigned class filters: the scope feature is simply not applicable.
        if (!filters.length) {
            save(STORE.coverage, base);
            return hydrateCoverage(base);
        }

        const includedPaperIds = new Set();

        for (const filter of filters) {
            try {
                const doc = await fetchHtmlDocument(filter.url);
                const classPapers = parsePaperRows(doc);

                classPapers.forEach(paper => {
                    if (paper.paperId) includedPaperIds.add(paper.paperId);
                });

                base.classResults.push({
                    className: filter.className,
                    scopeId: filter.scopeId,
                    paperCount: classPapers.length,
                    papers: classPapers.map(paper => ({
                        paperId: paper.paperId,
                        studentId: paper.studentId,
                        name: paper.name
                    }))
                });
            } catch (error) {
                base.classFilterFetchComplete = false;
                base.classFilterErrors.push({
                    className: filter.className,
                    url: filter.url,
                    error: clean(error?.message || error)
                });
            }
        }

        if (base.classFilterFetchComplete) {
            base.outsideResponses = papers
                .filter(paper => paper.paperId && !includedPaperIds.has(paper.paperId))
                .map(paper => ({
                    paperId: paper.paperId,
                    paperUrl: paper.paperUrl,
                    studentId: paper.studentId,
                    name: paper.name,
                    points: paper.points,
                    percent: paper.percent
                }));
        }

        // The complete student roster is fetched exactly once per scan.
        base.rosterFetchedOnce = true;

        try {
            const rosterDoc = await fetchHtmlDocument(`${location.origin}/students/`);
            const roster = parseStudentRoster(rosterDoc, filters);

            if (!roster.found) {
                base.rosterError = roster.error || 'تعذر قراءة قائمة الطلاب.';
            } else {
                base.rosterFetchComplete = true;
                base.rosterStudentCount = roster.students.length;

                const eligible = roster.students.filter(student => student.included);
                const responseIds = new Set(
                    papers.map(paper => clean(paper.studentId)).filter(Boolean)
                );

                const respondedEligible = eligible.filter(student =>
                    student.studentId && responseIds.has(clean(student.studentId))
                );

                const missing = eligible.filter(student =>
                    student.studentId && !responseIds.has(clean(student.studentId))
                );

                base.eligibleStudentCount = eligible.length;
                base.respondedEligibleStudentCount = respondedEligible.length;
                base.noResponseCount = missing.length;
                base.studentsWithoutResponses = missing.map(student => ({
                    studentId: student.studentId,
                    externalRef: student.externalRef,
                    name: student.name,
                    firstName: student.firstName,
                    lastName: student.lastName,
                    classesText: student.classesText,
                    matchedIncludedClasses: student.matchedIncludedClasses,
                    studentUrl: student.studentUrl
                }));
            }
        } catch (error) {
            base.rosterError = clean(error?.message || error);
        }

        save(STORE.coverage, base);
        return hydrateCoverage(base);
    }

    function coverageExportState() {
        const coverage = hydrateCoverage(load(STORE.coverage));

        if (!coverage) {
            return {
                ok: false,
                coverage: null,
                reason: 'أعد فحص النتائج لتطبيق فحص الفصول في الإصدار الجديد.'
            };
        }

        if (!coverageFresh(coverage)) {
            return {
                ok: false,
                coverage,
                reason: 'فحص الفصول قديم. أعد فحص النتائج قبل التصدير.'
            };
        }

        if (!coverage.scopeDetected) {
            return { ok: true, coverage, reason: '' };
        }

        if (!coverage.classFilterFetchComplete) {
            return {
                ok: false,
                coverage,
                reason: 'تعذر التحقق من جميع فصول الاختبار. أعد الفحص قبل التصدير.'
            };
        }

        if (coverage.unresolvedOutside > 0) {
            return {
                ok: false,
                coverage,
                reason: `توجد ${coverage.unresolvedOutside} استجابة من خارج الفصول المشمولة تحتاج قرارك.`
            };
        }

        return { ok: true, coverage, reason: '' };
    }

    function renderCoverage(coverage) {
        if (!coverage) {
            return panel(
                'info',
                'فحص نطاق الفصول',
                '<div style="padding:10px 12px">أعد فحص النتائج لتطبيق فحص الفصول والطلاب.</div>'
            );
        }

        if (!coverage.scopeDetected) {
            return panel(
                'default',
                'فحص نطاق الفصول',
                '<div style="padding:10px 12px">لم تظهر روابط <strong>Filter for</strong> لفصول مسندة لهذا الاختبار؛ لم يتم تطبيق فحص خارج الفصول.</div>'
            );
        }

        const classes = coverage.includedClasses.map(item => item.className).join('، ');
        const outside = coverage.outsideResponses || [];
        const missing = coverage.studentsWithoutResponses || [];

        let html = `
            <div class="${APP}-coverage-note" style="margin:0 0 10px">
                الفصول المشمولة: <strong>${esc(classes)}</strong>.
                تم فحص فلاتر الفصول، وقائمة الطلاب تُقرأ مرة واحدة فقط في كل فحص.
            </div>
        `;

        if (!coverage.classFilterFetchComplete) {
            html += panel(
                'danger',
                'تعذر إكمال فحص الفصول',
                `<div style="padding:10px 12px">
                    لم يكتمل جلب جميع فلاتر الفصول، ولذلك تم إيقاف اعتماد التصدير حتى إعادة الفحص.
                    ${coverage.classFilterErrors.map(item => `<div>${esc(item.className)}: ${esc(item.error)}</div>`).join('')}
                 </div>`
            );
        } else if (outside.length) {
            html += panel(
                'danger',
                `استجابات من خارج الفصول المشمولة (${outside.length})`,
                `<table class="table table-bordered table-condensed ${APP}-issues">
                    <thead><tr><th>Student ID</th><th>الطالب</th><th>الدرجة</th><th>الحالة</th></tr></thead>
                    <tbody>
                        ${outside.map(item => `
                            <tr>
                                <td>${esc(item.studentId || '—')}</td>
                                <td>${esc(item.name || '—')}</td>
                                <td>${esc(item.points || '—')} ${item.percent ? `(${esc(item.percent)}%)` : ''}</td>
                                <td>
                                    ${item.reviewed
                                        ? `${badge('تمت المراجعة — أبقها', 'reviewed')}
                                           <button type="button" class="btn btn-xs btn-default" data-action="coverage-unreview" data-coverage-issue="${esc(coverageReviewKey(item))}">إلغاء المراجعة</button>`
                                        : `${badge('خارج الفصول — يحتاج قرارك', 'outside')}
                                           <button type="button" class="btn btn-xs btn-danger" data-action="coverage-keep" data-coverage-issue="${esc(coverageReviewKey(item))}">راجعتها — أبقها كما هي</button>`
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`
            );
        } else {
            html += panel(
                'success',
                'نطاق الاستجابات',
                '<div style="padding:10px 12px">لا توجد استجابة من خارج الفصول المشمولة.</div>'
            );
        }

        if (!coverage.rosterFetchComplete) {
            html += panel(
                'warning',
                'طلاب بلا استجابة',
                `<div style="padding:10px 12px">
                    تعذر قراءة قائمة الطلاب، لذلك لم يتم احتساب الطلاب بلا استجابة.
                    ${coverage.rosterError ? `<br>${esc(coverage.rosterError)}` : ''}
                    <br><span class="${APP}-coverage-note">هذا الجزء معلوماتي ولا يمنع التصدير إذا كان فحص خارج الفصول مكتملًا.</span>
                 </div>`
            );
        } else if (missing.length) {
            html += `
                <div data-role="absence-panel">
                    ${panel(
                        'warning',
                        `طلاب من الفصول المشمولة بلا استجابة (${missing.length})`,
                        `<table class="table table-bordered table-condensed ${APP}-issues ${APP}-absence-table" data-role="absence-table">
                            <thead><tr><th>Student ID</th><th>الطالب</th><th>الفصل</th></tr></thead>
                            <tbody>
                                ${missing.map((student, index) => `
                                    <tr data-role="absence-row"
                                        data-original-index="${index}"
                                        data-student-id="${esc(student.studentId || '')}"
                                        data-student-name="${esc(student.name || '')}"
                                        data-student-class="${esc((student.matchedIncludedClasses || []).join('، ') || student.classesText || '')}">
                                        <td>${esc(student.studentId || '—')}</td>
                                        <td>${esc(student.name || '—')}</td>
                                        <td>${esc((student.matchedIncludedClasses || []).join('، ') || student.classesText || '—')}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div class="${APP}-coverage-note" style="padding:0 10px 10px">
                            هذه قائمة معلوماتية للغياب/عدم التسليم ولا تمنع التصدير.
                        </div>`
                    )}
                </div>
            `;
        } else {
            html += panel(
                'success',
                'طلاب بلا استجابة',
                '<div style="padding:10px 12px">جميع طلاب الفصول المشمولة لديهم استجابة.</div>'
            );
        }

        return html;
    }

    // ---------------------------------------------------------------------
    // Inline UI on quiz page
    // ---------------------------------------------------------------------

    function findInsertPoint() {
        const table = gradedTable(document);
        if (!table) return null;

        const portlet = table.closest('.portlet');
        if (portlet?.parentElement) {
            return { parent: portlet.parentElement, before: portlet };
        }

        return { parent: table.parentElement, before: table };
    }

    function createInlineRoot() {
        if (document.getElementById(`${APP}-root`)) return;

        const point = findInsertPoint();
        if (!point) return;

        const root = document.createElement('div');
        root.id = `${APP}-root`;
        root.className = 'portlet light bordered';

        root.innerHTML = `
            <div class="portlet-title">
                <div class="caption">
                    <i class="fa fa-stethoscope font-blue-sharp"></i>
                    <span class="caption-subject font-blue-sharp bold uppercase">
                        مدقق الاختبار
                    </span>
                    <span style="font-size:11px;color:#999;margin-right:8px">
                        v${VERSION}
                    </span>
                </div>

                <div class="actions ${APP}-toolbar">
                    <button type="button" class="btn btn-circle btn-primary" data-action="scan">
                        <i class="fa fa-search"></i> فحص النتائج
                    </button>

                    <button type="button" class="btn btn-circle btn-default" data-action="refresh">
                        <i class="fa fa-refresh"></i> تحديث العرض
                    </button>

                    <button type="button" class="btn btn-circle btn-default" data-action="reset-reviews">
                        إعادة ضبط المراجعات
                    </button>

                    <button type="button" class="btn btn-circle btn-default" data-action="clear">
                        مسح نتيجة الفحص
                    </button>
                </div>
            </div>

            <div class="portlet-body">
                <div class="${APP}-progress" data-role="progress">
                    <strong>جارٍ قراءة Full CSV وفحص الفصول وقائمة الطلاب...</strong>
                    <div class="progress progress-striped active">
                        <div class="progress-bar progress-bar-info"
                             style="width:100%"></div>
                    </div>
                </div>

                <div data-role="content"></div>
            </div>
        `;

        point.parent.insertBefore(root, point.before);

        root.addEventListener('click', async event => {
            const el = event.target.closest('[data-action]');
            if (!el) return;

            const action = el.dataset.action;

            if (action === 'scan') {
                await runScan();
                return;
            }

            if (action === 'refresh') {
                renderQuiz();
                return;
            }

            if (action === 'reset-reviews') {
                if (!confirm('إلغاء جميع علامات المراجعة لهذا الاختبار؟')) return;
                remove(STORE.reviews);
                remove(STORE.coverageReviews);
                renderQuiz();
                return;
            }

            if (action === 'clear') {
                if (!confirm('مسح نتيجة الفحص المحفوظة لهذا الاختبار فقط؟')) return;
                remove(STORE.audit);
                remove(STORE.coverage);
                renderQuiz();
                return;
            }

            if (action === 'coverage-keep' || action === 'coverage-unreview') {
                const coverage = hydrateCoverage(load(STORE.coverage));
                const issue = coverage?.outsideResponses?.find(item =>
                    coverageReviewKey(item) === el.dataset.coverageIssue
                );
                if (!issue) return;

                setCoverageReviewed(issue, action === 'coverage-keep');
                renderQuiz();

                if (action === 'coverage-keep') {
                    notify(
                        `تم اعتماد مراجعة ${issue.name || issue.studentId} مع إبقاء الاستجابة ضمن الاختبار.`,
                        'success'
                    );
                }
                return;
            }

            if (action === 'keep' || action === 'unreview') {
                const audit = hydrate(load(STORE.audit));
                const issue = audit?.multi?.find(x => reviewKey(x) === el.dataset.issue);
                if (!issue) return;

                setReviewed(issue, action === 'keep');
                renderQuiz();

                if (action === 'keep') {
                    notify(
                        `تم اعتماد مراجعة ${issue.name} — السؤال ${issue.question} مع إبقاء الإجابة كما هي.`,
                        'success'
                    );
                }
                return;
            }

            if (action === 'export') {
                exportXlsx();
            }
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
            const coverage = await buildCoverageAudit(audit.papers || []);
            renderQuiz(audit);

            const coverageState = coverageExportState();
            if (audit.ready && coverageState.ok) {
                notify(
                    coverage?.noResponseCount
                        ? `اكتمل الفحص: جاهز للتصدير، ويوجد ${coverage.noResponseCount} طالبًا من الفصول المشمولة بلا استجابة.`
                        : 'اكتمل الفحص: النتائج جاهزة للتصدير.',
                    'success'
                );
            } else {
                notify('اكتمل الفحص وتوجد عناصر تحتاج مراجعة قبل التصدير.', 'info');
            }
        } catch (error) {
            console.error('[ZGSSM Audit v0.9.5]', error);
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
        const coverage = hydrateCoverage(load(STORE.coverage));

        content.innerHTML = renderAudit(audit);

        highlightStudentRows(audit);
        mountResultTools(audit, coverage);
        applyResultView();
    }

    function chip(label, value, note = '') {
        return `
            <span class="${APP}-chip">
                ${esc(label)}:
                <strong>${esc(value)}</strong>
                ${note ? `<small style="color:#888">${esc(note)}</small>` : ''}
            </span>
        `;
    }

    function badge(text, type) {
        return `<span class="${APP}-badge ${APP}-${type}">${esc(text)}</span>`;
    }

    function panel(type, title, body) {
        return `
            <div class="panel panel-${type}" style="margin-bottom:10px">
                <div class="panel-heading"><strong>${esc(title)}</strong></div>
                <div class="panel-body" style="padding:0;overflow:auto">
                    ${body}
                </div>
            </div>
        `;
    }

    function resultClassMap(coverage) {
        const map = new Map();

        for (const group of coverage?.classResults || []) {
            for (const paper of group.papers || []) {
                if (!paper.paperId) continue;
                if (!map.has(paper.paperId)) map.set(paper.paperId, []);
                const list = map.get(paper.paperId);
                if (!list.includes(group.className)) list.push(group.className);
            }
        }

        return map;
    }

    function resultIssueState(audit, coverage) {
        const duplicate = new Set();
        for (const group of audit?.duplicates || []) {
            for (const item of group.items || []) {
                if (item.paperId) duplicate.add(item.paperId);
            }
        }

        const identity = new Set(
            (audit?.identityProblems || []).map(x => x.paperId).filter(Boolean)
        );

        const multi = new Map();
        for (const item of audit?.multi || []) {
            if (!item.paperId) continue;
            if (!multi.has(item.paperId)) multi.set(item.paperId, []);
            multi.get(item.paperId).push(item);
        }

        const blanks = new Set(
            (audit?.blanks || []).map(x => x.paperId).filter(Boolean)
        );

        const partials = new Set(
            (audit?.partials || []).map(x => x.paperId).filter(Boolean)
        );

        const outside = new Map(
            (coverage?.outsideResponses || [])
                .filter(x => x.paperId)
                .map(x => [x.paperId, x])
        );

        return { duplicate, identity, multi, blanks, partials, outside };
    }

    function scannedTimeValue(value) {
        const s = clean(value);
        const m = s.match(
            /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?/i
        );

        if (m) {
            let hour = Number(m[4]);
            const marker = (m[7] || '').toUpperCase();

            if (marker === 'PM' && hour < 12) hour += 12;
            if (marker === 'AM' && hour === 12) hour = 0;

            return new Date(
                Number(m[1]),
                Number(m[2]) - 1,
                Number(m[3]),
                hour,
                Number(m[5]),
                Number(m[6] || 0)
            ).getTime();
        }

        const parsed = Date.parse(s);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    function resultRowMeta(audit, coverage) {
        const classes = resultClassMap(coverage);
        const issues = resultIssueState(audit, coverage);
        const records = new Map(
            (audit?.records || [])
                .filter(x => x.paperId)
                .map(x => [x.paperId, x])
        );

        return parsePaperRows(document).map((paper, currentIndex) => {
            if (!ORIGINAL_ROW_INDEX.has(paper.row)) {
                ORIGINAL_ROW_INDEX.set(
                    paper.row,
                    Number.isFinite(paper.index) ? paper.index : ORIGINAL_ROW_SEQUENCE++
                );
            }

            const classNames = classes.get(paper.paperId) || [];
            const outside = issues.outside.get(paper.paperId) || null;
            const multis = issues.multi.get(paper.paperId) || [];
            const unreviewedMulti = multis.filter(x => !x.reviewed);
            const reviewedMulti = multis.filter(x => x.reviewed);
            const hasDuplicate = issues.duplicate.has(paper.paperId);
            const hasIdentity = issues.identity.has(paper.paperId);
            const hasBlank = issues.blanks.has(paper.paperId);
            const hasPartial = issues.partials.has(paper.paperId);

            const statuses = new Set();

            if (outside) statuses.add('outside');
            if (hasDuplicate) statuses.add('duplicate');
            if (hasIdentity) statuses.add('identity');
            if (multis.length) statuses.add('multi');
            if (hasBlank) statuses.add('blank');
            if (hasPartial) statuses.add('partial');
            if (outside?.reviewed || reviewedMulti.length) statuses.add('reviewed');

            if (
                (outside && !outside.reviewed) ||
                hasDuplicate ||
                hasIdentity ||
                unreviewedMulti.length
            ) {
                statuses.add('needs-review');
            }

            if (!statuses.size) statuses.add('clean');

            const record = records.get(paper.paperId) || null;
            const statusWords = [
                statuses.has('outside') ? 'خارج الفصول المشمولة' : '',
                statuses.has('duplicate') ? 'مكرر' : '',
                statuses.has('identity') ? 'مشكلة الحساب' : '',
                statuses.has('multi') ? 'تظليل متعدد' : '',
                statuses.has('blank') ? 'إجابة فارغة' : '',
                statuses.has('partial') ? 'درجة جزئية' : '',
                statuses.has('reviewed') ? 'تمت المراجعة' : '',
                statuses.has('clean') ? 'سليم' : ''
            ].filter(Boolean).join(' ');

            return {
                paper,
                row: paper.row,
                originalIndex: ORIGINAL_ROW_INDEX.get(paper.row) ?? currentIndex,
                classNames,
                classKeys: classNames.map(canon),
                statuses,
                searchText: canon([
                    paper.name,
                    paper.studentId,
                    record?.externalRef || '',
                    classNames.join(' '),
                    statusWords
                ].join(' '))
            };
        });
    }

    function compareResultMeta(a, b, sort) {
        if (sort === 'name') {
            return clean(a.paper.name).localeCompare(clean(b.paper.name), 'ar', {
                sensitivity: 'base',
                numeric: true
            });
        }

        if (sort === 'class') {
            return clean(a.classNames.join('، ')).localeCompare(
                clean(b.classNames.join('، ')),
                'ar',
                { sensitivity: 'base', numeric: true }
            );
        }

        if (sort === 'score') {
            return num(a.paper.points) - num(b.paper.points);
        }

        if (sort === 'percent') {
            return num(a.paper.percent) - num(b.paper.percent);
        }

        if (sort === 'time') {
            return scannedTimeValue(a.paper.scannedAt) - scannedTimeValue(b.paper.scannedAt);
        }

        if (sort === 'id') {
            return clean(a.paper.studentId).localeCompare(
                clean(b.paper.studentId),
                undefined,
                { numeric: true, sensitivity: 'base' }
            );
        }

        return a.originalIndex - b.originalIndex;
    }

    function resultStatusMatches(statuses, selected) {
        if (selected === 'all') return true;
        if (selected === 'no-response') return false;
        return statuses.has(selected);
    }

    function syncResultToolOptions(audit, coverage) {
        const root = document.getElementById(`${APP}-result-tools`);
        if (!root) return;

        const classSelect = root.querySelector('[data-view="class"]');
        const statusSelect = root.querySelector('[data-view="status"]');
        const sortSelect = root.querySelector('[data-view="sort"]');
        const searchInput = root.querySelector('[data-view="search"]');
        const direction = root.querySelector('[data-view-action="direction"]');

        const classOptions = [
            ['all', 'كل الفصول'],
            ...(coverage?.includedClasses || []).map(item => [
                canon(item.className),
                item.className
            ])
        ];

        if ((coverage?.outsideResponses || []).length) {
            classOptions.push(['__outside__', 'خارج الفصول المشمولة']);
        }

        classSelect.innerHTML = classOptions
            .map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`)
            .join('');

        if (!classOptions.some(([value]) => value === RESULT_VIEW.classKey)) {
            RESULT_VIEW.classKey = 'all';
        }

        classSelect.value = RESULT_VIEW.classKey;

        if (!audit && RESULT_VIEW.status !== 'all') {
            RESULT_VIEW.status = 'all';
        }

        statusSelect.value = RESULT_VIEW.status;
        sortSelect.value = RESULT_VIEW.sort;
        searchInput.value = RESULT_VIEW.search;

        direction.textContent =
            RESULT_VIEW.direction === 'asc'
                ? 'تصاعدي ↑'
                : 'تنازلي ↓';
    }

    function mountResultTools(audit, coverage) {
        const table = gradedTable(document);
        if (!table) return;

        let root = document.getElementById(`${APP}-result-tools`);

        if (!root) {
            root = document.createElement('div');
            root.id = `${APP}-result-tools`;

            root.innerHTML = `
                <div style="font-weight:700;margin-bottom:7px">
                    🔎 بحث وتصفية وفرز جدول الطلاب
                </div>

                <div class="${APP}-result-tools-grid">
                    <input type="search"
                           data-view="search"
                           placeholder="ابحث باسم الطالب أو Student ID أو البريد...">

                    <select data-view="class" aria-label="تصفية حسب الفصل"></select>

                    <select data-view="status" aria-label="تصفية حسب الحالة">
                        <option value="all">كل الحالات</option>
                        <option value="needs-review">يحتاج مراجعة</option>
                        <option value="outside">خارج الفصول</option>
                        <option value="duplicate">مكرر</option>
                        <option value="identity">مشكلة الحساب</option>
                        <option value="multi">تظليل متعدد</option>
                        <option value="blank">إجابة فارغة</option>
                        <option value="partial">درجة جزئية</option>
                        <option value="reviewed">تمت المراجعة</option>
                        <option value="clean">سليم</option>
                        <option value="no-response">بلا استجابة</option>
                    </select>

                    <select data-view="sort" aria-label="فرز النتائج">
                        <option value="original">ترتيب ZipGrade الأصلي</option>
                        <option value="name">الاسم</option>
                        <option value="class">الفصل</option>
                        <option value="score">الدرجة</option>
                        <option value="percent">النسبة</option>
                        <option value="time">وقت التصحيح</option>
                        <option value="id">Student ID</option>
                    </select>

                    <button type="button"
                            class="btn btn-default btn-sm"
                            data-view-action="direction">
                        تصاعدي ↑
                    </button>

                    <button type="button"
                            class="btn btn-default btn-sm"
                            data-view-action="reset">
                        إعادة الضبط
                    </button>
                </div>

                <div class="${APP}-result-tools-count" data-role="result-count"></div>

                <div class="${APP}-result-tools-note">
                    البحث والتصفية والفرز للعرض داخل الصفحة فقط، ولا تغيّر بيانات الاختبار أو ملف Full XLSX.
                </div>
            `;

            table.insertAdjacentElement('beforebegin', root);

            root.addEventListener('input', event => {
                const input = event.target.closest('[data-view="search"]');
                if (!input) return;
                RESULT_VIEW.search = input.value || '';
                applyResultView();
            });

            root.addEventListener('change', event => {
                const control = event.target.closest('[data-view]');
                if (!control) return;

                if (control.dataset.view === 'class') {
                    RESULT_VIEW.classKey = control.value;
                } else if (control.dataset.view === 'status') {
                    RESULT_VIEW.status = control.value;
                } else if (control.dataset.view === 'sort') {
                    RESULT_VIEW.sort = control.value;
                }

                applyResultView();
            });

            root.addEventListener('click', event => {
                const button = event.target.closest('[data-view-action]');
                if (!button) return;

                if (button.dataset.viewAction === 'direction') {
                    RESULT_VIEW.direction =
                        RESULT_VIEW.direction === 'asc' ? 'desc' : 'asc';
                    syncResultToolOptions(
                        hydrate(load(STORE.audit)),
                        hydrateCoverage(load(STORE.coverage))
                    );
                    applyResultView();
                    return;
                }

                if (button.dataset.viewAction === 'reset') {
                    RESULT_VIEW.search = '';
                    RESULT_VIEW.classKey = 'all';
                    RESULT_VIEW.status = 'all';
                    RESULT_VIEW.sort = 'original';
                    RESULT_VIEW.direction = 'asc';

                    syncResultToolOptions(
                        hydrate(load(STORE.audit)),
                        hydrateCoverage(load(STORE.coverage))
                    );
                    applyResultView();
                }
            });
        }

        syncResultToolOptions(audit, coverage);
    }

    function applyAbsenceView(coverage) {
        const rows = [
            ...document.querySelectorAll('[data-role="absence-row"]')
        ];

        const panel = document.querySelector('[data-role="absence-panel"]');
        const search = canon(RESULT_VIEW.search);
        const allowByStatus =
            RESULT_VIEW.status === 'all' ||
            RESULT_VIEW.status === 'no-response';

        let visible = 0;

        for (const row of rows) {
            const id = clean(row.dataset.studentId || '');
            const name = clean(row.dataset.studentName || '');
            const classText = clean(row.dataset.studentClass || '');
            const classKeys = classText
                .split(/[،,]/)
                .map(canon)
                .filter(Boolean);

            const searchText = canon(`${id} ${name} ${classText} بلا استجابة`);
            const searchMatch = !search || searchText.includes(search);

            let classMatch = RESULT_VIEW.classKey === 'all';
            if (RESULT_VIEW.classKey === '__outside__') {
                classMatch = false;
            } else if (!classMatch) {
                classMatch = classKeys.includes(RESULT_VIEW.classKey);
            }

            const show = allowByStatus && searchMatch && classMatch;
            row.style.display = show ? '' : 'none';
            if (show) visible++;
        }

        if (rows.length) {
            const tbody = rows[0].parentElement;
            const sortable = rows.slice();

            sortable.sort((a, b) => {
                const nameA = clean(a.dataset.studentName || '');
                const nameB = clean(b.dataset.studentName || '');
                const classA = clean(a.dataset.studentClass || '');
                const classB = clean(b.dataset.studentClass || '');
                const idA = clean(a.dataset.studentId || '');
                const idB = clean(b.dataset.studentId || '');

                let cmp = 0;

                if (RESULT_VIEW.sort === 'name') {
                    cmp = nameA.localeCompare(nameB, 'ar', { numeric:true, sensitivity:'base' });
                } else if (RESULT_VIEW.sort === 'class') {
                    cmp = classA.localeCompare(classB, 'ar', { numeric:true, sensitivity:'base' });
                } else if (RESULT_VIEW.sort === 'id') {
                    cmp = idA.localeCompare(idB, undefined, { numeric:true, sensitivity:'base' });
                } else {
                    cmp =
                        Number(a.dataset.originalIndex || 0) -
                        Number(b.dataset.originalIndex || 0);
                }

                return RESULT_VIEW.direction === 'desc' ? -cmp : cmp;
            });

            sortable.forEach(row => tbody?.appendChild(row));
        }

        const hasActiveNarrowing =
            Boolean(search) ||
            RESULT_VIEW.classKey !== 'all' ||
            RESULT_VIEW.status !== 'all';

        if (panel) {
            panel.style.display =
                allowByStatus && (!hasActiveNarrowing || visible > 0)
                    ? ''
                    : 'none';
        }

        return {
            visible,
            total: rows.length
        };
    }

    function applyResultView() {
        const audit = hydrate(load(STORE.audit));
        const coverage = hydrateCoverage(load(STORE.coverage));
        const metas = resultRowMeta(audit, coverage);
        const search = canon(RESULT_VIEW.search);

        let visible = 0;

        for (const meta of metas) {
            const searchMatch = !search || meta.searchText.includes(search);

            let classMatch = RESULT_VIEW.classKey === 'all';

            if (RESULT_VIEW.classKey === '__outside__') {
                classMatch = meta.statuses.has('outside');
            } else if (!classMatch) {
                classMatch = meta.classKeys.includes(RESULT_VIEW.classKey);
            }

            const statusMatch = resultStatusMatches(
                meta.statuses,
                RESULT_VIEW.status
            );

            const show = searchMatch && classMatch && statusMatch;
            meta.row.style.display = show ? '' : 'none';
            if (show) visible++;
        }

        const sorted = metas.slice().sort((a, b) => {
            const cmp = compareResultMeta(a, b, RESULT_VIEW.sort);
            if (cmp !== 0) {
                return RESULT_VIEW.direction === 'desc' ? -cmp : cmp;
            }

            return a.originalIndex - b.originalIndex;
        });

        if (sorted.length) {
            const parent = sorted[0].row.parentElement;
            sorted.forEach(item => parent?.appendChild(item.row));
        }

        const absence = applyAbsenceView(coverage);

        const count = document.querySelector(
            `#${APP}-result-tools [data-role="result-count"]`
        );

        if (count) {
            count.textContent =
                `المعروض: ${visible} من ${metas.length} استجابة` +
                (
                    absence.total
                        ? ` • بلا استجابة: ${absence.visible} من ${absence.total}`
                        : ''
                );
        }
    }

    function renderAudit(audit) {
        if (!audit) {
            return `
                <div class="alert alert-info">
                    سيعتمد الفحص على <strong>Full Format CSV</strong>، وعلى فلاتر الفصول
                    الموجودة في الاختبار، ثم يقرأ قائمة الطلاب <strong>مرة واحدة فقط</strong>
                    لتحديد طلاب الفصول المشمولة بلا استجابة.
                    <br>
                    اضغط <strong>فحص النتائج</strong> لتشغيل جميع الفحوص في عملية واحدة.
                </div>
            `;
        }

        const coverage = hydrateCoverage(load(STORE.coverage));
        const stale = !auditFresh(audit);
        const coverageStale = coverage ? !coverageFresh(coverage) : true;
        const reviewed = audit.multi.filter(x => x.reviewed).length;
        const outsideReviewed = coverage?.outsideResponses?.filter(x => x.reviewed).length || 0;
        const coverageState = coverageExportState();
        const combinedReady = audit.ready && coverageState.ok;

        const blockerText = [
            audit.blockers ? `المشاكل المانعة: ${audit.blockers}` : '',
            audit.unresolvedMulti ? `التظليل المتعدد غير المراجع: ${audit.unresolvedMulti}` : '',
            coverage?.unresolvedOutside ? `خارج الفصول غير المراجع: ${coverage.unresolvedOutside}` : '',
            coverage?.scopeDetected && !coverage?.classFilterFetchComplete ? 'فحص الفصول غير مكتمل' : ''
        ].filter(Boolean).join('، ');

        return `
            <div class="${APP}-status ${combinedReady ? `${APP}-status-ok` : `${APP}-status-warn`}">
                ${
                    combinedReady
                        ? '✅ الاختبار جاهز للتصدير إلى المحلل.'
                        : `⚠️ توجد عناصر تحتاج مراجعة قبل التصدير${blockerText ? ` — ${esc(blockerText)}` : ''}.`
                }
            </div>

            <div style="color:#999;font-size:12px;margin-bottom:7px">
                آخر فحص: ${esc(auditAge(audit))}
                ${stale || coverageStale ? ' — النتيجة قديمة ويجب إعادة الفحص قبل التصدير.' : ''}
            </div>

            <div class="${APP}-summary">
                ${chip('أوراق الصفحة', audit.paperCount)}
                ${chip('سجلات Full CSV', audit.csvRecordCount)}
                ${chip('الأسئلة', audit.questionCount)}
                ${chip('فصول الاختبار', coverage?.includedClasses?.length ?? '—')}
                ${chip('خارج الفصول', coverage?.outsideResponses?.length ?? '—', coverage ? `${outsideReviewed} تمت مراجعته` : '')}
                ${chip('بلا استجابة', coverage?.noResponseCount ?? '—', 'معلوماتي')}
                ${chip('التكرارات', audit.duplicates.length)}
                ${chip('مشاكل الحساب', audit.identityProblems.length)}
                ${chip('غير مرتبط بصف', audit.unmappedRecords.length)}
                ${chip('تظليل متعدد', audit.multi.length, `${reviewed} تمت مراجعته`)}
                ${chip('إجابات فارغة', audit.blanks.length)}
                ${chip('درجات جزئية', audit.partials.length)}
            </div>

            <div class="${APP}-legend">
                ${badge('أحمر داكن: استجابة من خارج الفصول', 'outside')}
                ${badge('أحمر: تكرار / مشكلة حساب / عدم تطابق', 'critical')}
                ${badge('برتقالي: تظليل متعدد يحتاج قرارك', 'multi')}
                ${badge('أصفر: إجابة فارغة', 'blank')}
                ${badge('أزرق: درجة جزئية', 'partial')}
                ${badge('أخضر: تمت المراجعة', 'reviewed')}
                ${badge('رمادي: بلا استجابة — معلوماتي', 'absence')}
            </div>

            ${renderCoverage(coverage)}
            ${renderDuplicates(audit.duplicates)}
            ${renderIdentity(audit.identityProblems)}
            ${renderUnmapped(audit.unmappedRecords)}
            ${renderMulti(audit.multi)}
            ${renderBlanks(audit.blanks)}
            ${renderPartials(audit.partials)}

            <div class="panel panel-default">
                <div class="panel-heading"><strong>التصدير للمحلل</strong></div>
                <div class="panel-body">
                    <button type="button"
                            class="btn btn-primary"
                            data-action="export"
                            ${combinedReady && !stale && !coverageStale ? '' : 'disabled'}>
                        <i class="fa fa-download"></i>
                        تنزيل Full XLSX الجاهز للمحلل
                    </button>

                    <span style="color:#777;font-size:12px;margin-right:8px">
                        الطلاب بلا استجابة لا يمنعون التصدير. الاستجابة من خارج الفصول تحتاج مراجعة واعتمادًا يدويًا.
                    </span>
                </div>
            </div>
        `;
    }

    function renderDuplicates(groups) {
        if (!groups.length) return '';

        return panel(
            'danger',
            `الأوراق / السجلات المكررة (${groups.length})`,
            `
            <table class="table table-bordered table-condensed ${APP}-issues">
                <thead>
                    <tr>
                        <th>المعرّف</th>
                        <th>سبب التطابق</th>
                        <th>الطلاب / الأوراق</th>
                    </tr>
                </thead>
                <tbody>
                    ${groups.map(g => `
                        <tr>
                            <td><strong>${esc(g.value)}</strong></td>
                            <td>${esc(g.bases.join(' + '))}</td>
                            <td>
                                ${g.items.map(x => `
                                    ${
                                        x.paperUrl
                                            ? `<a class="btn btn-xs btn-default" href="${esc(x.paperUrl)}">${esc(x.name || x.studentId)}</a>`
                                            : `<span>${esc(x.name || x.studentId)}</span>`
                                    }
                                `).join(' ')}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `
        );
    }

    function renderIdentity(items) {
        if (!items.length) return '';

        return panel(
            'danger',
            `مشاكل CustomID / الحساب (${items.length})`,
            `
            <table class="table table-bordered table-condensed ${APP}-issues">
                <thead>
                    <tr>
                        <th>الطالب</th>
                        <th>StudentID</th>
                        <th>CustomID</th>
                        <th>المشكلة</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(x => `
                        <tr>
                            <td>${paperLink(x)}</td>
                            <td>${esc(x.studentId || '—')}</td>
                            <td>${esc(x.externalRef || '—')}</td>
                            <td>${x.type === 'missing' ? 'الحساب مفقود' : 'الحساب ليس بصيغة بريد صالحة للربط'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `
        );
    }

    function renderUnmapped(items) {
        if (!items.length) return '';

        return panel(
            'danger',
            `سجلات Full CSV لم أجد لها صف طالب في الصفحة (${items.length})`,
            `
            <table class="table table-bordered table-condensed ${APP}-issues">
                <thead><tr><th>الطالب</th><th>StudentID</th><th>CustomID</th><th>صف CSV</th></tr></thead>
                <tbody>
                    ${items.map(x => `
                        <tr>
                            <td>${esc(x.name || '—')}</td>
                            <td>${esc(x.studentId || '—')}</td>
                            <td>${esc(x.externalRef || '—')}</td>
                            <td>${esc(x.sourceRow)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `
        );
    }

    function renderMulti(items) {
        if (!items.length) return '';

        return panel(
            'warning',
            `التظليل المتعدد — قرار المعلم (${items.length})`,
            `
            <table class="table table-bordered table-condensed ${APP}-issues">
                <thead>
                    <tr>
                        <th>الطالب</th>
                        <th>السؤال</th>
                        <th>إجابة الطالب</th>
                        <th>الصحيحة</th>
                        <th>الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(x => {
                        const key = reviewKey(x);
                        return `
                            <tr>
                                <td>
                                    ${paperLink(x)}
                                    <br><small>${esc(x.externalRef || '')}</small>
                                </td>
                                <td>س${esc(x.question)}</td>
                                <td><strong>${esc(x.response)}</strong></td>
                                <td>${esc(x.primary || '—')}</td>
                                <td>
                                    ${
                                        x.reviewed
                                            ? `
                                                ${badge('تمت المراجعة', 'reviewed')}
                                                <button type="button"
                                                        class="btn btn-xs btn-default"
                                                        data-action="unreview"
                                                        data-issue="${esc(key)}">
                                                    إلغاء
                                                </button>
                                              `
                                            : `
                                                ${badge('يحتاج قرارك', 'multi')}
                                                <button type="button"
                                                        class="btn btn-xs btn-warning"
                                                        data-action="keep"
                                                        data-issue="${esc(key)}">
                                                    راجعتها — أبقها كما هي
                                                </button>
                                              `
                                    }
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
            `
        );
    }

    function renderBlanks(items) {
        if (!items.length) return '';

        const groups = groupByStudent(items);

        return panel(
            'warning',
            `الإجابات الفارغة (${items.length})`,
            `
            <table class="table table-bordered table-condensed ${APP}-issues">
                <thead><tr><th>الطالب</th><th>الأسئلة الفارغة</th></tr></thead>
                <tbody>
                    ${groups.map(g => `
                        <tr>
                            <td>${paperLink(g)}</td>
                            <td>${g.questions.map(q => `س${q}`).join('، ')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `
        );
    }

    function renderPartials(items) {
        if (!items.length) return '';

        return panel(
            'info',
            `الدرجات الجزئية (${items.length})`,
            `
            <table class="table table-bordered table-condensed ${APP}-issues">
                <thead><tr><th>الطالب</th><th>السؤال</th><th>الإجابة</th><th>النقاط</th></tr></thead>
                <tbody>
                    ${items.map(x => `
                        <tr>
                            <td>${paperLink(x)}</td>
                            <td>س${esc(x.question)}</td>
                            <td>${esc(x.response || '—')}</td>
                            <td>${esc(x.points || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            `
        );
    }

    function paperLink(x) {
        return x.paperUrl
            ? `<a href="${esc(x.paperUrl)}"><strong>${esc(x.name || x.studentId)}</strong></a>`
            : `<strong>${esc(x.name || x.studentId || '—')}</strong>`;
    }

    function groupByStudent(items) {
        const map = new Map();

        for (const x of items) {
            const key = x.paperId || canon(x.studentId) || canon(x.name);

            if (!map.has(key)) {
                map.set(key, {
                    name: x.name,
                    studentId: x.studentId,
                    externalRef: x.externalRef,
                    paperId: x.paperId,
                    paperUrl: x.paperUrl,
                    questions: []
                });
            }

            map.get(key).questions.push(x.question);
        }

        return [...map.values()];
    }

    // ---------------------------------------------------------------------
    // Highlight ONLY student rows in gradedPapers
    // ---------------------------------------------------------------------

    function clearStudentHighlights() {
        const table = gradedTable(document);
        if (!table) return;

        for (const row of table.querySelectorAll('tr')) {
            row.classList.remove(
                `${APP}-row-outside`,
                `${APP}-row-critical`,
                `${APP}-row-multi`,
                `${APP}-row-blank`,
                `${APP}-row-partial`,
                `${APP}-row-reviewed`
            );

            row.querySelectorAll(`.${APP}-rowbadges`).forEach(el => el.remove());
        }
    }

    function highlightStudentRows(audit) {
        clearStudentHighlights();
        if (!audit) return;

        const coverage = hydrateCoverage(load(STORE.coverage));
        const outsideByPaper = new Map(
            (coverage?.outsideResponses || []).map(item => [item.paperId, item])
        );

        const papers = parsePaperRows(document);
        const byPaper = new Map(papers.map(p => [p.paperId, p]));

        const duplicatePaperIds = new Set();
        for (const g of audit.duplicates) {
            for (const x of g.items) {
                if (x.paperId) duplicatePaperIds.add(x.paperId);
            }
        }

        for (const [paperId, paper] of byPaper.entries()) {
            const row = paper.row;
            if (!row) continue;

            const badges = [];

            const outside = outsideByPaper.get(paperId) || null;
            const hasDup = duplicatePaperIds.has(paperId);
            const identity = audit.identityProblems.filter(x => x.paperId === paperId);
            const multis = audit.multi.filter(x => x.paperId === paperId);
            const blanks = audit.blanks.filter(x => x.paperId === paperId);
            const partials = audit.partials.filter(x => x.paperId === paperId);

            const unreviewed = multis.filter(x => !x.reviewed);
            const reviewed = multis.filter(x => x.reviewed);

            if (outside && !outside.reviewed) {
                row.classList.add(`${APP}-row-outside`);
            } else if (hasDup || identity.length) {
                row.classList.add(`${APP}-row-critical`);
            } else if (unreviewed.length) {
                row.classList.add(`${APP}-row-multi`);
            } else if (blanks.length) {
                row.classList.add(`${APP}-row-blank`);
            } else if (partials.length) {
                row.classList.add(`${APP}-row-partial`);
            } else if (reviewed.length || outside?.reviewed) {
                row.classList.add(`${APP}-row-reviewed`);
            }

            if (outside) {
                badges.push(
                    badge(
                        outside.reviewed
                            ? 'خارج الفصول — تمت المراجعة'
                            : 'خارج الفصول المشمولة',
                        outside.reviewed ? 'reviewed' : 'outside'
                    )
                );
            }

            if (hasDup) badges.push(badge('مكرر', 'critical'));
            if (identity.length) badges.push(badge('مشكلة الحساب', 'critical'));

            if (unreviewed.length) {
                badges.push(
                    badge(
                        `تظليل متعدد: ${unreviewed.map(x => `س${x.question}`).join('، ')}`,
                        'multi'
                    )
                );
            }

            if (reviewed.length) {
                badges.push(
                    badge(
                        `تمت مراجعة: ${reviewed.map(x => `س${x.question}`).join('، ')}`,
                        'reviewed'
                    )
                );
            }

            if (blanks.length) {
                badges.push(
                    badge(
                        `فارغ: ${blanks.map(x => `س${x.question}`).join('، ')}`,
                        'blank'
                    )
                );
            }

            if (partials.length) {
                badges.push(
                    badge(
                        `جزئي: ${partials.map(x => `س${x.question}`).join('، ')}`,
                        'partial'
                    )
                );
            }

            if (badges.length) {
                const link = row.querySelector('a[href*="/paper/"][href*="/subject/all/"]');
                if (link) {
                    const wrap = document.createElement('span');
                    wrap.className = `${APP}-rowbadges`;
                    wrap.innerHTML = badges.join('');
                    link.insertAdjacentElement('afterend', wrap);
                }
            }
        }
    }

    // ---------------------------------------------------------------------
    // Export
    // ---------------------------------------------------------------------

    function exportXlsx() {
        const audit = hydrate(load(STORE.audit));

        if (!audit) {
            notify('نفّذ فحص النتائج أولًا.', 'error');
            return;
        }

        if (!auditFresh(audit)) {
            notify('نتيجة الفحص قديمة. أعد الفحص قبل التصدير.', 'error');
            return;
        }

        if (!audit.ready) {
            notify('لا يزال هناك ما يحتاج مراجعة قبل التصدير.', 'error');
            return;
        }

        const coverageState = coverageExportState();
        if (!coverageState.ok) {
            notify(coverageState.reason, 'error');
            return;
        }

        location.href = audit.fullXlsxUrl || findFullXlsx(document);
    }

    function guardNativeXlsx() {
        document.addEventListener('click', event => {
            const a = event.target.closest('a[href]');
            if (!a) return;

            const isFullXlsx =
                /\/quiz\/full\/all\/.+\.xlsx(?:$|\?)/i.test(a.href || '') ||
                /full format \(with student responses\)\s*-\s*xlsx/i.test(clean(a.textContent));

            if (!isFullXlsx) return;

            const audit = hydrate(load(STORE.audit));
            const coverageState = coverageExportState();
            if (audit?.ready && auditFresh(audit) && coverageState.ok) return;

            event.preventDefault();
            event.stopPropagation();

            document.getElementById(`${APP}-root`)?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });

            notify(
                !audit
                    ? 'نفّذ فحص النتائج قبل تصدير Full XLSX.'
                    : !auditFresh(audit)
                        ? 'أعد الفحص قبل التصدير.'
                        : !coverageState.ok
                            ? coverageState.reason
                            : 'هناك مشاكل تحتاج مراجعة قبل التصدير.',
                'error'
            );
        }, true);
    }

    // ---------------------------------------------------------------------
    // Paper navigation - inline, robust
    // ---------------------------------------------------------------------

    function navClassKey(group) {
        if (!group) return '';
        if (group.scopeId) return `scope:${group.scopeId}`;
        return `class:${canon(group.className || '')}`;
    }

    function getNavigationClass() {
        return load(STORE.navClass, 'all') || 'all';
    }

    function setNavigationClass(value) {
        save(STORE.navClass, value || 'all');
    }

    function navigationScopeFresh(scope) {
        return Boolean(
            scope?.createdAt &&
            Date.now() - scope.createdAt <= FRESH_MS &&
            Array.isArray(scope.includedClasses) &&
            Array.isArray(scope.classResults)
        );
    }

    function compactNavigationScope(scope) {
        if (!scope) return null;

        return {
            createdAt: scope.createdAt || Date.now(),
            quizId: ROUTE.quizId,
            includedClasses: (scope.includedClasses || []).map(item => ({
                className: item.className || '',
                scopeId: item.scopeId || ''
            })),
            classResults: (scope.classResults || []).map(group => ({
                className: group.className || '',
                scopeId: group.scopeId || '',
                paperCount: group.paperCount ?? (group.papers || []).length,
                papers: (group.papers || []).map(paper => ({
                    paperId: paper.paperId || '',
                    studentId: paper.studentId || '',
                    name: paper.name || ''
                }))
            })),
            errors: scope.classFilterErrors || scope.errors || []
        };
    }

    async function fetchNavigationScope() {
        const fullCoverage = hydrateCoverage(load(STORE.coverage));

        if (
            fullCoverage &&
            coverageFresh(fullCoverage) &&
            Array.isArray(fullCoverage.includedClasses) &&
            Array.isArray(fullCoverage.classResults)
        ) {
            const compact = compactNavigationScope(fullCoverage);
            save(STORE.navScope, compact);
            return compact;
        }

        const cached = load(STORE.navScope, null);
        if (navigationScopeFresh(cached)) {
            return cached;
        }

        const response = await fetch(quizUrl(), {
            credentials: 'include',
            cache: 'no-store'
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const doc = new DOMParser().parseFromString(
            await response.text(),
            'text/html'
        );

        const filters = classFilters(doc);

        const scope = {
            createdAt: Date.now(),
            quizId: ROUTE.quizId,
            includedClasses: filters.map(filter => ({
                className: filter.className,
                scopeId: filter.scopeId
            })),
            classResults: [],
            errors: []
        };

        for (const filter of filters) {
            try {
                const classDoc = await fetchHtmlDocument(filter.url);
                const papers = parsePaperRows(classDoc);

                scope.classResults.push({
                    className: filter.className,
                    scopeId: filter.scopeId,
                    paperCount: papers.length,
                    papers: papers.map(paper => ({
                        paperId: paper.paperId,
                        studentId: paper.studentId,
                        name: paper.name
                    }))
                });
            } catch (error) {
                scope.errors.push({
                    className: filter.className,
                    scopeId: filter.scopeId,
                    error: clean(error?.message || error)
                });
            }
        }

        save(STORE.navScope, scope);
        return scope;
    }

    function navigationClassOptions(scope, papers) {
        const options = [
            {
                value: 'all',
                label: `كل الطلاب (${papers.length})`,
                count: papers.length
            }
        ];

        for (const group of scope?.classResults || []) {
            const ids = new Set(
                (group.papers || [])
                    .map(item => item.paperId)
                    .filter(Boolean)
            );

            const count = papers.filter(paper => ids.has(paper.paperId)).length;

            options.push({
                value: navClassKey(group),
                label: `${group.className || 'فصل'} (${count})`,
                count,
                className: group.className || '',
                scopeId: group.scopeId || ''
            });
        }

        if ((scope?.classResults || []).length) {
            const includedIds = new Set();

            for (const group of scope.classResults) {
                for (const paper of group.papers || []) {
                    if (paper.paperId) includedIds.add(paper.paperId);
                }
            }

            const outsideCount = papers.filter(
                paper => paper.paperId && !includedIds.has(paper.paperId)
            ).length;

            if (outsideCount) {
                options.push({
                    value: '__outside__',
                    label: `خارج الفصول المشمولة (${outsideCount})`,
                    count: outsideCount,
                    className: 'خارج الفصول المشمولة'
                });
            }
        }

        return options;
    }

    function navigationPapersForClass(papers, scope, selected) {
        if (!selected || selected === 'all') return papers.slice();

        if (selected === '__outside__') {
            const includedIds = new Set();

            for (const group of scope?.classResults || []) {
                for (const paper of group.papers || []) {
                    if (paper.paperId) includedIds.add(paper.paperId);
                }
            }

            return papers.filter(
                paper => paper.paperId && !includedIds.has(paper.paperId)
            );
        }

        const group = (scope?.classResults || []).find(
            item => navClassKey(item) === selected
        );

        if (!group) return [];

        const ids = new Set(
            (group.papers || [])
                .map(item => item.paperId)
                .filter(Boolean)
        );

        return papers.filter(paper => ids.has(paper.paperId));
    }

    function currentPaperClasses(scope) {
        const classes = [];

        for (const group of scope?.classResults || []) {
            if ((group.papers || []).some(paper => paper.paperId === ROUTE.paperId)) {
                classes.push(group.className);
            }
        }

        return classes;
    }

    function bindPaperKeyboardNavigation() {
        const guard = '__ZGSSM_PAPER_KEYBOARD_V094__';
        if (window[guard]) return;
        window[guard] = true;

        document.addEventListener('keydown', event => {
            if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
                return;
            }

            const target = event.target;
            if (
                target &&
                /^(input|textarea|select)$/i.test(target.tagName || '')
            ) {
                return;
            }

            let link = null;

            if (event.key === 'ArrowLeft') {
                link = document.getElementById(`${APP}-paper-prev`);
            } else if (event.key === 'ArrowRight') {
                link = document.getElementById(`${APP}-paper-next`);
            }

            if (!link || link.dataset.enabled !== '1' || !link.href) {
                return;
            }

            event.preventDefault();
            location.href = link.href;
        });
    }

    async function fetchPaperListFromQuiz() {
        const response = await fetch(quizUrl(), {
            credentials: 'include',
            cache: 'no-store'
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const list = parsePaperRows(doc).map(p => ({
            index: p.index,
            paperId: p.paperId,
            paperUrl: p.paperUrl,
            studentId: p.studentId,
            name: p.name,
            points: p.points,
            percent: p.percent
        }));

        if (list.length) save(STORE.papers, list);
        return list;
    }

    async function navigationPapers() {
        const cached = load(STORE.papers, []);

        if (cached?.length && cached.some(x => x.paperId === ROUTE.paperId)) {
            return cached;
        }

        return await fetchPaperListFromQuiz();
    }

    function issuePaperIds() {
        const audit = hydrate(load(STORE.audit));
        if (!audit) return new Set();

        const set = new Set();

        for (const g of audit.duplicates) {
            for (const x of g.items) if (x.paperId) set.add(x.paperId);
        }

        audit.identityProblems.forEach(x => x.paperId && set.add(x.paperId));
        audit.multi.filter(x => !x.reviewed).forEach(x => x.paperId && set.add(x.paperId));

        const coverage = hydrateCoverage(load(STORE.coverage));
        coverage?.outsideResponses
            ?.filter(x => !x.reviewed)
            .forEach(x => x.paperId && set.add(x.paperId));

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
        const edit = [...document.querySelectorAll('a,button')].find(el =>
            /edit responses/i.test(clean(el.textContent))
        );

        if (edit) {
            const group = edit.closest('.btn-group') || edit.parentElement;
            if (group?.parentElement) {
                return { parent: group.parentElement, before: group };
            }
        }

        // Fallback: find the left paper-detail portlet body.
        const zipText = [...document.querySelectorAll('.portlet-body, .panel-body, .col-md-6, .col-md-5')]
            .find(el => /zipgrade id/i.test(clean(el.textContent)) && /external ref/i.test(clean(el.textContent)));

        if (zipText) {
            return { parent: zipText, before: zipText.firstElementChild };
        }

        return null;
    }

    function currentPaperAudit() {
        const audit = hydrate(load(STORE.audit));
        if (!audit) return null;

        const coverage = hydrateCoverage(load(STORE.coverage));

        return {
            multi: audit.multi.filter(x => x.paperId === ROUTE.paperId),
            blanks: audit.blanks.filter(x => x.paperId === ROUTE.paperId),
            partials: audit.partials.filter(x => x.paperId === ROUTE.paperId),
            identity: audit.identityProblems.filter(x => x.paperId === ROUTE.paperId),
            duplicate: audit.duplicates.some(g => g.items.some(x => x.paperId === ROUTE.paperId)),
            outside: coverage?.outsideResponses?.find(x => x.paperId === ROUTE.paperId) || null
        };
    }

    async function mountPaperNavigation() {
        document.getElementById(`${APP}-paper`)?.remove();

        const point = findPaperInsertPoint();
        if (!point) return false;

        let papers = [];
        let scope = null;
        let scopeError = '';

        try {
            papers = await navigationPapers();
        } catch (error) {
            console.warn('[ZGSSM v0.9.5] navigation list failed', error);
        }

        try {
            scope = await fetchNavigationScope();
        } catch (error) {
            scopeError = clean(error?.message || error);
            console.warn('[ZGSSM v0.9.5] class navigation scope failed', error);
        }

        const options = navigationClassOptions(scope, papers);
        let selected = getNavigationClass();

        if (!options.some(option => option.value === selected)) {
            selected = 'all';
            setNavigationClass('all');
        }

        let scopedPapers = navigationPapersForClass(
            papers,
            scope,
            selected
        );

        // If a class exists but currently has no responses, preserve the lock
        // and show an explanatory state instead of silently switching to all.
        const currentAll = papers.find(
            paper => paper.paperId === ROUTE.paperId
        ) || null;

        const index = scopedPapers.findIndex(
            paper => paper.paperId === ROUTE.paperId
        );

        const lockActive = selected !== 'all';
        let prev = null;
        let next = null;

        if (index >= 0 && scopedPapers.length) {
            if (lockActive) {
                prev = scopedPapers.length > 1
                    ? scopedPapers[(index - 1 + scopedPapers.length) % scopedPapers.length]
                    : null;

                next = scopedPapers.length > 1
                    ? scopedPapers[(index + 1) % scopedPapers.length]
                    : null;
            } else {
                prev = index > 0 ? scopedPapers[index - 1] : null;
                next = index < scopedPapers.length - 1
                    ? scopedPapers[index + 1]
                    : null;
            }
        }

        const issueNext = index >= 0
            ? nextIssue(scopedPapers, index)
            : null;

        const current = index >= 0
            ? scopedPapers[index]
            : currentAll;

        const issues = currentPaperAudit();
        const selectedOption = options.find(option => option.value === selected);
        const currentClasses = currentPaperClasses(scope);
        const firstScoped = scopedPapers[0] || null;

        const selectHtml = options.map(option => `
            <option value="${esc(option.value)}"
                    ${option.value === selected ? 'selected' : ''}>
                ${esc(option.label)}
            </option>
        `).join('');

        let scopeWarning = '';

        if (lockActive && index < 0) {
            scopeWarning = `
                <div class="${APP}-paper-scope-warning">
                    الورقة الحالية لا تنتمي إلى
                    <strong>${esc(selectedOption?.className || 'الفصل المقفول')}</strong>.
                    ${
                        currentClasses.length
                            ? `فصل/فصول الطالب الحالية: <strong>${esc(currentClasses.join('، '))}</strong>.`
                            : 'الورقة الحالية لا تظهر في أي فصل من الفصول المشمولة.'
                    }
                    ${
                        firstScoped
                            ? `<a class="btn btn-warning btn-xs"
                                  style="margin-inline-start:7px"
                                  href="${esc(firstScoped.paperUrl)}">
                                   اذهب لأول طالب في الفصل
                               </a>`
                            : `<span style="font-weight:700">
                                   لا توجد استجابات في هذا الفصل حاليًا.
                               </span>`
                    }
                </div>
            `;
        }

        const box = document.createElement('div');
        box.id = `${APP}-paper`;
        box.className = 'well well-sm';

        box.innerHTML = `
            <div class="${APP}-paper-scope">
                <label for="${APP}-nav-class">
                    الفصل:
                </label>

                <select id="${APP}-nav-class">
                    ${selectHtml}
                </select>

                ${
                    lockActive
                        ? `<span class="${APP}-paper-lock">
                               🔒 مقيد على ${esc(selectedOption?.className || 'الفصل المختار')}
                           </span>
                           <button type="button"
                                   class="btn btn-default btn-xs"
                                   data-nav-action="unlock">
                               🔓 إلغاء قفل الفصل
                           </button>`
                        : `<span class="${APP}-paper-scope-note">
                               التنقل الحالي يشمل جميع الطلاب
                           </span>`
                }

                <span class="${APP}-paper-scope-note">
                    Alt+← السابق • Alt+→ التالي
                </span>
            </div>

            ${scopeError
                ? `<div class="alert alert-warning" style="margin:0 0 8px">
                       تعذر تحديث فصول التنقل: ${esc(scopeError)}.
                       تم استخدام البيانات المتاحة حاليًا.
                   </div>`
                : ''
            }

            ${scopeWarning}

            <div class="${APP}-paper-nav">
                <a id="${APP}-paper-prev"
                   data-enabled="${prev ? '1' : '0'}"
                   class="btn btn-default btn-sm"
                   href="${prev ? esc(prev.paperUrl) : '#'}"
                   ${prev ? '' : 'onclick="return false;" style="opacity:.45;pointer-events:none"'}>
                    ◀ السابق
                </a>

                <span class="${APP}-paper-pos">
                    ${
                        index >= 0
                            ? `${index + 1} / ${scopedPapers.length} — ${esc(current?.name || '')}`
                            : currentAll
                                ? `${esc(currentAll.name || '')} — خارج نطاق التنقل المختار`
                                : 'تعذر تحديد ترتيب هذه الورقة'
                    }
                </span>

                <a id="${APP}-paper-next"
                   data-enabled="${next ? '1' : '0'}"
                   class="btn btn-default btn-sm"
                   href="${next ? esc(next.paperUrl) : '#'}"
                   ${next ? '' : 'onclick="return false;" style="opacity:.45;pointer-events:none"'}>
                    التالي ▶
                </a>

                ${
                    issueNext
                        ? `<a class="btn btn-warning btn-sm"
                              href="${esc(issueNext.paperUrl)}">
                             ⚠ التالي للمراجعة
                           </a>`
                        : `<span class="btn btn-success btn-sm disabled">
                             ✓ لا مراجعات معلقة${lockActive ? ' في هذا الفصل' : ''}
                           </span>`
                }

                <a class="btn btn-default btn-sm" href="${esc(quizUrl())}">
                    العودة لصفحة الاختبار
                </a>
            </div>

            <div class="${APP}-paper-problems">
                ${renderCurrentPaperProblems(issues)}
            </div>
        `;

        point.parent.insertBefore(box, point.before);

        const classSelect = box.querySelector(`#${APP}-nav-class`);
        classSelect?.addEventListener('change', () => {
            setNavigationClass(classSelect.value || 'all');
            mountPaperNavigation();
        });

        box.querySelector('[data-nav-action="unlock"]')
            ?.addEventListener('click', () => {
                setNavigationClass('all');
                mountPaperNavigation();
            });

        bindPaperKeyboardNavigation();
        return true;
    }

    function renderCurrentPaperProblems(issues) {
        if (!issues) {
            return `
                <span style="color:#777;font-size:12px">
                    لم يتم العثور على فحص محفوظ لهذا الاختبار. نفّذ الفحص من صفحة الاختبار لعرض مشاكل هذا الطالب هنا.
                </span>
            `;
        }

        const tags = [];

        if (issues.outside) {
            tags.push(
                badge(
                    issues.outside.reviewed
                        ? 'خارج الفصول — تمت المراجعة'
                        : 'خارج الفصول المشمولة — يحتاج قرارك',
                    issues.outside.reviewed ? 'reviewed' : 'outside'
                )
            );
        }

        if (issues.duplicate) tags.push(badge('ورقة/طالب مكرر', 'critical'));

        if (issues.identity.length) {
            tags.push(badge('مشكلة CustomID / الحساب', 'critical'));
        }

        for (const x of issues.multi) {
            tags.push(
                badge(
                    `${x.reviewed ? 'تمت مراجعة' : 'تظليل متعدد'} س${x.question}: ${x.response}`,
                    x.reviewed ? 'reviewed' : 'multi'
                )
            );
        }

        if (issues.blanks.length) {
            tags.push(
                badge(
                    `فارغ: ${issues.blanks.map(x => `س${x.question}`).join('، ')}`,
                    'blank'
                )
            );
        }

        if (issues.partials.length) {
            tags.push(
                badge(
                    `جزئي: ${issues.partials.map(x => `س${x.question}`).join('، ')}`,
                    'partial'
                )
            );
        }

        return tags.length
            ? tags.join(' ')
            : `<span class="${APP}-badge ${APP}-reviewed">لا توجد مشكلة مسجلة لهذا الطالب</span>`;
    }

    async function robustMountPaperNavigation() {
        // ZipGrade page is normally server-rendered, but retry a few times so
        // the script also survives delayed layout initialization.
        for (let i = 0; i < 20; i++) {
            if (await mountPaperNavigation()) return;
            await new Promise(r => setTimeout(r, 350));
        }

        console.warn('[ZGSSM v0.9.5] Could not find insertion point for paper navigation.');
    }

    // ---------------------------------------------------------------------
    // Boot
    // ---------------------------------------------------------------------

    injectCss();

    if (ROUTE.type === 'quiz-all') {
        createInlineRoot();
        guardNativeXlsx();

        // Use cached result immediately, then refresh automatically once.
        setTimeout(() => {
            if (!RUNNING) runScan();
        }, 700);
    }

    if (ROUTE.type === 'paper-all') {
        robustMountPaperNavigation();
    }

    console.info(
        `%cZipGrade Smart Student Manager - Quiz Auditor v${VERSION}`,
        'font-weight:bold;color:#337ab7'
    );
})();

/* =========================================================================
   ZipGrade Smart Student Manager v0.9.5
   Student Manager Delete Extension
   -------------------------------------------------------------------------
   Adds native student deletion directly inside the existing Student Manager.
   It does not invent a delete endpoint. Instead it:
   1) reads the currently selected student's original ZipGrade URL,
   2) fetches that original page,
   3) locates ZipGrade's own Delete/Remove student control,
   4) submits the same native form/action with the existing session,
   5) verifies the student disappeared from /students/,
   6) reloads the list and automatically reopens Student Manager.
   ========================================================================= */
(() => {
    'use strict';

    const PATCH = 'zgssm-delete-ext';
    const MANAGER_APP = 'zgssm';
    const PATCH_VERSION = '0.9.5';
    const REOPEN_KEY = 'ZGSSM_REOPEN_MANAGER_AFTER_DELETE_V081';

    if (!/^\/students\/?$/i.test(location.pathname)) {
        return;
    }

    const cleanText = value =>
        String(value ?? '')
            .replace(/[\u200B-\u200F\u2060\uFEFF\u00AD]/g, '')
            .replace(/\s+/g, ' ')
            .trim();

    const language = () => {
        try {
            const saved = localStorage.getItem('ZGSSM_LANG');
            if (saved === 'en' || saved === 'ar') return saved;
        } catch (_) {}
        return /^ar\b/i.test(navigator.language || '') ? 'ar' : 'en';
    };

    const STRINGS = {
        ar: {
            deleteStudent: '🗑 حذف الطالب',
            deleting: 'جارٍ حذف الطالب...',
            confirmTitle: 'حذف الطالب',
            confirm:
                'سيتم حذف الطالب "{name}" من ZipGrade باستخدام أمر الحذف الأصلي في الموقع.\n\n' +
                'Student ID: {id}\n\n' +
                'هذا الإجراء لا يمكن التراجع عنه. هل تريد المتابعة؟',
            dirtyConfirm:
                'لديك تعديلات غير محفوظة لهذا الطالب. الحذف سيتجاهل هذه التعديلات ويحذف الطالب نفسه.\n\nهل تريد المتابعة؟',
            noUrl: 'تعذر تحديد رابط صفحة الطالب الأصلية.',
            noNativeDelete:
                'لم أتمكن من العثور على أمر الحذف الأصلي في صفحة هذا الطالب. لم يتم تنفيذ أي حذف.',
            sentButNotVerified:
                'تم إرسال طلب الحذف، لكن لم أتمكن من التحقق من اختفاء الطالب. لم يتم اعتبار العملية ناجحة.',
            success: '✅ تم حذف الطالب بنجاح. جارٍ تحديث قائمة الطلاب...',
            failed: '❌ تعذر حذف الطالب:',
            reopenFailed: 'تم تحديث الصفحة. افتح إدارة الطلاب مرة أخرى إذا لم تُفتح تلقائيًا.',
            aboutVersion: 'v0.9.5'
        },
        en: {
            deleteStudent: '🗑 Delete student',
            deleting: 'Deleting student...',
            confirmTitle: 'Delete student',
            confirm:
                'This will delete "{name}" from ZipGrade using the site’s native delete action.\n\n' +
                'Student ID: {id}\n\n' +
                'This cannot be undone. Continue?',
            dirtyConfirm:
                'You have unsaved changes for this student. Deleting will discard those edits and delete the student record.\n\nContinue?',
            noUrl: 'Could not determine the original student page URL.',
            noNativeDelete:
                'Could not locate ZipGrade’s native delete action on this student page. Nothing was deleted.',
            sentButNotVerified:
                'The delete request was sent, but the student could not be verified as removed. The operation was not treated as successful.',
            success: '✅ Student deleted successfully. Refreshing the student list...',
            failed: '❌ Could not delete student:',
            reopenFailed: 'The page refreshed. Reopen Student Manager if it did not open automatically.',
            aboutVersion: 'v0.9.5'
        }
    };

    const t = key => STRINGS[language()]?.[key] ?? STRINGS.en[key] ?? key;

    function format(template, vars) {
        let out = String(template);
        for (const [key, value] of Object.entries(vars || {})) {
            out = out.replaceAll(`{${key}}`, String(value ?? ''));
        }
        return out;
    }

    function absoluteUrl(value, base = location.href) {
        try {
            return new URL(value, base).href;
        } catch (_) {
            return '';
        }
    }

    function normalizedPath(url) {
        try {
            return new URL(url, location.href).pathname.replace(/\/+$/, '').toLowerCase();
        } catch (_) {
            return '';
        }
    }

    function currentEditor() {
        return document.querySelector(`#${MANAGER_APP}-managerMain .zgm-editor`);
    }

    function currentStudentUrl() {
        const editor = currentEditor();
        if (!editor) return '';

        // Prefer the explicit "Open original student page" link rendered by v0.7.0.
        const originalLink = [...editor.querySelectorAll('a[href]')]
            .find(a => {
                const label = cleanText(a.textContent).toLowerCase();
                return (
                    label.includes('فتح صفحة الطالب الأصلية') ||
                    label.includes('open original student page')
                );
            });

        if (originalLink?.href) return originalLink.href;

        // Fallback: the editor header prints student.href as muted text.
        const muted = editor.querySelector('.zgm-editor-head .zg-muted');
        const raw = cleanText(muted?.textContent || '');
        if (raw && /\/student/i.test(raw)) {
            return absoluteUrl(raw);
        }

        // Last fallback: any student-looking link within the editor.
        const candidate = [...editor.querySelectorAll('a[href]')]
            .find(a => /\/student/i.test(a.getAttribute('href') || ''));
        return candidate?.href || '';
    }

    function currentStudentName() {
        return cleanText(
            currentEditor()?.querySelector('.zgm-editor-head h3')?.textContent || ''
        );
    }

    function currentStudentId() {
        return cleanText(
            document.getElementById(`${MANAGER_APP}-editId`)?.value || ''
        );
    }

    function hasUnsavedChanges() {
        const dirty = document.getElementById(`${MANAGER_APP}-dirtyWrap`);
        return Boolean(cleanText(dirty?.textContent || ''));
    }

    function statusElement() {
        let el = document.getElementById(`${PATCH}-status`);
        if (el) return el;

        const actions = document.getElementById(`${MANAGER_APP}-saveStudent`)
            ?.closest('.zg-actions');

        if (!actions) return null;

        el = document.createElement('div');
        el.id = `${PATCH}-status`;
        el.style.cssText = `
            width:100%;
            margin-top:8px;
            font-size:12px;
            line-height:1.7;
            color:#475569;
        `;
        actions.insertAdjacentElement('afterend', el);
        return el;
    }

    function setStatus(message, type = 'info') {
        const el = statusElement();
        if (!el) return;

        el.textContent = message;
        el.style.fontWeight = type === 'error' || type === 'success' ? '700' : '400';
        el.style.color =
            type === 'error'
                ? '#991b1b'
                : type === 'success'
                    ? '#166534'
                    : '#475569';
    }

    function controlLabel(el) {
        return cleanText(
            [
                el?.textContent,
                el?.value,
                el?.getAttribute?.('aria-label'),
                el?.getAttribute?.('title')
            ]
                .filter(Boolean)
                .join(' ')
        );
    }

    function scoreDeleteControl(control, form = null) {
        const label = controlLabel(control).toLowerCase();
        const action = cleanText(
            form?.getAttribute('action') ||
            control?.getAttribute?.('href') ||
            control?.getAttribute?.('formaction') ||
            ''
        ).toLowerCase();

        let score = 0;

        const strongText =
            /delete\s+(?:this\s+)?student|remove\s+(?:this\s+)?student|حذف\s+(?:هذا\s+)?الطالب|حذف\s+طالب/i;
        const genericText =
            /\bdelete\b|\bremove\b|حذف/i;
        const badText =
            /paper|quiz|class|assessment|response|ورقة|اختبار|فصل|إجابة/i;

        if (strongText.test(label)) score += 120;
        else if (genericText.test(label)) score += 55;

        if (/delete|remove|destroy/i.test(action)) score += 50;
        if (/student/i.test(action)) score += 20;

        if (badText.test(label)) score -= 120;
        if (/paper|quiz|response/i.test(action)) score -= 120;

        return score;
    }

    function findNativeDeleteAction(doc, pageUrl) {
        const candidates = [];

        for (const form of doc.querySelectorAll('form')) {
            const controls = [
                ...form.querySelectorAll(
                    'button, input[type="submit"], input[type="button"], a[href]'
                )
            ];

            for (const control of controls) {
                const score = scoreDeleteControl(control, form);
                if (score >= 50) {
                    candidates.push({
                        kind: control.tagName === 'A' ? 'link' : 'form',
                        score,
                        control,
                        form,
                        pageUrl
                    });
                }
            }

            // Some sites have a delete-specific action with a neutral submit label.
            const actionOnlyScore = scoreDeleteControl(
                { textContent: '', value: '', getAttribute: () => '' },
                form
            );
            if (actionOnlyScore >= 60 && controls.length === 0) {
                candidates.push({
                    kind: 'form',
                    score: actionOnlyScore,
                    control: null,
                    form,
                    pageUrl
                });
            }
        }

        for (const link of doc.querySelectorAll('a[href]')) {
            if (link.closest('form')) continue;
            const score = scoreDeleteControl(link, null);
            if (score >= 70) {
                candidates.push({
                    kind: 'link',
                    score,
                    control: link,
                    form: null,
                    pageUrl
                });
            }
        }

        // Support buttons using a direct location assignment in onclick.
        for (const button of doc.querySelectorAll('button[onclick], input[onclick]')) {
            const score = scoreDeleteControl(button, button.form);
            if (score < 50) continue;

            const onclick = button.getAttribute('onclick') || '';
            const m = onclick.match(
                /(?:location(?:\.href)?|window\.location(?:\.href)?)\s*=\s*['"]([^'"]+)['"]/i
            );
            if (m) {
                candidates.push({
                    kind: 'link',
                    score: score + 10,
                    control: button,
                    form: null,
                    directUrl: absoluteUrl(m[1], pageUrl),
                    pageUrl
                });
            }
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0] || null;
    }

    function formParams(form, submitter) {
        const params = new URLSearchParams();

        for (const control of form.querySelectorAll('input, select, textarea')) {
            if (!control.name || control.disabled) continue;

            const tag = control.tagName.toLowerCase();
            const type = (control.type || '').toLowerCase();

            if (type === 'file') continue;
            if ((type === 'checkbox' || type === 'radio') && !control.checked) continue;
            if (
                ['submit', 'button', 'reset', 'image'].includes(type) &&
                control !== submitter
            ) {
                continue;
            }

            if (tag === 'select' && control.multiple) {
                [...control.selectedOptions].forEach(option => {
                    params.append(control.name, option.value);
                });
                continue;
            }

            params.append(control.name, control.value ?? '');
        }

        if (
            submitter &&
            submitter.name &&
            !params.has(submitter.name)
        ) {
            params.append(submitter.name, submitter.value ?? '');
        }

        return params;
    }

    async function executeNativeDelete(action) {
        if (action.kind === 'link') {
            const target =
                action.directUrl ||
                absoluteUrl(action.control?.getAttribute('href'), action.pageUrl);

            if (!target) throw new Error(t('noNativeDelete'));

            const response = await fetch(target, {
                credentials: 'include',
                cache: 'no-store',
                redirect: 'follow'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            return response;
        }

        const form = action.form;
        if (!form) throw new Error(t('noNativeDelete'));

        const method = (form.getAttribute('method') || 'GET').toUpperCase();
        const actionUrl = absoluteUrl(
            action.control?.getAttribute('formaction') ||
            form.getAttribute('action') ||
            action.pageUrl,
            action.pageUrl
        );

        const params = formParams(form, action.control);

        if (method === 'GET') {
            const url = new URL(actionUrl);
            for (const [key, value] of params.entries()) {
                url.searchParams.append(key, value);
            }

            const response = await fetch(url.href, {
                credentials: 'include',
                cache: 'no-store',
                redirect: 'follow'
            });

            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return response;
        }

        const response = await fetch(actionUrl, {
            method,
            credentials: 'include',
            cache: 'no-store',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
            },
            body: params.toString()
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response;
    }

    async function verifyDeleted(studentUrl, studentId) {
        const response = await fetch(`${location.origin}/students/`, {
            credentials: 'include',
            cache: 'no-store',
            redirect: 'follow'
        });

        if (!response.ok) {
            return { verified: false, reason: `HTTP ${response.status}` };
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const targetPath = normalizedPath(studentUrl);

        const stillLinked = [...doc.querySelectorAll('a[href]')].some(a =>
            normalizedPath(absoluteUrl(a.getAttribute('href'), response.url)) === targetPath
        );

        if (stillLinked) {
            return { verified: false, reason: 'student-link-still-present' };
        }

        // If the list contains the exact Student ID in a row with a student link,
        // treat the record as still present. This guards against URL format changes.
        if (studentId) {
            const stillById = [...doc.querySelectorAll('tr')].some(row => {
                const txt = cleanText(row.textContent);
                return (
                    txt.includes(studentId) &&
                    row.querySelector('a[href*="student"], a[href*="Student"]')
                );
            });

            if (stillById) {
                return { verified: false, reason: 'student-id-still-present' };
            }
        }

        return { verified: true };
    }

    async function deleteCurrentStudent(button) {
        const studentUrl = currentStudentUrl();
        const name = currentStudentName() || currentStudentId() || '—';
        const id = currentStudentId() || '—';

        if (!studentUrl) {
            setStatus(t('noUrl'), 'error');
            return;
        }

        if (hasUnsavedChanges() && !confirm(t('dirtyConfirm'))) {
            return;
        }

        if (!confirm(format(t('confirm'), { name, id }))) {
            return;
        }

        const oldText = button.textContent;
        button.disabled = true;
        button.textContent = t('deleting');
        setStatus(t('deleting'));

        try {
            const pageResponse = await fetch(studentUrl, {
                credentials: 'include',
                cache: 'no-store',
                redirect: 'follow'
            });

            if (!pageResponse.ok) {
                throw new Error(`HTTP ${pageResponse.status}`);
            }

            const html = await pageResponse.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const nativeAction = findNativeDeleteAction(doc, pageResponse.url || studentUrl);

            if (!nativeAction) {
                throw new Error(t('noNativeDelete'));
            }

            await executeNativeDelete(nativeAction);

            const verification = await verifyDeleted(studentUrl, id);
            if (!verification.verified) {
                throw new Error(t('sentButNotVerified'));
            }

            setStatus(t('success'), 'success');

            try {
                sessionStorage.setItem(REOPEN_KEY, '1');
            } catch (_) {}

            setTimeout(() => location.reload(), 650);
        } catch (error) {
            console.error('[ZGSSM Delete Extension]', error);
            setStatus(
                `${t('failed')} ${cleanText(error?.message || error)}`,
                'error'
            );
            button.disabled = false;
            button.textContent = oldText;
        }
    }

    function patchVisibleVersion() {
        // The baseline v0.7.0 is intentionally pinned as an @require in this
        // integration build. Make the visible manager/about version reflect
        // the integrated wrapper release instead of exposing the baseline number.
        const about = document.getElementById(`${MANAGER_APP}-about`);
        if (about) {
            for (const el of about.querySelectorAll('div,span,strong')) {
                if (cleanText(el.textContent) === 'v0.7.0') {
                    el.textContent = t('aboutVersion');
                }
            }
        }
    }

    function injectDeleteButton() {
        patchVisibleVersion();

        const saveButton = document.getElementById(`${MANAGER_APP}-saveStudent`);
        const editor = currentEditor();

        if (!saveButton || !editor) return;

        let deleteButton = document.getElementById(`${PATCH}-button`);
        if (!deleteButton) {
            deleteButton = document.createElement('button');
            deleteButton.id = `${PATCH}-button`;
            deleteButton.type = 'button';
            deleteButton.className = 'zg-btn zg-danger';
            deleteButton.textContent = t('deleteStudent');

            deleteButton.addEventListener('click', () => {
                deleteCurrentStudent(deleteButton);
            });

            saveButton.insertAdjacentElement('afterend', deleteButton);
        } else {
            deleteButton.textContent = t('deleteStudent');
        }
    }

    const observer = new MutationObserver(() => {
        injectDeleteButton();
        patchVisibleVersion();
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Initial pass in case the manager was already opened before observer setup.
    injectDeleteButton();

    // After a successful delete, reopen the manager after reload.
    let shouldReopen = false;
    try {
        shouldReopen = sessionStorage.getItem(REOPEN_KEY) === '1';
        if (shouldReopen) {
            sessionStorage.removeItem(REOPEN_KEY);
        }
    } catch (_) {}

    if (shouldReopen) {
        let attempts = 0;
        const timer = setInterval(() => {
            attempts++;

            const launch = document.getElementById(`${MANAGER_APP}-managerLaunch`);
            if (launch) {
                clearInterval(timer);
                launch.click();
                return;
            }

            if (attempts >= 40) {
                clearInterval(timer);
                console.warn('[ZGSSM Delete Extension]', t('reopenFailed'));
            }
        }, 250);
    }

    console.info(
        `%cZipGrade Smart Student Manager - Delete Extension v${PATCH_VERSION}`,
        'font-weight:bold;color:#b91c1c'
    );
})();
