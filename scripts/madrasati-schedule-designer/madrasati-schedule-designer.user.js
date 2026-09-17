// ==UserScript==
// @name         مدرستي - مصمم الجدول الدراسي الاحترافي
// @namespace    https://greasyfork.org/users/1636459
// @version      1.4.1
// @description  مصمم احترافي لجدول المعلم أو الطالب في مدرستي مع تنظيف مسميات المواد والتخصيص والطباعة/PDF وحفظ PNG والتصدير إلى Excel والنسخ.
// @author       Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @match        https://schools.madrasati.sa/SchoolSchedule/Schedule/TeacherSchedule*
// @match        https://schools.madrasati.sa/SchoolSchedule/Schedule/StudentSchedule*
// @run-at       document-idle
// @require      https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/592421/%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20-%20%D9%85%D8%B5%D9%85%D9%85%20%D8%A7%D9%84%D8%AC%D8%AF%D9%88%D9%84%20%D8%A7%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D9%8A%20%D8%A7%D9%84%D8%A7%D8%AD%D8%AA%D8%B1%D8%A7%D9%81%D9%8A.user.js
// @updateURL https://update.greasyfork.org/scripts/592421/%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20-%20%D9%85%D8%B5%D9%85%D9%85%20%D8%A7%D9%84%D8%AC%D8%AF%D9%88%D9%84%20%D8%A7%D9%84%D8%AF%D8%B1%D8%A7%D8%B3%D9%8A%20%D8%A7%D9%84%D8%A7%D8%AD%D8%AA%D8%B1%D8%A7%D9%81%D9%8A.meta.js
// ==/UserScript==

/*
=========================================================================
 مدرستي - مصمم الجدول الدراسي الاحترافي

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

    /*
     * v1.4.1
     * - تنظيف «متزامن» و«غير متزامن» من اسم مادة الطالب.
     * - التنظيف يتم قبل بناء الألوان والمعاينة والتصدير.
     * - لا يتم حذف «(نشاط)» أو أي نص آخر من اسم المادة.
     */

    const APP_ID = 'm0hm3d85-schedule-designer';
    const OPEN_ID = 'm0hm3d85-open-schedule';
    const STYLE_ID = 'm0hm3d85-schedule-style';
    const TOAST_ID = 'm0hm3d85-schedule-toast';

    const path = location.pathname.toLowerCase();
    const isTeacher = path.includes('/teacherschedule');
    const isStudent = path.includes('/studentschedule');

    if (!isTeacher && !isStudent) return;

    const ROLE = isTeacher ? 'teacher' : 'student';

    // إبقاء المفتاح v13 يحافظ على إعدادات النسخة السابقة إن وُجدت.
    const STORAGE_KEY =
        `m0hm3d85_schedule_designer_v13_${ROLE}`;

    const PALETTE = [
        ['#EAF3FF', '#8DBCF4', '#163B66', '#3B82F6'],
        ['#EAFBF3', '#86D9AF', '#165B3A', '#22A06B'],
        ['#FFF4E7', '#F5C37D', '#72420B', '#F59E0B'],
        ['#F4EEFF', '#BCA4F4', '#4A2A7A', '#8B5CF6'],
        ['#FFEFF4', '#F3A8BD', '#74233C', '#E85D85'],
        ['#E9FAFB', '#84D7DB', '#15545A', '#19A7AE'],
        ['#FFF9DF', '#E9D36A', '#65530B', '#C9A90A'],
        ['#EEF7EA', '#A9D58D', '#355B22', '#6AA84F'],
        ['#FDEEEE', '#EFB0B0', '#6E2525', '#D65A5A'],
        ['#EEF1FF', '#AAB6EE', '#2C3C78', '#6376D9'],
        ['#F7F0E9', '#D9B99A', '#67462A', '#B37A49'],
        ['#EDF8FF', '#9CCFEA', '#24556E', '#4598C4']
    ].map(
        ([bg, border, text, accent]) => ({
            bg,
            border,
            text,
            accent
        })
    );

    const SUBJECT_ACCENTS = [
        '#2563EB',
        '#059669',
        '#D97706',
        '#7C3AED',
        '#DB2777',
        '#0891B2',
        '#65A30D',
        '#DC2626',
        '#4F46E5',
        '#0F766E',
        '#A16207',
        '#9333EA'
    ];

    const ORDINALS = [
        'الأولى',
        'الثانية',
        'الثالثة',
        'الرابعة',
        'الخامسة',
        'السادسة',
        'السابعة',
        'الثامنة',
        'التاسعة',
        'العاشرة'
    ];

    const defaultPrefs = () => ({
        name: '',
        school: '',
        stage: '',
        className: '',
        specialty: '',
        academicYear: '',
        week: '',

        title:
            isTeacher
                ? 'الجدول الدراسي الأسبوعي للمعلم'
                : 'الجدول الدراسي الأسبوعي للطالب',

        note: '',

        showLegend: true,
        showSecondary: true,
        showSubjectAccent: true,

        dense: false,
        monochrome: false,
        remember: true,

        times: [],
        logoDataUrl: ''
    });

    const loadPrefs = () => {

        const base =
            defaultPrefs();

        try {

            return {
                ...base,

                ...JSON.parse(
                    localStorage.getItem(
                        STORAGE_KEY
                    ) || '{}'
                )
            };

        } catch (_) {

            return base;
        }
    };

    const state = {
        data: null,
        prefs: loadPrefs(),
        logoDataUrl: ''
    };

    function savePrefs() {

        /*
         * إذا ألغى المستخدم خيار حفظ بياناته
         * نحذف البيانات المحفوظة سابقًا.
         */
        if (
            !state.prefs.remember
        ) {

            try {

                localStorage.removeItem(
                    STORAGE_KEY
                );

            } catch (_) {}

            return;
        }

        try {

            localStorage.setItem(
                STORAGE_KEY,

                JSON.stringify({
                    ...state.prefs,

                    logoDataUrl:
                        state.logoDataUrl &&
                        state.logoDataUrl.length < 700000

                            ? state.logoDataUrl
                            : ''
                })
            );

        } catch (_) {}
    }

    function clean(
        value = ''
    ) {

        return String(value)
            .replace(
                /\s+/g,
                ' '
            )
            .trim();
    }


    /*
     * تنظيف اسم المادة من وصف نوع اللقاء الذي تضيفه مدرستي
     * داخل نفس عنصر اسم المادة في بعض جداول الطلاب:
     *
     * الرياضيات - غير متزامن  →  الرياضيات
     * العلوم - متزامن          →  العلوم
     *
     * يتم التنظيف عند الاستخراج نفسه، لذلك ينعكس تلقائيًا
     * على المعاينة والألوان والطباعة وPNG والنسخ وExcel.
     */
    function cleanSubjectName(
        value = ''
    ) {

        return clean(value)
            .replace(
                /\s*[-–—]\s*غير\s+متزامن\s*$/u,
                ''
            )
            .replace(
                /\s*[-–—]\s*متزامن\s*$/u,
                ''
            )
            .trim();
    }

    function canonical(
        value = ''
    ) {

        return clean(value)
            .replace(
                /[ًٌٍَُِّْـ]/g,
                ''
            )
            .replace(
                /[()[\]{}]/g,
                ''
            )
            .replace(
                /[–—]/g,
                '-'
            )
            .trim();
    }

    function esc(
        value = ''
    ) {

        return String(value)
            .replace(
                /&/g,
                '&amp;'
            )
            .replace(
                /</g,
                '&lt;'
            )
            .replace(
                />/g,
                '&gt;'
            )
            .replace(
                /"/g,
                '&quot;'
            )
            .replace(
                /'/g,
                '&#039;'
            );
    }

    function periodTitle(
        label,
        index
    ) {

        const text =
            clean(label);

        if (!text) {

            return (
                `الحصة ${
                    ORDINALS[index] ||
                    index + 1
                }`
            );
        }

        return /^الحصة\s/.test(text)
            ? text
            : `الحصة ${text}`;
    }

    function splitStudentMeta(
        text
    ) {

        const raw =
            clean(text);

        if (!raw) {

            return {
                className: '',
                teacher: ''
            };
        }

        const parts =
            raw.split(
                /\s+-\s+/
            );

        if (
            parts.length >= 2
        ) {

            return {
                className:
                    clean(
                        parts.shift()
                    ),

                teacher:
                    clean(
                        parts.join(
                            ' - '
                        )
                    )
            };
        }

        return {
            className: '',
            teacher: raw
        };
    }

    function extractSchedule() {

        const table =
            document.querySelector(
                '#reservations'
            );

        if (!table) {
            return null;
        }

        let periodLabels = [
            ...table.querySelectorAll(
                'thead tr:first-child th'
            )
        ]
            .slice(1)
            .map(
                (
                    th,
                    index
                ) =>
                    clean(
                        th.textContent
                    ) ||

                    `الحصة ${
                        ORDINALS[index] ||
                        index + 1
                    }`
            );

        const rows = [
            ...table.querySelectorAll(
                'tbody > tr'
            )
        ];

        if (
            !periodLabels.length &&
            rows.length
        ) {

            const count =
                Math.max(
                    0,
                    rows[0]
                        .children
                        .length - 1
                );

            periodLabels =
                Array.from(
                    {
                        length:
                            count
                    },

                    (
                        _,
                        index
                    ) =>
                        `الحصة ${
                            ORDINALS[index] ||
                            index + 1
                        }`
                );
        }

        const periods =
            periodLabels.length;

        const periodTimes =
            Array.from(
                {
                    length:
                        periods
                },

                () =>
                    new Set()
            );

        const days = [];
        const classes = [];

        rows.forEach(
            (
                row,
                dayIndex
            ) => {

                const cells = [
                    ...row.querySelectorAll(
                        ':scope > th, :scope > td'
                    )
                ];

                if (!cells.length) {
                    return;
                }

                const dayName =
                    clean(
                        cells[0]
                            ?.textContent
                    ) ||

                    [
                        'الأحد',
                        'الاثنين',
                        'الثلاثاء',
                        'الأربعاء',
                        'الخميس'
                    ][dayIndex] ||

                    `اليوم ${
                        dayIndex + 1
                    }`;

                const lessons = [];

                for (
                    let periodIndex = 0;
                    periodIndex < periods;
                    periodIndex++
                ) {

                    const cell =
                        cells[
                            periodIndex + 1
                        ];

                    if (!cell) {

                        lessons.push({
                            subject: '',
                            secondary: '',
                            className: '',
                            teacher: '',
                            time: ''
                        });

                        continue;
                    }

                    /*
                     * جدول المعلم.
                     */
                    if (
                        isTeacher
                    ) {

                        const cards = [
                            ...cell.querySelectorAll(
                                '.cs-lesson-card'
                            )
                        ];

                        const subjects = [];
                        const classNames = [];

                        const targets =
                            cards.length

                                ? cards
                                : [cell];

                        targets.forEach(
                            card => {

                                const subject =
                                    clean(
                                        card
                                            .querySelector(
                                                '.schedule-card .title h2'
                                            )
                                            ?.textContent ||
                                        ''
                                    );

                                const className =
                                    clean(
                                        card
                                            .querySelector(
                                                '.schedule-card small'
                                            )
                                            ?.textContent ||
                                        ''
                                    );

                                if (subject) {

                                    subjects.push(
                                        subject
                                    );
                                }

                                if (className) {

                                    classNames.push(
                                        className
                                    );

                                    classes.push(
                                        className
                                    );
                                }
                            }
                        );

                        const uniqueSubjects = [
                            ...new Set(
                                subjects
                            )
                        ];

                        const uniqueClasses = [
                            ...new Set(
                                classNames
                            )
                        ];

                        lessons.push({
                            subject:
                                uniqueSubjects.join(
                                    ' / '
                                ),

                            secondary:
                                uniqueClasses.join(
                                    ' / '
                                ),

                            className:
                                uniqueClasses.join(
                                    ' / '
                                ),

                            teacher: '',
                            time: ''
                        });
                    }

                    /*
                     * جدول الطالب.
                     */
                    else {

                        const subject =
                            cleanSubjectName(
                                cell
                                    .querySelector(
                                        'h6.text-black.fw-bold'
                                    )
                                    ?.textContent ||

                                cell
                                    .querySelector(
                                        'h6'
                                    )
                                    ?.textContent ||

                                ''
                            );

                        const meta =
                            splitStudentMeta(
                                cell
                                    .querySelector(
                                        'p.d-block'
                                    )
                                    ?.textContent ||
                                ''
                            );

                        const time =
                            clean(
                                cell
                                    .querySelector(
                                        'span[id^="xxx_"]'
                                    )
                                    ?.textContent ||
                                ''
                            );

                        if (time) {

                            periodTimes[
                                periodIndex
                            ].add(
                                time
                            );
                        }

                        if (
                            meta.className
                        ) {

                            classes.push(
                                meta.className
                            );
                        }

                        lessons.push({
                            subject,
                            secondary:
                                meta.teacher,
                            className:
                                meta.className,
                            teacher:
                                meta.teacher,
                            time
                        });
                    }
                }

                days.push({
                    name:
                        dayName,

                    lessons
                });
            }
        );

        const times =
            periodTimes.map(
                set =>
                    [...set][0] ||
                    ''
            );

        /*
         * جدول المعلم لا يعرض الوقت في الصفحة غالبًا،
         * لذلك نعيد الأوقات المحفوظة من المستخدم.
         */
        if (
            Array.isArray(
                state.prefs.times
            )
        ) {

            state.prefs.times
                .forEach(
                    (
                        value,
                        index
                    ) => {

                        if (
                            index < periods &&
                            value &&
                            !times[index]
                        ) {

                            times[index] =
                                value;
                        }
                    }
                );
        }

        const uniqueClasses = [
            ...new Set(
                classes
                    .map(
                        clean
                    )
                    .filter(
                        Boolean
                    )
            )
        ];

        return {
            type:
                ROLE,

            periods,
            periodLabels,
            times,
            days,

            commonClass:
                uniqueClasses.length === 1

                    ? uniqueClasses[0]
                    : '',

            week:
                clean(
                    document
                        .querySelector(
                            '#lblPeriodSchedule'
                        )
                        ?.textContent ||
                    ''
                )
        };
    }

    function hydrateDefaults(
        data
    ) {

        if (
            !state.prefs.week &&
            data.week
        ) {

            state.prefs.week =
                data.week;
        }

        if (
            isStudent &&
            !state.prefs.className &&
            data.commonClass
        ) {

            state.prefs.className =
                data.commonClass;
        }

        if (
            !state.prefs.title
        ) {

            state.prefs.title =
                isTeacher

                    ? 'الجدول الدراسي الأسبوعي للمعلم'

                    : 'الجدول الدراسي الأسبوعي للطالب';
        }

        state.logoDataUrl =
            state.prefs.logoDataUrl ||
            '';
    }

    function collectUnique(
        data,
        getter
    ) {

        const result = [];
        const seen =
            new Set();

        data.days
            .forEach(
                day => {

                    day.lessons
                        .forEach(
                            lesson => {

                                const value =
                                    clean(
                                        getter(
                                            lesson
                                        )
                                    );

                                const key =
                                    canonical(
                                        value
                                    );

                                if (
                                    value &&
                                    !seen.has(
                                        key
                                    )
                                ) {

                                    seen.add(
                                        key
                                    );

                                    result.push(
                                        value
                                    );
                                }
                            }
                        );
                }
            );

        return result;
    }

    function assignColors(
        keys
    ) {

        const map =
            new Map();

        keys
            .filter(
                Boolean
            )
            .forEach(
                key => {

                    const normalized =
                        canonical(
                            key
                        );

                    if (
                        !map.has(
                            normalized
                        )
                    ) {

                        map.set(
                            normalized,

                            PALETTE[
                                map.size %
                                PALETTE.length
                            ]
                        );
                    }
                }
            );

        return map;
    }

    function assignSubjectAccents(
        subjects
    ) {

        const map =
            new Map();

        subjects
            .filter(
                Boolean
            )
            .forEach(
                subject => {

                    const normalized =
                        canonical(
                            subject
                        );

                    if (
                        !map.has(
                            normalized
                        )
                    ) {

                        map.set(
                            normalized,

                            SUBJECT_ACCENTS[
                                map.size %
                                SUBJECT_ACCENTS.length
                            ]
                        );
                    }
                }
            );

        return map;
    }

    function buildPreview() {

        const data =
            state.data;

        const prefs =
            state.prefs;

        /*
         * المعلم = الألوان حسب الفصول.
         * الطالب = الألوان حسب المواد.
         */
        const colorKeys =
            isTeacher

                ? collectUnique(
                    data,
                    lesson =>
                        lesson.className
                )

                : collectUnique(
                    data,
                    lesson =>
                        lesson.subject
                );

        const colorMap =
            assignColors(
                colorKeys
            );

        const subjects =
            collectUnique(
                data,
                lesson =>
                    lesson.subject
            );

        const subjectAccentMap =
            assignSubjectAccents(
                subjects
            );

        const multipleTeacherSubjects =
            isTeacher &&
            subjects.length > 1;

        const metaItems = [];

        if (
            prefs.name
        ) {

            metaItems.push({
                label:
                    isTeacher
                        ? 'المعلم'
                        : 'الطالب',

                value:
                    prefs.name
            });
        }

        if (
            prefs.school
        ) {

            metaItems.push({
                label:
                    'المدرسة',

                value:
                    prefs.school
            });
        }

        if (
            prefs.stage
        ) {

            metaItems.push({
                label:
                    'المرحلة',

                value:
                    prefs.stage
            });
        }

        if (
            prefs.className
        ) {

            metaItems.push({
                label:
                    'الصف / الفصل',

                value:
                    prefs.className
            });
        }

        if (
            isTeacher &&
            prefs.specialty
        ) {

            metaItems.push({
                label:
                    'التخصص',

                value:
                    prefs.specialty
            });
        }

        if (
            prefs.academicYear
        ) {

            metaItems.push({
                label:
                    'العام الدراسي',

                value:
                    prefs.academicYear
            });
        }

        const legend =
            colorKeys
                .map(
                    key => {

                        const color =
                            colorMap.get(
                                canonical(
                                    key
                                )
                            );

                        return `
                            <span class="m0-legend-item">

                                <i
                                    style="
                                        background:${
                                            prefs.monochrome
                                                ? '#777'
                                                : color.accent
                                        }
                                    "
                                ></i>

                                ${esc(key)}

                            </span>
                        `;
                    }
                )
                .join('');

        const subjectLegend =
            multipleTeacherSubjects &&
            prefs.showSubjectAccent

                ? `
                    <div class="m0-subject-legend">

                        <span class="m0-legend-title">
                            تمييز المواد:
                        </span>

                        ${
                            subjects
                                .map(
                                    subject => `

                                        <span class="m0-legend-item tiny">

                                            <i
                                                style="
                                                    background:${
                                                        prefs.monochrome
                                                            ? '#777'
                                                            : subjectAccentMap.get(
                                                                canonical(
                                                                    subject
                                                                )
                                                            )
                                                    }
                                                "
                                            ></i>

                                            ${esc(subject)}

                                        </span>
                                    `
                                )
                                .join('')
                        }

                    </div>
                `

                : '';

        const header =
            data.periodLabels
                .map(
                    (
                        label,
                        index
                    ) => `

                        <th>

                            <div class="m0-period-title">
                                ${
                                    esc(
                                        periodTitle(
                                            label,
                                            index
                                        )
                                    )
                                }
                            </div>

                            <div
                                class="
                                    m0-period-time
                                    ${
                                        data.times[index]
                                            ? ''
                                            : 'empty'
                                    }
                                "
                                contenteditable="true"
                                data-time-index="${index}"
                                title="اضغط لتعديل الوقت"
                            >
                                ${
                                    esc(
                                        data.times[index] ||
                                        'أضف الوقت'
                                    )
                                }
                            </div>

                        </th>
                    `
                )
                .join('');

        const body =
            data.days
                .map(
                    (
                        day,
                        dayIndex
                    ) => {

                        const cells =
                            day.lessons
                                .map(
                                    (
                                        lesson,
                                        periodIndex
                                    ) => {

                                        if (
                                            !lesson.subject
                                        ) {

                                            return `
                                                <td class="m0-empty-cell">
                                                    <span>—</span>
                                                </td>
                                            `;
                                        }

                                        const key =
                                            isTeacher

                                                ? lesson.className

                                                : lesson.subject;

                                        const color =
                                            colorMap.get(
                                                canonical(
                                                    key
                                                )
                                            ) ||
                                            PALETTE[0];

                                        const bg =
                                            prefs.monochrome

                                                ? '#F5F5F5'

                                                : color.bg;

                                        const border =
                                            prefs.monochrome

                                                ? '#BDBDBD'

                                                : color.border;

                                        const text =
                                            prefs.monochrome

                                                ? '#222'

                                                : color.text;

                                        const accent =
                                            prefs.monochrome

                                                ? '#666'

                                                : (
                                                    subjectAccentMap.get(
                                                        canonical(
                                                            lesson.subject
                                                        )
                                                    ) ||
                                                    color.accent
                                                );

                                        const secondary =
                                            prefs.showSecondary &&
                                            lesson.secondary

                                                ? `
                                                    <div
                                                        class="m0-lesson-secondary"
                                                        contenteditable="true"
                                                        data-edit="secondary"
                                                        data-day="${dayIndex}"
                                                        data-period="${periodIndex}"
                                                    >
                                                        ${
                                                            esc(
                                                                lesson.secondary
                                                            )
                                                        }
                                                    </div>
                                                `

                                                : '';

                                        const topAccent =
                                            multipleTeacherSubjects &&
                                            prefs.showSubjectAccent

                                                ? `
                                                    <span
                                                        class="m0-subject-accent"
                                                        style="
                                                            background:${accent}
                                                        "
                                                    ></span>
                                                `

                                                : '';

                                        return `
                                            <td>

                                                <div
                                                    class="m0-lesson-card"
                                                    style="
                                                        --cell-bg:${bg};
                                                        --cell-border:${border};
                                                        --cell-text:${text};
                                                    "
                                                >

                                                    ${topAccent}

                                                    <div
                                                        class="m0-lesson-subject"
                                                        contenteditable="true"
                                                        data-edit="subject"
                                                        data-day="${dayIndex}"
                                                        data-period="${periodIndex}"
                                                    >
                                                        ${
                                                            esc(
                                                                lesson.subject
                                                            )
                                                        }
                                                    </div>

                                                    ${secondary}

                                                </div>

                                            </td>
                                        `;
                                    }
                                )
                                .join('');

                        return `
                            <tr>

                                <th class="m0-day-cell">

                                    <span>
                                        ${esc(day.name)}
                                    </span>

                                </th>

                                ${cells}

                            </tr>
                        `;
                    }
                )
                .join('');

        const logo =
            state.logoDataUrl

                ? `
                    <img
                        class="m0-logo-img"
                        src="${state.logoDataUrl}"
                        alt="الشعار"
                    >
                `

                : `
                    <div class="m0-logo-placeholder">
                        م
                    </div>
                `;

        return `
            <section
                id="m0-print-area"
                class="
                    m0-sheet
                    ${
                        prefs.dense
                            ? 'dense'
                            : ''
                    }
                "
            >

                <div class="m0-topbar"></div>

                <header class="m0-sheet-header">

                    <div class="m0-brand-side">
                        ${logo}
                    </div>

                    <div class="m0-title-side">

                        <div class="m0-kicker">
                            ${
                                isTeacher
                                    ? 'جدول المعلم'
                                    : 'جدول الطالب'
                            }
                        </div>

                        <h1>
                            ${esc(prefs.title || '')}
                        </h1>

                        ${
                            metaItems.length

                                ? `
                                    <div class="m0-meta">

                                        ${
                                            metaItems
                                                .map(
                                                    item => `
                                                        <span>
                                                            <b>
                                                                ${esc(item.label)}:
                                                            </b>

                                                            ${esc(item.value)}
                                                        </span>
                                                    `
                                                )
                                                .join('')
                                        }

                                    </div>
                                `

                                : ''
                        }

                    </div>

                    <div class="m0-week-side">

                        ${
                            prefs.week

                                ? `
                                    <div class="m0-week-box">

                                        <small>
                                            الفترة
                                        </small>

                                        <strong>
                                            ${esc(prefs.week)}
                                        </strong>

                                    </div>
                                `

                                : ''
                        }

                    </div>

                </header>

                ${
                    prefs.showLegend &&
                    legend

                        ? `
                            <div class="m0-legend">

                                <span class="m0-legend-title">
                                    ${
                                        isTeacher
                                            ? 'ألوان الفصول:'
                                            : 'ألوان المواد:'
                                    }
                                </span>

                                ${legend}

                            </div>

                            ${subjectLegend}
                        `

                        : ''
                }

                <div class="m0-table-wrap">

                    <table class="m0-schedule-table">

                        <thead>

                            <tr>

                                <th class="m0-day-head">
                                    اليوم
                                </th>

                                ${header}

                            </tr>

                        </thead>

                        <tbody>
                            ${body}
                        </tbody>

                    </table>

                </div>

                ${
                    prefs.note

                        ? `
                            <div class="m0-note">
                                ${esc(prefs.note)}
                            </div>
                        `

                        : ''
                }

                <footer class="m0-footer">

                    <span>
                        إخراج منسق للجدول الدراسي
                    </span>

                    <strong>
                        M0HM3D85
                    </strong>

                </footer>

            </section>
        `;
    }

    const BASE_CSS = `

        #${APP_ID},
        #${APP_ID} * {
            box-sizing:border-box;
        }

        #${APP_ID} {
            position:fixed;
            inset:0;
            z-index:2147483646;
            direction:rtl;
            font-family:Tahoma,Arial,sans-serif;
        }

        #${APP_ID} .m0-backdrop {
            position:absolute;
            inset:0;
            background:rgba(15,23,42,.62);
            backdrop-filter:blur(6px);
        }

        #${APP_ID} .m0-app {
            position:absolute;
            inset:2.3vh 1.4vw;
            background:#F4F7FB;
            border-radius:22px;
            overflow:hidden;
            display:grid;
            grid-template-columns:340px minmax(0,1fr);
            box-shadow:0 30px 80px rgba(0,0,0,.28);
        }

        #${APP_ID} .m0-panel {
            background:#fff;
            border-left:1px solid #E5EAF1;
            overflow:auto;
            padding:22px;
        }

        #${APP_ID} button {
            font-family:inherit;
        }

        #${APP_ID} .m0-panel-head {
            display:flex;
            align-items:center;
            justify-content:space-between;
            gap:12px;
            margin-bottom:18px;
        }

        #${APP_ID} .m0-panel-head h2 {
            margin:0;
            font-size:19px;
            color:#142033;
        }

        #${APP_ID} .m0-close {
            width:38px;
            height:38px;
            border:0;
            border-radius:11px;
            background:#F2F4F7;
            color:#39475B;
            cursor:pointer;
            font-size:22px;
        }

        #${APP_ID} .m0-field {
            margin-bottom:12px;
        }

        #${APP_ID} .m0-field label {
            display:block;
            font-size:12px;
            color:#5B6677;
            margin-bottom:6px;
            font-weight:700;
        }

        #${APP_ID} .m0-field input,
        #${APP_ID} .m0-field textarea {
            width:100%;
            border:1px solid #DCE2EA;
            border-radius:10px;
            padding:10px 11px;
            outline:none;
            background:#FBFCFE;
            font:inherit;
            font-size:13px;
            color:#1F2937;
            transition:.18s;
        }

        #${APP_ID} .m0-field input:focus,
        #${APP_ID} .m0-field textarea:focus {
            border-color:#55A8C8;
            box-shadow:0 0 0 3px rgba(85,168,200,.12);
            background:#fff;
        }

        #${APP_ID} .m0-field textarea {
            resize:vertical;
            min-height:62px;
        }

        #${APP_ID} .m0-grid2 {
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:10px;
        }

        #${APP_ID} .m0-section-title {
            margin:18px 0 10px;
            font-size:13px;
            color:#26364D;
            font-weight:800;
            display:flex;
            align-items:center;
            gap:7px;
        }

        #${APP_ID} .m0-section-title::before {
            content:"";
            width:4px;
            height:14px;
            border-radius:3px;
            background:#3AA6A0;
        }

        #${APP_ID} .m0-check {
            display:flex;
            align-items:center;
            gap:8px;
            font-size:12px;
            color:#455268;
            margin:9px 0;
            cursor:pointer;
        }

        #${APP_ID} .m0-check input {
            accent-color:#2A9D8F;
        }

        #${APP_ID} .m0-times {
            display:grid;
            gap:7px;
        }

        #${APP_ID} .m0-time-row {
            display:grid;
            grid-template-columns:88px 1fr;
            align-items:center;
            gap:7px;
        }

        #${APP_ID} .m0-time-row span {
            font-size:11px;
            color:#687588;
        }

        #${APP_ID} .m0-time-row input {
            width:100%;
            border:1px solid #DCE2EA;
            border-radius:8px;
            padding:7px 8px;
            font-size:11px;
        }

        #${APP_ID} .m0-upload {
            display:flex;
            gap:8px;
            align-items:center;
            flex-wrap:wrap;
        }

        #${APP_ID} .m0-upload input[type=file] {
            display:none;
        }

        #${APP_ID} .m0-small-btn {
            border:1px solid #D9E1EA;
            background:#fff;
            padding:8px 10px;
            border-radius:9px;
            cursor:pointer;
            font:inherit;
            font-size:12px;
            color:#354154;
        }

        #${APP_ID} .m0-logo-status {
            width:100%;
            font-size:10px;
            color:#778397;
            overflow:hidden;
            text-overflow:ellipsis;
            white-space:nowrap;
        }

        #${APP_ID} .m0-update {
            margin-top:18px;
        }

        #${APP_ID} .m0-update button {
            width:100%;
            border:0;
            border-radius:12px;
            padding:12px 10px;
            cursor:pointer;
            font-size:13px;
            font-weight:900;
            background:linear-gradient(
                135deg,
                #2A9D8F,
                #238A7F
            );
            color:#fff;
            box-shadow:0 7px 18px rgba(42,157,143,.18);
        }

        #${APP_ID} .m0-actions {
            margin:14px -22px -22px;
            padding:13px 18px;
            background:#fff;
            border-top:1px solid #E6EBF1;
            display:grid;
            grid-template-columns:1fr 1fr;
            gap:8px;
            position:sticky;
            bottom:-22px;
            z-index:5;
        }

        #${APP_ID} .m0-action {
            border:0;
            border-radius:11px;
            padding:10px 8px;
            cursor:pointer;
            font-size:12px;
            font-weight:800;
            background:#EDF2F7;
            color:#2B374A;
        }

        #${APP_ID} .m0-action.primary {
            background:#123D5A;
            color:#fff;
        }

        #${APP_ID} .m0-action.accent {
            background:#2A9D8F;
            color:#fff;
        }

        #${APP_ID} .m0-preview-area {
            overflow:auto;
            padding:28px;
            display:flex;
            justify-content:center;
            align-items:flex-start;
        }

        #${APP_ID} .m0-hint {
            position:absolute;
            left:24px;
            bottom:17px;
            background:#1D2B3D;
            color:#fff;
            padding:7px 11px;
            border-radius:9px;
            font-size:11px;
            opacity:.88;
            pointer-events:none;
        }

        #${APP_ID} .m0-sheet {
            width:1120px;
            min-height:760px;
            background:#fff;
            border-radius:16px;
            padding:34px 34px 20px;
            box-shadow:0 18px 50px rgba(30,50,75,.12);
            color:#172033;
            position:relative;
            overflow:hidden;
        }

        #${APP_ID} .m0-topbar {
            position:absolute;
            top:0;
            right:0;
            left:0;
            height:7px;
            background:linear-gradient(
                90deg,
                #173F5F,
                #2A9D8F,
                #68B0AB
            );
        }

        #${APP_ID} .m0-sheet-header {
            display:grid;
            grid-template-columns:120px 1fr 180px;
            gap:18px;
            align-items:center;
            margin-bottom:16px;
        }

        #${APP_ID} .m0-brand-side {
            display:flex;
            align-items:center;
            justify-content:flex-start;
        }

        #${APP_ID} .m0-logo-img,
        #${APP_ID} .m0-logo-placeholder {
            width:70px;
            height:70px;
            border-radius:16px;
            background:#F2F6F8;
            border:1px solid #E2E9EE;
            object-fit:contain;
        }

        #${APP_ID} .m0-logo-placeholder {
            display:grid;
            place-items:center;
            font-size:29px;
            font-weight:900;
            color:#2A9D8F;
        }

        #${APP_ID} .m0-title-side {
            text-align:center;
        }

        #${APP_ID} .m0-kicker {
            display:inline-block;
            padding:4px 10px;
            background:#EDF7F7;
            border-radius:999px;
            color:#287B77;
            font-size:11px;
            font-weight:800;
            margin-bottom:7px;
        }

        #${APP_ID} .m0-title-side h1 {
            margin:0 0 8px;
            font-size:27px;
            color:#153A55;
        }

        #${APP_ID} .m0-meta {
            display:flex;
            justify-content:center;
            gap:6px 12px;
            flex-wrap:wrap;
            font-size:11px;
            color:#58667A;
        }

        #${APP_ID} .m0-meta span {
            white-space:nowrap;
        }

        #${APP_ID} .m0-meta b {
            color:#26364A;
        }

        #${APP_ID} .m0-week-side {
            display:flex;
            justify-content:flex-end;
        }

        #${APP_ID} .m0-week-box {
            min-width:145px;
            border:1px solid #DDE7EC;
            border-radius:13px;
            padding:9px 11px;
            text-align:center;
            background:#F8FBFC;
        }

        #${APP_ID} .m0-week-box small {
            display:block;
            color:#7B8797;
            font-size:10px;
            margin-bottom:3px;
        }

        #${APP_ID} .m0-week-box strong {
            display:block;
            color:#2C475C;
            font-size:12px;
        }

        #${APP_ID} .m0-legend,
        #${APP_ID} .m0-subject-legend {
            display:flex;
            align-items:center;
            justify-content:center;
            gap:7px 12px;
            flex-wrap:wrap;
            margin:7px 0 12px;
            font-size:10px;
        }

        #${APP_ID} .m0-subject-legend {
            margin-top:-5px;
            color:#6A7583;
        }

        #${APP_ID} .m0-legend-title {
            font-weight:800;
            color:#445064;
        }

        #${APP_ID} .m0-legend-item {
            display:inline-flex;
            align-items:center;
            gap:5px;
            white-space:nowrap;
            color:#4C596A;
        }

        #${APP_ID} .m0-legend-item.tiny {
            font-size:9px;
        }

        #${APP_ID} .m0-legend-item i {
            width:9px;
            height:9px;
            border-radius:50%;
            display:inline-block;
        }

        #${APP_ID} .m0-schedule-table {
            width:100%;
            table-layout:fixed;
            border-collapse:separate;
            border-spacing:6px;
        }

        #${APP_ID} .m0-schedule-table th,
        #${APP_ID} .m0-schedule-table td {
            text-align:center;
            vertical-align:middle;
        }

        #${APP_ID} .m0-schedule-table thead th {
            background:#173F5F;
            color:#fff;
            border-radius:10px;
            padding:9px 5px;
            height:58px;
        }

        #${APP_ID} .m0-schedule-table thead .m0-day-head {
            width:88px;
            background:#102E45;
        }

        #${APP_ID} .m0-period-title {
            font-size:11px;
            font-weight:900;
            line-height:1.2;
        }

        #${APP_ID} .m0-period-time {
            font-size:9px;
            margin-top:4px;
            color:#DCEAF2;
            font-weight:500;
            outline:none;
            min-height:13px;
        }

        #${APP_ID} .m0-period-time.empty {
            color:#94ACBC;
        }

        #${APP_ID} .m0-period-time:focus {
            background:rgba(255,255,255,.12);
            border-radius:5px;
        }

        #${APP_ID} .m0-day-cell {
            background:#EFF5F8;
            color:#173F5F;
            border-radius:10px;
            padding:8px 4px;
            font-size:12px;
            font-weight:900;
        }

        #${APP_ID} .m0-schedule-table td {
            padding:0;
            height:86px;
        }

        #${APP_ID} .m0-lesson-card {
            height:100%;
            min-height:82px;
            background:var(--cell-bg);
            border:1px solid var(--cell-border);
            color:var(--cell-text);
            border-radius:11px;
            padding:10px 6px 8px;
            display:flex;
            flex-direction:column;
            justify-content:center;
            gap:6px;
            position:relative;
            overflow:hidden;
        }

        #${APP_ID} .m0-subject-accent {
            position:absolute;
            top:0;
            right:0;
            left:0;
            height:4px;
        }

        #${APP_ID} .m0-lesson-subject {
            font-size:12px;
            font-weight:900;
            line-height:1.35;
            outline:none;
        }

        #${APP_ID} .m0-lesson-secondary {
            font-size:10px;
            font-weight:700;
            line-height:1.35;
            opacity:.82;
            outline:none;
        }

        #${APP_ID} [contenteditable="true"]:focus {
            box-shadow:inset 0 -1px 0 rgba(23,63,95,.35);
        }

        #${APP_ID} .m0-empty-cell {
            background:#FAFBFC;
            border:1px dashed #E3E8ED;
            border-radius:11px;
            color:#C1C8D0;
        }

        #${APP_ID} .m0-note {
            margin-top:10px;
            padding:8px 12px;
            border-radius:9px;
            background:#F8FAFC;
            color:#586579;
            font-size:10px;
            border-right:3px solid #A8C7D0;
        }

        #${APP_ID} .m0-footer {
            margin-top:12px;
            padding-top:9px;
            border-top:1px solid #E8EDF1;
            display:flex;
            align-items:center;
            justify-content:space-between;
            font-size:9px;
            color:#8A94A2;
        }

        #${APP_ID} .m0-footer strong {
            color:#526273;
            letter-spacing:.4px;
        }

        #${APP_ID} .m0-sheet.dense {
            padding-top:26px;
        }

        #${APP_ID} .m0-sheet.dense .m0-sheet-header {
            margin-bottom:10px;
        }

        #${APP_ID} .m0-sheet.dense .m0-schedule-table {
            border-spacing:4px;
        }

        #${APP_ID} .m0-sheet.dense .m0-schedule-table td {
            height:72px;
        }

        #${APP_ID} .m0-sheet.dense .m0-lesson-card {
            min-height:68px;
            padding:7px 5px;
        }

        #${APP_ID} .m0-sheet.dense .m0-lesson-subject {
            font-size:11px;
        }

        #${APP_ID} .m0-sheet.dense .m0-lesson-secondary {
            font-size:9px;
        }

        #${OPEN_ID} {
            position:fixed;
            left:22px;
            bottom:22px;
            z-index:2147483000;
            border:0;
            border-radius:14px;
            background:linear-gradient(
                135deg,
                #173F5F,
                #2A9D8F
            );
            color:#fff;
            padding:12px 17px;
            font-family:Tahoma,Arial,sans-serif;
            font-size:13px;
            font-weight:800;
            box-shadow:0 10px 30px rgba(23,63,95,.28);
            cursor:pointer;
        }

        #${OPEN_ID}:hover {
            transform:translateY(-1px);
            box-shadow:0 13px 34px rgba(23,63,95,.34);
        }

        @media(max-width:900px) {

            #${APP_ID} .m0-app {
                grid-template-columns:300px minmax(760px,1fr);
                overflow:auto;
            }

            #${APP_ID} .m0-preview-area {
                justify-content:flex-start;
            }
        }
    `;

    const PRINT_CSS = `

        * {
            box-sizing:border-box;
        }

        html,
        body {
            margin:0;
            padding:0;
            background:#fff;
            direction:rtl;
            font-family:Tahoma,Arial,sans-serif;
            color:#172033;
        }

        @page {
            size:A4 landscape;
            margin:7mm;
        }

        body {
            print-color-adjust:exact;
            -webkit-print-color-adjust:exact;
        }

        .m0-sheet {
            width:100%;
            background:#fff;
            padding:4mm 4mm 2mm;
            position:relative;
            overflow:hidden;
        }

        .m0-topbar {
            position:absolute;
            top:0;
            right:0;
            left:0;
            height:2mm;
            background:linear-gradient(
                90deg,
                #173F5F,
                #2A9D8F,
                #68B0AB
            );
        }

        .m0-sheet-header {
            display:grid;
            grid-template-columns:27mm 1fr 43mm;
            gap:4mm;
            align-items:center;
            margin-bottom:3mm;
        }

        .m0-brand-side {
            display:flex;
            align-items:center;
        }

        .m0-logo-img,
        .m0-logo-placeholder {
            width:17mm;
            height:17mm;
            border-radius:4mm;
            background:#F2F6F8;
            border:1px solid #E2E9EE;
            object-fit:contain;
        }

        .m0-logo-placeholder {
            display:grid;
            place-items:center;
            font-size:8mm;
            font-weight:900;
            color:#2A9D8F;
        }

        .m0-title-side {
            text-align:center;
        }

        .m0-kicker {
            display:inline-block;
            padding:1mm 3mm;
            background:#EDF7F7;
            border-radius:8mm;
            color:#287B77;
            font-size:7pt;
            font-weight:800;
            margin-bottom:1mm;
        }

        .m0-title-side h1 {
            margin:0 0 1.5mm;
            font-size:17pt;
            color:#153A55;
        }

        .m0-meta {
            display:flex;
            justify-content:center;
            gap:1mm 3mm;
            flex-wrap:wrap;
            font-size:7pt;
            color:#58667A;
        }

        .m0-meta b {
            color:#26364A;
        }

        .m0-week-side {
            display:flex;
            justify-content:flex-end;
        }

        .m0-week-box {
            min-width:37mm;
            border:1px solid #DDE7EC;
            border-radius:3mm;
            padding:2mm;
            text-align:center;
            background:#F8FBFC;
        }

        .m0-week-box small {
            display:block;
            color:#7B8797;
            font-size:6.5pt;
        }

        .m0-week-box strong {
            display:block;
            color:#2C475C;
            font-size:7.5pt;
            margin-top:1mm;
        }

        .m0-legend,
        .m0-subject-legend {
            display:flex;
            align-items:center;
            justify-content:center;
            gap:1mm 3mm;
            flex-wrap:wrap;
            margin:1.5mm 0 2.5mm;
            font-size:6.7pt;
        }

        .m0-subject-legend {
            margin-top:-1mm;
            color:#6A7583;
        }

        .m0-legend-title {
            font-weight:800;
            color:#445064;
        }

        .m0-legend-item {
            display:inline-flex;
            align-items:center;
            gap:1mm;
            white-space:nowrap;
            color:#4C596A;
        }

        .m0-legend-item.tiny {
            font-size:6pt;
        }

        .m0-legend-item i {
            width:2.2mm;
            height:2.2mm;
            border-radius:50%;
            display:inline-block;
        }

        .m0-schedule-table {
            width:100%;
            table-layout:fixed;
            border-collapse:separate;
            border-spacing:1.2mm;
        }

        .m0-schedule-table th,
        .m0-schedule-table td {
            text-align:center;
            vertical-align:middle;
        }

        .m0-schedule-table thead th {
            background:#173F5F;
            color:#fff;
            border-radius:2.2mm;
            padding:2mm 1mm;
            height:13mm;
        }

        .m0-schedule-table thead .m0-day-head {
            width:19mm;
            background:#102E45;
        }

        .m0-period-title {
            font-size:7.4pt;
            font-weight:900;
        }

        .m0-period-time {
            font-size:6.2pt;
            margin-top:1mm;
            color:#DCEAF2;
        }

        .m0-period-time.empty {
            color:#94ACBC;
        }

        .m0-day-cell {
            background:#EFF5F8;
            color:#173F5F;
            border-radius:2.2mm;
            padding:2mm 1mm;
            font-size:7.7pt;
            font-weight:900;
        }

        .m0-schedule-table td {
            padding:0;
            height:18mm;
        }

        .m0-lesson-card {
            height:100%;
            min-height:17mm;
            background:var(--cell-bg);
            border:1px solid var(--cell-border);
            color:var(--cell-text);
            border-radius:2.2mm;
            padding:2mm 1.2mm;
            display:flex;
            flex-direction:column;
            justify-content:center;
            gap:1mm;
            position:relative;
            overflow:hidden;
        }

        .m0-subject-accent {
            position:absolute;
            top:0;
            right:0;
            left:0;
            height:1mm;
        }

        .m0-lesson-subject {
            font-size:7.4pt;
            font-weight:900;
            line-height:1.25;
        }

        .m0-lesson-secondary {
            font-size:6.3pt;
            font-weight:700;
            line-height:1.25;
            opacity:.82;
        }

        .m0-empty-cell {
            background:#FAFBFC;
            border:1px dashed #E3E8ED;
            border-radius:2.2mm;
            color:#C1C8D0;
        }

        .m0-note {
            margin-top:2mm;
            padding:1.5mm 2.5mm;
            border-radius:2mm;
            background:#F8FAFC;
            color:#586579;
            font-size:6.4pt;
            border-right:1mm solid #A8C7D0;
        }

        .m0-footer {
            margin-top:2.5mm;
            padding-top:1.5mm;
            border-top:1px solid #E8EDF1;
            display:flex;
            justify-content:space-between;
            font-size:6pt;
            color:#8A94A2;
        }

        .m0-footer strong {
            color:#526273;
        }

        .dense .m0-schedule-table {
            border-spacing:.9mm;
        }

        .dense .m0-schedule-table td {
            height:15.5mm;
        }

        .dense .m0-lesson-card {
            min-height:14.5mm;
            padding:1.5mm 1mm;
        }

        .dense .m0-lesson-subject {
            font-size:6.8pt;
        }

        .dense .m0-lesson-secondary {
            font-size:5.9pt;
        }
    `;

    function injectStyle() {

        if (
            document.getElementById(
                STYLE_ID
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            STYLE_ID;

        style.textContent =
            BASE_CSS;

        document.head
            .appendChild(
                style
            );
    }

    function field(
        label,
        key,
        placeholder = ''
    ) {

        return `
            <div class="m0-field">

                <label>
                    ${esc(label)}
                </label>

                <input
                    data-pref="${key}"
                    value="${esc(state.prefs[key] || '')}"
                    placeholder="${esc(placeholder)}"
                >

            </div>
        `;
    }

    function renderPanel() {

        const timeRows =
            state.data.periodLabels
                .map(
                    (
                        label,
                        index
                    ) => `
                        <div class="m0-time-row">

                            <span>
                                ${
                                    esc(
                                        periodTitle(
                                            label,
                                            index
                                        )
                                        .replace(
                                            /^الحصة\s*/,
                                            ''
                                        )
                                    )
                                }
                            </span>

                            <input
                                data-time="${index}"
                                value="${esc(state.data.times[index] || '')}"
                                placeholder="07:00 ص - 07:44 ص"
                            >

                        </div>
                    `
                )
                .join('');

        return `
            <div class="m0-panel-head">

                <h2>
                    إعداد إخراج الجدول
                </h2>

                <button
                    type="button"
                    class="m0-close"
                    id="m0-btn-close"
                >
                    ×
                </button>

            </div>

            ${
                field(
                    isTeacher
                        ? 'اسم المعلم'
                        : 'اسم الطالب',

                    'name',

                    isTeacher
                        ? 'اسم المعلم'
                        : 'اسم الطالب'
                )
            }

            ${
                field(
                    'اسم المدرسة',
                    'school',
                    'اسم المدرسة'
                )
            }

            <div class="m0-grid2">

                ${
                    field(
                        'المرحلة',
                        'stage',
                        'ابتدائي / متوسط / ثانوي'
                    )
                }

                ${
                    field(
                        'الصف / الفصل',
                        'className',

                        isStudent
                            ? 'مثال: الصف الثالث أ'
                            : 'اختياري'
                    )
                }

            </div>

            ${
                isTeacher

                    ? field(
                        'التخصص',
                        'specialty',
                        'مثال: المهارات الرقمية'
                    )

                    : ''
            }

            <div class="m0-grid2">

                ${
                    field(
                        'العام الدراسي',
                        'academicYear',
                        '1448 هـ'
                    )
                }

                ${
                    field(
                        'الأسبوع / الفترة',
                        'week',
                        'الفترة المعروضة'
                    )
                }

            </div>

            ${
                field(
                    'عنوان الجدول',
                    'title',

                    isTeacher
                        ? 'الجدول الدراسي الأسبوعي للمعلم'
                        : 'الجدول الدراسي الأسبوعي للطالب'
                )
            }

            <div class="m0-field">

                <label>
                    ملاحظة اختيارية
                </label>

                <textarea
                    data-pref="note"
                    placeholder="ملاحظة تظهر أسفل الجدول"
                >${esc(state.prefs.note || '')}</textarea>

            </div>

            <div class="m0-section-title">
                الشعار
            </div>

            <div class="m0-upload">

                <label
                    class="m0-small-btn"
                    for="m0-logo-input"
                >
                    اختيار شعار
                </label>

                <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    id="m0-logo-input"
                >

                <button
                    type="button"
                    class="m0-small-btn"
                    id="m0-btn-remove-logo"
                >
                    إزالة
                </button>

                <div
                    id="m0-logo-status"
                    class="m0-logo-status"
                >
                    ${
                        state.logoDataUrl
                            ? 'شعار محفوظ'
                            : 'لم يتم اختيار شعار'
                    }
                </div>

            </div>

            <div class="m0-section-title">
                خيارات العرض
            </div>

            <label class="m0-check">

                <input
                    type="checkbox"
                    data-check="showLegend"
                    ${
                        state.prefs.showLegend
                            ? 'checked'
                            : ''
                    }
                >

                إظهار مفتاح الألوان

            </label>

            <label class="m0-check">

                <input
                    type="checkbox"
                    data-check="showSecondary"
                    ${
                        state.prefs.showSecondary
                            ? 'checked'
                            : ''
                    }
                >

                إظهار ${
                    isTeacher
                        ? 'الفصل داخل الحصة'
                        : 'اسم المعلم داخل الحصة'
                }

            </label>

            ${
                isTeacher

                    ? `
                        <label class="m0-check">

                            <input
                                type="checkbox"
                                data-check="showSubjectAccent"
                                ${
                                    state.prefs.showSubjectAccent
                                        ? 'checked'
                                        : ''
                                }
                            >

                            تمييز المواد بشريط علوي عند تعددها

                        </label>
                    `

                    : ''
            }

            <label class="m0-check">

                <input
                    type="checkbox"
                    data-check="dense"
                    ${
                        state.prefs.dense
                            ? 'checked'
                            : ''
                    }
                >

                وضع مضغوط

            </label>

            <label class="m0-check">

                <input
                    type="checkbox"
                    data-check="monochrome"
                    ${
                        state.prefs.monochrome
                            ? 'checked'
                            : ''
                    }
                >

                أبيض وأسود

            </label>

            <label class="m0-check">

                <input
                    type="checkbox"
                    data-check="remember"
                    ${
                        state.prefs.remember
                            ? 'checked'
                            : ''
                    }
                >

                حفظ بياناتي في هذا المتصفح

            </label>

            <div class="m0-section-title">
                أوقات الحصص في الرأس
            </div>

            <div class="m0-times">
                ${timeRows}
            </div>

            <div class="m0-update">

                <button
                    type="button"
                    id="m0-btn-update"
                >
                    ↻ تحديث المعاينة
                </button>

            </div>

            <div class="m0-actions">

                <button
                    type="button"
                    class="m0-action primary"
                    id="m0-btn-print"
                >
                    🖨 طباعة / PDF
                </button>

                <button
                    type="button"
                    class="m0-action accent"
                    id="m0-btn-png"
                >
                    🖼 حفظ PNG
                </button>

                <button
                    type="button"
                    class="m0-action"
                    id="m0-btn-copy"
                >
                    📋 نسخ الجدول
                </button>

                <button
                    type="button"
                    class="m0-action"
                    id="m0-btn-excel"
                >
                    📊 Excel
                </button>

            </div>
        `;
    }

    function readControls(
        root
    ) {

        root
            .querySelectorAll(
                '[data-pref]'
            )
            .forEach(
                input => {

                    const key =
                        (
                            input.dataset.pref ||
                            ''
                        ).trim();

                    if (key) {

                        state.prefs[
                            key
                        ] =
                            input.value;
                    }
                }
            );

        root
            .querySelectorAll(
                '[data-check]'
            )
            .forEach(
                input => {

                    const key =
                        (
                            input.dataset.check ||
                            ''
                        ).trim();

                    if (key) {

                        state.prefs[
                            key
                        ] =
                            input.checked;
                    }
                }
            );

        const times =
            Array.from(
                {
                    length:
                        state.data.periods
                },

                () =>
                    ''
            );

        root
            .querySelectorAll(
                '[data-time]'
            )
            .forEach(
                input => {

                    const index =
                        Number(
                            (
                                input.dataset.time ||
                                ''
                            ).trim()
                        );

                    if (
                        Number.isInteger(
                            index
                        ) &&
                        index >= 0 &&
                        index < times.length
                    ) {

                        times[
                            index
                        ] =
                            clean(
                                input.value
                            );
                    }
                }
            );

        state.data.times =
            times;

        state.prefs.times = [
            ...times
        ];

        state.prefs.logoDataUrl =
            state.logoDataUrl;
    }

    function renderPreview() {

        const preview =
            document.querySelector(
                `#${APP_ID} #m0-preview`
            );

        if (preview) {

            preview.innerHTML =
                buildPreview();
        }
    }

    function toast(
        message
    ) {

        let element =
            document.getElementById(
                TOAST_ID
            );

        if (!element) {

            element =
                document.createElement(
                    'div'
                );

            element.id =
                TOAST_ID;

            Object.assign(
                element.style,
                {
                    position:
                        'fixed',

                    left:
                        '50%',

                    bottom:
                        '28px',

                    transform:
                        'translateX(-50%)',

                    zIndex:
                        '2147483647',

                    background:
                        '#172033',

                    color:
                        '#fff',

                    padding:
                        '10px 15px',

                    borderRadius:
                        '10px',

                    fontFamily:
                        'Tahoma,Arial,sans-serif',

                    fontSize:
                        '12px',

                    boxShadow:
                        '0 8px 25px rgba(0,0,0,.2)',

                    transition:
                        'opacity .2s'
                }
            );

            document.body
                .appendChild(
                    element
                );
        }

        element.textContent =
            message;

        element.style.opacity =
            '1';

        clearTimeout(
            element._timer
        );

        element._timer =
            setTimeout(
                () => {

                    element.style.opacity =
                        '0';
                },

                2400
            );
    }

    function handleLogoFile(
        file
    ) {

        if (!file) {
            return;
        }

        if (
            !file.type
                .startsWith(
                    'image/'
                )
        ) {

            toast(
                'اختر ملف صورة صحيحًا.'
            );

            return;
        }

        const reader =
            new FileReader();

        reader.onload =
            () => {

                state.logoDataUrl =
                    String(
                        reader.result ||
                        ''
                    );

                const status =
                    document.querySelector(
                        `#${APP_ID} #m0-logo-status`
                    );

                if (status) {

                    status.textContent =
                        `تم اختيار: ${file.name}`;
                }

                toast(
                    'تم تحميل الشعار. اضغط «تحديث المعاينة».'
                );
            };

        reader.onerror =
            () => {

                toast(
                    'تعذر قراءة الشعار. جرّب PNG أو JPG.'
                );
            };

        reader.readAsDataURL(
            file
        );
    }

    function removeLogo() {

        state.logoDataUrl =
            '';

        state.prefs.logoDataUrl =
            '';

        const input =
            document.querySelector(
                `#${APP_ID} #m0-logo-input`
            );

        if (input) {

            input.value =
                '';
        }

        const status =
            document.querySelector(
                `#${APP_ID} #m0-logo-status`
            );

        if (status) {

            status.textContent =
                'لم يتم اختيار شعار';
        }

        renderPreview();
        savePrefs();

        toast(
            'تمت إزالة الشعار.'
        );
    }

    function closeDesigner() {

        document
            .getElementById(
                APP_ID
            )
            ?.remove();
    }

    function bindDesignerEvents(
        root
    ) {

        root
            .querySelector(
                '#m0-btn-close'
            )
            ?.addEventListener(
                'click',

                event => {

                    event.preventDefault();
                    closeDesigner();
                }
            );

        root
            .querySelector(
                '.m0-backdrop'
            )
            ?.addEventListener(
                'click',

                event => {

                    event.preventDefault();
                    closeDesigner();
                }
            );

        const update =
            () => {

                readControls(
                    root
                );

                savePrefs();

                renderPreview();
            };

        root
            .querySelector(
                '#m0-btn-update'
            )
            ?.addEventListener(
                'click',

                event => {

                    event.preventDefault();

                    update();

                    toast(
                        'تم تحديث المعاينة.'
                    );
                }
            );

        root
            .querySelector(
                '#m0-btn-print'
            )
            ?.addEventListener(
                'click',

                async event => {

                    event.preventDefault();

                    update();

                    await printSchedule();
                }
            );

        root
            .querySelector(
                '#m0-btn-png'
            )
            ?.addEventListener(
                'click',

                async event => {

                    event.preventDefault();

                    update();

                    await exportPng();
                }
            );

        root
            .querySelector(
                '#m0-btn-copy'
            )
            ?.addEventListener(
                'click',

                async event => {

                    event.preventDefault();

                    update();

                    await copySchedule();
                }
            );

        root
            .querySelector(
                '#m0-btn-excel'
            )
            ?.addEventListener(
                'click',

                event => {

                    event.preventDefault();

                    update();

                    exportExcel();
                }
            );

        root
            .querySelector(
                '#m0-btn-remove-logo'
            )
            ?.addEventListener(
                'click',

                event => {

                    event.preventDefault();

                    removeLogo();
                }
            );

        root
            .querySelector(
                '#m0-logo-input'
            )
            ?.addEventListener(
                'change',

                event => {

                    handleLogoFile(
                        event.target
                            .files?.[0]
                    );
                }
            );

        root.addEventListener(
            'keydown',

            event => {

                if (
                    event.key ===
                    'Enter' &&

                    event.target.matches(
                        'input:not([type=file])'
                    )
                ) {

                    event.preventDefault();

                    update();

                    toast(
                        'تم تحديث المعاينة.'
                    );
                }
            }
        );

        /*
         * تعديل مباشر من داخل المعاينة.
         */
        root.addEventListener(
            'input',

            event => {

                const target =
                    event.target;

                if (
                    !(
                        target instanceof
                        HTMLElement
                    )
                ) {
                    return;
                }

                if (
                    target.matches(
                        '[data-time-index]'
                    )
                ) {

                    const index =
                        Number(
                            (
                                target.dataset.timeIndex ||
                                ''
                            ).trim()
                        );

                    const value =
                        clean(
                            target.textContent ||
                            ''
                        )
                        .replace(
                            /^أضف الوقت$/,
                            ''
                        );

                    if (
                        Number.isInteger(
                            index
                        ) &&
                        index >= 0 &&
                        index <
                        state.data.times.length
                    ) {

                        state.data.times[
                            index
                        ] =
                            value;

                        state.prefs.times = [
                            ...state.data.times
                        ];

                        const sideInput =
                            root.querySelector(
                                `[data-time="${index}"]`
                            );

                        if (sideInput) {

                            sideInput.value =
                                value;
                        }
                    }
                }

                if (
                    target.matches(
                        '[data-edit]'
                    )
                ) {

                    const field =
                        (
                            target.dataset.edit ||
                            ''
                        ).trim();

                    const day =
                        Number(
                            target.dataset.day
                        );

                    const period =
                        Number(
                            target.dataset.period
                        );

                    const lesson =
                        state.data
                            .days[day]
                            ?.lessons[period];

                    if (
                        lesson &&
                        (
                            field ===
                            'subject' ||

                            field ===
                            'secondary'
                        )
                    ) {

                        lesson[
                            field
                        ] =
                            clean(
                                target.textContent ||
                                ''
                            );
                    }
                }
            }
        );
    }

    function openDesigner() {

        state.data =
            extractSchedule();

        if (
            !state.data
        ) {

            alert(
                'لم أتمكن من العثور على جدول مدرستي في الصفحة الحالية.'
            );

            return;
        }

        hydrateDefaults(
            state.data
        );

        injectStyle();

        document
            .getElementById(
                APP_ID
            )
            ?.remove();

        const root =
            document.createElement(
                'div'
            );

        root.id =
            APP_ID;

        root.innerHTML = `
            <div class="m0-backdrop"></div>

            <div class="m0-app">

                <aside class="m0-panel">
                    ${renderPanel()}
                </aside>

                <main class="m0-preview-area">

                    <div id="m0-preview">
                        ${buildPreview()}
                    </div>

                </main>

            </div>

            <div class="m0-hint">
                عدّل البيانات ثم اضغط «تحديث المعاينة»
            </div>
        `;

        document.body
            .appendChild(
                root
            );

        bindDesignerEvents(
            root
        );
    }

    function clonePrintableArea() {

        const source =
            document.querySelector(
                `#${APP_ID} #m0-print-area`
            );

        if (!source) {
            return null;
        }

        const clone =
            source.cloneNode(
                true
            );

        clone
            .querySelectorAll(
                '[contenteditable]'
            )
            .forEach(
                element => {

                    element.removeAttribute(
                        'contenteditable'
                    );
                }
            );

        return clone;
    }

    async function printSchedule() {

        const clone =
            clonePrintableArea();

        if (!clone) {
            return;
        }

        const iframe =
            document.createElement(
                'iframe'
            );

        iframe.setAttribute(
            'aria-hidden',
            'true'
        );

        Object.assign(
            iframe.style,
            {
                position:
                    'fixed',

                width:
                    '1px',

                height:
                    '1px',

                right:
                    '0',

                bottom:
                    '0',

                opacity:
                    '0',

                border:
                    '0',

                pointerEvents:
                    'none'
            }
        );

        document.body
            .appendChild(
                iframe
            );

        const doc =
            iframe.contentDocument ||
            iframe.contentWindow
                .document;

        doc.open();

        doc.write(
            `
                <!doctype html>

                <html
                    lang="ar"
                    dir="rtl"
                >

                <head>

                    <meta charset="utf-8">

                    <title>
                        ${
                            esc(
                                state.prefs.title ||
                                'الجدول الدراسي'
                            )
                        }
                    </title>

                    <style>
                        ${PRINT_CSS}
                    </style>

                </head>

                <body>

                    ${clone.outerHTML}

                </body>

                </html>
            `
        );

        doc.close();

        await new Promise(
            resolve => {

                setTimeout(
                    resolve,
                    450
                );
            }
        );

        /*
         * لا نحذف iframe فورًا لأن بعض المتصفحات
         * تحتاجه حتى انتهاء نافذة الطباعة.
         */
        const cleanup =
            () => {

                if (
                    iframe.isConnected
                ) {

                    iframe.remove();
                }
            };

        try {

            iframe.contentWindow
                .addEventListener(
                    'afterprint',
                    cleanup,
                    {
                        once: true
                    }
                );

            iframe.contentWindow
                .focus();

            iframe.contentWindow
                .print();

            toast(
                'تم فتح نافذة الطباعة. اختر «حفظ كملف PDF» عند الحاجة.'
            );

        } catch (
            error
        ) {

            console.error(
                error
            );

            cleanup();

            toast(
                'تعذر فتح الطباعة في هذا المتصفح.'
            );

            return;
        }

        /*
         * تنظيف احتياطي بعد دقيقة.
         */
        setTimeout(
            cleanup,
            60000
        );
    }

    function buildCopyText() {

        const headers = [
            'اليوم',

            ...state.data
                .periodLabels
                .map(
                    (
                        label,
                        index
                    ) =>
                        `${
                            periodTitle(
                                label,
                                index
                            )
                        }${
                            state.data
                                .times[index]

                                ? ` (${
                                    state.data
                                        .times[index]
                                })`

                                : ''
                        }`
                )
        ];

        const lines = [
            headers.join(
                '\t'
            )
        ];

        state.data.days
            .forEach(
                day => {

                    lines.push(
                        [
                            day.name,

                            ...day.lessons
                                .map(
                                    lesson => {

                                        if (
                                            !lesson.subject
                                        ) {

                                            return '';
                                        }

                                        if (
                                            state.prefs
                                                .showSecondary &&
                                            lesson.secondary
                                        ) {

                                            return (
                                                `${
                                                    lesson.subject
                                                } - ${
                                                    lesson.secondary
                                                }`
                                            );
                                        }

                                        return (
                                            lesson.subject
                                        );
                                    }
                                )
                        ]
                        .join(
                            '\t'
                        )
                    );
                }
            );

        return lines.join(
            '\n'
        );
    }

    function buildCopyHtml() {

        const heads =
            state.data
                .periodLabels
                .map(
                    (
                        label,
                        index
                    ) => `
                        <th>
                            ${
                                esc(
                                    periodTitle(
                                        label,
                                        index
                                    )
                                )
                            }

                            ${
                                state.data
                                    .times[index]

                                    ? `
                                        <br>
                                        ${
                                            esc(
                                                state.data
                                                    .times[index]
                                            )
                                        }
                                    `

                                    : ''
                            }
                        </th>
                    `
                )
                .join('');

        const rows =
            state.data.days
                .map(
                    day => `
                        <tr>

                            <th>
                                ${esc(day.name)}
                            </th>

                            ${
                                day.lessons
                                    .map(
                                        lesson => `
                                            <td>

                                                ${
                                                    lesson.subject

                                                        ? `
                                                            <b>
                                                                ${esc(lesson.subject)}
                                                            </b>

                                                            ${
                                                                state.prefs
                                                                    .showSecondary &&
                                                                lesson.secondary

                                                                    ? `
                                                                        <br>
                                                                        ${esc(lesson.secondary)}
                                                                    `

                                                                    : ''
                                                            }
                                                        `

                                                        : ''
                                                }

                                            </td>
                                        `
                                    )
                                    .join('')
                            }

                        </tr>
                    `
                )
                .join('');

        return `
            <table
                border="1"
                cellspacing="0"
                cellpadding="6"
            >

                <thead>

                    <tr>

                        <th>
                            اليوم
                        </th>

                        ${heads}

                    </tr>

                </thead>

                <tbody>
                    ${rows}
                </tbody>

            </table>
        `;
    }

    async function copySchedule() {

        const text =
            buildCopyText();

        const html =
            buildCopyHtml();

        try {

            if (
                navigator.clipboard &&
                window.ClipboardItem
            ) {

                const item =
                    new ClipboardItem({
                        'text/plain':
                            new Blob(
                                [text],

                                {
                                    type:
                                        'text/plain'
                                }
                            ),

                        'text/html':
                            new Blob(
                                [html],

                                {
                                    type:
                                        'text/html'
                                }
                            )
                    });

                await navigator.clipboard
                    .write(
                        [item]
                    );
            }

            else if (
                navigator.clipboard
                    ?.writeText
            ) {

                await navigator.clipboard
                    .writeText(
                        text
                    );
            }

            else {

                throw new Error(
                    'clipboard fallback'
                );
            }

            toast(
                'تم نسخ الجدول.'
            );

        } catch (_) {

            const textarea =
                document.createElement(
                    'textarea'
                );

            textarea.value =
                text;

            textarea.style.position =
                'fixed';

            textarea.style.opacity =
                '0';

            document.body
                .appendChild(
                    textarea
                );

            textarea.focus();
            textarea.select();

            document.execCommand(
                'copy'
            );

            textarea.remove();

            toast(
                'تم نسخ الجدول.'
            );
        }
    }

    function exportExcel() {

        const header = `
            <tr>

                <th>
                    اليوم
                </th>

                ${
                    state.data
                        .periodLabels
                        .map(
                            (
                                label,
                                index
                            ) => `
                                <th>

                                    ${
                                        esc(
                                            periodTitle(
                                                label,
                                                index
                                            )
                                        )
                                    }

                                    <br>

                                    ${
                                        esc(
                                            state.data
                                                .times[index] ||
                                            ''
                                        )
                                    }

                                </th>
                            `
                        )
                        .join('')
                }

            </tr>
        `;

        const body =
            state.data.days
                .map(
                    day => `
                        <tr>

                            <th>
                                ${esc(day.name)}
                            </th>

                            ${
                                day.lessons
                                    .map(
                                        lesson => `
                                            <td>

                                                ${
                                                    lesson.subject

                                                        ? `
                                                            <b>
                                                                ${esc(lesson.subject)}
                                                            </b>

                                                            ${
                                                                state.prefs
                                                                    .showSecondary &&
                                                                lesson.secondary

                                                                    ? `
                                                                        <br>
                                                                        ${esc(lesson.secondary)}
                                                                    `

                                                                    : ''
                                                            }
                                                        `

                                                        : ''
                                                }

                                            </td>
                                        `
                                    )
                                    .join('')
                            }

                        </tr>
                    `
                )
                .join('');

        const html = `
            <!doctype html>

            <html
                lang="ar"
                dir="rtl"
            >

            <head>

                <meta charset="utf-8">

                <style>

                    body {
                        font-family:
                            Tahoma,
                            Arial;
                    }

                    table {
                        border-collapse:
                            collapse;
                    }

                    th,
                    td {
                        border:
                            1px solid #bbb;

                        padding:
                            8px;

                        text-align:
                            center;
                    }

                    th {
                        background:
                            #eaf2f7;
                    }

                </style>

            </head>

            <body>

                <h2>
                    ${
                        esc(
                            state.prefs.title ||
                            'الجدول الدراسي'
                        )
                    }
                </h2>

                <table>
                    ${header}
                    ${body}
                </table>

            </body>

            </html>
        `;

        downloadBlob(
            new Blob(
                [
                    '\ufeff',
                    html
                ],

                {
                    type:
                        'application/vnd.ms-excel;charset=utf-8'
                }
            ),

            `الجدول-${
                isTeacher
                    ? 'معلم'
                    : 'طالب'
            }.xls`
        );

        toast(
            'تم إنشاء ملف Excel.'
        );
    }

    async function exportPng() {

        const source =
            document.querySelector(
                `#${APP_ID} #m0-print-area`
            );

        if (!source) {
            return;
        }

        if (
            typeof window.html2canvas !==
            'function'
        ) {

            toast(
                'مكتبة حفظ PNG لم تُحمّل. أعد تحميل الصفحة ثم حاول مرة أخرى.'
            );

            return;
        }

        try {

            toast(
                'جارٍ إنشاء صورة PNG...'
            );

            const canvas =
                await window.html2canvas(
                    source,

                    {
                        backgroundColor:
                            '#ffffff',

                        scale:
                            2,

                        useCORS:
                            true,

                        allowTaint:
                            false,

                        logging:
                            false,

                        scrollX:
                            0,

                        scrollY:
                            -window.scrollY
                    }
                );

            canvas.toBlob(
                blob => {

                    if (!blob) {

                        toast(
                            'تعذر إنشاء صورة PNG.'
                        );

                        return;
                    }

                    downloadBlob(
                        blob,

                        `الجدول-${
                            isTeacher
                                ? 'معلم'
                                : 'طالب'
                        }.png`
                    );

                    toast(
                        'تم إنشاء صورة PNG.'
                    );
                },

                'image/png',

                1
            );

        } catch (
            error
        ) {

            console.error(
                error
            );

            toast(
                'تعذر إنشاء PNG. جرّب الطباعة / PDF.'
            );
        }
    }

    function downloadBlob(
        blob,
        filename
    ) {

        const url =
            URL.createObjectURL(
                blob
            );

        const link =
            document.createElement(
                'a'
            );

        link.href =
            url;

        link.download =
            filename;

        link.style.display =
            'none';

        document.body
            .appendChild(
                link
            );

        link.click();

        link.remove();

        setTimeout(
            () => {

                URL.revokeObjectURL(
                    url
                );
            },

            2000
        );
    }

    function createOpenButton() {

        if (
            document.getElementById(
                OPEN_ID
            )
        ) {
            return;
        }

        const button =
            document.createElement(
                'button'
            );

        button.id =
            OPEN_ID;

        button.type =
            'button';

        button.textContent =
            '✦ إخراج الجدول';

        button.addEventListener(
            'click',

            event => {

                event.preventDefault();
                event.stopPropagation();

                openDesigner();
            }
        );

        document.body
            .appendChild(
                button
            );
    }

    function boot() {

        injectStyle();

        const tryAdd =
            () => {

                if (
                    document.querySelector(
                        '#reservations'
                    )
                ) {

                    createOpenButton();

                    observer.disconnect();
                }
            };

        const observer =
            new MutationObserver(
                tryAdd
            );

        observer.observe(
            document.documentElement,

            {
                childList:
                    true,

                subtree:
                    true
            }
        );

        tryAdd();

        setTimeout(
            tryAdd,
            1200
        );

        setTimeout(
            tryAdd,
            3500
        );
    }

    boot();

})();
