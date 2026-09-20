from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
JS = ROOT / 'scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js'
CHANGELOG = ROOT / 'scripts/student-rased-madrasati-noor/CHANGELOG.md'

text = JS.read_text(encoding='utf-8')


def rep(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    text = text.replace(old, new, 1)

# Safe printable class keys for option values.
rep(
"""function followClassKey(row) {
    return `${clean(row.grade)}\\u0001${clean(row.className)}`;
}
""",
"""function followClassKey(row) {
    return encodeURIComponent(JSON.stringify([
        clean(row.grade),
        clean(row.className)
    ]));
}
""",
'class key'
)

# Reset manual selection whenever a new extraction replaces the dataset.
rep(
"""    state.rows = rows;
    state.filtered = [...rows];
    state.pages = pages;
""",
"""    state.rows = rows;
    state.filtered = [...rows];
    state.followSelection.clear();
    state.followSelectionTouched = false;
    state.pages = pages;
""",
'after extract selection reset'
)

# Clear selection with the rest of the dataset.
rep(
"""    state.rows = [];
    state.filtered = [];
    state.pages = 0;
""",
"""    state.rows = [];
    state.filtered = [];
    state.followSelection.clear();
    state.followSelectionTouched = false;
    state.pages = 0;
""",
'clear selection reset'
)

# Make grouping and one-sheet-per-class distinct concepts.
old_groups = """function followGroups(rows = followRows()) {
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
"""
new_groups = """function followClassGroups(rows = followRows()) {
    const map = new Map();

    for (const row of rows) {
        const key = followClassKey(row);

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

function followGroups(rows = followRows()) {
    const p = state.prefs;

    if (p.followPerClass) {
        return followClassGroups(rows);
    }

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

function followInlineGroupLabel(row) {
    const mode = state.prefs.followGroup || 'none';

    if (mode === 'none') return '';

    if (mode === 'class') {
        return clean(row.className) || 'غير محدد';
    }

    return followClassLabel(row);
}
"""
rep(old_groups, new_groups, 'follow groups')

# Avoid a stale comparison-only scope when no comparison exists.
rep(
"""    const cmp = !!state.comparison;
    [...ui.fscope.options].forEach(o => {
        if (['added', 'changed', 'class-changed'].includes(o.value)) o.disabled = !cmp;
    });
}
""",
"""    const cmp = !!state.comparison;
    const comparisonScopes = ['added', 'changed', 'class-changed'];

    [...ui.fscope.options].forEach(o => {
        if (comparisonScopes.includes(o.value)) o.disabled = !cmp;
    });

    if (!cmp && comparisonScopes.includes(p.followScope)) {
        p.followScope = 'all';
        ui.fscope.value = 'all';
        prefsSave();
    }
}
""",
'comparison scope fallback'
)

# Improve summary to report classes as well as generated sheets.
rep(
"""function renderFollowSummary(rows = followRows()) {
    const groups = followGroups(rows);
    ui.fcountsummary.textContent = `${rows.length} طالب · ${groups.filter(g => g.rows.length).length} كشف`;
}
""",
"""function renderFollowSummary(rows = followRows()) {
    const groups = followGroups(rows).filter(g => g.rows.length);
    const classes = followClassGroups(rows).filter(g => g.rows.length);
    ui.fcountsummary.textContent = `${rows.length} طالب · ${classes.length} فصل · ${groups.length} كشف`;
}
""",
'follow summary'
)

# Inject inline grouping rows and make page-header repetition setting functional.
old_body = """                const bodyRows = page.map((r, i) => {
                    const serial = pageIndex * pageRows + i + 1;
                    return '<tr>'
                        + fields.map(([k]) => `<td class=\"${k === 'name' ? 'name' : ''}\">${esc(k === 'serial' ? String(serial) : (r[k] || ''))}</td>`).join('')
                        + cols.map(followCellHtml).join('')
                        + '</tr>';
                });
"""
new_body = """                const bodyRows = [];
                let previousInlineGroup = '';

                page.forEach((r, i) => {
                    const serial = pageIndex * pageRows + i + 1;
                    const inlineGroup = p.followPerClass ? '' : followInlineGroupLabel(r);

                    if (inlineGroup && inlineGroup !== previousInlineGroup) {
                        bodyRows.push(
                            `<tr class=\"group-row\"><td colspan=\"${fields.length + cols.length}\">${esc(inlineGroup)}</td></tr>`
                        );
                        previousInlineGroup = inlineGroup;
                    }

                    bodyRows.push(
                        '<tr>'
                        + fields.map(([k]) => `<td class=\"${k === 'name' ? 'name' : ''}\">${esc(k === 'serial' ? String(serial) : (r[k] || ''))}</td>`).join('')
                        + cols.map(followCellHtml).join('')
                        + '</tr>'
                    );
                });
"""
rep(old_body, new_body, 'inline grouping body')

rep(
"""                const groupMark = groups.length > 1 ? group.label : 'النطاق المحدد';
                const pageMark = `صفحة ${pageIndex + 1}/${rowPages.length}`;
                const colMark = colChunks.length > 1 ? `أعمدة ${colIndex + 1}/${colChunks.length}` : '';

                sections.push(`
                    <section class=\"sheet ${p.orientation}\">
                        <div class=\"sheetmark\">
                            <span>${esc(groupMark)}</span>
                            <span>${esc([pageMark, colMark].filter(Boolean).join(' · '))}</span>
                        </div>
                        <h3 style=\"text-align:center;margin:8px\">${esc(p.title)}</h3>
                        <div class=\"sheetmeta\">${esc(followMeta(group, p))}</div>
                        <table>
""",
"""                const groupMark = groups.length > 1 ? group.label : 'النطاق المحدد';
                const pageMark = `صفحة ${pageIndex + 1}/${rowPages.length}`;
                const colMark = colChunks.length > 1 ? `أعمدة ${colIndex + 1}/${colChunks.length}` : '';
                const showHeader = p.followRepeatHeader || (pageIndex === 0 && colIndex === 0);

                sections.push(`
                    <section class=\"sheet ${p.orientation}\">
                        <div class=\"sheetmark\">
                            <span>${esc(groupMark)}</span>
                            <span>${esc([pageMark, colMark].filter(Boolean).join(' · '))}</span>
                        </div>
                        ${showHeader ? `<h3 style=\"text-align:center;margin:8px\">${esc(p.title)}</h3>` : ''}
                        ${showHeader ? `<div class=\"sheetmeta\">${esc(followMeta(group, p))}</div>` : ''}
                        <table>
""",
'page header repetition'
)

# Print styles for inline grouping rows.
rep(
"""                .follow-score{min-width:12mm}
            </style>
""",
"""                .follow-score{min-width:12mm}
                .group-row td{background:#ecfdf5;color:#065f46;font-weight:800;text-align:right;padding-right:3mm}
            </style>
""",
'print group row css'
)

# Preview styles for inline grouping rows.
rep(
"""#${APP} .follow-score{
    min-width:12mm
}

""",
"""#${APP} .follow-score{
    min-width:12mm
}

#${APP} .preview .group-row td{
    background:#ecfdf5;
    color:#065f46;
    font-weight:800;
    text-align:right;
    padding-right:12px
}

""",
'preview group row css'
)

# Group rows should also appear in copy/Excel when not splitting per class.
old_matrix = """function followGroupMatrix(group) {
    const fields = followFieldDefs();
    const cols = followColumns();
    const matrixRows = [[...fields.map(x => x[1]), ...cols.map(x => x.label)]];

    group.rows.forEach((r, i) => {
        matrixRows.push([
            ...fields.map(([k]) => k === 'serial' ? String(i + 1) : String(r[k] || '')),
            ...cols.map(followCellText)
        ]);
    });
"""
new_matrix = """function followGroupMatrix(group) {
    const fields = followFieldDefs();
    const cols = followColumns();
    const width = fields.length + cols.length;
    const matrixRows = [[...fields.map(x => x[1]), ...cols.map(x => x.label)]];
    let previousInlineGroup = '';

    group.rows.forEach((r, i) => {
        const inlineGroup = state.prefs.followPerClass ? '' : followInlineGroupLabel(r);

        if (inlineGroup && inlineGroup !== previousInlineGroup) {
            matrixRows.push([inlineGroup, ...Array(Math.max(0, width - 1)).fill('')]);
            previousInlineGroup = inlineGroup;
        }

        matrixRows.push([
            ...fields.map(([k]) => k === 'serial' ? String(i + 1) : String(r[k] || '')),
            ...cols.map(followCellText)
        ]);
    });
"""
rep(old_matrix, new_matrix, 'matrix grouping')

# Copy names grouped by actual classes even if printing as one combined sheet.
rep(
"""    const text = grouped
        ? groups.map(group => `${group.label}\\n${group.rows.map(r => r.name).join('\\n')}`).join('\\n\\n')
        : rows.map(r => r.name).join('\\n');
""",
"""    const nameGroups = grouped ? followClassGroups(rows) : [];
    const text = grouped
        ? nameGroups.map(group => `${group.label}\\n${group.rows.map(r => r.name).join('\\n')}`).join('\\n\\n')
        : rows.map(r => r.name).join('\\n');
""",
'grouped name copy'
)

# Richer saved templates preserve layout, but never persist student selection/scope.
rep(
"""        if (tpl.orientation) ui.forient.value = tpl.orientation;
        if (tpl.cellMode) ui.fcellmode.value = tpl.cellMode;
        if (Number(tpl.rowsPerPage)) ui.frowsperpage.value = tpl.rowsPerPage;

        if (Array.isArray(tpl.fields)) {
""",
"""        if (tpl.orientation) ui.forient.value = tpl.orientation;
        if (tpl.cellMode) ui.fcellmode.value = tpl.cellMode;
        if (Number(tpl.rowsPerPage)) ui.frowsperpage.value = tpl.rowsPerPage;
        if (Number.isFinite(Number(tpl.extra))) ui.fextra.value = Number(tpl.extra);
        if (tpl.sort) ui.fsort.value = tpl.sort;
        if (tpl.group) ui.fgroup.value = tpl.group;
        if (typeof tpl.perClass === 'boolean') ui.fperclass.checked = tpl.perClass;
        if (typeof tpl.repeatHeader === 'boolean') ui.frepeathead.checked = tpl.repeatHeader;

        if (Array.isArray(tpl.fields)) {
""",
'apply rich template'
)

rep(
"""        orientation: state.prefs.orientation,
        cellMode: state.prefs.followCellMode,
        rowsPerPage: state.prefs.followRowsPerPage
    });
""",
"""        orientation: state.prefs.orientation,
        cellMode: state.prefs.followCellMode,
        rowsPerPage: state.prefs.followRowsPerPage,
        extra: state.prefs.extra,
        sort: state.prefs.followSort,
        group: state.prefs.followGroup,
        perClass: state.prefs.followPerClass,
        repeatHeader: state.prefs.followRepeatHeader
    });
""",
'save rich template'
)

# Multi-select classes without needing Ctrl/Cmd.
rep(
"""ui.fclassfilter.onchange =
    renderFollow;

ui.fclassall.onclick =
""",
"""ui.fclassfilter.onchange =
    renderFollow;

ui.fclassfilter.onmousedown =
    event => {
        const option = event.target.closest?.('option');
        if (!option) return;
        event.preventDefault();
        option.selected = !option.selected;
        renderFollow();
    };

ui.fclassall.onclick =
""",
'class multi select'
)

# Clarify selection button wording.
rep(
'<button class="b fselectall" type="button">تحديد الظاهر</button>',
'<button class="b fselectall" type="button">تحديد نتائج الفلاتر</button>',
'select filter label'
)

# Changelog note for refinements.
changelog = CHANGELOG.read_text(encoding='utf-8')
needle = '## [2.1.0] — استوديو كشوف المتابعة\n\n'
addition = '- فصل مفهوم «التجميع داخل الكشف» عن «كشف مستقل لكل فصل»، مع فواصل مرئية داخل الكشف الموحد ودعمها في النسخ وExcel.\n- جعل خيار تكرار رأس الكشف لكل صفحة فعليًا، وتحسين اختيار عدة فصول دون الحاجة إلى Ctrl/Cmd، واستخدام مفاتيح فصول آمنة داخل الواجهة.\n- توسيع القوالب المحفوظة لتشمل التخطيط والترتيب والتجميع والصفوف الإضافية دون حفظ نطاق الطلاب أو التحديد اليدوي.\n'
if needle in changelog and addition not in changelog:
    changelog = changelog.replace(needle, needle + addition, 1)
CHANGELOG.write_text(changelog, encoding='utf-8')

JS.write_text(text, encoding='utf-8')
print('Follow Studio refinements applied')
