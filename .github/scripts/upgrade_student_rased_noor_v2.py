from pathlib import Path
import re

JS = Path('scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js')
README = Path('scripts/student-rased-madrasati-noor/README.md')
CHANGELOG = Path('scripts/student-rased-madrasati-noor/CHANGELOG.md')


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected exactly 1 match, found {count}')
    return text.replace(old, new, 1)


js = JS.read_text(encoding='utf-8')

js = replace_once(js, '// @version      1.9.1', '// @version      2.0.0', 'metadata version')
js = replace_once(
    js,
    '// @description  راصد دقيق لبيانات الطلاب من صفحات الطلاب المطلوبة فقط في مدرستي ونور: استخراج دقيق، مدرسة نور كاملة، نسخ مقارنة ببصمة تحقق، مقارنة شاملة محافظة، سجل زمني، ومركز مراجعة يدوية.',
    '// @description  راصد دقيق لبيانات الطلاب من مدرستي ونور مع دعم واجهتي نور القديمة وV2: استخراج المدرسة كاملة، تدقيق الصفحات، نسخ مقارنة ببصمة تحقق، سجل زمني، ومراجعة يدوية للحالات الملتبسة.',
    'metadata description'
)

old_match = '// @match        https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReport.aspx*'
v2_match = '// @match        https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReportV2.aspx*'
if v2_match not in js:
    js = replace_once(js, old_match, old_match + '\n' + v2_match, 'Noor V2 match')

js = replace_once(js, "const VERSION = '1.9.1';", "const VERSION = '2.0.0';", 'runtime version')
js = replace_once(js, "const NOOR_JOB = `${APP}-noor-job-v3`;", "const NOOR_JOB = `${APP}-noor-job-v4`;", 'Noor job storage version')

platform_old = """const PLATFORM = location.hostname.includes('madrasati.sa') ? 'madrasati' : 'noor';
const PLATFORM_LABEL = PLATFORM === 'madrasati' ? 'مدرستي' : 'نور';
const HISTORY_KEY = `${APP}-timeline-v1-${PLATFORM}`;"""
platform_new = """const PLATFORM = location.hostname.includes('madrasati.sa') ? 'madrasati' : 'noor';
const PLATFORM_LABEL = PLATFORM === 'madrasati' ? 'مدرستي' : 'نور';
const NOOR_VIEW = PLATFORM === 'noor'
    ? (/\\/EduWavek12Portal\\/ReportPages\\/StudntNamesReportV2\\.aspx$/i.test(location.pathname) ? 'v2' : 'legacy')
    : '';
const NOOR_VIEW_LABEL = NOOR_VIEW === 'v2'
    ? 'نور V2'
    : (NOOR_VIEW === 'legacy' ? 'نور القديم' : '');
const HISTORY_KEY = `${APP}-timeline-v1-${PLATFORM}`;"""
js = replace_once(js, platform_old, platform_new, 'Noor view detector')

target_old = """const TARGET_PATH_RE = PLATFORM === 'madrasati'
    ? /\\/SchoolManagmentReports\\/StudentInfo\\/ClassStudentInfo\\/?/i
    : /\\/EduWavek12Portal\\/ReportPages\\/StudntNamesReport\\.aspx$/i;"""
target_new = """const TARGET_PATH_RE = PLATFORM === 'madrasati'
    ? /\\/SchoolManagmentReports\\/StudentInfo\\/ClassStudentInfo\\/?/i
    : /\\/EduWavek12Portal\\/ReportPages\\/StudntNamesReport(?:V2)?\\.aspx$/i;"""
js = replace_once(js, target_old, target_new, 'target path regex')

root_pattern = re.compile(r"function nrRoot\(\) \{.*?\n\}\n\nfunction nrCurEl\(\) \{", re.S)
root_replacement = """function nrRoot() {
    return document.querySelector('[id^=\"VisibleReportContent\"]')
        || document.querySelector('[role=\"main\"][id*=\"rvStudentDataName\"]')
        || document.getElementById('ctl00_PlaceHolderMain_rvStudentDataName_fixedTable')
        || document.querySelector('[id*=\"rvStudentDataName_fixedTable\"]');
}

function nrCurEl() {"""
js, count = root_pattern.subn(root_replacement, js, count=1)
if count != 1:
    raise SystemExit(f'nrRoot patch: expected 1 match, found {count}')

btn_pattern = re.compile(r"function nrBtn\(kind\) \{.*?\n\}\n\nfunction nrClick\(kind\) \{", re.S)
btn_replacement = """function nrBtn(kind) {

    const p = kind === 'first'
        ? '_First_ctl00'
        : '_Next_ctl00';

    const label = kind === 'first'
        ? 'الصفحة الأولى'
        : 'الصفحة التالية';

    const direct = [...document.querySelectorAll('[id*=\"rvStudentDataName\"]')]
        .find(e =>
            e.id.includes(p)
            && e.classList.contains('NormalButton')
            && e.getAttribute('aria-disabled') !== 'true'
        )
        || [...document.querySelectorAll('[role=\"button\"][aria-label]')]
            .find(e =>
                clean(e.getAttribute('aria-label')) === label
                && e.getAttribute('aria-disabled') !== 'true'
                && !e.disabled
            );

    if (direct) return direct;

    const wanted = kind === 'first'
        ? [norm('الصفحة الأولى'), norm('الأولى')]
        : [norm('الصفحة التالية'), norm('التالي')];

    return [...document.querySelectorAll('a,button,input,[role=\"button\"]')]
        .filter(e =>
            e.id.includes('rvStudentDataName')
            || e.closest?.('[id*=\"rvStudentDataName\"]')
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

function nrClick(kind) {"""
js, count = btn_pattern.subn(btn_replacement, js, count=1)
if count != 1:
    raise SystemExit(f'nrBtn patch: expected 1 match, found {count}')

all_pattern = re.compile(r"function nrAllSectionOption\(\) \{.*?\n\}\n\nfunction nrUpdateSelect2\(select\) \{", re.S)
all_replacement = """function nrAllSectionOption() {

    const select = nrSectionEl();

    if (!select) return null;

    // V2 تستخدم value=-99 أيضًا للحالة «-- لا يوجد --»؛
    // لذلك لا نعد الخيار «الكل» إلا إذا أكد نصه ذلك.
    const option = [...select.options].find(o =>
        /^--\\s*الكل\\s*--$/.test(clean(o.textContent))
        || norm(o.textContent) === norm('الكل')
    );

    return option
        ? {
            value: String(option.value),
            text: 'الكل'
        }
        : null;
}

function nrUpdateSelect2(select) {"""
js, count = all_pattern.subn(all_replacement, js, count=1)
if count != 1:
    raise SystemExit(f'nrAllSectionOption patch: expected 1 match, found {count}')

old_intro = "'في <b>نور</b>: «بدء الاستخراج» يقرأ التقرير الحالي، و«استخراج المدرسة كاملة» يمر تلقائيًا على الصفوف والفصول الفعلية ويثبت فصل كل طالب ثم يتحقق من كل صف بتقرير «الكل». زر راصد في أي صفحة رئيسية ينقلك تلقائيًا إلى هذه الشاشة ويبدأ الاستخراج الشامل.';"
new_intro = "`في <b>نور</b> — <b>${esc(NOOR_VIEW_LABEL || 'واجهة نور')}</b>: «بدء الاستخراج» يقرأ التقرير الحالي، و«استخراج المدرسة كاملة» يمر على الصفوف والفصول الفعلية ويثبت الصف والفصل من قوائم نور نفسها. يدعم راصد واجهة نور القديمة وواجهة V2 الحديثة بمحرك ReportViewer موحّد.`;"
js = replace_once(js, old_intro, new_intro, 'Noor intro')

js = js.replace('/StudntNamesReport\\.aspx/i.test(routeSignature(el))', '/StudntNamesReport(?:V2)?\\.aspx/i.test(routeSignature(el))')
js = js.replace('// v1.9.1: الزر موجود فقط في صفحات الطلاب المطلوبة، ولا ينفذ أي تنقل بين صفحات الموقع.', '// v2.0.0: الزر موجود فقط في صفحات الطلاب المطلوبة، ولا ينفذ أي تنقل بين صفحات الموقع.')
js = js.replace('// v1.9.1: السكربت لا يعمل إلا داخل صفحات الطلاب المطلوبة، لذلك أُلغي مراقب التنقل بين صفحات الموقع.', '// v2.0.0: السكربت لا يعمل إلا داخل صفحات الطلاب المطلوبة (ومنها نور V2)، لذلك لا يراقب بقية صفحات الموقع.')

current_audit_old = """    const audit = {
        complete: !conflicts.length,
        pageCount: job.report.total,"""
current_audit_new = """    const audit = {
        complete: !conflicts.length,
        sourceView: NOOR_VIEW,
        sourceViewLabel: NOOR_VIEW_LABEL,
        pageCount: job.report.total,"""
js = replace_once(js, current_audit_old, current_audit_new, 'current Noor audit view')

school_audit_old = """    const audit = {
        complete,
        pageCount: job.totalReportPages,"""
school_audit_new = """    const audit = {
        complete,
        sourceView: NOOR_VIEW,
        sourceViewLabel: NOOR_VIEW_LABEL,
        pageCount: job.totalReportPages,"""
js = replace_once(js, school_audit_old, school_audit_new, 'school Noor audit view')

for needle in [
    '// @version      2.0.0',
    'StudntNamesReportV2.aspx*',
    "const VERSION = '2.0.0';",
    "const NOOR_VIEW = PLATFORM === 'noor'",
    'StudntNamesReport(?:V2)?\\.aspx$',
    'sourceViewLabel: NOOR_VIEW_LABEL'
]:
    if needle not in js:
        raise SystemExit(f'missing expected result: {needle}')

JS.write_text(js, encoding='utf-8')

readme = README.read_text(encoding='utf-8')
readme = replace_once(readme, '**الإصدار الحالي:** `1.9.1`', '**الإصدار الحالي:** `2.0.0`', 'README version')
if 'StudntNamesReportV2.aspx*' not in readme:
    readme = readme.replace(
        '- `https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReport.aspx*`',
        '- `https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReport.aspx*` — واجهة نور السابقة\n- `https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReportV2.aspx*` — واجهة نور الحديثة V2'
    )
marker = '- دعم استخراج نطاق المدرسة في نور ضمن الصفحات المدعومة.'
addition = marker + '\n- دعم واجهتي نور القديمة وV2 تلقائيًا بمحرك استخراج موحّد، مع أخذ الصف والفصل من قوائم التصفية نفسها لا من رأس التقرير.'
if addition not in readme:
    readme = readme.replace(marker, addition)
README.write_text(readme, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
entry = """## [2.0.0] — دعم نور V2 ومحرك نور الموحّد

- إضافة صفحة نور الحديثة `StudntNamesReportV2.aspx` إلى الصفحات المدعومة رسميًا.
- توحيد استخراج نور القديم وV2 على نفس محرك ReportViewer بدل إنشاء منطقين منفصلين.
- إضافة اكتشاف تلقائي لواجهة نور وحفظها ضمن تدقيق الاستخراج دون إدخالها في هوية الطالب أو منع المقارنة بين الواجهتين.
- تقوية اكتشاف جذر ReportViewer مع دعم `rvStudentDataName_fixedTable` كمسار احتياطي في V2.
- تقوية التنقل بين صفحات ReportViewer ليتعامل مع عناصر V2 النصية مثل رابط «التالي».
- تصحيح اكتشاف خيار «الكل» للفصل: لم يعد `value=-99` وحده كافيًا لأن V2 تستخدم القيمة نفسها أيضًا للحالة «-- لا يوجد --».
- استمرار أخذ الصف والفصل من قوائم نور الفعلية أثناء الاستخراج، وعدم الاعتماد على النص المطبوع في رأس التقرير.
- إبقاء زر راصد مدمجًا ومحصورًا في صفحات الطلاب المدعومة فقط.

"""
if '## [2.0.0]' not in changelog:
    changelog = changelog.replace('## [1.9.1]', entry + '## [1.9.1]')
CHANGELOG.write_text(changelog, encoding='utf-8')
