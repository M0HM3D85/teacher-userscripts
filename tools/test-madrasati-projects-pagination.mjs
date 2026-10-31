import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('scripts/madrasati-projects-intelligence/madrasati-projects-intelligence.user.js','utf8');
assert.match(source,/^\/\/ @version\s+1\.6\.1-beta3$/m);
new vm.Script(source);
assert(source.includes("if(!state.fetchAudit?.complete)return toast("),'Incomplete student roster must block grade saving');
assert(source.includes('studentPageSize: 20'),'Default 20-row table paging');
assert(source.includes('pageSize=200'),'Fetch must request an explicit server page size');
assert(source.includes('pageNumber=page'),'Fetch must use assignment-compatible pageNumber');
const start=source.indexOf('  const fetchAllStudents = async function fetchAllStudents(');
const end=source.indexOf('  const band = row => {',start);
assert(start>0&&end>start,'Must find real project fetching function');
const sourceFunction=source.slice(start,end);
const factory=new Function('projectParams','expectedStudentCount','postForm','parseStudentsHtml','studentIdKey','compareNames','state',sourceFunction+' return fetchAllStudents;');
const students=Array.from({length:73},(_,i)=>({studentId:String(1000001+i),name:'طالب '+(i+1),totalGrade:20,grade:0}));
const postMock=(behavior,log)=>async(url,params)=>{
 assert.equal(url,'/Projects/Projects/GetGradeStudentsList');
 assert(params.ProjectId&&params.PublishedProjectId);
 const page=Number(params.pageNumber??params.PageNumber??1);
 log.push({page,style:params.pageNumber?'camel':'legacy'});
 if(behavior==='repeat')return 'p1';
 if(behavior==='shortfall')return page===1?'p1':'empty';
 return page<=4?'p'+page:'empty';
};
const parse=(value)=>value==='empty'?[]:students.slice((Number(value.slice(1))-1)*20,Number(value.slice(1))*20);
const make=(behavior,expected)=>{
 const state={};
 const log=[];
 const load=factory(()=>({ProjectId:'P',PublishedProjectId:'Q'}),()=>expected,postMock(behavior,log),parse,String,((a,b)=>a.localeCompare(b,'ar')),state);
 return {load,state,log};
};
const full=make('all',73),fullRows=await full.load();
assert.equal(fullRows.length,73,'Must fetch all four server pages');
assert.equal(new Set(fullRows.map(x=>x.studentId)).size,73);
assert.equal(full.state.fetchAudit.complete,true,'Empty server page after 73 records certifies count');
assert.equal(full.state.fetchAudit.pages,4);
assert(full.log.some(x=>x.page===5),'Must reach pagination end');
const repeat=make('repeat',73),repeatRows=await repeat.load();
assert.equal(repeatRows.length,20);
assert.equal(repeat.state.fetchAudit.complete,false,'Replayed page one must never be marked complete');
assert.equal(repeat.state.fetchAudit.reason,'repeated_page');
const short=make('shortfall',73),shortRows=await short.load();
assert.equal(shortRows.length,20);
assert.equal(short.state.fetchAudit.complete,false,'Fewer students than roster is incomplete');
assert.equal(short.state.fetchAudit.reason,'roster_shortfall');

// Navigation is over all fetched rows; it does not change summary/export source.
const pstart=source.indexOf('  const paintStudentsPage = function paintStudentsPage(');
const pend=source.indexOf('  // لوحة واحدة تتشارك فلاترها',pstart);
assert(pstart>0&&pend>pstart,'Real student table paginator');
const state={studentPage:1,studentPageSize:20,students:students.slice(),loading:false,fetchAudit:{complete:true,pages:4,expected:73}};
const fields=new Map(),getElementById=id=>{
 if(!fields.has(id))fields.set(id,{textContent:'',disabled:false,innerHTML:'',classList:{toggle(){}}});
 return fields.get(id);
};
const table={innerHTML:''},draw=new Function('state','document','rowHtml','APP',source.slice(pstart,pend)+'return paintStudentsPage;')(
 state,{getElementById},(r,i)=>'<tr data-row="'+i+'">'+r.name+'</tr>','MAIP'
);
draw(students,table);
assert.equal((table.innerHTML.match(/<tr /g)||[]).length,20);
assert.equal(fields.get('MAIP-page-next').disabled,false);
state.studentPage=4;draw(students,table);
assert.equal((table.innerHTML.match(/<tr /g)||[]).length,13);
assert.equal(fields.get('MAIP-page-next').disabled,true);
state.studentPageSize='all';state.studentPage=1;draw(students,table);
assert.equal((table.innerHTML.match(/<tr /g)||[]).length,73);
// Deep report must not stop when a page has fewer than twenty students.
const deepStart=source.indexOf('  const fetchGradeAnalysis = async function fetchGradeAnalysis(');
const deepEnd=source.indexOf('  const deepSummaryOf =',deepStart);
assert(deepStart>0&&deepEnd>deepStart,'Actual deep-scan implementation');
const deepFactory=new Function('state','getDocument','verifiedProjectEnd','paramsFromGradeDoc','expectedStudentCount','postForm','parseStudentsHtml','studentIdKey',source.slice(deepStart,deepEnd)+'return fetchGradeAnalysis;');
const deepStudents=students.slice(0,15);
const analyze=(repeat)=>{
 const audit={deepByUrl:new Map()},calls=[];
 const post=async(url,params)=>{
  const page=Number(params.pageNumber??params.PageNumber??1);
  calls.push(page);
  return repeat?'d1':page<=2?'d'+page:'empty';
 };
 const parse=html=>html==='d1'?deepStudents.slice(0,7):html==='d2'?deepStudents.slice(7):[];
 const fn=deepFactory(audit,async()=>({}),()=> 'ended',()=>({ProjectId:'A',PublishedProjectId:'B'}),()=>15,post,parse,String);
 return {fn,calls};
};
const deep=analyze(false),detail=await deep.fn('https://schools.madrasati.sa/Projects/Projects/GradeProject/mock',{remaining:20});
assert.equal(detail.status,'ready','15 students over 7+8-sized pages must be complete');
assert.equal(detail.rows.length,15);
assert(deep.calls.includes(3),'Must request empty final page even if previous page has fewer than 20 students');
const stuck=analyze(true),partial=await stuck.fn('https://schools.madrasati.sa/Projects/Projects/GradeProject/repeat',{remaining:20});
assert.equal(partial.status,'partial','Repeating first page may not be reported as ready');
assert.equal(partial.rows.length,7);

console.log('✓ Projects: 73 students/4 server pages, repeated-page defense, partial roster write-block, 20/13/all table navigation.');
