import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync('scripts/madrasati-teaching-tasks-intelligence/madrasati-teaching-tasks-intelligence.user.js', 'utf8');
const version = '2.0.0-beta3';
const assertIncludes = (needle, label = needle) => assert(source.includes(needle), 'Missing: ' + label);

assert.match(source, /^\/\/ @version\s+2\.0\.0-beta3\s*$/m);
assert.equal((source.match(/^\/\/ ==UserScript==/gm) || []).length, 1, 'Exactly one userscript header');
for (const route of ['/Teacher/Assignments/*','/Projects/Projects/*','/SchoolManagment/Actions/MyStudents*']) assertIncludes(route);
assert.equal((source.match(/^\/\/ @require\s+/gm) || []).length, 1, 'No other script dependency');
assert(!source.includes('@require      https://cdn.jsdelivr.net/gh/'), 'Do not depend on a separate userscript');
for (const name of ['MadrasatiAssignmentIntelligence =','MadrasatiAssignmentIntelligenceEnhanced =','MadrasatiProjectsIntelligence =','MadrasatiTeachingTasksIntelligence =']) assertIncludes(name);
for (const name of ['const classFromBlock =','const readImportFile =','const ensureImportModal =','const filteredIndexAssignments =','const postProjectRows =']) assertIncludes(name);
assertIncludes('const VERSION = \'1.1.7\'', 'Stable assignment core preserved');
assert.equal((source.match(/const VERSION = '2\.0\.0-beta3'/g)||[]).length, 2, 'Both visible module versions match unified version');
new vm.Script(source, { filename: 'madrasati-unified.user.js' });

// Read helper functions directly from the actual project module; no reimplementation.
const start = source.indexOf('  // Projects & activities intelligence');
const suffix = source.indexOf('  }\n\n  globalThis.MadrasatiTeachingTasksIntelligence', start);
assert(start > 0 && suffix > start, 'Projects module routing boundary');
const module = source.slice(start, suffix);
const setupEnd = module.lastIndexOf('\n  injectStyle();');
assert(setupEnd > 0, 'Project helpers and initialisation exist');
let tester = module.slice(module.indexOf('(() => {'), setupEnd);
tester = tester.replace('(() => {', 'return (() => {') + '\n  return {state,parseStudentsHtml,readImportFile,detectColumns};\n})();';

const els = new Map();
const fake = id => ({ id, innerHTML:'', value:'', hidden:true, classList:{add(){},remove(){}}, addEventListener(){}, focus(){}, setAttribute(){} });
const formDoc = {
  forms:[], addEventListener(){}, createElement(){return fake('');},
  body:{appendChild(el){els.set(el.id,el);}},
  getElementById(id){
    if(id==='studentsFilter') return null;
    if(id==='MAIP-import-modal') return els.get(id) || null;
    if(/^MAIP-(import-preview|modal-close|file|import-feedback|save|patch|preview-xlsx)$/.test(id)){
      if(!els.has(id))els.set(id,fake(id));
      return els.get(id);
    }
    return null;
  },
  querySelectorAll(){return [];}
};
const checkbox={id:'checkStudent-00017',value:'00017',querySelectorAll(){return []},parentElement:null};
const block={textContent:'أحمد محمد صالح الفصل المدرسي : الثالث المتوسط ب الدرجة 20',innerText:'أحمد محمد صالح الفصل المدرسي : الثالث المتوسط ب الدرجة 20',querySelectorAll(){return [checkbox]},parentElement:null};
checkbox.parentElement=block;
const fields=[['StudentId','00017'],['fullName','أحمد محمد صالح'],['Grade','19'],['TotalGrade','20']];
const returnedDoc={
  querySelectorAll(q){
    if(q==='[name^="List["]') return fields.map(([k,v])=>({name:'List[0].'+k,value:v}));
    if(q==='input[id^="checkStudent-"]')return [checkbox];
    return [];
  },
  getElementById(id){return id==='checkStudent-00017'?checkbox:null}
};
class Parser { parseFromString(){return returnedDoc;} }
const context = {document:formDoc,location:{pathname:'/Projects/Projects/GradeProject/123',origin:'https://schools.madrasati.sa',href:'https://schools.madrasati.sa/Projects/Projects/GradeProject/123'},DOMParser:Parser,URLSearchParams,URL,Intl,console};
const app = new Function('document','location','DOMParser','URLSearchParams','URL','Intl','console',tester)(
  context.document,context.location,context.DOMParser,URLSearchParams,URL,Intl,console
);
const parsed = app.parseStudentsHtml('<html></html>');
assert.equal(parsed.length,1);
assert.equal(parsed[0].name,'أحمد محمد صالح');
assert.equal(parsed[0].className,'الثالث المتوسط ب');
assert.equal(parsed[0].grade,19);
assert.equal(parsed[0].totalGrade,20);

// Matching, duplicate, zero grade, and pop-up preview — use actual import code.
const row=(id,name,grade=null,cls='الثالث المتوسط ب')=>({studentId:id,name,className:cls,totalGrade:20,grade,feedback:'',rawFields:{StudentId:id,TotalGrade:'20'}});
app.state.students=[
  row('00017','طالب 00017',null,'الثالث المتوسط أ'),
  row('10001','خالد محمد فهد',20),
  row('10002','سالم عبدالله هادي'),
  row('10003','ناصر محمد عمر'),
  row('10004','محمد صالح فهد'),
  row('10005','فيصل سعد محمد')
];
const testRows=[
  ['أحمد محمد صالح','00017','20','ready'],
  ['خالد محمد فهد','10001','20','unchanged'],
  ['سالم عبدالله هادي','10002','25','invalid'],
  ['ناصر محمد عمر','10003','0','duplicate'],
  ['ناصر محمد عمر','10003','0','duplicate'],
  ['محمد صالح فهد','10005','20','identity_conflict'],
  ['فيصل سعد محمد','','12','ready'],
  ['محمد صالح فهد','1234567890','15','identity_conflict']
];
const csv='اسم الطالب,رقم الطالب,الفصل,الحالة,الدرجة,ملاحظات\n'+testRows.map(r=>[r[0],r[1],'الثالث المتوسط ب','تم التسليم',r[2],14].join(',')).join('\n');
await app.readImportFile({name:'test-madrasati-import.csv',text:async()=>csv});
const results = app.state.importPreview?.rows || [];
assert.equal(results.length,testRows.length,'Expected all imported rows');
results.forEach((r,i)=>assert.equal(r.status,testRows[i][3], 'Mismatch on synthetic import row '+(i+1)));
assert.equal(results[0].classWarning?.length>0,true,'ID-trusted class discrepancy must remain an advisory warning');
assert.equal(results[0].status,'ready','Confirmed unique ID must not be blocked by class-text differences');
assert(els.get('MAIP-import-preview')?.innerHTML.includes('فصل مدرستي'),'Preview must show platform class separately');
assert(els.get('MAIP-import-preview')?.innerHTML.includes('تنبيه الفصل'),'Preview must expose class warning');
assert.equal(els.get('MAIP-import-modal')?.hidden,false,'Import modal must open');
assert(els.get('MAIP-import-preview')?.innerHTML.includes('جاهز للتغيير'),'Import review must render');
// Assignment search: read the filtering implementation from the real bundled module.
const searchStart=source.indexOf('  const filteredIndexAssignments = () => {');
const searchEnd=source.indexOf('  const summarizeIndexAssignments =',searchStart);
assert(searchStart>0&&searchEnd>searchStart,'Assignments register search exists');
const find=new Function('indexState','norm',source.slice(searchStart,searchEnd)+'return filteredIndexAssignments;');
const indexState={query:'',assignments:[{title:'تصميم إنفوجرافيك',course:'التقنية الرقمية',unit:'التصميم',internalId:'A01'},{title:'اختبار الوحدة',course:'اللغة العربية',unit:'قراءة',internalId:'B02'}]};
const norm=v=>String(v??'').trim().replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').toLowerCase();
const filter=find(indexState,norm);
for(const [q,count] of [['إنفوجرافيك',1],['التقنية',1],['اللغة قراءة',1],['B02',1],['غير موجود',0],['',2]]){
  indexState.query=q;assert.equal(filter().length,count,'Assignments search query: '+q);
}
console.log('✓ Unified routes, identity-by-ID over class text, true conflicts, duplicates, grades, import modal and assignment search passed.');
