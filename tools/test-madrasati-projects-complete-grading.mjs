import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const src=readFileSync('scripts/madrasati-projects-intelligence/madrasati-projects-intelligence.user.js','utf8');
assert.match(src,/^\/\/ @version\s+1\.6\.1-beta3$/m);
new vm.Script(src);
assert(!src.includes('project-grade-backup-'),'Never download grade backup automatically');
assert(src.includes('if(busy){')&&src.includes('maipWasDisabled'),'Do not reactivate intentionally disabled save buttons');
assert(src.includes("complete=expected>0&&byId.size>=expected"),'No claim that unknown server page count is complete');
assert(src.includes('rejected=allRows.filter'),'Do not silently skip invalid imported rows');
assert(src.includes('gradeReceiptHtml'),'Permanent result must exist in activity page and modal');
assert(src.includes('no automatic')===false,'Do not leave English placeholder copy');
assert(src.includes('لا يوجد تنزيل تلقائي لأي نسخة احتياطية'),'Confirmation accurately describes no backups');
const part=(a,b)=>{
 const start=src.indexOf(a),end=src.indexOf(b,start);
 assert(start>=0&&end>start,'Missing actual project code: '+a);
 return src.slice(start,end);
};
const saveCode=part('    const saveImport = async function saveImport(){','    const cleanFile = name =>');
const planCode=part('  const projectGradeEqual = ','    const saveImport = async function saveImport(){');
const prepareProjectImportPlan=new Function('studentIdKey','clean',planCode+'return prepareProjectImportPlan;')((v)=>String(v??'').trim(),(v)=>String(v??'').trim());
const uiCode=part('  const syncNativeVerifiedRows = function syncNativeVerifiedRows(','  const updateGradeReceipt =');
assert(saveCode.includes('const final=await fetchAllStudents();'),'Must run final full-file server readback');
assert(saveCode.includes('const checked=await fetchAllStudents();'),'Verify each batch before next POST');
assert(saveCode.includes("const counts={file:allRows.length"),'Persistent counts include all file records');
const clean=v=>String(v??'').replace(/\s+/g,' ').trim();
const studentIdKey=clean;
const fileRows=Array.from({length:25},(_,i)=>{
 const id=String(i+1001),already=i>=20;
 const student={studentId:id,name:'طالب '+(i+1),className:'الصف أ',
  grade:20,totalGrade:20,feedback:already?'الملاحظة الجديدة':'الملاحظة القديمة',
  rawFields:{StudentId:id,Grade:'20',TotalGrade:'20',feedBack:already?'الملاحظة الجديدة':'الملاحظة القديمة'}};
 return {student,sid:id,name:student.name,grade:20,nextFeedback:'الملاحظة الجديدة',
  status:already?'unchanged':'ready',baseStatus:'ready'};
});
const makeServer=()=>{
 const m=new Map();
 for(const r of fileRows){m.set(r.student.studentId,{...r.student,rawFields:{...r.student.rawFields}});}
 return m;
};
const createHarness=({failNotes=false,incomplete=false,reject=false,approvals=[]}={})=>{
 const server=makeServer(),state={students:[...server.values()],fetchAudit:{complete:!incomplete,expected:25},
  importPreview:{rows:fileRows.map(r=>({...r,student:{...r.student}}))},activityTitle:'مشروع الاختبار',gradeSaving:false,lastGradeReceipt:null};
 if(reject)state.importPreview.rows[0].status='invalid';
 const log={posts:[],receipts:[],readbacks:0,render:0,sync:0,confirmation:0,toasts:[],busy:[],controls:{}};
 const getRows=()=>[...server.values()].map(r=>({...r,rawFields:{...r.rawFields}}));
 const fetchAllStudents=async()=>{log.readbacks++;return getRows();};
 const postProjectRows=async batch=>{
  log.posts.push(batch.map(r=>r.studentId));
  for(const r of batch){
   const old=server.get(r.studentId);
   server.set(r.studentId,{...old,grade:r.grade,
    feedback:failNotes?old.feedback:r.feedback,
    rawFields:{...old.rawFields,Grade:String(r.grade),feedBack:failNotes?old.feedback:r.feedback}});
  }
 };
 const el={innerHTML:'',textContent:''},doc={getElementById:()=>el};
 const syncNativeVerifiedRows=rows=>{log.sync++;return {visible:Math.min(20,rows.length),grades:Math.min(20,rows.length),remarks:Math.min(20,rows.length),missingRemarks:0};};
 const fakeToast=(message,type)=>log.toasts.push({message,type});
 const factory=new Function('state','studentIdKey','toast','confirmProjectImport','setBusy','updateGradeReceipt',
  'fetchAllStudents','postProjectRows','syncNativeVerifiedRows','renderGradeBody','document','APP','clean','prepareProjectImportPlan',
  saveCode+'return saveImport;');
 const save=factory(state,studentIdKey,fakeToast,async()=>{log.confirmation++;return approvals.length?approvals.shift():true;},
  (v,text)=>log.busy.push({v,text}),v=>{state.lastGradeReceipt=v;log.receipts.push(JSON.parse(JSON.stringify(v)));},
  fetchAllStudents,postProjectRows,syncNativeVerifiedRows,()=>{log.render++;},doc,'MAIP',clean,prepareProjectImportPlan);
 return {state,log,save,server};
};
const success=createHarness();
await success.save();
assert.deepEqual(success.log.posts.map(x=>x.length),[10,10],'20 first-page notes-only changes must be posted (5 already matching are not resent)');
assert.equal(success.log.readbacks,4,'One preflight, one check per batch, and final independent readback');
assert.equal(success.state.lastGradeReceipt.phase,'verified','Success only after independent final readback');
assert.equal(success.state.lastGradeReceipt.counts.file,25);
assert.equal(success.state.lastGradeReceipt.counts.unchanged,5);
assert.equal(success.state.lastGradeReceipt.counts.target,20);
assert.equal(success.state.lastGradeReceipt.counts.sent,20);
assert.equal(success.state.lastGradeReceipt.counts.verifiedGrades,25);
assert.equal(success.state.lastGradeReceipt.counts.verifiedNotes,25);
assert.equal(success.state.lastGradeReceipt.counts.unverified,0);
assert.equal(success.state.importPreview,null,'Do not offer repeat save after confirmed success');
assert.equal(success.state.gradeSaving,false);
assert.equal(success.log.confirmation,1);
assert.equal(success.log.busy.at(-1).v,false,'Busy state must clear');
assert(success.log.receipts.some(r=>r.phase==='working'),'Show work in progress, not only a fleeting toast');
assert(success.log.sync>=2,'Mirror verified data into the currently visible native inputs');

// File target and student identity remain valid although the platform changed
// a remark since preview (for example after an earlier partial operation).
const stale=createHarness();
stale.server.get('1001').feedback='ملاحظة خارجية أُضيفت بعد المعاينة';
await stale.save();
assert.equal(stale.log.confirmation,2,'Genuine platform drift requires second explicit teacher approval');
assert.equal(stale.state.lastGradeReceipt.phase,'verified','Approved reconciliation may proceed when all IDs match');
assert.equal(stale.server.get('1001').feedback,'الملاحظة الجديدة','Updated note follows the intended spreadsheet feedback');

const declined=createHarness({approvals:[true,false]});
declined.server.get('1001').feedback='تغيير من المعلم بعد المعاينة';
await declined.save();
assert.equal(declined.log.confirmation,2,'Teacher must review changed platform grade/comment');
assert.equal(declined.log.posts.length,0,'Declining reconciliation must make zero writes');
assert.equal(declined.state.lastGradeReceipt.phase,'cancelled');

const preSaved=createHarness();
preSaved.server.get('1001').feedback='الملاحظة الجديدة';
await preSaved.save();
assert.equal(preSaved.log.confirmation,1,'When server already equals target, skip without second confirmation');
assert.equal(preSaved.state.lastGradeReceipt.counts.unchanged,6,'Already saved row is counted, not rejected');
assert.equal(preSaved.state.lastGradeReceipt.counts.sent,19);

const blankGrade=createHarness();
blankGrade.server.get('1001').grade=null;
blankGrade.state.importPreview.rows[0].student.grade=null;
await blankGrade.save();
assert.equal(blankGrade.log.confirmation,1,'Both prior and current blank grade are identical, not a false conflict');
assert.equal(blankGrade.state.lastGradeReceipt.phase,'verified');

const failure=createHarness({failNotes:true});
await failure.save();
assert.equal(failure.log.posts.length,1,'A stale comment on first batch must stop all later batches');
assert.equal(failure.state.lastGradeReceipt.phase,'failed');
assert(failure.state.lastGradeReceipt.counts.unverified>0,'Count unconfirmed comments');
assert(failure.state.lastGradeReceipt.message.includes('لم يتأكد'),'Explain that confirmation failed');
assert.equal(failure.state.importPreview,null,'Block unattended repeat save after a partial write');
assert.equal(failure.state.gradeSaving,false);

const invalid=createHarness({reject:true});
await invalid.save();
assert.equal(invalid.log.posts.length,0);
assert.equal(invalid.log.confirmation,0,'File with rejected rows cannot silently continue');
const incomplete=createHarness({incomplete:true});
await incomplete.save();
assert.equal(incomplete.log.posts.length,0,'Do not post with incomplete roster');
assert.equal(incomplete.log.confirmation,0);

// Production function synchronizes grade and feedback on *current visible page only*;
// the server check is what certifies ALL imported students.
const fieldMap={
 'List[0].Grade':{name:'List[0].Grade',value:'20'},
 'List[0].feedBack':{name:'List[0].feedBack',value:'الملاحظة القديمة'},
 'List[1].Grade':{name:'List[1].Grade',value:'20'},
 'List[1].Feedback':{name:'List[1].Feedback',value:'الملاحظة القديمة'}
};
const first={name:'List[0].StudentId',value:'1001'},second={name:'List[1].StudentId',value:'1002'};
const document={
 querySelectorAll(q){
  if(q==='input[name^="List["][name$=".StudentId"]')return [first,second];
  const m=q.match(/^\\?\[name\^="List\[(\d+)\]\."\]$/);
  if(m)return Object.values(fieldMap).filter(x=>x.name.startsWith('List['+m[1]+'].'));
  return [];
 }
};
const visible=new Function('document','studentIdKey','clean',uiCode+'return syncNativeVerifiedRows;')(
 document,studentIdKey,clean);
const affected=visible([{
 studentId:'1001',grade:20,feedback:'الملاحظة الجديدة'
},{
 studentId:'1002',grade:20,feedback:'الملاحظة الثانية'
},{
 studentId:'1003',grade:20,feedback:'ملاحظة صف آخر'
}]);
assert.equal(affected.visible,2,'Native page contains only 2, not all 3 server records');
assert.equal(affected.grades,2);
assert.equal(affected.remarks,2,'Both feedback spellings must update correctly');
assert.equal(fieldMap['List[0].feedBack'].value,'الملاحظة الجديدة');
assert.equal(fieldMap['List[1].Feedback'].value,'الملاحظة الثانية');
console.log('✓ Project grade import: verify every batch and final; preserve first-page note-only updates; fail safe; no backup; persistent receipt; update native visible grade+remark inputs.');
