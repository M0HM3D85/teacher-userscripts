from pathlib import Path
import subprocess

# one-time optimizer trigger
JS = Path('scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js')
CHANGELOG = Path('scripts/student-rased-madrasati-noor/CHANGELOG.md')

text = JS.read_text(encoding='utf-8')

text = text.replace(
    "return Date.now() - Number(actionAt || 0) >= 1400;",
    "return Date.now() - Number(actionAt || 0) >= 900;",
    1,
)

old = '''    if (nrAjaxBusy() || nrWait()) {
        status('نور يقوم بتحديث البيانات...');
        return;
    }
'''
new = '''    if (nrAjaxBusy()) {
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
'''
assert old in text, 'global wait block not found'
text = text.replace(old, new, 1)

old = '''    if (job.phase === 'selectSection') {

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
'''
assert old in text, 'prepareVerify block not found'
text = text.replace(old, new, 1)

text = text.replace(
    '''                    setTimeout(\n                        tickNoor,\n                        300\n                    );''',
    '''                    setTimeout(\n                        tickNoor,\n                        80\n                    );''',
    1,
)

text = text.replace(
    '''    setInterval(\n        tickNoor,\n        900\n    );''',
    '''    setInterval(\n        tickNoor,\n        300\n    );''',
    1,
)

changelog = CHANGELOG.read_text(encoding='utf-8')
marker = '## [2.0.0] — دعم نور V2 ومحرك نور الموحّد\n'
addition = (
    '\n- تحسين سرعة محرك نور: V1 عاد لمسار اختيار الفصل السريع الخاص بـ1.9.1، بينما يحتفظ V2 فقط بانتظار PostBack المطلوب.\n'
    '- حصر انتظار ReportViewer في مراحل تحميل/قراءة التقرير بدل إيقاف آلة استخراج المدرسة أثناء تحديث الصف والفصل.\n'
    '- رفع سرعة نبض آلة الحالات من 900ms إلى 300ms وتقليل تأخير استجابة نهاية UpdatePanel من 300ms إلى 80ms.\n'
)
assert marker in changelog
if addition.strip() not in changelog:
    changelog = changelog.replace(marker, marker + addition, 1)
CHANGELOG.write_text(changelog, encoding='utf-8')

JS.write_text(text, encoding='utf-8')
subprocess.run(['node', '--check', str(JS)], check=True)

for needle in [
    "if (NOOR_VIEW !== 'v2') {",
    "const reportPhase = new Set([",
    "tickNoor,\n                        80",
    "tickNoor,\n        300",
]:
    assert needle in text, needle

print('Noor timing optimization applied and syntax checked')
