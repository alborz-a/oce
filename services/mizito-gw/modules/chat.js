// Chat domain: rooms/colleagues/messages straight from OCE team-chat with the caller's token. Reads and send.
const {WID,PLABEL}=require('../lib/ctx');
const {hex}=require('../lib/oce');
const cacheMap=new WeakMap(); // oce client -> {rooms, colleagues, at}
async function load(c){
  let s=cacheMap.get(c.oce);if(s&&Date.now()-s.at<15000)return s;
  const [rooms,col]=await Promise.all([c.oce.get('/team-chat/rooms/'),c.oce.get('/team-chat/colleagues/')]);
  s={rooms,col,at:Date.now(),roomBy:Object.fromEntries(rooms.map(r=>[hex(r.id),r])),colBy:Object.fromEntries(col.map(u=>[hex(u.id),u]))};
  cacheMap.set(c.oce,s);return s}
function dialog(c,r){const mem=(r.member_ids||[]).map(hex);if(!mem.includes(c.me.hexId))mem.push(c.me.hexId);
  const d={_id:hex(r.id),is_group:r.kind!=='dm',is_public_group:r.kind==='company',is_customer_entity:false,unread_count:Number(r.unread)||0,history_unread_count:0,
    messages_count:0,last_message_date:c.iso(r.last_message_at||r.created_at),pinned_messages:[],seen:[{user:c.me.hexId,seen_count:0}],labels:[],kicked:false,deleted:false,members:mem,group_admins:[],bots:[],meetings:[],tags:[]};
  if(r.kind==='dm')d.peer_user=mem.find(x=>x!==c.me.hexId)||c.me.hexId;
  else{d.title=r.name||'گروه';if(r.kind==='project'&&r.project_id){d.is_project_group=true;d.project_entity=hex(r.project_id);d.labels=[PLABEL]}}
  return d}
function mizUser(c,u){const p=(u.full_name||'?').trim().split(/\s+/);const o=c.J(c.T.user);o._id=hex(u.id);o.first_name=p[0];o.last_name=p.slice(1).join(' ');
  if(u.avatar_url){const t='av-'+hex(u.id);o.photo={_id:hex(u.id),name:'a.webp',photo_medium:{content:t,size:-1,w:173,h:173,content_key:t},photo_large:{content:t,size:-1,w:173,h:173,content_key:t}}}else delete o.photo;
  o.email='';o.phone='';o.username=u.full_name||'?';o.deleted=false;o.workspace_id=WID;return o}
function message(m,idx){const ids=(m.document_ids||[]).filter(Boolean);
  const o={_id:hex(m.id),_:'message',dialog:hex(m.room_id),from:m.author_id?hex(m.author_id):'',message:m.text||(ids.length?'':'[پیام سیستمی]'),date:new Date(m.created_at).toISOString(),msg_index:idx||0,workspace_id:WID,seen:[]};
  if(ids.length){const t='ph-'+String(ids[0]).replace(/-/g,'');o.media={_:'messageMediaPhoto',caption:m.text||'',photo:{_id:t,id:t,name:'a.webp',photo_medium:{content:t,size:-1,w:800,h:800,content_key:t},photo_large:{content:t,size:-1,w:800,h:800,content_key:t}}}}
  return o}
async function history(c,dialogId){const s=await load(c);const r=s.roomBy[dialogId];if(!r)return [];
  const l=await c.oce.get('/team-chat/rooms/'+r.id+'/messages/');const a=(Array.isArray(l)?l:(l.results||[])).slice().sort((x,y)=>x.created_at.localeCompare(y.created_at));
  return a.map((m,i)=>message(m,i+1))}
const roomOf=async(c,id)=>{const s=await load(c);return s.roomBy[id]||null};
const routes={
 '/api/workspace/getUsers':async c=>{const s=await load(c);const us=s.col.slice();if(!s.colBy[c.me.hexId])us.push({id:c.me.id,full_name:c.me.name});return {users:us.map(u=>mizUser(c,u)),user_status:us.map((u,i)=>({user_id:hex(u.id),order:i}))}},
 '/api/chat/getDialogs':async c=>{const s=await load(c);return {dialogs:s.rooms.map(r=>dialog(c,r)).sort((a,b)=>(b.last_message_date||'').localeCompare(a.last_message_date||'')),pin_dialogs:[]}},
 '/api/chat/getChatView':async c=>{const r=await roomOf(c,c.b.dialog);return r?dialog(c,r):{}},
 '/api/chat/getFullChat':async c=>{const r=await roomOf(c,c.b.dialog);if(!r)return {};const d=dialog(c,r);return Object.assign({},d,{participants:d.members,participants_count:d.members.length,admins:[]})},
 '/api/chat/getHistory':async c=>history(c,c.b.dialog),
 '/api/chat/getMessages':async c=>{const all=await history(c,c.b.dialog);return (c.b.mids||[]).map(i=>all.find(m=>m._id===i)).filter(Boolean)},
 '/api/chat/seen':async c=>{const r=await roomOf(c,c.b.dialog);if(r)await c.oce.post('/team-chat/rooms/'+r.id+'/read/',{}).catch(()=>{});return {}},
 '/api/chat/send':async c=>{const r=await roomOf(c,c.b.dialog);if(!r)throw new Error('unknown dialog');
  const m=await c.oce.post('/team-chat/rooms/'+r.id+'/messages/',{text:c.b.message||'',reply_to_id:null,document_ids:[],mentions:[],metadata:{}});return message(m)},
};
// avatar / chat-photo redirects: presigned, per user
async function cdn(c,name){
  if(/^ph-[0-9a-f]{32}$/.test(name)){const u=name.slice(3).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
    const j=await c.oce.get('/documents/photos/'+u+'/file-url/');return {redirect:j.url||j.file_url||j.download_url||null}}
  const m=/^(?:dl\/)?av-([0-9a-f]{24})$/.exec(name);if(m){const s=await load(c);const u=s.colBy[m[1]];
    if(u&&u.avatar_url)return {redirect:u.avatar_url.startsWith('http')?u.avatar_url:null,oceAvatar:u.avatar_url}}
  return null}
module.exports={routes,cdn,load,message};
