from pathlib import Path

JS = Path('scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js')
CHANGELOG = Path('scripts/student-rased-madrasati-noor/CHANGELOG.md')

js = JS.read_text(encoding='utf-8')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)

# Session cache for the last completed Noor extraction. This protects the UI/result
# from a final full postback/reload in Noor V2.
js = replace_once(
    js,
    "const NOOR_JOB = `${APP}-noor-job-v4`;\nconst LAUNCH_INTENT = `${APP}-launch-intent-v2`;",
    "const NOOR_JOB = `${APP}-noor-job-v4`;\nconst NOOR_RESULT = `${APP}-noor-result-v1`;\nconst LAUNCH_INTENT = `${APP}-launch-intent-v2`;",
    'Noor result key'
)

js = replace_once(
    js,
    "function clearNoorJob() {\n    sessionStorage.removeItem(NOOR_JOB);\n}\n\nfunction nrSelect(suffix) {",
    """function clearNoorJob() {
    sessionStorage.removeItem(NOOR_JOB);
}

function saveNoorResult(rows, pages, scope, audit) {
    try {
        sessionStorage.setItem(
            NOOR_RESULT,
            JSON.stringify({
                version: 1,
                at: new Date().toISOString(),
                rows,
                pages,
                scope,
                audit
            })
        );
        return true;
    }
    catch {
        return false;
    }
}

function loadNoorResult() {
    try {
        const raw = sessionStorage.getItem(NOOR_RESULT);
        if (!raw) return null;
        const data = JSON.parse(raw);
        return data && data.version === 1 && Array.isArray(data.rows)
            ? data
            : null;
    }
    catch {
        return null;
    }
}

function clearNoorResult() {
    try {
        sessionStorage.removeItem(NOOR_RESULT);
    }
    catch {}
}

function nrSelect(suffix) {""",
    'Noor result helpers'
)

# Allow result restoration without writing the same extraction into the local timeline twice.
js = replace_once(
    js,
    """function afterExtract(
    rows,
    pages = 1,
    scope = null,
    audit = null
) {""",
    """function afterExtract(
    rows,
    pages = 1,
    scope = null,
    audit = null,
    options = {}
) {""",
    'afterExtract signature'
)

js = replace_once(
    js,
    """    archiveCurrentExtraction();

    fillClassFilter();""",
    """    if (options.archive !== false) {
        archiveCurrentExtraction();
    }

    fillClassFilter();""",
    'afterExtract archive guard'
)

# Clearing results also clears the session result cache.
js = replace_once(
    js,
    """function clearAll() {

    state.rows = [];""",
    """function clearAll() {

    if (PLATFORM === 'noor') {
        clearNoorResult();
    }

    state.rows = [];""",
    'clear cached Noor result'
)

# Explicit extraction buttons start a fresh result session.
js = replace_once(
    js,
    """    if (loadNoorJob()?.active) return;

    clearAll();

    const job = {
        active: true,
        mode: 'current',""",
    """    if (loadNoorJob()?.active) return;

    clearNoorResult();
    clearAll();

    const job = {
        active: true,
        mode: 'current',""",
    'current extraction clears cache'
)

js = replace_once(
    js,
    """    const grades = nrGradeOptions();

    if (!grades.length) {""",
    """    clearNoorResult();

    const grades = nrGradeOptions();

    if (!grades.length) {""",
    'school extraction clears cache'
)

# Persist completed results before clearing the job. If Noor reloads afterwards,
# startup can restore them and show the review table.
js = replace_once(
    js,
    """    clearNoorJob();
    running(false);
    afterExtract(rows, job.report.total, scope, audit);""",
    """    saveNoorResult(rows, job.report.total, scope, audit);
    clearNoorJob();
    running(false);
    afterExtract(rows, job.report.total, scope, audit);""",
    'save current report result'
)

js = replace_once(
    js,
    """    clearNoorJob();
    running(false);
    afterExtract(finalRows, job.totalReportPages, scope, audit);""",
    """    saveNoorResult(finalRows, job.totalReportPages, scope, audit);
    clearNoorJob();
    running(false);
    afterExtract(finalRows, job.totalReportPages, scope, audit);""",
    'save school result'
)

# Launcher must never start extraction automatically. It only opens the Rasid UI.
old_launcher = """function launcherAction() {
    // v2.0.0: الزر موجود فقط في صفحات الطلاب المطلوبة، ولا ينفذ أي تنقل بين صفحات الموقع.
    if (state.rows.length) {
        open();
        return;
    }

    open();

    if (PLATFORM === 'madrasati') {
        extractMad();
    }
    else {
        nrSchoolStart();
    }
}"""
new_launcher = """function launcherAction() {
    // زر راصد يفتح الواجهة فقط. بدء الاستخراج قرار صريح من المستخدم
    // عبر «بدء الاستخراج» أو «استخراج المدرسة كاملة».
    open();

    if (!state.rows.length) {
        tab('extract');
    }
}"""
js = replace_once(js, old_launcher, new_launcher, 'manual launcher behavior')

# Restore the last completed Noor result before showing the ready message.
old_startup = """enable(
    false
);

status(
    PLATFORM === 'madrasati'
        ? 'جاهز. زر راصد متاح في صفحة بيانات الطلاب فقط ويبدأ الاستخراج مباشرة.'
        : 'جاهز. زر راصد متاح في تقرير أسماء الطلاب فقط؛ يبدأ استخراج المدرسة كاملة، ويمكن استخدام «بدء الاستخراج» للتقرير الحالي.'
);

if (
    PLATFORM ===
    'noor'
) {"""
new_startup = """enable(
    false
);

let restoredNoorResult = false;

if (PLATFORM === 'noor') {
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
    restoredNoorResult
        ? `تمت استعادة آخر نتيجة مكتملة — ${state.rows.length} طالب. اضغط راصد لعرضها أو ابدأ استخراجًا جديدًا.`
        : (
            PLATFORM === 'madrasati'
                ? 'جاهز. اضغط راصد ثم اختر «بدء الاستخراج» عند الحاجة.'
                : 'جاهز. اضغط راصد ثم اختر «بدء الاستخراج» للتقرير الحالي أو «استخراج المدرسة كاملة».'
        )
);

if (
    PLATFORM ===
    'noor'
) {"""
js = replace_once(js, old_startup, new_startup, 'startup restore and ready text')

# Update one stale navigation-era intro sentence if it still exists elsewhere.
js = js.replace(
    'زر راصد في أي صفحة رئيسية ينقلك تلقائيًا إلى هذه الشاشة ويبدأ الاستخراج الشامل.',
    'زر راصد يفتح الواجهة فقط، والاستخراج يبدأ عند اختيارك لأحد زري الاستخراج.'
)

# Sanity markers.
required = [
    'const NOOR_RESULT = `${APP}-noor-result-v1`;',
    'function saveNoorResult(rows, pages, scope, audit)',
    'function launcherAction() {',
    "tab('extract');",
    'restoredNoorResult',
    '{ archive: false }'
]
for needle in required:
    if needle not in js:
        raise SystemExit(f'missing expected marker: {needle}')

JS.write_text(js, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
marker = '## [2.0.0] — دعم نور V2 ومحرك نور الموحّد\n'
addition = (
    marker
    + '\n- جعل زر «راصد الطلاب» يفتح الواجهة فقط دون بدء أي استخراج تلقائي؛ المستخدم يختار التقرير الحالي أو المدرسة كاملة بنفسه.\n'
    + '- إضافة حفظ مؤقت لآخر نتيجة نور مكتملة في نفس التبويب واستعادتها بعد إعادة تحميل V2، لمنع اختفاء جدول النتائج والرجوع إلى حالة «جاهز».\n'
)
if 'يفتح الواجهة فقط دون بدء أي استخراج تلقائي' not in changelog:
    changelog = changelog.replace(marker, addition, 1)
CHANGELOG.write_text(changelog, encoding='utf-8')
