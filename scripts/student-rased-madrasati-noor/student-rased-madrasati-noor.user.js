// ==UserScript==
// @name         راصد الطلاب | مدرستي + نور
// @namespace    https://greasyfork.org/users/1636459
// @version      2.1.0
// @description  راصد دقيق لبيانات الطلاب من مدرستي ونور مع دعم واجهتي نور القديمة وV2: استخراج المدرسة كاملة، تدقيق الصفحات، نسخ مقارنة ببصمة تحقق، سجل زمني، ومراجعة يدوية للحالات الملتبسة.
// @author       Mohammed Almalki (M0HM3D85)
// @homepageURL  https://greasyfork.org/en/users/1636459-m0hm3d85
// @supportURL   https://github.com/M0HM3D85/teacher-userscripts/issues
// @copyright    2026, Mohammed Almalki (M0HM3D85)
// @license      All Rights Reserved
// @match        https://schools.madrasati.sa/SchoolManagmentReports/StudentInfo/ClassStudentInfo/*
// @match        https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReport.aspx*
// @match        https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReportV2.aspx*
// @run-at       document-idle
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/592894/%D8%B1%D8%A7%D8%B5%D8%AF%20%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8%20%7C%20%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20%2B%20%D9%86%D9%88%D8%B1.user.js
// @updateURL https://update.greasyfork.org/scripts/592894/%D8%B1%D8%A7%D8%B5%D8%AF%20%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8%20%7C%20%D9%85%D8%AF%D8%B1%D8%B3%D8%AA%D9%8A%20%2B%20%D9%86%D9%88%D8%B1.meta.js
// ==/UserScript==

/*
=========================================================================
 راصد الطلاب | مدرستي + نور

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

const VERSION = '2.1.0';
const APP = 'm0hm3d85-rasid-students';
const BTN = `${APP}-btn`;
const PREF = `${APP}-prefs-v5`;
const NOOR_JOB = `${APP}-noor-job-v4`;
const NOOR_RESULT = `${APP}-noor-result-v2`;
const LAUNCH_INTENT = `${APP}-launch-intent-v2`;
const FOLLOW_TEMPLATE_KEY = `${APP}-follow-templates-v1`;
const HISTORY_LIMIT = 18;
const SNAP = 'm0hm3d85-rasid-snapshot-v6';
const SNAP_OK = new Set([
    'm0hm3d85-rasid-snapshot-v1',
    'm0hm3d85-rasid-snapshot-v2',
    'm0hm3d85-rasid-snapshot-v3',
    'm0hm3d85-rasid-snapshot-v4',
    'm0hm3d85-rasid-snapshot-v5',
    SNAP
]);

const PLATFORM = location.hostname.includes('madrasati.sa') ? 'madrasati' : 'noor';
const PLATFORM_LABEL = PLATFORM === 'madrasati' ? 'مدرستي' : 'نور';
const NOOR_VIEW = PLATFORM === 'noor'
    ? (/\/EduWavek12Portal\/ReportPages\/StudntNamesReportV2\.aspx$/i.test(location.pathname) ? 'v2' : 'legacy')
    : '';
const NOOR_VIEW_LABEL = NOOR_VIEW === 'v2'
    ? 'نور V2'
    : (NOOR_VIEW === 'legacy' ? 'نور القديم' : '');
const HISTORY_KEY = `${APP}-timeline-v1-${PLATFORM}`;
const IDENTITY_LINKS_KEY = `${APP}-identity-links-v1-${PLATFORM}`;

if (window.top !== window.self) return;

const TARGET_PATH_RE = PLATFORM === 'madrasati'
    ? /\/SchoolManagmentReports\/StudentInfo\/ClassStudentInfo\/?/i
    : /\/EduWavek12Portal\/ReportPages\/StudntNamesReport(?:V2)?\.aspx$/i;

function isTargetPage() {
    return TARGET_PATH_RE.test(location.pathname);
}

if (document.getElementById(APP)) return;

const DEV = Object.freeze({
    name: 'Mohammed Almalki',
    handle: 'M0HM3D85',
    greasy: 'https://greasyfork.org/en/users/1636459-m0hm3d85',
    x: 'https://x.com/M0HM3D85',
    snap: 'https://www.snapchat.com/add/M0HM3D85'
});

const collator = new Intl.Collator('ar', {
    numeric: true,
    sensitivity: 'base'
});

const clean = v =>
    String(v ?? '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const norm = v =>
    clean(v)
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/ـ/g, '')
        .replace(/[إأآ]/g, 'ا')
        .replace(/ى/g, 'ي')
        .toLowerCase();

const esc = v =>
    String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const wait = ms =>
    new Promise(r =>
        setTimeout(r, ms)
    );

const toEn = v =>
    String(v ?? '')
        .replace(
            /[٠-٩]/g,
            d =>
                String(
                    '٠١٢٣٤٥٦٧٨٩'.indexOf(d)
                )
        )
        .replace(
            /[۰-۹]/g,
            d =>
                String(
                    '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)
                )
        );

const safe = v =>
    clean(v)
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_')
        .slice(0, 80)
    ||
    'الكل';

function stamp() {

    const d = new Date();

    return (
        `${d.getFullYear()}-` +
        `${String(d.getMonth() + 1).padStart(2, '0')}-` +
        `${String(d.getDate()).padStart(2, '0')}`
    );
}

function fileName(
    extra,
    ext
) {

    return (
        `${PLATFORM_LABEL}_` +
        `${stamp()}_` +
        `${safe(scopeFileTag())}_` +
        `${safe(extra)}.` +
        `${ext}`
    );
}

function blobDownload(
    blob,
    name
) {

    const u =
        URL.createObjectURL(
            blob
        );

    const a =
        document.createElement(
            'a'
        );

    a.href = u;
    a.download = name;
    a.style.display = 'none';

    document.body.appendChild(
        a
    );

    a.click();
    a.remove();

    setTimeout(
        () =>
            URL.revokeObjectURL(
                u
            ),
        1500
    );
}

function textDownload(
    text,
    name,
    type
) {

    blobDownload(
        new Blob(
            [text],
            {
                type
            }
        ),
        name
    );
}

function toast(
    msg,
    type = 'ok'
) {

    const e =
        document.createElement(
            'div'
        );

    e.className =
        `m0t ${type}`;

    e.textContent =
        msg;

    document.body.appendChild(
        e
    );

    requestAnimationFrame(
        () =>
            e.classList.add(
                'on'
            )
    );

    setTimeout(
        () => {

            e.classList.remove(
                'on'
            );

            setTimeout(
                () =>
                    e.remove(),
                250
            );

        },
        2800
    );
}

// =========================================================
// الجوال — يظهر 05 فقط
// =========================================================

function phone966(
    v
) {

    let p =
        toEn(
            clean(v)
        )
            .replace(
                /\D/g,
                ''
            );

    if (!p) {
        return '';
    }

    if (
        p.startsWith(
            '00966'
        )
    ) {
        p =
            p.slice(2);
    }

    if (
        p.startsWith(
            '9660'
        )
        &&
        p.length ===
        13
    ) {
        p =
            '966' +
            p.slice(4);
    }

    if (
        p.startsWith(
            '05'
        )
        &&
        p.length ===
        10
    ) {
        p =
            '966' +
            p.slice(1);
    }

    if (
        p.startsWith(
            '5'
        )
        &&
        p.length ===
        9
    ) {
        p =
            '966' +
            p;
    }

    return p;
}

function phone05(
    v
) {

    const p =
        phone966(
            v
        );

    return (
        /^9665\d{8}$/
            .test(
                p
            )
            ?
            '0' +
            p.slice(3)
            :
            ''
    );
}

// =========================================================
// حساب الطالب
// لا نحوله إلى بريد إلكتروني.
// نعرض القيمة الأصلية كما تظهر في مدرستي.
// =========================================================

function studentAccount(
    v
) {

    return (
        clean(v)
    );
}

function accountDomain(
    v
) {

    const account =
        clean(v)
            .toLowerCase();

    const at =
        account.lastIndexOf(
            '@'
        );

    if (
        at <=
        0
        ||
        at >=
        account.length -
        1
    ) {
        return '';
    }

    const suffix =
        clean(
            account.slice(
                at +
                1
            )
        );

    if (
        !suffix
        ||
        /\s/
            .test(
                suffix
            )
    ) {
        return '';
    }

    return suffix;
}

const COLORS = [
    [
        '#dcfce7',
        '#166534',
        '#86efac',
        '#22c55e'
    ],
    [
        '#ffedd5',
        '#9a3412',
        '#fdba74',
        '#f97316'
    ],
    [
        '#dbeafe',
        '#1d4ed8',
        '#93c5fd',
        '#3b82f6'
    ],
    [
        '#f3e8ff',
        '#7e22ce',
        '#d8b4fe',
        '#a855f7'
    ],
    [
        '#ffe4e6',
        '#be123c',
        '#fda4af',
        '#f43f5e'
    ],
    [
        '#cffafe',
        '#0e7490',
        '#67e8f9',
        '#06b6d4'
    ],
    [
        '#fef3c7',
        '#92400e',
        '#fcd34d',
        '#f59e0b'
    ],
    [
        '#e0e7ff',
        '#4338ca',
        '#a5b4fc',
        '#6366f1'
    ],
    [
        '#ccfbf1',
        '#0f766e',
        '#5eead4',
        '#14b8a6'
    ]
];

function emptyAccountAnalysis() {

    return {
        dominant: '',
        ranked: [],
        styles:
            new Map(),
        accountCount:
            0,
        different:
            0
    };
}

function analyzeAccounts(
    rows
) {

    const counts =
        new Map();

    for (
        const r
        of rows
    ) {

        r.studentAccount =
            studentAccount(
                r.studentAccount
            );

        r._accountDomain =
            accountDomain(
                r.studentAccount
            );

        if (
            r._accountDomain
        ) {

            counts.set(
                r._accountDomain,
                (
                    counts.get(
                        r._accountDomain
                    )
                    ||
                    0
                )
                +
                1
            );
        }
    }

    const ranked =
        [
            ...counts
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    (
                        b[1] -
                        a[1]
                    )
                    ||
                    collator.compare(
                        a[0],
                        b[0]
                    )
            );

    let dominant =
        '';

    if (
        ranked.length ===
        1
    ) {

        dominant =
            ranked[0][0];
    }
    else if (
        ranked.length >
        1
        &&
        ranked[0][1] >
        ranked[1][1]
    ) {

        dominant =
            ranked[0][0];
    }

    const styles =
        new Map();

    let i =
        dominant
            ?
            1
            :
            0;

    for (
        const [
            d
        ]
        of ranked
    ) {

        styles.set(
            d,
            d ===
            dominant
                ?
                COLORS[0]
                :
                COLORS[
                    i++ %
                    COLORS.length
                ]
        );
    }

    const accountCount =
        rows
            .filter(
                r =>
                    r.studentAccount
            )
            .length;

    return {
        dominant,
        ranked,
        styles,
        accountCount,

        different:
            dominant
                ?
                rows
                    .filter(
                        r =>
                            r._accountDomain
                            &&
                            r._accountDomain !==
                            dominant
                    )
                    .length
                :
                0
    };
}

function accountColor(
    d
) {

    return (
        state
            .accountAnalysis
            .styles
            .get(
                d
            )
        ||
        [
            '#f1f5f9',
            '#475569',
            '#cbd5e1',
            '#64748b'
        ]
    );
}

// =========================================================
// الأعمدة
// =========================================================

const COLS = [

    [
        'serial',
        'م',
        'number'
    ],

    [
        'name',
        'اسم الطالب',
        'text'
    ],

    [
        'civilId',
        'رقم السجل المدني',
        'text'
    ],

    [
        'grade',
        'الصف',
        'text'
    ],

    [
        'className',
        'الفصل',
        'text'
    ],

    [
        'studentAccount',
        'حساب الطالب',
        'text'
    ],

    [
        'studentPhone',
        'جوال الطالب',
        'phone'
    ],

    [
        'guardianName',
        'ولي الأمر',
        'text'
    ],

    [
        'guardianPhone',
        'جوال ولي الأمر',
        'phone'
    ]
];

const FOLLOW = [

    [
        'serial',
        'م'
    ],

    [
        'name',
        'اسم الطالب'
    ],

    [
        'civilId',
        'رقم السجل المدني'
    ],

    [
        'grade',
        'الصف'
    ],

    [
        'className',
        'الفصل'
    ],

    [
        'studentAccount',
        'حساب الطالب'
    ],

    [
        'studentPhone',
        'جوال الطالب'
    ],

    [
        'guardianName',
        'ولي الأمر'
    ],

    [
        'guardianPhone',
        'جوال ولي الأمر'
    ]
];

const TPL = {

    daily: [
        'حضور|check',
        'مشاركة|check',
        'واجب|check',
        'ملاحظات|note'
    ],

    weekly: [
        'الأحد|check',
        'الاثنين|check',
        'الثلاثاء|check',
        'الأربعاء|check',
        'الخميس|check'
    ],

    homework: [
        'واجب 1|check',
        'واجب 2|check',
        'واجب 3|check',
        'واجب 4|check'
    ],

    assessment: [
        'مهارة 1|score',
        'مهارة 2|score',
        'مهارة 3|score',
        'الدرجة|score',
        'ملاحظات|note'
    ],

    memorization: [
        'حفظ 1|score',
        'حفظ 2|score',
        'حفظ 3|score',
        'مراجعة|check',
        'ملاحظات|note'
    ],

    skills: [
        'مهارة 1|score',
        'مهارة 2|score',
        'مهارة 3|score',
        'مهارة 4|score',
        'مهارة 5|score'
    ],

    project: [
        'التخطيط|score',
        'التنفيذ|score',
        'التعاون|score',
        'التسليم|check',
        'ملاحظات|note'
    ],

    remedial: [
        'تشخيص|score',
        'تدخل 1|check',
        'تدخل 2|check',
        'إتقان|check',
        'ملاحظات|note'
    ],

    behavior: [
        'انضباط|check',
        'تفاعل|check',
        'التزام|check',
        'ملاحظات|note'
    ]
};

const TPL_META = {
    daily: { label: 'متابعة يومية', title: 'كشف متابعة يومية', cellMode: 'blank' },
    weekly: { label: 'أيام الأسبوع', title: 'كشف متابعة أسبوعية', cellMode: 'check' },
    homework: { label: 'واجبات', title: 'كشف متابعة الواجبات', cellMode: 'check' },
    assessment: { label: 'تقييم ومهارات', title: 'كشف تقييم الطلاب', cellMode: 'score' },
    memorization: { label: 'حفظ ومراجعة', title: 'كشف الحفظ والمراجعة', cellMode: 'score' },
    skills: { label: 'مهارات', title: 'كشف متابعة المهارات', cellMode: 'score' },
    project: { label: 'مشروع', title: 'كشف متابعة المشروع', cellMode: 'score' },
    remedial: { label: 'خطة علاجية', title: 'كشف الخطة العلاجية', cellMode: 'check' },
    behavior: { label: 'سلوك وانضباط', title: 'كشف السلوك والانضباط', cellMode: 'check' }
};

function prefsDefault() {

    return {
        title:
            'كشف متابعة الطلاب',

        teacher:
            '',

        school:
            '',

        grade:
            '',

        className:
            '',

        year:
            '',

        fields: [
            'serial',
            'name'
        ],

        follow: [
            'متابعة 1',
            'متابعة 2',
            'متابعة 3',
            'متابعة 4',
            'متابعة 5'
        ],

        extra:
            0,

        period:
            '',

        followScope:
            'all',

        followGrade:
            '',

        followClasses:
            [],

        followSort:
            'class-name',

        followGroup:
            'grade-class',

        followPerClass:
            true,

        followSearch:
            '',

        followCellMode:
            'blank',

        followRowsPerPage:
            32,

        followRepeatHeader:
            true,

        orientation:
            'portrait'
    };
}

function prefsLoad() {

    try {

        return {
            ...prefsDefault(),

            ...JSON.parse(
                localStorage.getItem(
                    PREF
                )
                ||
                '{}'
            )
        };
    }
    catch {

        return (
            prefsDefault()
        );
    }
}

function prefsSave() {

    try {

        localStorage.setItem(
            PREF,
            JSON.stringify(
                state.prefs
            )
        );
    }
    catch {}
}

function record() {

    return {
        serial: '',
        name: '',
        civilId: '',
        grade: '',
        className: '',
        studentAccount: '',
        studentPhone: '',
        guardianName: '',
        guardianPhone: '',
        source:
            PLATFORM_LABEL,

        _accountDomain:
            '',

        _rawStudentPhone:
            '',

        _rawGuardianPhone:
            ''
    };
}

const state = {

    running:
        false,

    cancel:
        false,

    rows:
        [],

    filtered:
        [],

    sort:
        '',

    dir:
        'asc',

    accountAnalysis:
        emptyAccountAnalysis(),

    prefs:
        prefsLoad(),

    comparison:
        null,

    noorBusy:
        false,

    pages:
        0,

    scope:
        null,

    audit:
        null,

    timelineRows:
        [],

    lastImportMeta:
        null,

    followSelection:
        new Set(),

    followSelectionTouched:
        false
};

// =========================================================
// التصميم
// =========================================================

const css =
    document.createElement(
        'style'
    );

css.textContent = `

#${BTN}{
    position:static;
    display:inline-flex;
    align-items:center;
    justify-content:center;
    gap:6px;
    border:1px solid #0f766e;
    border-radius:9px;
    padding:8px 12px;
    background:#0f766e;
    color:#fff;
    font:800 13px Tahoma,Arial,sans-serif;
    cursor:pointer;
    box-shadow:none;
    line-height:1.3;
    white-space:nowrap
}

#${BTN}:hover{
    filter:brightness(.96)
}

#${BTN}:disabled{
    opacity:.55;
    cursor:not-allowed
}

.${APP}-inline-slot{
    display:inline-flex;
    align-items:center;
    gap:6px;
    margin:6px 8px;
    vertical-align:middle;
    direction:rtl;
    position:relative;
    z-index:10
}

.${APP}-inline-slot.in-list{
    list-style:none;
    margin:0 6px;
    padding:0
}

.${APP}-inline-slot.fallback{
    display:flex;
    width:max-content;
    max-width:calc(100% - 24px);
    margin:10px 12px
}

#${APP},
#${APP} *{
    box-sizing:border-box
}

#${APP}{
    position:fixed;
    inset:0;
    z-index:2147483001;
    display:none;
    align-items:center;
    justify-content:center;
    background:#0008;
    padding:16px;
    direction:rtl;
    font-family:Tahoma,Arial
}

#${APP}.open{
    display:flex
}

#${APP} .m0-shell{
    width:min(1450px,98vw);
    height:min(94vh,980px);
    background:#fff;
    border-radius:18px;
    overflow:hidden;
    display:flex;
    flex-direction:column
}

#${APP} .m0-shell{
    color:#111827 !important;
    isolation:isolate
}

#${APP} .m0-header,
#${APP} .m0-tabs,
#${APP} .m0-main,
#${APP} .m0-footer{
    visibility:visible !important;
    opacity:1 !important;
    position:relative
}

#${APP} .m0-header{
    display:flex;
    justify-content:space-between;
    align-items:center;
    background:linear-gradient(135deg,#0f766e,#134e4a);
    color:#fff;
    padding:13px 16px
}

#${APP} h2{
    margin:0;
    font-size:18px
}

#${APP} .small{
    font-size:10px;
    opacity:.9
}

#${APP} .headbtn{
    border:1px solid #ffffff35;
    background:#ffffff18;
    color:#fff;
    border-radius:9px;
    padding:7px 10px;
    cursor:pointer
}

#${APP} .m0-tabs{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    background:#f8fafc;
    border-bottom:1px solid #e2e8f0
}

#${APP} .tab{
    border:0;
    background:transparent;
    padding:10px;
    cursor:pointer;
    color:#64748b;
    font-weight:800
}

#${APP} .tab.on{
    background:#ecfdf5;
    color:#0f766e;
    border-bottom:3px solid #0f766e
}

#${APP} .m0-main{
    padding:14px;
    overflow:auto;
    flex:1
}

#${APP} .pane{
    display:none !important
}

#${APP} .pane.on{
    display:block !important
}

#${APP} .note{
    padding:10px 12px;
    border-radius:10px;
    background:#effafa;
    border-right:4px solid #0f766e;
    color:#315d61;
    font-size:12px;
    line-height:1.8;
    margin:8px 0
}

#${APP} .warn{
    background:#fff7ed;
    border-right-color:#ea580c;
    color:#9a3412
}

#${APP} .bar{
    display:flex;
    gap:8px;
    flex-wrap:wrap;
    margin:10px 0
}

#${APP} .b{
    border:1px solid #d1d5db;
    background:#fff;
    border-radius:9px;
    padding:8px 11px;
    cursor:pointer;
    font-weight:800
}

#${APP} .b.p{
    background:#0f766e;
    color:#fff;
    border-color:#0f766e
}

#${APP} .b.r{
    background:#b91c1c;
    color:#fff;
    border-color:#b91c1c
}

#${APP} .b:disabled{
    opacity:.4;
    cursor:not-allowed
}

#${APP} input,
#${APP} select,
#${APP} textarea{
    border:1px solid #d1d5db;
    border-radius:8px;
    padding:8px 9px;
    font:inherit;
    background:#fff
}

#${APP} textarea{
    min-height:90px;
    resize:vertical
}

#${APP} .grid{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:9px
}

#${APP} .field{
    display:flex;
    flex-direction:column;
    gap:4px
}

#${APP} .field label{
    font-size:11px;
    color:#64748b;
    font-weight:800
}

#${APP} .stats{
    display:flex;
    gap:7px;
    flex-wrap:wrap;
    margin:10px 0
}

#${APP} .chip{
    padding:7px 10px;
    border-radius:999px;
    border:1px solid #cbd5e1;
    background:#fff;
    font-size:11px
}

#${APP} .chip b{
    color:#0f766e;
    margin-right:5px
}

#${APP} .accountchip{
    display:inline-block;
    padding:3px 6px;
    border-radius:7px;
    border:1px solid;
    font-weight:800;
    direction:ltr
}

#${APP} .table{
    border:1px solid #e5e7eb;
    border-radius:10px;
    overflow:auto;
    max-height:45vh
}

#${APP} table{
    width:100%;
    border-collapse:collapse;
    font-size:12px
}

#${APP} th,
#${APP} td{
    padding:7px 8px;
    border-bottom:1px solid #edf0f2;
    text-align:right;
    white-space:nowrap
}

#${APP} th{
    position:sticky;
    top:0;
    background:#f3f4f6;
    z-index:1;
    cursor:pointer
}

#${APP} th.sel{
    background:#d1fae5;
    color:#065f46
}

#${APP} .checkwrap{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:7px
}

#${APP} .check{
    display:flex;
    align-items:center;
    gap:7px;
    border:1px solid #e2e8f0;
    border-radius:9px;
    padding:7px
}

#${APP} .check input{
    appearance:none;
    width:18px;
    height:18px;
    padding:0;
    border:2px solid #94a3b8;
    border-radius:5px
}

#${APP} .check input:checked{
    background:#0f766e;
    border-color:#0f766e;
    box-shadow:inset 0 0 0 3px #fff
}

#${APP} .compare{
    border:1px solid #cbd5e1;
    background:#f8fafc;
    border-radius:12px;
    padding:12px;
    margin:12px 0
}

#${APP} .sum{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:8px;
    margin-top:10px
}

#${APP} .card{
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:9px;
    padding:9px
}

#${APP} .card b{
    display:block;
    font-size:18px
}

.green{
    color:#15803d
}

.red{
    color:#b91c1c
}

.orange{
    color:#c2410c
}

#${APP} .diffgrid{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:10px;
    margin-top:10px
}

#${APP} .diff{
    border:1px solid #e2e8f0;
    border-radius:10px;
    overflow:hidden;
    background:#fff
}

#${APP} .diff.full{
    grid-column:1/-1
}

#${APP} .dh{
    padding:8px 10px;
    font-weight:800;
    background:#f8fafc
}

#${APP} .preview{
    border:1px solid #dbe4e8;
    border-radius:10px;
    overflow:auto;
    max-height:45vh;
    margin-top:10px
}

#${APP} .preview th{
    background:#0f766e;
    color:#fff;
    text-align:center
}

#${APP} .preview td{
    text-align:center;
    height:36px
}

#${APP} .preview .name{
    text-align:right
}

#${APP} .m0-footer{
    padding:7px 12px;
    border-top:1px solid #e5e7eb;
    background:#f8fafc;
    font-size:10px;
    color:#64748b;
    display:flex;
    justify-content:space-between
}

#${APP} .m0-footer a{
    color:#0f766e;
    text-decoration:none;
    font-weight:800
}

.m0t{
    position:fixed;
    left:20px;
    bottom:20px;
    z-index:2147483647;
    background:#374151;
    color:#fff;
    padding:11px 13px;
    border-radius:9px;
    opacity:0;
    transform:translateY(8px);
    transition:.2s;
    font:700 12px Tahoma
}

.m0t.on{
    opacity:1;
    transform:none
}

.m0t.ok{
    background:#15803d
}

.m0t.err{
    background:#b91c1c
}


#${APP} .timeline-event{
    border-right:4px solid #0f766e;
    background:#f8fafc;
    border-radius:10px;
    padding:10px 12px;
    margin:8px 0
}

#${APP} .timeline-event.current{
    background:#ecfdf5;
    border-right-color:#16a34a
}

#${APP} .timeline-date{
    font-weight:800;
    color:#0f766e;
    margin-bottom:5px
}

#${APP} .timeline-change{
    display:grid;
    grid-template-columns:150px 1fr 28px 1fr;
    gap:6px;
    align-items:center;
    padding:5px 0;
    border-top:1px dashed #dbe4e8
}

#${APP} .reviewcase{
    border:1px solid #fdba74;
    background:#fffaf5;
    border-radius:10px;
    padding:10px;
    margin:8px 0
}

#${APP} .reviewcase .recordbox{
    background:#fff;
    border:1px solid #e2e8f0;
    border-radius:8px;
    padding:8px;
    line-height:1.8
}

#${APP} .reviewgrid{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:8px;
    margin:8px 0
}

#${APP} .manual-badge{
    display:inline-block;
    background:#ede9fe;
    color:#6d28d9;
    border:1px solid #c4b5fd;
    border-radius:999px;
    padding:3px 7px;
    font-size:10px;
    font-weight:800
}


#${APP} .followstudio{
    border:1px solid #99f6e4;
    background:linear-gradient(180deg,#f0fdfa,#ffffff);
    border-radius:14px;
    padding:12px;
    margin-bottom:14px
}

#${APP} .followhero{
    display:flex;
    align-items:flex-start;
    justify-content:space-between;
    gap:12px;
    margin-bottom:10px
}

#${APP} .followhero b{
    color:#0f766e;
    font-size:15px
}

#${APP} .followcount{
    display:inline-flex;
    gap:5px;
    align-items:center;
    background:#0f766e;
    color:#fff;
    border-radius:999px;
    padding:5px 9px;
    font-size:11px;
    font-weight:800
}

#${APP} .followpicker{
    border:1px solid #dbe4e8;
    border-radius:10px;
    max-height:220px;
    overflow:auto;
    background:#fff;
    margin-top:8px
}

#${APP} .followpicker table{
    font-size:11px
}

#${APP} .followpicker th{
    top:0
}

#${APP} .followpicker input[type=checkbox]{
    width:17px;
    height:17px;
    accent-color:#0f766e
}

#${APP} .followhint{
    font-size:10px;
    color:#64748b;
    line-height:1.8
}

#${APP} .preview{
    background:#e2e8f0;
    padding:12px
}

#${APP} .preview .sheet{
    background:#fff;
    color:#111827;
    margin:12px auto;
    padding:14px;
    box-shadow:0 4px 20px #0f172a22;
    border-radius:4px;
    overflow:hidden
}

#${APP} .preview .sheet.portrait{
    width:min(100%,794px)
}

#${APP} .preview .sheet.landscape{
    width:min(100%,1123px)
}

#${APP} .preview .sheetmeta{
    text-align:center;
    font-size:11px;
    margin-bottom:8px;
    line-height:1.8
}

#${APP} .preview .sheetmark{
    display:flex;
    justify-content:space-between;
    gap:8px;
    color:#64748b;
    font-size:10px;
    margin-bottom:5px
}

#${APP} .follow-check{
    font-size:16px;
    color:#64748b
}

#${APP} .follow-note{
    min-width:22mm
}

#${APP} .follow-score{
    min-width:12mm
}

@media(max-width:900px){

    #${APP} .m0-tabs,
    #${APP} .grid,
    #${APP} .checkwrap,
    #${APP} .sum,
    #${APP} .diffgrid{
        grid-template-columns:1fr
    }

    #${APP} .m0-footer{
        display:block
    }
}
`;

document.head.appendChild(
    css
);

const launcher =
    document.createElement(
        'button'
    );

launcher.id =
    BTN;

launcher.type =
    'button';

launcher.textContent =
    '📋 راصد الطلاب';

function elementVisible(el) {
    if (!el || !el.isConnected) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function integrationReference() {
    const links = [...document.querySelectorAll('a,button,[role=button]')];

    if (PLATFORM === 'noor') {
        return links.find(el =>
            elementVisible(el) &&
            (
                norm(el.textContent) === norm('التقارير') ||
                norm(el.textContent) === norm('الطلاب') ||
                norm(el.textContent) === norm('الرئيسية')
            )
        ) || null;
    }

    const preferred = [
        'التقارير',
        'الطلاب',
        'إدارة الطلاب',
        'الرئيسية'
    ];

    return links.find(el =>
        elementVisible(el) &&
        preferred.some(text => norm(el.textContent).includes(norm(text)))
    ) || null;
}

function integrationHost() {
    const ref = integrationReference();

    if (ref) {
        const list = ref.closest('ul,ol');
        if (list) return { host: list, list: true };

        const nav = ref.closest('nav,[role=navigation],header,.navbar,.nav,.menu,.topbar,.header');
        if (nav) return { host: nav, list: false };

        if (ref.parentElement) return { host: ref.parentElement, list: false };
    }

    const candidates = [
        'header',
        'nav',
        '[role=navigation]',
        'main',
        '[role=main]',
        '.container',
        '.content',
        '#content'
    ];

    for (const selector of candidates) {
        const el = [...document.querySelectorAll(selector)].find(elementVisible);
        if (el) return { host: el, list: false, fallback: true };
    }

    return { host: document.body, list: false, fallback: true };
}

function mountIntegratedLauncher() {
    if (launcher.isConnected) return true;

    const target = integrationHost();
    if (!target?.host) return false;

    const slot = document.createElement(target.list ? 'li' : 'div');
    slot.className = `${APP}-inline-slot${target.list ? ' in-list' : ''}${target.fallback ? ' fallback' : ''}`;
    slot.dataset.rasidLauncherSlot = '1';
    slot.appendChild(launcher);

    if (target.list) {
        target.host.appendChild(slot);
    }
    else {
        target.host.prepend(slot);
    }

    return true;
}

mountIntegratedLauncher();

const launcherMountObserver = new MutationObserver(() => {
    if (!launcher.isConnected) {
        mountIntegratedLauncher();
    }
});

launcherMountObserver.observe(document.documentElement, {
    childList: true,
    subtree: true
});

const host =
    document.createElement(
        'div'
    );

host.id =
    APP;

host.innerHTML = `

<div class="m0-shell">

<div class="m0-header">

 <div>

  <h2>
   راصد الطلاب

   <span class="small">
    ${PLATFORM_LABEL}
    ·
    v${VERSION}
   </span>
  </h2>

  <div class="small">
   استخراج ← مراجعة ومقارنة ← كشف متابعة ← تصدير
  </div>

 </div>

 <div>

  <button class="headbtn about">
   عن السكربت
  </button>

  <button class="headbtn close">
   ×
  </button>

 </div>

</div>

<div class="m0-tabs">

 <button
  class="tab on"
  data-tab="extract"
 >
  1 — استخراج
 </button>

 <button
  class="tab"
  data-tab="review"
 >
  2 — مراجعة ومقارنة
 </button>

 <button
  class="tab"
  data-tab="follow"
 >
  3 — كشف المتابعة
 </button>

 <button
  class="tab"
  data-tab="export"
 >
  4 — التصدير
 </button>

</div>

<div class="m0-main">

<div
 class="pane on"
 data-pane="extract"
>

 <div class="note intro"></div>

 <div
  class="note warn allnote"
  style="display:none"
 >
  لرصد الطلاب الذين تغيّرت فصولهم في
  <b>مدرستي</b>
  بدقة:
  اجعل اختيار الفصل على
  <b>الكل</b>
  في النسخة القديمة والحالية قبل الاستخراج.
 </div>

 <div class="bar">

  <button class="b p start">
   ▶ بدء الاستخراج
  </button>

  <button
   class="b p schoolstart"
   style="display:none"
  >
   🚀 استخراج المدرسة كاملة
  </button>

  <button
   class="b r cancel"
   disabled
  >
   إلغاء
  </button>

  <button
   class="b clear"
   disabled
  >
   مسح النتائج
  </button>

 </div>

 <div class="status">
  جاهز.
 </div>

 <div class="stats topstats"></div>

</div>

<div
 class="pane"
 data-pane="review"
>

 <h3>
  إحصائيات الفصول
 </h3>

 <div class="stats classstats"></div>

 <div class="scopebox"></div>

 <div class="accountbox"></div>

 <div class="compare">

  <b>
   🧾 مقارنة مع نسخة سابقة
  </b>

  <div
   class="small"
   style="
    margin-top:5px;
    color:#64748b
   "
  >
   النتيجة تعرض:
   طلاب جدد،
   غير موجودين حاليًا،
   جميع الحقول التي تغيّرت،
   والحالات غير المحسومة التي لا يجوز للسكربت تخمينها.
  </div>

  <div
   class="note warn allnote2"
   style="display:none"
  >
   في مدرستي يجب استخراج
   <b>الكل</b>
   في النسختين
   حتى تكون نتيجة تغيّر الفصول صحيحة.
  </div>

  <div class="bar">

   <button
    class="b save"
    disabled
   >
    💾 حفظ نسخة
   </button>

   <button
    class="b import"
    disabled
   >
    📂 استيراد نسخة
   </button>

   <button
    class="b diffexp"
    disabled
   >
    📊 تصدير الفروقات Excel
   </button>

   <button
    class="b cmpclear"
    disabled
   >
    مسح المقارنة
   </button>

   <input
    class="snapfile"
    type="file"
    accept=".json,application/json"
    hidden
   >

  </div>

  <div class="cmpout"></div>

 </div>

 <div class="compare timelinebox">

  <b>
   🕘 سجل الطالب الزمني
  </b>

  <div class="small" style="margin-top:5px;color:#64748b;line-height:1.8">
   يحفظ راصد الاستخراجات المكتملة والنسخ المستوردة محليًا في هذا المتصفح،
   ويعرض التغيرات المثبتة للطالب عبر الزمن. لا يتم إرسال السجل إلى أي خادم.
  </div>

  <div class="bar">

   <select class="timelinestudent" style="min-width:320px">
    <option value="">اختر طالبًا لعرض سجله الزمني</option>
   </select>

   <button class="b timelineview" disabled>
    🕘 عرض السجل
   </button>

   <button class="b timelineclear">
    🗑 مسح السجل المحلي
   </button>

   <button class="b identityclear">
    🧩 مسح روابط المطابقة اليدوية
   </button>

  </div>

  <div class="timelineout"></div>

 </div>

 <div
  class="grid"
  style="
   grid-template-columns:
   1fr 180px 220px
  "
 >

  <input
   class="search"
   placeholder="بحث بالاسم أو السجل أو الحساب أو الجوال"
  >

  <select class="classfilter">

   <option value="">
    كل الفصول
   </option>

  </select>

  <select class="accountfilter">

   <option value="">
    كل حسابات الطلاب
   </option>

  </select>

 </div>

 <div
  class="table"
  style="margin-top:10px"
 >

  <table class="students">

   <thead></thead>

   <tbody>

    <tr>
     <td>
      لا توجد بيانات.
     </td>
    </tr>

   </tbody>

  </table>

 </div>

 <div class="bar">

  <button class="b back1">
   ← الاستخراج
  </button>

  <button
   class="b p tofollow"
   disabled
  >
   التالي:
   كشف المتابعة ←
  </button>

 </div>

</div>

<div
 class="pane"
 data-pane="follow"
>

 <div class="followstudio">

  <div class="followhero">
   <div>
    <b>🧰 استوديو كشوف المتابعة</b>
    <div class="followhint">حدد النطاق والفصول والترتيب قبل الطباعة. لا يغيّر هذا بيانات الاستخراج الأصلية.</div>
   </div>
   <span class="followcount fcountsummary">0 طالب</span>
  </div>

  <div class="grid">
   <div class="field">
    <label>نطاق الكشف</label>
    <select class="fscope">
     <option value="all">كل الطلاب المستخرجين</option>
     <option value="filtered">نتيجة الفلترة في المراجعة</option>
     <option value="selected">طلاب محددون يدويًا</option>
     <option value="added">الطلاب الجدد من آخر مقارنة</option>
     <option value="changed">الطلاب الذين تغيرت بياناتهم</option>
     <option value="class-changed">الطلاب الذين تغير فصلهم</option>
    </select>
   </div>

   <div class="field">
    <label>الصف</label>
    <select class="fgradefilter"><option value="">كل الصفوف</option></select>
   </div>

   <div class="field">
    <label>الفصول — يمكن اختيار أكثر من فصل</label>
    <select class="fclassfilter" multiple size="4"></select>
    <button type="button" class="b fclassall" style="margin-top:5px">كل الفصول</button>
   </div>
  </div>

  <div class="grid" style="margin-top:8px">
   <div class="field">
    <label>الترتيب</label>
    <select class="fsort">
     <option value="source">ترتيب المصدر</option>
     <option value="name">أبجديًا بالاسم</option>
     <option value="class-name">الفصل ثم الاسم</option>
     <option value="grade-class-name">الصف ثم الفصل ثم الاسم</option>
     <option value="serial">الرقم التسلسلي</option>
    </select>
   </div>

   <div class="field">
    <label>التجميع</label>
    <select class="fgroup">
     <option value="none">بدون تجميع</option>
     <option value="class">حسب الفصل</option>
     <option value="grade-class">حسب الصف والفصل</option>
    </select>
   </div>

   <div class="field">
    <label>بحث داخل الكشف</label>
    <input class="fsearch" placeholder="اسم / سجل / حساب / جوال">
   </div>
  </div>

  <div class="bar">
   <label class="check"><input class="fperclass" type="checkbox"><span>كشف مستقل لكل فصل</span></label>
   <label class="check"><input class="frepeathead" type="checkbox"><span>رأس مستقل لكل صفحة</span></label>
   <button class="b fselectall" type="button">تحديد الظاهر</button>
   <button class="b fselectnone" type="button">إلغاء التحديد</button>
   <button class="b fselectinvert" type="button">عكس التحديد</button>
   <button class="b fcopynames" type="button">📋 نسخ أسماء النطاق</button>
   <button class="b fcopygroups" type="button">📋 نسخ الأسماء حسب الفصول</button>
  </div>

  <div class="followhint">
   لا يتم حفظ قائمة الطلاب المحددين في التخزين المحلي؛ التحديد اليدوي يبقى داخل جلسة الصفحة الحالية فقط.
  </div>

  <div class="followpicker"></div>
 </div>

 <h3>
  بيانات رأس الكشف
 </h3>

 <div class="grid">

  <div class="field">

   <label>
    عنوان الكشف
   </label>

   <input class="ftitle">

  </div>

  <div class="field">

   <label>
    اسم المعلم
   </label>

   <input class="fteacher">

  </div>

  <div class="field">

   <label>
    اسم المدرسة
   </label>

   <input class="fschool">

  </div>

  <div class="field">

   <label>
    الصف
   </label>

   <input class="fgrade">

  </div>

  <div class="field">

   <label>
    الفصل
   </label>

   <input class="fclass">

  </div>

  <div class="field">

   <label>
    العام الدراسي
   </label>

   <input class="fyear">

  </div>

  <div class="field">

   <label>
    الفترة / الأسبوع
   </label>

   <input class="fperiod" placeholder="مثال: الأسبوع الخامس">

  </div>

 </div>

 <h3>
  البيانات المسحوبة
 </h3>

 <div class="note">
  عمود «م» ثابت.
  الاسم وبقية البيانات تتكيف مع أطول قيمة،
  ثم تستخدم المساحة المتبقية
  لأعمدة المتابعة.
 </div>

 <div class="checkwrap fields"></div>

 <h3>
  أعمدة المتابعة
 </h3>

 <div class="grid">

  <div class="field">

   <label>
    قالب
   </label>

   <select class="tpl">

    <option value="custom">
     مخصص
    </option>

    <option value="daily">
     يومي
    </option>

    <option value="weekly">
     أيام الأسبوع
    </option>

    <option value="homework">
     واجبات
    </option>

    <option value="assessment">
     تقييم
    </option>

   </select>

  </div>

  <div class="field">

   <label>
    عدد الأعمدة
   </label>

   <input
    class="fcount"
    type="number"
    min="1"
    max="30"
    value="5"
   >

  </div>

  <div class="field">

   <label>
    البادئة
   </label>

   <input
    class="fprefix"
    value="متابعة"
   >

  </div>

 </div>

 <div
  class="field"
  style="margin-top:8px"
 >

  <label>
   كل سطر = عمود
  </label>

  <textarea class="fcols"></textarea>
  <div class="followhint">يمكن تحديد نوع كل عمود بهذه الصيغة: <b>واجب 1|check</b> أو <b>درجة|score</b> أو <b>ملاحظات|note</b>. السطر بدون نوع يستخدم النوع الافتراضي أدناه.</div>

 </div>

 <div
  class="grid"
  style="margin-top:8px"
 >

  <div class="field">

   <label>
    صفوف إضافية
   </label>

   <input
    class="fextra"
    type="number"
    min="0"
    max="50"
   >

  </div>

  <div class="field">

   <label>
    اتجاه الورقة
   </label>

   <select class="forient">

    <option value="portrait">
     عمودي A4
    </option>

    <option value="landscape">
     أفقي A4
    </option>

   </select>

  </div>

  <div class="field">
   <label>نوع الخانة الافتراضي</label>
   <select class="fcellmode">
    <option value="blank">فارغة</option>
    <option value="check">مربع متابعة □</option>
    <option value="score">درجة / رقم</option>
    <option value="note">ملاحظة قصيرة</option>
   </select>
  </div>

  <div class="field">
   <label>طلاب لكل صفحة</label>
   <input class="frowsperpage" type="number" min="10" max="60" value="32">
  </div>

 </div>

 <div class="bar">

  <button class="b applytpl">
   تطبيق القالب
  </button>

  <button class="b fsavetpl">
   💾 حفظ كقالب
  </button>

  <button class="b fdeletetpl">
   🗑 حذف القالب المحفوظ
  </button>

  <button class="b gencols">
   توليد الأعمدة
  </button>

  <button class="b p refresh">
   تحديث المعاينة
  </button>

 </div>

 <div class="preview"></div>

 <div class="bar">

  <button class="b back2">
   ← المراجعة
  </button>

  <button
   class="b print"
   disabled
  >
   🖨 طباعة/PDF
  </button>

  <button
   class="b xls"
   disabled
  >
   📊 Excel
  </button>

  <button
   class="b copyfollow"
   disabled
  >
   📋 نسخ
  </button>

  <button
   class="b p toexport"
   disabled
  >
   التالي:
   التصدير ←
  </button>

 </div>

</div>

<div
 class="pane"
 data-pane="export"
>

 <div class="grid">

  <div class="compare">

   <h3>
    نسخة للمقارنة
   </h3>

   <div class="bar">

    <button
     class="b p save2"
     disabled
    >
     💾 حفظ نسخة
    </button>

    <button
     class="b import2"
     disabled
    >
     📂 استيراد نسخة
    </button>

    <button
     class="b diffexp2"
     disabled
    >
     📊 تصدير الفروقات Excel
    </button>

   </div>

  </div>

  <div class="compare">

   <h3>
    بيانات الطلاب
   </h3>

   <div class="bar">

    <button
     class="b csv"
     disabled
    >
     CSV
    </button>

    <button
     class="b copy"
     disabled
    >
     نسخ إلى Excel
    </button>

    <button
     class="b byclass"
     disabled
    >
     CSV لكل فصل
    </button>

   </div>

  </div>

  <div class="compare">

   <h3>
    كشف المتابعة
   </h3>

   <div class="bar">

    <button
     class="b print2"
     disabled
    >
     🖨 طباعة/PDF
    </button>

    <button
     class="b xls2"
     disabled
    >
     📊 Excel
    </button>

    <button class="b editfollow">
     تعديل الكشف
    </button>

   </div>

  </div>

 </div>

</div>

</div>

<div class="m0-footer">

 <span>
  تصميم وتطوير:
  <b>
   ${DEV.name}
   (${DEV.handle})
  </b>
 </span>

 <span>

  <a
   href="${DEV.greasy}"
   target="_blank"
  >
   GreasyFork
  </a>

  ·

  <a
   href="${DEV.x}"
   target="_blank"
  >
   X
  </a>

  ·

  <a
   href="${DEV.snap}"
   target="_blank"
  >
   Snapchat
  </a>

 </span>

</div>

</div>
`;

document.body.appendChild(
    host
);

const $ =
    s =>
        host.querySelector(
            s
        );

const $$ =
    s =>
        [
            ...host.querySelectorAll(
                s
            )
        ];

const ui = {

    close:
        $('.close'),

    about:
        $('.about'),

    intro:
        $('.intro'),

    allnote:
        $('.allnote'),

    allnote2:
        $('.allnote2'),

    start:
        $('.start'),

    schoolstart:
        $('.schoolstart'),

    cancel:
        $('.cancel'),

    clear:
        $('.clear'),

    status:
        $('.status'),

    topstats:
        $('.topstats'),

    classstats:
        $('.classstats'),

    scopebox:
        $('.scopebox'),

    accountbox:
        $('.accountbox'),

    save:
        $('.save'),

    save2:
        $('.save2'),

    import:
        $('.import'),

    import2:
        $('.import2'),

    diffexp:
        $('.diffexp'),

    diffexp2:
        $('.diffexp2'),

    cmpclear:
        $('.cmpclear'),

    snapfile:
        $('.snapfile'),

    cmpout:
        $('.cmpout'),

    timelinestudent:
        $('.timelinestudent'),

    timelineview:
        $('.timelineview'),

    timelineclear:
        $('.timelineclear'),

    identityclear:
        $('.identityclear'),

    timelineout:
        $('.timelineout'),

    search:
        $('.search'),

    classfilter:
        $('.classfilter'),

    accountfilter:
        $('.accountfilter'),

    students:
        $('.students'),

    tofollow:
        $('.tofollow'),

    back1:
        $('.back1'),

    fields:
        $('.fields'),

    fscope:
        $('.fscope'),

    fgradefilter:
        $('.fgradefilter'),

    fclassfilter:
        $('.fclassfilter'),

    fclassall:
        $('.fclassall'),

    fsort:
        $('.fsort'),

    fgroup:
        $('.fgroup'),

    fsearch:
        $('.fsearch'),

    fperclass:
        $('.fperclass'),

    frepeathead:
        $('.frepeathead'),

    fcountsummary:
        $('.fcountsummary'),

    fselectall:
        $('.fselectall'),

    fselectnone:
        $('.fselectnone'),

    fselectinvert:
        $('.fselectinvert'),

    fcopynames:
        $('.fcopynames'),

    fcopygroups:
        $('.fcopygroups'),

    followpicker:
        $('.followpicker'),

    ftitle:
        $('.ftitle'),

    fteacher:
        $('.fteacher'),

    fschool:
        $('.fschool'),

    fgrade:
        $('.fgrade'),

    fclass:
        $('.fclass'),

    fyear:
        $('.fyear'),

    fperiod:
        $('.fperiod'),

    tpl:
        $('.tpl'),

    fcount:
        $('.fcount'),

    fprefix:
        $('.fprefix'),

    fcols:
        $('.fcols'),

    fextra:
        $('.fextra'),

    forient:
        $('.forient'),

    fcellmode:
        $('.fcellmode'),

    frowsperpage:
        $('.frowsperpage'),

    applytpl:
        $('.applytpl'),

    fsavetpl:
        $('.fsavetpl'),

    fdeletetpl:
        $('.fdeletetpl'),

    gencols:
        $('.gencols'),

    refresh:
        $('.refresh'),

    preview:
        $('.preview'),

    back2:
        $('.back2'),

    print:
        $('.print'),

    print2:
        $('.print2'),

    xls:
        $('.xls'),

    xls2:
        $('.xls2'),

    copyfollow:
        $('.copyfollow'),

    toexport:
        $('.toexport'),

    csv:
        $('.csv'),

    copy:
        $('.copy'),

    byclass:
        $('.byclass'),

    editfollow:
        $('.editfollow')
};

// =========================================================
// وظائف الواجهة
// =========================================================

function tab(
    name
) {

    $$('.tab')
        .forEach(
            b =>
                b.classList.toggle(
                    'on',
                    b.dataset.tab ===
                    name
                )
        );

    $$('.pane')
        .forEach(
            p =>
                p.classList.toggle(
                    'on',
                    p.dataset.pane ===
                    name
                )
        );

    if (
        name ===
        'review'
    ) {

        renderClassStats();
        renderAccountAnalysis();
        renderTimelineSelector();
        renderTimeline();
    }

    if (
        name ===
        'follow'
    ) {
        renderFollow();
    }
}

function open() {

    host.classList.add(
        'open'
    );
}

function close() {

    if (
        !state.running
        &&
        !loadNoorJob()?.active
    ) {

        host.classList.remove(
            'open'
        );
    }
}

function running(
    v
) {

    state.running =
        v;

    ui.start.disabled =
        v;

    if (ui.schoolstart) {
        ui.schoolstart.disabled = v;
    }

    ui.cancel.disabled =
        !v;

    ui.close.disabled =
        v;

    launcher.disabled =
        v;
}

function status(
    t
) {

    ui.status.textContent =
        t;
}

function enable(
    v
) {

    [
        ui.clear,
        ui.save,
        ui.save2,
        ui.import,
        ui.import2,
        ui.tofollow,
        ui.print,
        ui.print2,
        ui.xls,
        ui.xls2,
        ui.copyfollow,
        ui.toexport,
        ui.csv,
        ui.copy,
        ui.byclass
    ]
        .forEach(
            x =>
                x.disabled =
                    !v
        );

    diffButtons();
}

function diffButtons() {

    const x =
        !state.comparison;

    ui.diffexp.disabled =
        x;

    ui.diffexp2.disabled =
        x;

    ui.cmpclear.disabled =
        x;
}

// =========================================================
// شرح النظام
// =========================================================

if (
    PLATFORM ===
    'madrasati'
) {

    ui.intro.innerHTML =
        'من شاشة بيانات الطلاب في <b>مدرستي</b>: سيستخرج الاسم، الفصل، <b>حساب الطالب</b> كما يظهر في النظام، جوال الطالب 05، ولي الأمر، وجوال ولي الأمر 05. ويحلل لاحقة الحساب بعد @ داخليًا لتلوين النطاقات المختلفة دون إنشاء عمود إضافي.';

    ui.allnote.style.display =
        '';

    ui.allnote2.style.display =
        '';
}
else {

    ui.intro.innerHTML =
        `في <b>نور</b> — <b>${esc(NOOR_VIEW_LABEL || 'واجهة نور')}</b>: «بدء الاستخراج» يقرأ التقرير الحالي، و«استخراج المدرسة كاملة» يمر على الصفوف والفصول الفعلية ويثبت الصف والفصل من قوائم نور نفسها. يدعم راصد واجهة نور القديمة وواجهة V2 الحديثة بمحرك ReportViewer موحّد.`;

    ui.schoolstart.style.display = '';
}

// =========================================================
// إحصائيات الفصول
// =========================================================

function emptyScope() {

    return {
        platform: PLATFORM,
        mode: 'unknown',
        label: 'غير محدد',
        grade: '',
        className: '',
        studySystem: '',
        grades: [],
        verified: false
    };
}

function scopeText(scope = state.scope) {

    const s = scope || emptyScope();

    if (s.mode === 'whole-school') {
        return `المدرسة كاملة${s.studySystem ? ` — ${s.studySystem}` : ''}`;
    }

    if (s.mode === 'all-classes') {
        return 'كل الفصول';
    }

    if (s.mode === 'single-class') {
        return `الفصل ${s.className || '—'}`;
    }

    if (s.mode === 'current-report') {
        return [s.grade, s.className ? `الفصل ${s.className}` : '']
            .filter(Boolean)
            .join(' — ') || 'التقرير الحالي';
    }

    return s.label || 'غير محدد';
}

function scopeFileTag() {

    const s = state.scope || emptyScope();

    if (s.mode === 'whole-school') {
        return s.studySystem
            ? `المدرسة_كاملة_${s.studySystem}`
            : 'المدرسة_كاملة';
    }

    if (s.mode === 'all-classes') {
        return 'الكل';
    }

    if (s.mode === 'single-class') {
        return `فصل_${s.className || 'غير_محدد'}`;
    }

    if (s.mode === 'current-report') {
        return [
            s.grade,
            s.className
                ? (s.className === 'الكل' ? 'الكل' : `فصل_${s.className}`)
                : ''
        ].filter(Boolean).join('_') || 'التقرير_الحالي';
    }

    return s.label || 'غير_محدد';
}

function classGroupKey(r) {

    const cls = clean(r.className) || 'بدون فصل';

    if (
        PLATFORM === 'noor'
        && state.scope?.mode === 'whole-school'
    ) {
        return `${clean(r.grade) || 'بدون صف'}\u0001${cls}`;
    }

    return cls;
}

function classGroupLabel(r) {

    const cls = clean(r.className) || 'بدون فصل';

    if (
        PLATFORM === 'noor'
        && state.scope?.mode === 'whole-school'
    ) {
        return `${clean(r.grade) || 'بدون صف'} / ${cls}`;
    }

    return cls;
}

function classStats(
    rows = state.rows
) {

    const m = new Map();

    for (const r of rows) {

        const key = classGroupKey(r);
        const label = classGroupLabel(r);

        if (!m.has(key)) {
            m.set(key, {
                label,
                count: 0
            });
        }

        m.get(key).count++;
    }

    return [...m.entries()]
        .map(([key, v]) => [key, v.count, v.label])
        .sort((a, b) => collator.compare(a[2], b[2]));
}

function renderScopeAudit() {

    if (!ui.scopebox) return;

    if (!state.rows.length) {
        ui.scopebox.innerHTML = '';
        return;
    }

    const scope = state.scope || emptyScope();
    const audit = state.audit || {};
    const warnings = Array.isArray(audit.warnings)
        ? audit.warnings
        : [];

    const integrity = audit.complete === false
        ? '<b class="red">غير مكتمل</b>'
        : '<b class="green">مكتمل</b>';

    ui.scopebox.innerHTML = `
        <div class="note ${warnings.length ? 'warn' : ''}">
            <b>نطاق الاستخراج:</b> ${esc(scopeText(scope))}
            — تدقيق الاستخراج: ${integrity}
            — السجلات الخام: <b>${Number(audit.rawRows ?? state.rows.length)}</b>
            — الطلاب النهائيون: <b>${state.rows.length}</b>
            ${audit.exactDuplicates ? `— تكرارات مطابقة أزيلت: <b>${audit.exactDuplicates}</b>` : ''}
            ${warnings.length ? `<br>⚠️ ${warnings.map(esc).join(' · ')}` : ''}
        </div>
    `;
}

function renderTop() {

    ui.topstats.innerHTML = `

        <span class="chip">
            الطلاب
            <b>
                ${state.rows.length}
            </b>
        </span>

        <span class="chip">
            الفصول
            <b>
                ${classStats().length}
            </b>
        </span>

        <span class="chip">
            الصفحات
            <b>
                ${state.pages}
            </b>
        </span>

        <span class="chip">
            النطاق
            <b>
                ${esc(scopeText())}
            </b>
        </span>

        ${
            PLATFORM ===
            'madrasati'
                ?
                `
                    <span class="chip">
                        حسابات الطلاب
                        <b>
                            ${
                                state
                                    .accountAnalysis
                                    .accountCount
                            }
                        </b>
                    </span>

                    <span class="chip">
                        نطاقات الحساب
                        <b>
                            ${
                                state
                                    .accountAnalysis
                                    .ranked
                                    .length
                            }
                        </b>
                    </span>
                `
                :
                ''
        }
    `;
}

function renderClassStats() {

    const s =
        classStats();

    ui.classstats.innerHTML =
        s.length
            ?
            s
                .map(
                    (
                        [
                            ,
                            n,
                            label
                        ]
                    ) =>
                        `
                            <span class="chip">
                                ${esc(label)}

                                <b>
                                    ${n}
                                </b>
                            </span>
                        `
                )
                .join('')
            :
            'لا توجد بيانات.';
}

// =========================================================
// تحليل حساب الطالب
// =========================================================

function renderAccountAnalysis() {

    if (
        PLATFORM !==
        'madrasati'
    ) {

        ui.accountbox.innerHTML =
            '';

        ui.accountfilter.innerHTML =
            '<option value="">كل حسابات الطلاب</option>';

        return;
    }

    const a =
        state.accountAnalysis;

    let html =
        '<h3>حساب الطالب</h3>';

    if (
        !a.ranked.length
    ) {

        ui.accountbox.innerHTML =
            html
            +
            '<div class="note">لا توجد لاحقات قابلة للتحليل في حسابات الطلاب الحالية.</div>';

        ui.accountfilter.innerHTML =
            '<option value="">كل حسابات الطلاب</option>';

        return;
    }

    html +=
        `
            <div class="stats">

                ${
                    a.ranked
                        .map(
                            (
                                [
                                    d,
                                    n
                                ]
                            ) => {

                                const c =
                                    accountColor(
                                        d
                                    );

                                return `
                                    <span
                                        class="chip"
                                        style="
                                            background:${c[0]};
                                            color:${c[1]};
                                            border-color:${c[2]}
                                        "
                                    >
                                        ${
                                            d ===
                                            a.dominant
                                                ?
                                                '★ '
                                                :
                                                ''
                                        }

                                        @${esc(d)}

                                        <b style="color:${c[1]}">
                                            ${n}
                                        </b>
                                    </span>
                                `;
                            }
                        )
                        .join('')
                }

            </div>
        `;

    if (
        a.dominant
    ) {

        html +=
            `
                <div class="note">
                    اللاحقة الأكثر تكرارًا في
                    <b>حساب الطالب</b>
                    هي
                    <b>
                        @${esc(a.dominant)}
                    </b>.

                    اختلاف اللاحقة مؤشر للمراجعة فقط
                    وليس إثباتًا أن الطالب منقول.
                </div>
            `;
    }
    else if (
        a.ranked.length >
        1
    ) {

        html +=
            '<div class="note">لا توجد لاحقة غالبة بوضوح؛ لذلك تم تمييز كل لاحقة بلون مختلف فقط.</div>';
    }

    ui.accountbox.innerHTML =
        html;

    ui.accountfilter.innerHTML =
        '<option value="">كل حسابات الطلاب</option>'
        +
        a.ranked
            .map(
                (
                    [
                        d,
                        n
                    ]
                ) =>
                    `
                        <option value="${esc(d)}">
                            @${esc(d)}
                            (${n})
                        </option>
                    `
            )
            .join('');
}

// =========================================================
// جدول البيانات
// =========================================================

function visibleCols() {

    return (
        COLS.filter(
            (
                [
                    k
                ]
            ) =>
                k ===
                'serial'
                ||
                k ===
                'name'
                ||
                state.rows.some(
                    r =>
                        clean(
                            r[k]
                        )
                )
        )
    );
}

function compareVal(
    a,
    b,
    key
) {

    const type =
        (
            COLS.find(
                x =>
                    x[0] ===
                    key
            )
            ||
            []
        )[2]
        ||
        'text';

    if (
        type ===
        'number'
    ) {

        return (
            (
                Number(
                    a[key]
                )
                ||
                0
            )
            -
            (
                Number(
                    b[key]
                )
                ||
                0
            )
        );
    }

    return (
        collator.compare(
            clean(
                a[key]
            ),
            clean(
                b[key]
            )
        )
    );
}

function filtered() {

    const q =
        norm(
            ui.search.value
        );

    const cl =
        ui.classfilter.value;

    const ad =
        ui.accountfilter.value;

    let rows =
        state.rows
            .filter(
                r =>
                    (
                        !cl
                        ||
                        classGroupKey(r) ===
                        cl
                    )
                    &&
                    (
                        !ad
                        ||
                        r._accountDomain ===
                        ad
                    )
                    &&
                    (
                        !q
                        ||
                        [
                            r.name,
                            r.civilId,
                            r.grade,
                            r.className,
                            r.studentAccount,
                            r.studentPhone,
                            r.guardianName,
                            r.guardianPhone
                        ]
                            .some(
                                v =>
                                    norm(
                                        v
                                    )
                                        .includes(
                                            q
                                        )
                            )
                    )
            );

    if (
        state.sort
    ) {

        rows =
            rows
                .slice()
                .sort(
                    (
                        a,
                        b
                    ) =>
                        compareVal(
                            a,
                            b,
                            state.sort
                        )
                        *
                        (
                            state.dir ===
                            'desc'
                                ?
                                -1
                                :
                                1
                        )
                );
    }

    state.filtered =
        rows;

    renderTable();
    renderFollow();
}

function fillClassFilter() {

    const cur =
        ui.classfilter.value;

    ui.classfilter.innerHTML =
        '<option value="">كل الفصول</option>'
        +
        classStats()
            .map(
                (
                    [
                        key,
                        n,
                        label
                    ]
                ) =>
                    `
                        <option value="${esc(key)}">
                            ${esc(label)}
                            (${n})
                        </option>
                    `
            )
            .join('');

    if (
        [
            ...ui.classfilter.options
        ]
            .some(
                o =>
                    o.value ===
                    cur
            )
    ) {

        ui.classfilter.value =
            cur;
    }
}

function renderTable() {

    const cols =
        visibleCols();

    const th =
        ui.students
            .querySelector(
                'thead'
            );

    const tb =
        ui.students
            .querySelector(
                'tbody'
            );

    th.innerHTML =
        '<tr>'
        +
        cols
            .map(
                (
                    [
                        k,
                        l
                    ]
                ) =>
                    `
                        <th
                            data-k="${k}"
                            class="${
                                state.sort ===
                                k
                                    ?
                                    'sel'
                                    :
                                    ''
                            }"
                        >
                            ${esc(l)}

                            ${
                                state.sort ===
                                k
                                    ?
                                    (
                                        state.dir ===
                                        'asc'
                                            ?
                                            '▲'
                                            :
                                            '▼'
                                    )
                                    :
                                    '↕'
                            }
                        </th>
                    `
            )
            .join('')
        +
        '</tr>';

    tb.innerHTML =
        state.filtered.length
            ?
            state.filtered
                .map(
                    r =>
                        '<tr>'
                        +
                        cols
                            .map(
                                (
                                    [
                                        k
                                    ]
                                ) => {

                                    if (
                                        k ===
                                        'studentAccount'
                                        &&
                                        r.studentAccount
                                    ) {

                                        const c =
                                            accountColor(
                                                r._accountDomain
                                            );

                                        return `
                                            <td>

                                                <span
                                                    class="accountchip"
                                                    style="
                                                        background:${c[0]};
                                                        color:${c[1]};
                                                        border-color:${c[2]}
                                                    "
                                                >
                                                    ${
                                                        esc(
                                                            r.studentAccount
                                                        )
                                                    }
                                                </span>

                                            </td>
                                        `;
                                    }

                                    return `
                                        <td>
                                            ${
                                                esc(
                                                    clean(
                                                        r[k]
                                                    )
                                                    ||
                                                    '—'
                                                )
                                            }
                                        </td>
                                    `;
                                }
                            )
                            .join('')
                        +
                        '</tr>'
                )
                .join('')
            :
            `
                <tr>
                    <td colspan="${cols.length}">
                        لا توجد نتائج.
                    </td>
                </tr>
            `;

    th
        .querySelectorAll(
            '[data-k]'
        )
        .forEach(
            x =>
                x.onclick =
                    () => {

                        const k =
                            x.dataset.k;

                        if (
                            state.sort ===
                            k
                        ) {

                            state.dir =
                                state.dir ===
                                'asc'
                                    ?
                                    'desc'
                                    :
                                    'asc';
                        }
                        else {

                            state.sort =
                                k;

                            state.dir =
                                'asc';
                        }

                        filtered();
                    }
        );
}

function afterExtract(
    rows,
    pages = 1,
    scope = null,
    audit = null,
    options = {}
) {

    state.rows = rows;
    state.filtered = [...rows];
    state.pages = pages;
    state.scope = scope || emptyScope();
    state.audit = audit || {
        complete: true,
        rawRows: rows.length,
        finalRows: rows.length,
        exactDuplicates: 0,
        warnings: []
    };
    state.sort = '';
    state.comparison = null;

    state.accountAnalysis =
        PLATFORM === 'madrasati'
            ? analyzeAccounts(rows)
            : emptyAccountAnalysis();

    if (options.archive !== false) {
        archiveCurrentExtraction();
    }

    fillClassFilter();
    renderTop();
    renderClassStats();
    renderScopeAudit();
    renderAccountAnalysis();
    renderTimelineSelector();
    renderTimeline();
    renderTable();
    hydrateFollow();
    renderFields();
    renderFollow();

    enable(rows.length > 0);
    clearCompare();
    tab('review');
}

function clearAll(options = {}) {

    if (PLATFORM === 'noor' && !options.preserveNoorResult) {
        clearNoorResult();
    }

    state.rows = [];
    state.filtered = [];
    state.pages = 0;
    state.scope = emptyScope();
    state.audit = null;
    state.sort = '';
    state.accountAnalysis = emptyAccountAnalysis();
    state.comparison = null;

    ui.search.value = '';
    ui.classfilter.innerHTML = '<option value="">كل الفصول</option>';
    ui.accountfilter.innerHTML = '<option value="">كل حسابات الطلاب</option>';
    ui.students.querySelector('thead').innerHTML = '';
    ui.students.querySelector('tbody').innerHTML = '<tr><td>لا توجد بيانات.</td></tr>';
    ui.preview.innerHTML = '';
    if (ui.timelinestudent) ui.timelinestudent.innerHTML = '<option value="">اختر طالبًا لعرض سجله الزمني</option>';
    if (ui.timelineout) ui.timelineout.innerHTML = '<div class="note">استخرج بيانات الطلاب ثم اختر طالبًا لعرض سجله الزمني.</div>';
    if (ui.timelineview) ui.timelineview.disabled = true;

    renderTop();
    renderClassStats();
    renderScopeAudit();
    renderAccountAnalysis();
    clearCompare();
    enable(false);
    status('تم مسح النتائج.');
}

// =========================================================
// السجل الزمني المحلي + روابط الهوية اليدوية
// =========================================================

function identityFingerprint(row) {

    const r = normalizeSnapshotRecord(row);

    return stableStringify({
        name: norm(r.name),
        civilId: compareNorm('civilId', r.civilId),
        grade: norm(r.grade),
        className: norm(r.className),
        studentAccount: compareNorm('studentAccount', r.studentAccount),
        studentPhone: phone966(r.studentPhone),
        guardianName: norm(r.guardianName),
        guardianPhone: phone966(r.guardianPhone)
    });
}

function identityLinksLoad() {
    try {
        const parsed = JSON.parse(localStorage.getItem(IDENTITY_LINKS_KEY) || '{}');
        return {
            version: 1,
            aliases: parsed?.aliases && typeof parsed.aliases === 'object'
                ? parsed.aliases
                : {}
        };
    }
    catch {
        return { version: 1, aliases: {} };
    }
}

function identityLinksSave(data) {
    try {
        localStorage.setItem(
            IDENTITY_LINKS_KEY,
            JSON.stringify({
                version: 1,
                aliases: data.aliases || {}
            })
        );
        return true;
    }
    catch {
        toast('تعذر حفظ رابط الهوية محليًا.', 'err');
        return false;
    }
}

function manualEntityId(row, links = identityLinksLoad()) {
    return links.aliases[identityFingerprint(row)] || '';
}

function mergeEntityIds(links, keepId, mergeId) {
    if (!keepId || !mergeId || keepId === mergeId) return keepId || mergeId;
    for (const key of Object.keys(links.aliases)) {
        if (links.aliases[key] === mergeId) {
            links.aliases[key] = keepId;
        }
    }
    return keepId;
}

function saveManualIdentityLink(oldRow, currentRow) {

    const links = identityLinksLoad();
    const oldKey = identityFingerprint(oldRow);
    const currentKey = identityFingerprint(currentRow);
    const oldId = links.aliases[oldKey] || '';
    const currentId = links.aliases[currentKey] || '';

    let entityId = oldId || currentId;

    if (oldId && currentId && oldId !== currentId) {
        entityId = mergeEntityIds(links, oldId, currentId);
    }

    if (!entityId) {
        entityId = `manual:${Date.now()}:${Math.random().toString(36).slice(2, 9)}`;
    }

    links.aliases[oldKey] = entityId;
    links.aliases[currentKey] = entityId;

    return identityLinksSave(links) ? entityId : '';
}

function propagateKnownIdentity(oldRow, currentRow) {

    const links = identityLinksLoad();
    const oldKey = identityFingerprint(oldRow);
    const currentKey = identityFingerprint(currentRow);
    const oldId = links.aliases[oldKey] || '';
    const currentId = links.aliases[currentKey] || '';

    if (!oldId && !currentId) return;

    let entityId = oldId || currentId;

    if (oldId && currentId && oldId !== currentId) {
        entityId = mergeEntityIds(links, oldId, currentId);
    }

    links.aliases[oldKey] = entityId;
    links.aliases[currentKey] = entityId;
    identityLinksSave(links);
}

function historyLoad() {
    try {
        const data = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
        return Array.isArray(data) ? data : [];
    }
    catch {
        return [];
    }
}

function historySave(entries) {

    let items = [...entries]
        .filter(x => x && Array.isArray(x.records))
        .sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))
        .slice(-HISTORY_LIMIT);

    while (items.length) {
        try {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
            return true;
        }
        catch {
            items.shift();
        }
    }

    try {
        localStorage.removeItem(HISTORY_KEY);
    }
    catch {}

    return false;
}

function sameHistoryEntry(a, b) {
    if (!a || !b) return false;
    if (a.sourceKey !== b.sourceKey) return false;
    if (stableStringify(a.scope || {}) !== stableStringify(b.scope || {})) return false;
    return stableStringify(a.records || []) === stableStringify(b.records || []);
}

function archiveHistoryEntry(entry) {

    if (!entry?.records?.length || entry.sourceKey !== PLATFORM) return;

    const history = historyLoad();
    const last = history[history.length - 1];

    if (sameHistoryEntry(last, entry)) {
        return;
    }

    history.push({
        version: 1,
        id: entry.id || `${PLATFORM}:${entry.at || new Date().toISOString()}:${Math.random().toString(36).slice(2, 7)}`,
        sourceKey: PLATFORM,
        at: entry.at || new Date().toISOString(),
        date: entry.date || stamp(),
        origin: entry.origin || 'extract',
        legacy: !!entry.legacy,
        scope: JSON.parse(JSON.stringify(entry.scope || emptyScope())),
        records: entry.records.map(normalizeSnapshotRecord)
    });

    historySave(history);
}

function archiveCurrentExtraction() {

    if (!state.rows.length || state.audit?.complete === false) return;

    archiveHistoryEntry({
        at: new Date().toISOString(),
        date: stamp(),
        origin: 'extract',
        scope: state.scope,
        records: state.rows.map(snapRow)
    });
}

function archiveImportedSnapshot(snapshot, legacy = false) {

    archiveHistoryEntry({
        id: `import:${snapshot.integrity?.checksum || snapshot.exportedAt || Date.now()}`,
        at: snapshot.exportedAt || `${snapshot.exportedDate || stamp()}T00:00:00`,
        date: snapshot.exportedDate || stamp(),
        origin: 'import',
        legacy,
        scope: snapshot.scope,
        records: snapshot.records
    });
}

function provenTimelineIdentity(a, b) {

    const links = identityLinksLoad();
    const aEntity = manualEntityId(a, links);
    const bEntity = manualEntityId(b, links);

    if (aEntity && bEntity && aEntity === bEntity) {
        return { ok: true, reason: 'ربط يدوي محفوظ' };
    }

    const aCivil = compareNorm('civilId', a.civilId);
    const bCivil = compareNorm('civilId', b.civilId);
    if (aCivil && aCivil === bCivil) {
        return { ok: true, reason: 'السجل المدني' };
    }

    const aAccount = compareNorm('studentAccount', a.studentAccount);
    const bAccount = compareNorm('studentAccount', b.studentAccount);
    if (aAccount && aAccount === bAccount) {
        return { ok: true, reason: 'حساب الطالب' };
    }

    if (norm(a.name) && norm(a.name) === norm(b.name)) {
        const secondary = [
            phone966(a.studentPhone) && phone966(a.studentPhone) === phone966(b.studentPhone),
            phone966(a.guardianPhone) && phone966(a.guardianPhone) === phone966(b.guardianPhone),
            norm(a.guardianName) && norm(a.guardianName) === norm(b.guardianName)
        ].filter(Boolean).length;

        if (secondary >= 1) {
            return { ok: true, reason: 'الاسم + دليل اتصال ثابت' };
        }
    }

    return { ok: false, reason: '' };
}

function timelineVersionsFor(target) {

    const entries = historyLoad()
        .filter(x => x.sourceKey === PLATFORM)
        .sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')));

    const known = [normalizeSnapshotRecord(target)];
    const found = [];

    for (const entry of entries) {

        const candidates = [];

        for (const raw of entry.records || []) {
            const row = normalizeSnapshotRecord(raw);
            if (known.some(k => provenTimelineIdentity(k, row).ok)) {
                candidates.push(row);
            }
        }

        if (candidates.length !== 1) continue;

        const row = candidates[0];
        found.push({
            at: entry.at,
            date: entry.date,
            origin: entry.origin,
            scope: entry.scope,
            legacy: entry.legacy,
            row
        });
        known.push(row);
    }

    const current = normalizeSnapshotRecord(target);

    found.push({
        at: new Date().toISOString(),
        date: stamp(),
        origin: 'current',
        scope: state.scope,
        legacy: false,
        row: current,
        current: true
    });

    const unique = [];

    for (const item of found.sort((a, b) => String(a.at || '').localeCompare(String(b.at || '')))) {
        const previous = unique[unique.length - 1];
        if (previous && stableStringify(previous.row) === stableStringify(item.row)) {
            if (item.current) {
                previous.current = true;
                previous.at = item.at;
                previous.date = item.date;
                previous.scope = item.scope;
                previous.origin = item.origin;
            }
            continue;
        }
        unique.push(item);
    }

    return unique;
}

function timelineStudentLabel(row) {
    const id = PLATFORM === 'noor'
        ? clean(row.civilId)
        : clean(row.studentAccount);
    const where = [clean(row.grade), clean(row.className)].filter(Boolean).join(' / ');
    return [clean(row.name), id, where].filter(Boolean).join(' — ');
}

function renderTimelineSelector() {

    if (!ui.timelinestudent) return;

    const previous = ui.timelinestudent.value;
    const rows = [...state.rows].sort((a, b) => collator.compare(a.name, b.name));
    state.timelineRows = rows;

    ui.timelinestudent.innerHTML = '';
    ui.timelinestudent.appendChild(new Option('اختر طالبًا لعرض سجله الزمني', ''));

    rows.forEach((row, index) => {
        ui.timelinestudent.appendChild(
            new Option(timelineStudentLabel(row), String(index))
        );
    });

    if (previous && Number(previous) < rows.length) {
        ui.timelinestudent.value = previous;
    }

    ui.timelineview.disabled = !rows.length || ui.timelinestudent.value === '';
}

function renderTimeline() {

    if (!ui.timelineout) return;

    const value = ui.timelinestudent?.value;

    if (value === '' || value == null) {
        ui.timelineout.innerHTML = state.rows.length
            ? `<div class="note">اختر طالبًا من القائمة. السجل المحلي يحتوي حاليًا على <b>${historyLoad().length}</b> نسخة/استخراج محفوظ.</div>`
            : '<div class="note">استخرج بيانات الطلاب أولًا.</div>';
        return;
    }

    const target = state.timelineRows[Number(value)];

    if (!target) {
        ui.timelineout.innerHTML = '<div class="note warn">تعذر تحديد الطالب المختار.</div>';
        return;
    }

    const versions = timelineVersionsFor(target);

    if (!versions.length) {
        ui.timelineout.innerHTML = '<div class="note">لا توجد نقاط زمنية لهذا الطالب بعد.</div>';
        return;
    }

    let previous = null;

    ui.timelineout.innerHTML = `
        <div class="note">
            <b>${esc(target.name)}</b> — نقاط زمنية مثبتة: <b>${versions.length}</b>.
            لا يضم السجل أي نسخة لم يستطع راصد إثبات أنها تخص نفس الطالب.
        </div>
        ${versions.map(item => {
            const changes = previous ? rowChanges(previous.row, item.row) : [];
            const first = !previous;
            previous = item;

            return `
                <div class="timeline-event ${item.current ? 'current' : ''}">
                    <div class="timeline-date">
                        ${item.current ? '● الحالية — ' : ''}${esc(item.date || item.at || '—')}
                        <span class="small"> — ${esc(scopeText(item.scope))}</span>
                    </div>
                    ${first
                        ? '<div>نقطة البداية المحفوظة لهذا الطالب.</div>'
                        : changes.length
                            ? changes.map(ch => `
                                <div class="timeline-change">
                                    <b>${esc(ch.label)}</b>
                                    <span>${esc(ch.oldValue || '—')}</span>
                                    <span>←</span>
                                    <span>${esc(ch.newValue || '—')}</span>
                                </div>
                            `).join('')
                            : '<div class="small">لم تتغير البيانات عن النقطة السابقة المثبتة.</div>'
                    }
                </div>
            `;
        }).join('')}
    `;
}

function clearTimelineHistory() {
    if (!confirm('سيتم مسح السجل الزمني المحلي لهذه المنصة فقط. لن تُحذف ملفات النسخ المحفوظة على جهازك. هل تريد المتابعة؟')) return;
    try {
        localStorage.removeItem(HISTORY_KEY);
        renderTimeline();
        toast('تم مسح السجل الزمني المحلي.');
    }
    catch {
        toast('تعذر مسح السجل المحلي.', 'err');
    }
}

function clearManualIdentityLinks() {
    if (!confirm('سيتم مسح جميع روابط المطابقة اليدوية المحفوظة لهذه المنصة. لن تُحذف بيانات الطلاب أو ملفات النسخ. هل تريد المتابعة؟')) return;
    try {
        localStorage.removeItem(IDENTITY_LINKS_KEY);
        if (state.comparison?.snapshot) {
            compareSnapshot(
                state.comparison.snapshot,
                state.comparison.importMeta || {}
            );
        }
        renderTimeline();
        toast('تم مسح روابط المطابقة اليدوية.');
    }
    catch {
        toast('تعذر مسح روابط المطابقة اليدوية.', 'err');
    }
}

// =========================================================
// المقارنة وحفظ النسخ — الوضع المحافظ عالي الدقة
// =========================================================

const COMPARE_FIELDS = [
    ['name', 'اسم الطالب', 'text'],
    ['civilId', 'رقم السجل المدني', 'civil'],
    ['grade', 'الصف', 'text'],
    ['className', 'الفصل', 'text'],
    ['studentAccount', 'حساب الطالب', 'account'],
    ['studentPhone', 'جوال الطالب', 'phone'],
    ['guardianName', 'ولي الأمر', 'text'],
    ['guardianPhone', 'جوال ولي الأمر', 'phone']
];

function snapRow(r) {

    return {
        name: clean(r.name),
        civilId: clean(r.civilId),
        grade: clean(r.grade),
        className: clean(r.className),
        studentAccount: clean(r.studentAccount),
        studentPhone: clean(r.studentPhone),
        guardianName: clean(r.guardianName),
        guardianPhone: clean(r.guardianPhone)
    };
}

function normalizeSnapshotRecord(r) {

    return {
        name: clean(r?.name),
        civilId: clean(r?.civilId),
        grade: clean(r?.grade),
        className: clean(r?.className),
        studentAccount: clean(r?.studentAccount || r?.studentEmail),
        studentPhone: clean(r?.studentPhone || r?.studentPhoneLocal),
        guardianName: clean(r?.guardianName),
        guardianPhone: clean(r?.guardianPhone || r?.guardianPhoneLocal)
    };
}

function stableStringify(value) {

    if (value === null || typeof value !== 'object') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }

    const keys = Object.keys(value).sort();

    return '{' + keys
        .map(k => JSON.stringify(k) + ':' + stableStringify(value[k]))
        .join(',') + '}';
}

async function sha256(text) {

    if (!crypto?.subtle) return '';

    const data = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', data);

    return [...new Uint8Array(hash)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

function canonicalSnapshotCore(snapshot) {

    return {
        schema: snapshot.schema,
        scriptVersion: snapshot.scriptVersion,
        sourceKey: snapshot.sourceKey,
        sourceLabel: snapshot.sourceLabel,
        exportedDate: snapshot.exportedDate,
        exportedAt: snapshot.exportedAt,
        scope: snapshot.scope,
        audit: snapshot.audit,
        recordCount: snapshot.recordCount,
        records: snapshot.records
    };
}

function normalizedScope(scope, records = [], sourceKey = PLATFORM) {

    if (scope && typeof scope === 'object') {
        return {
            ...emptyScope(),
            ...scope,
            platform: sourceKey || scope.platform || PLATFORM
        };
    }

    const rows = records.map(normalizeSnapshotRecord);
    const grades = [...new Set(rows.map(r => clean(r.grade)).filter(Boolean))];
    const classes = [...new Set(rows.map(r => clean(r.className)).filter(Boolean))];

    if (sourceKey === 'madrasati') {
        return {
            ...emptyScope(),
            platform: sourceKey,
            mode: classes.length > 1 ? 'all-classes' : 'single-class',
            label: classes.length > 1 ? 'الكل' : (classes[0] ? `فصل_${classes[0]}` : 'غير محدد'),
            className: classes.length > 1 ? 'الكل' : (classes[0] || ''),
            verified: false
        };
    }

    return {
        ...emptyScope(),
        platform: sourceKey,
        mode: grades.length > 1 ? 'whole-school' : 'current-report',
        label: grades.length > 1
            ? 'المدرسة كاملة'
            : [grades[0], classes[0] ? `فصل_${classes[0]}` : ''].filter(Boolean).join('_') || 'غير محدد',
        grade: grades.length === 1 ? grades[0] : '',
        className: classes.length === 1 ? classes[0] : '',
        verified: false
    };
}

function scopeCompatibility(oldScope, currentScope) {

    const a = oldScope || emptyScope();
    const b = currentScope || emptyScope();

    if (a.platform !== b.platform) {
        return {
            ok: false,
            message: 'النسخة السابقة تخص منصة مختلفة.'
        };
    }

    if (a.mode === 'whole-school' || b.mode === 'whole-school') {

        if (a.mode !== 'whole-school' || b.mode !== 'whole-school') {
            return {
                ok: false,
                message: `لا يمكن مقارنة «${scopeText(a)}» مع «${scopeText(b)}». استخرج النطاق نفسه في النسختين.`
            };
        }

        if (
            clean(a.studySystem)
            && clean(b.studySystem)
            && norm(a.studySystem) !== norm(b.studySystem)
        ) {
            return {
                ok: false,
                message: `النظام الدراسي مختلف: السابقة «${a.studySystem}» والحالية «${b.studySystem}».`
            };
        }

        return { ok: true };
    }

    if (a.mode === 'all-classes' || b.mode === 'all-classes') {
        return a.mode === 'all-classes' && b.mode === 'all-classes'
            ? { ok: true }
            : {
                ok: false,
                message: `نطاق المقارنة مختلف: السابقة «${scopeText(a)}» والحالية «${scopeText(b)}».`
            };
    }

    if (a.mode === 'single-class' && b.mode === 'single-class') {
        return norm(a.className) === norm(b.className)
            ? { ok: true }
            : {
                ok: false,
                message: `الفصل مختلف: السابقة «${a.className}» والحالية «${b.className}».`
            };
    }

    if (a.mode === 'current-report' && b.mode === 'current-report') {
        const sameGrade = norm(a.grade) === norm(b.grade);
        const sameClass = norm(a.className) === norm(b.className);
        return sameGrade && sameClass
            ? { ok: true }
            : {
                ok: false,
                message: `تقرير نور السابق «${scopeText(a)}» يختلف عن الحالي «${scopeText(b)}».`
            };
    }

    return {
        ok: false,
        message: `تعذر إثبات توافق نطاق النسختين: «${scopeText(a)}» و«${scopeText(b)}».`
    };
}

function compareNorm(key, value) {

    const type = COMPARE_FIELDS.find(x => x[0] === key)?.[2] || 'text';

    if (type === 'phone') {
        return phone966(value);
    }

    if (type === 'civil') {
        return toEn(clean(value)).replace(/[\s\-–—]/g, '');
    }

    if (type === 'account') {
        return clean(value).toLowerCase();
    }

    return norm(value);
}

function rowChanges(oldRow, newRow) {

    const changes = [];

    for (const [key, label] of COMPARE_FIELDS) {

        const oldValue = clean(oldRow[key]);
        const newValue = clean(newRow[key]);

        if (compareNorm(key, oldValue) !== compareNorm(key, newValue)) {
            changes.push({
                key,
                label,
                oldValue,
                newValue
            });
        }
    }

    return changes;
}

function duplicateExactRows(records) {

    const seen = new Set();
    const duplicates = [];

    records.forEach((r, index) => {
        const key = stableStringify(normalizeSnapshotRecord(r));
        if (seen.has(key)) duplicates.push(index + 1);
        else seen.add(key);
    });

    return duplicates;
}

function strongKeyConflicts(records, sourceKey) {

    const conflicts = [];
    const keys = sourceKey === 'noor'
        ? [['civilId', 'السجل المدني', r => compareNorm('civilId', r.civilId)]]
        : [['studentAccount', 'حساب الطالب', r => compareNorm('studentAccount', r.studentAccount)]];

    for (const [, label, fn] of keys) {

        const map = new Map();

        for (const r of records) {
            const key = fn(r);
            if (!key) continue;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(r);
        }

        for (const [key, list] of map) {
            if (list.length > 1) {
                conflicts.push({
                    field: label,
                    key,
                    count: list.length
                });
            }
        }
    }

    return conflicts;
}

async function saveSnapshot() {

    if (!state.rows.length) return;

    if (state.audit?.complete === false) {
        toast('لن يتم حفظ نسخة مقارنة لأن تدقيق الاستخراج الحالي غير مكتمل. راجع ملاحظات الاستخراج أولًا.', 'err');
        return;
    }

    archiveCurrentExtraction();

    const records = state.rows
        .map(snapRow)
        .sort((a, b) =>
            collator.compare(a.name, b.name)
            || collator.compare(a.grade, b.grade)
            || collator.compare(a.className, b.className)
        );

    const core = {
        schema: SNAP,
        scriptVersion: VERSION,
        sourceKey: PLATFORM,
        sourceLabel: PLATFORM_LABEL,
        exportedDate: stamp(),
        exportedAt: new Date().toISOString(),
        scope: JSON.parse(JSON.stringify(state.scope || emptyScope())),
        audit: JSON.parse(JSON.stringify(state.audit || {})),
        recordCount: records.length,
        records
    };

    const checksum = await sha256(stableStringify(core));

    const payload = {
        ...core,
        integrity: {
            algorithm: checksum ? 'SHA-256' : 'غير متاح',
            checksum
        }
    };

    textDownload(
        '\uFEFF' + JSON.stringify(payload, null, 2),
        fileName('نسخة-للمقارنة', 'json'),
        'application/json;charset=utf-8'
    );

    toast(
        checksum
            ? 'تم حفظ نسخة مقارنة ببصمة تحقق SHA-256.'
            : 'تم حفظ النسخة، لكن المتصفح لم يوفر SHA-256.',
        checksum ? 'ok' : 'err'
    );
}

async function validateImportedSnapshot(snapshot) {

    if (
        !snapshot
        || !SNAP_OK.has(snapshot.schema)
        || !Array.isArray(snapshot.records)
    ) {
        throw Error('الملف ليس نسخة مقارنة صادرة من راصد الطلاب.');
    }

    if (snapshot.sourceKey !== PLATFORM) {
        throw Error(`النسخة تخص ${snapshot.sourceLabel || snapshot.sourceKey} وليست ${PLATFORM_LABEL}.`);
    }

    if (!snapshot.records.length) {
        throw Error('نسخة المقارنة لا تحتوي على سجلات طلاب.');
    }

    for (let i = 0; i < snapshot.records.length; i++) {
        if (!snapshot.records[i] || typeof snapshot.records[i] !== 'object') {
            throw Error(`السجل رقم ${i + 1} داخل النسخة غير صالح.`);
        }
    }

    const exactDuplicates = duplicateExactRows(snapshot.records);

    if (exactDuplicates.length) {
        throw Error(`نسخة المقارنة تحتوي على ${exactDuplicates.length} سجل مكرر مطابقًا بالكامل؛ لن تتم المقارنة قبل إصلاح النسخة.`);
    }

    let legacy = snapshot.schema !== SNAP;

    if (state.audit?.complete === false) {
        throw Error('الاستخراج الحالي عليه ملاحظات تدقيق تمنع المقارنة الموثوقة. أعد الاستخراج حتى يصبح التدقيق مكتملًا.');
    }

    if (!legacy && snapshot.audit?.complete === false) {
        throw Error('النسخة السابقة حُفظت من استخراج غير مكتمل؛ لن تتم مقارنتها تلقائيًا.');
    }

    if (!legacy) {

        if (Number(snapshot.recordCount) !== snapshot.records.length) {
            throw Error(`عدد السجلات داخل الملف (${snapshot.records.length}) لا يطابق العدد المسجل في النسخة (${snapshot.recordCount}).`);
        }

        if (!snapshot.integrity?.checksum) {
            throw Error('نسخة المقارنة الحديثة لا تحتوي على بصمة سلامة.');
        }

        const calculated = await sha256(
            stableStringify(canonicalSnapshotCore(snapshot))
        );

        if (!calculated || calculated !== snapshot.integrity.checksum) {
            throw Error('فشل التحقق من بصمة النسخة. الملف عُدّل أو تلف بعد حفظه.');
        }
    }

    snapshot.scope = normalizedScope(
        snapshot.scope,
        snapshot.records,
        snapshot.sourceKey
    );

    const scopeCheck = scopeCompatibility(snapshot.scope, state.scope);

    if (!scopeCheck.ok) {
        throw Error(scopeCheck.message);
    }

    return {
        snapshot,
        legacy,
        strongConflicts: strongKeyConflicts(
            snapshot.records.map(normalizeSnapshotRecord),
            snapshot.sourceKey
        )
    };
}

function uniqueMap(rows, keyFn) {

    const map = new Map();

    for (const row of rows) {
        if (row._matched) continue;
        const key = keyFn(row);
        if (!key) continue;
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(row);
    }

    return map;
}

function matchManualAliases(oldRows, newRows, pairs) {

    const links = identityLinksLoad();
    const oldMap = new Map();
    const newMap = new Map();

    for (const row of oldRows) {
        if (row._matched) continue;
        const id = manualEntityId(row, links);
        if (!id) continue;
        if (!oldMap.has(id)) oldMap.set(id, []);
        oldMap.get(id).push(row);
    }

    for (const row of newRows) {
        if (row._matched) continue;
        const id = manualEntityId(row, links);
        if (!id) continue;
        if (!newMap.has(id)) newMap.set(id, []);
        newMap.get(id).push(row);
    }

    for (const [id, currentList] of newMap) {
        const oldList = oldMap.get(id) || [];
        if (oldList.length !== 1 || currentList.length !== 1) continue;

        const oldRow = oldList[0];
        const currentRow = currentList[0];

        if (oldRow._matched || currentRow._matched) continue;

        oldRow._matched = true;
        currentRow._matched = true;

        pairs.push({
            old: oldRow,
            current: currentRow,
            reason: 'ربط يدوي محفوظ',
            confidence: 'يدوي مؤكد'
        });
    }
}

function matchUnique(oldRows, newRows, keyFn, reason, pairs) {

    const oldMap = uniqueMap(oldRows, keyFn);
    const newMap = uniqueMap(newRows, keyFn);

    for (const [key, currentList] of newMap) {

        const oldList = oldMap.get(key) || [];

        if (currentList.length === 1 && oldList.length === 1) {

            const oldRow = oldList[0];
            const currentRow = currentList[0];

            if (oldRow._matched || currentRow._matched) continue;

            oldRow._matched = true;
            currentRow._matched = true;

            pairs.push({
                old: oldRow,
                current: currentRow,
                reason,
                confidence: 'قطعي'
            });
        }
    }
}

function pairScore(oldRow, currentRow) {

    let score = 0;
    const evidence = [];

    const add = (condition, points, label) => {
        if (condition) {
            score += points;
            evidence.push(label);
        }
    };

    add(
        compareNorm('civilId', oldRow.civilId)
        && compareNorm('civilId', oldRow.civilId) === compareNorm('civilId', currentRow.civilId),
        500,
        'السجل المدني'
    );

    add(
        compareNorm('studentAccount', oldRow.studentAccount)
        && compareNorm('studentAccount', oldRow.studentAccount) === compareNorm('studentAccount', currentRow.studentAccount),
        350,
        'حساب الطالب'
    );

    add(
        norm(oldRow.name)
        && norm(oldRow.name) === norm(currentRow.name),
        150,
        'الاسم'
    );

    add(
        phone966(oldRow.guardianPhone)
        && phone966(oldRow.guardianPhone) === phone966(currentRow.guardianPhone),
        180,
        'جوال ولي الأمر'
    );

    add(
        phone966(oldRow.studentPhone)
        && phone966(oldRow.studentPhone) === phone966(currentRow.studentPhone),
        160,
        'جوال الطالب'
    );

    add(
        norm(oldRow.guardianName)
        && norm(oldRow.guardianName) === norm(currentRow.guardianName),
        80,
        'ولي الأمر'
    );

    add(
        norm(oldRow.grade)
        && norm(oldRow.grade) === norm(currentRow.grade),
        25,
        'الصف'
    );

    add(
        norm(oldRow.className)
        && norm(oldRow.className) === norm(currentRow.className),
        10,
        'الفصل'
    );

    return {
        score,
        evidence
    };
}

function strictCandidateMatching(oldRows, newRows, pairs, unresolved) {

    const oldUnmatched = oldRows.filter(x => !x._matched);
    const newUnmatched = newRows.filter(x => !x._matched);
    const candidates = [];

    for (const oldRow of oldUnmatched) {
        for (const currentRow of newUnmatched) {

            const result = pairScore(oldRow, currentRow);

            if (result.score >= 150) {
                candidates.push({
                    old: oldRow,
                    current: currentRow,
                    ...result
                });
            }
        }
    }

    for (const currentRow of newUnmatched) {

        if (currentRow._matched) continue;

        const currentCandidates = candidates
            .filter(x => x.current === currentRow && !x.old._matched)
            .sort((a, b) => b.score - a.score);

        if (!currentCandidates.length) continue;

        const best = currentCandidates[0];
        const second = currentCandidates[1];

        const oldCandidates = candidates
            .filter(x => x.old === best.old && !x.current._matched)
            .sort((a, b) => b.score - a.score);

        const oldBest = oldCandidates[0];
        const oldSecond = oldCandidates[1];

        const currentMargin = !second || (best.score - second.score >= 60);
        const oldMargin = !oldSecond || (oldBest.score - oldSecond.score >= 60);
        const mutualBest = oldBest?.current === currentRow;

        if (
            best.score >= 230
            && currentMargin
            && oldMargin
            && mutualBest
        ) {
            best.old._matched = true;
            currentRow._matched = true;
            pairs.push({
                old: best.old,
                current: currentRow,
                reason: best.evidence.join(' + '),
                confidence: 'قوي'
            });
        } else {
            unresolved.push({
                current: currentRow,
                candidates: currentCandidates.slice(0, 3).map(x => ({
                    old: x.old,
                    score: x.score,
                    evidence: x.evidence
                }))
            });
        }
    }
}

function compareSnapshot(snapshot, importMeta = {}) {

    const oldRows = snapshot.records.map(r => ({
        ...normalizeSnapshotRecord(r),
        _matched: false
    }));

    const currentRows = state.rows.map(r => ({
        ...snapRow(r),
        _matched: false
    }));

    const pairs = [];
    const unresolved = [];

    // الروابط اليدوية المحفوظة لها الأولوية لأنها قرار مستخدم صريح.
    matchManualAliases(oldRows, currentRows, pairs);

    // مفاتيح قطعية/قوية فريدة أولًا.
    matchUnique(
        oldRows,
        currentRows,
        r => compareNorm('civilId', r.civilId),
        'السجل المدني الفريد',
        pairs
    );

    matchUnique(
        oldRows,
        currentRows,
        r => compareNorm('studentAccount', r.studentAccount),
        'حساب الطالب الفريد',
        pairs
    );

    // الاسم وحده لا يكفي للحكم إذا تغيرت بقية البيانات؛
    // نستخدمه فقط إذا دعمه حقل ثانٍ ثابت.
    const oldNameMap = uniqueMap(oldRows, r => norm(r.name));
    const newNameMap = uniqueMap(currentRows, r => norm(r.name));

    for (const [nameKey, currentList] of newNameMap) {

        const oldList = oldNameMap.get(nameKey) || [];

        if (currentList.length !== 1 || oldList.length !== 1) continue;

        const oldRow = oldList[0];
        const currentRow = currentList[0];

        if (oldRow._matched || currentRow._matched) continue;

        const secondary = [
            ['studentPhone', phone966(oldRow.studentPhone), phone966(currentRow.studentPhone)],
            ['guardianPhone', phone966(oldRow.guardianPhone), phone966(currentRow.guardianPhone)],
            ['guardianName', norm(oldRow.guardianName), norm(currentRow.guardianName)],
            ['grade', norm(oldRow.grade), norm(currentRow.grade)]
        ].filter(([, a, b]) => a && a === b);

        if (secondary.length) {
            oldRow._matched = true;
            currentRow._matched = true;
            pairs.push({
                old: oldRow,
                current: currentRow,
                reason: `الاسم الفريد + ${secondary.map(x => x[0]).join(' + ')}`,
                confidence: 'قوي'
            });
        }
    }

    strictCandidateMatching(oldRows, currentRows, pairs, unresolved);

    const changed = [];
    let same = 0;

    // إذا كان أحد طرفي زوج موثوق مرتبطًا يدويًا، نمد الرابط إلى نسخته الجديدة.
    for (const pair of pairs) {
        propagateKnownIdentity(pair.old, pair.current);
    }

    for (const pair of pairs) {

        const changes = rowChanges(pair.old, pair.current);

        if (changes.length) {
            changed.push({
                name: pair.current.name || pair.old.name,
                civilId: pair.current.civilId || pair.old.civilId,
                studentAccount: pair.current.studentAccount || pair.old.studentAccount,
                old: pair.old,
                current: pair.current,
                reason: pair.reason,
                confidence: pair.confidence,
                changes
            });
        } else {
            same++;
        }
    }

    const unresolvedCurrent = new Set(
        unresolved.map(x => x.current)
    );

    const unresolvedOld = new Set(
        unresolved.flatMap(x =>
            (x.candidates || []).map(c => c.old)
        )
    );

    // الحالات الملتبسة لا تُسمى جديدة أو محذوفة؛ تبقى في "غير محسوم".
    const strictAdded = currentRows
        .filter(x => !x._matched && !unresolvedCurrent.has(x))
        .map(({ _matched, ...r }) => r);

    const removed = oldRows
        .filter(x => !x._matched && !unresolvedOld.has(x))
        .map(({ _matched, ...r }) => r);

    const changedFields = changed.reduce(
        (sum, item) => sum + item.changes.length,
        0
    );

    const byField = new Map();

    for (const item of changed) {
        for (const ch of item.changes) {
            byField.set(ch.label, (byField.get(ch.label) || 0) + 1);
        }
    }

    state.comparison = {
        snapshot,
        added: strictAdded,
        removed,
        changed,
        unresolved,
        same,
        changedFields,
        byField: [...byField],
        legacy: !!importMeta.legacy,
        strongConflicts: importMeta.strongConflicts || [],
        importMeta: {
            legacy: !!importMeta.legacy,
            strongConflicts: importMeta.strongConflicts || []
        }
    };

    renderCompare();
    diffButtons();
}

function basicDiffTable(rows) {

    if (!rows.length) {
        return '<div class="note">لا توجد حالات.</div>';
    }

    const cols = PLATFORM === 'madrasati'
        ? [
            ['name', 'اسم الطالب'],
            ['className', 'الفصل'],
            ['studentAccount', 'حساب الطالب'],
            ['studentPhone', 'جوال الطالب'],
            ['guardianName', 'ولي الأمر'],
            ['guardianPhone', 'جوال ولي الأمر']
        ]
        : [
            ['name', 'اسم الطالب'],
            ['civilId', 'السجل المدني'],
            ['grade', 'الصف'],
            ['className', 'الفصل']
        ];

    return `
        <div class="table">
            <table>
                <thead>
                    <tr>${cols.map(x => `<th>${esc(x[1])}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${rows.map(r =>
                        '<tr>'
                        + cols.map(x => `<td>${esc(clean(r[x[0]]) || '—')}</td>`).join('')
                        + '</tr>'
                    ).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function changedDiffTable(rows) {

    if (!rows.length) {
        return '<div class="note">لا توجد تعديلات.</div>';
    }

    const flat = rows.flatMap(item =>
        item.changes.map(ch => ({
            name: item.name,
            identity: PLATFORM === 'madrasati'
                ? item.studentAccount
                : item.civilId,
            field: ch.label,
            oldValue: ch.oldValue,
            newValue: ch.newValue,
            confidence: item.confidence,
            reason: item.reason
        }))
    );

    return `
        <div class="table">
            <table>
                <thead>
                    <tr>
                        <th>اسم الطالب</th>
                        <th>${PLATFORM === 'madrasati' ? 'الحساب الحالي' : 'السجل المدني'}</th>
                        <th>الحقل المتغير</th>
                        <th>السابق</th>
                        <th>الحالي</th>
                        <th>ثقة المطابقة</th>
                    </tr>
                </thead>
                <tbody>
                    ${flat.map(r => `
                        <tr>
                            <td>${esc(r.name || '—')}</td>
                            <td>${esc(r.identity || '—')}</td>
                            <td><b>${esc(r.field)}</b></td>
                            <td>${esc(r.oldValue || '—')}</td>
                            <td>${esc(r.newValue || '—')}</td>
                            <td title="${esc(r.reason || '')}">${esc(r.confidence || '—')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function recordReviewHtml(row) {
    if (!row) return '—';
    const fields = PLATFORM === 'madrasati'
        ? [
            ['name', 'الاسم'],
            ['className', 'الفصل'],
            ['studentAccount', 'الحساب'],
            ['studentPhone', 'جوال الطالب'],
            ['guardianName', 'ولي الأمر'],
            ['guardianPhone', 'جوال ولي الأمر']
        ]
        : [
            ['name', 'الاسم'],
            ['civilId', 'السجل'],
            ['grade', 'الصف'],
            ['className', 'الفصل']
        ];

    return fields
        .filter(([key]) => clean(row[key]))
        .map(([key, label]) => `<b>${esc(label)}:</b> ${esc(clean(row[key]))}`)
        .join('<br>') || '—';
}

function unresolvedTable(items) {

    if (!items.length) return '';

    return `
        <div class="diff full">
            <div class="dh red">🧩 مركز المراجعة اليدوية — ${items.length} حالة</div>
            <div class="note warn">
                لم يخمّن راصد هوية هذه الحالات. اختر السجل السابق الصحيح واضغط
                <b>نفس الطالب — حفظ الربط</b>.
                سيحفظ الربط محليًا ويستخدمه تلقائيًا في المقارنات القادمة.
            </div>

            ${items.map((item, itemIndex) => `
                <div class="reviewcase" data-review-index="${itemIndex}">
                    <div class="reviewgrid">
                        <div>
                            <b>السجل الحالي</b>
                            <div class="recordbox">${recordReviewHtml(item.current)}</div>
                        </div>
                        <div>
                            <b>السجل السابق المرشح</b>
                            <div class="recordbox reviewcandidatepreview">
                                ${recordReviewHtml(item.candidates?.[0]?.old)}
                            </div>
                        </div>
                    </div>

                    <div class="bar">
                        <select class="reviewcandidate" data-review-index="${itemIndex}" style="min-width:380px">
                            ${(item.candidates || []).map((candidate, candidateIndex) => `
                                <option value="${candidateIndex}">
                                    ${esc(candidate.old?.name || '—')} — درجة ${candidate.score} — ${esc((candidate.evidence || []).join(' + ') || 'بدون أدلة')}
                                </option>
                            `).join('')}
                        </select>

                        <button class="b p reviewlink" data-review-index="${itemIndex}">
                            🔗 نفس الطالب — حفظ الربط
                        </button>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function manualFreeLinkPanel(added, removed) {

    if (!added.length || !removed.length) return '';

    return `
        <div class="diff full">
            <div class="dh orange">🛠 ربط يدوي متقدم</div>
            <div class="note warn">
                استخدم هذا فقط عندما تعرف يقينًا أن سجلًا من «الجدد» وسجلًا من «غير الموجودين»
                يخصان الطالب نفسه رغم تغير جميع دلائل المطابقة تقريبًا.
            </div>
            <div class="bar">
                <select class="freecurrent" style="min-width:320px">
                    ${added.map((row, index) => `
                        <option value="${index}">${esc(timelineStudentLabel(row))}</option>
                    `).join('')}
                </select>

                <span style="align-self:center;font-weight:800">هو نفسه</span>

                <select class="freeold" style="min-width:320px">
                    ${removed.map((row, index) => `
                        <option value="${index}">${esc(timelineStudentLabel(row))}</option>
                    `).join('')}
                </select>

                <button class="b p freelink">
                    🔗 حفظ الربط وإعادة المقارنة
                </button>
            </div>
        </div>
    `;
}

function bindManualReview() {

    ui.cmpout
        .querySelectorAll('.reviewcandidate')
        .forEach(select => {
            select.onchange = () => {
                const itemIndex = Number(select.dataset.reviewIndex);
                const candidateIndex = Number(select.value);
                const item = state.comparison?.unresolved?.[itemIndex];
                const candidate = item?.candidates?.[candidateIndex];
                const box = select.closest('.reviewcase')?.querySelector('.reviewcandidatepreview');
                if (box) box.innerHTML = recordReviewHtml(candidate?.old);
            };
        });

    ui.cmpout
        .querySelectorAll('.reviewlink')
        .forEach(button => {
            button.onclick = () => {
                const itemIndex = Number(button.dataset.reviewIndex);
                const caseBox = button.closest('.reviewcase');
                const select = caseBox?.querySelector('.reviewcandidate');
                const candidateIndex = Number(select?.value || 0);
                const item = state.comparison?.unresolved?.[itemIndex];
                const candidate = item?.candidates?.[candidateIndex];

                if (!item?.current || !candidate?.old) {
                    toast('تعذر تحديد السجلين المطلوب ربطهما.', 'err');
                    return;
                }

                if (!confirm(`تأكيد الربط اليدوي:\n\nالحالي: ${item.current.name || '—'}\nالسابق: ${candidate.old.name || '—'}\n\nسيتم حفظ هذا القرار محليًا واستخدامه مستقبلًا.`)) {
                    return;
                }

                const entityId = saveManualIdentityLink(candidate.old, item.current);

                if (!entityId) return;

                const snapshot = state.comparison.snapshot;
                const meta = state.comparison.importMeta || {};

                compareSnapshot(snapshot, meta);
                archiveCurrentExtraction();
                renderTimelineSelector();
                renderTimeline();
                toast('تم حفظ الربط وإعادة المقارنة.');
            };
        });

    const freeButton = ui.cmpout.querySelector('.freelink');

    if (freeButton) {
        freeButton.onclick = () => {
            const currentIndex = Number(ui.cmpout.querySelector('.freecurrent')?.value || 0);
            const oldIndex = Number(ui.cmpout.querySelector('.freeold')?.value || 0);
            const currentRow = state.comparison?.added?.[currentIndex];
            const oldRow = state.comparison?.removed?.[oldIndex];

            if (!currentRow || !oldRow) {
                toast('تعذر تحديد السجلين للربط المتقدم.', 'err');
                return;
            }

            if (!confirm(`ربط يدوي متقدم:\n\nالحالي: ${currentRow.name || '—'}\nالسابق: ${oldRow.name || '—'}\n\nاستخدم هذا فقط إذا كنت متأكدًا أنهما نفس الطالب.`)) {
                return;
            }

            const entityId = saveManualIdentityLink(oldRow, currentRow);
            if (!entityId) return;

            const snapshot = state.comparison.snapshot;
            const meta = state.comparison.importMeta || {};
            compareSnapshot(snapshot, meta);
            renderTimelineSelector();
            renderTimeline();
            toast('تم حفظ الربط المتقدم وإعادة المقارنة.');
        };
    }
}

function renderCompare() {

    if (!state.comparison) return;

    const c = state.comparison;

    const warnings = [];

    if (c.legacy) {
        warnings.push('النسخة السابقة قديمة ولا تحتوي على بصمة SHA-256؛ تم استيرادها بوضع التوافق المحافظ.');
    }

    if (c.strongConflicts.length) {
        warnings.push(`النسخة السابقة تحتوي على ${c.strongConflicts.length} تعارض في مفاتيح قوية مثل الحساب/السجل؛ لم تُستخدم الحالات الملتبسة كمطابقة قطعية.`);
    }

    if (c.unresolved.length) {
        warnings.push(`هناك ${c.unresolved.length} حالة غير محسومة. لا تعتبر نتيجة المقارنة نهائية قبل مراجعتها.`);
    }

    ui.cmpout.innerHTML = `
        ${warnings.length ? `<div class="note warn">${warnings.map(esc).join('<br>')}</div>` : '<div class="note"><b>✅ سلامة المقارنة:</b> لا توجد حالات مطابقة ملتبسة.</div>'}

        <div class="sum">
            <div class="card">النسخة السابقة<b>${esc(c.snapshot.exportedDate || '—')}</b></div>
            <div class="card">جدد مؤكدون<b class="green">${c.added.length}</b></div>
            <div class="card">غير موجودين<b class="red">${c.removed.length}</b></div>
            <div class="card">تغيّرت بياناتهم<b class="orange">${c.changed.length}</b></div>
            <div class="card">بدون تغيير<b>${c.same}</b></div>
        </div>

        <div class="note">
            الحقول المتغيرة: <b>${c.changedFields}</b>
            — الحالات غير المحسومة: <b>${c.unresolved.length}</b>
        </div>

        ${c.byField.length ? `
            <div class="stats">
                ${c.byField.map(([label, count]) => `<span class="chip">${esc(label)} <b>${count}</b></span>`).join('')}
            </div>
        ` : ''}

        <div class="diffgrid">
            <div class="diff">
                <div class="dh green">🟢 طلاب جدد مؤكدون — ${c.added.length}</div>
                ${basicDiffTable(c.added)}
            </div>

            <div class="diff">
                <div class="dh red">🔴 غير موجودين حاليًا — ${c.removed.length}</div>
                ${basicDiffTable(c.removed)}
            </div>

            <div class="diff full">
                <div class="dh orange">🟠 تغييرات البيانات — ${c.changed.length} طالب / ${c.changedFields} تعديل</div>
                ${changedDiffTable(c.changed)}
            </div>

            ${unresolvedTable(c.unresolved)}
            ${manualFreeLinkPanel(c.added, c.removed)}
        </div>
    `;

    bindManualReview();
}

function clearCompare() {
    state.comparison = null;
    ui.cmpout.innerHTML = '';
    diffButtons();
}

async function importSnapshot(file) {

    if (!file) return;

    try {
        const snapshot = JSON.parse(
            (await file.text()).replace(/^\uFEFF/, '')
        );

        const meta = await validateImportedSnapshot(snapshot);

        state.lastImportMeta = meta;
        archiveImportedSnapshot(meta.snapshot, meta.legacy);
        renderTimelineSelector();
        renderTimeline();

        compareSnapshot(meta.snapshot, meta);
        tab('review');

        toast(
            meta.legacy
                ? 'تمت المقارنة بوضع التوافق المحافظ لنسخة قديمة.'
                : 'تم التحقق من بصمة النسخة وإجراء المقارنة.'
        );
    }
    catch (e) {
        toast(e.message || 'تعذر قراءة الملف.', 'err');
    }
    finally {
        ui.snapfile.value = '';
    }
}

function xlsTable(title, headers, rows) {

    return `
        <h3>${esc(title)}</h3>
        <table>
            <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
            <tbody>
                ${rows.length
                    ? rows.map(r => `<tr>${r.map(v => `<td style="mso-number-format:\\@;">${esc(v)}</td>`).join('')}</tr>`).join('')
                    : `<tr><td colspan="${headers.length}">لا توجد حالات</td></tr>`
                }
            </tbody>
        </table>
    `;
}

function exportDiff() {

    if (!state.comparison) return;

    const c = state.comparison;

    const basicHeaders = PLATFORM === 'madrasati'
        ? ['اسم الطالب', 'الفصل', 'حساب الطالب', 'جوال الطالب', 'ولي الأمر', 'جوال ولي الأمر']
        : ['اسم الطالب', 'رقم السجل المدني', 'الصف', 'الفصل'];

    const basicRows = rows => PLATFORM === 'madrasati'
        ? rows.map(x => [x.name, x.className, x.studentAccount, x.studentPhone, x.guardianName, x.guardianPhone])
        : rows.map(x => [x.name, x.civilId, x.grade, x.className]);

    const changedRows = c.changed.flatMap(item =>
        item.changes.map(ch => [
            item.name,
            PLATFORM === 'madrasati' ? item.studentAccount : item.civilId,
            ch.label,
            ch.oldValue,
            ch.newValue,
            item.confidence,
            item.reason
        ])
    );

    const unresolvedRows = c.unresolved.map(item => {
        const best = item.candidates?.[0];
        return [
            item.current?.name || '',
            best?.old?.name || '',
            best?.score ?? '',
            (best?.evidence || []).join(' + ')
        ];
    });

    const html = `
        <!doctype html>
        <html dir="rtl">
        <meta charset="utf-8">
        <style>
            body{font-family:Tahoma}
            table{border-collapse:collapse;margin-bottom:20px}
            th,td{border:1px solid #999;padding:7px;text-align:center}
            th{background:#dff4f1}
        </style>
        <h2>فروقات الطلاب — ${PLATFORM_LABEL}</h2>
        <p>النطاق: ${esc(scopeText())} — النسخة السابقة: ${esc(c.snapshot.exportedDate || '')} — الحالية: ${stamp()}</p>
        ${xlsTable(`طلاب جدد مؤكدون (${c.added.length})`, basicHeaders, basicRows(c.added))}
        ${xlsTable(`غير موجودين حاليًا (${c.removed.length})`, basicHeaders, basicRows(c.removed))}
        ${xlsTable(`تغييرات البيانات (${c.changed.length} طالب / ${c.changedFields} تعديل)`, ['اسم الطالب', PLATFORM === 'madrasati' ? 'الحساب الحالي' : 'السجل المدني', 'الحقل', 'السابق', 'الحالي', 'الثقة', 'سبب المطابقة'], changedRows)}
        ${xlsTable(`حالات غير محسومة (${c.unresolved.length})`, ['السجل الحالي', 'أفضل مرشح سابق', 'الدرجة', 'الأدلة'], unresolvedRows)}
        </html>
    `;

    blobDownload(
        new Blob(['\uFEFF', html], {
            type: 'application/vnd.ms-excel;charset=utf-8'
        }),
        fileName('الفروقات-الشاملة', 'xls')
    );

    toast('تم تصدير الفروقات الشاملة.');
}

// =========================================================
// استخراج مدرستي
// =========================================================

const AL = {

    name: [
        'اسم الطالب',
        'إسم الطالب'
    ],

    className: [
        'الفصل'
    ],

    /*
     * نعتمد حساب الطالب نفسه.
     */
    account: [
        'حساب الطالب'
    ],

    mobile: [
        'الجوال',
        'جوال الطالب'
    ],

    guardian: [
        'ولي الأمر',
        'ولي الامر'
    ],

    guardianMobile: [
        'جوال ولي الأمر',
        'جوال ولي الامر'
    ]
};

function hi(
    headers,
    aliases
) {

    const h =
        headers.map(
            norm
        );

    const a =
        aliases.map(
            norm
        );

    return (
        h.findIndex(
            x =>
                a.includes(
                    x
                )
        )
    );
}

function madTable(
    doc
) {

    return (
        [
            ...doc.querySelectorAll(
                'table'
            )
        ]
            .find(
                t => {

                    const h =
                        [
                            ...t.querySelectorAll(
                                'thead th'
                            )
                        ]
                            .map(
                                x =>
                                    clean(
                                        x.textContent
                                    )
                            );

                    return (
                        hi(
                            h,
                            AL.name
                        ) >=
                        0
                        &&
                        hi(
                            h,
                            AL.className
                        ) >=
                        0
                        &&
                        hi(
                            h,
                            AL.account
                        ) >=
                        0
                    );
                }
            )
        ||
        null
    );
}

function madRows(
    doc
) {

    const t =
        madTable(
            doc
        );

    if (
        !t
    ) {
        return [];
    }

    const h =
        [
            ...t.querySelectorAll(
                'thead th'
            )
        ]
            .map(
                x =>
                    clean(
                        x.textContent
                    )
            );

    const i = {

        name:
            hi(
                h,
                AL.name
            ),

        className:
            hi(
                h,
                AL.className
            ),

        account:
            hi(
                h,
                AL.account
            ),

        mobile:
            hi(
                h,
                AL.mobile
            ),

        guardian:
            hi(
                h,
                AL.guardian
            ),

        guardianMobile:
            hi(
                h,
                AL.guardianMobile
            )
    };

    const missingColumns = [
        ['اسم الطالب', i.name],
        ['الفصل', i.className],
        ['حساب الطالب', i.account],
        ['الجوال', i.mobile],
        ['ولي الأمر', i.guardian],
        ['جوال ولي الأمر', i.guardianMobile]
    ].filter(([, index]) => index < 0);

    if (missingColumns.length) {
        throw Error(
            `تغيرت بنية جدول مدرستي أو اختفت أعمدة مطلوبة: ${missingColumns.map(x => x[0]).join('، ')}. تم إيقاف الاستخراج بدل إنتاج بيانات ناقصة.`
        );
    }

    const get =
        (
            c,
            n
        ) =>
            n >=
            0
                ?
                clean(
                    c[n]
                        ?.textContent
                )
                :
                '';

    return (
        [
            ...t.querySelectorAll(
                'tbody tr'
            )
        ]
            .map(
                tr => {

                    const c =
                        [
                            ...tr.querySelectorAll(
                                'td'
                            )
                        ];

                    return {
                        name:
                            get(
                                c,
                                i.name
                            ),

                        className:
                            get(
                                c,
                                i.className
                            ),

                        account:
                            get(
                                c,
                                i.account
                            ),

                        mobile:
                            get(
                                c,
                                i.mobile
                            ),

                        guardian:
                            get(
                                c,
                                i.guardian
                            ),

                        guardianMobile:
                            get(
                                c,
                                i.guardianMobile
                            )
                    };
                }
            )
            .filter(
                x =>
                    x.name
            )
    );
}

function madPages(
    doc
) {

    const s =
        new Set([
            1
        ]);

    for (
        const a
        of doc.querySelectorAll(
            'a[href]'
        )
    ) {

        try {

            const u =
                new URL(
                    a.getAttribute(
                        'href'
                    ),
                    location.origin
                );

            const p =
                Number(
                    u.searchParams.get(
                        'page'
                    )
                );

            if (
                u.pathname ===
                location.pathname
                &&
                Number.isInteger(
                    p
                )
                &&
                p >
                0
                &&
                p <=
                500
            ) {

                s.add(
                    p
                );
            }
        }
        catch {}
    }

    return (
        [
            ...s
        ]
            .sort(
                (
                    a,
                    b
                ) =>
                    a -
                    b
            )
    );
}

async function madFetch(
    page
) {

    const u =
        new URL(
            location.href
        );

    u.searchParams.set(
        'page',
        page
    );

    let last;

    for (
        let n = 0;
        n <
        3;
        n++
    ) {

        const c =
            new AbortController();

        const tm =
            setTimeout(
                () =>
                    c.abort(),
                20000
            );

        try {

            const r =
                await fetch(
                    u.href,
                    {
                        credentials:
                            'include',

                        cache:
                            'no-store',

                        signal:
                            c.signal
                    }
                );

            if (
                !r.ok
            ) {

                throw Error(
                    `HTTP ${r.status}`
                );
            }

            const d =
                new DOMParser()
                    .parseFromString(
                        await r.text(),
                        'text/html'
                    );

            if (
                !madTable(
                    d
                )
            ) {

                throw Error(
                    'لم يظهر جدول الطلاب.'
                );
            }

            return d;
        }
        catch (
            e
        ) {

            last =
                e;

            if (
                n <
                2
            ) {

                await wait(
                    900 *
                    (
                        n +
                        1
                    )
                );
            }
        }
        finally {

            clearTimeout(
                tm
            );
        }
    }

    throw last;
}

function madMerge(raw) {

    // لا ندمج بالحساب وحده؛ هذا قد يخفي طالبًا إذا تكرر الحساب خطأً.
    // نحذف فقط السجل المطابق بالكامل الناتج من تكرار الصفحة/الصف.
    const map = new Map();
    let exactDuplicates = 0;

    for (const x of raw) {

        const key = stableStringify({
            name: clean(x.name),
            className: clean(x.className),
            account: clean(x.account),
            mobile: clean(x.mobile),
            guardian: clean(x.guardian),
            guardianMobile: clean(x.guardianMobile)
        });

        if (map.has(key)) {
            exactDuplicates++;
            continue;
        }

        map.set(key, { ...x });
    }

    const rows = [...map.values()].map((x, i) =>
        Object.assign(record(), {
            serial: String(i + 1),
            name: x.name,
            className: x.className,
            studentAccount: studentAccount(x.account),
            studentPhone: phone05(x.mobile),
            guardianName: x.guardian,
            guardianPhone: phone05(x.guardianMobile),
            source: 'مدرستي',
            _rawStudentPhone: x.mobile,
            _rawGuardianPhone: x.guardianMobile
        })
    );

    const accountMap = new Map();

    for (const row of rows) {
        const account = clean(row.studentAccount).toLowerCase();
        if (!account) continue;
        if (!accountMap.has(account)) accountMap.set(account, []);
        accountMap.get(account).push(row);
    }

    const duplicateAccounts = [...accountMap.entries()]
        .filter(([, list]) => list.length > 1)
        .map(([account, list]) => ({
            account,
            count: list.length,
            names: list.map(x => x.name)
        }));

    return {
        rows,
        exactDuplicates,
        duplicateAccounts
    };
}

function madScope(rows) {

    const classes = [...new Set(
        rows.map(r => clean(r.className)).filter(Boolean)
    )];

    if (classes.length > 1) {
        return {
            ...emptyScope(),
            platform: 'madrasati',
            mode: 'all-classes',
            label: 'الكل',
            className: 'الكل',
            verified: true
        };
    }

    return {
        ...emptyScope(),
        platform: 'madrasati',
        mode: classes[0] ? 'single-class' : 'unknown',
        label: classes[0] ? `فصل_${classes[0]}` : 'غير محدد',
        className: classes[0] || '',
        verified: true
    };
}

function pageFingerprint(rows) {

    return stableStringify(
        rows.map(x => ({
            name: clean(x.name),
            className: clean(x.className),
            account: clean(x.account),
            mobile: clean(x.mobile),
            guardian: clean(x.guardian),
            guardianMobile: clean(x.guardianMobile)
        }))
    );
}

async function extractMad() {

    if (state.running) return;

    state.cancel = false;
    running(true);
    enable(false);
    status('جارٍ استخراج بيانات مدرستي والتحقق من الصفحات...');

    const queue = [1];
    const seen = new Set([1]);
    const done = new Set();
    const raw = [];
    const pageFingerprints = new Map();
    const pageCounts = {};
    const warnings = [];

    try {

        while (queue.length) {

            if (state.cancel) {
                throw Error('تم إلغاء العملية.');
            }

            const page = queue.shift();

            if (done.has(page)) continue;

            status(`قراءة الصفحة ${page} — تم ${done.size} من ${seen.size}`);

            const doc = await madFetch(page);
            const pageRows = madRows(doc);

            if (!pageRows.length) {
                throw Error(`الصفحة ${page} لم تحتوِ على صفوف طلاب. أوقف السكربت العملية بدل اعتماد استخراج ناقص.`);
            }

            const fingerprint = pageFingerprint(pageRows);

            if (pageFingerprints.has(fingerprint)) {
                throw Error(`الصفحة ${page} أعادت نفس بيانات الصفحة ${pageFingerprints.get(fingerprint)}. تم إيقاف الاستخراج لمنع تكرار/نقص البيانات.`);
            }

            pageFingerprints.set(fingerprint, page);
            pageCounts[page] = pageRows.length;
            raw.push(...pageRows);

            const discovered = madPages(doc);
            const maxPage = Math.max(1, ...discovered);

            // إذا ظهر رقم صفحة أكبر نضيف جميع الأرقام الوسيطة؛
            // لا نعتمد على أن شريط الترقيم يعرض كل الصفحات دفعة واحدة.
            for (let p = 1; p <= maxPage; p++) {
                if (!seen.has(p)) {
                    seen.add(p);
                    queue.push(p);
                }
            }

            for (const p of discovered) {
                if (!seen.has(p)) {
                    seen.add(p);
                    queue.push(p);
                }
            }

            queue.sort((a, b) => a - b);
            done.add(page);
        }

        if (!raw.length) {
            throw Error('لم يتم العثور على بيانات طلاب.');
        }

        const missingPages = [...seen].filter(p => !done.has(p));

        if (missingPages.length) {
            throw Error(`لم تتم قراءة الصفحات: ${missingPages.join('، ')}.`);
        }

        const merged = madMerge(raw);

        if (merged.duplicateAccounts.length) {
            warnings.push(`يوجد ${merged.duplicateAccounts.length} حساب طالب مكرر بين أكثر من سجل؛ احتفظ السكربت بجميع السجلات ولم يدمجها.`);
        }

        const audit = {
            complete: true,
            pageCount: done.size,
            pages: [...done].sort((a, b) => a - b),
            pageCounts,
            rawRows: raw.length,
            finalRows: merged.rows.length,
            exactDuplicates: merged.exactDuplicates,
            duplicateAccounts: merged.duplicateAccounts,
            warnings
        };

        afterExtract(
            merged.rows,
            done.size,
            madScope(merged.rows),
            audit
        );

        status(`اكتمل استخراج ${state.rows.length} طالب من ${done.size} صفحة مع تدقيق الاستخراج.`);
        toast('اكتمل الاستخراج والتحقق من الصفحات.');
    }
    catch (e) {
        status(e.message || 'حدث خطأ.');
        toast(e.message || 'فشل الاستخراج.', 'err');
    }
    finally {
        running(false);
    }
}

// =========================================================
// استخراج نور — التقرير الحالي + المدرسة كاملة
// =========================================================

let nrEndRequestAt = 0;

function nrReportSignature() {
    try {
        const rows = nrRows();
        return rows.length
            ? stableStringify(rows.map(x => [x.serial, x.name, x.civilId]))
            : '';
    }
    catch {
        return '';
    }
}

function nrReportSettled(actionAt, previousSignature) {
    // إذا حدث تحميل صفحة كاملة بعد الإجراء فهذا مستند جديد وآمن للقراءة.
    if (Number(performance.timeOrigin || 0) > Number(actionAt || 0)) {
        return true;
    }

    // أو انتهى UpdatePanel بعد الإجراء.
    if (nrEndRequestAt > Number(actionAt || 0)) {
        return true;
    }

    // أو تغير محتوى التقرير نفسه.
    const currentSignature = nrReportSignature();
    return !!(
        currentSignature
        && previousSignature
        && currentSignature !== previousSignature
    );
}


function loadNoorJob() {
    try {
        const x = sessionStorage.getItem(NOOR_JOB);
        return x ? JSON.parse(x) : null;
    }
    catch {
        return null;
    }
}

function saveNoorJob(x) {
    sessionStorage.setItem(NOOR_JOB, JSON.stringify(x));
}

function clearNoorJob() {
    sessionStorage.removeItem(NOOR_JOB);
}

function saveNoorResult(rows, pages, scope, audit) {
    const payload = JSON.stringify({
        version: 2,
        at: new Date().toISOString(),
        sourceView: NOOR_VIEW,
        rows,
        pages,
        scope,
        audit
    });

    let saved = false;

    // نحفظ نسختين: واحدة خاصة بالتبويب ونسخة احتياطية محلية.
    // بعض PostBacks في V2 تعيد بناء الصفحة بالكامل، لذلك لا نعتمد
    // على sessionStorage وحده لإظهار النتيجة النهائية.
    for (const storage of [sessionStorage, localStorage]) {
        try {
            storage.setItem(NOOR_RESULT, payload);
            saved = true;
        }
        catch {}
    }

    if (!saved) {
        console.warn('[راصد/نور] تعذر حفظ النتيجة الاحتياطية.');
    }

    return saved;
}

function loadNoorResult() {
    for (const storage of [sessionStorage, localStorage]) {
        try {
            const raw = storage.getItem(NOOR_RESULT);
            if (!raw) continue;

            const data = JSON.parse(raw);
            if (
                data
                && Number(data.version || 0) >= 1
                && Array.isArray(data.rows)
            ) {
                return data;
            }
        }
        catch {}
    }

    return null;
}

function clearNoorResult() {
    for (const storage of [sessionStorage, localStorage]) {
        try {
            storage.removeItem(NOOR_RESULT);
        }
        catch {}
    }
}

function nrSelect(suffix) {
    return document.querySelector(`select[id$="${suffix}"]`);
}

function nrGradeEl() {
    return nrSelect('_ddlClass');
}

function nrSectionEl() {
    return nrSelect('_ddlSection');
}

function nrStudySystemEl() {
    return document.getElementById('ctl00_PlaceHolderMain_ddlStudySystem')
        || nrSelect('_ddlStudySystem');
}

function nrViewEl() {
    return document.getElementById('ctl00_PlaceHolderMain_ibtnView')
        || document.querySelector('input[id$="_ibtnView"]');
}

function nrControlsReady() {
    return !!(nrGradeEl() && nrSectionEl() && nrViewEl());
}

function nrOptionObjects(select) {

    if (!select) return [];

    return [...select.options]
        .map(o => ({
            value: String(o.value ?? ''),
            text: clean(o.textContent)
        }))
        .filter(o =>
            o.value
            && o.value !== '-99'
            && o.text
            && !/^--\s*اختر\s*--$/.test(o.text)
            && !/^--\s*الكل\s*--$/.test(o.text)
            && norm(o.text) !== norm('الكل')
        );
}

function nrGradeOptions() {
    return nrOptionObjects(nrGradeEl());
}

function nrSectionOptions() {
    return nrOptionObjects(nrSectionEl());
}

function nrAllSectionOption() {

    const select = nrSectionEl();

    if (!select) return null;

    // V2 تستخدم value=-99 أيضًا للحالة «-- لا يوجد --»؛
    // لذلك لا نعد الخيار «الكل» إلا إذا أكد نصه ذلك.
    const option = [...select.options].find(o =>
        /^--\s*الكل\s*--$/.test(clean(o.textContent))
        || norm(o.textContent) === norm('الكل')
    );

    return option
        ? {
            value: String(option.value),
            text: 'الكل'
        }
        : null;
}

function nrUpdateSelect2(select) {
    try {
        if (window.jQuery) {
            window.jQuery(select).trigger('change.select2');
        }
    }
    catch {}
}

function nrSetSelectValue(select, value) {

    if (!select) return false;

    const wanted = String(value);
    const exists = [...select.options].some(o => String(o.value) === wanted);

    if (!exists) return false;

    select.value = wanted;
    nrUpdateSelect2(select);

    return String(select.value) === wanted;
}

function nrPostBackSelect(select, value) {

    if (!nrSetSelectValue(select, value)) return false;

    try {
        if (typeof window.__doPostBack === 'function' && select.name) {
            window.__doPostBack(select.name, '');
            return true;
        }
    }
    catch {}

    try {
        select.dispatchEvent(new Event('change', {
            bubbles: true,
            cancelable: true
        }));
        return true;
    }
    catch {
        return false;
    }
}

function nrClickView() {

    const button = nrViewEl();

    if (!button) return false;

    try {
        button.click();
        return true;
    }
    catch {
        try {
            button.dispatchEvent(new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            }));
            return true;
        }
        catch {
            return false;
        }
    }
}

function nrAjaxBusy() {
    try {
        return !!window.Sys
            ?.WebForms
            ?.PageRequestManager
            ?.getInstance()
            ?.get_isInAsyncPostBack();
    }
    catch {
        return false;
    }
}

function nrRoot() {
    return document.querySelector('[id^="VisibleReportContent"]')
        || document.querySelector('[role="main"][id*="rvStudentDataName"]')
        || document.getElementById('ctl00_PlaceHolderMain_rvStudentDataName_fixedTable')
        || document.querySelector('[id*="rvStudentDataName_fixedTable"]');
}

function nrCurEl() {
    return document.getElementById('ctl00_PlaceHolderMain_rvStudentDataName_ctl09_ctl00_CurrentPage')
        || document.querySelector('input[id*="rvStudentDataName"][id$="_CurrentPage"]');
}

function nrTotEl() {
    return document.getElementById('ctl00_PlaceHolderMain_rvStudentDataName_ctl09_ctl00_TotalPages')
        || document.querySelector('[id*="rvStudentDataName"][id$="_TotalPages"]');
}

function nrCurRaw() {
    const n = Number(clean(nrCurEl()?.value || nrCurEl()?.textContent));
    return n > 0 ? n : 0;
}

function nrTotRaw() {
    const n = Number(clean(nrTotEl()?.textContent || nrTotEl()?.value));
    return n > 0 ? n : 0;
}

function nrReady() {
    // في نور V2 يظهر هيكل ReportViewer مباشرة بعد Full PostBack،
    // لكن CurrentPage يكون فارغًا وTotalPages=0 حتى يكتمل التحميل الداخلي.
    // لا نعتبر التقرير جاهزًا قبل ظهور أرقام صفحات حقيقية.
    return !!(
        nrRoot()
        && nrCurEl()
        && nrTotEl()
        && nrCurRaw() > 0
        && nrTotRaw() > 0
    );
}

function nrCur() {
    return nrCurRaw();
}

function nrTot() {
    return nrTotRaw();
}

function nrSelectPostBackSettled(actionAt, select, expectedValue) {
    if (!select) return false;
    if (String(select.value) !== String(expectedValue)) return false;
    if (nrAjaxBusy()) return false;

    // المسار الطبيعي: نهاية UpdatePanel بعد PostBack القائمة.
    if (nrEndRequestAt > Number(actionAt || 0)) return true;

    // احتياط إذا لم يكن PageRequestManager مكشوفًا في إحدى الواجهات.
    return Date.now() - Number(actionAt || 0) >= 900;
}

function nrWait() {

    const e = document.querySelector('[id*="rvStudentDataName"][id$="_AsyncWait"]')
        || document.querySelector('[id*="rvStudentDataName"] .WaitText');

    if (!e) return false;

    const b = e.closest('div,table,td') || e;
    const c = getComputedStyle(b);

    return !(
        c.display === 'none'
        || c.visibility === 'hidden'
        || b.offsetParent === null
    );
}

function nrBtn(kind) {

    const p = kind === 'first'
        ? '_First_ctl00'
        : '_Next_ctl00';

    const label = kind === 'first'
        ? 'الصفحة الأولى'
        : 'الصفحة التالية';

    const direct = [...document.querySelectorAll('[id*="rvStudentDataName"]')]
        .find(e =>
            e.id.includes(p)
            && e.classList.contains('NormalButton')
            && e.getAttribute('aria-disabled') !== 'true'
        )
        || [...document.querySelectorAll('[role="button"][aria-label]')]
            .find(e =>
                clean(e.getAttribute('aria-label')) === label
                && e.getAttribute('aria-disabled') !== 'true'
                && !e.disabled
            );

    if (direct) return direct;

    const wanted = kind === 'first'
        ? [norm('الصفحة الأولى'), norm('الأولى')]
        : [norm('الصفحة التالية'), norm('التالي')];

    return [...document.querySelectorAll('a,button,input,[role="button"]')]
        .filter(e =>
            e.id.includes('rvStudentDataName')
            || e.closest?.('[id*="rvStudentDataName"]')
        )
        .find(e => {
            const text = norm(
                e.textContent
                || e.value
                || e.title
                || e.getAttribute('aria-label')
            );
            return wanted.includes(text)
                && e.getAttribute('aria-disabled') !== 'true'
                && !e.disabled;
        })
        || null;
}

function nrClick(kind) {

    const b = nrBtn(kind);

    if (!b) return false;

    try {
        b.click();
        return true;
    }
    catch {
        return false;
    }
}

function nrTable() {

    const root = nrRoot();

    if (!root) return null;

    const matches = [];

    for (const t of root.querySelectorAll('table')) {

        const rows = [...t.rows];

        for (let i = 0; i < rows.length; i++) {

            const c = [...rows[i].cells];

            if (
                c.length === 3
                && norm(c[0].textContent) === norm('الاسم')
                && norm(c[1].textContent) === norm('رقم السجل المدني')
                && norm(c[2].textContent) === norm('م')
            ) {
                matches.push({
                    t,
                    i,
                    rowCount: rows.length
                });
                break;
            }
        }
    }

    matches.sort((a, b) => a.rowCount - b.rowCount);
    return matches[0] || null;
}

function nrRows() {

    const f = nrTable();

    if (!f) return [];

    return [...f.t.rows]
        .slice(f.i + 1)
        .map(r => {
            const c = [...r.cells];

            return {
                name: clean(c[0]?.textContent),
                // السجل المدني كما يظهر في نور حرفيًا.
                civilId: String(c[1]?.textContent ?? '').trim(),
                serial: clean(c[2]?.textContent)
            };
        })
        .filter(x =>
            x.name
            && x.civilId
            && /^[0-9٠-٩]+$/.test(x.serial)
        );
}

function selText(s) {
    const x = document.querySelector(`select[id$="${s}"]`);
    return clean(x?.selectedOptions?.[0]?.textContent || '');
}

function choice(v) {

    const x = clean(v);

    if (!x || /^--\s*اختر\s*--$/.test(x)) return '';

    return /^--\s*الكل\s*--$/.test(x)
        ? 'الكل'
        : x;
}

function nrMeta() {
    return {
        grade: choice(selText('_ddlClass')),
        className: choice(selText('_ddlSection')),
        studySystem: choice(selText('_ddlStudySystem'))
    };
}

function nrIdentity(row) {

    const civil = toEn(clean(row.civilId)).replace(/[\s\-–—]/g, '');

    return civil
        ? `id:${civil}`
        : `name:${norm(row.name)}`;
}

function nrExactUnique(rows) {

    const map = new Map();
    let exactDuplicates = 0;

    for (const row of rows) {

        const exactKey = stableStringify({
            serial: clean(row.serial),
            name: clean(row.name),
            civilId: clean(row.civilId)
        });

        if (map.has(exactKey)) {
            exactDuplicates++;
            continue;
        }

        map.set(exactKey, row);
    }

    return {
        rows: [...map.values()],
        exactDuplicates
    };
}

function nrNewReport() {
    return {
        phase: 'first',
        target: 1,
        total: 1,
        pages: [],
        rows: [],
        pageFingerprints: {},
        last: 0,
        retries: 0
    };
}

function nrNavReport(job, report, kind, target) {

    const now = Date.now();

    if (report.last && now - report.last < 4000) return;

    if (report.retries >= 4) {
        nrFail(job, `تعذر الانتقال إلى الصفحة ${target}.`);
        return;
    }

    if (!nrClick(kind)) {
        report.retries++;
        report.last = now;
        saveNoorJob(job);
        return;
    }

    report.last = now;
    report.retries++;
    saveNoorJob(job);
}

async function nrTickReport(job, report, label) {

    if (!nrReady() || nrWait() || nrAjaxBusy()) return false;

    const cur = nrCur();
    report.total = Math.max(report.total || 1, nrTot());

    if (report.phase === 'first') {

        if (cur === 1) {
            report.phase = 'collect';
            report.retries = 0;
            report.last = 0;
            saveNoorJob(job);
        }
        else {
            status(`${label} — العودة للصفحة الأولى...`);
            nrNavReport(job, report, 'first', 1);
            return false;
        }
    }

    if (report.phase === 'next') {

        if (cur === report.target) {
            report.phase = 'collect';
            report.retries = 0;
            report.last = 0;
            saveNoorJob(job);
            await wait(250);
        }
        else {
            status(`${label} — انتظار الصفحة ${report.target}/${report.total}...`);
            nrNavReport(job, report, 'next', report.target);
            return false;
        }
    }

    if (report.phase === 'collect') {

        if (!report.pages.includes(cur)) {

            const rows = nrRows();

            // إذا كان التقرير نفسه جاهزًا وجدوله موجودًا، فالصفحة الفارغة
            // حالة صحيحة وليست سببًا للبقاء في انتظار لا نهائي.
            if (!rows.length && !nrTable()) return false;

            const fp = stableStringify(rows.map(x => ({
                name: x.name,
                civilId: x.civilId,
                serial: x.serial
            })));

            const repeatedPage = Object.entries(report.pageFingerprints)
                .find(([, oldFp]) => oldFp === fp);

            if (repeatedPage) {
                throw Error(`صفحة نور ${cur} أعادت نفس بيانات الصفحة ${repeatedPage[0]}. تم الإيقاف لمنع استخراج غير دقيق.`);
            }

            report.pageFingerprints[cur] = fp;
            report.rows.push(...rows);
            report.pages.push(cur);
            saveNoorJob(job);

            status(`${label} — الصفحة ${cur}/${report.total} — ${report.rows.length} سجل`);
        }

        if (cur >= report.total) {
            const expected = Array.from({ length: report.total }, (_, i) => i + 1);
            const missing = expected.filter(p => !report.pages.includes(p));

            if (missing.length) {
                throw Error(`${label}: الصفحات ${missing.join('، ')} لم تتم قراءتها.`);
            }

            return true;
        }

        report.phase = 'next';
        report.target = cur + 1;
        report.retries = 0;
        report.last = 0;
        saveNoorJob(job);
        nrNavReport(job, report, 'next', report.target);
    }

    return false;
}

function nrStart() {

    if (!nrReady()) {
        open();
        status('اعرض تقرير أسماء الطلاب في نور أولًا أو استخدم «استخراج المدرسة كاملة».');
        return;
    }

    if (loadNoorJob()?.active) return;

    clearNoorResult();
    clearAll({ preserveNoorResult: true });

    const job = {
        active: true,
        mode: 'current',
        meta: nrMeta(),
        report: nrNewReport()
    };

    saveNoorJob(job);
    open();
    running(true);
    tickNoor();
}

function nrFinishCurrent(job) {

    const unique = nrExactUnique(job.report.rows);

    const rows = unique.rows.map(x =>
        Object.assign(record(), {
            serial: x.serial,
            name: x.name,
            civilId: x.civilId,
            grade: job.meta.grade || '',
            className: job.meta.className || '',
            source: 'نور'
        })
    );

    const civilMap = new Map();
    for (const row of rows) {
        const key = nrIdentity(row);
        if (!civilMap.has(key)) civilMap.set(key, []);
        civilMap.get(key).push(row);
    }

    const conflicts = [...civilMap.values()].filter(x => x.length > 1);
    const warnings = conflicts.length
        ? [`يوجد ${conflicts.length} هوية طالب مكررة داخل التقرير الحالي.`]
        : [];

    const scope = {
        ...emptyScope(),
        platform: 'noor',
        mode: 'current-report',
        grade: job.meta.grade || '',
        className: job.meta.className || '',
        studySystem: job.meta.studySystem || '',
        label: [
            job.meta.grade,
            job.meta.className
                ? (job.meta.className === 'الكل' ? 'الكل' : `فصل_${job.meta.className}`)
                : ''
        ].filter(Boolean).join('_') || 'التقرير الحالي',
        verified: false
    };

    const audit = {
        complete: !conflicts.length,
        sourceView: NOOR_VIEW,
        sourceViewLabel: NOOR_VIEW_LABEL,
        pageCount: job.report.total,
        rawRows: job.report.rows.length,
        finalRows: rows.length,
        exactDuplicates: unique.exactDuplicates,
        identityConflicts: conflicts.length,
        warnings
    };

    saveNoorResult(rows, job.report.total, scope, audit);
    clearNoorJob();
    running(false);
    afterExtract(rows, job.report.total, scope, audit);

    status(`اكتمل استخراج ${rows.length} طالب من ${job.report.total} صفحة.`);
    toast('اكتمل استخراج التقرير الحالي.');
}

async function tickNoorCurrent(job) {
    const done = await nrTickReport(job, job.report, 'التقرير الحالي');
    if (done) nrFinishCurrent(job);
}

function nrSchoolStart() {

    if (PLATFORM !== 'noor') return;
    if (loadNoorJob()?.active) return;

    if (!nrControlsReady()) {
        open();
        status('بانتظار قوائم الصف والفصل في نور...');
        return;
    }

    clearNoorResult();

    const grades = nrGradeOptions();

    if (!grades.length) {
        status('لم يجد السكربت صفوفًا دراسية متاحة في نور.');
        toast('لا توجد صفوف متاحة.', 'err');
        return;
    }

    clearAll({ preserveNoorResult: true });

    const studySystem = choice(
        clean(nrStudySystemEl()?.selectedOptions?.[0]?.textContent || '')
    );

    const job = {
        active: true,
        mode: 'school',
        phase: 'selectGrade',
        studySystem,
        grades,
        gradeIndex: 0,
        currentGrade: null,
        sections: [],
        sectionIndex: 0,
        currentSection: null,
        report: null,
        rows: [],
        summaries: [],
        totalReportPages: 0,
        actionAt: 0,
        retries: 0,
        exactDuplicates: 0,
        diagnostics: {
            duplicateAcrossSections: 0,
            missingFromSections: 0,
            extraVsAll: 0,
            gradesWithoutSections: 0
        }
    };

    saveNoorJob(job);
    open();
    running(true);
    status(`بدء استخراج المدرسة كاملة — الصفوف المكتشفة: ${grades.length}.`);
    tickNoor();
}

function nrGradeSummary(job) {

    const grade = job.currentGrade;
    if (!grade) return null;

    let summary = job.summaries.find(x => x.value === grade.value);

    if (!summary) {
        summary = {
            value: grade.value,
            grade: grade.text,
            sections: [],
            sectionCount: 0,
            extractedUnique: 0,
            allCount: 0,
            missingCount: 0,
            extraCount: 0,
            duplicateCount: 0,
            verified: false,
            noSections: false
        };
        job.summaries.push(summary);
    }

    return summary;
}

function nrPrepareNextGrade(job) {
    job.gradeIndex++;
    job.currentGrade = null;
    job.sections = [];
    job.sectionIndex = 0;
    job.currentSection = null;
    job.report = null;
    job.phase = 'selectGrade';
    job.actionAt = 0;
    job.retries = 0;
    saveNoorJob(job);

    // لا ننتظر دورة setInterval إضافية بعد آخر صف.
    // ننهي المدرسة فورًا ونثبت النتيجة قبل أي إعادة تحميل محتملة من V2.
    if (job.gradeIndex >= job.grades.length) {
        nrSchoolFinish(job);
        return true;
    }

    return false;
}

function nrVerifyGrade(job, allRows) {

    const summary = nrGradeSummary(job);
    const gradeText = job.currentGrade.text;

    const detailRows = job.rows.filter(r =>
        r.grade === gradeText
        && r.className !== 'غير محدد'
    );

    const detailed = new Map();

    for (const row of detailRows) {
        const key = nrIdentity(row);
        if (!key) continue;
        if (!detailed.has(key)) {
            detailed.set(key, {
                rows: [],
                sections: new Set()
            });
        }
        detailed.get(key).rows.push(row);
        detailed.get(key).sections.add(row.className);
    }

    const allUnique = new Map();

    for (const row of nrExactUnique(allRows).rows) {
        const key = nrIdentity(row);
        if (key && !allUnique.has(key)) allUnique.set(key, row);
    }

    const duplicates = [...detailed.entries()]
        .filter(([, value]) => value.sections.size > 1);

    const missing = [...allUnique.entries()]
        .filter(([key]) => !detailed.has(key));

    const extra = [...detailed.entries()]
        .filter(([key]) => !allUnique.has(key));

    // الطالب الموجود في "الكل" وغير الموجود بفصل منفرد لا نضيعُه ولا نخمن فصله.
    for (const [, row] of missing) {
        job.rows.push({
            ...row,
            grade: gradeText,
            className: 'غير محدد'
        });
    }

    summary.sectionCount = summary.sections.length;
    summary.extractedUnique = detailed.size;
    summary.allCount = allUnique.size;
    summary.missingCount = missing.length;
    summary.extraCount = extra.length;
    summary.duplicateCount = duplicates.length;
    summary.verified = (
        !summary.noSections
        && missing.length === 0
        && extra.length === 0
        && duplicates.length === 0
        && detailed.size === allUnique.size
    );

    job.diagnostics.duplicateAcrossSections += duplicates.length;
    job.diagnostics.missingFromSections += missing.length;
    job.diagnostics.extraVsAll += extra.length;

    saveNoorJob(job);
}

function nrSchoolFinish(job) {

    const gradeOrder = new Map(
        job.grades.map((g, i) => [g.text, i])
    );

    // نجمع الطالب بهويته، لكن لا نخفي تعارض الفصل.
    const students = new Map();

    for (const row of job.rows) {

        const key = nrIdentity(row);
        if (!key) continue;

        if (!students.has(key)) {
            students.set(key, {
                rows: [],
                sections: new Set(),
                grades: new Set()
            });
        }

        const item = students.get(key);
        item.rows.push(row);
        item.grades.add(row.grade);
        item.sections.add(`${row.grade}\u0001${row.className}`);
    }

    const finalRows = [];
    const identityConflicts = [];

    for (const [key, item] of students) {

        const first = item.rows[0];
        const sectionLabels = [...item.sections].map(x => {
            const [grade, cls] = x.split('\u0001');
            return `${grade} / ${cls}`;
        });

        const realSections = sectionLabels.filter(x => !x.endsWith('/ غير محدد'));

        if (realSections.length > 1 || item.grades.size > 1) {
            identityConflicts.push({
                key,
                name: first.name,
                locations: sectionLabels
            });
        }

        let grade = first.grade;
        let className = first.className;

        if (item.grades.size > 1) {
            grade = 'متعدد';
            className = `متعدد: ${sectionLabels.join('، ')}`;
        }
        else if (realSections.length > 1) {
            className = `متعدد: ${realSections.map(x => x.split(' / ')[1]).join('، ')}`;
        }
        else if (realSections.length === 1) {
            className = realSections[0].split(' / ')[1];
        }

        finalRows.push(
            Object.assign(record(), {
                name: first.name,
                civilId: first.civilId,
                grade,
                className,
                source: 'نور'
            })
        );
    }

    finalRows.sort((a, b) => {
        const ga = gradeOrder.get(a.grade) ?? 999;
        const gb = gradeOrder.get(b.grade) ?? 999;
        return ga - gb
            || collator.compare(a.className, b.className)
            || collator.compare(a.name, b.name);
    });

    finalRows.forEach((r, i) => {
        r.serial = String(i + 1);
    });

    const verifiedGrades = job.summaries.filter(x => x.verified).length;

    const warnings = [];

    if (job.diagnostics.missingFromSections) {
        warnings.push(`${job.diagnostics.missingFromSections} طالب ظهر في تقرير «الكل» ولم يظهر في فصل منفرد؛ وُسم الفصل «غير محدد».`);
    }

    if (job.diagnostics.extraVsAll) {
        warnings.push(`${job.diagnostics.extraVsAll} طالب ظهر في فصل منفرد ولم يظهر في تقرير «الكل».`);
    }

    if (job.diagnostics.duplicateAcrossSections || identityConflicts.length) {
        warnings.push(`${Math.max(job.diagnostics.duplicateAcrossSections, identityConflicts.length)} هوية ظهرت في أكثر من فصل/صف؛ لم يختر السكربت فصلًا بصمت.`);
    }

    if (job.diagnostics.gradesWithoutSections) {
        warnings.push(`${job.diagnostics.gradesWithoutSections} صف لم يعرض فصولًا منفردة.`);
    }

    const complete = (
        verifiedGrades === job.grades.length
        && !warnings.length
    );

    const scope = {
        ...emptyScope(),
        platform: 'noor',
        mode: 'whole-school',
        label: 'المدرسة كاملة',
        studySystem: job.studySystem || '',
        verified: complete,
        grades: job.summaries.map(s => ({
            grade: s.grade,
            sections: s.sections.map(x => x.section),
            sectionCount: s.sectionCount,
            extractedUnique: s.extractedUnique,
            allCount: s.allCount,
            missingCount: s.missingCount,
            extraCount: s.extraCount,
            duplicateCount: s.duplicateCount,
            verified: s.verified
        }))
    };

    const audit = {
        complete,
        sourceView: NOOR_VIEW,
        sourceViewLabel: NOOR_VIEW_LABEL,
        pageCount: job.totalReportPages,
        rawRows: job.rows.length,
        finalRows: finalRows.length,
        exactDuplicates: job.exactDuplicates || 0,
        gradeCount: job.grades.length,
        verifiedGrades,
        identityConflicts,
        diagnostics: job.diagnostics,
        warnings
    };

    saveNoorResult(finalRows, job.totalReportPages, scope, audit);
    clearNoorJob();
    running(false);
    afterExtract(finalRows, job.totalReportPages, scope, audit);

    status(
        `اكتمل استخراج المدرسة: ${finalRows.length} طالب — تحقق ${verifiedGrades}/${job.grades.length} صف`
        + (warnings.length ? ` — توجد ${warnings.length} ملاحظة تدقيق.` : ' — التدقيق مكتمل.')
    );

    toast(
        warnings.length
            ? 'اكتمل استخراج المدرسة مع ملاحظات تدقيق ظاهرة.'
            : 'اكتمل استخراج المدرسة والتحقق من جميع الصفوف.'
    );
}

async function tickNoorSchool(job) {

    if (!nrControlsReady()) {
        status('بانتظار تحميل قوائم نور...');
        return;
    }

    if (nrAjaxBusy()) {
        status('نور يقوم بتحديث القوائم...');
        return;
    }

    // لا نجعل حالة انتظار ReportViewer توقف مراحل اختيار الصف والفصل.
    // نحتاجها فقط عندما ننتظر/نقرأ تقريرًا فعليًا.
    const reportPhase = new Set([
        'waitSectionReport',
        'collectSection',
        'waitVerifyReport',
        'collectVerify'
    ]).has(job.phase);

    if (reportPhase && nrWait()) {
        status('نور يقوم بتحميل التقرير...');
        return;
    }

    if (job.gradeIndex >= job.grades.length) {
        nrSchoolFinish(job);
        return;
    }

    const targetGrade = job.grades[job.gradeIndex];

    if (job.phase === 'selectGrade') {

        job.currentGrade = targetGrade;
        job.currentSection = null;

        const gradeEl = nrGradeEl();

        if (String(gradeEl.value) === String(targetGrade.value)) {
            job.phase = 'discoverSections';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
        }
        else {
            job.phase = 'waitGrade';
            job.actionAt = Date.now();
            job.retries = 0;
            saveNoorJob(job);
            status(`اختيار الصف ${targetGrade.text} — ${job.gradeIndex + 1}/${job.grades.length}`);

            if (!nrPostBackSelect(gradeEl, targetGrade.value)) {
                nrFail(job, `تعذر اختيار الصف ${targetGrade.text}.`);
            }
            return;
        }
    }

    if (job.phase === 'waitGrade') {

        const gradeEl = nrGradeEl();

        if (String(gradeEl.value) !== String(targetGrade.value)) {

            if (Date.now() - job.actionAt > 12000) {
                job.retries++;

                if (job.retries > 3) {
                    nrFail(job, `تعذر تثبيت اختيار الصف ${targetGrade.text}.`);
                    return;
                }

                job.actionAt = Date.now();
                saveNoorJob(job);
                nrPostBackSelect(gradeEl, targetGrade.value);
            }
            return;
        }

        if (!nrSelectPostBackSettled(job.actionAt, gradeEl, targetGrade.value)) {
            status(`انتظار تحديث فصول ${targetGrade.text}...`);
            return;
        }

        job.phase = 'discoverSections';
        job.retries = 0;
        saveNoorJob(job);
        return;
    }

    if (job.phase === 'discoverSections') {

        const sections = nrSectionOptions();
        const summary = nrGradeSummary(job);

        job.sections = sections;
        job.sectionIndex = 0;
        job.currentSection = null;
        summary.sections = [];
        summary.noSections = sections.length === 0;

        if (!sections.length) {
            job.diagnostics.gradesWithoutSections++;
            status(`${targetGrade.text}: لم تظهر فصول منفردة؛ سيتم التحقق من تقرير «الكل».`);
            job.phase = 'prepareVerify';
        }
        else {
            status(`${targetGrade.text}: تم اكتشاف ${sections.length} فصل.`);
            job.phase = 'selectSection';
        }

        saveNoorJob(job);
    }

    if (job.phase === 'selectSection') {

        if (job.sectionIndex >= job.sections.length) {
            job.phase = 'prepareVerify';
            saveNoorJob(job);
            return;
        }

        const section = job.sections[job.sectionIndex];
        job.currentSection = section;

        const sectionEl = nrSectionEl();

        // الواجهة القديمة كانت مستقرة وسريعة في 1.9.1 بتغيير القيمة ثم العرض مباشرة.
        // V2 وحدها تحتاج PostBack حقيقي للفصل قبل زر «عرض».
        if (NOOR_VIEW !== 'v2') {
            if (!nrSetSelectValue(sectionEl, section.value)) {
                nrFail(job, `تعذر اختيار الفصل ${section.text} في ${targetGrade.text}.`);
                return;
            }
            job.phase = 'showSection';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
        }
        else if (String(sectionEl?.value) === String(section.value)) {
            job.phase = 'showSection';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
            return;
        }
        else {
            job.phase = 'waitSectionChoice';
            job.actionAt = Date.now();
            job.retries = 0;
            saveNoorJob(job);
            status(`${targetGrade.text} — اختيار الفصل ${section.text}...`);

            if (!nrPostBackSelect(sectionEl, section.value)) {
                nrFail(job, `تعذر اختيار الفصل ${section.text} في ${targetGrade.text}.`);
            }
            return;
        }
    }

    if (job.phase === 'waitSectionChoice') {
        const sectionEl = nrSectionEl();
        const section = job.currentSection;

        if (!nrSelectPostBackSettled(job.actionAt, sectionEl, section?.value)) {
            if (Date.now() - job.actionAt > 12000) {
                job.retries++;
                if (job.retries > 3) {
                    nrFail(job, `تعذر تثبيت الفصل ${section?.text || '—'} في ${targetGrade.text}.`);
                    return;
                }
                job.actionAt = Date.now();
                saveNoorJob(job);
                nrPostBackSelect(sectionEl, section.value);
            }
            return;
        }

        job.phase = 'showSection';
        job.actionAt = 0;
        job.retries = 0;
        saveNoorJob(job);
        return;
    }

    if (job.phase === 'showSection') {

        job.phase = 'waitSectionReport';
        job.actionAt = Date.now();
        job.previousReportSignature = nrReportSignature();
        saveNoorJob(job);

        status(`${targetGrade.text} / فصل ${job.currentSection.text} — عرض التقرير...`);

        if (!nrClickView()) {
            nrFail(job, `تعذر عرض تقرير ${targetGrade.text} / فصل ${job.currentSection.text}.`);
        }
        return;
    }

    if (job.phase === 'waitSectionReport') {

        if (Date.now() - job.actionAt < 500) return;
        if (!nrReady()) return;
        if (!nrReportSettled(job.actionAt, job.previousReportSignature)) return;

        if (
            String(nrGradeEl()?.value) !== String(targetGrade.value)
            || String(nrSectionEl()?.value) !== String(job.currentSection.value)
        ) {
            return;
        }

        job.report = nrNewReport();
        job.phase = 'collectSection';
        saveNoorJob(job);
    }

    if (job.phase === 'collectSection') {

        const label = `${targetGrade.text} / فصل ${job.currentSection.text}`;
        const done = await nrTickReport(job, job.report, label);

        if (!done) return;

        const unique = nrExactUnique(job.report.rows);
        job.exactDuplicates += unique.exactDuplicates;

        for (const row of unique.rows) {
            job.rows.push({
                ...row,
                grade: targetGrade.text,
                className: job.currentSection.text
            });
        }

        const summary = nrGradeSummary(job);

        summary.sections.push({
            value: job.currentSection.value,
            section: job.currentSection.text,
            count: unique.rows.length,
            pages: job.report.total
        });

        job.totalReportPages += job.report.total;
        job.sectionIndex++;
        job.report = null;
        job.phase = 'selectSection';
        saveNoorJob(job);

        status(`${label}: اكتمل ${unique.rows.length} طالب.`);
        return;
    }

    if (job.phase === 'prepareVerify') {

        const all = nrAllSectionOption();
        const summary = nrGradeSummary(job);

        if (!all) {
            summary.verified = false;
            nrPrepareNextGrade(job);
            return;
        }

        job.currentSection = all;
        const sectionEl = nrSectionEl();

        if (NOOR_VIEW !== 'v2') {
            if (!nrSetSelectValue(sectionEl, all.value)) {
                nrFail(job, `تعذر اختيار «الكل» للتحقق من ${targetGrade.text}.`);
                return;
            }
            job.phase = 'showVerify';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
        }
        else if (String(sectionEl?.value) === String(all.value)) {
            job.phase = 'showVerify';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
            return;
        }
        else {
            job.phase = 'waitVerifyChoice';
            job.actionAt = Date.now();
            job.retries = 0;
            saveNoorJob(job);
            status(`${targetGrade.text} — اختيار «الكل» للتحقق...`);

            if (!nrPostBackSelect(sectionEl, all.value)) {
                nrFail(job, `تعذر اختيار «الكل» للتحقق من ${targetGrade.text}.`);
            }
            return;
        }
    }

    if (job.phase === 'waitVerifyChoice') {
        const sectionEl = nrSectionEl();
        const all = job.currentSection;

        if (!nrSelectPostBackSettled(job.actionAt, sectionEl, all?.value)) {
            if (Date.now() - job.actionAt > 12000) {
                job.retries++;
                if (job.retries > 3) {
                    nrFail(job, `تعذر تثبيت «الكل» للتحقق من ${targetGrade.text}.`);
                    return;
                }
                job.actionAt = Date.now();
                saveNoorJob(job);
                nrPostBackSelect(sectionEl, all.value);
            }
            return;
        }

        job.phase = 'showVerify';
        job.actionAt = 0;
        job.retries = 0;
        saveNoorJob(job);
        return;
    }

    if (job.phase === 'showVerify') {

        job.phase = 'waitVerifyReport';
        job.actionAt = Date.now();
        job.previousReportSignature = nrReportSignature();
        saveNoorJob(job);
        status(`${targetGrade.text} — التحقق بتقرير «الكل»...`);

        if (!nrClickView()) {
            nrFail(job, `تعذر عرض تقرير «الكل» للصف ${targetGrade.text}.`);
        }
        return;
    }

    if (job.phase === 'waitVerifyReport') {

        if (Date.now() - job.actionAt < 500) return;
        if (!nrReady()) return;
        if (!nrReportSettled(job.actionAt, job.previousReportSignature)) return;

        if (
            String(nrGradeEl()?.value) !== String(targetGrade.value)
            || String(nrSectionEl()?.value) !== String(job.currentSection.value)
        ) {
            return;
        }

        job.report = nrNewReport();
        job.phase = 'collectVerify';
        saveNoorJob(job);
    }

    if (job.phase === 'collectVerify') {

        const done = await nrTickReport(
            job,
            job.report,
            `${targetGrade.text} / التحقق «الكل»`
        );

        if (!done) return;

        const unique = nrExactUnique(job.report.rows);
        job.exactDuplicates += unique.exactDuplicates;
        job.totalReportPages += job.report.total;

        nrVerifyGrade(job, unique.rows);

        const summary = nrGradeSummary(job);

        status(
            `${targetGrade.text}: الفصول ${summary.extractedUnique} / تقرير الكل ${summary.allCount}`
            + (summary.verified
                ? ' ✅'
                : ` ⚠️ مفقود ${summary.missingCount} / زائد ${summary.extraCount} / متعدد ${summary.duplicateCount}`)
        );

        nrPrepareNextGrade(job);
    }
}

function nrFail(job, msg) {
    clearNoorJob();
    running(false);
    status(msg);
    toast(msg, 'err');
}

async function tickNoor() {

    if (PLATFORM !== 'noor' || state.noorBusy) return;

    const job = loadNoorJob();

    if (!job?.active) return;

    state.noorBusy = true;

    try {
        open();
        running(true);

        if (job.mode === 'school') {
            await tickNoorSchool(job);
        }
        else {
            await tickNoorCurrent(job);
        }
    }
    catch (e) {
        nrFail(job, e.message || 'حدث خطأ أثناء استخراج نور.');
    }
    finally {
        state.noorBusy = false;
    }
}

// =========================================================
// كشف المتابعة — Follow Studio v2.1
// =========================================================

function renderFields() {

    ui.fields.innerHTML =
        FOLLOW
            .map(([k, l]) => {

                const avail =
                    k === 'serial'
                    || k === 'name'
                    || state.rows.some(r => clean(r[k]));

                const fixed = k === 'serial';
                const checked = fixed || state.prefs.fields.includes(k);

                return `
                    <label class="check" style="opacity:${avail ? 1 : .45}">
                        <input
                            data-f="${k}"
                            type="checkbox"
                            ${checked ? 'checked' : ''}
                            ${(avail && !fixed) ? '' : 'disabled'}
                        >
                        <span>${l}${fixed ? ' (ثابت)' : ''}</span>
                    </label>
                `;
            })
            .join('');

    ui.fields
        .querySelectorAll('[data-f]')
        .forEach(x => x.onchange = renderFollow);
}

function followTemplatesLoad() {
    try {
        const raw = JSON.parse(localStorage.getItem(FOLLOW_TEMPLATE_KEY) || '[]');
        return Array.isArray(raw) ? raw : [];
    }
    catch {
        return [];
    }
}

function followTemplatesSave(items) {
    try {
        localStorage.setItem(FOLLOW_TEMPLATE_KEY, JSON.stringify(items.slice(0, 30)));
    }
    catch {}
}

function refreshFollowTemplateOptions(selected = ui.tpl?.value || 'custom') {
    if (!ui.tpl) return;

    const builtins = [
        ['custom', 'مخصص'],
        ...Object.entries(TPL_META).map(([key, meta]) => [key, meta.label])
    ];

    const saved = followTemplatesLoad();

    ui.tpl.innerHTML = [
        ...builtins.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`),
        ...saved.map(item => `<option value="saved:${esc(item.id)}">⭐ ${esc(item.name)}</option>`)
    ].join('');

    const exists = [...ui.tpl.options].some(o => o.value === selected);
    ui.tpl.value = exists ? selected : 'custom';
    ui.fdeletetpl.disabled = !ui.tpl.value.startsWith('saved:');
}

function prefsToUI() {

    const p = state.prefs;

    ui.ftitle.value = p.title;
    ui.fteacher.value = p.teacher;
    ui.fschool.value = p.school;
    ui.fgrade.value = p.grade;
    ui.fclass.value = p.className;
    ui.fyear.value = p.year;
    ui.fperiod.value = p.period || '';
    ui.fcols.value = p.follow.join('\n');
    ui.fextra.value = p.extra;
    ui.forient.value = p.orientation;

    ui.fscope.value = p.followScope || 'all';
    ui.fsort.value = p.followSort || 'class-name';
    ui.fgroup.value = p.followGroup || 'grade-class';
    ui.fsearch.value = p.followSearch || '';
    ui.fperclass.checked = p.followPerClass !== false;
    ui.frepeathead.checked = p.followRepeatHeader !== false;
    ui.fcellmode.value = p.followCellMode || 'blank';
    ui.frowsperpage.value = Number(p.followRowsPerPage) || 32;

    refreshFollowTemplateOptions();
}

function prefsFromUI() {

    const p = state.prefs;

    p.title = clean(ui.ftitle.value) || 'كشف متابعة الطلاب';
    p.teacher = clean(ui.fteacher.value);
    p.school = clean(ui.fschool.value);
    p.grade = clean(ui.fgrade.value);
    p.className = clean(ui.fclass.value);
    p.year = clean(ui.fyear.value);
    p.period = clean(ui.fperiod.value);

    p.fields = [...ui.fields.querySelectorAll('[data-f]:checked')].map(x => x.dataset.f);
    if (!p.fields.includes('serial')) p.fields.unshift('serial');

    p.follow = ui.fcols.value
        .split(/\r?\n/)
        .map(clean)
        .filter(Boolean)
        .slice(0, 30);

    p.extra = Math.max(0, Math.min(50, Number(ui.fextra.value) || 0));
    p.orientation = ui.forient.value === 'landscape' ? 'landscape' : 'portrait';

    p.followScope = ui.fscope.value || 'all';
    p.followGrade = ui.fgradefilter.value || '';
    p.followClasses = [...ui.fclassfilter.selectedOptions].map(o => o.value).filter(Boolean);
    p.followSort = ui.fsort.value || 'class-name';
    p.followGroup = ui.fgroup.value || 'grade-class';
    p.followSearch = clean(ui.fsearch.value);
    p.followPerClass = !!ui.fperclass.checked;
    p.followRepeatHeader = !!ui.frepeathead.checked;
    p.followCellMode = ['blank', 'check', 'score', 'note'].includes(ui.fcellmode.value)
        ? ui.fcellmode.value
        : 'blank';
    p.followRowsPerPage = Math.max(10, Math.min(60, Number(ui.frowsperpage.value) || 32));

    prefsSave();
}

function followRowKey(row) {
    const strong = PLATFORM === 'noor'
        ? clean(row.civilId)
        : clean(row.studentAccount).toLowerCase();

    return [
        strong,
        norm(row.name),
        norm(row.grade),
        norm(row.className),
        clean(row.serial)
    ].join('\u0001');
}

function followClassKey(row) {
    return `${clean(row.grade)}\u0001${clean(row.className)}`;
}

function followClassLabel(row) {
    const grade = clean(row.grade);
    const cls = clean(row.className) || 'غير محدد';
    return grade ? `${grade} / ${cls}` : cls;
}

function followUniqueRows(rows) {
    const out = [];
    const seen = new Set();

    for (const row of rows || []) {
        if (!row) continue;
        const key = followRowKey(row);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
    }

    return out;
}

function followComparisonRows(kind) {
    const cmp = state.comparison;
    if (!cmp) return [];

    if (kind === 'added') return followUniqueRows(cmp.added || []);

    let items = cmp.changed || [];

    if (kind === 'class-changed') {
        items = items.filter(item =>
            (item.changes || []).some(ch => {
                const key = clean(ch.key || ch.field || '').toLowerCase();
                const label = norm(ch.label || '');
                return key === 'classname' || label.includes(norm('الفصل'));
            })
        );
    }

    return followUniqueRows(items.map(item => item.current || item));
}

function followScopeRows() {
    const p = state.prefs;

    if (p.followScope === 'filtered') return [...state.filtered];
    if (p.followScope === 'added') return followComparisonRows('added');
    if (p.followScope === 'changed') return followComparisonRows('changed');
    if (p.followScope === 'class-changed') return followComparisonRows('class-changed');
    return [...state.rows];
}

function followApplyFilters(rows, includeManual = true) {
    const p = state.prefs;
    const selectedClasses = new Set(Array.isArray(p.followClasses) ? p.followClasses : []);
    const q = norm(p.followSearch || '');

    let out = rows.filter(row => {
        if (p.followGrade && clean(row.grade) !== p.followGrade) return false;
        if (selectedClasses.size && !selectedClasses.has(followClassKey(row))) return false;

        if (q) {
            const hay = [
                row.name,
                row.civilId,
                row.studentAccount,
                row.studentPhone,
                row.guardianName,
                row.guardianPhone,
                row.grade,
                row.className
            ].map(norm).join(' ');

            if (!hay.includes(q)) return false;
        }

        return true;
    });

    if (includeManual && p.followScope === 'selected') {
        out = out.filter(row => state.followSelection.has(followRowKey(row)));
    }

    return followUniqueRows(out);
}

function followSortRows(rows) {
    const mode = state.prefs.followSort || 'class-name';
    const sourceIndex = new Map(state.rows.map((row, index) => [followRowKey(row), index]));
    const out = [...rows];

    out.sort((a, b) => {
        if (mode === 'source') {
            return (sourceIndex.get(followRowKey(a)) ?? 999999) - (sourceIndex.get(followRowKey(b)) ?? 999999);
        }

        if (mode === 'serial') {
            return collator.compare(clean(a.serial), clean(b.serial));
        }

        if (mode === 'name') {
            return collator.compare(a.name, b.name);
        }

        if (mode === 'grade-class-name') {
            return collator.compare(a.grade, b.grade)
                || collator.compare(a.className, b.className)
                || collator.compare(a.name, b.name);
        }

        return collator.compare(a.className, b.className)
            || collator.compare(a.grade, b.grade)
            || collator.compare(a.name, b.name);
    });

    return out;
}

function followRows() {
    return followSortRows(followApplyFilters(followScopeRows(), true));
}

function followCandidateRows() {
    return followSortRows(followApplyFilters([...state.rows], false));
}

function followGroups(rows = followRows()) {
    const p = state.prefs;
    const byClass = p.followPerClass || p.followGroup === 'class' || p.followGroup === 'grade-class';

    if (!byClass) {
        const grades = [...new Set(rows.map(r => clean(r.grade)).filter(Boolean))];
        const classes = [...new Set(rows.map(r => clean(r.className)).filter(Boolean))];
        return [{
            key: 'all',
            label: 'النطاق المحدد',
            grade: grades.length === 1 ? grades[0] : '',
            className: classes.length === 1 ? classes[0] : '',
            rows
        }];
    }

    const map = new Map();

    for (const row of rows) {
        const key = p.followGroup === 'class' && !p.followPerClass
            ? clean(row.className) || 'غير محدد'
            : followClassKey(row);

        if (!map.has(key)) {
            map.set(key, {
                key,
                label: followClassLabel(row),
                grade: clean(row.grade),
                className: clean(row.className) || 'غير محدد',
                rows: []
            });
        }

        map.get(key).rows.push(row);
    }

    return [...map.values()].sort((a, b) =>
        collator.compare(a.grade, b.grade)
        || collator.compare(a.className, b.className)
    );
}

function followColumns() {
    const allowed = new Set(['blank', 'check', 'score', 'note']);
    const fallback = state.prefs.followCellMode || 'blank';

    return (state.prefs.follow || []).map(raw => {
        const parts = String(raw || '').split('|').map(clean);
        const label = parts[0] || 'متابعة';
        const type = allowed.has((parts[1] || '').toLowerCase())
            ? parts[1].toLowerCase()
            : fallback;
        return { label, type };
    });
}

function followCellHtml(col) {
    if (col.type === 'check') return '<td class="follow-check">□</td>';
    if (col.type === 'note') return '<td class="follow-note"></td>';
    if (col.type === 'score') return '<td class="follow-score"></td>';
    return '<td></td>';
}

function followCellText(col) {
    return col.type === 'check' ? '□' : '';
}

function refreshFollowControls() {
    if (!ui.fgradefilter || !ui.fclassfilter) return;

    const p = state.prefs;
    const oldGrade = p.followGrade || ui.fgradefilter.value || '';
    const oldClasses = new Set(Array.isArray(p.followClasses) ? p.followClasses : []);

    const grades = [...new Set(state.rows.map(r => clean(r.grade)).filter(Boolean))].sort(collator.compare);
    ui.fgradefilter.innerHTML = '<option value="">كل الصفوف</option>'
        + grades.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');

    ui.fgradefilter.value = grades.includes(oldGrade) ? oldGrade : '';
    p.followGrade = ui.fgradefilter.value;

    const classMap = new Map();
    state.rows
        .filter(r => !p.followGrade || clean(r.grade) === p.followGrade)
        .forEach(r => {
            const key = followClassKey(r);
            if (!classMap.has(key)) classMap.set(key, followClassLabel(r));
        });

    ui.fclassfilter.innerHTML = [...classMap.entries()]
        .sort((a, b) => collator.compare(a[1], b[1]))
        .map(([key, label]) => `<option value="${esc(key)}">${esc(label)}</option>`)
        .join('');

    [...ui.fclassfilter.options].forEach(o => {
        o.selected = oldClasses.has(o.value);
    });

    p.followClasses = [...ui.fclassfilter.selectedOptions].map(o => o.value);
    prefsSave();

    const cmp = !!state.comparison;
    [...ui.fscope.options].forEach(o => {
        if (['added', 'changed', 'class-changed'].includes(o.value)) o.disabled = !cmp;
    });
}

function renderFollowPicker() {
    const rows = followCandidateRows();
    const visible = rows.slice(0, 350);

    if (!rows.length) {
        ui.followpicker.innerHTML = '<div class="note">لا يوجد طلاب ضمن الفلاتر الحالية.</div>';
        return;
    }

    ui.followpicker.innerHTML = `
        <table>
            <thead>
                <tr><th>اختيار</th><th>م</th><th>اسم الطالب</th><th>الصف</th><th>الفصل</th></tr>
            </thead>
            <tbody>
                ${visible.map((row, index) => `
                    <tr>
                        <td><input type="checkbox" data-follow-index="${index}" ${state.followSelection.has(followRowKey(row)) ? 'checked' : ''}></td>
                        <td>${index + 1}</td>
                        <td>${esc(row.name)}</td>
                        <td>${esc(row.grade)}</td>
                        <td>${esc(row.className)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${rows.length > visible.length ? `<div class="note">يظهر أول ${visible.length} طالب فقط في أداة التحديد. استخدم الصف/الفصل/البحث لتضييق القائمة.</div>` : ''}
    `;

    ui.followpicker.querySelectorAll('[data-follow-index]').forEach(box => {
        box.onchange = () => {
            const row = visible[Number(box.dataset.followIndex)];
            if (!row) return;
            const key = followRowKey(row);
            if (box.checked) state.followSelection.add(key);
            else state.followSelection.delete(key);
            state.followSelectionTouched = true;
            ui.fscope.value = 'selected';
            renderFollow();
        };
    });
}

function renderFollowSummary(rows = followRows()) {
    const groups = followGroups(rows);
    ui.fcountsummary.textContent = `${rows.length} طالب · ${groups.filter(g => g.rows.length).length} كشف`;
}

function hydrateFollow() {

    if (!state.rows.length) {
        refreshFollowControls();
        return;
    }

    const one = k => {
        const a = [...new Set(state.rows.map(r => clean(r[k])).filter(Boolean))];
        return a.length === 1 ? a[0] : '';
    };

    if (!state.prefs.grade) state.prefs.grade = one('grade');
    if (!state.prefs.className) state.prefs.className = one('className');

    prefsToUI();
    refreshFollowControls();
}

const mc = document.createElement('canvas');
const ctx = mc.getContext('2d');

function mm(v, b = false) {
    ctx.font = `${b ? '700' : '400'} 10px Tahoma`;
    return ctx.measureText(clean(v) || ' ').width * 25.4 / 96;
}

function followMeta(group, p) {
    const grade = clean(group?.grade) || p.grade;
    const className = clean(group?.className) || p.className;

    return [
        p.teacher && `المعلم: ${p.teacher}`,
        p.school && `المدرسة: ${p.school}`,
        grade && `الصف: ${grade}`,
        className && `الفصل: ${className}`,
        p.period && `الفترة: ${p.period}`,
        p.year && `العام: ${p.year}`
    ].filter(Boolean).join(' · ');
}

function followFieldDefs() {
    return state.prefs.fields
        .map(k => FOLLOW.find(x => x[0] === k))
        .filter(Boolean);
}

function followHtmlSheets() {
    prefsFromUI();

    const p = state.prefs;
    const rows = followRows();
    const groups = followGroups(rows).filter(g => g.rows.length);
    const fields = followFieldDefs();
    const custom = followColumns();

    if (!groups.length || !rows.length) {
        return { html: '<div class="note">لا يوجد طلاب ضمن نطاق كشف المتابعة الحالي.</div>', groups, rows };
    }

    const width = p.orientation === 'landscape' ? 283 : 196;
    const w = {};

    for (const [k, label] of fields) {
        let z = mm(label, true);
        rows.forEach((r, i) => {
            z = Math.max(z, mm(k === 'serial' ? String(i + 1) : r[k]));
        });
        w[k] = Math.ceil((z + (k === 'serial' ? 3 : 5)) * 10) / 10;
    }

    const base = fields.reduce((sum, [k]) => sum + w[k], 0);
    const minFollowWidth = 12;
    const per = custom.length
        ? Math.max(1, Math.floor(Math.max(minFollowWidth, width - base) / minFollowWidth))
        : 0;

    const colChunks = custom.length
        ? Array.from({ length: Math.ceil(custom.length / per) }, (_, i) => custom.slice(i * per, (i + 1) * per))
        : [[]];

    const pageRows = Math.max(10, Math.min(60, Number(p.followRowsPerPage) || 32));
    const sections = [];

    groups.forEach((group, groupIndex) => {
        const rowPages = Array.from(
            { length: Math.max(1, Math.ceil(group.rows.length / pageRows)) },
            (_, i) => group.rows.slice(i * pageRows, (i + 1) * pageRows)
        );

        rowPages.forEach((page, pageIndex) => {
            colChunks.forEach((cols, colIndex) => {
                const fw = cols.length ? Math.max(12, width - base) / cols.length : 0;
                const cg = '<colgroup>'
                    + fields.map(([k]) => `<col style="width:${w[k]}mm">`).join('')
                    + cols.map(col => `<col style="width:${(col.type === 'note' ? fw * 1.35 : fw).toFixed(2)}mm">`).join('')
                    + '</colgroup>';

                const head = '<tr>'
                    + fields.map(([, label]) => `<th>${esc(label)}</th>`).join('')
                    + cols.map(col => `<th>${esc(col.label)}</th>`).join('')
                    + '</tr>';

                const bodyRows = page.map((r, i) => {
                    const serial = pageIndex * pageRows + i + 1;
                    return '<tr>'
                        + fields.map(([k]) => `<td class="${k === 'name' ? 'name' : ''}">${esc(k === 'serial' ? String(serial) : (r[k] || ''))}</td>`).join('')
                        + cols.map(followCellHtml).join('')
                        + '</tr>';
                });

                if (pageIndex === rowPages.length - 1 && colIndex === 0 && p.extra) {
                    for (let i = 0; i < p.extra; i++) {
                        bodyRows.push(
                            '<tr>'
                            + fields.map(([k]) => `<td>${k === 'serial' ? group.rows.length + i + 1 : ''}</td>`).join('')
                            + cols.map(followCellHtml).join('')
                            + '</tr>'
                        );
                    }
                }

                const groupMark = groups.length > 1 ? group.label : 'النطاق المحدد';
                const pageMark = `صفحة ${pageIndex + 1}/${rowPages.length}`;
                const colMark = colChunks.length > 1 ? `أعمدة ${colIndex + 1}/${colChunks.length}` : '';

                sections.push(`
                    <section class="sheet ${p.orientation}">
                        <div class="sheetmark">
                            <span>${esc(groupMark)}</span>
                            <span>${esc([pageMark, colMark].filter(Boolean).join(' · '))}</span>
                        </div>
                        <h3 style="text-align:center;margin:8px">${esc(p.title)}</h3>
                        <div class="sheetmeta">${esc(followMeta(group, p))}</div>
                        <table>
                            ${cg}
                            <thead>${head}</thead>
                            <tbody>${bodyRows.join('')}</tbody>
                        </table>
                    </section>
                `);
            });
        });
    });

    return { html: sections.join(''), groups, rows };
}

function followHTML(print = false) {
    const built = followHtmlSheets();

    if (!print) return built.html;

    const p = state.prefs;
    return `
        <!doctype html>
        <html dir="rtl">
        <head>
            <meta charset="utf-8">
            <style>
                @page{size:A4 ${p.orientation};margin:7mm}
                body{font-family:Tahoma;margin:0;color:#111827}
                table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:7.5pt}
                th,td{border:1px solid #64748b;padding:1.5mm .6mm;height:8mm;text-align:center;white-space:nowrap;overflow:hidden}
                th{background:#0f766e;color:#fff}
                .name{text-align:right}
                .sheet{page-break-after:always}
                .sheet:last-child{page-break-after:auto}
                .sheetmark{display:flex;justify-content:space-between;font-size:9px;color:#64748b;margin-bottom:4px}
                .sheetmeta{text-align:center;font-size:10px;margin-bottom:7px;line-height:1.7}
                .follow-check{font-size:15px;color:#475569}
                .follow-note{min-width:22mm}
                .follow-score{min-width:12mm}
            </style>
        </head>
        <body>${built.html}</body>
        </html>
    `;
}

function renderFollow() {
    if (!state.rows.length) {
        ui.preview.innerHTML = '<div class="note">استخرج الطلاب أولًا.</div>';
        ui.followpicker.innerHTML = '<div class="note">لا توجد بيانات بعد.</div>';
        ui.fcountsummary.textContent = '0 طالب';
        return;
    }

    prefsFromUI();
    renderFollowPicker();
    const rows = followRows();
    renderFollowSummary(rows);
    ui.preview.innerHTML = followHTML(false);
}

async function printFollow() {
    if (!followRows().length) {
        toast('لا يوجد طلاب ضمن نطاق الكشف الحالي.', 'err');
        return;
    }

    const f = document.createElement('iframe');
    Object.assign(f.style, {
        position: 'fixed',
        width: '1px',
        height: '1px',
        opacity: '0'
    });

    document.body.appendChild(f);
    f.contentDocument.open();
    f.contentDocument.write(followHTML(true));
    f.contentDocument.close();

    await wait(300);
    f.contentWindow.print();
    setTimeout(() => f.remove(), 60000);
}

function followGroupMatrix(group) {
    const fields = followFieldDefs();
    const cols = followColumns();
    const matrixRows = [[...fields.map(x => x[1]), ...cols.map(x => x.label)]];

    group.rows.forEach((r, i) => {
        matrixRows.push([
            ...fields.map(([k]) => k === 'serial' ? String(i + 1) : String(r[k] || '')),
            ...cols.map(followCellText)
        ]);
    });

    for (let i = 0; i < state.prefs.extra; i++) {
        matrixRows.push([
            ...fields.map(([k]) => k === 'serial' ? String(group.rows.length + i + 1) : ''),
            ...cols.map(followCellText)
        ]);
    }

    return matrixRows;
}

function matrix() {
    prefsFromUI();
    const groups = followGroups(followRows()).filter(g => g.rows.length);
    return groups.length ? followGroupMatrix(groups[0]) : [];
}

function xmlEsc(v) {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function excelSheetName(value, index) {
    const cleanName = clean(value)
        .replace(/[\\/:*?\[\]]/g, '-')
        .slice(0, 28);
    return cleanName || `كشف ${index + 1}`;
}

function exportFollow() {
    prefsFromUI();
    const groups = followGroups(followRows()).filter(g => g.rows.length);

    if (!groups.length) {
        toast('لا يوجد طلاب ضمن نطاق الكشف الحالي.', 'err');
        return;
    }

    const worksheets = groups.map((group, index) => {
        const rows = followGroupMatrix(group);
        const meta = followMeta(group, state.prefs);
        const tableRows = [
            [state.prefs.title],
            [meta],
            ...rows
        ];

        return `
            <Worksheet ss:Name="${xmlEsc(excelSheetName(group.label, index))}">
                <Table>
                    ${tableRows.map((row, ri) => `
                        <Row>
                            ${row.map(v => `<Cell ss:StyleID="${ri < 2 ? 'Meta' : (ri === 2 ? 'Head' : 'Text')}"><Data ss:Type="String">${xmlEsc(v)}</Data></Cell>`).join('')}
                        </Row>
                    `).join('')}
                </Table>
            </Worksheet>
        `;
    }).join('');

    const workbook = `<?xml version="1.0"?>
        <?mso-application progid="Excel.Sheet"?>
        <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
            xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
            <Styles>
                <Style ss:ID="Text"><Alignment ss:Horizontal="Center"/><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/></Borders></Style>
                <Style ss:ID="Head"><Font ss:Bold="1"/><Alignment ss:Horizontal="Center"/><Interior ss:Color="#DFF4F1" ss:Pattern="Solid"/></Style>
                <Style ss:ID="Meta"><Font ss:Bold="1"/><Alignment ss:Horizontal="Right"/></Style>
            </Styles>
            ${worksheets}
        </Workbook>`;

    blobDownload(
        new Blob(['\uFEFF', workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }),
        fileName(groups.length > 1 ? 'كشوف-متابعة-حسب-الفصول' : 'كشف-متابعة', 'xls')
    );
}

async function copyFollow() {
    prefsFromUI();
    const groups = followGroups(followRows()).filter(g => g.rows.length);

    if (!groups.length) return;

    const text = groups.map(group => [
        `# ${group.label}`,
        ...followGroupMatrix(group).map(row => row.join('\t'))
    ].join('\n')).join('\n\n');

    try {
        await navigator.clipboard.writeText(text);
        toast('تم نسخ كشوف المتابعة.');
    }
    catch {
        toast('تعذر النسخ.', 'err');
    }
}

async function copyFollowNames(grouped = false) {
    prefsFromUI();
    const rows = followRows();
    const groups = followGroups(rows).filter(g => g.rows.length);

    if (!rows.length) return;

    const text = grouped
        ? groups.map(group => `${group.label}\n${group.rows.map(r => r.name).join('\n')}`).join('\n\n')
        : rows.map(r => r.name).join('\n');

    try {
        await navigator.clipboard.writeText(text);
        toast(grouped ? 'تم نسخ الأسماء مجمعة حسب الفصول.' : 'تم نسخ أسماء النطاق.');
    }
    catch {
        toast('تعذر النسخ.', 'err');
    }
}

function applyFollowTemplate() {
    const value = ui.tpl.value;

    if (value.startsWith('saved:')) {
        const id = value.slice(6);
        const tpl = followTemplatesLoad().find(x => x.id === id);
        if (!tpl) return;

        if (tpl.title) ui.ftitle.value = tpl.title;
        if (Array.isArray(tpl.follow)) ui.fcols.value = tpl.follow.join('\n');
        if (tpl.orientation) ui.forient.value = tpl.orientation;
        if (tpl.cellMode) ui.fcellmode.value = tpl.cellMode;
        if (Number(tpl.rowsPerPage)) ui.frowsperpage.value = tpl.rowsPerPage;

        if (Array.isArray(tpl.fields)) {
            ui.fields.querySelectorAll('[data-f]').forEach(box => {
                box.checked = box.dataset.f === 'serial' || tpl.fields.includes(box.dataset.f);
            });
        }
    }
    else if (value !== 'custom') {
        ui.fcols.value = (TPL[value] || []).join('\n');
        const meta = TPL_META[value];
        if (meta?.title) ui.ftitle.value = meta.title;
        if (meta?.cellMode) ui.fcellmode.value = meta.cellMode;
    }

    ui.fdeletetpl.disabled = !value.startsWith('saved:');
    renderFollow();
}

function saveFollowTemplate() {
    prefsFromUI();
    const name = clean(prompt('اسم القالب الجديد:', state.prefs.title || 'قالب متابعة'));
    if (!name) return;

    const items = followTemplatesLoad();
    const id = `tpl-${Date.now()}`;

    items.push({
        id,
        name,
        title: state.prefs.title,
        follow: [...state.prefs.follow],
        fields: [...state.prefs.fields],
        orientation: state.prefs.orientation,
        cellMode: state.prefs.followCellMode,
        rowsPerPage: state.prefs.followRowsPerPage
    });

    followTemplatesSave(items);
    refreshFollowTemplateOptions(`saved:${id}`);
    toast('تم حفظ قالب المتابعة محليًا.');
}

function deleteFollowTemplate() {
    const value = ui.tpl.value;
    if (!value.startsWith('saved:')) return;

    const id = value.slice(6);
    const items = followTemplatesLoad();
    const target = items.find(x => x.id === id);
    if (!target) return;

    if (!confirm(`حذف القالب المحفوظ «${target.name}»؟`)) return;

    followTemplatesSave(items.filter(x => x.id !== id));
    refreshFollowTemplateOptions('custom');
    toast('تم حذف القالب المحفوظ.');
}

// =========================================================
// تصدير البيانات
// =========================================================

function csvCell(
    v
) {

    let x =
        String(
            v
            ??
            ''
        );

    if (
        /^[=+\-@\t\r]/
            .test(
                x
            )
    ) {

        x =
            "'" +
            x;
    }

    return (
        `"${x.replace(
            /"/g,
            '""'
        )}"`
    );
}

function csv(
    rows
) {

    const cols =
        visibleCols();

    const lines = [
        cols
            .map(
                x =>
                    csvCell(
                        x[1]
                    )
            )
            .join(',')
    ];

    rows.forEach(
        r =>
            lines.push(
                cols
                    .map(
                        (
                            [
                                k
                            ]
                        ) =>
                            csvCell(
                                r[k]
                            )
                    )
                    .join(',')
            )
    );

    return (
        '\uFEFF'
        +
        lines.join(
            '\r\n'
        )
    );
}

function exportCsv(
    rows,
    label = 'بيانات-الطلاب'
) {

    if (
        !rows.length
    ) {
        return;
    }

    textDownload(
        csv(
            rows
        ),
        fileName(
            label,
            'csv'
        ),
        'text/csv;charset=utf-8'
    );
}

async function copyRows() {

    const cols = visibleCols();

    if (!state.filtered.length) return;

    const textColumns = new Set([
        'civilId',
        'studentAccount',
        'studentPhone',
        'guardianPhone'
    ]);

    const plain = [
        cols.map(x => x[1]).join('\t'),
        ...state.filtered.map(r =>
            cols.map(([k]) => String(r[k] || '')).join('\t')
        )
    ].join('\n');

    const html = `
        <html dir="rtl">
        <head><meta charset="utf-8"></head>
        <body>
            <table>
                <thead>
                    <tr>${cols.map(x => `<th>${esc(x[1])}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${state.filtered.map(r =>
                        '<tr>'
                        + cols.map(([k]) => {
                            const style = textColumns.has(k)
                                ? ' style="mso-number-format:\\@;"'
                                : '';
                            return `<td${style}>${esc(r[k] || '')}</td>`;
                        }).join('')
                        + '</tr>'
                    ).join('')}
                </tbody>
            </table>
        </body>
        </html>
    `;

    try {
        if (window.ClipboardItem && navigator.clipboard?.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/plain': new Blob([plain], { type: 'text/plain' }),
                    'text/html': new Blob([html], { type: 'text/html' })
                })
            ]);
        }
        else {
            await navigator.clipboard.writeText(plain);
        }

        toast('تم النسخ إلى Excel مع المحافظة على الأصفار في بداية الأرقام.');
    }
    catch {
        toast('تعذر النسخ.', 'err');
    }
}

async function byClass() {

    for (const [key, , label] of classStats()) {

        exportCsv(
            state.rows.filter(r => classGroupKey(r) === key),
            `الفصل_${label}`
        );

        await wait(300);
    }
}

// =========================================================
// تشغيل من الواجهات الرئيسية والتنقل النظامي عبر قوائم الموقع
// =========================================================

function saveLaunchIntent(mode, extra = {}) {
    try {
        const previous = loadLaunchIntent(false) || {};
        sessionStorage.setItem(
            LAUNCH_INTENT,
            JSON.stringify({
                ...previous,
                ...extra,
                platform: PLATFORM,
                mode,
                at: Date.now(),
                attempts: Number(extra.attempts ?? previous.attempts ?? 0)
            })
        );
    }
    catch {}
}

function loadLaunchIntent(cleanExpired = true) {
    try {
        const raw = sessionStorage.getItem(LAUNCH_INTENT);
        if (!raw) return null;
        const intent = JSON.parse(raw);
        if (
            cleanExpired &&
            (!intent || Date.now() - Number(intent.at || 0) > 5 * 60 * 1000)
        ) {
            sessionStorage.removeItem(LAUNCH_INTENT);
            return null;
        }
        return intent;
    }
    catch {
        return null;
    }
}

function clearLaunchIntent() {
    try {
        sessionStorage.removeItem(LAUNCH_INTENT);
    }
    catch {}
}

function routeSignature(el) {
    if (!el) return '';
    const attrs = [
        'href',
        'onclick',
        'data-menu-url',
        'data-url',
        'data-href',
        'routerlink',
        'ng-reflect-router-link',
        'formaction'
    ];
    return [
        clean(el.textContent),
        ...attrs.map(name => clean(el.getAttribute?.(name)))
    ].join(' | ');
}

function clickableElements() {
    return [...document.querySelectorAll(
        'a,button,input[type=button],input[type=submit],[role=button],[onclick],[data-menu-url],[routerlink],[ng-reflect-router-link]'
    )].filter(el => el !== launcher && elementVisible(el));
}

function clickSiteElement(el) {
    if (!el) return false;

    try {
        el.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
    catch {}

    try {
        el.click();
        return true;
    }
    catch {}

    try {
        el.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
        }));
        return true;
    }
    catch {
        return false;
    }
}

function findExactTargetNavigation() {
    const items = clickableElements();

    if (PLATFORM === 'noor') {
        return items.find(el =>
            /StudntNamesReport(?:V2)?\.aspx/i.test(routeSignature(el))
        ) || items.find(el => {
            const text = norm(el.textContent);
            return (
                text.includes(norm('كشف بأسماء الطلاب')) ||
                text.includes(norm('أسماء الطلاب بالفصل')) ||
                text === norm('أسماء الطلاب')
            );
        }) || null;
    }

    return items.find(el =>
        /SchoolManagmentReports\/StudentInfo\/ClassStudentInfo/i.test(routeSignature(el))
    ) || items.find(el => {
        const text = norm(el.textContent);
        return (
            text.includes(norm('بيانات الطلاب')) ||
            text.includes(norm('معلومات الطلاب')) ||
            text.includes(norm('بيانات الطالب'))
        );
    }) || null;
}

function findNavigationStep() {
    const exact = findExactTargetNavigation();
    if (exact) {
        return {
            element: exact,
            label: 'شاشة بيانات الطلاب',
            kind: 'target'
        };
    }

    const items = clickableElements();

    if (PLATFORM === 'noor') {
        const reports = items.find(el => {
            const sig = routeSignature(el);
            const text = norm(el.textContent);
            return (
                /TeacherReportsMenu\.aspx/i.test(sig) ||
                text === norm('التقارير')
            );
        });

        if (reports) {
            return {
                element: reports,
                label: 'التقارير',
                kind: 'intermediate'
            };
        }

        const students = items.find(el =>
            norm(el.textContent) === norm('الطلاب')
        );

        if (students) {
            return {
                element: students,
                label: 'الطلاب',
                kind: 'intermediate'
            };
        }

        return null;
    }

    const priorities = [
        'التقارير والإحصائيات',
        'التقارير',
        'تقارير الطلاب',
        'إدارة الطلاب',
        'الطلاب'
    ];

    for (const label of priorities) {
        const item = items.find(el => {
            const text = norm(el.textContent);
            return text === norm(label) || text.includes(norm(label));
        });

        if (item) {
            return {
                element: item,
                label,
                kind: 'intermediate'
            };
        }
    }

    return null;
}

let navigationBusy = false;
let navigationLastClickAt = 0;

async function continueSiteNavigation(intent = loadLaunchIntent()) {
    if (!intent || intent.platform !== PLATFORM) return false;

    if (navigationBusy || Date.now() - navigationLastClickAt < 900) {
        return false;
    }

    if (isTargetPage()) {
        return true;
    }

    const attempts = Number(intent.attempts || 0);
    if (attempts >= 8) {
        clearLaunchIntent();
        open();
        status('تعذر الوصول إلى شاشة الطلاب عبر القوائم المتاحة بعد عدة محاولات. لم يتم فتح أي رابط داخلي مباشر.');
        toast('تعذر العثور على مسار تنقل نظامي لشاشة الطلاب.', 'err');
        return false;
    }

    await wait(450);

    const step = findNavigationStep();
    if (!step) {
        open();
        status('زر راصد لم يجد حاليًا عنصرًا نظاميًا يقود إلى شاشة الطلاب. افتح القائمة الرئيسية/التقارير ثم اضغط راصد مرة أخرى.');
        toast('لم يظهر مسار شاشة الطلاب في القائمة الحالية.', 'err');
        return false;
    }

    saveLaunchIntent(intent.mode, {
        attempts: attempts + 1,
        lastStep: step.label,
        lastPath: location.pathname
    });

    status(`الانتقال عبر قائمة «${step.label}»...`);

    navigationBusy = true;
    navigationLastClickAt = Date.now();

    if (!clickSiteElement(step.element)) {
        navigationBusy = false;
        open();
        status(`تعذر الضغط على عنصر «${step.label}».`);
        toast('تعذر تنفيذ التنقل النظامي.', 'err');
        return false;
    }

    // بعض واجهات مدرستي تغيّر المحتوى دون إعادة تحميل كاملة.
    setTimeout(() => {
        navigationBusy = false;
        const nextIntent = loadLaunchIntent();
        if (nextIntent && !isTargetPage()) {
            continueSiteNavigation(nextIntent);
        }
        else if (nextIntent && isTargetPage()) {
            resumeLaunchIntent();
        }
    }, 1400);

    return true;
}

function launcherAction() {
    // زر راصد يفتح الواجهة فقط. بدء الاستخراج قرار صريح من المستخدم
    // عبر «بدء الاستخراج» أو «استخراج المدرسة كاملة».
    open();

    if (!state.rows.length) {
        tab('extract');
    }
}

async function resumeLaunchIntent() {
    const intent = loadLaunchIntent();
    if (!intent || intent.platform !== PLATFORM) return;

    if (!isTargetPage()) {
        await continueSiteNavigation(intent);
        return;
    }

    clearLaunchIntent();
    open();

    if (PLATFORM === 'madrasati') {
        const started = Date.now();

        while (!madTable(document) && Date.now() - started < 20000) {
            status('تم الوصول إلى شاشة بيانات الطلاب — بانتظار تحميل الجدول...');
            await wait(400);
        }

        if (!madTable(document)) {
            status('تم الوصول إلى شاشة مدرستي، لكن جدول الطلاب لم يكتمل بعد. اضغط راصد مرة أخرى بعد اكتمال الصفحة.');
            toast('جدول الطلاب لم يكتمل بعد.', 'err');
            return;
        }

        extractMad();
        return;
    }

    const started = Date.now();

    while (!nrControlsReady() && Date.now() - started < 20000) {
        status('تم الوصول إلى شاشة الطلاب — بانتظار تحميل قوائم نور...');
        await wait(400);
    }

    if (!nrControlsReady()) {
        status('تم الوصول إلى صفحة نور، لكن قوائم الصف والفصل لم تكتمل. اضغط راصد مرة أخرى بعد اكتمال الصفحة.');
        toast('تعذر بدء الاستخراج قبل اكتمال قوائم نور.', 'err');
        return;
    }

    if (intent.mode === 'current') {
        nrStart();
    }
    else {
        nrSchoolStart();
    }
}

// v2.0.0: السكربت لا يعمل إلا داخل صفحات الطلاب المطلوبة (ومنها نور V2)، لذلك لا يراقب بقية صفحات الموقع.
clearLaunchIntent();

// =========================================================
// الأحداث
// =========================================================

launcher.onclick =
    launcherAction;

ui.close.onclick =
    close;

ui.about.onclick =
    () =>
        alert(
            `راصد الطلاب v${VERSION}\n`
            +
            `تصميم وتطوير: ${DEV.name} (${DEV.handle})\n`
            +
            '© 2026 جميع الحقوق محفوظة.'
        );

$$('.tab')
    .forEach(
        b =>
            b.onclick =
                () =>
                    tab(
                        b.dataset.tab
                    )
    );

ui.start.onclick =
    () =>
        PLATFORM ===
        'madrasati'
            ?
            extractMad()
            :
            nrStart();

ui.schoolstart.onclick =
    () =>
        nrSchoolStart();

ui.cancel.onclick =
    () => {

        if (
            PLATFORM ===
            'madrasati'
        ) {

            state.cancel =
                true;

            status(
                'جارٍ الإيقاف...'
            );
        }
        else {

            clearNoorJob();

            running(
                false
            );

            status(
                'تم الإلغاء.'
            );
        }
    };

ui.clear.onclick =
    clearAll;

ui.timelinestudent.onchange =
    () => {
        ui.timelineview.disabled = ui.timelinestudent.value === '';
        renderTimeline();
    };

ui.timelineview.onclick =
    renderTimeline;

ui.timelineclear.onclick =
    clearTimelineHistory;

ui.identityclear.onclick =
    clearManualIdentityLinks;

ui.search.oninput =
    filtered;

ui.classfilter.onchange =
    filtered;

ui.accountfilter.onchange =
    filtered;

ui.save.onclick =
    saveSnapshot;

ui.save2.onclick =
    saveSnapshot;

ui.import.onclick =
    () =>
        ui.snapfile.click();

ui.import2.onclick =
    () =>
        ui.snapfile.click();

ui.snapfile.onchange =
    () =>
        importSnapshot(
            ui.snapfile.files?.[0]
        );

ui.diffexp.onclick =
    exportDiff;

ui.diffexp2.onclick =
    exportDiff;

ui.cmpclear.onclick =
    clearCompare;

ui.back1.onclick =
    () =>
        tab(
            'extract'
        );

ui.tofollow.onclick =
    () =>
        tab(
            'follow'
        );

ui.back2.onclick =
    () =>
        tab(
            'review'
        );

ui.toexport.onclick =
    () =>
        tab(
            'export'
        );

ui.editfollow.onclick =
    () =>
        tab(
            'follow'
        );

ui.applytpl.onclick =
    applyFollowTemplate;

ui.tpl.onchange =
    () => {
        ui.fdeletetpl.disabled = !ui.tpl.value.startsWith('saved:');
    };

ui.fsavetpl.onclick =
    saveFollowTemplate;

ui.fdeletetpl.onclick =
    deleteFollowTemplate;

ui.gencols.onclick =
    () => {

        const n = Math.max(1, Math.min(30, Number(ui.fcount.value) || 5));
        const p = clean(ui.fprefix.value) || 'متابعة';
        const type = ui.fcellmode.value && ui.fcellmode.value !== 'blank'
            ? `|${ui.fcellmode.value}`
            : '';

        ui.fcols.value = Array.from({ length: n }, (_, i) => `${p} ${i + 1}${type}`).join('\n');
        renderFollow();
    };

ui.refresh.onclick =
    renderFollow;

ui.fscope.onchange =
    renderFollow;

ui.fgradefilter.onchange =
    () => {
        state.prefs.followGrade = ui.fgradefilter.value || '';
        state.prefs.followClasses = [];
        refreshFollowControls();
        renderFollow();
    };

ui.fclassfilter.onchange =
    renderFollow;

ui.fclassall.onclick =
    () => {
        [...ui.fclassfilter.options].forEach(o => o.selected = false);
        renderFollow();
    };

ui.fsort.onchange =
    renderFollow;

ui.fgroup.onchange =
    renderFollow;

ui.fsearch.oninput =
    renderFollow;

ui.fperclass.onchange =
    renderFollow;

ui.frepeathead.onchange =
    renderFollow;

ui.fcellmode.onchange =
    renderFollow;

ui.frowsperpage.onchange =
    renderFollow;

ui.fselectall.onclick =
    () => {
        followCandidateRows().forEach(row => state.followSelection.add(followRowKey(row)));
        state.followSelectionTouched = true;
        ui.fscope.value = 'selected';
        renderFollow();
    };

ui.fselectnone.onclick =
    () => {
        state.followSelection.clear();
        state.followSelectionTouched = true;
        ui.fscope.value = 'selected';
        renderFollow();
    };

ui.fselectinvert.onclick =
    () => {
        followCandidateRows().forEach(row => {
            const key = followRowKey(row);
            if (state.followSelection.has(key)) state.followSelection.delete(key);
            else state.followSelection.add(key);
        });
        state.followSelectionTouched = true;
        ui.fscope.value = 'selected';
        renderFollow();
    };

ui.fcopynames.onclick =
    () => copyFollowNames(false);

ui.fcopygroups.onclick =
    () => copyFollowNames(true);

[
    ui.ftitle,
    ui.fteacher,
    ui.fschool,
    ui.fgrade,
    ui.fclass,
    ui.fyear,
    ui.fperiod,
    ui.fcols,
    ui.fextra,
    ui.forient
]
    .forEach(x => x.onchange = renderFollow);

ui.print.onclick =
    printFollow;

ui.print2.onclick =
    printFollow;

ui.xls.onclick =
    exportFollow;

ui.xls2.onclick =
    exportFollow;

ui.copyfollow.onclick =
    copyFollow;

ui.csv.onclick =
    () =>
        exportCsv(
            state.filtered
        );

ui.copy.onclick =
    copyRows;

ui.byclass.onclick =
    byClass;

document.addEventListener(
    'keydown',
    e => {

        if (
            e.key ===
            'Escape'
        ) {

            close();
        }
    }
);

// =========================================================
// بدء التشغيل
// =========================================================

prefsToUI();
renderFields();
refreshFollowTemplateOptions();
refreshFollowControls();
renderFollow();
renderTop();
renderClassStats();
renderScopeAudit();
renderTimelineSelector();
renderTimeline();

enable(
    false
);

let restoredNoorResult = false;
const pendingNoorJob = PLATFORM === 'noor'
    ? loadNoorJob()
    : null;

if (PLATFORM === 'noor' && !pendingNoorJob?.active) {
    const cachedResult = loadNoorResult();

    if (cachedResult?.rows?.length) {
        afterExtract(
            cachedResult.rows,
            Number(cachedResult.pages) || 1,
            cachedResult.scope || emptyScope(),
            cachedResult.audit || null,
            { archive: false }
        );
        restoredNoorResult = true;
    }
}

status(
    pendingNoorJob?.active
        ? (
            pendingNoorJob.mode === 'school'
                ? `استئناف استخراج المدرسة كاملة — الصف ${Number(pendingNoorJob.gradeIndex || 0) + 1}/${pendingNoorJob.grades?.length || 0}.`
                : 'استئناف استخراج التقرير الحالي...'
        )
        : (
            restoredNoorResult
                ? `تمت استعادة آخر نتيجة مكتملة — ${state.rows.length} طالب. اضغط راصد لعرضها أو ابدأ استخراجًا جديدًا.`
                : (
                    PLATFORM === 'madrasati'
                        ? 'جاهز. اضغط راصد ثم اختر «بدء الاستخراج» عند الحاجة.'
                        : 'جاهز. اضغط راصد ثم اختر «بدء الاستخراج» للتقرير الحالي أو «استخراج المدرسة كاملة».'
                )
        )
);

if (
    PLATFORM ===
    'noor'
) {

    try {

        window.Sys
            ?.WebForms
            ?.PageRequestManager
            ?.getInstance()
            ?.add_endRequest(
                () => {
                    nrEndRequestAt = Date.now();
                    setTimeout(
                        tickNoor,
                        80
                    );
                }
            );
    }
    catch {}

    const j =
        pendingNoorJob
        ||
        loadNoorJob();

    if (
        j?.active
    ) {

        open();

        running(
            true
        );

        status(
            j.mode === 'school'
                ? `استئناف استخراج المدرسة كاملة — الصف ${Number(j.gradeIndex || 0) + 1}/${j.grades?.length || 0}.`
                : 'استئناف استخراج التقرير الحالي...'
        );

        tickNoor();
    }

    setInterval(
        tickNoor,
        300
    );
}

window.M0HM3D85StudentRasid = {

    version:
        VERSION,

    platform:
        PLATFORM,

    state,

    open,

    extract:
        () =>
            PLATFORM ===
            'madrasati'
                ?
                extractMad()
                :
                nrStart(),

    saveSnapshot,

    exportDiff,

    renderTimeline,

    clearTimelineHistory,

    clearManualIdentityLinks,

    extractSchool:
        () =>
            PLATFORM === 'noor'
                ? nrSchoolStart()
                : extractMad()
};

console.log(
    `راصد الطلاب v${VERSION} | ${PLATFORM_LABEL} | ${DEV.handle}`
);

})();
