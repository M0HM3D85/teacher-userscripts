from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / 'scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js'
README = ROOT / 'scripts/student-rased-madrasati-noor/README.md'
CHANGELOG = ROOT / 'scripts/student-rased-madrasati-noor/CHANGELOG.md'

text = JS.read_text(encoding='utf-8')

old = """        const usedFlowCount = Math.max(1, Math.min(
            flowCount,
            Math.ceil(pageEntries.length / pageRows) || 1
        ));
        const chunkSize = Math.max(1, Math.ceil(pageEntries.length / usedFlowCount));
"""
new = """        // في وضع استغلال عرض الصفحة نستخدم العرض فعليًا حتى لو كان جميع الطلاب
        // يستطيعون النزول في قائمة واحدة. قيمة pageRows تبقى حدًا أعلى لكل قائمة.
        // نتجنب فقط تقسيم القوائم الصغيرة جدًا حتى لا يصبح شكل الكشف مبالغًا فيه.
        const minRowsPerFlow = p.orientation === 'landscape' ? 6 : 8;
        const maxUsefulFlows = Math.max(
            1,
            Math.min(flowCount, Math.ceil(pageEntries.length / minRowsPerFlow))
        );
        const requiredFlows = Math.max(
            1,
            Math.ceil(pageEntries.length / pageRows) || 1
        );
        const usedFlowCount = Math.max(
            requiredFlows,
            Math.min(flowCount, maxUsefulFlows)
        );
        const chunkSize = Math.max(1, Math.ceil(pageEntries.length / usedFlowCount));
"""
count = text.count(old)
if count != 1:
    raise SystemExit(f'expected one compact flow anchor, found {count}')
text = text.replace(old, new, 1)
JS.write_text(text, encoding='utf-8')

readme = README.read_text(encoding='utf-8')
needle = 'استغلال عرض الصفحة'
if needle in readme and 'حتى لو كان عدد الطلاب أقل من حد «طلاب لكل صفحة»' not in readme:
    readme = readme.replace(
        needle,
        needle + ' حتى لو كان عدد الطلاب أقل من حد «طلاب لكل صفحة»',
        1
    )
    README.write_text(readme, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
entry = '- تحسين «استغلال عرض الصفحة»: يوزع الطلاب على القوائم الجانبية عند قلة الأعمدة حتى لو كان عددهم أقل من حد «طلاب لكل صفحة»، مع موازنة تلقائية وتجنب تقسيم القوائم الصغيرة جدًا.\n'
if entry.strip() not in changelog:
    marker = '## 2.1.0'
    if marker in changelog:
        pos = changelog.index('\n', changelog.index(marker)) + 1
        changelog = changelog[:pos] + entry + changelog[pos:]
    else:
        changelog = entry + changelog
    CHANGELOG.write_text(changelog, encoding='utf-8')

print('compact follow balance fixed')
