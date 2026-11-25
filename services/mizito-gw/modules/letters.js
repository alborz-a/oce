// Letters domain: OCE mailbox (/correspondence/mailbox|compose|reply|register) as the caller. No table writes, no module install.
// Numbering is OCE's own secretariat register (/{id}/register/); the gateway only maps its letter_number to Mizito's sec_* fields.
const {hex}=require('../lib/oce');
const fail=m=>({error:m});
const deny=e=>/ 40[13]$/.test(e.message);
const PREFIXES=['ق','خ','ص','د','ن','الف'];
const FA='۰۱۲۳۴۵۶۷۸۹';
const en=s=>String(s||'').replace(/[۰-۹]/g,d=>FA.indexOf(d));
// "ق- ۲۳۷ -۴۰۵" -> {prefix:'ق',number:237,postfix:'405'}
function parseNumber(ln){const m=/^\s*(\S+?)\s*-\s*(\d+)\s*-\s*(\d+)\s*$/.exec(en(ln));return m?{prefix:ln.trim().split('-')[0].trim(),number:+m[2],postfix:m[3]}:null}
const {memo}=require('../lib/cache');const LS=require('../lib/letter-senders');
// all pages (OCE max 100 per page), capped at 2000 letters per box
const mailbox=(c,box)=>memo(c.oce.token,'mb:'+box,10000,()=>c.oce.pages('/correspondence/mailbox/?box='+box,100,2000));
function secOf(c,l,reg){const p=l.letter_number?parseNumber(l.letter_number):null;if(!p)return null;
  return {register_type:l.register_type||2,year:1000+(+p.postfix),sec_register_date:c.iso(reg||l.sent_at),sec_prefix:p.prefix,sec_number:p.number,sec_postfix:p.postfix}}
function row(c,l){const o=c.J(c.T.letter);o._id=o.msg_id=hex(l.id);o.from=l.sender_user_id?hex(l.sender_user_id):'';{const d=LS.senderOf(hex(l.id));if(d)o.from=d.id}o.subject=l.subject;o.raw_content=o.short_content=l.snippet||'';
  o.send_date=c.iso(l.sent_at);o.count=1;o.attachments_count=l.attachments_count||0;o.unread=!!l.unread;o.thread=hex(l.thread_id);o.labels=[];o.dialogs=[];
  const s=secOf(c,l);if(s)o.secretariat=s;else delete o.secretariat;return o}
// hex (24 chars) -> uuid, only through lists OCE returned for this user
async function recipientUuids(c,hexIds){const r=await c.oce.get('/correspondence/recipients/');const a=Array.isArray(r)?r:(r.items||[]);const out=[];
  for(const h of hexIds){const u=a.find(x=>hex(x.id)===String(h));if(!u)return null;out.push(u.id)}return out}
async function letterUuid(c,h){for(const box of ['inbox','outbox','archived','paraph']){const l=(await mailbox(c,box)).find(x=>hex(x.id)===String(h)||hex(x.thread_id)===String(h));if(l)return l}return null}
const person=(p,seen)=>({user:hex(p.user_id),unread:!seen,_id:hex(p.user_id),seen_date:null});
function msgRow(c,m,l,i){const d=LS.senderOf(hex(m.id));return {_id:hex(m.id),from:d?d.id:(m.sender_user_id?hex(m.sender_user_id):''),to:(m.recipients||[]).map(p=>person(p,true)),receivers:(m.recipients||[]).map(p=>hex(p.user_id)),subject:l.subject,
  send_date:c.iso(m.sent_at),content:m.body_html||'',reply_to:i?hex(l.thread_id):undefined,thread:hex(l.thread_id),short_content:plain(m.body_html).slice(0,40),is_seen:true,labels:[],labels_changed:[],dialogs:[],dialogs_changed:[],
  secretariat:secOf(c,l)||undefined,attachments:(m.attachments||[]).map((a,k)=>({_id:hex(m.id)+k,name:a.filename||a.name||'file',size:a.size||-1}))}}
const plain=s=>String(s||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
// Admin-only read of Mizito-export letters (owner decision 2026-11-25, option 1). Rows sit in the shared general project
// (OCE has no mailbox rows for them, so /mailbox/ never returns them). Read with the CALLER's token via /correspondence/?project_id=.
// Shown only when the OCE role is in MIZITO_LETTERS_ADMIN_ROLES; unknown or missing role = none (fail closed).
// MIZITO_LETTERS_ADMIN_ONLY=0 switches the whole Mizito letter merge off for everyone (rollback). Names only, no name matching to users.
const GENERAL=process.env.MIZITO_GENERAL_PROJECT_ID||'d4665ee3-30a7-427c-9e43-e0d541caa03e';
const LADM=new Set(String(process.env.MIZITO_LETTERS_ADMIN_ROLES||'admin,manager').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
const LFLAG=String(process.env.MIZITO_LETTERS_ADMIN_ONLY||'1')!=='0';
const isLetterAdmin=c=>LFLAG&&!!(c&&c.me&&c.me.role)&&LADM.has(String(c.me.role).toLowerCase());
async function mzRows(c){return memo(c.oce.token,'mz:general',10000,async()=>{try{const a=await c.oce.pages('/correspondence/?project_id='+GENERAL,100,3000);return a.filter(x=>x&&x.metadata&&x.metadata.source==='mizito-export')}catch(e){return []}})}
// admin-only sender/recipient names for getUsers; per request, caller-gated, never global state
async function mzNames(c){if(!isLetterAdmin(c))return [];return [...new Set((await mzRows(c)).flatMap(x=>{const m=x.metadata||{};return [m.from].concat(Array.isArray(m.to)?m.to:[])}).map(n=>String(n||'').trim()).filter(Boolean))]}
const mzFind=(rows,h)=>rows.find(x=>hex(x.id)===String(h)||hex((x.metadata||{}).thread)===String(h))||null;
function mzRow(c,x){const m=x.metadata||{};const files=Array.isArray(m.mizito_files)?m.mizito_files:[];const o=c.J(c.T.letter);
  o._id=o.msg_id=hex(x.id);o.from=String(m.from||'').trim()?LS.idOf(String(m.from).trim()):'';o.subject=x.subject||'';o.raw_content=o.short_content=plain(x.notes).slice(0,40);
  o.send_date=c.iso(x.date_sent||x.created_at);o.count=1;o.attachments_count=files.length;o.unread=false;o.thread=hex(m.thread||x.id);o.labels=[];o.dialogs=[];o.box=m.box||'';return o}
function mzHistory(c,x){const m=x.metadata||{};const o=mzRow(c,x);const to=(Array.isArray(m.to)?m.to:[]).map(n=>{const id=LS.idOf(String(n).trim());return {user:id,unread:false,_id:id,seen_date:null}});
  return Object.assign(o,{_id:hex(m.thread||x.id),content:String(x.notes||''),to,receivers:to.map(p=>p.user),is_seen:true,bookmarked:false,count:1,messages:[],
    attachments:(Array.isArray(m.mizito_files)?m.mizito_files:[]).map((f,k)=>({_id:hex(x.id)+k,name:f.name||f.filename||'file',size:f.size||-1}))})}
const routes={
 // golden inbox/getHistory: the thread head plus its messages, scoped by OCE to the caller's own letters
 '/api/inbox/getHistory':async c=>{const mz=isLetterAdmin(c)?mzFind(await mzRows(c),c.b.thread||c.b.msg_id||c.b._id||c.b.id):null;if(mz)return mzHistory(c,mz);
  const l=await letterUuid(c,c.b.thread||c.b.msg_id||c.b._id||c.b.id);if(!l)return {};
  const t=await c.oce.get('/correspondence/'+l.id+'/thread/');const ms=t.messages||[];const head=ms[0]||{};
  const o=Object.assign(msgRow(c,head,Object.assign({},l,t,{thread_id:l.thread_id}),0),{_id:hex(t.thread_id||l.thread_id),count:ms.length,bookmarked:false,attachments:(ms.flatMap(m=>m.attachments||[])).map((a,k)=>({_id:hex(l.id)+k,name:a.filename||a.name||'file',size:a.size||-1}))});
  o.messages=ms.slice(1).map(m=>msgRow(c,m,Object.assign({},l,t,{thread_id:l.thread_id}),1));return o},
 '/api/inbox/getInbox':async c=>{const box=c.b.mode==='outbox'?'outbox':'inbox';const rows=(await mailbox(c,box)).map(l=>row(c,l));
  if(!isLetterAdmin(c))return rows;
  const mz=(await mzRows(c)).filter(x=>(x.metadata||{}).box===box).map(x=>mzRow(c,x));
  return rows.concat(mz).sort((a,b)=>String(b.send_date||'').localeCompare(String(a.send_date||'')))},
 '/api/inbox/badge':async c=>{if(require('../lib/owner-dash').on(c)&&process.env.MIZITO_OWNER_ZERO_UNREAD==='1')return {inbox_count:0};const r=await c.oce.get('/correspondence/mailbox/unread-count/');return {inbox_count:r.count||0}},
 '/api/inbox/send':async c=>{const b=c.b;if(!b.to||!b.to.length)return fail('گیرنده انتخاب نشده است');
  try{
    if(b.reply_to||b.thread){const l=await letterUuid(c,b.reply_to||b.thread);if(!l)return fail('نامه پیدا نشد');
      await c.oce.post('/correspondence/'+l.id+'/reply/',{body:b.content||''});return {success:true}}
    const ids=await recipientUuids(c,b.to);if(!ids)return fail('گیرنده مجاز نیست');
    const r=await c.oce.post('/correspondence/compose/',{subject:b.subject||'(بدون موضوع)',body:b.content||'',to_user_ids:ids});
    return {success:true,_id:hex(r.id),thread:hex(r.thread_id)}
  }catch(e){return fail(deny(e)?'شما اجازهٔ ارسال نامه را ندارید':'ارسال نامه ناموفق بود')}},
 // OCE has no "next number" endpoint: estimate from the numbers the caller can see; real number is assigned at register time under OCE's lock.
 '/api/inbox/getLastSecretariatStatus':async c=>{let max=238;for(const box of ['inbox','outbox']){for(const l of await mailbox(c,box)){const p=l.letter_number&&parseNumber(l.letter_number);if(p&&p.number>max)max=p.number}}
  return {next_sec_number:max+1,estimated:true}},
};
async function register(c){const l=await letterUuid(c,(c.b.thread||(c.b.letterOptions||{}).thread));if(!l)return fail('نامه پیدا نشد');
  const want=((c.b.letterOptions||{}).sec_prefix||'').trim();const prefix=PREFIXES.includes(want)?want:'ق';
  try{const r=await c.oce.post('/correspondence/'+l.id+'/register/',{prefix});const p=parseNumber(r.letter_number);
    return {success:true,sec_number:p&&p.number,sec_prefix:p&&p.prefix,sec_postfix:p&&p.postfix}}
  catch(e){return fail(deny(e)?'شما اجازهٔ ثبت در دبیرخانه را ندارید':'ثبت در دبیرخانه ناموفق بود')}}
routes['/api/inbox/registerOutLetter']=register;routes['/api/inbox/registerInLetter']=register;
module.exports={routes,parseNumber,secOf,mzNames};
