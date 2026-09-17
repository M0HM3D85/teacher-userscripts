// ==UserScript==
// @name         Madrasati Smart Attendance | التحضير الذكي لمدرستي
// @namespace    https://greasyfork.org/users/1636459
// @version      0.2.1
// @description  التحضير الذكي لمدرستي مع دعم وضعي التحضير الجماعي والتعديل الفردي للحضور، والبحث والفرز والإحصاءات والتراجع.
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
        version: '0.2.1',
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
        lastSnapshot: null,
        filter: 'all',
        query: '',
        sort: 'original',
        scope: 'all'
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
    border: 1px solid #d7dee7;
    border-radius: 14px;
    background: #fff;
    box-shadow: 0 4px 18px rgba(30, 41, 59, .07);
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
    padding: 13px 15px;
    border-bottom: 1px solid #edf0f4;
    background: #f8fafc;
}
#${APP_ID} .msa-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
    color: #172033;
}
#${APP_ID} .msa-title small {
    font-weight: 500;
    color: #64748b;
}
#${APP_ID} .msa-stats {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
}
#${APP_ID} .msa-stat {
    padding: 5px 9px;
    border: 1px solid #e2e8f0;
    border-radius: 999px;
    background: #fff;
    font-size: 12px;
    white-space: nowrap;
}
#${APP_ID} .msa-stat b { font-size: 13px; }
#${APP_ID} .msa-body {
    padding: 13px 15px;
}
#${APP_ID} .msa-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    margin-bottom: 9px;
}
#${APP_ID} .msa-row:last-child { margin-bottom: 0; }
#${APP_ID} button,
#${APP_ID} select,
#${APP_ID} input[type="search"] {
    min-height: 38px;
    border-radius: 9px;
    font: inherit;
}
#${APP_ID} button {
    border: 1px solid #cfd8e3;
    background: #fff;
    color: #1f2937;
    padding: 7px 12px;
    cursor: pointer;
    transition: .15s ease;
}
#${APP_ID} button:hover {
    background: #f8fafc;
    border-color: #b8c4d3;
}
#${APP_ID} button:disabled {
    opacity: .48;
    cursor: not-allowed;
}
#${APP_ID} .msa-primary {
    background: #117865;
    color: #fff;
    border-color: #117865;
    font-weight: 800;
}
#${APP_ID} .msa-primary:hover {
    background: #0d6756;
    border-color: #0d6756;
}
#${APP_ID} .msa-soft-danger {
    color: #a12a2a;
    border-color: #efcaca;
    background: #fff8f8;
}
#${APP_ID} select {
    border: 1px solid #cfd8e3;
    background: #fff;
    padding: 6px 10px;
    color: #1f2937;
}
#${APP_ID} input[type="search"] {
    flex: 1 1 250px;
    min-width: 200px;
    border: 1px solid #cfd8e3;
    padding: 7px 11px;
    outline: none;
}
#${APP_ID} input[type="search"]:focus {
    border-color: #7aa99f;
    box-shadow: 0 0 0 3px rgba(17, 120, 101, .08);
}
#${APP_ID} .msa-filter {
    padding: 6px 10px;
    min-height: 34px;
    font-size: 12px;
}
#${APP_ID} .msa-filter.is-active {
    background: #eef7f5;
    border-color: #97c5ba;
    color: #0e6655;
    font-weight: 700;
}
#${APP_ID} .msa-spacer { flex: 1 1 auto; }
#${APP_ID} .msa-hint {
    font-size: 12px;
    color: #64748b;
}
#${APP_ID} .msa-credit {
    margin-top: 10px;
    padding-top: 9px;
    border-top: 1px dashed #e2e8f0;
    font-size: 11px;
    color: #7a8798;
    text-align: left;
    direction: rtl;
}
#${APP_ID} .msa-credit strong {
    color: #475569;
}
#${APP_ID} .msa-toast {
    display: none;
    margin-top: 9px;
    padding: 8px 10px;
    border-radius: 9px;
    background: #eff8f5;
    color: #0d6756;
    font-size: 12px;
}
#${APP_ID} .msa-toast.is-visible { display: block; }

#${APP_ID} .msa-scope {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #475569;
}
#${APP_ID} .msa-scope input { margin: 0; }

.msa-row-hidden { display: none !important; }
.msa-student-row.msa-highlight-unset > td {
    background: rgba(245, 158, 11, .06);
}

@media (max-width: 768px) {
    #${APP_ID} .msa-head,
    #${APP_ID} .msa-body { padding: 11px; }
    #${APP_ID} button,
    #${APP_ID} select { flex: 1 1 auto; }
    #${APP_ID} input[type="search"] { flex-basis: 100%; }
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

        if (!radio.checked) {
            try {
                radio.click();
            } catch (_) {
                radio.checked = true;
            }
        }

        if (!radio.checked) radio.checked = true;

        radio.dispatchEvent(new Event('input', { bubbles: true }));
        radio.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
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

        // أولاً نفعّل الحالة الرئيسية الأصلية في مدرستي (حاضر/غائب/متأخر)
        dispatchRadio(main);

        // ثم نفعّل القيمة التفصيلية المطلوبة التي يعتمد عليها التحقق والحفظ.
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

    function restoreSnapshot(snapshotData) {
        if (!Array.isArray(snapshotData)) return;

        const byIndex = new Map(snapshotData.map(item => [item.index, item]));

        for (const student of state.students) {
            const old = byIndex.get(student.index);
            if (!old) continue;

            const statusDef = Object.values(STATUS).find(
                item => item.main === old.main && item.detail === old.detail
            );

            if (statusDef) {
                setStudentStatus(student, statusDef);
            } else {
                clearStudentStatus(student);
            }
        }

        updateAll();
    }

    function eligibleStudents() {
        if (state.scope !== 'visible') return state.students;
        return state.students.filter(student => !student.row.classList.contains('msa-row-hidden'));
    }

    function bulkSet(statusDef) {
        const targets = eligibleStudents();
        if (!targets.length) {
            toast('لا يوجد طلاب ضمن النطاق الحالي.');
            return;
        }

        state.lastSnapshot = snapshot();

        let success = 0;
        for (const student of targets) {
            if (setStudentStatus(student, statusDef)) success++;
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

        state.lastSnapshot = snapshot();

        let changed = 0;
        for (const student of targets) {
            if (clearStudentStatus(student)) changed++;
        }

        updateAll();
        toast(`تم مسح تحديد ${changed} طالب. زر حفظ مدرستي لن يقبل صفوفًا غير محددة.`);
    }

    function stats() {
        const counts = {
            total: state.students.length,
            present: 0,
            absent: 0,
            late: 0,
            unset: 0
        };

        for (const student of state.students) {
            const { kind } = readStudentStatus(student);
            if (kind in counts) counts[kind]++;
            else counts.unset++;
        }

        return counts;
    }

    function updateStats() {
        const root = q(`#${APP_ID}`);
        if (!root) return;

        const c = stats();
        const map = {
            total: c.total,
            present: c.present,
            absent: c.absent,
            late: c.late,
            unset: c.unset
        };

        for (const [key, value] of Object.entries(map)) {
            const el = q(`[data-stat="${key}"] b`, root);
            if (el) el.textContent = String(value);
        }

        const undoBtn = q('[data-action="undo"]', root);
        if (undoBtn) undoBtn.disabled = !state.lastSnapshot;

        for (const student of state.students) {
            student.row.classList.toggle(
                'msa-highlight-unset',
                readStudentStatus(student).kind === 'unset'
            );
        }
    }

    function studentMatchesFilter(student) {
        const status = readStudentStatus(student);

        if (state.filter === 'all') return true;
        if (state.filter === 'unset') return status.kind === 'unset';
        if (state.filter === 'present') return status.kind === 'present';
        if (state.filter === 'absent') return status.kind === 'absent';
        if (state.filter === 'late') return status.kind === 'late';

        return true;
    }

    function applyVisibility() {
        const queryText = normalizeArabic(state.query);

        for (const student of state.students) {
            const matchesQuery =
                !queryText ||
                student.normalizedName.includes(queryText) ||
                String(student.studentId).includes(queryText);

            const visible =
                matchesQuery &&
                studentMatchesFilter(student);

            student.row.classList.toggle('msa-row-hidden', !visible);
        }

        const visibleCount = state.students.filter(
            student => !student.row.classList.contains('msa-row-hidden')
        ).length;

        const hint = q(`#${APP_ID} [data-role="visible-hint"]`);
        if (hint) {
            hint.textContent = `المعروض الآن: ${visibleCount} من ${state.students.length}`;
        }
    }

    function statusRank(student, mode) {
        const kind = readStudentStatus(student).kind;

        const maps = {
            'unset-first': { unset: 0, absent: 1, late: 2, present: 3 },
            'absent-first': { absent: 0, late: 1, unset: 2, present: 3 },
            'late-first': { late: 0, absent: 1, unset: 2, present: 3 }
        };

        return maps[mode]?.[kind] ?? 9;
    }

    function applySort() {
        const mode = state.sort;
        let ordered = [...state.students];

        const ar = new Intl.Collator('ar', {
            sensitivity: 'base',
            numeric: true
        });

        if (mode === 'original') {
            ordered.sort((a, b) => a.originalOrder - b.originalOrder);
        } else if (mode === 'name-asc') {
            ordered.sort((a, b) => ar.compare(a.name, b.name));
        } else if (mode === 'name-desc') {
            ordered.sort((a, b) => ar.compare(b.name, a.name));
        } else if (['unset-first', 'absent-first', 'late-first'].includes(mode)) {
            ordered.sort((a, b) => {
                const rank = statusRank(a, mode) - statusRank(b, mode);
                return rank || ar.compare(a.name, b.name);
            });
        }

        // لا نفرز إلا إذا كانت جميع صفوف الطلاب تحت أب واحد.
        // أسماء الحقول List[i] تبقى كما هي دون أي إعادة ترقيم.
        if (!state.sortParent) return;

        for (const student of ordered) {
            state.sortParent.appendChild(student.row);
        }
    }

    function updateAll() {
        updateStats();
        applyVisibility();

        if (['unset-first', 'absent-first', 'late-first'].includes(state.sort)) {
            applySort();
        }
    }

    function toast(message) {
        const el = q(`#${APP_ID} [data-role="toast"]`);
        if (!el) return;

        el.textContent = message;
        el.classList.add('is-visible');

        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            el.classList.remove('is-visible');
        }, 3500);
    }

    function buildToolbar() {
        const root = document.createElement('section');
        root.id = APP_ID;
        root.setAttribute('aria-label', 'أدوات التحضير الذكي');
        root.innerHTML = `
            <div class="msa-head">
                <div class="msa-title">
                    <span>⚡ التحضير الذكي</span>
                    <small data-role="mode-label">أدوات مساعدة داخل صفحة التحضير فقط</small>
                </div>

                <div class="msa-stats">
                    <span class="msa-stat" data-stat="total">الطلاب <b>0</b></span>
                    <span class="msa-stat" data-stat="present">حاضر <b>0</b></span>
                    <span class="msa-stat" data-stat="absent">غائب <b>0</b></span>
                    <span class="msa-stat" data-stat="late">متأخر <b>0</b></span>
                    <span class="msa-stat" data-stat="unset">غير محدد <b>0</b></span>
                </div>
            </div>

            <div class="msa-body">
                <div class="msa-row">
                    <button type="button" class="msa-primary" data-action="all-present">
                        ✓ تحضير الكل حاضر
                    </button>

                    <select data-role="bulk-status" aria-label="حالة جماعية">
                        <option value="present">حاضر</option>
                        <option value="absent-excused">غائب بعذر</option>
                        <option value="absent-unexcused">غائب بدون عذر</option>
                        <option value="late-excused">متأخر بعذر</option>
                        <option value="late-unexcused">متأخر بدون عذر</option>
                    </select>

                    <button type="button" data-action="apply-bulk">تطبيق الحالة</button>

                    <button type="button" class="msa-soft-danger" data-action="clear">
                        مسح التحديد
                    </button>

                    <button type="button" data-action="undo" disabled>
                        ↶ تراجع
                    </button>

                    <span class="msa-spacer"></span>

                    <label class="msa-scope" title="عند تفعيله، العمليات الجماعية تطبق فقط على الصفوف الظاهرة بعد البحث/الفلترة">
                        <input type="checkbox" data-role="visible-only">
                        طبّق على الظاهر فقط
                    </label>
                </div>

                <div class="msa-row">
                    <input
                        type="search"
                        data-role="search"
                        placeholder="ابحث باسم الطالب أو رقمه..."
                        autocomplete="off"
                    >

                    <select data-role="sort" aria-label="فرز الطلاب">
                        <option value="original">الترتيب الأصلي</option>
                        <option value="name-asc">الاسم: أ ← ي</option>
                        <option value="name-desc">الاسم: ي ← أ</option>
                        <option value="unset-first">غير المحددين أولاً</option>
                        <option value="absent-first">الغائبون أولاً</option>
                        <option value="late-first">المتأخرون أولاً</option>
                    </select>
                </div>

                <div class="msa-row">
                    <button type="button" class="msa-filter is-active" data-filter="all">الكل</button>
                    <button type="button" class="msa-filter" data-filter="unset">غير محدد</button>
                    <button type="button" class="msa-filter" data-filter="present">حاضر</button>
                    <button type="button" class="msa-filter" data-filter="absent">غائب</button>
                    <button type="button" class="msa-filter" data-filter="late">متأخر</button>

                    <span class="msa-spacer"></span>
                    <span class="msa-hint" data-role="visible-hint"></span>
                </div>

                <div class="msa-hint" data-role="save-hint"></div>

                <div class="msa-credit">
                    تطوير: <strong>M0HM3D85</strong> — © 2026 جميع الحقوق محفوظة
                </div>

                <div class="msa-toast" data-role="toast"></div>
            </div>
        `;

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
            if (modeLabel) {
                modeLabel.textContent =
                    'وضع تعديل الحضور المحفوظ — يدعم صفوف الحفظ الفردية';
            }

            if (saveHint) {
                saveHint.textContent =
                    'هذه الحصة في وضع التعديل الفردي: الأدوات تغيّر الحالات جماعيًا، لكن مدرستي تعرض زر «حفظ» مستقل لكل طالب.';
            }
        } else {
            if (modeLabel) {
                modeLabel.textContent =
                    'وضع التحضير الجماعي الأولي';
            }

            if (saveHint) {
                saveHint.textContent =
                    'بعد المراجعة استخدم زر «حفظ» الأصلي في مدرستي.';
            }
        }
    }

    function bindToolbar(root) {
        q('[data-action="all-present"]', root).addEventListener('click', () => {
            bulkSet(STATUS.PRESENT);
        });

        q('[data-action="apply-bulk"]', root).addEventListener('click', () => {
            const key = q('[data-role="bulk-status"]', root).value;
            const statusDef = Object.values(STATUS).find(item => item.key === key);
            if (statusDef) bulkSet(statusDef);
        });

        q('[data-action="clear"]', root).addEventListener('click', bulkClear);

        q('[data-action="undo"]', root).addEventListener('click', () => {
            if (!state.lastSnapshot) return;
            const previous = state.lastSnapshot;
            state.lastSnapshot = null;
            restoreSnapshot(previous);
            toast('تم التراجع عن آخر عملية جماعية.');
        });

        q('[data-role="visible-only"]', root).addEventListener('change', event => {
            state.scope = event.target.checked ? 'visible' : 'all';
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

        qa('[data-filter]', root).forEach(button => {
            button.addEventListener('click', () => {
                state.filter = button.dataset.filter || 'all';

                qa('[data-filter]', root).forEach(btn => {
                    btn.classList.toggle('is-active', btn === button);
                });

                applyVisibility();
            });
        });

        // أي تغيير يدوي في راديوهات مدرستي يحدث الإحصاءات فورًا.
        const eventRoot = state.eventRoot || state.form || document;
        eventRoot.addEventListener('change', event => {
            if (
                event.target.matches?.('input[type="radio"][name^="Attend["]') ||
                event.target.matches?.('input[type="radio"][name^="List["][name$=".AttendStatusId"]')
            ) {
                updateAll();
            }
        });
    }

    function init() {
        const context = detectContext();
        if (!context) return false;

        // لا يكفي أن يكون form نفسه موجودًا؛ مدرستي قد تستبدل صفوف الطلاب داخله عبر Ajax.
        const oldRoot = q(`#${APP_ID}`);
        const sameRows =
            state.students.length === context.students.length &&
            state.students.every((oldStudent, i) =>
                oldStudent.row === context.students[i]?.row &&
                document.contains(oldStudent.row)
            );

        const sameContext =
            oldRoot &&
            document.contains(oldRoot) &&
            state.contextKey === context.contextKey &&
            sameRows;

        if (sameContext) return true;

        if (oldRoot) oldRoot.remove();

        state = {
            ...state,
            ...context,
            originalOrder: context.students.map(s => s.index),
            lastSnapshot: null,
            filter: 'all',
            query: '',
            sort: 'original',
            scope: 'all'
        };

        injectStyle();

        const root = buildToolbar();
        insertToolbar(root);
        bindToolbar(root);
        updateModeUi(root);
        updateAll();

        console.info(
            `[Madrasati Smart Attendance v0.2.1] جاهز — تم اكتشاف ${state.students.length} طالب.`,
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
