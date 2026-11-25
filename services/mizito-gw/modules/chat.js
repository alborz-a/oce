// Chat domain: rooms/colleagues/messages straight from OCE team-chat with the caller's token. Reads and send.
const {WID}=require('../lib/ctx');
const {groupLabel,coverPhoto}=require('../lib/project-meta');const {hasCoverFile}=require('../lib/cover-store');
const {hex}=require('../lib/oce');
const {memo,drop}=require('../lib/cache');
const load=c=>memo(c.oce.token,'chat',15000,()=>loadFresh(c));
async function loadFresh(c){
  const [rooms,col]=await Promise.all([c.oce.get('/team-chat/rooms/'),c.oce.get('/team-chat/colleagues/')]);
  return {rooms,col,at:Date.now(),roomBy:Object.fromEntries(rooms.map(r=>[hex(r.id),r])),colBy:Object.fromEntries(col.map(u=>[hex(u.id),u]))}}
function dialog(c,r,s){const mem=(r.member_ids||[]).map(hex);if(!mem.includes(c.me.hexId))mem.push(c.me.hexId);
  // OCE returns empty member_ids for DMs and puts the peer's name in r.name: resolve the peer from the caller's colleagues.
  if(r.kind==='dm'&&s&&!mem.some(x=>x!==c.me.hexId)){const p=s.col.find(u=>u.full_name===r.name);if(p)mem.push(hex(p.id))}
  const d={_id:hex(r.id),is_group:r.kind!=='dm',is_public_group:r.kind==='company',is_customer_entity:false,unread_count:Number(r.unread)||0,history_unread_count:0,
    messages_count:0,last_message_date:c.iso(r.last_message_at||r.created_at),pinned_messages:[],seen:[{user:c.me.hexId,seen_count:0}],labels:[],kicked:false,deleted:false,members:mem,group_admins:[],bots:[],meetings:[],tags:[]};
  if(r.kind==='dm')d.peer_user=mem.find(x=>x!==c.me.hexId)||c.me.hexId;
  else{d.title=r.name||'گروه';if(r.kind==='project'&&r.project_id){d.is_project_group=true;d.project_entity=hex(r.project_id)}}
  return d}
// project rooms: members/admins/owner from OCE project members (the list the settings modal shows); used by getDialogs and getFullChat
async function enrichProject(c,r,d){if(r.kind!=='project'||!r.project_id)return d;const P=require('./projects');d.labels=[];const pr=(await P.listRaw(c)).find(p=>hex(p.id)===hex(r.project_id));const g=pr?groupLabel(pr):null;if(g)d.labels=[g._id];
  // card circle: Mizito reads the dialog photo (peerId "-<dialog>" -> AppChatsManager.getChat), so the project cover goes on the dialog too
  if(pr){const ph=coverPhoto(pr,hasCoverFile(String(pr.id)));if(ph)d.photo=ph}const ms=await P.members(c,r.project_id);
  if(ms.length){d.members=ms.map(m=>hex(m.user_id));if(!d.members.includes(c.me.hexId))d.members.push(c.me.hexId);
    d.group_admins=ms.filter(m=>P.ADMIN.includes(m.role)).map(m=>hex(m.user_id));const own=ms.find(m=>m.role==='owner');d.owner=own?hex(own.user_id):(d.group_admins[0]||c.me.hexId)}
  return d}
function mizUser(c,u){const p=(u.full_name||'?').trim().split(/\s+/);const o=c.J(c.T.user);o._id=hex(u.id);o.first_name=p[0];o.last_name=p.slice(1).join(' ');
  if(u.avatar_url){const t='av-'+hex(u.id);o.photo={_id:hex(u.id),name:'a.webp',photo_medium:{content:t,size:-1,w:173,h:173,content_key:t},photo_large:{content:t,size:-1,w:173,h:173,content_key:t}}}else delete o.photo;
  o.email='';o.phone='';o.username=u.full_name||'?';o.deleted=false;o.workspace_id=WID;return o}
function message(m,idx){const ids=(m.document_ids||[]).filter(Boolean);
  const o={_id:hex(m.id),_:'message',dialog:hex(m.room_id),from:m.author_id?hex(m.author_id):'',message:m.text||(ids.length?'':'[پیام سیستمی]'),date:new Date(m.created_at).toISOString(),msg_index:idx||0,workspace_id:WID,seen:[]};
  if(ids.length){const t='ph-'+String(ids[0]).replace(/-/g,'');o.media={_:'messageMediaPhoto',caption:m.text||'',photo:{_id:t,id:t,name:'a.webp',photo_medium:{content:t,size:-1,w:800,h:800,content_key:t},photo_large:{content:t,size:-1,w:800,h:800,content_key:t}}}}
  return o}
async function history(c,dialogId){const s=await load(c);const r=s.roomBy[dialogId];if(!r)return [];
  const a=await messages(c,r);
  const F=require('./files');await F.prefetch(c,a);return a.flatMap((m,i)=>F.expand(m,i+1,message))}
// whole room history, paged backwards with the `before` cursor (OCE page max 100), capped at 2000
const messages=(c,r)=>memo(c.oce.token,'msg:'+r.id,10000,async()=>{let all=[],before=null;
  for(let i=0;i<20;i++){const l=await c.oce.get('/team-chat/rooms/'+r.id+'/messages/?limit=100'+(before?'&before='+before:''));const a=(Array.isArray(l)?l:(l.results||[])).slice().sort((x,y)=>String(x.created_at).localeCompare(String(y.created_at)));
    const seen=new Set(all.map(m=>m.id));const fresh=a.filter(m=>!seen.has(m.id));all=fresh.concat(all);if(a.length<100||!fresh.length)break;before=a[0].id}
  return all});
const roomOf=async(c,id)=>{const s=await load(c);return s.roomBy[id]||null};
// Mizito keys DM dialogs by peerId (peer_user). Two DM rooms with the same peer make the client's dialog loader return undefined for the second one (chat bounces with TypeError undefined.dialog_type). Keep the first (newest, list is pre-sorted) per peer.
function oneDmPerPeer(list){const seen=new Set();return list.filter(d=>{if(d.is_group)return true;const k=d.peer_user;if(!k)return true;if(seen.has(k))return false;seen.add(k);return true})}
const routes={
 '/api/workspace/getUsers':async c=>{const s=await load(c);const us=s.col.slice();if(!s.colBy[c.me.hexId])us.push({id:c.me.id,full_name:c.me.name});return {users:us.map(u=>mizUser(c,u)),user_status:us.map((u,i)=>({user_id:hex(u.id),order:i}))}},
 '/api/chat/getDialogs':async c=>{const s=await load(c);const ds=await Promise.all(s.rooms.map(async r=>enrichProject(c,r,dialog(c,r,s))));return {dialogs:oneDmPerPeer(ds.filter(d=>d&&typeof d==='object'&&d._id).sort((a,b)=>(b.last_message_date||'').localeCompare(a.last_message_date||''))),pin_dialogs:[]}},
 '/api/chat/getChatView':async c=>{const r=await roomOf(c,c.b.dialog);if(!r)return {};const d=dialog(c,r,await load(c));await enrichProject(c,r,d);d.messages_count=(await messages(c,r)).length;d.seen=[{user:c.me.hexId,seen_count:d.messages_count}];return d},
 '/api/chat/getFullChat':async c=>{const r=await roomOf(c,c.b.dialog);if(!r)return {};const d=dialog(c,r,await load(c));d.messages_count=(await messages(c,r)).length;
  await enrichProject(c,r,d);
  return Object.assign({},d,{participants:d.members,participants_count:d.members.length,admins:d.group_admins||[]})},
 '/api/chat/getHistory':async c=>history(c,c.b.dialog),
 '/api/chat/getMessages':async c=>{const all=await history(c,c.b.dialog);return (c.b.mids||[]).map(i=>all.find(m=>m._id===i)).filter(Boolean)},
// fixDialogs: client only waits for it, then switches workspace; nothing to repair in OCE
 '/api/chat/fixDialogs':async()=>({}),
 '/api/chat/seen':async c=>{const r=await roomOf(c,c.b.dialog);if(r)await c.oce.post('/team-chat/rooms/'+r.id+'/read/',{}).catch(()=>{});return {}},
 '/api/chat/send':async c=>{const r=await roomOf(c,c.b.dialog);if(!r)throw new Error('unknown dialog');
  const m=await c.oce.post('/team-chat/rooms/'+r.id+'/messages/',{text:c.b.message||'',reply_to_id:null,document_ids:[],mentions:[],metadata:{}});drop(c.oce.token,'msg:'+r.id);return message(m)},
};
// avatar / chat-photo redirects: presigned, per user
async function cdn(c,name){
  if(/^ph-[0-9a-f]{32}$/.test(name)){const u=name.slice(3).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
    const j=await c.oce.get('/documents/photos/'+u+'/file-url/');return {redirect:j.url||j.file_url||j.download_url||null}}
  const m=/^(?:dl\/)?av-([0-9a-f]{24})$/.exec(name);if(m){const s=await load(c);const u=s.colBy[m[1]];
    // OCE colleagues avatar_url is relative with a cache-buster: /api/v1/users/<id>/avatar?v=<stamp>. server.js rejects query strings, so strip it here.
    if(u&&u.avatar_url){const abs=/^https?:\/\//i.test(u.avatar_url);return {redirect:abs?u.avatar_url:null,oceAvatar:abs?null:u.avatar_url.split('?')[0]}}}
  return null}
module.exports={routes,cdn,load,message,messages};
