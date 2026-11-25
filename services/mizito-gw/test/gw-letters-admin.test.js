// Offline: admin-only read of Mizito-export letters (modules/letters.js). Fake OCE, no network.
const test=require('node:test'),assert=require('node:assert');
const {routes}=require('../modules/letters');

const PROJ='d4665ee3-30a7-427c-9e43-e0d541caa03e';
const uid=i=>String(i).padStart(8,'0')+'-0000-4000-8000-000000000000';
// 1033 Mizito-export rows: inbox 978, outbox 23, archived 32 (owner export shape), plus 2 native rows without source
const rows=[];
for(let i=0;i<1033;i++){
  const box=i<978?'inbox':i<1001?'outbox':'archived';
  rows.push({id:uid(i+1),subject:'نامه '+i,notes:'<p>متن '+i+'</p>',date_sent:'2025-01-'+String(1+(i%28)).padStart(2,'0'),created_at:'2026-10-26T00:00:00Z',
    attachments_count:0,metadata:{source:'mizito-export',thread:uid(i+1).slice(0,8)+'0000',from:'فرستنده '+(i%22),to:['گیرنده '+(i%31)],box,mizito_files:i%5===0?[{name:'a.jpg',size:10}]:[]}});
}
rows.push({id:uid(5000),subject:'native 1',notes:'x',date_sent:'2025-02-01',metadata:{}});
rows.push({id:uid(5001),subject:'native 2',notes:'y',date_sent:'2025-02-02',metadata:{}});

const calls=[];
const ctx=(role,token,mode='inbox')=>({me:{role},b:{mode},T:{letter:{}},J:x=>Object.assign({},x),iso:s=>s?new Date(s).toISOString():null,
  oce:{token,pages:async p=>{calls.push({token,p});return p.includes('project_id='+PROJ)?rows:[]},get:async()=>({}),post:async()=>({})}});

test('admin manager sees 978 inbox Mizito rows with names',async()=>{
  const r=await routes['/api/inbox/getInbox'](ctx('manager','tok-admin-1'));
  const mz=r.filter(x=>x.box==='inbox');
  assert.equal(mz.length,978);
  assert.ok(mz.every(x=>x.from&&x.from.startsWith('dd')&&x.subject));
  assert.equal(r.length,978);
  for(let i=1;i<r.length;i++)assert.ok(String(r[i-1].send_date)>=String(r[i].send_date));
});

test('admin outbox shows 23 rows',async()=>{
  const r=await routes['/api/inbox/getInbox'](ctx('admin','tok-admin-2','outbox'));
  assert.equal(r.length,23);
  assert.ok(r.every(x=>x.box==='outbox'));
});

test('caller token used for the project-scoped read',async()=>{
  assert.ok(calls.some(c=>c.token==='tok-admin-1'&&c.p.includes('/correspondence/?project_id='+PROJ)));
});

test('editor sees no Mizito rows',async()=>{
  const r=await routes['/api/inbox/getInbox'](ctx('editor','tok-editor'));
  assert.equal(r.length,0);
  assert.equal((await routes['/api/inbox/getInbox'](ctx('editor','tok-editor','outbox'))).length,0);
});

test('unknown or missing role sees nothing',async()=>{
  assert.equal((await routes['/api/inbox/getInbox'](ctx(undefined,'tok-none'))).length,0);
  assert.equal((await routes['/api/inbox/getInbox'](ctx(null,'tok-null'))).length,0);
  assert.equal((await routes['/api/inbox/getInbox'](ctx('viewer','tok-viewer'))).length,0);
});

test('admin history returns body, sender and recipients from metadata',async()=>{
  const h=uid(3);
  const o=await routes['/api/inbox/getHistory']({...ctx('admin','tok-admin-3'),b:{thread:h.replace(/-/g,'').slice(0,24)}});
  assert.equal(o.subject,'نامه 2');
  assert.match(o.content,/متن 2/);
  assert.match(o.from,/^dd[0-9a-f]{22}$/);
  assert.equal(o.to.length,1);
  assert.deepEqual(o.messages,[]);
});

test('editor history on a Mizito id returns empty',async()=>{
  const h=uid(3).replace(/-/g,'').slice(0,24);
  const o=await routes['/api/inbox/getHistory']({...ctx('editor','tok-editor-h'),b:{thread:h}});
  assert.deepEqual(o,{});
});

test('admin-only names never go global; only the admin caller gets them',async()=>{
  const LS=require('../lib/letter-senders');const L=require('../modules/letters');
  await routes['/api/inbox/getInbox'](ctx('admin','tok-admin-4'));
  assert.ok(!LS.names().includes('فرستنده 3'));
  assert.ok((await L.mzNames(ctx('admin','tok-admin-4'))).includes('فرستنده 3'));
  assert.deepEqual(await L.mzNames(ctx('editor','tok-editor-n')),[]);
  assert.deepEqual(await L.mzNames(ctx(undefined,'tok-n2')),[]);
  assert.equal((await routes['/api/inbox/getInbox'](ctx('editor','tok-editor-5'))).length,0);
});
