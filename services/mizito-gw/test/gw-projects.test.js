// Offline tests: project group labels, cover, project-wide progress from OCE. Fake OCE client, no network.
const test=require('node:test'),assert=require('node:assert');
const {routes,list}=require('../modules/projects');
const {PLABEL,J,T}=require('../lib/ctx');
const {hex}=require('../lib/oce');
const {groupLabel}=require('../lib/project-meta');

let seq=0;
// Fake per-request context. Unique token per test so the TTL memo never leaks between tests.
function ctx(projects,stats,b={}){
  const token='tok-gw-projects-'+(++seq);
  const calls=[];
  const oce={token,
    get:async p=>{calls.push(p);
      if(p.startsWith('/team-chat/'))return [];
      if(p.startsWith('/tasks/stats/')){const id=new URL('http://x'+p).searchParams.get('project_id');if(!(id in stats))throw new Error('oce 403');return stats[id]}
      if(p.includes('/members/'))throw new Error('oce 404');
      if(p.startsWith('/tasks/my-tasks/'))throw new Error('must not call caller-only my-tasks');
      throw new Error('unexpected '+p)},
    pages:async()=>projects};
  return {oce,b,J,T,me:{hexId:'0'.repeat(23)+'9',role:'member'},calls};
}
const UUID=n=>`${String(n).padStart(8,"0")}-0000-4000-8000-000000000000`;
const proj=(n,extra={})=>({id:UUID(n),name:'پروژه '+n,status:'active',owner_id:null,metadata:{},picture_url:null,...extra});

test('group label: metadata.mizito_group -> stable {_id,title,color}; same title same id',async()=>{
  const c=ctx([proj(1,{metadata:{mizito_group:'گروه الف'}}),proj(2,{metadata:{mizito_group:'گروه الف'}}),proj(3,{metadata:{mizito_group:'گروه ب'}})],{});
  const out=await list(c);
  const a=out[0].labels[0],b=out[2].labels[0];
  assert.equal(typeof a,'object');
  assert.equal(a.title,'گروه الف');
  assert.match(a._id,/^[0-9a-f]{24}$/);
  assert.equal(out[1].labels[0]._id,a._id);
  assert.notEqual(b._id,a._id);
  assert.deepEqual(groupLabel({metadata:{mizito_group:'گروه الف'}}),a);
});

test('group label: missing or blank metadata falls back to PLABEL',async()=>{
  const c=ctx([proj(4),proj(5,{metadata:{mizito_group:'   '}}),proj(6,{metadata:{mizito_group:42}})],{});
  for(const p of await list(c))assert.deepEqual(p.labels,[PLABEL],p.title);
});

test('labels/getAll: PLABEL plus every distinct group, label_status matches',async()=>{
  const c=ctx([proj(1,{metadata:{mizito_group:'گروه الف'}}),proj(2,{metadata:{mizito_group:'گروه الف'}}),proj(3,{metadata:{mizito_group:'گروه ب'}}),proj(4)],{},{type:'project'});
  const r=await routes['/api/labels/getAll'](c);
  const ids=r.labels.map(l=>l._id);
  assert.equal(ids[0],PLABEL);
  assert.equal(ids.length,3);
  assert.deepEqual(r.label_status.map(s=>s.label_id),ids);
  const pl=(await list(c)).find(p=>p.title==='پروژه 1').labels[0];
  assert.ok(ids.includes(pl._id));
});

test('labels/getAll: non-project type stays empty',async()=>{
  const r=await routes['/api/labels/getAll'](ctx([proj(1)],{},{type:'task'}));
  assert.deepEqual(r,{labels:[],label_status:[]});
});

test('cover: picture_url -> cover_has_photo + cover_file; null keeps placeholder',async()=>{
  const url='https://s3.example/presigned/abc.jpg';
  const out=await list(ctx([proj(1,{picture_url:url}),proj(2)],{}));
  assert.equal(out[0].cover_has_photo,true);
  assert.equal(out[0].cover_file,url);
  assert.equal(out[1].cover_has_photo,false);
  assert.equal(out[1].cover_file,null);
  assert.equal(out[1].cover_variant,null);
});

test('progress: allSummary uses project-wide /tasks/stats counts, not my-tasks',async()=>{
  const p1=proj(1),p2=proj(2),p3=proj(3,{status:'archived'});
  const stats={[p1.id]:{total:10,completed_count:4,by_status:{}},[p2.id]:{total:0,completed_count:0}};
  const c=ctx([p1,p2,p3],stats);
  const r=await routes['/api/projects/allSummary'](c);
  assert.equal(r.summaries.length,2);
  const s1=r.summaries.find(s=>s.project===hex(p1.id));
  assert.equal(s1.total_tasks,10);
  assert.equal(s1.total_tasks_count,10);
  assert.equal(s1.others_completed,4);
  assert.equal(s1.others_completed_count,4);
  assert.ok(!c.calls.some(p=>p.includes(p3.id)),'archived project must not be counted');
  assert.ok(!c.calls.some(p=>p.includes('my-tasks')),'caller-only my-tasks must not be used');
});

test('progress: stats error for one project gives zeros, other projects unaffected',async()=>{
  const p1=proj(1),p2=proj(2);
  const r=await routes['/api/projects/allSummary'](ctx([p1,p2],{[p1.id]:{total:5,completed_count:5}}));
  const s2=r.summaries.find(s=>s.project===hex(p2.id));
  assert.equal(s2.total_tasks,0);
  assert.equal(s2.others_completed,0);
  assert.equal(r.summaries.find(s=>s.project===hex(p1.id)).others_completed,5);
});
