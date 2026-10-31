import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const s=readFileSync('scripts/madrasati-projects-intelligence/madrasati-projects-intelligence.user.js','utf8');
assert.match(s,/^\/\/ @version\s+1\.6\.1-beta2$/m);
new vm.Script(s);
assert(s.includes('const checked=await fetchAllStudents()')&&s.includes('for(let i=0;i<plan.length;i+=10)'), 'Every ten-pupil batch must be verified');
assert(s.includes('const {failedGrade,failedNotes}=evaluate(map,currentSlice)')&&s.includes('clean(current.feedback)!==clean(r.feedback)'), 'Notes separately verified');
assert(s.includes('أوقفت بقية الدفعات'), 'Missing first page remarks stop later batches');
assert(s.includes('ملاحظات تحتاج تحديثًا دون تغيير الدرجة'), 'Preview must surface notes-only updates');
assert(s.includes('منها ملاحظات دون تغيير الدرجة'), 'Explicit confirmation identifies notes-only updates');

const getPart=(start,end)=>{
 const i=s.indexOf(start),j=s.indexOf(end,i+start.length);
 assert(i>=0&&j>i,'Production code section: '+start);
 return s.slice(i,j);
};
const idKey=v=>String(v??'').trim();
const feedbackFieldBlock=getPart('  const buildProjectPost = rows => {','  const postProjectRows =');
const body=new Function('globalProjectFormFields','URLSearchParams','Number', feedbackFieldBlock+' return buildProjectPost;')(()=>[],URLSearchParams,Number);
const make=(capital)=>({
 studentId:'100',totalGrade:20,grade:20,feedback:'ملاحظة جديدة',rawFields:{StudentId:'100',Grade:'20',TotalGrade:'20', [capital]:'ملاحظة قديمة'}
});
for(const field of ['feedBack','Feedback','feedback','FEEDBACK']){
 const bodyContent=body([make(field)]);
 assert.equal(bodyContent.get('List[0].'+field),'ملاحظة جديدة','Preserve field spelling '+field);
 assert.equal([...bodyContent.keys()].filter(k=>/List\[0\]\.feedback$/i.test(k)).length,1,'Never append duplicate feedback field');
}
// Actual importer readback: see correctly spelled remark from platform in first page.
const parseBlock=getPart('    const parseStudentsHtml = html => {','  const expectedStudentCount =');
const fields={'StudentId':'100','Grade':'20','TotalGrade':'20','Feedback':'ملاحظة قديمة'};
const sourceFields={...fields};
const documentLike={querySelectorAll(q){
 if(q==='[name^="List["]')return Object.entries(sourceFields).map(([name,value])=>({name:'List[0].'+name,value}));
 return [];
},getElementById(){return null;}};
class Parser{parseFromString(){return documentLike}}
const fakeDoc={getElementById(){return null}};
const parser=new Function('DOMParser','groupsFromDoc','clean','num','truthy','findVisualBlock','classFromBlock','nameFromBlock',parseBlock+' return parseStudentsHtml;')(
 Parser,d=>new Map([[0,sourceFields]]),String,v=>Number(v),v=>v==='true',()=>null,()=>'',()=>'طالب تجريبي'
);
const rows=parser('<html></html>');
assert.equal(rows[0].feedback,'ملاحظة قديمة','Platform feedback readback must be case insensitive');
assert.equal(rows[0].grade,20);
assert.equal(rows[0].studentId,'100');

// Decision logic must never skip first-page pupils because grade already matches.
const previewSrc=getPart('  const renderImportPreview = function newRenderImportPreview(){','  const exportImportPreview =');
assert(previewSrc.includes("const sameGrade=Number.isFinite(r.student?.grade)"),'Grade comparison exists');
assert(previewSrc.includes("const sameFeedback=clean(r.student?.feedback)===clean(r.nextFeedback)"),'Note comparison independent');
assert(previewSrc.includes("r.status=sameGrade&&sameFeedback?'unchanged':'ready'"),'Same grade but changed note must remain ready');
const state={autoFeedback:true,importFeedback:false,zeroDecisions:{},fetchAudit:{complete:true},students:[]};
const clean=x=>String(x??'').trim(),norm=clean,APP='MAIP';
const auto=()=>({text:'ملاحظة جديدة',band:'متميز',percent:100});
const notePreviewRows=Array.from({length:25},(_,i)=>({
 sourceRow:i+2,student:{studentId:String(i+100),name:'طالب '+i,grade:20,totalGrade:20,feedback:'ملاحظة قديمة',className:'فصل أ'},
 sid:String(i+100),name:'طالب '+i,grade:20,feedback:'',submissionCode:'submitted',
 classWarning:'',submissionStatus:'تم التسليم',baseStatus:'ready',status:'ready'
}));
state.students=notePreviewRows.map(r=>r.student);
state.importPreview={fileName:'sample.csv',sheetName:'CSV',rows:notePreviewRows,numericFeedbackCount:0};
const host={innerHTML:'',querySelectorAll:()=>[]},noop={addEventListener(){}};
const fakeDocument={getElementById(id){return id==='MAIP-import-preview'?host:noop;}};
const run=new Function('state','document','APP','esc','fmt','clean','resolvedImportCode','importZeroNeedsDecision','nextProjectFeedback','toast','patchVisibleImport','saveImport','exportImportPreview',
 previewSrc+'return renderImportPreview;')(
 state,fakeDocument,APP,clean,String,clean,r=>r.submissionCode,()=>false,()=>({text:'ملاحظة جديدة',band:'متميز',percent:100,source:'auto'}),()=>{},()=>{},()=>{},()=>{}
);
run();
assert.equal(notePreviewRows.filter(r=>r.status==='ready').length,25,'Existing same-grade students must be eligible for notes-only updates');
assert(host.innerHTML.includes('ملاحظات تحتاج تحديثًا دون تغيير الدرجة: 25'),'25 notes-only changes');
assert(host.innerHTML.includes('منها في أول 20 صفًا من الملف: 20'),'First-page remark updates counted');
assert(host.innerHTML.includes('تأكيد رصد 25 طالبًا على مدرستي'));
console.log('✓ First-page notes: form field casing, AJAX readback and 25 note-only eligible pupils including first 20.');
