from pathlib import Path
import re
import subprocess

JS = Path('scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js')
CHANGELOG = Path('scripts/student-rased-madrasati-noor/CHANGELOG.md')

text = JS.read_text(encoding='utf-8')

old = "const NOOR_RESULT = `${APP}-noor-result-v1`;"
new = "const NOOR_RESULT = `${APP}-noor-result-v2`;"
assert old in text, 'NOOR_RESULT constant not found'
text = text.replace(old, new, 1)

pattern = re.compile(
    r"function saveNoorResult\(rows, pages, scope, audit\) \{.*?\n\}\n\nfunction loadNoorResult\(\) \{.*?\n\}\n\nfunction clearNoorResult\(\) \{.*?\n\}\n",
    re.S,
)
replacement = r'''function saveNoorResult(rows, pages, scope, audit) {
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
'''
text, count = pattern.subn(replacement, text, count=1)
assert count == 1, f'result persistence block replacements: {count}'

old = """function clearAll() {\n\n    if (PLATFORM === 'noor') {\n        clearNoorResult();\n    }"""
new = """function clearAll(options = {}) {\n\n    if (PLATFORM === 'noor' && !options.preserveNoorResult) {\n        clearNoorResult();\n    }"""
assert old in text, 'clearAll header not found'
text = text.replace(old, new, 1)

old = """    clearNoorResult();\n    clearAll();\n\n    const job = {\n        active: true,\n        mode: 'current',"""
new = """    clearNoorResult();\n    clearAll({ preserveNoorResult: true });\n\n    const job = {\n        active: true,\n        mode: 'current',"""
assert old in text, 'nrStart clear sequence not found'
text = text.replace(old, new, 1)

old = """    clearAll();\n\n    const studySystem = choice("""
new = """    clearAll({ preserveNoorResult: true });\n\n    const studySystem = choice("""
assert old in text, 'nrSchoolStart clearAll not found'
text = text.replace(old, new, 1)

pattern = re.compile(
    r"function nrPrepareNextGrade\(job\) \{.*?\n\}\n\nfunction nrVerifyGrade\(job, allRows\) \{",
    re.S,
)
replacement = r'''function nrPrepareNextGrade(job) {
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

function nrVerifyGrade(job, allRows) {'''
text, count = pattern.subn(replacement, text, count=1)
assert count == 1, f'nrPrepareNextGrade replacements: {count}'

old = """let restoredNoorResult = false;\n\nif (PLATFORM === 'noor') {\n    const cachedResult = loadNoorResult();"""
new = """let restoredNoorResult = false;\nconst pendingNoorJob = PLATFORM === 'noor'\n    ? loadNoorJob()\n    : null;\n\nif (PLATFORM === 'noor' && !pendingNoorJob?.active) {\n    const cachedResult = loadNoorResult();"""
assert old in text, 'startup result restore block not found'
text = text.replace(old, new, 1)

pattern = re.compile(
    r"status\(\n    restoredNoorResult\n        \? `تمت استعادة آخر نتيجة مكتملة — \$\{state\.rows\.length\} طالب\. اضغط راصد لعرضها أو ابدأ استخراجًا جديدًا\.`\n        : \(\n            PLATFORM === 'madrasati'\n                \? 'جاهز\. اضغط راصد ثم اختر «بدء الاستخراج» عند الحاجة\.'\n                : 'جاهز\. اضغط راصد ثم اختر «بدء الاستخراج» للتقرير الحالي أو «استخراج المدرسة كاملة»\.'\n        \)\n\);"
)
replacement = """status(\n    pendingNoorJob?.active\n        ? (\n            pendingNoorJob.mode === 'school'\n                ? `استئناف استخراج المدرسة كاملة — الصف ${Number(pendingNoorJob.gradeIndex || 0) + 1}/${pendingNoorJob.grades?.length || 0}.`\n                : 'استئناف استخراج التقرير الحالي...'\n        )\n        : (\n            restoredNoorResult\n                ? `تمت استعادة آخر نتيجة مكتملة — ${state.rows.length} طالب. اضغط راصد لعرضها أو ابدأ استخراجًا جديدًا.`\n                : (\n                    PLATFORM === 'madrasati'\n                        ? 'جاهز. اضغط راصد ثم اختر «بدء الاستخراج» عند الحاجة.'\n                        : 'جاهز. اضغط راصد ثم اختر «بدء الاستخراج» للتقرير الحالي أو «استخراج المدرسة كاملة».'\n                )\n        )\n);"""
text, count = pattern.subn(replacement, text, count=1)
assert count == 1, f'startup status replacements: {count}'

old = """    const j =\n        loadNoorJob();"""
new = """    const j =\n        pendingNoorJob\n        ||\n        loadNoorJob();"""
assert old in text, 'startup job load not found'
text = text.replace(old, new, 1)

old = """    if (\n        j?.active\n    ) {\n\n        open();\n\n        running(\n            true\n        );\n\n        tickNoor();\n    }"""
new = """    if (\n        j?.active\n    ) {\n\n        open();\n\n        running(\n            true\n        );\n\n        status(\n            j.mode === 'school'\n                ? `استئناف استخراج المدرسة كاملة — الصف ${Number(j.gradeIndex || 0) + 1}/${j.grades?.length || 0}.`\n                : 'استئناف استخراج التقرير الحالي...'\n        );\n\n        tickNoor();\n    }"""
assert old in text, 'startup active job block not found'
text = text.replace(old, new, 1)

JS.write_text(text, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
marker = "## [2.0.0] — دعم نور V2 ومحرك نور الموحّد\n"
assert marker in changelog
addition = (
    "\n- تقوية إنهاء استخراج المدرسة في V2: حفظ النتيجة في `sessionStorage` و`localStorage` معًا، وعدم حذفها عند إعادة تهيئة واجهة راصد، وإنهاء آخر صف فورًا قبل أي PostBack لاحق.\n"
    "- عند وجود مهمة نور نشطة بعد إعادة تحميل الصفحة، تعرض الواجهة حالة الاستئناف بدل رسالة «جاهز».\n"
)
if addition.strip() not in changelog:
    changelog = changelog.replace(marker, marker + addition, 1)
CHANGELOG.write_text(changelog, encoding='utf-8')

subprocess.run(['node', '--check', str(JS)], check=True)

checks = [
    "const NOOR_RESULT = `${APP}-noor-result-v2`;",
    "for (const storage of [sessionStorage, localStorage])",
    "function clearAll(options = {})",
    "clearAll({ preserveNoorResult: true });",
    "nrSchoolFinish(job);",
    "const pendingNoorJob = PLATFORM === 'noor'",
]
for item in checks:
    assert item in text, item

print('student-rased V2 result persistence fix applied and syntax checked')
# trigger workflow after workflow file exists
