import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('scripts/madrasati-projects-intelligence/madrasati-projects-intelligence.user.js','utf8');
assert.match(source,/^\/\/ @version\s+1\.6\.1-beta2$/m);
new vm.Script(source,{filename:'projects-grading.user.js'});
assert(source.includes("const rejected=allRows.filter(r=>!['ready','unchanged'].includes(r.status))"),'All non-ready statuses, including unresolved zero, must block saving');
assert(source.includes('if(!state.fetchAudit?.complete)'),'Incomplete roster blocks saving');
assert(source.includes("feedback:r.nextFeedback??''")&&source.includes("const body=group.map"),'Save must use previewed automatic comments');
assert(source.includes('const {failedGrade,failedNotes}=evaluate(map,currentSlice)')&&source.includes('clean(current.feedback)!==clean(r.feedback)'),'Each sent batch must verify grade and comment independently');
assert(source.includes('const {failedGrade,failedNotes}=evaluate(map,wants)'),'Final verification must check all file records for grades and comments');
assert(source.includes('تأكيد رصد '),'Visible grading button must show count');
assert(source.includes('مطلوب تحديثهم: '),'Confirmation must show number of pupils who need updating');

const start=source.indexOf('  const normalizeProjectSubmission = ');
const end=source.indexOf('  const band = row => {',start);
assert(start>=0&&end>start,'Submission and automatic feedback helpers exist');
const helperCode=source.slice(start,end);
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const norm=v=>clean(v).replace(/[إأآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').toLowerCase();
const truthy=v=>/^(?:true|1|yes)$/i.test(clean(v));
const state={zeroDecisions:{},importFeedback:false,autoFeedback:true,fetchAudit:{complete:true},students:[],importPreview:null};
const h=new Function('state','clean','norm','truthy','studentIdKey',helperCode+
 'return {normalizeProjectSubmission,classifyProjectSubmission,autoProjectFeedback,importZeroNeedsDecision,zeroDecisionCounts,resolvedImportCode,nextProjectFeedback};')(
 state,clean,norm,truthy,v=>clean(v).replace(/^0+(?=\d)/,'')
);
const row=(grade,feedback,hasAnswer='true',solvingType='4')=>({
 studentId:'100',grade,totalGrade:20,feedback,rawFields:{hasAnswer,SolvingType:solvingType}
});
const cases=[
 ['Submitted student with zero',row(0,'تم التسليم'), 'submitted'],
 ['Absent, no grade',row(null,'','false'), 'not_submitted'],
 ['Absent, zero entered manually',row(0,'','false'), 'not_submitted'],
 ['External task no submission despite hasAnswer true',row(0,'لم يتم تسليم المشروع','true','3'),'not_submitted'],
 ['External task zero and no status',row(0,'','true','3'),'unknown'],
 ['Positive grade out of system',row(15,'','false','3'),'submitted']
];
for(const [label,student,want] of cases)assert.equal(h.classifyProjectSubmission(student).key,want,label);
const stats=h.zeroDecisionCounts(cases.map(x=>x[1]));
assert.equal(stats.submittedZero,1);
assert.equal(stats.notSubmittedZero,2);
assert.equal(stats.notSubmittedUnscored,1);
assert.equal(stats.unknown,1);
assert.match(h.autoProjectFeedback(0,20,'100','submitted').text,/تم تسليم|تم التسليم/);
assert.match(h.autoProjectFeedback(0,20,'100','not_submitted').text,/لم|غير مسل/);
assert.equal(h.autoProjectFeedback(0,20,'100','unknown').text,'','Ambiguous zero must not generate misleading text');
assert.equal(h.autoProjectFeedback(20,20,'100','submitted').band,'متميز');
assert.equal(h.autoProjectFeedback(16,20,'100','submitted').band,'رائع');
assert.equal(h.autoProjectFeedback(14,20,'100','submitted').band,'جيد');
assert.equal(h.autoProjectFeedback(12,20,'100','submitted').band,'مقبول');
assert.equal(h.autoProjectFeedback(10,20,'100','submitted').band,'يحتاج تعزيز');
assert.equal(h.autoProjectFeedback(9,20,'100','submitted').band,'يحتاج مراجعة');

const student=row(null,'','false');
const imp={sourceRow:2,zeroKey:'k1',sid:'100',name:'طالب',className:'ثالث',grade:0,feedback:'14',submissionCode:'unknown',submissionStatus:'',student,
 status:'zero_decision',baseStatus:'zero_decision',reason:'',classWarning:''};
state.students=[student];state.importPreview={fileName:'sample.csv',sheetName:'CSV',numericFeedbackCount:1,rows:[imp]};
const host={innerHTML:'',querySelectorAll:()=>[]},dummy={addEventListener(){}},document={getElementById:id=>id==='MAIP-import-preview'?host:dummy};
const APP='MAIP',esc=v=>clean(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const fmt=v=>Number.isFinite(v)?String(v):'—';
const previewStart=source.indexOf('  const renderImportPreview = function newRenderImportPreview(){');
const previewEnd=source.indexOf('  const exportImportPreview =',previewStart);
assert(previewStart>0&&previewEnd>previewStart,'Project preview exists');
const preview=new Function('state','document','APP','esc','fmt','clean','resolvedImportCode','importZeroNeedsDecision','nextProjectFeedback','toast','patchVisibleImport','saveImport','exportImportPreview',
 source.slice(previewStart,previewEnd)+'return renderImportPreview;')(
 state,document,APP,esc,fmt,clean,h.resolvedImportCode,h.importZeroNeedsDecision,h.nextProjectFeedback,()=>{},()=>{},()=>{},()=>{}
);
preview();
assert.equal(imp.status,'zero_decision','Do not accept zero without a decision');
assert(host.innerHTML.includes('صفر يحتاج قرار: <b>1</b>'));
assert(host.innerHTML.includes('تأكيد رصد 0 طالبًا على مدرستي'));
state.zeroDecisions.k1='not_submitted';
preview();
assert.equal(imp.status,'ready','Explicit teacher decision permits grading');
assert.equal(imp.feedbackSource,'auto');
assert(!imp.nextFeedback.includes('14'),'Numeric note must not be used as commentary');
assert.match(imp.nextFeedback,/لم|غير مسل/);
assert(host.innerHTML.includes('تأكيد رصد 1 طالبًا على مدرستي'));

const statsStart=source.indexOf('  const band = row => {');
const statsEnd=source.indexOf('  const metric =',statsStart);
assert(statsStart>=0&&statsEnd>statsStart,'Need production project classification, analytics and level functions');
const toStats=new Function('state','APP','clean','norm','classifyProjectSubmission','zeroDecisionCounts','fmt','pct','compareNames','esc',
 source.slice(statsStart,statsEnd)+'return {summary,detailedStats,band};');
const api=toStats(state,APP,clean,norm,h.classifyProjectSubmission,h.zeroDecisionCounts,fmt,
 (a,b)=>b?100*a/b:0,(a,b)=>String(a).localeCompare(String(b),'ar'),esc);
const analysed=[
 {...row(0,'تم التسليم'),className:'الثالث'},
 {...row(0,'لم يتم تسليم المشروع'),className:'الثالث'},
 {...row(null,'','false'),className:'الثالث'},
 {...row(0,'','true','3'),className:'الثالث'},
 {...row(18,'','true'),className:'الثالث'}
];
const output=api.detailedStats(analysed);
assert.equal(output.total,5);
assert.equal(output.submitted,2);
assert.equal(output.notSubmitted,2);
assert.equal(output.unknown,1);
assert.equal(output.submittedZero,1);
assert.equal(output.notSubmittedZero,1);
assert.equal(output.notSubmittedUnscored,1);
assert.equal(output.graded,4,'Manually assigned absent zero is graded, unlike a blank grade');
assert.equal(output.avg,22.5,'Overall grade mean includes posted zeros, as in assignment reports');
assert.equal(output.median,0,'Median and mean must use same pool of recorded scores');
assert.equal(output.levels.not_submitted,2,'Absentees must not appear under Weak');
assert.equal(output.levels.unverified,1);
assert.equal(output.levels.excellent,1);
assert.equal(output.levels.weak,1);
assert.equal(output.buckets.reduce((a,b)=>a+b.count,0),2,'Grade-level histogram includes submitted students only');
assert.equal(api.band(analysed[1]),'not_submitted');
assert.equal(api.band(analysed[3]),'unverified');
assert(source.includes("'التسليم': classifyProjectSubmission(r).label"),'Excel export must have proper status');
assert(source.includes("classifyProjectSubmission(r).label"),'PDF and CSV use the same status classification');
// Use the REAL CSV reader/importer, not a reimplementation of its row logic.
const importStart=source.indexOf('  const parseCsv = text => {');
const importEnd=source.indexOf('  const renderImportPreview = function',importStart);
assert(importStart>=0&&importEnd>importStart,'Actual importer is available');
const freshState={students:[
 {studentId:'111',name:'أحمد سالم محمد',grade:null,totalGrade:20,className:'ثالث',feedback:'',rawFields:{StudentId:'111'}},
 {studentId:'222',name:'علي سعد حسن',grade:null,totalGrade:20,className:'ثالث',feedback:'',rawFields:{StudentId:'222'}},
 {studentId:'333',name:'سالم علي ياسر',grade:null,totalGrade:20,className:'ثالث',feedback:'',rawFields:{StudentId:'333'}},
 {studentId:'444',name:'محمد يوسف محمد',grade:null,totalGrade:20,className:'ثالث',feedback:'',rawFields:{StudentId:'444'}},
 {studentId:'555',name:'خالد ناصر محمود',grade:null,totalGrade:20,className:'ثالث',feedback:'',rawFields:{StudentId:'555'}},
 {studentId:'666',name:'نواف فهد علي',grade:null,totalGrade:20,className:'ثالث',feedback:'',rawFields:{StudentId:'666'}}
],importFeedback:false,zeroDecisions:{},fetchAudit:{complete:true}};
const num=v=>v===null||v===undefined||clean(v)===''?null:Number(clean(v));
const modal={hidden:true};
const makeImporter=new Function('state','clean','norm','num','studentIdKey','studentNameKey','studentNameFromSelect','classKey','normalizeProjectSubmission','importZeroNeedsDecision','setBusy','ensureImportModal','renderImportPreview','toast','fmt','document','updateGradeReceipt',
 source.slice(importStart,importEnd)+'return readImportFile;');
const importer=makeImporter(freshState,clean,norm,num,clean,norm,()=>'',norm,h.normalizeProjectSubmission,h.importZeroNeedsDecision,
 ()=>{},()=>modal,()=>{},()=>{},fmt,{getElementById:()=>null},()=>{});
const csv=[
 'اسم الطالب,رقم الطالب,الفصل,حالة التسليم,الدرجة,ملاحظات',
 'أحمد سالم محمد,111,ثالث,تم التسليم,0,',
 'علي سعد حسن,222,ثالث,لم يسلم,0,',
 'سالم علي ياسر,333,ثالث,,0,',
 'محمد يوسف محمد,444,ثالث,لم يسلم,9,',
 'خالد ناصر محمود,555,ثالث,تم التسليم,15,14',
 'نواف فهد علي,666,ثالث,تم التسليم,20,',
 'نواف فهد علي,666,ثالث,تم التسليم,20,'
].join('\n');
await importer({name:'grades.csv',text:async()=>csv});
const imported=freshState.importPreview?.rows||[];
assert.equal(imported.length,7,'All CSV rows parsed');
assert.equal(imported[0].status,'ready','Submitted zero must be ready');
assert.equal(imported[1].status,'ready','Unsubmitted zero must be ready');
assert.equal(imported[2].status,'zero_decision','Ambiguous zero must be blocked');
assert.equal(imported[3].status,'invalid','Absent with positive grade is an error');
assert.equal(imported[4].status,'ready','Score with numeric text comments still importable');
assert.equal(imported[5].status,'duplicate');
assert.equal(imported[6].status,'duplicate');
assert.equal(freshState.importPreview.numericFeedbackCount,1);
assert.equal(modal.hidden,false,'Import pop-up must appear');
const oneStudent=imported[0];
assert.equal(h.normalizeProjectSubmission(oneStudent.submissionStatus),'submitted');
assert.equal(h.normalizeProjectSubmission(imported[1].submissionStatus),'not_submitted');
console.log('✓ Project grading: six submission cases, zero decision, percentage comments, numeric note handling, preview count and save guards.');
