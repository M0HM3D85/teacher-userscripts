import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const file='scripts/madrasati-teaching-tasks-intelligence/madrasati-teaching-tasks-intelligence.user.js';
const code=readFileSync(file,'utf8');
const start=code.indexOf('  const confirmProjectImport = ');
const end=code.indexOf('    const saveImport',start);
assert(start>0&&end>start,'Project confirmation helper must precede saving');
assert(code.slice(end,end+10000).includes('if(!await confirmProjectImport('),'Save must await its own confirmation');
const helper=code.slice(start,end).trim().replace(/^const confirmProjectImport = /,'').replace(/;\s*$/,'');
assert(helper.startsWith('function confirmProjectImport'),'Use the actual confirmation function');

const registry=new Map(),events=new Map();
const doc={activeElement:null};
class MockEl {
 constructor(tag='div'){
  this.tag=tag;this.children=[];this.textContent='';this.attrs={};
  this.style={cssText:'',setProperty(k,v,priority){this[k]=v;this.priority=priority;}};
  this.listeners=new Map();this.parent=null;
 }
 set id(v){this._id=v;registry.set(v,this)}
 get id(){return this._id}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,cb){if(!this.listeners.has(k))this.listeners.set(k,[]);this.listeners.get(k).push(cb);}
 appendChild(node){node.parent=this;this.children.push(node);return node;}
 append(...nodes){nodes.forEach(x=>this.appendChild(x));}
 remove(){registry.delete(this.id);if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 focus(){doc.activeElement=this;}
 trigger(k,evt={}){for(const cb of this.listeners.get(k)||[])cb(evt);}
}
doc.body=new MockEl('body');
doc.createElement=tag=>new MockEl(tag);
doc.getElementById=id=>registry.get(id)||null;
doc.addEventListener=(k,cb)=>{if(!events.has(k))events.set(k,new Set());events.get(k).add(cb)};
doc.removeEventListener=(k,cb)=>events.get(k)?.delete(cb);
const confirmImport=new Function('APP','document','return ('+helper+');')('MAIP',doc);
function controls(){
 const overlay=doc.getElementById('MAIP-save-confirm');
 assert(overlay,'Project confirmation must exist in document.body');
 assert(overlay.parent===doc.body,'Confirmation must not be nested inside lower import modal');
 assert.equal(Number(overlay.style['z-index']),2147483647,'Confirmation z-index must exceed import dialog z-index 2147483645');
 assert.equal(overlay.attrs['aria-modal'],'true');
 const buttons=[];const queue=[overlay];
 while(queue.length){const el=queue.shift();if(el.tag==='button')buttons.push(el);queue.push(...el.children)}
 const yes=buttons.find(b=>b.textContent.includes('نعم'));
 const no=buttons.find(b=>b.textContent==='إلغاء');
 assert(yes&&no,'Explicit YES/NO controls');
 return {overlay,yes,no};
}

// Pressing Cancel dismisses confirmation without approval or network calls.
let p=confirmImport('حفظ تجريبي؟');
let {no}=controls();no.trigger('click');
assert.equal(await p,false);
assert.equal(doc.getElementById('MAIP-save-confirm'),null);

// Confirm YES returns true and cannot be mistaken for a background click.
p=confirmImport('حفظ تجريبي؟');
let {yes}=controls();
yes.trigger('click');
assert.equal(await p,true);
assert.equal(doc.getElementById('MAIP-save-confirm'),null);

// Escape returns false.
p=confirmImport('حفظ تجريبي؟');
let prevented=false;
for(const cb of events.get('keydown')||[])cb({key:'Escape',preventDefault(){prevented=true}});
assert.equal(await p,false);assert(prevented);
assert.equal(doc.getElementById('MAIP-save-confirm'),null);

// Reentrant clicks do not open a second overlapping confirmation.
p=confirmImport('حفظ تجريبي؟');
assert.equal(await confirmImport('duplicate'),false);
controls().no.trigger('click');
assert.equal(await p,false);
console.log('✓ Project confirmation stays on top of import modal, YES/NO/Escape work, and save awaits approval.');
