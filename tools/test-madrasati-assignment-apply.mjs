import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const sha='2c779aed06435d7e99ba94a3212ac40bf20317f1';
const file='scripts/madrasati-assignment-intelligence/madrasati-assignment-intelligence.user.js';
const base=execFileSync('git',['show',sha+':'+file],{encoding:'utf8'});
const current=readFileSync('scripts/madrasati-teaching-tasks-intelligence/madrasati-teaching-tasks-intelligence.user.js','utf8');
const enhanced=readFileSync(file,'utf8');
assert(base.includes('const VERSION = \'1.1.7\''),'Pinned stable core expected');
assert(current.includes('@require      https://cdn.jsdelivr.net/gh/M0HM3D85/teacher-userscripts@'+sha+'/'+file),'Unified must load the original pinned stable core');
assert(!current.includes('const VERSION = \'1.1.7\''),'No double initialization of assignment core');
assert(!current.includes('    // Core v1.1.7 (bundled locally'),'Bundled core must be removed');
// The assignment enhancement must be byte-for-byte identical to the working standalone script
// except for its visible version string.
const strip=s=>s.replace(/^\/\/ ==UserScript==[\s\S]*?^\/\/ ==\/UserScript==\s*/m,'').trim();
const original=strip(enhanced).replace("const VERSION = '1.4.8';","const VERSION = '2.0.0-beta6';");
assert(current.includes(original),'Assignment enhancement has been modified beyond its version label');

const nodes=new Map();
class Element {
  constructor(tag='div'){this.tagName=tag;this.listeners=new Map();this.children=[];this.parentElement=null;
    this.style={};this.dataset={};this.classList={add(){},remove(){},toggle(){}};this.hidden=false;this.innerHTML='';this.textContent='';}
  set id(value){this._id=value;nodes.set(value,this);}
  get id(){return this._id||'';}
  addEventListener(name,cb){if(!this.listeners.has(name))this.listeners.set(name,[]);this.listeners.get(name).push(cb);}
  appendChild(child){this.children.push(child);child.parentElement=this;return child;}
  append(...children){children.forEach(x=>this.appendChild(x));}
  insertBefore(child){return this.appendChild(child);}
  remove(){if(this.parentElement){this.parentElement.children=this.parentElement.children.filter(x=>x!==this)}if(this.id)nodes.delete(this.id);}
  focus(){}
}
const doc={
  head:new Element('head'),body:new Element('body'),
  createElement:tag=>new Element(tag),
  getElementById:id=>nodes.get(id)||(id==='MAI-close'?new Element('button'):null),
  querySelector:()=>mount,
  querySelectorAll:()=>[]
};
const mount=new Element('main');
const store=()=>{const m=new Map();return {getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k)}};
const sandbox={document:doc,location:{pathname:'/Teacher/Assignments/GradeAssignment/123',href:'https://schools.madrasati.sa/Teacher/Assignments/GradeAssignment/123',origin:'https://schools.madrasati.sa',search:''},
  localStorage:store(),sessionStorage:store(),URL,console,setTimeout:()=>0,clearTimeout:()=>{},Intl};
sandbox.globalThis=sandbox;
vm.runInNewContext(base,sandbox,{filename:'pinned-assignment-core.user.js',timeout:3000});
const core=sandbox.MadrasatiAssignmentIntelligence;
assert(core,'Pinned core must export API');
const modal=nodes.get('MAI-modal');
assert(modal?.listeners.get('click')?.length===1,'Assignment modal must register delegated click handling');
core.state.busy=false;
core.state.importSession={fileName:'mock-assignment.csv'};
core.state.importPreview={counts:{zeroDecision:0},rows:[{status:'ready',applicable:true,student:{studentId:'101',name:'أحمد'},newGrade:20,nextFeedback:''}]};
let prevented=false;
const button={dataset:{maiAction:'applyImport'},closest:()=>button};
const action=modal.listeners.get('click')[0]({target:button,preventDefault(){prevented=true;}});
assert.equal(prevented,true,'Apply action must prevent default');
const trace=JSON.parse(sandbox.sessionStorage.getItem('MAI_GRADE_IMPORT_TRACE_V2')||'[]');
assert(trace.some(x=>x.type==='APPLY_ENTER'),'Apply click must enter real applyImportPreview()');
assert(trace.some(x=>x.type==='CONFIRM_OPEN'),'Apply click must launch the real confirmation step');
const confirm=nodes.get('MAI-import-confirm');
assert(confirm,'Clicking Apply must display the confirmation overlay');
assert(confirm.children.length>0,'Confirmation must have visible content');
// Cancel the synthetic confirmation: this test must NEVER post grades.
const stack=[confirm],buttons=[];
while(stack.length){const item=stack.pop();if(item.tagName==='button')buttons.push(item);stack.push(...item.children)}
const no=buttons.find(x=>x.textContent==='لا');
assert(no?.listeners.get('click')?.length,'Confirmation needs a cancel action');
no.listeners.get('click')[0]();
await action;
const after=JSON.parse(sandbox.sessionStorage.getItem('MAI_GRADE_IMPORT_TRACE_V2')||'[]');
assert(after.some(x=>x.type==='CONFIRM_RESULT'&&x.confirmed===false),'Cancellation must be captured');
assert(!after.some(x=>x.type==='POST_START'||x.type==='POST_COMPLETE'),'Cancel must not write any grades');
console.log('✓ Pinned assignment core, exact enhanced module, Apply click → confirmation → safe cancel: passed.');
