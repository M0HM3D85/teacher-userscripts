from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / 'scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js'
README = ROOT / 'scripts/student-rased-madrasati-noor/README.md'
CHANGELOG = ROOT / 'scripts/student-rased-madrasati-noor/CHANGELOG.md'

text = JS.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    text = text.replace(old, new, 1)

# 1) Preference default.
replace_once(
    "        followRowsPerPage:\n            32,\n\n        followRepeatHeader:",
    "        followRowsPerPage:\n            32,\n\n        followCompactFlow:\n            false,\n\n        followRepeatHeader:",
    'compact preference default'
)

# 2) UI option beside rows per page.
replace_once(
    '''  <div class="field">\n   <label>طلاب لكل صفحة</label>\n   <input class="frowsperpage" type="number" min="10" max="60" value="32">\n  </div>\n\n </div>''',
    '''  <div class="field">\n   <label>طلاب لكل صفحة</label>\n   <input class="frowsperpage" type="number" min="10" max="60" value="32">\n  </div>\n\n  <div class="field">\n   <label>استغلال عرض الصفحة</label>\n   <label class="check">\n    <input class="fcompactflow" type="checkbox">\n    <span>إكمال الطلاب بقوائم جانبية عند قلة الأعمدة</span>\n   </label>\n   <div class="followhint">مثال: الاسم + خانة متابعة يمكن توزيعه على قائمتين في العمودي أو حتى 3 في الأفقي. قيمة «طلاب لكل صفحة» تصبح الحد الأعلى لكل قائمة جانبية.</div>\n  </div>\n\n </div>''',
    'compact flow ui'
)

# 3) UI reference.
replace_once(
    "    frowsperpage:\n        $('.frowsperpage'),\n\n    applytpl:",
    "    frowsperpage:\n        $('.frowsperpage'),\n\n    fcompactflow:\n        $('.fcompactflow'),\n\n    applytpl:",
    'compact flow ui ref'
)

# 4) Preference -> UI.
replace_once(
    "    ui.fcellmode.value = p.followCellMode || 'blank';\n    ui.frowsperpage.value = Number(p.followRowsPerPage) || 32;",
    "    ui.fcellmode.value = p.followCellMode || 'blank';\n    ui.frowsperpage.value = Number(p.followRowsPerPage) || 32;\n    ui.fcompactflow.checked = !!p.followCompactFlow;",
    'compact pref to ui'
)

# 5) UI -> Preference.
replace_once(
    "    p.followRowsPerPage = Math.max(10, Math.min(60, Number(ui.frowsperpage.value) || 32));\n\n    prefsSave();",
    "    p.followRowsPerPage = Math.max(10, Math.min(60, Number(ui.frowsperpage.value) || 32));\n    p.followCompactFlow = !!ui.fcompactflow.checked;\n\n    prefsSave();",
    'compact ui to pref'
)

# 6) Saved template apply/save.
replace_once(
    "        if (Number(tpl.rowsPerPage)) ui.frowsperpage.value = tpl.rowsPerPage;",
    "        if (Number(tpl.rowsPerPage)) ui.frowsperpage.value = tpl.rowsPerPage;\n        if (typeof tpl.compactFlow === 'boolean') ui.fcompactflow.checked = tpl.compactFlow;",
    'apply compact template pref'
)
replace_once(
    "        rowsPerPage: state.prefs.followRowsPerPage,\n        extra:",
    "        rowsPerPage: state.prefs.followRowsPerPage,\n        compactFlow: state.prefs.followCompactFlow,\n        extra:",
    'save compact template pref'
)

# 7) Compact-flow renderer helpers.
anchor = 'function followHtmlSheets() {'
if anchor not in text:
    raise SystemExit('missing anchor: followHtmlSheets')

helpers = r'''function followCompactFlowCount(fields, custom, p) {
    if (!p.followCompactFlow) return 1;
    if (!custom.length) return 1;
    if (custom.some(col => col.type === 'note')) return 1;

    const dataColumns = fields.filter(([key]) => key !== 'serial').length;
    const followWeight = custom.reduce((sum, col) =>
        sum + (col.type === 'score' ? 1.2 : 1), 0);
    const weight = dataColumns + followWeight;

    if (weight <= 3) {
        return p.orientation === 'landscape' ? 3 : 2;
    }

    if (weight <= 4 && p.orientation === 'landscape') {
        return 2;
    }

    return 1;
}

function followCompactSections(group, groupIndex, groups, fields, custom, width, w, base, pageRows, p) {
    const flowCount = followCompactFlowCount(fields, custom, p);
    if (flowCount <= 1) return null;

    const entries = group.rows.map((row, index) => ({
        row,
        serial: index + 1
    }));

    for (let i = 0; i < p.extra; i++) {
        entries.push({
            row: null,
            serial: group.rows.length + i + 1
        });
    }

    const pageCapacity = pageRows * flowCount;
    const pageCount = Math.max(1, Math.ceil(entries.length / pageCapacity));
    const sections = [];
    const gapMm = 3;

    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        const pageEntries = entries.slice(pageIndex * pageCapacity, (pageIndex + 1) * pageCapacity);
        const usedFlowCount = Math.max(1, Math.min(
            flowCount,
            Math.ceil(pageEntries.length / pageRows) || 1
        ));
        const chunkSize = Math.max(1, Math.ceil(pageEntries.length / usedFlowCount));
        const blocks = Array.from({ length: usedFlowCount }, (_, blockIndex) =>
            pageEntries.slice(blockIndex * chunkSize, Math.min((blockIndex + 1) * chunkSize, pageEntries.length))
        ).filter(block => block.length);

        const blockWidth = (width - gapMm * Math.max(0, usedFlowCount - 1)) / usedFlowCount;
        const followWidth = custom.length
            ? Math.max(10, blockWidth - base) / custom.length
            : 0;

        const colgroup = '<colgroup>'
            + fields.map(([key]) => `<col style="width:${w[key]}mm">`).join('')
            + custom.map(col => `<col style="width:${(col.type === 'score' ? Math.max(10, followWidth) : Math.max(9, followWidth)).toFixed(2)}mm">`).join('')
            + '</colgroup>';

        const tableHead = '<tr>'
            + fields.map(([, label]) => `<th>${esc(label)}</th>`).join('')
            + custom.map(col => `<th>${esc(col.label)}</th>`).join('')
            + '</tr>';

        const blockHtml = blocks.map(block => {
            const bodyRows = [];
            let previousInlineGroup = '';

            block.forEach(entry => {
                const row = entry.row;
                const inlineGroup = row && !p.followPerClass
                    ? followInlineGroupLabel(row)
                    : '';

                if (inlineGroup && inlineGroup !== previousInlineGroup) {
                    bodyRows.push(
                        `<tr class="group-row"><td colspan="${fields.length + custom.length}">${esc(inlineGroup)}</td></tr>`
                    );
                    previousInlineGroup = inlineGroup;
                }

                bodyRows.push(
                    '<tr>'
                    + fields.map(([key]) => {
                        const value = key === 'serial'
                            ? String(entry.serial)
                            : (row ? (row[key] || '') : '');
                        return `<td class="${key === 'name' ? 'name' : ''}">${esc(value)}</td>`;
                    }).join('')
                    + custom.map(followCellHtml).join('')
                    + '</tr>'
                );
            });

            return `
                <div class="compact-flow-block" style="min-width:0">
                    <table>
                        ${colgroup}
                        <thead>${tableHead}</thead>
                        <tbody>${bodyRows.join('')}</tbody>
                    </table>
                </div>
            `;
        }).join('');

        const groupMark = groups.length > 1 ? group.label : 'النطاق المحدد';
        const pageMark = `صفحة ${pageIndex + 1}/${pageCount}`;
        const flowMark = `تعبئة ذكية ×${usedFlowCount}`;
        const showHeader = p.followRepeatHeader || pageIndex === 0;

        sections.push(`
            <section class="sheet ${p.orientation}">
                <div class="sheetmark">
                    <span>${esc(groupMark)}</span>
                    <span>${esc(`${pageMark} · ${flowMark}`)}</span>
                </div>
                ${showHeader ? `
                    <h3 style="text-align:center;margin:8px">${esc(p.title)}</h3>
                    <div class="sheetmeta">${esc(followMeta(group, p))}</div>
                ` : ''}
                <div class="compact-flow" style="display:grid;grid-template-columns:repeat(${usedFlowCount},minmax(0,1fr));gap:${gapMm}mm;align-items:start;direction:rtl">
                    ${blockHtml}
                </div>
            </section>
        `);
    }

    return sections;
}

'''
text = text.replace(anchor, helpers + anchor, 1)

# 8) Activate compact renderer per group before the normal pagination path.
replace_once(
    "    groups.forEach((group, groupIndex) => {\n        const rowPages = Array.from(",
    "    groups.forEach((group, groupIndex) => {\n        const compactSections = colChunks.length === 1\n            ? followCompactSections(group, groupIndex, groups, fields, custom, width, w, base, pageRows, p)\n            : null;\n\n        if (compactSections?.length) {\n            sections.push(...compactSections);\n            return;\n        }\n\n        const rowPages = Array.from(",
    'activate compact flow renderer'
)

# 9) Event binding.
replace_once(
    "ui.frowsperpage.onchange =\n    renderFollow;",
    "ui.frowsperpage.onchange =\n    renderFollow;\n\nui.fcompactflow.onchange =\n    renderFollow;",
    'compact flow onchange'
)

JS.write_text(text, encoding='utf-8')

# Documentation notes.
readme = README.read_text(encoding='utf-8')
needle = 'استوديو كشوف المتابعة'
if needle in readme and 'قوائم جانبية' not in readme:
    readme = readme.replace(
        needle,
        needle + ' مع خيار تعبئة ذكية لعرض الصفحة بقوائم طلاب جانبية عند قلة الأعمدة',
        1
    )
README.write_text(readme, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
line = '- إضافة خيار «استغلال عرض الصفحة» لإكمال بقية الطلاب في قوائم جانبية على الصفحة نفسها عندما تكون أعمدة المتابعة قليلة، مع توزيع تلقائي إلى قائمتين في العمودي وحتى ثلاث في الأفقي.\n'
if line not in changelog:
    marker = '## 2.1.0'
    if marker in changelog:
        pos = changelog.index('\n', changelog.index(marker)) + 1
        changelog = changelog[:pos] + line + changelog[pos:]
    else:
        changelog = line + changelog
CHANGELOG.write_text(changelog, encoding='utf-8')

print('compact follow flow option added')
