// Offline tests: project group labels, cover, project-wide progress from OCE. Fake OCE client, no network.
const test=require('node:test'),assert=require('node:assert');
const {routes,list}=require('../modules/projects');
const {J,T}=require('../lib/ctx');
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
  // client resolves project labels by id string (getLabelFromHistory), so project.labels holds ids only
  const a=out[0].labels[0],b=out[2].labels[0];
  assert.equal(typeof a,'string');
  assert.match(a,/^[0-9a-f]{24}$/);
  assert.equal(out[1].labels[0],a);
  assert.notEqual(b,a);
  assert.equal(groupLabel({metadata:{mizito_group:'گروه الف'}})._id,a);
});

test('group label: missing or blank metadata gives no label',async()=>{
  const c=ctx([proj(4),proj(5,{metadata:{mizito_group:'   '}}),proj(6,{metadata:{mizito_group:42}})],{});
  for(const p of await list(c))assert.deepEqual(p.labels,[],p.title);
});

test('labels/getAll: every distinct group only, label_status matches',async()=>{
  const c=ctx([proj(1,{metadata:{mizito_group:'گروه الف'}}),proj(2,{metadata:{mizito_group:'گروه الف'}}),proj(3,{metadata:{mizito_group:'گروه ب'}}),proj(4)],{},{type:'project'});
  const r=await routes['/api/labels/getAll'](c);
  const ids=r.labels.map(l=>l._id);
  assert.equal(ids.length,2);
  assert.ok(!ids.includes('0000000000000000000000a1'));
  assert.deepEqual(r.label_status.map(s=>s.label_id),ids);
  const pl=(await list(c)).find(p=>p.title==='پروژه 1').labels[0];
  assert.ok(ids.includes(pl));
});

test('labels: every id in project labels exists in labels/getAll (ids are strings, no nulls)',async()=>{
  const projs=[proj(1,{metadata:{mizito_group:'گروه الف'}}),proj(2,{metadata:{mizito_group:'گروه ب'}}),proj(3)];
  const c=ctx(projs,{},{type:'project'});
  const ids=new Set((await routes['/api/labels/getAll'](c)).labels.map(l=>l._id));
  for(const p of await list(c))for(const id of p.labels){assert.equal(typeof id,'string');assert.ok(ids.has(id),p.title)}
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

// Covers: gateway cover dir (lib/cover-store), GET /cdn/cover/<id> (modules/cover), has-cover flag.
{
const fs=require('fs'),os=require('os'),path=require('path');
const {coverFile,hasCoverFile}=require('../lib/cover-store');
const {handle}=require('../modules/cover');
const {coverFields}=require('../lib/project-meta');
const {Unauthorized}=require('../lib/oce');
const mkdir=()=>fs.mkdtempSync(path.join(os.tmpdir(),'gw-cover-'));
const JPEG=Buffer.from('ffd8ffe000104a46494600010100000100010000ffd9','hex');
const PNG=Buffer.from('89504e470d0a1a0a0000000d49484452','hex');
function fakeRes(){const r={status:0,headers:{},body:null,writeHead(c,h){r.status=c;r.headers=h||{}},end(b){r.body=b===undefined?null:b}};return r}

test('cover store: id validated, extension to content-type, missing and traversal rejected',()=>{
  const dir=mkdir();const id=UUID(7);
  fs.writeFileSync(path.join(dir,id+'.jpg'),JPEG);fs.writeFileSync(path.join(dir,UUID(8)+'.png'),PNG);
  assert.deepEqual(coverFile(id,dir),{file:path.join(dir,id+'.jpg'),type:'image/jpeg'});
  assert.equal(coverFile(UUID(8),dir).type,'image/png');
  assert.equal(coverFile(UUID(9),dir),null);
  assert.equal(coverFile('../'+id,dir),null);
  assert.equal(coverFile(id+'/../x',dir),null);
  assert.equal(coverFile('ABCDEF',dir),null);
  assert.equal(hasCoverFile(id,dir),true);
  assert.equal(hasCoverFile(UUID(9),dir),false);
});

test('cover route: serves bytes to owner, 404 missing/foreign/traversal, 401 without session',async()=>{
  const dir=mkdir();const mine=UUID(1),other=UUID(2),none=UUID(3);
  fs.writeFileSync(path.join(dir,mine+'.jpg'),JPEG);fs.writeFileSync(path.join(dir,other+'.jpg'),JPEG);
  const make=async()=>ctx([proj(1),proj(3)],{});
  let r=fakeRes();await handle(r,mine,{make,dir});
  assert.equal(r.status,200);assert.equal(r.headers['content-type'],'image/jpeg');assert.equal(r.headers['cache-control'],'private, max-age=300');
  assert.ok(Buffer.compare(r.body,JPEG)===0);
  r=fakeRes();await handle(r,none,{make,dir});assert.equal(r.status,404);
  r=fakeRes();await handle(r,other,{make,dir});assert.equal(r.status,404,'file exists but project not in caller list');
  r=fakeRes();await handle(r,'../'+mine,{make,dir});assert.equal(r.status,404);
  r=fakeRes();await handle(r,mine,{make:async()=>{throw new Unauthorized()},dir});assert.equal(r.status,401);
});

test('cover flag: file on disk gives cover_has_photo + BASE cover URL; picture_url still wins',()=>{
  const id=UUID(4);
  assert.deepEqual(coverFields(proj(4),true),{cover_has_photo:true,cover_file:'/_rs/cdn/cover/'+id,cover_variant:'photo_large'});
  assert.equal(coverFields(proj(4),false).cover_has_photo,false);
  assert.equal(coverFields(proj(4,{picture_url:'https://x/y.jpg'}),true).cover_file,'https://x/y.jpg');
});

test('project photo object: cover file gives photo_medium/photo_large cv-<id> keys, no file gives none',()=>{
  const {coverPhoto,coverKeyId}=require('../lib/project-meta');
  const id=UUID(5),p=proj(5);
  assert.equal(coverPhoto(p,false),null);
  const ph=coverPhoto(p,true);
  assert.equal(ph._id,id.replace(/-/g,''));
  assert.equal(ph.photo_medium.content_key,'cv-'+id);assert.equal(ph.photo_medium.content,'cv-'+id);
  assert.equal(ph.photo_large.content_key,'cv-'+id);assert.equal(ph.photo_medium.size,-1);
  assert.equal(ph.photo_medium.w,256);assert.equal(ph.photo_medium.h,256);
  assert.equal(coverKeyId('cv-'+id),id);assert.equal(coverKeyId('dl/cv-'+id),id);
  assert.equal(coverKeyId('av-'+'a'.repeat(24)),null);assert.equal(coverKeyId('cv-../x'),null);assert.equal(coverKeyId('cv-'+id+'/..'),null);
});

test('project photo object: list() adds photo only when cover file exists',async()=>{
  const out=await list(ctx([proj(6),proj(7,{picture_url:'https://x/z.jpg'})],{}));
  assert.equal(out[0].photo,undefined);
  assert.equal(out[1].photo,undefined);
});
}
