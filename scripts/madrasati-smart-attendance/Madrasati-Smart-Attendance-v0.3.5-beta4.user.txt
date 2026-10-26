// ==UserScript==
// @name         Madrasati Smart Attendance | التحضير الذكي لمدرستي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.3.5-beta4
// @description  نسخة اختبارية: استيراد حضور Excel/CSV مع ربط الطلاب بالبريد عبر دليل مدرستي، مراجعة تفصيلية للحالات غير المطابقة، وتحويل المتأخر إلى حاضر في الواجهة الحديثة.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/SchoolSchedule/Schedule/ManageLecture*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js
// @run-at       document-idle
// @noframes
// @downloadURL  https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/msa-v0.3.5-beta4-status-normalization/scripts/madrasati-smart-attendance/madrasati-smart-attendance.user.js
// @updateURL    https://raw.githubusercontent.com/M0HM3D85/teacher-userscripts/msa-v0.3.5-beta4-status-normalization/scripts/madrasati-smart-attendance/madrasati-smart-attendance.user.js
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
        version: '0.3.5-beta4',
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

    const ATTENDANCE_IMPORT_STORAGE_KEY = 'msa-attendance-import-v1';
    const ATTENDANCE_IMPORT_DATA_VERSION = 2;
    const ATTENDANCE_IMPORT_MAX_ROWS = 30000;
    const ATTENDANCE_IMPORT_STORAGE_SOFT_LIMIT = 4200000;
    const ATTENDANCE_REGISTRY_STORAGE_KEY = 'msa-attendance-student-registry-v1';
    const ATTENDANCE_IDENTITY_BRIDGE_KEY = 'msa-attendance-identity-bridge-v1';
    const ASSIGNMENT_REGISTRY_COMPAT_KEY = 'MAI_STUDENT_REGISTRY_V2';
    const ATTENDANCE_REGISTRY_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

    let attendanceImport = {
        loaded: false,
        dataset: null,
        index: null,
        currentMatch: null,
        lastSignature: '',
        lastError: '',
        lastApply: null,
        registry: null,
        registryLoading: false,
        registryError: '',
        identityBridge: null
    };

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
        suspendUpdates: false,
        saveAllRunning: false,
        savedSignatures: new Map(),
        saveFailures: [],
        saveAllArmedUntil: 0,
        saveDebugStep: ''
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

    function isNewPlatformMode() {
        return state.mode === 'batch-create' || state.mode === 'batch-update';
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
#${APP_ID} .msa-save-state {
    display:flex;
    align-items:center;
    gap:8px;
    padding:9px 12px;
    margin:0 16px 12px;
    border:1px solid #dbe4ea;
    border-radius:10px;
    font-size:12px;
    font-weight:850;
    line-height:1.5;
}
#${APP_ID} .msa-save-state.is-available {
    background:#f0fdf4;
    border-color:#bbebc9;
    color:#166534;
}
#${APP_ID} .msa-save-state.is-locked {
    background:#fff7ed;
    border-color:#fed7aa;
    color:#9a3412;
}
#${APP_ID} .msa-save-state.is-unavailable {
    background:#fef2f2;
    border-color:#fecaca;
    color:#991b1b;
}
#${APP_ID} .msa-save-state.is-unknown {
    background:#f8fafc;
    border-color:#e2e8f0;
    color:#475569;
}

#${APP_ID} .msa-import-card {
    margin-bottom:12px;
    padding:12px;
    border:1px solid #dbe4ea;
    border-radius:12px;
    background:#fbfdff;
}
#${APP_ID} .msa-import-head {
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:10px;
    flex-wrap:wrap;
}
#${APP_ID} .msa-import-title {
    display:flex;
    flex-direction:column;
    gap:3px;
}
#${APP_ID} .msa-import-title strong { font-size:13px; color:#18312a; }
#${APP_ID} .msa-import-title small { font-size:11px; color:#64748b; line-height:1.45; }
#${APP_ID} .msa-import-actions { display:flex; gap:7px; flex-wrap:wrap; align-items:center; }
#${APP_ID} .msa-import-status {
    margin-top:9px;
    padding:9px 10px;
    border-radius:9px;
    background:#f8fafc;
    border:1px solid #e2e8f0;
    font-size:11px;
    line-height:1.65;
    color:#334155;
}
#${APP_ID} .msa-import-status.is-match {
    background:#f0fdf4;
    border-color:#bbebc9;
    color:#166534;
}
#${APP_ID} .msa-import-status.is-warning {
    background:#fff7ed;
    border-color:#fed7aa;
    color:#9a3412;
}
#${APP_ID} .msa-import-status.is-error {
    background:#fef2f2;
    border-color:#fecaca;
    color:#991b1b;
}
#${APP_ID} .msa-import-details {
    margin-top:8px;
    padding:8px 10px;
    border-radius:9px;
    background:#fff;
    border:1px dashed #d6e0e6;
    font-size:11px;
    line-height:1.65;
    color:#475569;
}
#${APP_ID} .msa-import-details b { color:#1f2937; }
#${APP_ID} .msa-import-details ul { margin:5px 0 0; padding-inline-start:20px; }
#${APP_ID} .msa-import-chip {
    display:inline-flex;
    align-items:center;
    gap:4px;
    padding:2px 7px;
    margin:2px 2px;
    border-radius:999px;
    background:#eef2f7;
    color:#475569;
    font-size:10px;
    font-weight:800;
}
#${APP_ID} .msa-import-registry {
    display:flex;
    align-items:center;
    gap:7px;
    flex-wrap:wrap;
    margin-top:7px;
    padding-top:7px;
    border-top:1px dashed #e2e8f0;
    font-size:10px;
    color:#64748b;
}
#${APP_ID} .msa-import-review-actions {
    display:flex;
    flex-wrap:wrap;
    gap:6px;
    margin-top:7px;
}
#${APP_ID} .msa-import-review-btn {
    min-height:30px !important;
    padding:4px 8px !important;
    font-size:10px !important;
    font-weight:850;
}
#${APP_ID} .msa-import-review-btn.is-warning { background:#fff7ed; border-color:#fdba74; color:#9a3412; }
#${APP_ID} .msa-import-review-btn.is-danger { background:#fef2f2; border-color:#fecaca; color:#991b1b; }
#${APP_ID} .msa-import-review-btn.is-info { background:#eff6ff; border-color:#bfdbfe; color:#1d4ed8; }
#${APP_ID} .msa-import-review-btn.is-ok { background:#f0fdf4; border-color:#bbebc9; color:#166534; }

#${APP_ID} .msa-import-review-overlay {
    position:fixed;
    inset:0;
    z-index:2147483000;
    display:flex;
    align-items:center;
    justify-content:center;
    padding:18px;
    background:rgba(15,23,42,.55);
}
#${APP_ID} .msa-import-review-dialog {
    width:min(980px,96vw);
    max-height:88vh;
    display:flex;
    flex-direction:column;
    background:#fff;
    border-radius:16px;
    box-shadow:0 20px 70px rgba(15,23,42,.25);
    overflow:hidden;
}
#${APP_ID} .msa-import-review-head {
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:12px;
    padding:13px 15px;
    border-bottom:1px solid #e5e7eb;
    background:#f8fafc;
}
#${APP_ID} .msa-import-review-head strong { font-size:14px; color:#1f2937; }
#${APP_ID} .msa-import-review-body {
    overflow:auto;
    padding:12px 14px 16px;
}
#${APP_ID} .msa-import-review-table {
    width:100%;
    border-collapse:collapse;
    font-size:11px;
}
#${APP_ID} .msa-import-review-table th,
#${APP_ID} .msa-import-review-table td {
    padding:8px 7px;
    border-bottom:1px solid #e5e7eb;
    text-align:right;
    vertical-align:top;
}
#${APP_ID} .msa-import-review-table th {
    position:sticky;
    top:0;
    background:#f8fafc;
    z-index:1;
    color:#475569;
}
#${APP_ID} .msa-import-review-empty { padding:22px; text-align:center; color:#64748b; }

tr.msa-import-review-row, .msa-import-review-row {
    outline:2px solid rgba(245,158,11,.45) !important;
    outline-offset:-2px;
}
tr.msa-import-missing-row, .msa-import-missing-row {
    outline:2px solid rgba(220,38,38,.35) !important;
    outline-offset:-2px;
}
tr.msa-import-late-row, .msa-import-late-row {
    box-shadow:inset 4px 0 0 #0ea5e9 !important;
}
tr.msa-import-flash, .msa-import-flash {
    animation:msaImportFlash 1.8s ease;
}
@keyframes msaImportFlash {
    0%,100% { box-shadow:inherit; }
    35% { box-shadow:0 0 0 4px rgba(37,99,235,.35) !important; }
}
#${APP_ID} .msa-body { padding: 14px 16px 15px; }
#${APP_ID}.is-collapsed .msa-body { display: none; }
#${APP_ID}.msa-new-platform [data-action="unset-present"],
#${APP_ID}.msa-new-platform [data-action="clear"],
#${APP_ID}.msa-new-platform [data-action="next-unset"],
#${APP_ID}.msa-new-platform [data-filter="unset"],
#${APP_ID}.msa-new-platform [data-stat="unset"] { display:none !important; }
#${APP_ID}.msa-new-platform .msa-stats { grid-template-columns:repeat(6,minmax(112px,1fr)); }
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

#${APP_ID} .msa-save-panel {
    display:none;
    grid-template-columns:auto minmax(180px,1fr) auto;
    align-items:center;
    gap:10px;
    margin:12px 0 10px;
    padding:11px 12px;
    border:1px solid #cfe2dc;
    border-radius:12px;
    background:#f6fbf9;
}
#${APP_ID} .msa-save-panel.is-visible { display:grid; }
#${APP_ID} .msa-save-actions { display:flex; gap:7px; flex-wrap:wrap; }
#${APP_ID} .msa-save-all {
    background:#0f766e;
    color:#fff;
    border-color:#0f766e;
    font-weight:900;
    min-width:120px;
}
#${APP_ID} .msa-save-all:hover { background:#0c645e; border-color:#0c645e; }
#${APP_ID} .msa-retry-save { background:#fff7ed; border-color:#fdba74; color:#9a3412; font-weight:800; }
#${APP_ID} .msa-save-track {
    height:9px;
    border-radius:999px;
    background:#dfe9e6;
    overflow:hidden;
}
#${APP_ID} .msa-save-track > i {
    display:block;
    width:0;
    height:100%;
    border-radius:inherit;
    background:#0f766e;
    transition:width .18s ease;
}
#${APP_ID} .msa-save-meta {
    display:flex;
    flex-direction:column;
    gap:2px;
    min-width:170px;
    font-size:11px;
    color:#64748b;
}
#${APP_ID} .msa-save-meta strong { color:#24443d; font-size:12px; }
#${APP_ID} .msa-save-panel.is-error { border-color:#fecaca; background:#fff8f8; }
#${APP_ID} .msa-save-panel.is-error .msa-save-track > i { background:#dc2626; }
.msa-student-row.msa-save-dirty > td { outline:1px dashed rgba(14,116,144,.22); outline-offset:-1px; }
.msa-student-row.msa-save-failed > td { outline:2px solid rgba(220,38,38,.34); outline-offset:-2px; }
body.msa-save-lock .msa-student-row input,
body.msa-save-lock .msa-student-row label,
body.msa-save-lock .msa-student-row button { pointer-events:none !important; }

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
    #${APP_ID} .msa-save-panel { grid-template-columns:1fr; }
    #${APP_ID} .msa-save-actions { width:100%; }
    #${APP_ID} .msa-save-actions button { flex:1 1 auto; }
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

    function cleanStudentNameCandidate(value = '') {
        return String(value || '')
            .replace(/\s+/g, ' ')
            .replace(/(?:بدون\s+عذر|بعذر|متأخر|غائب|حاضر)/g, ' ')
            .replace(/[0-9٠-٩۰-۹]+/g, ' ')
            .replace(/[|•·]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function extractVisibleStudentName(row) {
        if (!row) return '';

        const direct = row.getAttribute('data-student-name') || row.dataset?.studentName || '';
        if (direct) return cleanStudentNameCandidate(direct);

        const candidates = [];
        const selectors = 'td, th, [data-student-name], .student-name, .studentName, .student_name';

        for (const el of qa(selectors, row)) {
            if (el.closest?.('.absence-div, .delay-div, .ratings')) continue;

            const raw = cleanStudentNameCandidate(el.innerText || el.textContent || '');
            if (!raw) continue;

            const arabicChars = (raw.match(/[\u0600-\u06FF]/g) || []).length;
            const words = raw.split(/\s+/).filter(Boolean).length;

            if (arabicChars < 4 || words < 2) continue;

            candidates.push({
                value: raw,
                score: arabicChars + Math.min(words, 8) * 8 - Math.max(0, raw.length - 80)
            });
        }

        if (!candidates.length) {
            const raw = cleanStudentNameCandidate(row.innerText || row.textContent || '');
            const arabicChars = (raw.match(/[\u0600-\u06FF]/g) || []).length;
            const words = raw.split(/\s+/).filter(Boolean).length;
            return arabicChars >= 4 && words >= 2 ? raw : '';
        }

        candidates.sort((a, b) => b.score - a.score);
        return candidates[0].value;
    }

    function makeStudentFromBatchUpdateRow(row, domIndex) {
        const mainRadio = q('input[type="radio"][name^="Attend["]', row);
        if (!mainRadio) return null;

        const match = mainRadio.name.match(/^Attend\[(\d+)\]$/);
        if (!match) return null;

        const index = Number(match[1]);
        const detailName = 'List[' + index + '].AttendStatusId';
        const detailRadio = q('input[type="radio"][name="' + escapeAttr(detailName) + '"]', row);
        if (!detailRadio) return null;

        const name = extractVisibleStudentName(row);
        if (!name) return null;

        const studentIdName = 'List[' + index + '].StudentId';
        const studentIdInput =
            q('input[name="' + escapeAttr(studentIdName) + '"]', row) ||
            q('input[type="hidden"][name="StudentId"]', row);

        row.classList.add('msa-student-row');
        row.dataset.msaIndex = String(index);

        if (!row.dataset.msaOriginalOrder) {
            row.dataset.msaOriginalOrder = String(domIndex);
        }

        return {
            index,
            row,
            studentId: studentIdInput?.value || '',
            name,
            normalizedName: normalizeArabic(name),
            originalOrder: Number(row.dataset.msaOriginalOrder),
            layout: 'batch-update'
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
            layout: 'legacy-row-save'
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

        const saveForm =
            q('#SaveAttendStudents') ||
            q('#UpdateAttendStudents') ||
            qa('form').find(form =>
                /\/SchoolSchedule\/AttendStudents\/SaveAttendStudents/i.test(form.action || '')
            ) ||
            null;

        const isUpdate =
            saveForm?.id === 'UpdateAttendStudents' ||
            String(q('input[name="isUpdate"]', saveForm || document)?.value || '').toLowerCase() === 'true';

        // النظام الجديد - التحضير الأولي: بيانات الطالب ما زالت مفهرسة داخل List[i].
        const indexedNameInputs = qa(
            'input[name^="List["][name$=".StudentName"]',
            saveForm || document
        );

        if (indexedNameInputs.length) {
            students = indexedNameInputs
                .map(makeStudentFromIndexedNameInput)
                .filter(Boolean);

            if (students.length) mode = isUpdate ? 'batch-update' : 'batch-create';
        }

        // النظام الجديد - بعد الحفظ: الاسم لم يعد موجودًا كحقل، لكنه ظاهر داخل صف الطالب.
        if (!students.length && isUpdate) {
            const candidateRows = qa('tr.attend-row, table tbody tr', saveForm || document);

            students = candidateRows
                .map(makeStudentFromBatchUpdateRow)
                .filter(Boolean);

            if (students.length) mode = 'batch-update';
        }

        // توافق احتياطي مع الواجهة القديمة ذات الحفظ الفردي.
        if (!students.length && qa('.btnSendAttend').length) {
            const candidateRows = qa('table tbody tr');

            students = candidateRows
                .map(makeStudentFromRow)
                .filter(Boolean);

            if (students.length) mode = 'legacy-row-save';
        }

        students = dedupeStudents(students);
        if (!students.length) return null;

        const firstStudent = students[0];
        const firstRow = firstStudent.row;

        const form =
            firstRow.closest('form') ||
            saveForm ||
            q('#SaveAttendStudents') ||
            q('#UpdateAttendStudents') ||
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

        const eventRoot = form || table || sortParent || document;

        const updateValue = String(q('input[name="isUpdate"]', form || document)?.value || '');
        const contextKey = [
            mode,
            form?.id || '',
            updateValue,
            ...students.map(s => s.index + ':' + s.studentId + ':' + s.name)
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
    function rawStudentStatus(student) {
        const idx = student.index;

        const detail =
            q('input[name="' + escapeAttr('List[' + idx + '].AttendStatusId') + '"]:checked', student.row) ||
            q('input[name="' + escapeAttr('List[' + idx + '].AttendStatusId') + '"]:checked');

        const main =
            q('input[name="' + escapeAttr('Attend[' + idx + ']') + '"]:checked', student.row) ||
            q('input[name="' + escapeAttr('Attend[' + idx + ']') + '"]:checked');

        return {
            main: main?.value ?? '',
            detail: detail?.value ?? ''
        };
    }

    function readStudentStatus(student) {
        const raw = rawStudentStatus(student);
        const mainValue = raw.main;
        const rawDetailValue = raw.detail;

        // مدرستي قد تُبقي سبب الغياب/التأخر القديم checked في DOM
        // حتى بعد تحويل الطالب إلى «حاضر». لذلك الحالة الرئيسية هي المرجع الأول.
        if (mainValue === '0') {
            return {
                kind: 'present',
                key: STATUS.PRESENT.key,
                main: '0',
                detail: '0',
                rawDetail: rawDetailValue
            };
        }

        if (mainValue === '12') {
            if (rawDetailValue === '1') {
                return {
                    kind: 'absent',
                    key: STATUS.ABSENT_EXCUSED.key,
                    main: '12',
                    detail: '1',
                    rawDetail: rawDetailValue
                };
            }

            if (rawDetailValue === '2') {
                return {
                    kind: 'absent',
                    key: STATUS.ABSENT_UNEXCUSED.key,
                    main: '12',
                    detail: '2',
                    rawDetail: rawDetailValue
                };
            }

            return {
                kind: 'absent',
                key: 'unset',
                main: '12',
                detail: '',
                rawDetail: rawDetailValue
            };
        }

        if (mainValue === '34') {
            if (rawDetailValue === '4') {
                return {
                    kind: 'late',
                    key: STATUS.LATE_EXCUSED.key,
                    main: '34',
                    detail: '4',
                    rawDetail: rawDetailValue
                };
            }

            if (rawDetailValue === '3') {
                return {
                    kind: 'late',
                    key: STATUS.LATE_UNEXCUSED.key,
                    main: '34',
                    detail: '3',
                    rawDetail: rawDetailValue
                };
            }

            return {
                kind: 'late',
                key: 'unset',
                main: '34',
                detail: '',
                rawDetail: rawDetailValue
            };
        }

        // fallback للواجهات التي قد تعرض التفصيل بدون قيمة رئيسية واضحة.
        if (rawDetailValue === '0') {
            return {
                kind: 'present',
                key: STATUS.PRESENT.key,
                main: '0',
                detail: '0',
                rawDetail: rawDetailValue
            };
        }
        if (rawDetailValue === '1') {
            return {
                kind: 'absent',
                key: STATUS.ABSENT_EXCUSED.key,
                main: '12',
                detail: '1',
                rawDetail: rawDetailValue
            };
        }
        if (rawDetailValue === '2') {
            return {
                kind: 'absent',
                key: STATUS.ABSENT_UNEXCUSED.key,
                main: '12',
                detail: '2',
                rawDetail: rawDetailValue
            };
        }
        if (rawDetailValue === '4') {
            return {
                kind: 'late',
                key: STATUS.LATE_EXCUSED.key,
                main: '34',
                detail: '4',
                rawDetail: rawDetailValue
            };
        }
        if (rawDetailValue === '3') {
            return {
                kind: 'late',
                key: STATUS.LATE_UNEXCUSED.key,
                main: '34',
                detail: '3',
                rawDetail: rawDetailValue
            };
        }

        return {
            kind: 'unset',
            key: 'unset',
            main: '',
            detail: '',
            rawDetail: rawDetailValue
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

    function findStudentStatusRadio(student, kind, value) {
        const idx = student.index;
        const name = kind === 'main'
            ? `Attend[${idx}]`
            : `List[${idx}].AttendStatusId`;

        return (
            q(
                `input[type="radio"][name="${escapeAttr(name)}"][value="${escapeAttr(value)}"]`,
                student.row
            ) ||
            q(`input[type="radio"][name="${escapeAttr(name)}"][value="${escapeAttr(value)}"]`)
        );
    }

    function setStudentStatus(student, statusDef) {
        const isNewPlatform = state.mode === 'batch-create' || state.mode === 'batch-update';
        if (isNewPlatform && statusDef?.main === '34') return false;
        if (!student || !statusDef) return false;

        const current = readStudentStatus(student);
        if (current.key === statusDef.key) return true;

        const main = findStudentStatusRadio(student, 'main', statusDef.main);
        if (!main || main.disabled) return false;

        // مهم في واجهة مدرستي الجديدة:
        // سبب الغياب قد يكون disabled قبل اختيار «غائب»، لذلك يجب الضغط على الحالة الرئيسية أولاً.
        dispatchRadio(main);

        // بعض الحالات (خصوصًا حاضر وغياب بدون عذر) تضبط التفصيل تلقائيًا بعد الضغط الرئيسي.
        let afterMain = readStudentStatus(student);
        if (afterMain.key === statusDef.key) return true;

        const detail = findStudentStatusRadio(student, 'detail', statusDef.detail);
        if (!detail || detail.disabled) return false;

        dispatchRadio(detail);
        return readStudentStatus(student).key === statusDef.key;
    }

    async function setStudentStatusReliable(student, statusDef) {
        const isNewPlatform = state.mode === 'batch-create' || state.mode === 'batch-update';
        if (isNewPlatform && statusDef?.main === '34') {
            return { ok: false, reason: 'late-not-supported' };
        }
        if (!student || !statusDef) return { ok: false, reason: 'missing-data' };

        const already = readStudentStatus(student);
        if (already.key === statusDef.key) return { ok: true, reason: 'already-set' };

        const main = findStudentStatusRadio(student, 'main', statusDef.main);
        if (!main || main.disabled) {
            return { ok: false, reason: 'main-radio-unavailable' };
        }

        dispatchRadio(main);

        // نعطي معالج مدرستي فرصة لإظهار/تمكين سبب الغياب وتعيين «بدون عذر» الافتراضي.
        const delays = [0, 35, 90, 180];

        for (const delay of delays) {
            if (delay) await new Promise(resolve => setTimeout(resolve, delay));

            const current = readStudentStatus(student);
            if (current.key === statusDef.key) {
                return { ok: true, reason: 'main-handler-completed' };
            }

            const detail = findStudentStatusRadio(student, 'detail', statusDef.detail);
            if (detail && !detail.disabled) {
                dispatchRadio(detail);
                await new Promise(resolve => setTimeout(resolve, 20));

                const verified = readStudentStatus(student);
                if (verified.key === statusDef.key) {
                    return { ok: true, reason: 'detail-selected' };
                }
            }
        }

        const finalStatus = readStudentStatus(student);
        return {
            ok: false,
            reason: 'verification-failed',
            actualKey: finalStatus.key,
            actualMain: finalStatus.main,
            actualDetail: finalStatus.detail
        };
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

        const isNewPlatform = state.mode === 'batch-create' || state.mode === 'batch-update';

        if (ready) ready.classList.toggle('is-ready', isNewPlatform ? c.total > 0 : c.unset === 0 && c.total > 0);
        if (readyMain) {
            if (isNewPlatform) {
                const parts = [c.total + ' طالب'];
                if (c.absent) parts.push(c.absent + ' غائب');
                if (c.late) parts.push(c.late + ' متأخر');
                readyMain.textContent = parts.join(' — ') + ' — راجع الحالات قبل الحفظ';
            } else {
                readyMain.textContent = c.unset === 0
                    ? '✓ الحضور مكتمل وجاهز للمراجعة والحفظ'
                    : 'باقي ' + c.unset + ' طالب لم تحدد حالتهم';
            }
        }
        if (readyCount) readyCount.textContent = isNewPlatform
            ? (c.absent + c.late) + ' استثناء'
            : c.selected + '/' + c.total;
        if (progress) progress.style.width = (isNewPlatform ? 100 : pct) + '%';

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
        const queryTokens = queryText.split(/\s+/).filter(Boolean);

        for (const student of state.students) {
            const normalizedName = student.normalizedName || '';
            const studentId = String(student.studentId || '');

            let matchesQuery = true;

            if (queryTokens.length) {
                const allNumeric = queryTokens.every(token => /^\d+$/.test(token));

                if (allNumeric) {
                    matchesQuery = studentId.includes(queryTokens.join('')) ||
                        queryTokens.every(token => studentId.includes(token));
                } else {
                    // البحث لا يعتمد على ترتيب كلمات الاسم:
                    // "أحمد عسيري" و"عسيري أحمد" يعيدان نفس الطالب.
                    matchesQuery = queryTokens.every(token =>
                        normalizedName.includes(token) || studentId.includes(token)
                    );
                }
            }

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
        updateSaveAllUi();
        updateSaveAvailabilityUi();
        updateAttendanceImportUi();
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

    function reportSections(includePresent = true) {
        if (isNewPlatformMode()) {
            const sections = [];
            if (includePresent) sections.push([STATUS.PRESENT.key, 'حاضر']);
            sections.push(
                [STATUS.ABSENT_EXCUSED.key, 'غائب بعذر'],
                [STATUS.ABSENT_UNEXCUSED.key, 'غائب بدون عذر']
            );
            return sections;
        }

        const sections = [];
        if (includePresent) sections.push([STATUS.PRESENT.key, 'حاضر']);
        sections.push(
            [STATUS.ABSENT_EXCUSED.key, 'غائب بعذر'],
            [STATUS.ABSENT_UNEXCUSED.key, 'غائب بدون عذر'],
            [STATUS.LATE_EXCUSED.key, 'متأخر بعذر'],
            [STATUS.LATE_UNEXCUSED.key, 'متأخر بدون عذر'],
            ['unset', 'غير محدد']
        );
        return sections;
    }

    function reportStatusLabel(status) {
        if (!isNewPlatformMode()) return statusLabel(status);
        if (status.key === STATUS.PRESENT.key) return STATUS.PRESENT.label;
        if (status.key === STATUS.ABSENT_EXCUSED.key) return STATUS.ABSENT_EXCUSED.label;
        if (status.key === STATUS.ABSENT_UNEXCUSED.key) return STATUS.ABSENT_UNEXCUSED.label;
        return 'حالة سابقة';
    }

    function reportSummaryText(counts) {
        if (isNewPlatformMode()) {
            return `الإجمالي: ${counts.total} | حاضر: ${counts.present} | غائب: ${counts.absent}`;
        }

        return `الإجمالي: ${counts.total} | حاضر: ${counts.present} | غائب: ${counts.absent} | متأخر: ${counts.late} | غير محدد: ${counts.unset}`;
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
        lines.push(reportSummaryText(c));

        const sections = reportSections(false);

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
                reportStatusLabel(readStudentStatus(student))
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
        const sections = reportSections(true);

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
                ${isNewPlatformMode()
                    ? ''
                    : `<div><span>متأخر</span><b>${c.late}</b></div>
                       <div><span>غير محدد</span><b>${c.unset}</b></div>
                       <div><span>مكتمل</span><b>${c.selected}/${c.total}</b></div>`}
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
body{font-family:Arial,Tahoma,sans-serif;color:#172033;margin:28px;direction:rtl}h1{font-size:22px;margin:0 0 8px}.meta{font-size:12px;color:#64748b;margin-bottom:14px}.summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:14px 0}.summary div{border:1px solid #dfe5ea;border-radius:8px;padding:8px;text-align:center}.summary b{display:block;font-size:20px}.groups{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}.group{border:1px solid #dfe5ea;border-radius:9px;padding:10px;break-inside:avoid}.group h3{font-size:14px;margin:0 0 6px}.group ol{margin:0;padding-inline-start:22px}.group li{font-size:12px;margin:3px 0}.footer{margin-top:18px;padding-top:8px;border-top:1px solid #ddd;font-size:10px;color:#64748b}@media print{body{margin:12mm}.no-print{display:none}.summary{grid-template-columns:repeat(auto-fit,minmax(100px,1fr))}}
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
        const printSummary = isNewPlatformMode()
            ? `<div class="summary"><div>الإجمالي<b>${c.total}</b></div><div>حاضر<b>${c.present}</b></div><div>غائب<b>${c.absent}</b></div></div>`
            : `<div class="summary"><div>الإجمالي<b>${c.total}</b></div><div>حاضر<b>${c.present}</b></div><div>غائب<b>${c.absent}</b></div><div>متأخر<b>${c.late}</b></div><div>غير محدد<b>${c.unset}</b></div><div>مكتمل<b>${c.selected}/${c.total}</b></div></div>`;
        win.document.write(printSummary);

        const sections = reportSections(true);
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


    function rowSaveSignature(student) {
        if (!student?.row) return '';

        // البصمة تعتمد على الاختيار الرئيسي + التفصيلي الخام.
        // هذا يضمن اكتشاف غائب/متأخر ← حاضر حتى لو أبقت مدرستي السبب القديم checked.
        const rawStatus = rawStudentStatus(student);

        const checkedStars =
            q('input[name="Stars"]:checked', student.row) ||
            q('input[name$=".Stars"]:checked', student.row);

        const starsField =
            checkedStars ||
            q('input[name="Stars"], select[name="Stars"], input[name$=".Stars"], select[name$=".Stars"]', student.row);

        const stars = starsField?.value ?? '';
        return String(rawStatus.main || '') + '|' +
            String(rawStatus.detail || '') + '|' +
            String(stars);
    }

    function resetSavedSignatures() {
        state.savedSignatures = new Map();
        state.saveFailures = [];

        if (state.mode !== 'legacy-row-save') return;
        for (const student of state.students) {
            state.savedSignatures.set(student.index, rowSaveSignature(student));
        }
    }

    function dirtyRowSaveStudents() {
        if (state.mode !== 'legacy-row-save') return [];

        return state.students.filter(student => {
            const baseline = state.savedSignatures.get(student.index);
            if (baseline == null) {
                state.savedSignatures.set(student.index, rowSaveSignature(student));
                return false;
            }
            return rowSaveSignature(student) !== baseline;
        });
    }

    function updateSaveAllUi() {
        const root = q('#' + APP_ID);
        if (!root) return;

        const panel = q('[data-role="row-save-panel"]', root);
        const saveBtn = q('[data-action="save-all"]', root);
        const retryBtn = q('[data-action="retry-save"]', root);
        const countEl = q('[data-role="save-count"]', root);

        const visible = state.mode === 'legacy-row-save';
        panel?.classList.toggle('is-visible', visible);
        if (!visible) return;

        const dirty = dirtyRowSaveStudents();
        const failedIndexes = new Set((state.saveFailures || []).map(item => item.index));

        for (const student of state.students) {
            const isDirty = dirty.some(item => item.index === student.index);
            student.row.classList.toggle('msa-save-dirty', isDirty);
            student.row.classList.toggle('msa-save-failed', failedIndexes.has(student.index));
        }

        if (countEl) {
            countEl.textContent = state.saveAllRunning
                ? 'يرجى عدم تغيير الحالات أثناء الحفظ.'
                : 'التغييرات غير المحفوظة: ' + dirty.length;
        }

        if (saveBtn) {
            const armed = !state.saveAllRunning && Date.now() < Number(state.saveAllArmedUntil || 0);
            saveBtn.disabled = state.saveAllRunning || dirty.length === 0;
            saveBtn.textContent = state.saveAllRunning
                ? '⏳ جاري الحفظ...'
                : armed
                    ? '✅ تأكيد الحفظ الآن (' + dirty.length + ')'
                    : '💾 حفظ الكل' + (dirty.length ? ' (' + dirty.length + ')' : '');
        }

        if (retryBtn) {
            const failures = Array.isArray(state.saveFailures) ? state.saveFailures.length : 0;
            retryBtn.hidden = state.saveAllRunning || failures === 0;
            retryBtn.disabled = state.saveAllRunning || failures === 0;
            retryBtn.textContent = '↻ إعادة محاولة الفاشل (' + failures + ')';
        }
    }

    function saveDebug(message, isError = false) {
        state.saveDebugStep = String(message || '');
        console[isError ? 'error' : 'info']('[Madrasati Smart Attendance][SaveAll]', state.saveDebugStep);
        const root = q('#' + APP_ID);
        const textEl = q('[data-role="save-progress-text"]', root || document);
        const panel = q('[data-role="row-save-panel"]', root || document);
        if (textEl) textEl.textContent = state.saveDebugStep;
        panel?.classList.toggle('is-error', Boolean(isError));
    }

    function setSaveProgress(done, total, message, isError = false) {
        const root = q('#' + APP_ID);
        if (!root) return;

        const panel = q('[data-role="row-save-panel"]', root);
        const bar = q('[data-role="save-progress-bar"]', root);
        const textEl = q('[data-role="save-progress-text"]', root);

        const pct = total ? Math.round((done / total) * 100) : 0;
        if (bar) bar.style.width = pct + '%';
        if (textEl) textEl.textContent = message || (done + ' / ' + total);
        panel?.classList.toggle('is-error', Boolean(isError));
    }

    function parseSavePayload(payload, httpOk = true, httpStatus = 200) {
        const appStatus = payload?.result?.status;
        const message = payload?.result?.msg || '';

        return {
            ok: Boolean(httpOk && appStatus === true),
            message: message || (httpOk ? 'استجابة غير متوقعة من مدرستي.' : 'HTTP ' + httpStatus),
            status: httpStatus
        };
    }

    function rowFieldValue(student, name) {
        const field = q('[name="' + escapeAttr(name) + '"]', student.row);
        return field?.value ?? '';
    }

    function currentStarsValue(student) {
        const checked =
            q('input[type="radio"][name="Stars"]:checked', student.row) ||
            q('input[type="radio"][name$=".Stars"]:checked', student.row);

        if (checked) return checked.value ?? '0';

        const field =
            q('input[name="Stars"], select[name="Stars"]', student.row) ||
            q('input[name$=".Stars"], select[name$=".Stars"]', student.row);

        return field?.value ?? '0';
    }

    function buildRowSaveParams(student) {
        const params = new URLSearchParams();

        for (const input of qa('input[type="hidden"][name]', student.row)) {
            if (!input.name) continue;
            params.set(input.name, input.value ?? '');
        }

        const status = readStudentStatus(student);

        const required = {
            dateAttend: rowFieldValue(student, 'dateAttend'),
            IdSchedule: rowFieldValue(student, 'IdSchedule'),
            studentAttendDate: rowFieldValue(student, 'studentAttendDate'),
            SchoolId: rowFieldValue(student, 'SchoolId'),
            AttendStatusIdold: rowFieldValue(student, 'AttendStatusIdold'),
            Id: rowFieldValue(student, 'Id'),
            StudentId: rowFieldValue(student, 'StudentId') || student.studentId,
            StudentName: rowFieldValue(student, 'StudentName') || student.name,
            IsTalented: rowFieldValue(student, 'IsTalented') || 'False',
            OldStar: rowFieldValue(student, 'OldStar') || '0',
            AttendStatusId: status.detail,
            Stars: currentStarsValue(student)
        };

        for (const [name, value] of Object.entries(required)) {
            params.set(name, value ?? '');
        }

        return params;
    }

    function validateRowSaveParams(params) {
        const required = [
            'dateAttend',
            'IdSchedule',
            'studentAttendDate',
            'SchoolId',
            'Id',
            'StudentId',
            'StudentName',
            'AttendStatusId'
        ];

        const missing = required.filter(name => !String(params.get(name) || '').trim());
        return {
            ok: missing.length === 0,
            missing
        };
    }

    function saveStudentViaPageAjax(student, timeoutMs = 12000) {
        const params = buildRowSaveParams(student);
        const valid = validateRowSaveParams(params);

        if (!valid.ok) {
            return Promise.resolve({
                ok: false,
                message: 'بيانات الحفظ ناقصة: ' + valid.missing.join(', ')
            });
        }

        const jq = window.jQuery;
        if (!jq?.ajax) {
            return Promise.resolve({
                ok: false,
                message: 'لم يتم العثور على jQuery/AJAX الخاص بمدرستي في الصفحة.'
            });
        }

        return new Promise(resolve => {
            let settled = false;

            const finish = result => {
                if (settled) return;
                settled = true;
                resolve(result);
            };

            let request;
            try {
                request = jq.ajax({
                    url: '/SchoolSchedule/AttendStudents/SaveAttendStudent',
                    type: 'POST',
                    method: 'POST',
                    data: params.toString(),
                    processData: false,
                    contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
                    dataType: 'json',
                    cache: false,
                    timeout: timeoutMs
                });
            } catch (error) {
                finish({
                    ok: false,
                    message: 'تعذر بدء طلب AJAX: ' + String(error?.message || error)
                });
                return;
            }

            request.done((payload, _textStatus, xhr) => {
                finish(parseSavePayload(payload, true, xhr?.status || 200));
            });

            request.fail((xhr, textStatus, errorThrown) => {
                let payload = xhr?.responseJSON || null;
                if (!payload) {
                    try { payload = JSON.parse(String(xhr?.responseText || '')); } catch (_) {}
                }

                if (payload?.result?.status === true) {
                    finish(parseSavePayload(payload, true, xhr?.status || 200));
                    return;
                }

                const reason =
                    payload?.result?.msg ||
                    (textStatus === 'timeout'
                        ? 'انتهت مهلة انتظار رد مدرستي.'
                        : String(errorThrown || textStatus || ('HTTP ' + (xhr?.status || 0))));

                finish({
                    ok: false,
                    message: reason,
                    status: xhr?.status || 0
                });
            });
        });
    }

    function markStudentSaved(student) {
        state.savedSignatures.set(student.index, rowSaveSignature(student));

        const oldStatus = q('input[type="hidden"][name="AttendStatusIdold"]', student.row);
        const oldStar = q('input[type="hidden"][name="OldStar"]', student.row);
        const current = readStudentStatus(student);

        if (oldStatus) oldStatus.value = current.detail || '';
        if (oldStar) oldStar.value = currentStarsValue(student);

        student.row.classList.remove('msa-save-dirty', 'msa-save-failed');
    }

    async function runSaveQueue(targets, retryMode = false) {
        if (state.mode !== 'legacy-row-save' || state.saveAllRunning) return;

        targets = [...new Map(
            (targets || [])
                .filter(Boolean)
                .map(student => [student.index, student])
        ).values()];

        if (!targets.length) {
            toast(retryMode ? 'لا توجد عمليات فاشلة لإعادة المحاولة.' : 'لا توجد تغييرات تحتاج إلى حفظ.');
            return;
        }

        const invalid = targets.filter(student => !readStudentStatus(student).detail);
        if (invalid.length) {
            toast('يوجد ' + invalid.length + ' طالب بدون حالة مكتملة. أكمل الحالات أولًا.');
            setFilter('unset');
            return;
        }

        saveDebug('بدأ حفظ ' + targets.length + ' طالب بالتتابع.');
        state.saveAllRunning = true;
        state.saveAllArmedUntil = 0;
        state.saveFailures = [];
        const root = q('#' + APP_ID);
        let success = 0;
        const failures = [];

        try {
            saveDebug('جاري تجهيز عملية الحفظ...');
            document.body.classList.add('msa-save-lock');
            root?.classList.add('msa-is-saving');
            updateSaveAllUi();
            setSaveProgress(0, targets.length, 'تم تجهيز الحفظ، جاري إرسال أول طالب...');
            saveDebug('تم تجهيز الحفظ، جاري إرسال أول طالب...');

            console.info('[Madrasati Smart Attendance] بدء حفظ الكل', {
                count: targets.length,
                students: targets.map(s => ({ index: s.index, studentId: s.studentId, name: s.name }))
            });

            for (let i = 0; i < targets.length; i++) {
                const student = targets[i];
                setSaveProgress(
                    i,
                    targets.length,
                    'جاري حفظ ' + (i + 1) + ' من ' + targets.length + ': ' + student.name
                );

                saveDebug('جاري حفظ ' + (i + 1) + ' من ' + targets.length + ': ' + student.name);
                const result = await saveStudentViaPageAjax(student);
                saveDebug('تمت معالجة ' + (i + 1) + ' من ' + targets.length + ': ' + (result.ok ? 'نجاح' : 'فشل'));

                if (result.ok) {
                    success++;
                    markStudentSaved(student);
                } else {
                    failures.push({
                        index: student.index,
                        studentId: student.studentId,
                        name: student.name,
                        reason: result.message || 'فشل غير معروف'
                    });
                    student.row.classList.add('msa-save-failed');
                }

                setSaveProgress(
                    i + 1,
                    targets.length,
                    'تمت معالجة ' + (i + 1) + ' من ' + targets.length +
                        ' — نجح ' + success + (failures.length ? ' — فشل ' + failures.length : ''),
                    failures.length > 0
                );

                if (i < targets.length - 1) {
                    await new Promise(r => setTimeout(r, 120));
                }
            }
        } catch (error) {
            const message = 'تعطل حفظ الكل: ' + String(error?.message || error);
            console.error('[Madrasati Smart Attendance] Save-all fatal error', error);
            failures.push({
                index: -1,
                studentId: '',
                name: 'خطأ داخلي',
                reason: message
            });
            setSaveProgress(success, targets.length, message, true);
            toast(message);
        } finally {
            state.saveAllRunning = false;
            state.saveFailures = failures;
            document.body.classList.remove('msa-save-lock');
            root?.classList.remove('msa-is-saving');
            updateSaveAllUi();
        }

        saveDebug('انتهى الحفظ — نجح: ' + success + '، فشل: ' + failures.length, failures.length > 0);

        if (failures.length) {
            setSaveProgress(
                targets.length,
                targets.length,
                'اكتمل مع ملاحظات: نجح ' + success + ' — تعذر ' + failures.length + '.',
                true
            );
            toast('اكتمل الحفظ: نجح ' + success + ' وتعذر ' + failures.length + '. استخدم «إعادة محاولة الفاشل».');
            console.warn('[Madrasati Smart Attendance] عمليات حفظ فاشلة:', failures);
        } else {
            setSaveProgress(
                targets.length,
                targets.length,
                '✓ تم حفظ ' + success + ' من ' + targets.length + ' بنجاح.'
            );
            toast('✓ تم حفظ ' + success + ' طالب بنجاح.');
        }
    }

    function saveAllChanges() {
        const targets = dirtyRowSaveStudents();

        if (!targets.length) {
            saveDebug('لا توجد تغييرات غير محفوظة.');
            toast('لا توجد تغييرات تحتاج إلى حفظ.');
            return;
        }

        if (Date.now() >= Number(state.saveAllArmedUntil || 0)) {
            state.saveAllArmedUntil = Date.now() + 10000;
            saveDebug(
                'تم رصد ' + targets.length + ' طالب لديهم تغييرات غير محفوظة. ' +
                'اضغط زر التأكيد الأخضر مرة ثانية خلال 10 ثوانٍ لبدء الحفظ.'
            );
            updateSaveAllUi();

            setTimeout(() => {
                if (!state.saveAllRunning && Date.now() >= Number(state.saveAllArmedUntil || 0)) {
                    state.saveAllArmedUntil = 0;
                    updateSaveAllUi();
                    if (!state.saveDebugStep.startsWith('1/6')) {
                        saveDebug('انتهت مهلة التأكيد. اضغط «حفظ الكل» للبدء من جديد.');
                    }
                }
            }, 10200);
            return;
        }

        state.saveAllArmedUntil = 0;
        saveDebug('تم التأكيد داخل اللوحة — بدء التنفيذ الآن...');

        runSaveQueue(targets, true).catch(error => {
            const message = 'تعذر بدء حفظ الكل: ' + String(error?.message || error);
            console.error('[Madrasati Smart Attendance] Save-all start error', error);
            state.saveAllRunning = false;
            document.body.classList.remove('msa-save-lock');
            setSaveProgress(0, 1, message, true);
            saveDebug(message, true);
            toast(message);
            updateSaveAllUi();
        });
    }

    function retryFailedSaves() {
        const failedIndexes = new Set((state.saveFailures || []).map(item => item.index));
        const targets = state.students.filter(student => failedIndexes.has(student.index));
        runSaveQueue(targets, true);
    }


    function importHeaderKey(value) {
        return normalizeArabic(toEnglishDigits(cleanText(value || '')));
    }

    const IMPORT_FIELD_ALIASES = Object.freeze({
        date: [
            'التاريخ', 'تاريخ', 'تاريخ الحصه', 'تاريخ الحضور',
            'date', 'lesson date', 'attendance date', 'session date'
        ],
        classroom: [
            'الفصل', 'الشعبه', 'الفصل الدراسي', 'اسم الفصل', 'اسم الشعبه',
            'class', 'classroom', 'section', 'class name'
        ],
        period: [
            'رقم الحصه', 'الحصه', 'رقم الحصه الدراسيه', 'ترتيب الحصه',
            'period', 'period number', 'slot', 'slot number', 'lesson number', 'lecture number'
        ],
        studentName: [
            'اسم الطالب', 'الطالب', 'اسم الطالبه', 'student name', 'student', 'learner name'
        ],
        studentId: [
            'رقم الطالب', 'معرف الطالب', 'student id', 'student number', 'learner id'
        ],
        civilId: [
            'السجل المدني', 'رقم السجل المدني', 'رقم الهويه', 'رقم الهوية', 'هوية الطالب',
            'civil id', 'national id', 'identity number', 'national identity'
        ],
        email: [
            'البريد', 'البريد التعليمي', 'البريد الالكتروني', 'البريد الإلكتروني', 'الايميل', 'الإيميل',
            'email', 'e-mail', 'student email', 'student account', 'account', 'username'
        ],
        status: [
            'حاله الحضور', 'حالة الحضور', 'الحضور', 'وضع الحضور',
            'attendance status', 'attendance', 'presence status', 'status'
        ],
        excuse: [
            'العذر', 'حاله العذر', 'نوع العذر', 'excuse', 'excuse status', 'excused'
        ],
        reason: [
            'سبب العذر', 'تفاصيل العذر', 'مبرر الغياب', 'excuse reason', 'reason', 'absence reason'
        ],
        subject: [
            'الماده', 'اسم الماده', 'subject', 'subject name', 'course'
        ],
        lesson: [
            'الدرس', 'عنوان الدرس', 'موضوع الدرس', 'lesson', 'lesson title', 'topic'
        ]
    });

    function headerFieldScore(header, field) {
        const h = importHeaderKey(header);
        if (!h) return 0;

        const aliases = IMPORT_FIELD_ALIASES[field] || [];
        let best = 0;

        for (const alias of aliases) {
            const a = importHeaderKey(alias);
            if (!a) continue;
            if (h === a) best = Math.max(best, 100);
            else if (a.length >= 4 && (h.includes(a) || a.includes(h))) best = Math.max(best, 70);
        }

        if (field === 'date' && h.includes('تاريخ')) best = Math.max(best, 75);
        if (field === 'classroom' && (h.includes('فصل') || h.includes('شعب'))) best = Math.max(best, 75);
        if (field === 'period' && h.includes('حصه')) best = Math.max(best, h.includes('رقم') ? 90 : 72);
        if (field === 'studentName' && h.includes('اسم') && (h.includes('طالب') || h.includes('student'))) best = Math.max(best, 90);
        if (field === 'studentId' && (h.includes('معرف') || (h.includes('رقم') && h.includes('طالب')))) best = Math.max(best, 85);
        if (field === 'civilId' && (h.includes('سجل') || h.includes('هويه') || h.includes('هوية'))) best = Math.max(best, 92);
        if (field === 'email' && (h.includes('بريد') || h.includes('ايميل') || h.includes('email') || h.includes('account'))) best = Math.max(best, 92);
        if (field === 'status' && h.includes('حضور') && (h.includes('حاله') || h === 'الحضور')) best = Math.max(best, 92);
        if (field === 'excuse' && h.includes('عذر') && !h.includes('سبب')) best = Math.max(best, 90);
        if (field === 'reason' && h.includes('سبب') && h.includes('عذر')) best = Math.max(best, 95);
        if (field === 'subject' && h.includes('ماده')) best = Math.max(best, 90);
        if (field === 'lesson' && (h.includes('درس') || h.includes('موضوع'))) best = Math.max(best, 82);

        return best;
    }

    function detectImportColumnMap(headerRow) {
        const fields = ['date', 'classroom', 'period', 'studentName', 'status', 'studentId', 'civilId', 'email', 'excuse', 'reason', 'subject', 'lesson'];
        const required = new Set(['date', 'classroom', 'period', 'studentName', 'status']);
        const used = new Set();
        const map = {};
        let score = 0;
        let requiredCount = 0;

        for (const field of fields) {
            let bestIndex = -1;
            let bestScore = 0;

            for (let i = 0; i < headerRow.length; i++) {
                if (used.has(i)) continue;
                const s = headerFieldScore(headerRow[i], field);
                if (s > bestScore) {
                    bestScore = s;
                    bestIndex = i;
                }
            }

            const threshold = required.has(field) ? 70 : 80;
            if (bestIndex >= 0 && bestScore >= threshold) {
                map[field] = bestIndex;
                used.add(bestIndex);
                score += bestScore;
                if (required.has(field)) requiredCount++;
            }
        }

        return { map, score, requiredCount };
    }

    function findAttendanceSheetLayout(workbook) {
        let best = null;

        for (const sheetName of workbook.SheetNames || []) {
            const sheet = workbook.Sheets[sheetName];
            if (!sheet) continue;

            const rows = window.XLSX.utils.sheet_to_json(sheet, {
                header: 1,
                defval: '',
                raw: true,
                blankrows: false
            });

            const scanRows = Math.min(rows.length, 25);
            for (let rowIndex = 0; rowIndex < scanRows; rowIndex++) {
                const row = Array.isArray(rows[rowIndex]) ? rows[rowIndex] : [];
                const detected = detectImportColumnMap(row);

                if (detected.requiredCount < 5) continue;

                const candidate = {
                    sheetName,
                    rows,
                    headerRowIndex: rowIndex,
                    headerRow: row.map(value => cleanText(value)),
                    map: detected.map,
                    score: detected.score
                };

                if (!best || candidate.score > best.score) best = candidate;
            }
        }

        return best;
    }

    function normalizeImportDate(value) {
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            const y = value.getFullYear();
            const m = String(value.getMonth() + 1).padStart(2, '0');
            const d = String(value.getDate()).padStart(2, '0');
            return y + '-' + m + '-' + d;
        }

        if (typeof value === 'number' && Number.isFinite(value)) {
            try {
                const parsed = window.XLSX?.SSF?.parse_date_code?.(value);
                if (parsed?.y && parsed?.m && parsed?.d) {
                    return String(parsed.y).padStart(4, '0') + '-' +
                        String(parsed.m).padStart(2, '0') + '-' +
                        String(parsed.d).padStart(2, '0');
                }
            } catch (_) {}
        }

        const raw = toEnglishDigits(cleanText(value || ''));
        if (!raw) return '';

        let match = raw.match(/\b(20\d{2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\b/);
        if (match) {
            return match[1] + '-' + match[2].padStart(2, '0') + '-' + match[3].padStart(2, '0');
        }

        match = raw.match(/\b(\d{1,2})\s*[\/.\-]\s*(\d{1,2})\s*[\/.\-]\s*(20\d{2})\b/);
        if (match) {
            return match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0');
        }

        return '';
    }

    function normalizePeriodNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) return String(Math.trunc(value));

        const rawDigits = toEnglishDigits(cleanText(value || ''));
        const digitMatch = rawDigits.match(/\b(\d{1,2})\b/);
        if (digitMatch) return String(Number(digitMatch[1]));

        const text = normalizeArabic(rawDigits);
        const words = [
            [['الاول', 'الاولي', 'اول', 'اولي', 'first'], '1'],
            [['الثاني', 'الثانيه', 'ثاني', 'ثانيه', 'second'], '2'],
            [['الثالث', 'الثالثه', 'ثالث', 'ثالثه', 'third'], '3'],
            [['الرابع', 'الرابعه', 'رابع', 'رابعه', 'fourth'], '4'],
            [['الخامس', 'الخامسه', 'خامس', 'خامسه', 'fifth'], '5'],
            [['السادس', 'السادسه', 'سادس', 'سادسه', 'sixth'], '6'],
            [['السابع', 'السابعه', 'سابع', 'سابعه', 'seventh'], '7'],
            [['الثامن', 'الثامنه', 'ثامن', 'ثامنه', 'eighth'], '8'],
            [['التاسع', 'التاسعه', 'تاسع', 'تاسعه', 'ninth'], '9'],
            [['العاشر', 'العاشره', 'عاشر', 'عاشره', 'tenth'], '10']
        ];

        for (const [aliases, num] of words) {
            if (aliases.some(alias => text.includes(alias))) return num;
        }

        return '';
    }

    function classroomParts(value) {
        const text = normalizeArabic(toEnglishDigits(cleanText(value || '')));
        const tokens = text.split(' ').filter(Boolean);

        const gradeMap = {
            'الاول': '1', 'اول': '1', 'الاولي': '1', 'اولي': '1',
            'الثاني': '2', 'ثاني': '2', 'الثانيه': '2', 'ثانيه': '2',
            'الثالث': '3', 'ثالث': '3', 'الثالثه': '3', 'ثالثه': '3',
            'الرابع': '4', 'رابع': '4', 'الرابعه': '4', 'رابعه': '4',
            'الخامس': '5', 'خامس': '5', 'الخامسه': '5', 'خامسه': '5',
            'السادس': '6', 'سادس': '6', 'السادسه': '6', 'سادسه': '6'
        };

        const levelMap = {
            'ابتدائي': 'ابتدائي',
            'الابتدائي': 'ابتدائي',
            'متوسط': 'متوسط',
            'المتوسط': 'متوسط',
            'ثانوي': 'ثانوي',
            'الثانوي': 'ثانوي'
        };

        const sectionMap = {
            'ا': '1', 'أ': '1', '1': '1',
            'ب': '2', '2': '2',
            'ج': '3', '3': '3',
            'د': '4', '4': '4',
            'ه': '5', '5': '5',
            'و': '6', '6': '6'
        };

        let grade = '';
        let level = '';
        let section = '';
        let levelIndex = -1;

        for (let i = 0; i < tokens.length; i++) {
            if (!grade && gradeMap[tokens[i]]) grade = gradeMap[tokens[i]];
            if (!level && levelMap[tokens[i]]) {
                level = levelMap[tokens[i]];
                levelIndex = i;
            }
        }

        const sectionCandidates = levelIndex >= 0 ? tokens.slice(levelIndex + 1) : tokens.slice(1);
        for (const token of sectionCandidates) {
            if (sectionMap[token]) {
                section = sectionMap[token];
                break;
            }
        }

        const key = grade && level
            ? [grade, level, section || '-'].join('|')
            : text;

        return { text, tokens, grade, level, section, key };
    }

    function classroomSimilarity(a, b) {
        const x = classroomParts(a);
        const y = classroomParts(b);

        if (!x.text || !y.text) return 0;
        if (x.text === y.text) return 1;

        if (x.grade && x.level && y.grade && y.level) {
            if (x.grade !== y.grade || x.level !== y.level) return 0;
            if (x.section && y.section) return x.section === y.section ? 1 : 0.08;
            return 0.84;
        }

        const xs = new Set(x.tokens);
        const ys = new Set(y.tokens);
        const intersection = [...xs].filter(token => ys.has(token)).length;
        const union = new Set([...xs, ...ys]).size || 1;
        return intersection / union;
    }

    function simpleTextSimilarity(a, b) {
        const x = normalizeArabic(a || '');
        const y = normalizeArabic(b || '');
        if (!x || !y) return 0;
        if (x === y) return 1;
        if (x.includes(y) || y.includes(x)) return 0.82;

        const xs = new Set(x.split(' ').filter(Boolean));
        const ys = new Set(y.split(' ').filter(Boolean));
        const intersection = [...xs].filter(token => ys.has(token)).length;
        const union = new Set([...xs, ...ys]).size || 1;
        return intersection / union;
    }

    function normalizePersonName(value) {
        return normalizeArabic(value || '')
            .split(' ')
            .filter(token => token && token !== 'الطالب' && token !== 'الطالبه')
            .join(' ');
    }

    function personNameSignature(value) {
        return normalizePersonName(value)
            .split(' ')
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b, 'ar'))
            .join('|');
    }

    function normalizeStudentId(value) {
        return toEnglishDigits(cleanText(value || '')).replace(/\s+/g, '');
    }

    function normalizeCivilId(value) {
        return toEnglishDigits(cleanText(value || ''))
            .replace(/[^0-9]/g, '');
    }

    function normalizeEmail(value) {
        return cleanText(value || '')
            .replace(/^mailto:/i, '')
            .replace(/\s+/g, '')
            .toLowerCase();
    }

    function currentSchoolId() {
        const params = new URLSearchParams(location.search);
        return cleanText(
            params.get('SchoolId') ||
            params.get('schoolId') ||
            q('[name="SchoolId"]')?.value ||
            q('#hSchoolId')?.value ||
            ''
        );
    }

    function loadIdentityBridge() {
        try {
            const parsed = JSON.parse(localStorage.getItem(ATTENDANCE_IDENTITY_BRIDGE_KEY) || '{}');
            return parsed && typeof parsed === 'object'
                ? { version: 1, students: parsed.students && typeof parsed.students === 'object' ? parsed.students : {} }
                : { version: 1, students: {} };
        } catch (_) {
            return { version: 1, students: {} };
        }
    }

    function saveIdentityBridge() {
        try {
            localStorage.setItem(
                ATTENDANCE_IDENTITY_BRIDGE_KEY,
                JSON.stringify(attendanceImport.identityBridge || { version: 1, students: {} })
            );
        } catch (_) {}
    }

    function rememberStudentIdentity(student, registryStudent) {
        const studentId = normalizeStudentId(student?.studentId);
        const account = normalizeEmail(registryStudent?.account);
        if (!studentId || !account) return;

        if (!attendanceImport.identityBridge) attendanceImport.identityBridge = loadIdentityBridge();
        attendanceImport.identityBridge.students[studentId] = {
            account,
            userGuid: cleanText(registryStudent?.userGuid || ''),
            officialName: cleanText(registryStudent?.name || student?.name || ''),
            className: cleanText(registryStudent?.className || ''),
            savedAt: new Date().toISOString()
        };
        saveIdentityBridge();
    }

    function parseRegistryStudentCard(card) {
        const text = cleanText(card?.innerText || card?.textContent || '');
        const account =
            text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || '';

        const name = cleanText(text.split(/اسم\s+الفصل\s*:/i)[0]);
        const className =
            text.match(/اسم\s+الفصل\s*:\s*(.+?)(?=\s+(?:الايميل|الإيميل|البريد)\s*:|$)/i)?.[1]?.trim() || '';

        const status =
            text.match(/حالة\s+الطالب\s*:\s*(.+?)(?=\s+\d+\s|ملف الإنجاز|$)/i)?.[1]?.trim() || '';

        const profile = [...(card?.querySelectorAll?.('a[href]') || [])]
            .find(a => /\/Profile\/My/i.test(a.getAttribute('href') || ''));

        let userGuid = '';
        if (profile) {
            try {
                const url = new URL(profile.getAttribute('href'), location.origin);
                userGuid = url.searchParams.get('UserId') || url.searchParams.get('userId') || '';
            } catch (_) {}
        }

        return {
            name,
            normalizedName: normalizePersonName(name),
            nameSignature: personNameSignature(name),
            className,
            classKey: classroomParts(className).key,
            status,
            account,
            accountNormalized: normalizeEmail(account),
            userGuid
        };
    }

    function detectRegistryPages(doc) {
        const nums = [...doc.querySelectorAll('.pagination a[href], #pagination-container a[href]')]
            .map(a => {
                try {
                    const url = new URL(a.getAttribute('href'), location.origin);
                    return Number(url.searchParams.get('PageNumber') || url.searchParams.get('page') || 0);
                } catch (_) {
                    return 0;
                }
            })
            .filter(n => Number.isInteger(n) && n > 0 && n <= 500);
        return nums.length ? Math.max(...nums) : 1;
    }

    function normalizeRegistry(raw, schoolId) {
        const unique = new Map();
        for (const student of raw || []) {
            if (!student?.name || !student?.accountNormalized) continue;
            const key = student.userGuid
                ? 'u:' + String(student.userGuid).toLowerCase()
                : 'a:' + student.accountNormalized;
            if (!unique.has(key)) unique.set(key, student);
        }

        return {
            version: 1,
            schoolId,
            totalPages: 0,
            uniqueStudents: unique.size,
            students: [...unique.values()],
            savedAt: new Date().toISOString()
        };
    }

    function validRegistry(registry, schoolId) {
        return !!(
            registry &&
            Array.isArray(registry.students) &&
            registry.students.length &&
            (!schoolId || !registry.schoolId || String(registry.schoolId).toLowerCase() === String(schoolId).toLowerCase())
        );
    }

    function loadAttendanceRegistryCache() {
        const schoolId = currentSchoolId();

        for (const key of [ATTENDANCE_REGISTRY_STORAGE_KEY, ASSIGNMENT_REGISTRY_COMPAT_KEY]) {
            try {
                const parsed = JSON.parse(localStorage.getItem(key) || 'null');
                if (!validRegistry(parsed, schoolId)) continue;

                const students = parsed.students.map(student => ({
                    ...student,
                    normalizedName: normalizePersonName(student.normalizedName || student.name),
                    nameSignature: personNameSignature(student.name),
                    classKey: classroomParts(student.className || '').key,
                    accountNormalized: normalizeEmail(student.accountNormalized || student.account)
                })).filter(student => student.name && student.accountNormalized);

                if (!students.length) continue;
                return {
                    ...parsed,
                    schoolId: parsed.schoolId || schoolId,
                    uniqueStudents: students.length,
                    students
                };
            } catch (_) {}
        }

        return null;
    }

    function saveAttendanceRegistryCache(registry) {
        try {
            localStorage.setItem(ATTENDANCE_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
        } catch (_) {}
    }

    async function fetchAttendanceRegistry(force = false) {
        const schoolId = currentSchoolId();
        if (!schoolId) throw new Error('تعذر تحديد SchoolId لبناء دليل طلاب مدرستي.');

        if (!force && validRegistry(attendanceImport.registry, schoolId)) return attendanceImport.registry;

        if (!force) {
            const cached = loadAttendanceRegistryCache();
            if (cached) {
                const age = Date.now() - Date.parse(cached.savedAt || 0);
                attendanceImport.registry = cached;
                if (!Number.isFinite(age) || age <= ATTENDANCE_REGISTRY_MAX_AGE) return cached;
            }
        }

        if (attendanceImport.registryLoading) return attendanceImport.registry;

        attendanceImport.registryLoading = true;
        attendanceImport.registryError = '';
        updateAttendanceImportUi();

        try {
            const fetchPage = async pageNumber => {
                const url = '/SchoolManagment/Actions/MyStudents?PageNumber=' +
                    encodeURIComponent(pageNumber) +
                    '&schoolId=' + encodeURIComponent(schoolId);
                const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store' });
                if (!response.ok) throw new Error('تعذر جلب دليل الطلاب (HTTP ' + response.status + ').');
                const html = await response.text();
                return new DOMParser().parseFromString(html, 'text/html');
            };

            const firstDoc = await fetchPage(1);
            const totalPages = detectRegistryPages(firstDoc);
            const raw = [];

            const collect = doc => {
                const cards = [...doc.querySelectorAll('#studentsDiv .card.p-3')];
                raw.push(...cards.map(parseRegistryStudentCard).filter(student => student.name && student.accountNormalized));
            };

            collect(firstDoc);
            for (let page = 2; page <= totalPages; page++) {
                collect(await fetchPage(page));
            }

            const registry = normalizeRegistry(raw, schoolId);
            registry.totalPages = totalPages;
            if (!registry.students.length) throw new Error('لم أجد طلابًا صالحين في صفحة MyStudents.');

            attendanceImport.registry = registry;
            saveAttendanceRegistryCache(registry);
            return registry;
        } finally {
            attendanceImport.registryLoading = false;
            updateAttendanceImportUi();
        }
    }

    function registryMaps() {
        const students = attendanceImport.registry?.students || [];
        const byName = new Map();
        const bySignature = new Map();
        const byEmail = new Map();

        const add = (map, key, value) => {
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(value);
        };

        for (const student of students) {
            add(byName, normalizePersonName(student.name), student);
            add(bySignature, personNameSignature(student.name), student);
            add(byEmail, normalizeEmail(student.account), student);
        }

        return { byName, bySignature, byEmail };
    }

    function resolveRegistryStudent(pageStudent, maps) {
        const studentId = normalizeStudentId(pageStudent?.studentId);
        const stored = studentId && attendanceImport.identityBridge?.students?.[studentId];
        if (stored?.account) {
            const matches = maps.byEmail.get(normalizeEmail(stored.account)) || [];
            if (matches.length === 1) return { student: matches[0], method: 'studentId→email' };
        }

        const name = normalizePersonName(pageStudent?.name);
        const exact = maps.byName.get(name) || [];
        if (exact.length === 1) return { student: exact[0], method: 'madrasati-name' };

        const signature = personNameSignature(pageStudent?.name);
        const tokenMatches = maps.bySignature.get(signature) || [];
        if (tokenMatches.length === 1) return { student: tokenMatches[0], method: 'madrasati-name-tokens' };

        const currentClass = currentImportLessonIdentity().classroom;
        const all = exact.length ? exact : tokenMatches;
        if (all.length > 1 && currentClass) {
            const sameClass = all.filter(candidate => classroomSimilarity(currentClass, candidate.className) >= 0.72);
            if (sameClass.length === 1) return { student: sameClass[0], method: 'madrasati-name+class' };
        }

        return { student: null, method: '', candidates: all };
    }

    function normalizedTextMatches(value, aliases, mode = 'includes') {
        const source = normalizeArabic(value || '');
        if (!source) return false;

        return (aliases || []).some(alias => {
            const normalizedAlias = normalizeArabic(alias || '');
            if (!normalizedAlias) return false;
            return mode === 'exact'
                ? source === normalizedAlias
                : source.includes(normalizedAlias);
        });
    }

    function normalizeImportedAttendance(record) {
        const rawStatus = cleanText(record.status || '');
        const rawExcuse = cleanText(record.excuse || '');
        const reason = cleanText(record.reason || '');

        const hasExcuse = (
            (normalizedTextMatches(rawStatus + ' ' + rawExcuse, ['بعذر', 'مع عذر']) &&
                !normalizedTextMatches(rawStatus + ' ' + rawExcuse, ['بدون عذر'])) ||
            normalizedTextMatches(rawExcuse, ['نعم', 'yes', 'excused'], 'exact')
        );

        const hasNoExcuse = (
            normalizedTextMatches(rawStatus + ' ' + rawExcuse, ['بدون عذر', 'غير معذور']) ||
            normalizedTextMatches(rawExcuse, ['لا', 'no', 'unexcused'], 'exact')
        );

        if (
            normalizedTextMatches(rawStatus, ['حاضر', 'حضور', 'present', 'attended'])
        ) {
            return { kind: 'supported', targetKey: STATUS.PRESENT.key, label: 'حاضر' };
        }

        if (
            normalizedTextMatches(rawStatus, ['غائب', 'غياب', 'absent', 'absence'])
        ) {
            if (hasExcuse) {
                return { kind: 'supported', targetKey: STATUS.ABSENT_EXCUSED.key, label: 'غائب بعذر' };
            }
            if (hasNoExcuse) {
                return { kind: 'supported', targetKey: STATUS.ABSENT_UNEXCUSED.key, label: 'غائب بدون عذر' };
            }
            return {
                kind: 'review',
                targetKey: '',
                label: 'غائب — العذر غير محدد',
                reason: reason || 'لم يحدد الملف هل الغياب بعذر أو بدون عذر.'
            };
        }

        if (
            normalizedTextMatches(rawStatus, ['متأخر', 'تأخر', 'late', 'tardy'])
        ) {
            const targetKey = hasExcuse ? STATUS.LATE_EXCUSED.key : hasNoExcuse ? STATUS.LATE_UNEXCUSED.key : '';
            if (isNewPlatformMode()) {
                return {
                    kind: 'supported',
                    targetKey: STATUS.PRESENT.key,
                    label: 'متأخر في الملف → حاضر في مدرستي',
                    convertedFrom: 'late',
                    originalLabel: hasExcuse ? 'متأخر بعذر' : hasNoExcuse ? 'متأخر بدون عذر' : 'متأخر',
                    reason: 'واجهة مدرستي الحديثة لا تدعم حالة متأخر؛ حسب الإعداد المعتمد يتم تحويله إلى حاضر.'
                };
            }
            if (targetKey) return { kind: 'supported', targetKey, label: STATUS_BY_KEY[targetKey].label };
            return { kind: 'review', targetKey: '', label: 'متأخر — العذر غير محدد' };
        }

        if (
            normalizedTextMatches(rawStatus, ['مستأذن', 'استئذان', 'مستاذن'])
        ) {
            return {
                kind: 'unsupported',
                targetKey: '',
                label: 'مستأذن',
                reason: 'لا توجد حالة مستأذن مباشرة في نموذج الحضور الحالي في مدرستي.'
            };
        }

        if (normalizedTextMatches(rawStatus, ['هروب'])) {
            return {
                kind: 'unsupported',
                targetKey: '',
                label: 'هروب',
                reason: 'لا توجد حالة هروب مباشرة في نموذج الحضور الحالي في مدرستي.'
            };
        }

        return {
            kind: 'review',
            targetKey: '',
            label: rawStatus || 'حالة غير معروفة',
            reason: 'لم يتعرف السكربت على حالة الحضور في الملف.'
        };
    }

    function lessonKeyForRecord(record) {
        return [
            record.date,
            normalizePeriodNumber(record.period),
            classroomParts(record.classroom).key
        ].join('|');
    }

    function buildAttendanceImportIndex(dataset) {
        const groups = new Map();
        const byDatePeriod = new Map();

        for (const record of dataset?.records || []) {
            const period = normalizePeriodNumber(record.period);
            const classInfo = classroomParts(record.classroom);
            if (!record.date || !period || !classInfo.key) continue;

            const key = [record.date, period, classInfo.key].join('|');
            let group = groups.get(key);

            if (!group) {
                group = {
                    key,
                    date: record.date,
                    period,
                    classroom: record.classroom,
                    classKey: classInfo.key,
                    subject: record.subject || '',
                    lesson: record.lesson || '',
                    records: []
                };
                groups.set(key, group);

                const dpKey = record.date + '|' + period;
                if (!byDatePeriod.has(dpKey)) byDatePeriod.set(dpKey, []);
                byDatePeriod.get(dpKey).push(group);
            }

            group.records.push(record);
            if (!group.subject && record.subject) group.subject = record.subject;
            if (!group.lesson && record.lesson) group.lesson = record.lesson;
        }

        return { groups, byDatePeriod, lessonCount: groups.size };
    }

    function importedStatusCounts(records) {
        const out = {
            total: records.length,
            present: 0,
            absentExcused: 0,
            absentUnexcused: 0,
            late: 0,
            leave: 0,
            other: 0
        };

        for (const record of records) {
            const status = normalizeImportedAttendance(record);
            if (status.convertedFrom === 'late' || status.label.startsWith('متأخر')) out.late++;
            else if (status.targetKey === STATUS.PRESENT.key) out.present++;
            else if (status.targetKey === STATUS.ABSENT_EXCUSED.key) out.absentExcused++;
            else if (status.targetKey === STATUS.ABSENT_UNEXCUSED.key) out.absentUnexcused++;
            else if (status.label === 'مستأذن') out.leave++;
            else out.other++;
        }

        return out;
    }

    function parseAttendanceWorkbook(workbook, fileName) {
        const layout = findAttendanceSheetLayout(workbook);
        if (!layout) {
            throw new Error(
                'لم أجد ورقة تحتوي الأعمدة الأساسية: التاريخ، الفصل، رقم الحصة، اسم الطالب، حالة الحضور.'
            );
        }

        const records = [];
        let invalidRows = 0;

        for (let i = layout.headerRowIndex + 1; i < layout.rows.length; i++) {
            const row = Array.isArray(layout.rows[i]) ? layout.rows[i] : [];
            const get = field => layout.map[field] == null ? '' : row[layout.map[field]];

            const rawDate = get('date');
            const classroom = cleanText(get('classroom'));
            const period = normalizePeriodNumber(get('period'));
            const studentName = cleanText(get('studentName'));
            const status = cleanText(get('status'));

            const hasAny = [rawDate, classroom, period, studentName, status].some(value => cleanText(value) !== '');
            if (!hasAny) continue;

            const date = normalizeImportDate(rawDate);
            if (!date || !classroom || !period || !studentName || !status) {
                invalidRows++;
                continue;
            }

            records.push({
                date,
                classroom,
                period,
                subject: cleanText(get('subject')),
                lesson: cleanText(get('lesson')),
                studentName,
                studentId: normalizeStudentId(get('studentId')),
                civilId: normalizeCivilId(get('civilId')),
                email: normalizeEmail(get('email')),
                status,
                excuse: cleanText(get('excuse')),
                reason: cleanText(get('reason')),
                sourceRow: i + 1
            });

            if (records.length > ATTENDANCE_IMPORT_MAX_ROWS) {
                throw new Error('الملف يتجاوز الحد الحالي وهو ' + ATTENDANCE_IMPORT_MAX_ROWS.toLocaleString('en-US') + ' سجل حضور.');
            }
        }

        if (!records.length) {
            throw new Error('تم التعرف على الأعمدة، لكن لم أجد سجلات حضور صالحة داخل الورقة.');
        }

        const tempDataset = { records };
        const tempIndex = buildAttendanceImportIndex(tempDataset);

        const mapping = {};
        for (const [field, index] of Object.entries(layout.map)) {
            mapping[field] = layout.headerRow[index] || ('عمود ' + (index + 1));
        }

        return {
            version: ATTENDANCE_IMPORT_DATA_VERSION,
            fileName: fileName || 'attendance.xlsx',
            importedAt: new Date().toISOString(),
            sheetName: layout.sheetName,
            headerRow: layout.headerRowIndex + 1,
            mapping,
            recordCount: records.length,
            lessonCount: tempIndex.lessonCount,
            invalidRows,
            records
        };
    }

    function persistAttendanceImportDataset(dataset) {
        const serialized = JSON.stringify(dataset);

        if (serialized.length > ATTENDANCE_IMPORT_STORAGE_SOFT_LIMIT) {
            localStorage.removeItem(ATTENDANCE_IMPORT_STORAGE_KEY);
            return {
                persisted: false,
                warning: 'تم استيراد الملف لهذه الصفحة، لكن حجمه كبير ولن يُحفظ بين الصفحات. يمكن لاحقًا نقل التخزين إلى IndexedDB للملفات الضخمة.'
            };
        }

        try {
            localStorage.setItem(ATTENDANCE_IMPORT_STORAGE_KEY, serialized);
            return { persisted: true, warning: '' };
        } catch (_) {
            return {
                persisted: false,
                warning: 'تم استيراد الملف لهذه الصفحة، لكن تعذر حفظه محليًا في المتصفح.'
            };
        }
    }

    function loadAttendanceImportDataset() {
        try {
            const raw = localStorage.getItem(ATTENDANCE_IMPORT_STORAGE_KEY);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (parsed?.version !== ATTENDANCE_IMPORT_DATA_VERSION || !Array.isArray(parsed.records)) return null;
            return parsed;
        } catch (_) {
            return null;
        }
    }

    function ensureAttendanceImportLoaded() {
        if (attendanceImport.loaded) return;
        attendanceImport.loaded = true;
        attendanceImport.dataset = loadAttendanceImportDataset();
        attendanceImport.index = attendanceImport.dataset
            ? buildAttendanceImportIndex(attendanceImport.dataset)
            : null;
        attendanceImport.registry = loadAttendanceRegistryCache();
        attendanceImport.identityBridge = loadIdentityBridge();
    }

    function currentImportLessonIdentity() {
        const meta = getSessionMeta();
        const date = normalizeImportDate(meta.date);
        const period = normalizePeriodNumber(meta.lectureId || meta.lecture);
        const classroom = cleanText(meta.classroom || '');
        const subject = cleanText(meta.subject || '');

        return { meta, date, period, classroom, subject };
    }

    function findImportedLesson(identity) {
        const index = attendanceImport.index;
        if (!index || !identity.date || !identity.period) {
            return {
                status: 'missing-meta',
                message: 'تعذر قراءة تاريخ الحصة أو رقمها من صفحة مدرستي.'
            };
        }

        const candidates = index.byDatePeriod.get(identity.date + '|' + identity.period) || [];
        if (!candidates.length) {
            return {
                status: 'not-found',
                message: 'لا توجد في الملف حصة بتاريخ ' + identity.date + ' ورقم الحصة ' + identity.period + '.'
            };
        }

        const ranked = candidates.map(group => {
            const classScore = classroomSimilarity(identity.classroom, group.classroom);
            const subjectScore = simpleTextSimilarity(identity.subject, group.subject);
            return {
                group,
                classScore,
                subjectScore,
                score: classScore * 100 + subjectScore * 12
            };
        }).sort((a, b) => b.score - a.score);

        const best = ranked[0];
        const second = ranked[1];

        if (!identity.classroom) {
            if (candidates.length === 1 && best.subjectScore >= 0.8) {
                return { status: 'matched', group: best.group, classScore: 0, subjectScore: best.subjectScore, warning: 'تمت المطابقة بالوقت والمادة لأن اسم الفصل لم يُقرأ.' };
            }
            return {
                status: 'missing-class',
                message: 'وجدت حصصًا في نفس التاريخ والرقم، لكن تعذر قراءة اسم الفصل من مدرستي بأمان.'
            };
        }

        if (best.classScore < 0.72) {
            return {
                status: 'not-found',
                message: 'وجدت حصة في نفس التاريخ والرقم، لكن الفصل لا يطابق الملف. الفصل في مدرستي: ' + identity.classroom + '.'
            };
        }

        if (second && Math.abs(best.score - second.score) < 4 && best.classScore < 1) {
            return {
                status: 'ambiguous',
                message: 'وجدت أكثر من حصة محتملة في الملف ولم أستطع اختيار الفصل بأمان.'
            };
        }

        return {
            status: 'matched',
            group: best.group,
            classScore: best.classScore,
            subjectScore: best.subjectScore,
            warning: best.classScore < 1 ? 'تمت مطابقة الفصل بعد توحيد مسماه.' : ''
        };
    }

    function matchImportedStudents(group) {
        const records = group.records || [];
        const byId = new Map();
        const byEmail = new Map();
        const byCivil = new Map();
        const byName = new Map();
        const bySignature = new Map();

        const add = (map, key, record) => {
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(record);
        };

        for (const record of records) {
            add(byId, normalizeStudentId(record.studentId), record);
            add(byEmail, normalizeEmail(record.email), record);
            add(byCivil, normalizeCivilId(record.civilId), record);
            add(byName, normalizePersonName(record.studentName), record);
            add(bySignature, personNameSignature(record.studentName), record);
        }

        const registry = registryMaps();
        const used = new Set();
        const entries = [];
        const unmatchedPage = [];
        const ambiguous = [];

        for (const student of state.students) {
            const studentId = normalizeStudentId(student.studentId);
            const name = normalizePersonName(student.name);
            const signature = personNameSignature(student.name);

            let candidates = [];
            let confidence = '';
            let registryStudent = null;

            if (studentId && (byId.get(studentId) || []).length) {
                candidates = byId.get(studentId);
                confidence = 'id';
            }

            if (!candidates.length && attendanceImport.registry?.students?.length) {
                const resolved = resolveRegistryStudent(student, registry);
                registryStudent = resolved.student || null;

                if (registryStudent?.accountNormalized) {
                    const emailMatches = byEmail.get(normalizeEmail(registryStudent.accountNormalized)) || [];
                    if (emailMatches.length) {
                        candidates = emailMatches;
                        confidence = 'madrasati-email';
                        rememberStudentIdentity(student, registryStudent);
                    }
                }
            }

            if (!candidates.length && (byName.get(name) || []).length) {
                candidates = byName.get(name);
                confidence = 'exact-name';
            } else if (!candidates.length && (bySignature.get(signature) || []).length) {
                candidates = bySignature.get(signature);
                confidence = 'name-tokens';
            }

            const available = candidates.filter(record => !used.has(record));

            if (available.length === 1) {
                const record = available[0];
                used.add(record);
                const attendance = normalizeImportedAttendance(record);
                entries.push({ student, record, confidence, attendance, registryStudent });
            } else if (available.length > 1) {
                ambiguous.push({
                    student,
                    candidates: available,
                    reason: 'أكثر من سجل في الملف يطابق الطالب.',
                    confidence
                });
            } else {
                unmatchedPage.push({
                    ...student,
                    reason: attendanceImport.registry?.students?.length
                        ? 'لم يُعثر على سجل حضور مطابق بالبريد أو الاسم.'
                        : 'لم يُعثر على سجل حضور مطابق. دليل طلاب مدرستي غير متاح حاليًا.'
                });
            }
        }

        const unmatchedFile = records.filter(record => !used.has(record));
        const supported = entries.filter(entry => entry.attendance.kind === 'supported');
        const review = entries.filter(entry => entry.attendance.kind !== 'supported');
        const convertedLate = supported.filter(entry => entry.attendance.convertedFrom === 'late');
        const emailMatched = entries.filter(entry => entry.confidence === 'madrasati-email');

        return {
            entries,
            supported,
            review,
            convertedLate,
            emailMatched,
            unmatchedPage,
            unmatchedFile,
            ambiguous,
            matchedCount: entries.length
        };
    }

    function refreshAttendanceImportMatch(force = false) {
        ensureAttendanceImportLoaded();

        if (!attendanceImport.dataset || !attendanceImport.index) {
            attendanceImport.currentMatch = null;
            attendanceImport.lastSignature = '';
            updateAttendanceImportUi();
            return null;
        }

        const identity = currentImportLessonIdentity();
        const signature = [
            attendanceImport.dataset.importedAt,
            identity.date,
            identity.period,
            normalizeArabic(identity.classroom),
            normalizeArabic(identity.subject),
            attendanceImport.registry?.savedAt || '',
            state.contextKey
        ].join('|');

        if (!force && attendanceImport.currentMatch && attendanceImport.lastSignature === signature) {
            updateAttendanceImportUi();
            return attendanceImport.currentMatch;
        }

        const lesson = findImportedLesson(identity);
        let match = { identity, lesson, signature };

        if (lesson.status === 'matched') {
            const students = matchImportedStudents(lesson.group);
            match = {
                ...match,
                group: lesson.group,
                students,
                importedCounts: importedStatusCounts(lesson.group.records)
            };
        }

        attendanceImport.currentMatch = match;
        attendanceImport.lastSignature = signature;
        updateAttendanceImportUi();
        return match;
    }

    function sampleNames(items, mapper, limit = 6) {
        return items.slice(0, limit).map(mapper).filter(Boolean);
    }


    function clearImportRowMarkers() {
        for (const student of state.students || []) {
            student.row?.classList?.remove(
                'msa-import-review-row',
                'msa-import-missing-row',
                'msa-import-late-row',
                'msa-import-flash'
            );
        }
    }

    function markImportRows(match) {
        clearImportRowMarkers();
        const students = match?.students;
        if (!students) return;

        for (const entry of students.review || []) {
            entry.student?.row?.classList?.add('msa-import-review-row');
        }
        for (const student of students.unmatchedPage || []) {
            student.row?.classList?.add('msa-import-missing-row');
        }
        for (const item of students.ambiguous || []) {
            item.student?.row?.classList?.add('msa-import-review-row');
        }
        for (const entry of students.convertedLate || []) {
            entry.student?.row?.classList?.add('msa-import-late-row');
        }
    }

    function reviewCategoryItems(kind) {
        const match = attendanceImport.currentMatch;
        const s = match?.students;
        if (!s) return [];

        if (kind === 'review') return s.review || [];
        if (kind === 'unmatched-page') return s.unmatchedPage || [];
        if (kind === 'unmatched-file') return s.unmatchedFile || [];
        if (kind === 'ambiguous') return s.ambiguous || [];
        if (kind === 'late-converted') return s.convertedLate || [];
        return [];
    }

    function reviewCategoryTitle(kind) {
        if (kind === 'review') return 'حالات تحتاج مراجعة';
        if (kind === 'unmatched-page') return 'طلاب موجودون في مدرستي ولا يوجد لهم سجل مطابق في ملف الحصة';
        if (kind === 'unmatched-file') return 'سجلات موجودة في ملف الحصة ولا يوجد لها طالب مطابق في صفحة مدرستي';
        if (kind === 'ambiguous') return 'مطابقات مبهمة';
        if (kind === 'late-converted') return 'طلاب متأخرون في الملف وسيعاملون كحاضرين في مدرستي';
        return 'تفاصيل المطابقة';
    }

    function closeImportReview() {
        q('[data-role="import-review-overlay"]', q('#' + APP_ID))?.remove();
    }

    function gotoImportStudent(index) {
        const student = state.students.find(item => String(item.index) === String(index));
        if (!student?.row) return;
        closeImportReview();
        student.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
        student.row.classList.add('msa-import-flash');
        setTimeout(() => student.row?.classList?.remove('msa-import-flash'), 2200);
    }

    function importReviewRowsHtml(kind, items) {
        if (!items.length) {
            return '<div class="msa-import-review-empty">لا توجد عناصر في هذه الفئة.</div>';
        }

        const goButton = student =>
            student?.index == null
                ? ''
                : '<button type="button" data-review-goto="' + escapeHtml(student.index) + '">اذهب للطالب</button>';

        if (kind === 'review') {
            return '<table class="msa-import-review-table"><thead><tr>' +
                '<th>#</th><th>طالب مدرستي</th><th>سجل الملف</th><th>الحالة</th><th>سبب المراجعة</th><th></th>' +
                '</tr></thead><tbody>' +
                items.map((item, i) => '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + escapeHtml(item.student?.name || '') + '</td>' +
                    '<td>' + escapeHtml(item.record?.studentName || '') + '</td>' +
                    '<td>' + escapeHtml(item.attendance?.label || '') + '</td>' +
                    '<td>' + escapeHtml(item.attendance?.reason || 'تحتاج مراجعة يدوية.') + '</td>' +
                    '<td>' + goButton(item.student) + '</td>' +
                    '</tr>').join('') +
                '</tbody></table>';
        }

        if (kind === 'unmatched-page') {
            return '<table class="msa-import-review-table"><thead><tr>' +
                '<th>#</th><th>اسم الطالب في مدرستي</th><th>السبب</th><th></th>' +
                '</tr></thead><tbody>' +
                items.map((student, i) => '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + escapeHtml(student.name || '') + '</td>' +
                    '<td>' + escapeHtml(student.reason || 'لا يوجد سجل مطابق في الملف.') + '</td>' +
                    '<td>' + goButton(student) + '</td>' +
                    '</tr>').join('') +
                '</tbody></table>';
        }

        if (kind === 'unmatched-file') {
            return '<table class="msa-import-review-table"><thead><tr>' +
                '<th>#</th><th>اسم الطالب في الملف</th><th>البريد</th><th>الحالة</th><th>صف المصدر</th>' +
                '</tr></thead><tbody>' +
                items.map((record, i) => '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + escapeHtml(record.studentName || '') + '</td>' +
                    '<td>' + escapeHtml(record.email || '—') + '</td>' +
                    '<td>' + escapeHtml(record.status || '') + '</td>' +
                    '<td>' + escapeHtml(record.sourceRow || '') + '</td>' +
                    '</tr>').join('') +
                '</tbody></table>';
        }

        if (kind === 'ambiguous') {
            return '<table class="msa-import-review-table"><thead><tr>' +
                '<th>#</th><th>طالب مدرستي</th><th>السجلات المحتملة</th><th>السبب</th><th></th>' +
                '</tr></thead><tbody>' +
                items.map((item, i) => '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + escapeHtml(item.student?.name || '') + '</td>' +
                    '<td>' + escapeHtml((item.candidates || []).map(x => x.studentName).join('، ')) + '</td>' +
                    '<td>' + escapeHtml(item.reason || 'مطابقة مبهمة.') + '</td>' +
                    '<td>' + goButton(item.student) + '</td>' +
                    '</tr>').join('') +
                '</tbody></table>';
        }

        if (kind === 'late-converted') {
            return '<table class="msa-import-review-table"><thead><tr>' +
                '<th>#</th><th>طالب مدرستي</th><th>الحالة في الملف</th><th>الحالة التي ستطبق</th><th></th>' +
                '</tr></thead><tbody>' +
                items.map((item, i) => '<tr>' +
                    '<td>' + (i + 1) + '</td>' +
                    '<td>' + escapeHtml(item.student?.name || '') + '</td>' +
                    '<td>' + escapeHtml(item.attendance?.originalLabel || item.record?.status || 'متأخر') + '</td>' +
                    '<td>حاضر</td>' +
                    '<td>' + goButton(item.student) + '</td>' +
                    '</tr>').join('') +
                '</tbody></table>';
        }

        return '';
    }

    function openImportApplyFailures() {
        const root = q('#' + APP_ID);
        if (!root) return;

        const items = attendanceImport.lastApply?.failures || [];
        closeImportReview();

        const overlay = document.createElement('div');
        overlay.className = 'msa-import-review-overlay';
        overlay.dataset.role = 'import-review-overlay';

        const rows = items.length
            ? '<table class="msa-import-review-table"><thead><tr><th>#</th><th>الطالب</th><th>الحالة المطلوبة</th><th>السبب</th></tr></thead><tbody>' +
              items.map((item, i) =>
                  '<tr><td>' + (i + 1) + '</td><td>' + escapeHtml(item.name || '') + '</td><td>' +
                  escapeHtml(item.target || '') + '</td><td>' + escapeHtml(item.reason || '') + '</td></tr>'
              ).join('') +
              '</tbody></table>'
            : '<div class="msa-import-review-empty">لا توجد حالات فشل مسجلة.</div>';

        overlay.innerHTML =
            '<div class="msa-import-review-dialog" role="dialog" aria-modal="true">' +
                '<div class="msa-import-review-head">' +
                    '<strong>حالات لم يتم تطبيقها (' + items.length + ')</strong>' +
                    '<button type="button" data-action="close-import-review">إغلاق</button>' +
                '</div>' +
                '<div class="msa-import-review-body">' + rows + '</div>' +
            '</div>';

        root.appendChild(overlay);
        q('[data-action="close-import-review"]', overlay)?.addEventListener('click', closeImportReview);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeImportReview();
        });
    }

    function openImportReview(kind) {
        const root = q('#' + APP_ID);
        if (!root) return;

        const items = reviewCategoryItems(kind);
        closeImportReview();

        const overlay = document.createElement('div');
        overlay.className = 'msa-import-review-overlay';
        overlay.dataset.role = 'import-review-overlay';
        overlay.innerHTML =
            '<div class="msa-import-review-dialog" role="dialog" aria-modal="true">' +
                '<div class="msa-import-review-head">' +
                    '<strong>' + escapeHtml(reviewCategoryTitle(kind)) + ' (' + items.length + ')</strong>' +
                    '<button type="button" data-action="close-import-review">إغلاق</button>' +
                '</div>' +
                '<div class="msa-import-review-body">' + importReviewRowsHtml(kind, items) + '</div>' +
            '</div>';

        root.appendChild(overlay);
        q('[data-action="close-import-review"]', overlay)?.addEventListener('click', closeImportReview);
        overlay.addEventListener('click', event => {
            if (event.target === overlay) closeImportReview();
            const goto = event.target.closest?.('[data-review-goto]');
            if (goto) gotoImportStudent(goto.dataset.reviewGoto);
        });
    }

    async function refreshAttendanceRegistry(force = true) {
        attendanceImport.registryError = '';
        try {
            const registry = await fetchAttendanceRegistry(force);
            attendanceImport.currentMatch = null;
            attendanceImport.lastSignature = '';
            refreshAttendanceImportMatch(true);
            toast('تم تحديث دليل طلاب مدرستي: ' + registry.students.length + ' طالب.');
            return registry;
        } catch (error) {
            attendanceImport.registryError = String(error?.message || error);
            updateAttendanceImportUi();
            toast('تعذر تحديث دليل طلاب مدرستي؛ ستستمر المطابقة الاحتياطية بالاسم.');
            return null;
        }
    }

    function updateAttendanceImportUi(root = q('#' + APP_ID)) {
        if (!root) return;
        ensureAttendanceImportLoaded();

        const statusBox = q('[data-role="import-status"]', root);
        const details = q('[data-role="import-details"]', root);
        const refreshBtn = q('[data-action="refresh-import-match"]', root);
        const registryBtn = q('[data-action="refresh-import-registry"]', root);
        const applyBtn = q('[data-action="apply-import-attendance"]', root);
        const clearBtn = q('[data-action="clear-import-attendance"]', root);

        if (!statusBox || !details) return;

        statusBox.classList.remove('is-match', 'is-warning', 'is-error');
        details.hidden = true;
        details.innerHTML = '';

        if (registryBtn) {
            registryBtn.disabled = attendanceImport.registryLoading;
            registryBtn.textContent = attendanceImport.registryLoading ? 'جاري تحديث الدليل...' : 'تحديث دليل الطلاب';
        }

        const dataset = attendanceImport.dataset;
        if (!dataset) {
            clearImportRowMarkers();
            statusBox.textContent = 'لم يتم استيراد سجل حضور بعد. يدعم Excel وCSV ويبحث عن الأعمدة الأساسية تلقائيًا.';
            if (refreshBtn) refreshBtn.disabled = true;
            if (applyBtn) applyBtn.disabled = true;
            if (clearBtn) clearBtn.hidden = true;
            return;
        }

        if (refreshBtn) refreshBtn.disabled = false;
        if (clearBtn) clearBtn.hidden = false;

        const fileSummary =
            '📄 ' + dataset.fileName +
            ' — الورقة: ' + dataset.sheetName +
            ' — ' + dataset.recordCount.toLocaleString('en-US') + ' سجل' +
            ' — ' + dataset.lessonCount.toLocaleString('en-US') + ' حصة';

        const registry = attendanceImport.registry;
        const registryText = attendanceImport.registryLoading
            ? 'جاري بناء دليل طلاب مدرستي...'
            : registry?.students?.length
                ? 'دليل مدرستي: ' + registry.students.length + ' طالب — البريد هو مفتاح الربط الأساسي.'
                : attendanceImport.registryError
                    ? 'دليل مدرستي غير متاح: ' + attendanceImport.registryError
                    : 'دليل مدرستي غير محمل؛ يمكن التحديث يدويًا أو ستستخدم المطابقة بالاسم كاحتياط.';

        const match = attendanceImport.currentMatch;
        if (!match) {
            clearImportRowMarkers();
            statusBox.textContent = fileSummary + ' — جارٍ مطابقة الحصة الحالية.';
            details.hidden = false;
            details.innerHTML = '<div class="msa-import-registry">🔗 ' + escapeHtml(registryText) + '</div>';
            if (applyBtn) applyBtn.disabled = true;
            return;
        }

        if (match.lesson.status !== 'matched') {
            clearImportRowMarkers();
            statusBox.classList.add(match.lesson.status === 'not-found' ? 'is-warning' : 'is-error');
            statusBox.textContent = fileSummary + ' — ' + match.lesson.message;
            if (applyBtn) applyBtn.disabled = true;

            details.hidden = false;
            const id = match.identity;
            details.innerHTML =
                '<b>هوية الحصة المقروءة من مدرستي:</b> ' +
                '<span class="msa-import-chip">' + escapeHtml(id.date || 'تاريخ غير معروف') + '</span>' +
                '<span class="msa-import-chip">' + escapeHtml(id.classroom || 'فصل غير معروف') + '</span>' +
                '<span class="msa-import-chip">الحصة ' + escapeHtml(id.period || '?') + '</span>' +
                '<div class="msa-import-registry">🔗 ' + escapeHtml(registryText) + '</div>';
            return;
        }

        const s = match.students;
        const counts = match.importedCounts;
        const saveOk = saveAvailability().available;

        markImportRows(match);

        statusBox.classList.add('is-match');
        statusBox.textContent =
            fileSummary +
            ' — ✅ تمت مطابقة الحصة: ' +
            match.group.date + ' — ' + match.group.classroom + ' — الحصة ' + match.group.period +
            '. مطابقة الطلاب: ' + s.matchedCount + '/' + state.students.length +
            (s.emailMatched.length ? ' — بالبريد: ' + s.emailMatched.length : '') + '.';

        const lines = [];
        lines.push(
            '<div><b>سجل الحصة:</b> ' +
            '<span class="msa-import-chip">حاضر ' + counts.present + '</span>' +
            '<span class="msa-import-chip">غائب بعذر ' + counts.absentExcused + '</span>' +
            '<span class="msa-import-chip">غائب بدون عذر ' + counts.absentUnexcused + '</span>' +
            (counts.late ? '<span class="msa-import-chip">متأخر ' + counts.late + ' → حاضر</span>' : '') +
            (counts.leave ? '<span class="msa-import-chip">مستأذن ' + counts.leave + '</span>' : '') +
            '</div>'
        );

        lines.push(
            '<div><b>المطابقة:</b> ' +
            '<span class="msa-import-chip">قابل للتطبيق ' + s.supported.length + '</span>' +
            '<span class="msa-import-chip">بالبريد ' + s.emailMatched.length + '</span>' +
            '<span class="msa-import-chip">مراجعة ' + s.review.length + '</span>' +
            '<span class="msa-import-chip">غير موجود بالملف ' + s.unmatchedPage.length + '</span>' +
            '<span class="msa-import-chip">غير موجود بمدرستي ' + s.unmatchedFile.length + '</span>' +
            (s.ambiguous.length ? '<span class="msa-import-chip">مبهم ' + s.ambiguous.length + '</span>' : '') +
            '</div>'
        );

        const reviewButtons = [];
        if (s.review.length) reviewButtons.push('<button type="button" class="msa-import-review-btn is-warning" data-import-review="review">⚠️ مراجعة ' + s.review.length + ' — عرض</button>');
        if (s.unmatchedPage.length) reviewButtons.push('<button type="button" class="msa-import-review-btn is-danger" data-import-review="unmatched-page">❌ في مدرستي وليس الملف ' + s.unmatchedPage.length + ' — عرض</button>');
        if (s.unmatchedFile.length) reviewButtons.push('<button type="button" class="msa-import-review-btn is-info" data-import-review="unmatched-file">ℹ️ في الملف وليس مدرستي ' + s.unmatchedFile.length + ' — عرض</button>');
        if (s.ambiguous.length) reviewButtons.push('<button type="button" class="msa-import-review-btn is-warning" data-import-review="ambiguous">⚠️ مطابقة مبهمة ' + s.ambiguous.length + ' — عرض</button>');
        if (s.convertedLate.length) reviewButtons.push('<button type="button" class="msa-import-review-btn is-ok" data-import-review="late-converted">⏱ متأخر → حاضر ' + s.convertedLate.length + ' — عرض</button>');
        if (reviewButtons.length) lines.push('<div class="msa-import-review-actions">' + reviewButtons.join('') + '</div>');

        if (match.lesson.warning) lines.push('<div>ℹ️ ' + escapeHtml(match.lesson.warning) + '</div>');
        if (s.convertedLate.length) {
            lines.push('<div>ℹ️ حسب الإعداد المعتمد: كل طالب حالته «متأخر» في الملف سيُسجل «حاضر» لأن واجهة مدرستي الحديثة لا تدعم التأخر.</div>');
        }
        if (!saveOk) lines.push('<div>🔒 يمكن مراجعة المطابقة، لكن تطبيق الملف معطل لأن حفظ الحصة غير متاح حاليًا في مدرستي.</div>');
        lines.push('<div class="msa-import-registry">🔗 ' + escapeHtml(registryText) + '</div>');

        if (attendanceImport.lastApply?.lessonKey === match.group.key) {
            lines.push(
                '<div>آخر تطبيق: ' +
                attendanceImport.lastApply.success + ' نجح' +
                (attendanceImport.lastApply.convertedLate ? ' — منها ' + attendanceImport.lastApply.convertedLate + ' متأخر ← حاضر' : '') +
                (attendanceImport.lastApply.failed ? '، ' + attendanceImport.lastApply.failed + ' تعذر تطبيقه' : '') +
                ' — ' + escapeHtml(attendanceImport.lastApply.at) +
                '</div>'
            );

            if (attendanceImport.lastApply.failed && attendanceImport.lastApply.failures?.length) {
                lines.push(
                    '<div class="msa-import-review-actions">' +
                    '<button type="button" class="msa-import-review-btn is-danger" data-action="show-import-apply-failures">' +
                    '❌ حالات لم تُطبق ' + attendanceImport.lastApply.failures.length + ' — عرض' +
                    '</button>' +
                    '</div>'
                );
            }
        }

        details.innerHTML = lines.join('');
        details.hidden = false;

        if (applyBtn) {
            applyBtn.disabled = !saveOk || !s.supported.length || s.ambiguous.length > 0;
            applyBtn.title = !saveOk
                ? 'الحفظ غير متاح في مدرستي حاليًا.'
                : s.ambiguous.length
                    ? 'يوجد تطابق مبهم ويجب مراجعته.'
                    : 'يطبق الحالات المدعومة فقط ولا يحفظ تلقائيًا.';
        }
    }

    async function importAttendanceFile(file) {
        if (!file) return;
        if (!window.XLSX) {
            toast('تعذر تحميل قارئ Excel. أعد تحميل الصفحة ثم حاول مرة أخرى.');
            return;
        }

        const root = q('#' + APP_ID);
        const statusBox = q('[data-role="import-status"]', root);
        if (statusBox) {
            statusBox.classList.remove('is-match', 'is-warning', 'is-error');
            statusBox.textContent = 'جاري قراءة الملف وتحليل الأعمدة والحصص...';
        }

        try {
            const data = await file.arrayBuffer();
            const workbook = window.XLSX.read(data, {
                type: 'array',
                cellDates: true,
                cellNF: false,
                cellText: false
            });

            const dataset = parseAttendanceWorkbook(workbook, file.name);
            const storage = persistAttendanceImportDataset(dataset);

            attendanceImport.loaded = true;
            attendanceImport.dataset = dataset;
            attendanceImport.index = buildAttendanceImportIndex(dataset);
            attendanceImport.currentMatch = null;
            attendanceImport.lastSignature = '';
            attendanceImport.lastError = '';
            attendanceImport.lastApply = null;

            try {
                await fetchAttendanceRegistry(false);
            } catch (registryError) {
                attendanceImport.registryError = String(registryError?.message || registryError);
            }

            refreshAttendanceImportMatch(true);

            let message =
                'تم استيراد ' + dataset.recordCount.toLocaleString('en-US') +
                ' سجل حضور من ' + dataset.lessonCount.toLocaleString('en-US') +
                ' حصة.';
            if (dataset.invalidRows) message += ' تم تجاهل ' + dataset.invalidRows + ' صف غير مكتمل.';
            if (storage.warning) message += ' ' + storage.warning;
            toast(message);
        } catch (error) {
            attendanceImport.lastError = String(error?.message || error);
            if (statusBox) {
                statusBox.classList.add('is-error');
                statusBox.textContent = 'تعذر استيراد الملف: ' + attendanceImport.lastError;
            }
            toast('تعذر استيراد ملف الحضور.');
            console.error('[Madrasati Smart Attendance] Attendance import failed:', error);
        }
    }

    function clearAttendanceImport() {
        if (!attendanceImport.dataset) return;
        if (!window.confirm('سيتم مسح سجل الحضور المستورد من هذا المتصفح. هل تريد المتابعة؟')) return;

        try { localStorage.removeItem(ATTENDANCE_IMPORT_STORAGE_KEY); } catch (_) {}
        attendanceImport.loaded = true;
        attendanceImport.dataset = null;
        attendanceImport.index = null;
        attendanceImport.currentMatch = null;
        attendanceImport.lastSignature = '';
        attendanceImport.lastApply = null;
        closeImportReview();
        clearImportRowMarkers();
        updateAttendanceImportUi();
        toast('تم مسح سجل الحضور المستورد.');
    }

    async function applyAttendanceImport() {
        const match = refreshAttendanceImportMatch(true);
        if (!match || match.lesson.status !== 'matched') {
            toast('لم يتم العثور على حصة مطابقة يمكن تطبيقها.');
            return;
        }

        const availability = saveAvailability();
        if (!availability.available) {
            toast(availability.message);
            return;
        }

        const s = match.students;
        if (s.ambiguous.length) {
            toast('يوجد تطابق طلاب مبهم. لن يتم التطبيق قبل حله.');
            return;
        }

        if (!s.supported.length) {
            toast('لا توجد حالات مدعومة قابلة للتطبيق من الملف.');
            return;
        }

        const warnings = [];
        if (s.review.length) warnings.push(s.review.length + ' حالة تحتاج مراجعة ولن تطبق');
        if (s.unmatchedPage.length) warnings.push(s.unmatchedPage.length + ' طالب في مدرستي بلا سجل مطابق');
        if (s.unmatchedFile.length) warnings.push(s.unmatchedFile.length + ' سجل في الملف بلا طالب مطابق');

        const confirmation =
            'سيتم تطبيق حضور الملف على ' + s.supported.length + ' طالب في الحصة الحالية.' +
            (s.convertedLate.length
                ? '\n\nسيتم تحويل ' + s.convertedLate.length + ' طالب من «متأخر» في الملف إلى «حاضر» في مدرستي.'
                : '') +
            (warnings.length ? '\n\nتنبيه: ' + warnings.join('، ') + '.' : '') +
            '\n\nلن يتم الحفظ تلقائيًا. ستراجع النتيجة ثم تضغط زر الحفظ بنفسك.';

        if (!window.confirm(confirmation)) return;

        pushUndo();
        let success = 0;
        let failed = 0;
        const failures = [];

        state.suspendUpdates = true;
        try {
            for (const entry of s.supported) {
                const statusDef = STATUS_BY_KEY[entry.attendance.targetKey];

                if (!statusDef) {
                    failed++;
                    failures.push({
                        name: entry.student?.name || entry.record?.studentName || 'طالب غير معروف',
                        target: entry.attendance?.label || '',
                        reason: 'تعذر تحديد حالة مدرستي المطلوبة.'
                    });
                    continue;
                }

                const result = await setStudentStatusReliable(entry.student, statusDef);
                if (result.ok) {
                    success++;
                } else {
                    failed++;
                    failures.push({
                        name: entry.student?.name || entry.record?.studentName || 'طالب غير معروف',
                        target: statusDef.label,
                        reason: result.reason || 'تعذر التحقق من تطبيق الحالة.'
                    });
                }
            }
        } finally {
            state.suspendUpdates = false;
        }

        updateAll();

        attendanceImport.lastApply = {
            lessonKey: match.group.key,
            success,
            failed,
            failures,
            convertedLate: s.convertedLate.length,
            at: new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })
        };

        updateAttendanceImportUi();

        const c = stats();
        toast(
            'تم تطبيق ' + success + ' حالة من الملف' +
            (s.convertedLate.length ? '، ومنها ' + s.convertedLate.length + ' متأخر ← حاضر' : '') +
            (failed ? '، وتعذر تطبيق ' + failed + ' — راجع قائمة الفشل قبل الحفظ' : '') +
            '. راجع الإحصاءات قبل الحفظ. الحاضر: ' + c.present + '، الغائب: ' + c.absent + '.'
        );
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
                    <button type="button" class="msa-primary" data-action="native-save-top">💾 حفظ</button>
                    <button type="button" class="msa-report-btn" data-action="report">📋 تقرير الحصة</button>
                    <button type="button" data-action="toggle-panel">طي الأدوات</button>
                </div>
            </div>

            <div class="msa-save-state is-unknown" data-role="save-state">
                جارٍ فحص إمكانية الحفظ والتعديل...
            </div>

            <div class="msa-body">
                <div class="msa-import-card" data-role="import-card">
                    <div class="msa-import-head">
                        <div class="msa-import-title">
                            <strong>📥 سجل الحضور المستورد</strong>
                            <small>Excel/CSV — يطابق الحصة بالتاريخ + الفصل + رقم الحصة، ثم يطابق الطلاب قبل التطبيق.</small>
                        </div>
                        <div class="msa-import-actions">
                            <button type="button" data-action="import-attendance">استيراد ملف</button>
                            <button type="button" data-action="refresh-import-registry">تحديث دليل الطلاب</button>
                            <button type="button" data-action="refresh-import-match" disabled>مطابقة الحصة</button>
                            <button type="button" class="msa-primary" data-action="apply-import-attendance" disabled>تطبيق حضور الملف</button>
                            <button type="button" data-action="clear-import-attendance" hidden>مسح الملف</button>
                        </div>
                    </div>
                    <input type="file" data-role="import-file" accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden>
                    <div class="msa-import-status" data-role="import-status">لم يتم استيراد سجل حضور بعد.</div>
                    <div class="msa-import-details" data-role="import-details" hidden></div>
                </div>

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

                <div class="msa-save-panel" data-role="row-save-panel">
                    <div class="msa-save-actions">
                        <button type="button" class="msa-save-all" data-action="save-all">💾 حفظ الكل</button>
                        <button type="button" class="msa-retry-save" data-action="retry-save" hidden>↻ إعادة محاولة الفاشل</button>
                    </div>
                    <div class="msa-save-track" aria-hidden="true"><i data-role="save-progress-bar"></i></div>
                    <div class="msa-save-meta">
                        <strong data-role="save-progress-text">جاهز للحفظ المتسلسل</strong>
                        <span data-role="save-count">التغييرات غير المحفوظة: 0</span>
                    </div>
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

    function pageVisibleText() {
        return cleanText(document.body?.innerText || '');
    }

    function saveAvailability() {
        const button = nativeSaveButton();
        const text = pageVisibleText();

        const lockedUntilTomorrow =
            text.includes('تم استخدام التعديل المتاح لهذه الحصة') &&
            text.includes('يُتاح التعديل مرة أخرى بدايةً من اليوم التالي');

        if (lockedUntilTomorrow) {
            return {
                key: 'locked-today',
                available: false,
                message: '🔒 تم استخدام التعديل المتاح لهذه الحصة — يتاح التعديل مرة أخرى بدايةً من اليوم التالي.'
            };
        }

        if (!button) {
            return {
                key: 'unknown',
                available: false,
                message: 'تعذر العثور على زر الحفظ الأصلي في مدرستي.'
            };
        }

        if (button.disabled) {
            return {
                key: 'disabled',
                available: false,
                message: state.mode === 'batch-update'
                    ? '⛔ لا يمكن تعديل هذه الحصة حاليًا؛ زر الحفظ الأصلي في مدرستي غير متاح.'
                    : '⛔ لا يمكن حفظ هذه الحصة حاليًا؛ زر الحفظ الأصلي في مدرستي غير متاح.'
            };
        }

        return {
            key: 'available',
            available: true,
            message: state.mode === 'batch-update'
                ? '✅ ما زال بالإمكان تعديل هذه الحصة وحفظ التعديل.'
                : '✅ يمكن حفظ هذه الحصة الآن.'
        };
    }

    function updateSaveAvailabilityUi(root = q('#' + APP_ID)) {
        if (!root) return;

        const topSave = q('[data-action="native-save-top"]', root);
        const box = q('[data-role="save-state"]', root);
        const availability = saveAvailability();

        if (topSave) {
            topSave.disabled = !availability.available;
            topSave.setAttribute('aria-disabled', String(!availability.available));
            topSave.title = availability.message;
        }

        if (box) {
            box.classList.remove(
                'is-available',
                'is-locked',
                'is-unavailable',
                'is-unknown'
            );

            if (availability.key === 'available') {
                box.classList.add('is-available');
            } else if (availability.key === 'locked-today') {
                box.classList.add('is-locked');
            } else if (availability.key === 'disabled') {
                box.classList.add('is-unavailable');
            } else {
                box.classList.add('is-unknown');
            }

            box.textContent = availability.message;
        }
    }

    function nativeSaveButton() {
        const form = state.form || q('#SaveAttendStudents') || q('#UpdateAttendStudents');
        if (!form) return null;

        return (
            q('button[name="SendAttend"]', form) ||
            q('button[type="submit"].btn-primary', form) ||
            q('input[type="submit"]', form)
        );
    }

    function triggerNativeSave() {
        const availability = saveAvailability();
        const button = nativeSaveButton();

        if (!availability.available || !button) {
            toast(availability.message);
            updateSaveAvailabilityUi();
            return;
        }

        button.click();
    }

    function updateModeUi(root) {
        const modeLabel = q('[data-role="mode-label"]', root);
        const saveHint = q('[data-role="save-hint"]', root);
        const isNewPlatform = state.mode === 'batch-create' || state.mode === 'batch-update';

        root.classList.toggle('msa-new-platform', isNewPlatform);

        const searchInput = q('[data-role="search"]', root);
        if (searchInput) {
            searchInput.placeholder = state.mode === 'batch-update'
                ? 'ابحث بأي جزء من الاسم وبأي ترتيب...'
                : 'ابحث بالاسم بأي ترتيب أو برقم الطالب...';
        }

        updateSaveAvailabilityUi(root);

        const bulkStatus = q('[data-role="bulk-status"]', root);
        if (bulkStatus) {
            for (const option of qa('option', bulkStatus)) {
                const isLate = option.value === 'late-excused' || option.value === 'late-unexcused';
                option.hidden = isNewPlatform && isLate;
                option.disabled = isNewPlatform && isLate;
            }

            if (isNewPlatform && String(bulkStatus.value).startsWith('late-')) {
                bulkStatus.value = 'present';
            }
        }

        const sortSelect = q('[data-role="sort"]', root);
        const unsetSort = sortSelect?.querySelector('option[value="unset-first"]');
        if (unsetSort) {
            unsetSort.hidden = isNewPlatform;
            unsetSort.disabled = isNewPlatform;
            if (isNewPlatform && sortSelect.value === 'unset-first') sortSelect.value = 'original';
        }

        if (state.mode === 'legacy-row-save') {
            if (modeLabel) modeLabel.textContent = 'واجهة مدرستي القديمة — حفظ فردي + حفظ الكل الذكي';
            if (saveHint) saveHint.textContent = 'تم اكتشاف الواجهة القديمة؛ «حفظ الكل» متاح للتوافق فقط.';
        } else if (state.mode === 'batch-update') {
            if (modeLabel) modeLabel.textContent = 'تعديل حضور محفوظ — نظام مدرستي الجديد';
            if (saveHint) saveHint.textContent = '⚠️ عند حفظ تعديل الحضور، تستخدم مدرستي فرصة التعديل المتاحة لليوم، ويُتاح التعديل مرة أخرى بدايةً من اليوم التالي.';
        } else {
            if (modeLabel) modeLabel.textContent = 'تحضير حصة جديدة — نظام مدرستي الجديد';
            if (saveHint) saveHint.textContent = 'مدرستي تبدأ الطلاب «حاضر» افتراضيًا؛ راجع الغياب ثم استخدم زر «حفظ» الأصلي.';
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
        q('[data-action="native-save-top"]', root)?.addEventListener('click', triggerNativeSave);

        const importFileInput = q('[data-role="import-file"]', root);
        q('[data-action="import-attendance"]', root)?.addEventListener('click', () => importFileInput?.click());
        importFileInput?.addEventListener('change', async event => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) await importAttendanceFile(file);
        });
        q('[data-action="refresh-import-registry"]', root)?.addEventListener('click', async () => {
            await refreshAttendanceRegistry(true);
        });
        q('[data-action="refresh-import-match"]', root)?.addEventListener('click', async () => {
            if (!attendanceImport.registry?.students?.length) {
                await refreshAttendanceRegistry(false);
            }
            refreshAttendanceImportMatch(true);
            toast('تمت إعادة فحص مطابقة الحصة الحالية مع الملف.');
        });
        root.addEventListener('click', event => {
            const reviewButton = event.target.closest?.('[data-import-review]');
            if (reviewButton) openImportReview(reviewButton.dataset.importReview);

            const failuresButton = event.target.closest?.('[data-action="show-import-apply-failures"]');
            if (failuresButton) openImportApplyFailures();
        });
        q('[data-action="apply-import-attendance"]', root)?.addEventListener('click', applyAttendanceImport);
        q('[data-action="clear-import-attendance"]', root)?.addEventListener('click', clearAttendanceImport);

        q('[data-action="next-unset"]', root).addEventListener('click', focusNextUnset);

        q('[data-action="save-all"]', root)?.addEventListener('click', saveAllChanges);
        q('[data-action="retry-save"]', root)?.addEventListener('click', retryFailedSaves);

        q('[data-action="toggle-panel"]', root).addEventListener('click', event => {
            state.collapsed = !state.collapsed;
            root.classList.toggle('is-collapsed', state.collapsed);
            event.currentTarget.textContent = state.collapsed ? 'إظهار الأدوات' : 'طي الأدوات';
        });

        q('[data-role="ready"]', root).addEventListener('click', () => {
            const c = stats();
            const isNewPlatform = state.mode === 'batch-create' || state.mode === 'batch-update';
            if (!isNewPlatform && c.unset) setFilter('unset');
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
                const attendanceChanged =
                    event.target.matches?.('input[type="radio"][name^="Attend["]') ||
                    event.target.matches?.('input[type="radio"][name^="List["][name$=".AttendStatusId"]');

                if (attendanceChanged) {
                    clearTimeout(updateAll._attendanceTimer);
                    updateAll._attendanceTimer = setTimeout(() => {
                        updateAll();
                        requestAnimationFrame(() => updateAll());
                    }, 0);
                } else if (state.mode === 'legacy-row-save' && event.target.closest?.('tr')) {
                    updateSaveAllUi();
                }
            });
        }
    }


    function bindNativeSaveTracking() {
        if (document.documentElement.dataset.msaNativeSaveTracking === '1') return;

        const jq = window.jQuery;
        if (!jq?.fn?.jquery) return;

        document.documentElement.dataset.msaNativeSaveTracking = '1';

        jq(document).on('ajaxSuccess.msaSmartAttendance', (_event, xhr, settings) => {
            const url = String(settings?.url || '');
            if (!url.includes('/SchoolSchedule/AttendStudents/SaveAttendStudent')) return;

            let payload = xhr?.responseJSON || null;
            if (!payload) {
                try { payload = JSON.parse(String(xhr?.responseText || '')); } catch (_) {}
            }
            if (payload?.result?.status !== true) return;

            let params = null;
            try {
                if (typeof settings?.data === 'string') {
                    params = new URLSearchParams(settings.data);
                } else if (settings?.data && typeof settings.data === 'object') {
                    params = new URLSearchParams();
                    for (const [key, value] of Object.entries(settings.data)) {
                        params.set(key, value ?? '');
                    }
                }
            } catch (_) {}

            const recordId = params?.get('Id') || '';
            const studentId = params?.get('StudentId') || '';

            const student = state.students.find(item => {
                const rowId = rowFieldValue(item, 'Id');
                return (recordId && rowId === recordId) ||
                    (!recordId && studentId && String(item.studentId) === studentId);
            });

            if (!student) return;
            markStudentSaved(student);
            state.saveFailures = (state.saveFailures || []).filter(item => item.index !== student.index);
            updateSaveAllUi();
        });
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
                if (state.mode === 'batch-create' || state.mode === 'batch-update') return;
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

        if (sameContext) {
            refreshAttendanceImportMatch();
            updateSaveAvailabilityUi(oldRoot);
            return true;
        }
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
            suspendUpdates: false,
            saveAllRunning: false,
            savedSignatures: new Map(),
            saveFailures: [],
            saveAllArmedUntil: 0,
            saveDebugStep: ''
        };

        resetSavedSignatures();
        injectStyle();
        const root = buildToolbar();
        insertToolbar(root);
        bindToolbar(root);
        bindKeyboardShortcuts();
        bindNativeSaveTracking();
        updateModeUi(root);
        updateAll();
        refreshAttendanceImportMatch(true);

        if (attendanceImport.dataset && !attendanceImport.registryLoading) {
            fetchAttendanceRegistry(false)
                .then(() => {
                    attendanceImport.currentMatch = null;
                    attendanceImport.lastSignature = '';
                    refreshAttendanceImportMatch(true);
                })
                .catch(error => {
                    attendanceImport.registryError = String(error?.message || error);
                    updateAttendanceImportUi();
                });
        }

        console.info(
            `[Madrasati Smart Attendance v0.3.5-beta4] جاهز — تم اكتشاف ${state.students.length} طالب.`,
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
    const observer = new MutationObserver(mutations => {
        const relevant = mutations.some(mutation => {
            const target = mutation.target?.nodeType === Node.ELEMENT_NODE
                ? mutation.target
                : mutation.target?.parentElement;

            return !target?.closest?.('#' + APP_ID + ', .msa-report-overlay');
        });

        if (!relevant) return;

        clearTimeout(observerTimer);
        observerTimer = setTimeout(() => {
            init();
            updateSaveAvailabilityUi();
        }, 180);
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['disabled', 'class', 'style', 'hidden', 'aria-disabled']
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
