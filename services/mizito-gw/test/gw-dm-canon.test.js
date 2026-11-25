// Offline: ids of a dropped duplicate DM room resolve to the kept room (history merged, ids remapped); otherwise the client loops chat.fixDialogs + workspace.switch. No network.
const test=require('node:test'),assert=require('node:assert');
const {routes}=require('../modules/chat.js');const {hex}=require('../lib/oce');
test('dropped duplicate DM: getChatView/getHistory answer with the kept dialog id',async()=>{
  const A='aaaaaaaa-0000-0000-0000-000000000001',P='cccccccc-0000-0000-0000-000000000003';
  const KEEP='11111111-0000-0000-0000-000000000001',DUP='11111111-0000-0000-0000-000000000002';
  const rooms=[{id:KEEP,kind:'dm',name:'C',member_ids:[A,P],last_message_at:'2026-11-20T00:00:00Z'},{id:DUP,kind:'dm',name:'C',member_ids:[A,P],last_message_at:'2026-11-10T00:00:00Z'}];
  const msg=(id,room,t)=>({id,room_id:room,author_id:P,text:t,created_at:t==='old'?'2026-11-01T00:00:00Z':'2026-11-20T00:00:00Z',document_ids:[]});
  const c={b:{dialog:hex(DUP)},oce:{token:'tokCanon',get:async p=>{if(p==='/team-chat/rooms/')return rooms;if(p==='/team-chat/colleagues/')return [{id:P,full_name:'C'}];
    if(p.startsWith('/team-chat/rooms/'+DUP+'/messages/'))return [msg('22222222-0000-0000-0000-000000000001',DUP,'old')];
    if(p.startsWith('/team-chat/rooms/'+KEEP+'/messages/'))return [msg('22222222-0000-0000-0000-000000000002',KEEP,'new')];throw new Error('unexpected '+p)},pages:async()=>[]},
    me:{id:A,hexId:hex(A),name:'A'},iso:x=>x?new Date(x).toISOString():null,J:x=>JSON.parse(JSON.stringify(x)),T:require('../lib/ctx').T};
  const v=await routes['/api/chat/getChatView'](c);assert.equal(v._id,hex(KEEP));
  const h=await routes['/api/chat/getHistory'](c);
  assert.equal(h.length,2);for(const m of h)assert.equal(m.dialog,hex(KEEP));
});
