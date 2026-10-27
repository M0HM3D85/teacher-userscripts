import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync('scripts/madrasati-projects-intelligence/madrasati-projects-intelligence.user.js','utf8');
assert.match(source,/^\/\/ @version\s+1\.6\.0-beta1$/m);
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
console.log('✓ Projects: 73 students/4 server pages, repeated-page defense, partial roster write-block, 20/13/all table navigation.');
