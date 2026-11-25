// Offline test: duplicate DM rooms with the same peer must yield one dialog per peer (client TypeError undefined.dialog_type otherwise). Run: node --test test/
const test=require('node:test'),assert=require('node:assert');
const {routes}=require('../modules/chat.js');const {hex}=require('../lib/oce');
const misc=require('../modules/misc.js').routes;

test('two DM rooms with same peer -> one dialog per peer; groups kept',async()=>{
  const A='aaaaaaaa-0000-0000-0000-000000000001',P='cccccccc-0000-0000-0000-000000000003';
  const rooms=[{id:'11111111-0000-0000-0000-000000000001',kind:'dm',name:'C',member_ids:[A,P],last_message_at:'2026-11-20T00:00:00Z'},
    {id:'11111111-0000-0000-0000-000000000002',kind:'dm',name:'C',member_ids:[A,P],last_message_at:'2026-11-10T00:00:00Z'},
    {id:'11111111-0000-0000-0000-000000000003',kind:'group',name:'g',member_ids:[A],last_message_at:'2026-11-01T00:00:00Z'}];
  const c={oce:{token:'tokDedupe',get:async p=>{if(p==='/team-chat/rooms/')return rooms;if(p==='/team-chat/colleagues/')return [{id:P,full_name:'C'}];throw new Error('unexpected '+p)},pages:async()=>[]},me:{id:A,hexId:hex(A),name:'A'},iso:x=>x||'',J:x=>x};
  const out=await routes['/api/chat/getDialogs'](c);
  const dms=out.dialogs.filter(d=>!d.is_group);
  assert.equal(dms.length,1);assert.equal(dms[0]._id,hex(rooms[0].id));
  assert.equal(out.dialogs.filter(d=>d.is_group).length,1);
  for(const d of out.dialogs)assert.ok(d._id);
});

test('stubs: getPermissions has settings object, getPlans and monitor/customers are arrays',async()=>{
  const perms=await misc['/api/workspace/getPermissions']();
  assert.equal(typeof perms.settings,'object');assert.equal(typeof perms.settings.support_workspace_roles,'boolean');
  assert.ok(Array.isArray(await misc['/api/workspace/getPlans']()));
  assert.ok(Array.isArray(await misc['/api/monitor/customers']()));
});
