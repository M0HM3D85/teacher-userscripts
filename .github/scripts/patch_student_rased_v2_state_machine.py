from pathlib import Path
import subprocess

JS = Path('scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js')
CHANGELOG = Path('scripts/student-rased-madrasati-noor/CHANGELOG.md')

text = JS.read_text(encoding='utf-8')

old = '''function nrReady() {
    return !!(nrRoot() && nrCurEl() && nrTotEl());
}

function nrCur() {
    const n = Number(clean(nrCurEl()?.value || nrCurEl()?.textContent));
    return n > 0 ? n : 1;
}

function nrTot() {
    const n = Number(clean(nrTotEl()?.textContent || nrTotEl()?.value));
    return n > 0 ? n : 1;
}
'''
new = '''function nrCurRaw() {
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
    return Date.now() - Number(actionAt || 0) >= 1400;
}
'''
assert old in text, 'nrReady block not found'
text = text.replace(old, new, 1)

old = '''    if (job.phase === 'waitGrade') {

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

        if (Date.now() - job.actionAt < 650) return;

        job.phase = 'discoverSections';
        job.retries = 0;
        saveNoorJob(job);
    }
'''
new = '''    if (job.phase === 'waitGrade') {

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
'''
assert old in text, 'waitGrade block not found'
text = text.replace(old, new, 1)

old = '''    if (job.phase === 'selectSection') {

        if (job.sectionIndex >= job.sections.length) {
            job.phase = 'prepareVerify';
            saveNoorJob(job);
        }
        else {
            const section = job.sections[job.sectionIndex];
            job.currentSection = section;

            if (!nrSetSelectValue(nrSectionEl(), section.value)) {
                nrFail(job, `تعذر اختيار الفصل ${section.text} في ${targetGrade.text}.`);
                return;
            }

            job.phase = 'showSection';
            saveNoorJob(job);
        }
    }

    if (job.phase === 'showSection') {
'''
new = '''    if (job.phase === 'selectSection') {

        if (job.sectionIndex >= job.sections.length) {
            job.phase = 'prepareVerify';
            saveNoorJob(job);
            return;
        }

        const section = job.sections[job.sectionIndex];
        job.currentSection = section;

        const sectionEl = nrSectionEl();

        if (String(sectionEl?.value) === String(section.value)) {
            job.phase = 'showSection';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
            return;
        }

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
'''
assert old in text, 'selectSection block not found'
text = text.replace(old, new, 1)

old = '''    if (job.phase === 'prepareVerify') {

        const all = nrAllSectionOption();
        const summary = nrGradeSummary(job);

        if (!all) {
            summary.verified = false;
            nrPrepareNextGrade(job);
            return;
        }

        if (!nrSetSelectValue(nrSectionEl(), all.value)) {
            nrFail(job, `تعذر اختيار «الكل» للتحقق من ${targetGrade.text}.`);
            return;
        }

        job.currentSection = all;
        job.phase = 'showVerify';
        saveNoorJob(job);
    }

    if (job.phase === 'showVerify') {
'''
new = '''    if (job.phase === 'prepareVerify') {

        const all = nrAllSectionOption();
        const summary = nrGradeSummary(job);

        if (!all) {
            summary.verified = false;
            nrPrepareNextGrade(job);
            return;
        }

        job.currentSection = all;
        const sectionEl = nrSectionEl();

        if (String(sectionEl?.value) === String(all.value)) {
            job.phase = 'showVerify';
            job.actionAt = 0;
            job.retries = 0;
            saveNoorJob(job);
            return;
        }

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
'''
assert old in text, 'prepareVerify block not found'
text = text.replace(old, new, 1)

old = '''            const rows = nrRows();

            if (!rows.length) return false;

            const fp = stableStringify(rows.map(x => ({
'''
new = '''            const rows = nrRows();

            // إذا كان التقرير نفسه جاهزًا وجدوله موجودًا، فالصفحة الفارغة
            // حالة صحيحة وليست سببًا للبقاء في انتظار لا نهائي.
            if (!rows.length && !nrTable()) return false;

            const fp = stableStringify(rows.map(x => ({
'''
assert old in text, 'nrTickReport rows block not found'
text = text.replace(old, new, 1)

changelog = CHANGELOG.read_text(encoding='utf-8')
marker = '## [2.0.0] — دعم نور V2 ومحرك نور الموحّد\n'
addition = (
    '\n- إعادة ضبط آلة حالات نور V2 وفق التتبع الفعلي للصفحة: تغيير الصف/الفصل ينتظر PostBack الخاص بالقائمة، وزر «عرض» يُعامل كـ Full PostBack، ولا تبدأ قراءة ReportViewer حتى تصبح `CurrentPage` و`TotalPages` أرقامًا موجبة فعلًا.\n'
    '- منع الضغط على «عرض» مباشرة بعد تغيير الفصل أو «الكل»، وهو سباق كان يؤدي إلى بقاء العدادات صفرًا في V2.\n'
)
assert marker in changelog
if addition.strip() not in changelog:
    changelog = changelog.replace(marker, marker + addition, 1)
CHANGELOG.write_text(changelog, encoding='utf-8')

JS.write_text(text, encoding='utf-8')
subprocess.run(['node', '--check', str(JS)], check=True)

checks = [
    'function nrCurRaw()',
    'function nrSelectPostBackSettled(',
    "job.phase = 'waitSectionChoice';",
    "job.phase = 'waitVerifyChoice';",
    '&& nrCurRaw() > 0',
    '&& nrTotRaw() > 0',
]
for item in checks:
    assert item in text, item

print('Noor V2 state machine patch applied and syntax checked')
# trigger workflow after workflow file exists
