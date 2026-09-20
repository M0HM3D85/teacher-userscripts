from pathlib import Path
import re

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


def sub_once(pattern, replacement, label, flags=re.S):
    global text
    new_text, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise SystemExit(f'pattern {label} matched {count} times')
    text = new_text

# ------------------------------------------------------------------
# Version + storage keys
# ------------------------------------------------------------------
replace_once('// @version      2.0.0', '// @version      2.1.0', 'metadata version')
replace_once("const VERSION = '2.0.0';", "const VERSION = '2.1.0';", 'runtime version')
replace_once(
    "const LAUNCH_INTENT = `${APP}-launch-intent-v2`;",
    "const LAUNCH_INTENT = `${APP}-launch-intent-v2`;\nconst FOLLOW_TEMPLATE_KEY = `${APP}-follow-templates-v1`;",
    'follow template key'
)

# ------------------------------------------------------------------
# Follow templates
# ------------------------------------------------------------------
new_templates = r'''const TPL = {

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

'''
sub_once(r"const TPL = \{.*?\n\};\n\n(?=function prefsDefault\(\))", new_templates, 'template block')

# ------------------------------------------------------------------
# Follow preferences + in-memory selection
# ------------------------------------------------------------------
replace_once(
    "        extra:\n            0,\n\n        orientation:\n            'portrait'",
    "        extra:\n            0,\n\n        period:\n            '',\n\n        followScope:\n            'all',\n\n        followGrade:\n            '',\n\n        followClasses:\n            [],\n\n        followSort:\n            'class-name',\n\n        followGroup:\n            'grade-class',\n\n        followPerClass:\n            true,\n\n        followSearch:\n            '',\n\n        followCellMode:\n            'blank',\n\n        followRowsPerPage:\n            32,\n\n        followRepeatHeader:\n            true,\n\n        orientation:\n            'portrait'",
    'follow prefs'
)
replace_once(
    "    lastImportMeta:\n        null\n};",
    "    lastImportMeta:\n        null,\n\n    followSelection:\n        new Set(),\n\n    followSelectionTouched:\n        false\n};",
    'follow state'
)

# ------------------------------------------------------------------
# CSS for follow studio / A4 preview
# ------------------------------------------------------------------
follow_css = r'''
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

'''
replace_once('@media(max-width:900px){', follow_css + '@media(max-width:900px){', 'follow css')

# ------------------------------------------------------------------
# Follow Studio UI inserted at top of Follow pane
# ------------------------------------------------------------------
follow_ui = r'''<div
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
 </h3>'''
sub_once(
    r'<div\n class="pane"\n data-pane="follow"\n>\n\n <h3>\n  بيانات رأس الكشف\n </h3>',
    follow_ui,
    'follow studio ui'
)

# Add period field after academic year field.
period_field = r'''

  <div class="field">

   <label>
    الفترة / الأسبوع
   </label>

   <input class="fperiod" placeholder="مثال: الأسبوع الخامس">

  </div>'''
replace_once(
    "  <div class=\"field\">\n\n   <label>\n    العام الدراسي\n   </label>\n\n   <input class=\"fyear\">\n\n  </div>\n\n </div>",
    "  <div class=\"field\">\n\n   <label>\n    العام الدراسي\n   </label>\n\n   <input class=\"fyear\">\n\n  </div>" + period_field + "\n\n </div>",
    'period field'
)

# Hint for typed follow columns.
replace_once(
    "  <textarea class=\"fcols\"></textarea>\n\n </div>",
    "  <textarea class=\"fcols\"></textarea>\n  <div class=\"followhint\">يمكن تحديد نوع كل عمود بهذه الصيغة: <b>واجب 1|check</b> أو <b>درجة|score</b> أو <b>ملاحظات|note</b>. السطر بدون نوع يستخدم النوع الافتراضي أدناه.</div>\n\n </div>",
    'follow column hint'
)

# Extra settings beside orientation.
extra_settings = r'''

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
  </div>'''
sub_once(
    r'(<select class="forient">.*?</select>\n\n  </div>)(\n\n </div>\n\n <div class="bar">)',
    r'\1' + extra_settings + r'\2',
    'follow extra settings'
)

# Add save/delete template buttons.
replace_once(
    "  <button class=\"b applytpl\">\n   تطبيق القالب\n  </button>",
    "  <button class=\"b applytpl\">\n   تطبيق القالب\n  </button>\n\n  <button class=\"b fsavetpl\">\n   💾 حفظ كقالب\n  </button>\n\n  <button class=\"b fdeletetpl\">\n   🗑 حذف القالب المحفوظ\n  </button>",
    'template buttons'
)

# ------------------------------------------------------------------
# UI references
# ------------------------------------------------------------------
replace_once(
    "    fields:\n        $('.fields'),\n\n    ftitle:",
    "    fields:\n        $('.fields'),\n\n    fscope:\n        $('.fscope'),\n\n    fgradefilter:\n        $('.fgradefilter'),\n\n    fclassfilter:\n        $('.fclassfilter'),\n\n    fclassall:\n        $('.fclassall'),\n\n    fsort:\n        $('.fsort'),\n\n    fgroup:\n        $('.fgroup'),\n\n    fsearch:\n        $('.fsearch'),\n\n    fperclass:\n        $('.fperclass'),\n\n    frepeathead:\n        $('.frepeathead'),\n\n    fcountsummary:\n        $('.fcountsummary'),\n\n    fselectall:\n        $('.fselectall'),\n\n    fselectnone:\n        $('.fselectnone'),\n\n    fselectinvert:\n        $('.fselectinvert'),\n\n    fcopynames:\n        $('.fcopynames'),\n\n    fcopygroups:\n        $('.fcopygroups'),\n\n    followpicker:\n        $('.followpicker'),\n\n    ftitle:",
    'follow ui refs 1'
)
replace_once(
    "    fyear:\n        $('.fyear'),\n\n    tpl:",
    "    fyear:\n        $('.fyear'),\n\n    fperiod:\n        $('.fperiod'),\n\n    tpl:",
    'period ui ref'
)
replace_once(
    "    forient:\n        $('.forient'),\n\n    applytpl:",
    "    forient:\n        $('.forient'),\n\n    fcellmode:\n        $('.fcellmode'),\n\n    frowsperpage:\n        $('.frowsperpage'),\n\n    applytpl:",
    'follow ui refs 2'
)
replace_once(
    "    applytpl:\n        $('.applytpl'),\n\n    gencols:",
    "    applytpl:\n        $('.applytpl'),\n\n    fsavetpl:\n        $('.fsavetpl'),\n\n    fdeletetpl:\n        $('.fdeletetpl'),\n\n    gencols:",
    'follow ui refs 3'
)

# ------------------------------------------------------------------
# Entire Follow engine replacement
# ------------------------------------------------------------------
follow_engine = r'''// =========================================================
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
// ========================================================='''
sub_once(
    r'// =========================================================\n// كشف المتابعة\n// =========================================================.*?// =========================================================\n// تصدير البيانات\n// =========================================================',
    follow_engine,
    'follow engine replacement'
)

# ------------------------------------------------------------------
# Replace Follow event bindings
# ------------------------------------------------------------------
new_events = r'''ui.applytpl.onclick =
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
    copyFollow;'''
sub_once(
    r'ui\.applytpl\.onclick =.*?ui\.copyfollow\.onclick =\n    copyFollow;',
    new_events,
    'follow events'
)

# Startup: make sure custom template options + filters are refreshed even before extraction.
replace_once(
    "prefsToUI();\nrenderFields();\nrenderFollow();",
    "prefsToUI();\nrenderFields();\nrefreshFollowTemplateOptions();\nrefreshFollowControls();\nrenderFollow();",
    'startup follow refresh'
)

JS.write_text(text, encoding='utf-8')

# ------------------------------------------------------------------
# README + changelog
# ------------------------------------------------------------------
readme = README.read_text(encoding='utf-8')
readme = readme.replace('**الإصدار الحالي:** `2.0.0`', '**الإصدار الحالي:** `2.1.0`', 1)
needle = '- مركز مراجعة يدوية للحالات التي تحتاج قرار المستخدم.\n'
if needle in readme and 'استوديو كشوف المتابعة' not in readme:
    readme = readme.replace(
        needle,
        needle
        + '- **استوديو كشوف المتابعة:** تصفية حسب الصف والفصل، اختيار عدة فصول أو طلاب محددين، ترتيب وتجميع مرن، كشف مستقل لكل فصل، قوالب متابعة قابلة للحفظ، معاينة صفحات A4، وطباعة/Excel جماعي.\n'
        + '- يدعم نطاقات ذكية من المقارنة مثل الطلاب الجدد أو من تغيرت بياناتهم/فصولهم، مع بقاء بيانات الاستخراج الأصلية دون تعديل.\n',
        1
    )
README.write_text(readme, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
entry = '''## [2.1.0] — استوديو كشوف المتابعة\n\n- إعادة بناء تبويب كشف المتابعة ليعمل كنظام مستقل فوق بيانات الاستخراج دون تعديل `state.rows`.\n- إضافة نطاقات كشف: كل الطلاب، نتيجة فلترة المراجعة، طلاب محددون، الطلاب الجدد، المتغيرون، ومن تغير فصلهم.\n- إضافة تصفية حسب الصف واختيار عدة فصول، مع بحث داخل نطاق الكشف.\n- إضافة ترتيب حسب المصدر أو الاسم أو الفصل/الصف، وتجميع مرن مع خيار كشف مستقل لكل فصل.\n- ترقيم مستقل داخل كل فصل، ورأس كشف يتكيف تلقائيًا مع الصف والفصل والفترة/الأسبوع.\n- إضافة اختيار يدوي للطلاب مع تحديد الكل/إلغاء/عكس التحديد، دون تخزين قائمة الطلاب المحددين في `localStorage`.\n- توسيع القوالب إلى: يومي، أسبوعي، واجبات، تقييم، حفظ، مهارات، مشروع، خطة علاجية، وسلوك، مع حفظ قوالب مخصصة محليًا.\n- دعم أنواع خانات المتابعة `check / score / note / blank` لكل عمود بصيغة `العنوان|النوع`.\n- إضافة عدد طلاب لكل صفحة ومعاينة صفحات A4 حقيقية نسبيًا مع فواصل صفحات مستقلة.\n- تطوير Excel ليصدر Workbook متعدد الأوراق؛ ورقة مستقلة لكل فصل عند إنشاء كشوف جماعية.\n- إضافة نسخ أسماء النطاق أو الأسماء مجمعة حسب الفصول، مع استمرار الطباعة/PDF والنسخ المعتاد.\n\n'''
if '## [2.1.0]' not in changelog:
    changelog = changelog.replace('## [2.0.0]', entry + '## [2.0.0]', 1)
CHANGELOG.write_text(changelog, encoding='utf-8')

print('Follow Studio v2.1.0 patch applied successfully')
