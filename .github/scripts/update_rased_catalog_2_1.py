from pathlib import Path
import json

root = Path(__file__).resolve().parents[2]
path = root / 'scripts/catalog.json'
data = json.loads(path.read_text(encoding='utf-8'))

item = next(x for x in data['scripts'] if x.get('id') == 'student-rased-madrasati-noor')
item['version'] = '2.1.0'
item['description'] = 'راصد دقيق لبيانات الطلاب من مدرستي ونور مع دعم نور القديم وV2، استخراج المدرسة كاملة، مقارنة محافظة وسجل زمني، واستوديو كشوف متابعة بفلترة الصفوف والفصول والقوالب والطباعة وExcel.'
item['targets'] = [
    'https://schools.madrasati.sa/SchoolManagmentReports/StudentInfo/ClassStudentInfo/*',
    'https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReport.aspx*',
    'https://noor.moe.gov.sa/Noor/EduWavek12Portal/ReportPages/StudntNamesReportV2.aspx*'
]

path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print('catalog synced to Rasid v2.1.0')
