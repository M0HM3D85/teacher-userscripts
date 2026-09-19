from pathlib import Path

JS = Path('scripts/student-rased-madrasati-noor/student-rased-madrasati-noor.user.js')
CHANGELOG = Path('scripts/student-rased-madrasati-noor/CHANGELOG.md')

js = JS.read_text(encoding='utf-8')

start_marker = 'host.innerHTML = `'
end_marker = '\n`;\n\ndocument.body.appendChild('
start = js.index(start_marker)
end = js.index(end_marker, start)
html = js[start:end]

replacements = [
    ('<div class="box">', '<div class="m0-shell">'),
    ('<header>', '<div class="m0-header">'),
    ('</header>', '</div>'),
    ('<nav>', '<div class="m0-tabs">'),
    ('</nav>', '</div>'),
    ('<main>', '<div class="m0-main">'),
    ('</main>', '</div>'),
    ('<section', '<div'),
    ('</section>', '</div>'),
    ('<footer>', '<div class="m0-footer">'),
    ('</footer>', '</div>'),
]
for old, new in replacements:
    html = html.replace(old, new)

js = js[:start] + html + js[end:]

css_replacements = [
    ('#${APP} .box{', '#${APP} .m0-shell{'),
    ('#${APP} header{', '#${APP} .m0-header{'),
    ('#${APP} nav{', '#${APP} .m0-tabs{'),
    ('#${APP} main{', '#${APP} .m0-main{'),
    ('#${APP} footer{', '#${APP} .m0-footer{'),
    ('#${APP} footer a{', '#${APP} .m0-footer a{'),
    ('    #${APP} nav,', '    #${APP} .m0-tabs,'),
]
for old, new in css_replacements:
    if old not in js:
        raise SystemExit(f'missing CSS marker: {old}')
    js = js.replace(old, new)

# دفاع إضافي ضد قواعد نور V2 العامة/important على العناصر الدلالية.
js = js.replace(
    '#${APP} .pane{\n    display:none\n}',
    '#${APP} .pane{\n    display:none !important\n}'
)
js = js.replace(
    '#${APP} .pane.on{\n    display:block\n}',
    '#${APP} .pane.on{\n    display:block !important\n}'
)

shell_marker = '''#${APP} .m0-shell{\n    width:min(1450px,98vw);\n    height:min(94vh,980px);\n    background:#fff;\n    border-radius:18px;\n    overflow:hidden;\n    display:flex;\n    flex-direction:column\n}\n'''
if shell_marker not in js:
    raise SystemExit('m0-shell CSS marker not found')

shell_new = shell_marker + '''\n#${APP} .m0-shell{\n    color:#111827 !important;\n    isolation:isolate\n}\n\n#${APP} .m0-header,\n#${APP} .m0-tabs,\n#${APP} .m0-main,\n#${APP} .m0-footer{\n    visibility:visible !important;\n    opacity:1 !important;\n    position:relative\n}\n'''
js = js.replace(shell_marker, shell_new, 1)

required = [
    'class="m0-shell"',
    'class="m0-header"',
    'class="m0-tabs"',
    'class="m0-main"',
    'class="m0-footer"',
    '#${APP} .m0-header{',
    '#${APP} .m0-tabs{',
    '#${APP} .m0-main{',
    '#${APP} .m0-footer{',
]
for needle in required:
    if needle not in js:
        raise SystemExit(f'missing expected UI isolation marker: {needle}')

JS.write_text(js, encoding='utf-8')

changelog = CHANGELOG.read_text(encoding='utf-8')
needle = '- إبقاء زر راصد مدمجًا ومحصورًا في صفحات الطلاب المدعومة فقط.'
addition = needle + '\n- عزل نافذة راصد في نور V2 عن عناصر HTML العامة (`header/nav/main/section/footer`) لمنع ظهور نافذة بيضاء بسبب تعارض CSS مع تصميم نور الحديث.'
if addition not in changelog:
    if needle not in changelog:
        raise SystemExit('CHANGELOG marker not found')
    changelog = changelog.replace(needle, addition, 1)
CHANGELOG.write_text(changelog, encoding='utf-8')
