// Offline test: private room (default MIZITO_HIDE_PRIVATE_ROOM_IDS) is hidden from non-admin callers in chat list, history, send, file and project paths; admin sees it; empty flag disables. Run: NODE_PATH=/home/alborz/RSD/drivers/node_modules node --test test/gw-private-room.test.js
const test=require('node:test'),assert=require('node:assert');
const path=require('node:path');const {execFileSync}=require('node:child_process');
const {routes,hiddenDoc,roomOf}=require('../modules/chat.js');const {hex}=require('../lib/oce');
const PR=require('../lib/private-rooms');
const PRIV='c245187c-56c0-4d5e-9a0c-391cbd7f4a19';
const ME='aaaaaaaa-0000-0000-0000-000000000001',PEER='cccccccc-0000-0000-0000-000000000003';
const DOC='55555555-0000-0000-0000-000000000001';
const rooms=[
  {id:'11111111-0000-0000-0000-000000000001',kind:'dm',name:'C',member_ids:[ME,PEER],last_message_at:'2026-11-20T00:00:00Z'},
  {id:PRIV,kind:'project',name:'عمومی',project_id:'22222222-0000-0000-0000-000000000001',member_ids:[],last_message_at:'2026-11-21T00:00:00Z'},
  {id:'33333333-0000-0000-0000-000000000001',kind:'group',name:'g',member_ids:[ME],last_message_at:'2026-11-01T00:00:00Z'}];
const msgs=[{id:'44444444-0000-0000-0000-000000000001',room_id:PRIV,author_id:PEER,text:'private hi',created_at:'2026-11-21T00:00:00Z',document_ids:[DOC]}];
// fake OCE client + request context; role = OCE user role of the caller
function ctx(role,token,body,rs){
  const oce={token,get:async p=>{
    if(p==='/team-chat/rooms/')return rs||rooms;
    if(p==='/team-chat/colleagues/')return [{id:PEER,full_name:'C'}];
    const m=/^\/team-chat\/rooms\/([^/]+)\/messages\//.exec(p);
    if(m)return msgs.filter(x=>hex(x.room_id)===hex(m[1]));
    return []},pages:async()=>[]};
  const me={id:ME,hexId:hex(ME),name:'A',role};
  return {oce,me,b:body||{},iso:x=>x||'',J:x=>x,T:{}};
}
const docName=p=>p+'-'+DOC.replace(/-/g,'');

test('non-admin: hidden room absent from getDialogs, other rooms kept',async()=>{
  const out=await routes['/api/chat/getDialogs'](ctx('viewer','tokPrivList'));
  const ids=out.dialogs.map(d=>d._id);
  assert.ok(!ids.includes(hex(PRIV)));
  assert.ok(ids.includes(hex(rooms[0].id)));
  assert.ok(ids.includes(hex(rooms[2].id)));
});

test('null or unknown role fails closed (hidden)',async()=>{
  const out=await routes['/api/chat/getDialogs'](ctx(null,'tokPrivNull'));
  assert.ok(!out.dialogs.map(d=>d._id).includes(hex(PRIV)));
  const out2=await routes['/api/chat/getDialogs'](ctx('editor','tokPrivEditor'));
  assert.ok(!out2.dialogs.map(d=>d._id).includes(hex(PRIV)));
});

test('non-admin: direct room id gated; history/chat view empty; send unknown dialog',async()=>{
  const c=ctx('viewer','tokPrivDirect',{dialog:hex(PRIV)});
  assert.equal(PR.hiddenId(c,c.b.dialog),true);
  assert.deepEqual(await routes['/api/chat/getHistory'](c),[]);
  assert.deepEqual(await routes['/api/chat/getChatView'](c),{});
  assert.deepEqual(await routes['/api/chat/getFullChat'](c),{});
  await assert.rejects(routes['/api/chat/send'](ctx('viewer','tokPrivSend',{dialog:hex(PRIV),message:'x'})),/unknown dialog/);
});

test('non-admin: hiddenDoc true for doc of hidden room, false for unknown doc',async()=>{
  const c=ctx('viewer','tokPrivDoc');
  assert.equal(await hiddenDoc(c,docName('ph')),true);
  assert.equal(await hiddenDoc(c,'dl-'+DOC),true);
  assert.equal(await hiddenDoc(c,'ph-'+'9'.repeat(32)),false);
  assert.equal(await hiddenDoc(c,'av-'+hex(ME)),false);
});

test('admin role: hidden room visible in getDialogs and history, docs not gated',async()=>{
  const c=ctx('admin','tokPrivAdmin',{dialog:hex(PRIV)});
  const out=await routes['/api/chat/getDialogs'](c);
  assert.ok(out.dialogs.map(d=>d._id).includes(hex(PRIV)));
  assert.equal(PR.hiddenId(c,c.b.dialog),false);
  const h=await routes['/api/chat/getHistory'](c);
  assert.ok(h.length>=1);
  assert.equal(await hiddenDoc(c,docName('ph')),false);
});

test('flag empty string disables the gate (child process env)',()=>{
  const env=Object.assign({},process.env,{MIZITO_HIDE_PRIVATE_ROOM_IDS:''});
  const out=execFileSync(process.execPath,['-e',"const PR=require('./lib/private-rooms');process.stdout.write(String(PR.hiddenId({me:{role:'viewer'}},'"+PRIV+"')))"],{cwd:path.join(__dirname,'..'),env,encoding:'utf8'});
  assert.equal(out,'false');
});

test('flag unset uses default room id (child process env)',()=>{
  const env=Object.assign({},process.env);delete env.MIZITO_HIDE_PRIVATE_ROOM_IDS;
  const out=execFileSync(process.execPath,['-e',"const PR=require('./lib/private-rooms');process.stdout.write(String(PR.hiddenId({me:{role:'viewer'}},'"+PRIV+"')))"],{cwd:path.join(__dirname,'..'),env,encoding:'utf8'});
  assert.equal(out,'true');
});

test('admin role list is configurable (child process env)',()=>{
  const env=Object.assign({},process.env,{MIZITO_PRIVATE_ROOM_ADMIN_ROLES:'manager'});
  const out=execFileSync(process.execPath,['-e',"const PR=require('./lib/private-rooms');process.stdout.write(String(PR.hiddenId({me:{role:'manager'}},'"+PRIV+"'))+','+String(PR.hiddenId({me:{role:'admin'}},'"+PRIV+"')))"],{cwd:path.join(__dirname,'..'),env,encoding:'utf8'});
  assert.equal(out,'false,true');
});

test('DM canonical pick would be the hidden room: non-admin never gets it, cache not shared across roles',async()=>{
  const OTHER='66666666-0000-0000-0000-000000000001';
  const dmRooms=[
    {id:PRIV,kind:'dm',name:'C',member_ids:[ME,PEER],last_message_at:'2026-11-25T00:00:00Z'},
    {id:OTHER,kind:'dm',name:'C',member_ids:[ME,PEER],last_message_at:'2026-11-10T00:00:00Z'}];
  const tok='tokCanonPriv';
  const viewer=ctx('viewer',tok,{},dmRooms);
  assert.equal(await roomOf(viewer,hex(PRIV)),null);
  const v=await roomOf(viewer,hex(OTHER));
  assert.ok(v&&v.id===OTHER,'non-admin remap must stay visible');
  const dl=await routes['/api/chat/getDialogs'](viewer);
  assert.ok(!dl.dialogs.map(d=>d._id).includes(hex(PRIV)));
  // same token, admin first, then non-admin: canonical cache must not carry the hidden pick
  const admin=ctx('admin',tok,{},dmRooms);
  const a=await roomOf(admin,hex(OTHER));
  assert.ok(a&&a.id===PRIV,'admin canonical pick is the newest DM (hidden room)');
  const v2=await roomOf(ctx('viewer',tok,{},dmRooms),hex(OTHER));
  assert.ok(v2&&v2.id===OTHER,'viewer after admin on same token still gets visible room');
});
