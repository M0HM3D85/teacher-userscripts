// ==UserScript==
// @name         Madrasati Smart Attendance | التحضير الذكي لمدرستي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.3.2
// @description  مركز ذكي لإدارة حضور الحصة في مدرستي: تحضير جماعي، إحصاءات تفاعلية، تقارير دقيقة ببيانات الحصة، نسخ قوائم، طباعة/PDF، CSV، بحث وفرز وتراجع.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/SchoolSchedule/Schedule/ManageLecture*
// @grant        none
// @run-at       document-idle
// @noframes
// @downloadURL https://update.greasyfork.org/scripts/595613/Madrasati%20Smart%20Attendance%20%7C%20%D8%A7%D9%84%D8%AA%D8%AD%D8%B6%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A%20%D9%84%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A.user.js
// @updateURL https://update.greasyfork.org/scripts/595613/Madrasati%20Smart%20Attendance%20%7C%20%D8%A7%D9%84%D8%AA%D8%AD%D8%B6%D9%8A%D8%B1%20%D8%A7%D9%84%D8%B0%D9%83%D9%8A%20%D9%84%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A.meta.js
// ==/UserScript==


/*
=========================================================================
 Madrasati Smart Attendance | التحضير الذكي لمدرستي

 تصميم وتطوير: Mohammed Almalki (M0HM3D85)
 X / Twitter : https://x.com/M0HM3D85
 Snapchat    : https://www.snapchat.com/add/M0HM3D85
 GreasyFork  : https://greasyfork.org/en/users/1636459-m0hm3d85

 © 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.
 يمنع حذف أو تغيير بيانات المصمم وحقوقه عند إعادة نشر السكربت.
=========================================================================
*/

(() => {
    'use strict';

    const SCRIPT_META = Object.freeze({
        name: 'Madrasati Smart Attendance | التحضير الذكي لمدرستي',
        version: '0.3.2',
        author: 'Mohammed Almalki (M0HM3D85)',
        handle: 'M0HM3D85',
        greasyFork: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
        x: 'https://x.com/M0HM3D85',
        snapchat: 'https://www.snapchat.com/add/M0HM3D85',
        license: 'All Rights Reserved',
        copyright: '© 2026 Mohammed Almalki (M0HM3D85) — جميع الحقوق محفوظة.'
    });

    const APP_ID = 'msa-smart-attendance';
    const STYLE_ID = `${APP_ID}-style`;
    const PATH = '/SchoolSchedule/Schedule/ManageLecture';

    if (location.pathname.toLowerCase() !== PATH.toLowerCase()) return;

    const STATUS = Object.freeze({
        PRESENT: {
            key: 'present',
            label: 'حاضر',
            main: '0',
            detail: '0'
        },
        ABSENT_EXCUSED: {
            key: 'absent-excused',
            label: 'غائب بعذر',
            main: '12',
            detail: '1'
        },
        ABSENT_UNEXCUSED: {
            key: 'absent-unexcused',
            label: 'غائب بدون عذر',
            main: '12',
            detail: '2'
        },
        LATE_EXCUSED: {
            key: 'late-excused',
            label: 'متأخر بعذر',
            main: '34',
            detail: '4'
        },
        LATE_UNEXCUSED: {
            key: 'late-unexcused',
            label: 'متأخر بدون عذر',
            main: '34',
            detail: '3'
        }
    });

    const DETAIL_KIND = Object.freeze({
        '0': 'present',
        '1': 'absent',
        '2': 'absent',
        '3': 'late',
        '4': 'late'
    });

    const STATUS_BY_KEY = Object.freeze(
        Object.fromEntries(Object.values(STATUS).map(item => [item.key, item]))
    );

    const MAX_UNDO = 5;
    const boundEventRoots = new WeakSet();

    let state = {
        form: null,
        table: null,
        tbody: null,
        sortParent: null,
        eventRoot: null,
        contextKey: '',
        mode: '',
        students: [],
        originalOrder: [],
        undoStack: [],
        filter: 'all',
        query: '',
        sort: 'original',
        scope: 'all',
        collapsed: false,
        suspendUpdates: false
    };

    const q = (sel, root = document) => root.querySelector(sel);
    const qa = (sel, root = document) => [...root.querySelectorAll(sel)];

    function normalizeArabic(value = '') {
        return String(value)
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
            .replace(/[إأآٱ]/g, 'ا')
            .replace(/ى/g, 'ي')
            .replace(/ة/g, 'ه')
            .replace(/ؤ/g, 'و')
            .replace(/ئ/g, 'ي')
            .replace(/[^\p{L}\p{N}\s]/gu, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function escapeAttr(value) {
        if (window.CSS?.escape) return CSS.escape(String(value));
        return String(value).replace(/["\\]/g, '\\$&');
    }

    function injectStyle() {
        if (q(`#${STYLE_ID}`)) return;

        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
#${APP_ID} {
    direction: rtl;
    margin: 0 0 16px;
    border: 1px solid #d8e2e8;
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 8px 30px rgba(15, 23, 42, .08);
    overflow: hidden;
    font-family: inherit;
}
#${APP_ID} * { box-sizing: border-box; }
#${APP_ID} .msa-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 14px 16px;
    border-bottom: 1px solid #e8eef2;
    background: linear-gradient(135deg, #f7fbfa 0%, #f8fbff 100%);
}
#${APP_ID} .msa-title-wrap {
    display: flex;
    flex-direction: column;
    gap: 3px;
}
#${APP_ID} .msa-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 17px;
    font-weight: 900;
    color: #10251f;
}
#${APP_ID} .msa-title small {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
}
#${APP_ID} .msa-head-actions { display:flex; gap:7px; align-items:center; flex-wrap:wrap; }
#${APP_ID} .msa-body { padding: 14px 16px 15px; }
#${APP_ID}.is-collapsed .msa-body { display: none; }
#${APP_ID} .msa-stats {
    display: grid;
    grid-template-columns: repeat(7, minmax(112px, 1fr));
    gap: 9px;
    margin-bottom: 12px;
}
#${APP_ID} .msa-stat-card {
    position: relative;
    min-height: 88px;
    padding: 11px 12px 10px;
    border: 1px solid #e2e8f0;
    border-radius: 13px;
    background: #fff;
    cursor: pointer;
    text-align: right;
    transition: transform .14s ease, box-shadow .14s ease, border-color .14s ease;
    overflow: hidden;
}
#${APP_ID} .msa-stat-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 7px 18px rgba(15, 23, 42, .08);
}
#${APP_ID} .msa-stat-card.is-active { border-color: #17816c; box-shadow: 0 0 0 2px rgba(23,129,108,.12); }
#${APP_ID} .msa-stat-card::after {
    content: '';
    position: absolute;
    inset-inline-start: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    background: var(--msa-accent, #94a3b8);
}
#${APP_ID} .msa-stat-label { display:block; font-size:11px; font-weight:800; color:#64748b; margin-bottom:3px; }
#${APP_ID} .msa-stat-value { display:block; font-size:27px; line-height:1; font-weight:950; color:#14251f; }
#${APP_ID} .msa-stat-copy {
    position:absolute;
    inset-inline-end:7px;
    bottom:7px;
    min-height:26px !important;
    padding:3px 7px !important;
    border-radius:7px !important;
    font-size:10px !important;
    opacity:.75;
}
#${APP_ID} .msa-stat-card[data-filter="present"] { --msa-accent:#16a34a; background:#f7fdf9; }
#${APP_ID} .msa-stat-card[data-filter="absent-excused"] { --msa-accent:#f59e0b; background:#fffaf0; }
#${APP_ID} .msa-stat-card[data-filter="absent-unexcused"] { --msa-accent:#dc2626; background:#fff7f7; }
#${APP_ID} .msa-stat-card[data-filter="late-excused"] { --msa-accent:#0ea5e9; background:#f6fbff; }
#${APP_ID} .msa-stat-card[data-filter="late-unexcused"] { --msa-accent:#7c3aed; background:#faf8ff; }
#${APP_ID} .msa-stat-card[data-filter="unset"] { --msa-accent:#64748b; background:#f8fafc; }
#${APP_ID} .msa-ready {
    display:grid;
    grid-template-columns:auto 1fr auto;
    align-items:center;
    gap:10px;
    padding:10px 12px;
    margin-bottom:12px;
    border:1px solid #dfe7eb;
    border-radius:12px;
    background:#f8fafc;
    cursor:pointer;
}
#${APP_ID} .msa-ready.is-ready { background:#f0fdf4; border-color:#bbebc9; }
#${APP_ID} .msa-ready-main { font-weight:900; color:#24352f; white-space:nowrap; }
#${APP_ID} .msa-progress { height:8px; border-radius:999px; background:#e2e8f0; overflow:hidden; }
#${APP_ID} .msa-progress > i { display:block; width:0; height:100%; background:#17816c; border-radius:inherit; transition:width .2s ease; }
#${APP_ID} .msa-ready-count { font-size:12px; font-weight:800; color:#64748b; white-space:nowrap; }
#${APP_ID} .msa-row {
    display:flex;
    align-items:center;
    gap:8px;
    flex-wrap:wrap;
    margin-bottom:9px;
}
#${APP_ID} .msa-row:last-child { margin-bottom:0; }
#${APP_ID} button,
#${APP_ID} select,
#${APP_ID} input[type="search"] {
    min-height:38px;
    border-radius:9px;
    font:inherit;
}
#${APP_ID} button {
    border:1px solid #ccd8e0;
    background:#fff;
    color:#1f2937;
    padding:7px 11px;
    cursor:pointer;
    transition:.14s ease;
}
#${APP_ID} button:hover { background:#f8fafc; border-color:#aebfca; }
#${APP_ID} button:disabled { opacity:.46; cursor:not-allowed; }
#${APP_ID} .msa-primary { background:#117865; color:#fff; border-color:#117865; font-weight:900; }
#${APP_ID} .msa-primary:hover { background:#0d6756; border-color:#0d6756; }
#${APP_ID} .msa-secondary { background:#eef8f5; color:#0d6756; border-color:#b8ddd4; font-weight:800; }
#${APP_ID} .msa-report-btn { background:#123d55; color:#fff; border-color:#123d55; font-weight:900; }
#${APP_ID} .msa-report-btn:hover { background:#0c3247; border-color:#0c3247; }
#${APP_ID} .msa-soft-danger { color:#a12a2a; border-color:#efcaca; background:#fff8f8; }
#${APP_ID} select { border:1px solid #cfd8e3; background:#fff; padding:6px 10px; color:#1f2937; }
#${APP_ID} input[type="search"] {
    flex:1 1 270px;
    min-width:210px;
    border:1px solid #cfd8e3;
    padding:7px 11px;
    outline:none;
}
#${APP_ID} input[type="search"]:focus { border-color:#7aa99f; box-shadow:0 0 0 3px rgba(17,120,101,.08); }
#${APP_ID} .msa-filter,
#${APP_ID} .msa-scope-btn { padding:6px 10px; min-height:34px; font-size:12px; }
#${APP_ID} .msa-filter.is-active,
#${APP_ID} .msa-scope-btn.is-active { background:#eaf7f3; border-color:#86c5b6; color:#0e6655; font-weight:800; }
#${APP_ID} .msa-scope-group { display:inline-flex; gap:4px; padding:3px; border:1px solid #dde5ea; border-radius:10px; background:#f8fafc; }
#${APP_ID} .msa-spacer { flex:1 1 auto; }
#${APP_ID} .msa-hint { font-size:12px; color:#64748b; }
#${APP_ID} .msa-shortcuts { font-size:11px; color:#81909f; }
#${APP_ID} .msa-credit {
    margin-top:10px;
    padding-top:9px;
    border-top:1px dashed #e2e8f0;
    font-size:11px;
    color:#7a8798;
    text-align:left;
    direction:rtl;
}
#${APP_ID} .msa-credit strong { color:#475569; }
#${APP_ID} .msa-toast {
    display:none;
    margin-top:9px;
    padding:9px 11px;
    border-radius:9px;
    background:#eff8f5;
    color:#0d6756;
    font-size:12px;
}
#${APP_ID} .msa-toast.is-visible { display:block; }

.msa-row-hidden { display:none !important; }
.msa-student-row > td { transition:background .15s ease, box-shadow .15s ease; }
/* تلوين أوضح للصفوف حتى يمكن تمييز الحالة من النظرة الأولى */
.msa-student-row.msa-status-present > td { background:rgba(22,163,74,.12); }
.msa-student-row.msa-status-absent > td { background:rgba(220,38,38,.14); }
.msa-student-row.msa-status-late > td { background:rgba(245,158,11,.17); }
.msa-student-row.msa-status-unset > td { background:rgba(100,116,139,.12); }

/* شريط لوني جانبي إضافي لتقوية التمييز بدون التأثير على قراءة النص */
.msa-student-row.msa-status-present > td:first-child { box-shadow:inset -4px 0 #16a34a; }
.msa-student-row.msa-status-absent > td:first-child { box-shadow:inset -4px 0 #dc2626; }
.msa-student-row.msa-status-late > td:first-child { box-shadow:inset -4px 0 #f59e0b; }
.msa-student-row.msa-status-unset > td:first-child { box-shadow:inset -4px 0 #64748b; }
.msa-student-row.msa-focus-row > td { box-shadow:inset 0 0 0 2px rgba(14,165,233,.38); }

.msa-report-overlay {
    position:fixed;
    inset:0;
    z-index:2147483000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:18px;
    background:rgba(15,23,42,.58);
    direction:rtl;
}
.msa-report-dialog {
    width:min(980px, 96vw);
    max-height:90vh;
    overflow:auto;
    border-radius:16px;
    background:#fff;
    box-shadow:0 25px 70px rgba(0,0,0,.24);
    font-family:inherit;
}
.msa-report-head {
    position:sticky;
    top:0;
    z-index:2;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:10px;
    padding:14px 16px;
    border-bottom:1px solid #e5e7eb;
    background:rgba(255,255,255,.97);
    backdrop-filter:blur(8px);
}
.msa-report-head h3 { margin:0; font-size:18px; }
.msa-report-actions { display:flex; gap:6px; flex-wrap:wrap; }
.msa-report-actions button { min-height:34px; border:1px solid #d5dee5; border-radius:8px; background:#fff; padding:6px 10px; cursor:pointer; }
.msa-report-content { padding:16px; }
.msa-report-meta { padding:12px; border-radius:11px; background:#f8fafc; color:#475569; font-size:12px; margin-bottom:12px; border:1px solid #edf1f4; }
.msa-report-meta-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; }
.msa-report-meta-item { padding:8px 9px; border-radius:9px; background:#fff; border:1px solid #e7edf1; min-width:0; }
.msa-report-meta-item span { display:block; color:#8491a3; font-size:10px; margin-bottom:2px; }
.msa-report-meta-item b { display:block; color:#26374a; font-size:12px; overflow-wrap:anywhere; }
.msa-report-summary { display:grid; grid-template-columns:repeat(6,1fr); gap:8px; margin-bottom:14px; }
.msa-report-summary div { padding:10px; border:1px solid #e5e7eb; border-radius:10px; text-align:center; }
.msa-report-summary b { display:block; font-size:22px; }
.msa-report-groups { display:grid; grid-template-columns:repeat(2,1fr); gap:10px; }
.msa-report-group { border:1px solid #e5e7eb; border-radius:11px; padding:11px; }
.msa-report-group h4 { margin:0 0 7px; font-size:14px; }
.msa-report-group ol { margin:0; padding-inline-start:22px; }
.msa-report-group li { margin:3px 0; font-size:12px; }
.msa-report-empty { color:#94a3b8; font-size:12px; }

@media (min-width: 992px) and (min-height: 720px) {
    #${APP_ID} { position:sticky; top:8px; z-index:850; }
}
@media (max-width: 1180px) {
    #${APP_ID} .msa-stats { grid-template-columns:repeat(4, minmax(110px, 1fr)); }
}
@media (max-width: 768px) {
    #${APP_ID} { position:static; }
    #${APP_ID} .msa-head, #${APP_ID} .msa-body { padding:11px; }
    #${APP_ID} .msa-stats { grid-template-columns:repeat(2, minmax(120px,1fr)); }
    #${APP_ID} button, #${APP_ID} select { flex:1 1 auto; }
    #${APP_ID} input[type="search"] { flex-basis:100%; }
    #${APP_ID} .msa-ready { grid-template-columns:1fr auto; }
    #${APP_ID} .msa-progress { grid-column:1 / -1; order:3; }
    .msa-report-meta-grid { grid-template-columns:repeat(2,minmax(0,1fr)); }
    .msa-report-summary { grid-template-columns:repeat(3,1fr); }
    .msa-report-groups { grid-template-columns:1fr; }
}
        `;
        document.head.appendChild(style);
    }

    function findStudentContainer(nameInput, index) {
        const mainName = `Attend[${index}]`;
        const detailName = `List[${index}].AttendStatusId`;

        const tr = nameInput?.closest?.('tr');
        if (tr) return tr;

        let node = nameInput?.parentElement || null;
        let depth = 0;

        while (node && node !== document.body && depth < 10) {
            const hasMain = q(
                `input[type="radio"][name="${escapeAttr(mainName)}"]`,
                node
            );

            const hasDetail = q(
                `input[type="radio"][name="${escapeAttr(detailName)}"]`,
                node
            );

            if (hasMain || hasDetail) return node;

            node = node.parentElement;
            depth++;
        }

        return nameInput?.parentElement || null;
    }

    function makeStudentFromIndexedNameInput(nameInput, domIndex) {
        const match = nameInput.name.match(/^List\[(\d+)\]\.StudentName$/);
        if (!match) return null;

        const index = Number(match[1]);
        const row = findStudentContainer(nameInput, index);
        if (!row) return null;

        const studentIdInput =
            q(`input[name="${escapeAttr(`List[${index}].StudentId`)}"]`, row) ||
            q(`input[name="${escapeAttr(`List[${index}].StudentId`)}"]`) ||
            q(`#List_${index}__StudentId`);

        const mainRadio =
            q(`input[type="radio"][name="${escapeAttr(`Attend[${index}]`)}"]`, row) ||
            q(`input[type="radio"][name="${escapeAttr(`Attend[${index}]`)}"]`);

        const detailRadio =
            q(`input[type="radio"][name="${escapeAttr(`List[${index}].AttendStatusId`)}"]`, row) ||
            q(`input[type="radio"][name="${escapeAttr(`List[${index}].AttendStatusId`)}"]`);

        if (!studentIdInput || (!mainRadio && !detailRadio)) return null;

        row.classList.add('msa-student-row');
        row.dataset.msaIndex = String(index);

        if (!row.dataset.msaOriginalOrder) {
            row.dataset.msaOriginalOrder = String(domIndex);
        }

        return {
            index,
            row,
            studentId: studentIdInput.value || '',
            name: nameInput.value || '',
            normalizedName: normalizeArabic(nameInput.value || ''),
            originalOrder: Number(row.dataset.msaOriginalOrder),
            layout: 'indexed-form'
        };
    }

    function makeStudentFromRow(row, domIndex) {
        const mainRadio = q(
            'input[type="radio"][name^="Attend["]',
            row
        );

        if (!mainRadio) return null;

        const match = mainRadio.name.match(/^Attend\[(\d+)\]$/);
        if (!match) return null;

        const index = Number(match[1]);

        const detailRadio = q(
            `input[type="radio"][name="${escapeAttr(`List[${index}].AttendStatusId`)}"]`,
            row
        );

        if (!detailRadio) return null;

        // الوضع الثاني في مدرستي يضع البيانات داخل كل tr بأسماء غير مفهرسة.
        const studentNameInput =
            q('input[type="hidden"][name="StudentName"]', row) ||
            q(`input[name="${escapeAttr(`List[${index}].StudentName`)}"]`, row);

        const studentIdInput =
            q('input[type="hidden"][name="StudentId"]', row) ||
            q(`input[name="${escapeAttr(`List[${index}].StudentId`)}"]`, row);

        if (!studentNameInput || !studentIdInput) return null;

        row.classList.add('msa-student-row');
        row.dataset.msaIndex = String(index);

        if (!row.dataset.msaOriginalOrder) {
            row.dataset.msaOriginalOrder = String(domIndex);
        }

        return {
            index,
            row,
            studentId: studentIdInput.value || '',
            name: studentNameInput.value || '',
            normalizedName: normalizeArabic(studentNameInput.value || ''),
            originalOrder: Number(row.dataset.msaOriginalOrder),
            layout: 'row-save'
        };
    }

    function dedupeStudents(students) {
        const unique = new Map();

        for (const student of students) {
            const old = unique.get(student.index);

            if (!old) {
                unique.set(student.index, student);
                continue;
            }

            const oldVisible = old.row.getClientRects().length > 0;
            const newVisible = student.row.getClientRects().length > 0;

            if ((!oldVisible && newVisible) || !document.contains(old.row)) {
                unique.set(student.index, student);
            }
        }

        return [...unique.values()].sort((a, b) => a.index - b.index);
    }

    function detectContext() {
        let mode = '';
        let students = [];

        // الوضع 1: التحضير الأولي — بيانات الطالب مفهرسة List[i].StudentName
        const indexedNameInputs = qa(
            'input[name^="List["][name$=".StudentName"]'
        );

        if (indexedNameInputs.length) {
            students = indexedNameInputs
                .map(makeStudentFromIndexedNameInput)
                .filter(Boolean);

            if (students.length) mode = 'batch-form';
        }

        // الوضع 2: الحضور محفوظ مسبقًا — كل صف مستقل وله زر .btnSendAttend
        if (!students.length) {
            const candidateRows = qa('table tbody tr');

            students = candidateRows
                .map(makeStudentFromRow)
                .filter(Boolean);

            if (students.length) mode = 'row-save';
        }

        students = dedupeStudents(students);
        if (!students.length) return null;

        const firstStudent = students[0];
        const firstRow = firstStudent.row;

        const form =
            firstRow.closest('form') ||
            q('#SaveAttendStudents') ||
            qa('form').find(f =>
                /SaveAttendStudents/i.test(f.action || '') ||
                q('input[name^="List["][name$=".AttendStatusId"]', f)
            ) ||
            null;

        const table = firstRow.closest('table') || null;
        const tbody = table?.tBodies?.[0] || null;

        const parents = new Set(
            students.map(s => s.row.parentElement).filter(Boolean)
        );

        const sortParent = parents.size === 1
            ? [...parents][0]
            : null;

        const eventRoot =
            form ||
            table ||
            sortParent ||
            document;

        const contextKey = [
            mode,
            ...students.map(s => `${s.index}:${s.studentId}:${s.name}`)
        ].join('|');

        return {
            form,
            table,
            tbody,
            sortParent,
            eventRoot,
            contextKey,
            mode,
            students
        };
    }

    function readStudentStatus(student) {
        const idx = student.index;
        const detail =
            q(`input[name="${escapeAttr(`List[${idx}].AttendStatusId`)}"]:checked`, student.row) ||
            q(`input[name="${escapeAttr(`List[${idx}].AttendStatusId`)}"]:checked`);

        const main =
            q(`input[name="${escapeAttr(`Attend[${idx}]`)}"]:checked`, student.row) ||
            q(`input[name="${escapeAttr(`Attend[${idx}]`)}"]:checked`);

        const detailValue = detail?.value ?? '';
        const mainValue = main?.value ?? '';

        let kind = DETAIL_KIND[detailValue] || '';
        if (!kind) {
            if (mainValue === '0') kind = 'present';
            else if (mainValue === '12') kind = 'absent';
            else if (mainValue === '34') kind = 'late';
            else kind = 'unset';
        }

        let key = 'unset';
        if (detailValue === '0') key = STATUS.PRESENT.key;
        else if (detailValue === '1') key = STATUS.ABSENT_EXCUSED.key;
        else if (detailValue === '2') key = STATUS.ABSENT_UNEXCUSED.key;
        else if (detailValue === '4') key = STATUS.LATE_EXCUSED.key;
        else if (detailValue === '3') key = STATUS.LATE_UNEXCUSED.key;

        return {
            kind,
            key,
            main: mainValue,
            detail: detailValue
        };
    }

    function dispatchRadio(radio) {
        if (!radio || radio.disabled) return false;
        if (radio.checked) return true;

        try {
            radio.click();
        } catch (_) {}

        if (radio.checked) return true;

        radio.checked = true;
        radio.dispatchEvent(new Event('input', { bubbles: true }));
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return radio.checked;
    }

    function setStudentStatus(student, statusDef) {
        const idx = student.index;

        const main =
            q(
                `input[type="radio"][name="${escapeAttr(`Attend[${idx}]`)}"][value="${escapeAttr(statusDef.main)}"]`,
                student.row
            ) ||
            q(`input[type="radio"][name="${escapeAttr(`Attend[${idx}]`)}"][value="${escapeAttr(statusDef.main)}"]`);

        const detail =
            q(
                `input[type="radio"][name="${escapeAttr(`List[${idx}].AttendStatusId`)}"][value="${escapeAttr(statusDef.detail)}"]`,
                student.row
            ) ||
            q(`input[type="radio"][name="${escapeAttr(`List[${idx}].AttendStatusId`)}"][value="${escapeAttr(statusDef.detail)}"]`);

        if (!main || !detail || main.disabled || detail.disabled) return false;

        dispatchRadio(main);
        dispatchRadio(detail);
        return main.checked && detail.checked;
    }

    function clearStudentStatus(student) {
        const idx = student.index;
        let radios = [
            ...qa(`input[type="radio"][name="${escapeAttr(`Attend[${idx}]`)}"]`, student.row),
            ...qa(`input[type="radio"][name="${escapeAttr(`List[${idx}].AttendStatusId`)}"]`, student.row)
        ];

        if (!radios.length) {
            radios = [
                ...qa(`input[type="radio"][name="${escapeAttr(`Attend[${idx}]`)}"]`),
                ...qa(`input[type="radio"][name="${escapeAttr(`List[${idx}].AttendStatusId`)}"]`)
            ];
        }

        let changed = false;
        for (const radio of radios) {
            if (radio.checked && !radio.disabled) {
                radio.checked = false;
                radio.dispatchEvent(new Event('input', { bubbles: true }));
                radio.dispatchEvent(new Event('change', { bubbles: true }));
                changed = true;
            }
        }
        return changed;
    }

    function snapshot() {
        return state.students.map(student => ({
            index: student.index,
            ...readStudentStatus(student)
        }));
    }

    function pushUndo() {
        state.undoStack.push(snapshot());
        if (state.undoStack.length > MAX_UNDO) state.undoStack.shift();
    }

    function restoreSnapshot(snapshotData) {
        if (!Array.isArray(snapshotData)) return;
        const byIndex = new Map(snapshotData.map(item => [item.index, item]));

        state.suspendUpdates = true;
        try {
            for (const student of state.students) {
                const old = byIndex.get(student.index);
                if (!old) continue;

                const statusDef = Object.values(STATUS).find(
                    item => item.main === old.main && item.detail === old.detail
                );

                if (statusDef) setStudentStatus(student, statusDef);
                else clearStudentStatus(student);
            }
        } finally {
            state.suspendUpdates = false;
        }
        updateAll();
    }

    function undoLast() {
        const previous = state.undoStack.pop();
        if (!previous) {
            toast('لا توجد عملية سابقة للتراجع عنها.');
            return;
        }
        restoreSnapshot(previous);
        toast(`تم التراجع. متبقي ${state.undoStack.length} خطوة في سجل التراجع.`);
    }

    function eligibleStudents() {
        if (state.scope !== 'visible') return state.students;
        return state.students.filter(student => !student.row.classList.contains('msa-row-hidden'));
    }

    function confirmBulk(statusDef, count) {
        if (!statusDef || statusDef.key === STATUS.PRESENT.key) return true;
        return window.confirm(
            `سيتم تعيين «${statusDef.label}» لـ ${count} طالب ضمن النطاق الحالي.\n\nهل تريد المتابعة؟`
        );
    }

    function bulkSet(statusDef, options = {}) {
        let targets = eligibleStudents();
        if (options.onlyUnset) {
            targets = targets.filter(student => readStudentStatus(student).kind === 'unset');
        }

        if (!targets.length) {
            toast(options.onlyUnset ? 'لا يوجد طلاب غير محددين ضمن النطاق الحالي.' : 'لا يوجد طلاب ضمن النطاق الحالي.');
            return;
        }

        if (!confirmBulk(statusDef, targets.length)) return;
        pushUndo();

        let success = 0;
        state.suspendUpdates = true;
        try {
            for (const student of targets) {
                if (setStudentStatus(student, statusDef)) success++;
            }
        } finally {
            state.suspendUpdates = false;
        }

        updateAll();
        toast(`تم تعيين «${statusDef.label}» لـ ${success} من ${targets.length} طالب.`);
    }

    function bulkClear() {
        const targets = eligibleStudents();
        if (!targets.length) {
            toast('لا يوجد طلاب ضمن النطاق الحالي.');
            return;
        }

        if (!window.confirm(`سيتم مسح تحديد الحضور لـ ${targets.length} طالب. هل تريد المتابعة؟`)) return;
        pushUndo();

        let changed = 0;
        state.suspendUpdates = true;
        try {
            for (const student of targets) {
                if (clearStudentStatus(student)) changed++;
            }
        } finally {
            state.suspendUpdates = false;
        }

        updateAll();
        toast(`تم مسح تحديد ${changed} طالب. لن تكون الحصة جاهزة للحفظ حتى تكتمل الحالات.`);
    }

    function stats() {
        const counts = {
            total: state.students.length,
            present: 0,
            absentExcused: 0,
            absentUnexcused: 0,
            lateExcused: 0,
            lateUnexcused: 0,
            absent: 0,
            late: 0,
            unset: 0,
            selected: 0
        };

        for (const student of state.students) {
            const status = readStudentStatus(student);
            if (status.key === STATUS.PRESENT.key) counts.present++;
            else if (status.key === STATUS.ABSENT_EXCUSED.key) counts.absentExcused++;
            else if (status.key === STATUS.ABSENT_UNEXCUSED.key) counts.absentUnexcused++;
            else if (status.key === STATUS.LATE_EXCUSED.key) counts.lateExcused++;
            else if (status.key === STATUS.LATE_UNEXCUSED.key) counts.lateUnexcused++;
            else counts.unset++;
        }

        counts.absent = counts.absentExcused + counts.absentUnexcused;
        counts.late = counts.lateExcused + counts.lateUnexcused;
        counts.selected = counts.total - counts.unset;
        return counts;
    }

    function statusLabel(status) {
        return STATUS_BY_KEY[status.key]?.label || 'غير محدد';
    }

    function studentsByFilter(filterKey) {
        return state.students.filter(student => {
            const status = readStudentStatus(student);
            if (filterKey === 'all') return true;
            if (filterKey === 'exceptions') return status.kind !== 'present';
            if (filterKey === 'absent') return status.kind === 'absent';
            if (filterKey === 'late') return status.kind === 'late';
            if (filterKey === 'unset') return status.kind === 'unset';
            return status.key === filterKey;
        });
    }

    function setFilter(filterKey) {
        state.filter = filterKey || 'all';
        const root = q(`#${APP_ID}`);
        if (root) {
            qa('[data-filter]', root).forEach(el => {
                el.classList.toggle('is-active', el.dataset.filter === state.filter);
            });
        }
        applyVisibility();
    }

    function updateStats() {
        const root = q(`#${APP_ID}`);
        if (!root) return;

        const c = stats();
        const map = {
            total: c.total,
            present: c.present,
            'absent-excused': c.absentExcused,
            'absent-unexcused': c.absentUnexcused,
            'late-excused': c.lateExcused,
            'late-unexcused': c.lateUnexcused,
            unset: c.unset
        };

        for (const [key, value] of Object.entries(map)) {
            const el = q(`[data-stat="${key}"] .msa-stat-value`, root);
            if (el) el.textContent = String(value);
        }

        const undoBtn = q('[data-action="undo"]', root);
        if (undoBtn) {
            undoBtn.disabled = !state.undoStack.length;
            undoBtn.textContent = state.undoStack.length
                ? `↶ تراجع (${state.undoStack.length})`
                : '↶ تراجع';
        }

        const ready = q('[data-role="ready"]', root);
        const readyMain = q('[data-role="ready-main"]', root);
        const readyCount = q('[data-role="ready-count"]', root);
        const progress = q('[data-role="progress"]', root);
        const pct = c.total ? Math.round((c.selected / c.total) * 100) : 0;

        if (ready) ready.classList.toggle('is-ready', c.unset === 0 && c.total > 0);
        if (readyMain) {
            readyMain.textContent = c.unset === 0
                ? '✓ الحضور مكتمل وجاهز للمراجعة والحفظ'
                : `باقي ${c.unset} طالب لم تحدد حالتهم`;
        }
        if (readyCount) readyCount.textContent = `${c.selected}/${c.total}`;
        if (progress) progress.style.width = `${pct}%`;

        for (const student of state.students) {
            const status = readStudentStatus(student);
            student.row.classList.remove(
                'msa-status-present', 'msa-status-absent', 'msa-status-late', 'msa-status-unset'
            );
            student.row.classList.add(`msa-status-${status.kind || 'unset'}`);
        }
    }

    function studentMatchesFilter(student) {
        const status = readStudentStatus(student);
        if (state.filter === 'all') return true;
        if (state.filter === 'exceptions') return status.kind !== 'present';
        if (state.filter === 'unset') return status.kind === 'unset';
        if (state.filter === 'present') return status.kind === 'present';
        if (state.filter === 'absent') return status.kind === 'absent';
        if (state.filter === 'late') return status.kind === 'late';
        return status.key === state.filter;
    }

    function applyVisibility() {
        const queryText = normalizeArabic(state.query);

        for (const student of state.students) {
            const matchesQuery =
                !queryText ||
                student.normalizedName.includes(queryText) ||
                String(student.studentId).includes(queryText);

            const visible = matchesQuery && studentMatchesFilter(student);
            student.row.classList.toggle('msa-row-hidden', !visible);
        }

        const visibleCount = state.students.filter(
            student => !student.row.classList.contains('msa-row-hidden')
        ).length;

        const hint = q(`#${APP_ID} [data-role="visible-hint"]`);
        if (hint) hint.textContent = `المعروض الآن: ${visibleCount} من ${state.students.length}`;
    }

    function statusRank(student, mode) {
        const kind = readStudentStatus(student).kind;
        const maps = {
            'priority': { unset: 0, absent: 1, late: 2, present: 3 },
            'unset-first': { unset: 0, absent: 1, late: 2, present: 3 },
            'absent-first': { absent: 0, late: 1, unset: 2, present: 3 },
            'late-first': { late: 0, absent: 1, unset: 2, present: 3 }
        };
        return maps[mode]?.[kind] ?? 9;
    }

    function applySort() {
        const mode = state.sort;
        let ordered = [...state.students];
        const ar = new Intl.Collator('ar', { sensitivity: 'base', numeric: true });

        if (mode === 'original') {
            ordered.sort((a, b) => a.originalOrder - b.originalOrder);
        } else if (mode === 'name-asc') {
            ordered.sort((a, b) => ar.compare(a.name, b.name));
        } else if (mode === 'name-desc') {
            ordered.sort((a, b) => ar.compare(b.name, a.name));
        } else if (['priority', 'unset-first', 'absent-first', 'late-first'].includes(mode)) {
            ordered.sort((a, b) => {
                const rank = statusRank(a, mode) - statusRank(b, mode);
                return rank || ar.compare(a.name, b.name);
            });
        }

        if (!state.sortParent) return;
        for (const student of ordered) state.sortParent.appendChild(student.row);
    }

    function updateAll() {
        updateStats();
        applyVisibility();
        if (['priority', 'unset-first', 'absent-first', 'late-first'].includes(state.sort)) applySort();
    }

    function toast(message) {
        const el = q(`#${APP_ID} [data-role="toast"]`);
        if (!el) return;
        el.textContent = message;
        el.classList.add('is-visible');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => el.classList.remove('is-visible'), 3800);
    }

    function cleanText(value = '') {
        return String(value).replace(/\s+/g, ' ').trim();
    }

    function escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function toEnglishDigits(value = '') {
        return String(value)
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            const area = document.createElement('textarea');
            area.value = text;
            area.style.position = 'fixed';
            area.style.opacity = '0';
            document.body.appendChild(area);
            area.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (_) {}
            area.remove();
            return ok;
        }
    }

    async function copyNames(filterKey) {
        const list = studentsByFilter(filterKey);
        if (!list.length) {
            toast('لا توجد أسماء في هذه الفئة.');
            return;
        }

        const label = filterKey === 'all'
            ? 'جميع الطلاب'
            : filterKey === 'unset'
                ? 'غير محدد'
                : filterKey === 'exceptions'
                    ? 'الاستثناءات'
                    : STATUS_BY_KEY[filterKey]?.label || filterKey;

        const text = `${label} (${list.length})\n${list.map(s => s.name).join('\n')}`;
        const ok = await copyText(text);
        toast(ok ? `تم نسخ ${list.length} اسم من فئة «${label}».` : 'تعذر النسخ إلى الحافظة.');
    }

    function textFragments(root) {
        if (!root) return [];

        const out = [];
        const seen = new Set();
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;

        while ((node = walker.nextNode())) {
            const parent = node.parentElement;
            if (!parent) continue;
            if (parent.closest(`#${APP_ID}, .msa-report-overlay, script, style, noscript`)) continue;
            if (parent.closest('a, button')) continue;

            const text = cleanText(node.nodeValue || '');
            if (!text || text.length > 120 || seen.has(text)) continue;
            seen.add(text);
            out.push(text);
        }

        return out;
    }

    function isVisibleElement(el) {
        if (!el || !document.contains(el)) return false;
        if (el.type === 'hidden') return false;
        const style = getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }

    function elementReadableValue(el) {
        if (!el) return '';

        if (el.tagName === 'SELECT') {
            return cleanText(el.selectedOptions?.[0]?.textContent || '');
        }

        if (el.matches?.('input, textarea')) {
            const value = cleanText(el.value || '');
            if (value && !/^\d+$/.test(toEnglishDigits(value))) return value;
            return '';
        }

        return cleanText(el.innerText || el.textContent || '');
    }

    function firstReadable(selectors, root = document) {
        for (const selector of selectors) {
            const elements = qa(selector, root);
            for (const el of elements) {
                const value = elementReadableValue(el);
                if (value) return value;
            }
        }
        return '';
    }

    function optionTextForValue(value, selectors = ['select']) {
        if (!value) return '';
        const wanted = String(value);

        for (const selector of selectors) {
            for (const select of qa(selector)) {
                if (select.tagName !== 'SELECT') continue;
                const option = [...select.options].find(opt => String(opt.value) === wanted);
                const text = cleanText(option?.textContent || '');
                if (text && text !== wanted) return text;
            }
        }
        return '';
    }

    function lectureLabel(value) {
        const id = toEnglishDigits(value || '').trim();
        const labels = {
            '1': 'الحصة الأولى',
            '2': 'الحصة الثانية',
            '3': 'الحصة الثالثة',
            '4': 'الحصة الرابعة',
            '5': 'الحصة الخامسة',
            '6': 'الحصة السادسة',
            '7': 'الحصة السابعة',
            '8': 'الحصة الثامنة',
            '9': 'الحصة التاسعة',
            '10': 'الحصة العاشرة'
        };
        return labels[id] || (id ? `الحصة ${id}` : '');
    }

    function formatGregorianDate(value = '') {
        const raw = toEnglishDigits(cleanText(value));
        if (!raw) return '';

        const direct = raw.match(/\b(20\d{2})[\/-](\d{1,2})[\/-](\d{1,2})\b/);
        if (direct) {
            const [, y, m, d] = direct;
            return `${y}/${m.padStart(2, '0')}/${d.padStart(2, '0')}`;
        }

        // .NET ticks: 100ns since 0001-01-01. Madrasati uses this in dateTicks/dateAttend.
        const digits = raw.replace(/\D/g, '');
        if (digits.length >= 16 && typeof BigInt === 'function') {
            try {
                const ticks = BigInt(digits);
                const unixEpochTicks = 621355968000000000n;
                if (ticks > unixEpochTicks) {
                    const ms = Number((ticks - unixEpochTicks) / 10000n);
                    const date = new Date(ms);
                    if (!Number.isNaN(date.getTime())) {
                        const y = date.getUTCFullYear();
                        const m = String(date.getUTCMonth() + 1).padStart(2, '0');
                        const d = String(date.getUTCDate()).padStart(2, '0');
                        return `${y}/${m}/${d}`;
                    }
                }
            } catch (_) {}
        }

        return raw;
    }

    function extractDateHeader() {
        const anchors = [q('#btnPrevious'), q('#btnNext')].filter(Boolean);
        for (const anchor of anchors) {
            let node = anchor.parentElement;
            for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
                const text = cleanText(node.innerText || node.textContent || '');
                if (!text) continue;

                const day = text.match(/(الأحد|الاثنين|الإثنين|الثلاثاء|الأربعاء|الخميس|الجمعة|السبت)/)?.[1] || '';
                const dates = [...text.matchAll(/\b(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})\b/g)]
                    .map(m => `${m[1]}/${m[2].padStart(2, '0')}/${m[3].padStart(2, '0')}`);

                if (day || dates.length) {
                    const hijriDate = dates.find(x => Number(x.slice(0, 4)) < 1900) || '';
                    const gregorianDate = dates.find(x => Number(x.slice(0, 4)) >= 1900) || '';
                    return { day, hijriDate, gregorianDate };
                }
            }
        }
        return { day: '', hijriDate: '', gregorianDate: '' };
    }

    function extractLessonPaneMeta(params) {
        const pane =
            state.table?.closest('.tab-pane') ||
            q('.tabs-container .tab-pane.show.active') ||
            q('.tabs-container .tab-pane.active') ||
            q('.hijriSchedule .tab-pane.show.active') ||
            q('.hijriSchedule .tab-pane.active');

        const eventTitle = q('.event-title', pane || document);
        const root = eventTitle || pane;
        const fragments = textFragments(root);

        const actionPhrases = new Set([
            'الحضور والتحفيز',
            'طباعة الدرس',
            'مشاهدة تفاصيل الدرس',
            'الجدول الدراسي'
        ]);

        let lecture = firstReadable([
            '.event-title .title',
            '.tab-pane.show.active .title',
            '.tab-pane.active .title'
        ], pane || document);

        if (!/^الحصة\b/.test(lecture)) {
            lecture = fragments.find(text => /^الحصة\b/.test(text)) || lectureLabel(params.get('lectureId'));
        }

        const timePattern = /\b\d{1,2}:\d{2}\s*[صم]\s*[-–—]\s*\d{1,2}:\d{2}\s*[صم]\b/;
        let time = fragments.find(text => timePattern.test(toEnglishDigits(text))) || '';
        if (time) {
            const match = toEnglishDigits(time).match(timePattern);
            if (match) time = match[0];
        }

        const leftovers = fragments.filter(text => {
            if (!text || actionPhrases.has(text)) return false;
            if (lecture && text === lecture) return false;
            if (/^الحصة\b/.test(text)) return false;
            if (timePattern.test(toEnglishDigits(text))) return false;
            if (/^(حفظ|إغلاق|السابق|التالي)$/.test(text)) return false;
            if (/^\d+$/.test(toEnglishDigits(text))) return false;
            return text.length <= 80;
        });

        const classroomPattern = /(ابتدائي|متوسط|ثانوي|الصف|فصل|شعبة|روضة|تمهيدي)/;
        let classroom = leftovers.find(text => classroomPattern.test(text)) || '';
        let subject = leftovers.find(text => text !== classroom) || '';

        // Fallback for layouts where subject/classroom/time are emitted as one text node.
        if ((!subject || !classroom) && root) {
            let combined = cleanText(root.innerText || root.textContent || '');
            for (const phrase of actionPhrases) combined = combined.replaceAll(phrase, ' ');
            if (lecture) combined = combined.replace(lecture, ' ');
            if (time) combined = combined.replace(time, ' ');
            combined = cleanText(combined);

            const classMatch = combined.match(
                /((?:الأول|الثاني|الثالث|الرابع|الخامس|السادس|أول|ثاني|ثالث|رابع|خامس|سادس)\s+(?:ابتدائي|متوسط|ثانوي)(?:\s+[^\s]+){0,2})$/
            );

            if (classMatch) {
                if (!classroom) classroom = cleanText(classMatch[1]);
                if (!subject) subject = cleanText(combined.slice(0, classMatch.index));
            }
        }

        // Fallbacks from selects/options when Madrasati changes the event-title markup.
        if (!subject) {
            subject = firstReadable([
                '#subjectId', '#SubjectId',
                'select[name="subjectId"]', 'select[name="SubjectId"]',
                '[data-subject-name]'
            ]);
        }
        if (!subject || /^\d+$/.test(toEnglishDigits(subject))) {
            subject = optionTextForValue(params.get('subjectId'), [
                '#subjectId', '#SubjectId',
                'select[name="subjectId"]', 'select[name="SubjectId"]',
                'select'
            ]);
        }

        if (!classroom) {
            classroom = firstReadable([
                '#classroomId', '#ClassroomId', '#ClassRoomId',
                'select[name="classroomId"]', 'select[name="ClassroomId"]', 'select[name="ClassRoomId"]',
                '[data-classroom-name]'
            ]);
        }
        if (!classroom || /^\d+$/.test(toEnglishDigits(classroom))) {
            classroom = optionTextForValue(params.get('classroomId'), [
                '#classroomId', '#ClassroomId', '#ClassRoomId',
                'select[name="classroomId"]', 'select[name="ClassroomId"]', 'select[name="ClassRoomId"]',
                'select'
            ]);
        }

        // If exactly two meaningful fragments remain, Madrasati's current order is subject then classroom.
        if ((!subject || !classroom) && leftovers.length >= 2) {
            if (!subject) subject = leftovers[0];
            if (!classroom) classroom = leftovers.find((x, i) => i > 0 && x !== subject) || leftovers[1];
        }

        return {
            pane,
            lecture: cleanText(lecture),
            subject: cleanText(subject),
            classroom: cleanText(classroom),
            time: cleanText(time)
        };
    }

    function getSessionMeta() {
        const params = new URLSearchParams(location.search);
        const paneMeta = extractLessonPaneMeta(params);
        const headerDate = extractDateHeader();

        // studentAttendDate is the readable date supplied by Madrasati.
        // dateAttend/dateTicks are .NET ticks and are used only as fallbacks.
        const readableDateInput =
            q('[name="studentAttendDate"]', state.table || document) ||
            q('[name="studentAttendDate"]');
        const ticksInput =
            q('[name="dateAttend"]', state.table || document) ||
            q('[name="dateAttend"]');

        const date =
            formatGregorianDate(readableDateInput?.value || '') ||
            headerDate.gregorianDate ||
            formatGregorianDate(params.get('dateTicks') || ticksInput?.value || '');

        const day = headerDate.day;
        const hijriDate = headerDate.hijriDate;

        return {
            pageTitle: document.title || 'مدرستي',
            lecture: paneMeta.lecture || lectureLabel(params.get('lectureId')),
            subject: paneMeta.subject,
            classroom: paneMeta.classroom,
            time: paneMeta.time,
            date,
            day,
            hijriDate,
            lectureId: params.get('lectureId') || '',
            subjectId: params.get('subjectId') || '',
            classroomId: params.get('classroomId') || '',
            generatedAt: new Date().toLocaleString('en-GB', {
                year: 'numeric', month: '2-digit', day: '2-digit',
                hour: '2-digit', minute: '2-digit'
            })
        };
    }

    function reportData() {
        const groups = {
            present: [],
            'absent-excused': [],
            'absent-unexcused': [],
            'late-excused': [],
            'late-unexcused': [],
            unset: []
        };

        for (const student of state.students) {
            const status = readStudentStatus(student);
            const key = status.key in groups ? status.key : 'unset';
            groups[key].push(student);
        }

        return { meta: getSessionMeta(), counts: stats(), groups };
    }

    function textReport(forWhatsApp = false) {
        const data = reportData();
        const c = data.counts;
        const lines = [];

        lines.push('📋 تقرير حضور الحصة');
        if (data.meta.lecture) lines.push(`الحصة: ${data.meta.lecture}`);
        if (data.meta.subject) lines.push(`المادة: ${data.meta.subject}`);
        if (data.meta.classroom) lines.push(`الفصل: ${data.meta.classroom}`);
        if (data.meta.time) lines.push(`الوقت: ${data.meta.time}`);
        if (data.meta.date) lines.push(`التاريخ: ${[data.meta.day, data.meta.date].filter(Boolean).join(' — ')}`);
        if (data.meta.hijriDate) lines.push(`التاريخ الهجري: ${data.meta.hijriDate}`);
        lines.push(`الإجمالي: ${c.total} | حاضر: ${c.present} | غائب: ${c.absent} | متأخر: ${c.late} | غير محدد: ${c.unset}`);

        const sections = [
            [STATUS.ABSENT_EXCUSED.key, 'غائب بعذر'],
            [STATUS.ABSENT_UNEXCUSED.key, 'غائب بدون عذر'],
            [STATUS.LATE_EXCUSED.key, 'متأخر بعذر'],
            [STATUS.LATE_UNEXCUSED.key, 'متأخر بدون عذر'],
            ['unset', 'غير محدد']
        ];

        for (const [key, label] of sections) {
            const list = data.groups[key];
            if (!list.length) continue;
            lines.push('');
            lines.push(`${forWhatsApp ? '• ' : ''}${label} (${list.length}):`);
            list.forEach((student, i) => lines.push(`${i + 1}. ${student.name}`));
        }

        lines.push('');
        lines.push('— التحضير الذكي لمدرستي');
        return lines.join('\n');
    }

    function csvEscape(value) {
        const text = String(value ?? '');
        return `"${text.replace(/"/g, '""')}"`;
    }

    function exportCsv() {
        const meta = getSessionMeta();
        const rows = [];

        if (meta.lecture) rows.push(['الحصة', meta.lecture]);
        if (meta.subject) rows.push(['المادة', meta.subject]);
        if (meta.classroom) rows.push(['الفصل', meta.classroom]);
        if (meta.time) rows.push(['الوقت', meta.time]);
        if (meta.date) rows.push(['التاريخ', [meta.day, meta.date].filter(Boolean).join(' - ')]);
        if (meta.hijriDate) rows.push(['التاريخ الهجري', meta.hijriDate]);
        if (rows.length) rows.push([]);

        rows.push(['#', 'اسم الطالب', 'رقم الطالب', 'حالة الحضور']);
        state.students.forEach((student, i) => {
            rows.push([
                i + 1,
                student.name,
                student.studentId,
                statusLabel(readStudentStatus(student))
            ]);
        });

        const csv = '\ufeff' + rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const safeDate = (meta.date || new Date().toISOString().slice(0, 10)).replace(/\//g, '-');
        a.download = `madrasati-attendance-${safeDate}.csv`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        toast('تم إنشاء ملف CSV للحصة الحالية مع بيانات الحصة.');
    }

    function reportHtmlBody() {
        const data = reportData();
        const sections = [
            [STATUS.PRESENT.key, 'حاضر'],
            [STATUS.ABSENT_EXCUSED.key, 'غائب بعذر'],
            [STATUS.ABSENT_UNEXCUSED.key, 'غائب بدون عذر'],
            [STATUS.LATE_EXCUSED.key, 'متأخر بعذر'],
            [STATUS.LATE_UNEXCUSED.key, 'متأخر بدون عذر'],
            ['unset', 'غير محدد']
        ];

        const groupsHtml = sections.map(([key, label]) => {
            const list = data.groups[key] || [];
            return `
                <section class="msa-report-group">
                    <h4>${escapeHtml(label)} (${list.length})</h4>
                    ${list.length
                        ? `<ol>${list.map(s => `<li>${escapeHtml(s.name)}</li>`).join('')}</ol>`
                        : '<div class="msa-report-empty">لا يوجد طلاب</div>'}
                </section>`;
        }).join('');

        const c = data.counts;
        return `
            <div class="msa-report-meta">
                <div class="msa-report-meta-grid">
                    ${data.meta.lecture ? `<div class="msa-report-meta-item"><span>الحصة</span><b>${escapeHtml(data.meta.lecture)}</b></div>` : ''}
                    ${data.meta.subject ? `<div class="msa-report-meta-item"><span>المادة</span><b>${escapeHtml(data.meta.subject)}</b></div>` : ''}
                    ${data.meta.classroom ? `<div class="msa-report-meta-item"><span>الفصل</span><b>${escapeHtml(data.meta.classroom)}</b></div>` : ''}
                    ${data.meta.time ? `<div class="msa-report-meta-item"><span>وقت الحصة</span><b>${escapeHtml(data.meta.time)}</b></div>` : ''}
                    ${data.meta.date ? `<div class="msa-report-meta-item"><span>التاريخ</span><b>${escapeHtml([data.meta.day, data.meta.date].filter(Boolean).join(' — '))}</b></div>` : ''}
                    ${data.meta.hijriDate ? `<div class="msa-report-meta-item"><span>التاريخ الهجري</span><b>${escapeHtml(data.meta.hijriDate)}</b></div>` : ''}
                    <div class="msa-report-meta-item"><span>وقت إنشاء التقرير</span><b>${escapeHtml(data.meta.generatedAt)}</b></div>
                </div>
            </div>
            <div class="msa-report-summary">
                <div><span>الإجمالي</span><b>${c.total}</b></div>
                <div><span>حاضر</span><b>${c.present}</b></div>
                <div><span>غائب</span><b>${c.absent}</b></div>
                <div><span>متأخر</span><b>${c.late}</b></div>
                <div><span>غير محدد</span><b>${c.unset}</b></div>
                <div><span>مكتمل</span><b>${c.selected}/${c.total}</b></div>
            </div>
            <div class="msa-report-groups">${groupsHtml}</div>`;
    }

    function printReport() {
        const win = window.open('', '_blank', 'width=980,height=760');
        if (!win) {
            toast('منع المتصفح نافذة الطباعة. اسمح بالنوافذ المنبثقة ثم أعد المحاولة.');
            return;
        }

        win.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>تقرير حضور الحصة</title>
<style>
body{font-family:Arial,Tahoma,sans-serif;color:#172033;margin:28px;direction:rtl}h1{font-size:22px;margin:0 0 8px}.meta{font-size:12px;color:#64748b;margin-bottom:14px}.summary{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:14px 0}.summary div{border:1px solid #dfe5ea;border-radius:8px;padding:8px;text-align:center}.summary b{display:block;font-size:20px}.groups{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.group{border:1px solid #dfe5ea;border-radius:9px;padding:10px;break-inside:avoid}.group h3{font-size:14px;margin:0 0 6px}.group ol{margin:0;padding-inline-start:22px}.group li{font-size:12px;margin:3px 0}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #ddd;font-size:10px;color:#64748b}@media print{body{margin:12mm}.no-print{display:none}.summary{grid-template-columns:repeat(6,1fr)}}
</style></head><body>`);

        const data = reportData();
        const c = data.counts;
        win.document.write(`<h1>تقرير حضور الحصة${data.meta.lecture ? ` — ${escapeHtml(data.meta.lecture)}` : ''}</h1>`);
        const printMeta = [
            data.meta.subject ? `المادة: ${data.meta.subject}` : '',
            data.meta.classroom ? `الفصل: ${data.meta.classroom}` : '',
            data.meta.time ? `الوقت: ${data.meta.time}` : '',
            data.meta.date ? `التاريخ: ${[data.meta.day, data.meta.date].filter(Boolean).join(' — ')}` : '',
            data.meta.hijriDate ? `الهجري: ${data.meta.hijriDate}` : ''
        ].filter(Boolean).map(escapeHtml).join(' &nbsp; | &nbsp; ');
        win.document.write(`<div class="meta">${printMeta}${printMeta ? '<br>' : ''}تم الإنشاء: ${escapeHtml(data.meta.generatedAt)}</div>`);
        win.document.write(`<div class="summary"><div>الإجمالي<b>${c.total}</b></div><div>حاضر<b>${c.present}</b></div><div>غائب<b>${c.absent}</b></div><div>متأخر<b>${c.late}</b></div><div>غير محدد<b>${c.unset}</b></div><div>مكتمل<b>${c.selected}/${c.total}</b></div></div>`);

        const sections = [
            [STATUS.PRESENT.key, 'حاضر'],
            [STATUS.ABSENT_EXCUSED.key, 'غائب بعذر'],
            [STATUS.ABSENT_UNEXCUSED.key, 'غائب بدون عذر'],
            [STATUS.LATE_EXCUSED.key, 'متأخر بعذر'],
            [STATUS.LATE_UNEXCUSED.key, 'متأخر بدون عذر'],
            ['unset', 'غير محدد']
        ];
        win.document.write('<div class="groups">');
        for (const [key, label] of sections) {
            const list = data.groups[key] || [];
            win.document.write(`<section class="group"><h3>${escapeHtml(label)} (${list.length})</h3>${list.length ? `<ol>${list.map(s => `<li>${escapeHtml(s.name)}</li>`).join('')}</ol>` : '<small>لا يوجد طلاب</small>'}</section>`);
        }
        win.document.write('</div>');
        win.document.write(`<div class="footer">Madrasati Smart Attendance — M0HM3D85 — © 2026</div>`);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => win.print(), 250);
    }

    function closeReport() {
        q('.msa-report-overlay')?.remove();
    }

    function openReport() {
        closeReport();
        const overlay = document.createElement('div');
        overlay.className = 'msa-report-overlay';
        overlay.innerHTML = `
            <div class="msa-report-dialog" role="dialog" aria-modal="true" aria-label="تقرير حضور الحصة">
                <div class="msa-report-head">
                    <h3>📋 تقرير حضور الحصة</h3>
                    <div class="msa-report-actions">
                        <button type="button" data-report-action="copy">نسخ التقرير</button>
                        <button type="button" data-report-action="whatsapp">نسخ للواتساب</button>
                        <button type="button" data-report-action="csv">CSV</button>
                        <button type="button" data-report-action="print">طباعة / PDF</button>
                        <button type="button" data-report-action="close">✕ إغلاق</button>
                    </div>
                </div>
                <div class="msa-report-content">${reportHtmlBody()}</div>
            </div>`;

        overlay.addEventListener('click', async event => {
            if (event.target === overlay) return closeReport();
            const action = event.target.closest('[data-report-action]')?.dataset.reportAction;
            if (!action) return;
            if (action === 'close') closeReport();
            if (action === 'csv') exportCsv();
            if (action === 'print') printReport();
            if (action === 'copy') {
                const ok = await copyText(textReport(false));
                toast(ok ? 'تم نسخ تقرير الحصة.' : 'تعذر نسخ التقرير.');
            }
            if (action === 'whatsapp') {
                const ok = await copyText(textReport(true));
                toast(ok ? 'تم نسخ ملخص واتساب جاهز للإرسال.' : 'تعذر نسخ الملخص.');
            }
        });

        document.body.appendChild(overlay);
    }

    function focusNextUnset() {
        const student = state.students.find(s => readStudentStatus(s).kind === 'unset');
        if (!student) {
            toast('جميع الطلاب محددة حالاتهم.');
            return;
        }
        setFilter('unset');
        student.row.classList.add('msa-focus-row');
        student.row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => student.row.classList.remove('msa-focus-row'), 1800);
    }

    function buildToolbar() {
        const root = document.createElement('section');
        root.id = APP_ID;
        root.setAttribute('aria-label', 'أدوات التحضير الذكي');
        root.innerHTML = `
            <div class="msa-head">
                <div class="msa-title-wrap">
                    <div class="msa-title">⚡ التحضير الذكي لمدرستي</div>
                    <small data-role="mode-label">أدوات مساعدة داخل صفحة التحضير</small>
                </div>
                <div class="msa-head-actions">
                    <button type="button" class="msa-report-btn" data-action="report">📋 تقرير الحصة</button>
                    <button type="button" data-action="toggle-panel">طي الأدوات</button>
                </div>
            </div>

            <div class="msa-body">
                <div class="msa-stats">
                    <div class="msa-stat-card" data-filter="all" data-stat="total">
                        <span class="msa-stat-label">جميع الطلاب</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="all">نسخ</button>
                    </div>
                    <div class="msa-stat-card" data-filter="present" data-stat="present">
                        <span class="msa-stat-label">حاضر</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="present">نسخ</button>
                    </div>
                    <div class="msa-stat-card" data-filter="absent-excused" data-stat="absent-excused">
                        <span class="msa-stat-label">غائب بعذر</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="absent-excused">نسخ</button>
                    </div>
                    <div class="msa-stat-card" data-filter="absent-unexcused" data-stat="absent-unexcused">
                        <span class="msa-stat-label">غائب بدون عذر</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="absent-unexcused">نسخ</button>
                    </div>
                    <div class="msa-stat-card" data-filter="late-excused" data-stat="late-excused">
                        <span class="msa-stat-label">متأخر بعذر</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="late-excused">نسخ</button>
                    </div>
                    <div class="msa-stat-card" data-filter="late-unexcused" data-stat="late-unexcused">
                        <span class="msa-stat-label">متأخر بدون عذر</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="late-unexcused">نسخ</button>
                    </div>
                    <div class="msa-stat-card" data-filter="unset" data-stat="unset">
                        <span class="msa-stat-label">غير محدد</span><span class="msa-stat-value">0</span>
                        <button class="msa-stat-copy" type="button" data-copy-filter="unset">نسخ</button>
                    </div>
                </div>

                <div class="msa-ready" data-role="ready" title="اضغط لعرض الطلاب غير المحددين">
                    <span class="msa-ready-main" data-role="ready-main">جاري فحص الحالات...</span>
                    <span class="msa-progress"><i data-role="progress"></i></span>
                    <span class="msa-ready-count" data-role="ready-count">0/0</span>
                </div>

                <div class="msa-row">
                    <button type="button" class="msa-primary" data-action="all-present">✓ تحضير الكل حاضر</button>
                    <button type="button" class="msa-secondary" data-action="unset-present">✓ غير المحددين ← حاضر</button>

                    <select data-role="bulk-status" aria-label="حالة جماعية">
                        <option value="present">حاضر</option>
                        <option value="absent-excused">غائب بعذر</option>
                        <option value="absent-unexcused">غائب بدون عذر</option>
                        <option value="late-excused">متأخر بعذر</option>
                        <option value="late-unexcused">متأخر بدون عذر</option>
                    </select>
                    <button type="button" data-action="apply-bulk">تطبيق الحالة</button>
                    <button type="button" class="msa-soft-danger" data-action="clear">مسح التحديد</button>
                    <button type="button" data-action="undo" disabled>↶ تراجع</button>

                    <span class="msa-spacer"></span>
                    <span class="msa-scope-group" aria-label="نطاق التطبيق">
                        <button type="button" class="msa-scope-btn is-active" data-scope="all">كل الطلاب</button>
                        <button type="button" class="msa-scope-btn" data-scope="visible">الظاهر فقط</button>
                    </span>
                </div>

                <div class="msa-row">
                    <input type="search" data-role="search" placeholder="ابحث باسم الطالب أو رقمه..." autocomplete="off">
                    <select data-role="sort" aria-label="فرز الطلاب">
                        <option value="original">الترتيب الأصلي</option>
                        <option value="priority">الأولوية: غير محدد ← غائب ← متأخر ← حاضر</option>
                        <option value="name-asc">الاسم: أ ← ي</option>
                        <option value="name-desc">الاسم: ي ← أ</option>
                        <option value="unset-first">غير المحددين أولاً</option>
                        <option value="absent-first">الغائبون أولاً</option>
                        <option value="late-first">المتأخرون أولاً</option>
                    </select>
                </div>

                <div class="msa-row">
                    <button type="button" class="msa-filter is-active" data-filter="all">الكل</button>
                    <button type="button" class="msa-filter" data-filter="exceptions">الاستثناءات</button>
                    <button type="button" class="msa-filter" data-filter="unset">غير محدد</button>
                    <button type="button" class="msa-filter" data-filter="present">حاضر</button>
                    <button type="button" class="msa-filter" data-filter="absent">كل الغياب</button>
                    <button type="button" class="msa-filter" data-filter="late">كل التأخر</button>
                    <span class="msa-spacer"></span>
                    <button type="button" data-action="next-unset">التالي غير المحدد</button>
                    <span class="msa-hint" data-role="visible-hint"></span>
                </div>

                <div class="msa-row">
                    <span class="msa-hint" data-role="save-hint"></span>
                    <span class="msa-spacer"></span>
                    <span class="msa-shortcuts">اختصارات: / بحث · Alt+A تحضير الكل · Alt+Z تراجع · Alt+N التالي غير المحدد</span>
                </div>

                <div class="msa-credit">تطوير: <strong>M0HM3D85</strong> — © 2026 جميع الحقوق محفوظة</div>
                <div class="msa-toast" data-role="toast"></div>
            </div>`;
        return root;
    }

    function insertToolbar(root) {
        if (state.table) {
            const responsive =
                state.table.closest('.dga-table.table-responsive') ||
                state.table.closest('.table-responsive') ||
                state.table.parentElement;

            if (responsive?.parentElement) {
                responsive.parentElement.insertBefore(root, responsive);
                return;
            }
        }

        const firstRow = state.students[0]?.row;
        const parent = firstRow?.parentElement;

        if (parent?.parentElement) {
            parent.parentElement.insertBefore(root, parent);
            return;
        }

        if (state.form) {
            state.form.insertBefore(root, state.form.firstChild);
            return;
        }

        document.body.prepend(root);
    }

    function updateModeUi(root) {
        const modeLabel = q('[data-role="mode-label"]', root);
        const saveHint = q('[data-role="save-hint"]', root);

        if (state.mode === 'row-save') {
            if (modeLabel) modeLabel.textContent = 'وضع تعديل حضور محفوظ — كل صف له حفظ مستقل في مدرستي';
            if (saveHint) saveHint.textContent = 'تنبيه: في هذا الوضع تغيّر الأدوات الحالات جماعيًا، لكن مدرستي قد تتطلب حفظ كل صف وفق آليتها الأصلية.';
        } else {
            if (modeLabel) modeLabel.textContent = 'وضع التحضير الجماعي الأولي';
            if (saveHint) saveHint.textContent = 'بعد المراجعة استخدم زر «حفظ» الأصلي في مدرستي.';
        }
    }

    function bindToolbar(root) {
        q('[data-action="all-present"]', root).addEventListener('click', () => bulkSet(STATUS.PRESENT));
        q('[data-action="unset-present"]', root).addEventListener('click', () => bulkSet(STATUS.PRESENT, { onlyUnset: true }));

        q('[data-action="apply-bulk"]', root).addEventListener('click', () => {
            const key = q('[data-role="bulk-status"]', root).value;
            const statusDef = STATUS_BY_KEY[key];
            if (statusDef) bulkSet(statusDef);
        });

        q('[data-action="clear"]', root).addEventListener('click', bulkClear);
        q('[data-action="undo"]', root).addEventListener('click', undoLast);
        q('[data-action="report"]', root).addEventListener('click', openReport);
        q('[data-action="next-unset"]', root).addEventListener('click', focusNextUnset);

        q('[data-action="toggle-panel"]', root).addEventListener('click', event => {
            state.collapsed = !state.collapsed;
            root.classList.toggle('is-collapsed', state.collapsed);
            event.currentTarget.textContent = state.collapsed ? 'إظهار الأدوات' : 'طي الأدوات';
        });

        q('[data-role="ready"]', root).addEventListener('click', () => {
            const c = stats();
            if (c.unset) setFilter('unset');
            else setFilter('exceptions');
        });

        qa('[data-scope]', root).forEach(button => {
            button.addEventListener('click', () => {
                state.scope = button.dataset.scope === 'visible' ? 'visible' : 'all';
                qa('[data-scope]', root).forEach(btn => btn.classList.toggle('is-active', btn === button));
                toast(state.scope === 'visible' ? 'العمليات الجماعية ستطبق على الصفوف الظاهرة فقط.' : 'العمليات الجماعية ستطبق على كل الطلاب.');
            });
        });

        q('[data-role="search"]', root).addEventListener('input', event => {
            state.query = event.target.value || '';
            applyVisibility();
        });

        q('[data-role="sort"]', root).addEventListener('change', event => {
            state.sort = event.target.value;
            applySort();
            applyVisibility();
        });

        qa('[data-filter]', root).forEach(element => {
            element.addEventListener('click', event => {
                if (event.target.closest('[data-copy-filter]')) return;
                setFilter(element.dataset.filter || 'all');
            });
        });

        qa('[data-copy-filter]', root).forEach(button => {
            button.addEventListener('click', event => {
                event.stopPropagation();
                copyNames(button.dataset.copyFilter || 'all');
            });
        });

        const eventRoot = state.eventRoot || state.form || document;
        if (!boundEventRoots.has(eventRoot)) {
            boundEventRoots.add(eventRoot);
            eventRoot.addEventListener('change', event => {
                if (state.suspendUpdates) return;
                if (
                    event.target.matches?.('input[type="radio"][name^="Attend["]') ||
                    event.target.matches?.('input[type="radio"][name^="List["][name$=".AttendStatusId"]')
                ) updateAll();
            });
        }
    }

    function bindKeyboardShortcuts() {
        if (document.documentElement.dataset.msaKeyboardBound === '1') return;
        document.documentElement.dataset.msaKeyboardBound = '1';

        document.addEventListener('keydown', event => {
            if (!q(`#${APP_ID}`)) return;
            const target = event.target;
            const typing = target?.matches?.('input, textarea, select, [contenteditable="true"]');

            if (!typing && event.key === '/') {
                event.preventDefault();
                q(`#${APP_ID} [data-role="search"]`)?.focus();
                return;
            }

            if (typing || !event.altKey || event.ctrlKey || event.metaKey) return;
            const key = String(event.key).toLowerCase();
            if (key === 'a') {
                event.preventDefault();
                bulkSet(STATUS.PRESENT);
            } else if (key === 'z') {
                event.preventDefault();
                undoLast();
            } else if (key === 'n') {
                event.preventDefault();
                focusNextUnset();
            }
        });
    }

    function init() {
        const context = detectContext();
        if (!context) return false;

        const oldRoot = q(`#${APP_ID}`);
        const sameRows =
            state.students.length === context.students.length &&
            state.students.every((oldStudent, i) =>
                oldStudent.row === context.students[i]?.row && document.contains(oldStudent.row)
            );

        const sameContext =
            oldRoot && document.contains(oldRoot) && state.contextKey === context.contextKey && sameRows;

        if (sameContext) return true;
        if (oldRoot) oldRoot.remove();

        state = {
            ...state,
            ...context,
            originalOrder: context.students.map(s => s.index),
            undoStack: [],
            filter: 'all',
            query: '',
            sort: 'original',
            scope: 'all',
            collapsed: false,
            suspendUpdates: false
        };

        injectStyle();
        const root = buildToolbar();
        insertToolbar(root);
        bindToolbar(root);
        bindKeyboardShortcuts();
        updateModeUi(root);
        updateAll();

        console.info(
            `[Madrasati Smart Attendance v0.3.2] جاهز — تم اكتشاف ${state.students.length} طالب.`,
            {
                mode: state.mode,
                lectureId: new URLSearchParams(location.search).get('lectureId'),
                subjectId: new URLSearchParams(location.search).get('subjectId'),
                classroomId: new URLSearchParams(location.search).get('classroomId'),
                form: state.form?.id || state.form?.action || '(بدون form محدد)',
                sortable: Boolean(state.sortParent)
            }
        );
        return true;
    }

    // تشغيل أولي.
    init();

    // صفحة ManageLecture تستخدم تحميلًا جزئيًا للحضور، لذلك نراقب ظهور/استبدال النموذج.
    let observerTimer = null;
    const observer = new MutationObserver(() => {
        clearTimeout(observerTimer);
        observerTimer = setTimeout(init, 180);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // بعض تنقلات مدرستي تغير الرابط/محتوى الحصة دون إعادة تحميل الصفحة بالكامل.
    let lastHref = location.href;
    setInterval(() => {
        if (location.href !== lastHref) {
            lastHref = location.href;
            setTimeout(init, 100);
            setTimeout(init, 500);
        }
    }, 500);

})();
