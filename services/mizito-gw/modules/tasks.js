// Tasks domain: OCE /tasks/ (reads: my-tasks; writes: add, save, setCompleted, comments) as the caller. Hex ids map to uuids only through lists OCE returns for this user.
const {hex}=require('../lib/oce');
async function mine(c){const t=await c.oce.get('/tasks/my-tasks/?limit=500');return Array.isArray(t)?t:(t.items||[])}
function row(c,k){const o=c.J(c.T.task);o._id=hex(k.id);o.access_token=hex(k.id);o.title=k.title;o.notes=k.description||'';o.owner=k.created_by?hex(k.created_by):c.me.hexId;o.assignee=[c.me.hexId];o.assignee_last=[];o.responsible=null;
  o.progress=Math.round((k.checklist_progress||0)*100)/100;o.created_at=c.iso(k.created_at);o.modified_at=c.iso(k.updated_at);o.completed_by=[];o.completed_at=k.status==='completed'?c.iso(k.updated_at):null;
  o.project=hex(k.project_id);o.labels=[];o.attachments=[];o.has_attachments=false;o.deleted=false;o.completed=k.status==='completed';o.last_comment=null;o.has_comments=false;o.has_comments_with_deleted=false;o.dialog=null;o.dialog_message=null;o.checklist=[];
  if(k.due_date){o.alarm_at=new Date(k.due_date+'T08:00:00Z').toISOString();o.sort_date=o.alarm_at}else{o.alarm_at=null;o.sort_date=null}return o}
const pers=d=>new Intl.DateTimeFormat('en-u-ca-persian-nu-latn',{year:'numeric',month:'numeric'}).formatToParts(d).reduce((a,x)=>(a[x.type]=+x.value,a),{});
const routes={
 '/api/tasks/upcoming':async c=>{const all=await mine(c),open=all.filter(k=>k.status!=='completed'),f=c.b.filter||{};
  if(c.b.project_id)return open.filter(k=>hex(k.project_id)===String(c.b.project_id)).map(k=>row(c,k));
  if(f.calendar_year){const p=open.filter(k=>{if(!k.due_date)return false;const q=pers(new Date(k.due_date));return q.year===f.calendar_year&&q.month===f.calendar_month});return p.map(k=>row(c,k))}
  return open.filter(k=>!k.due_date).slice(0,40).concat(open.filter(k=>k.due_date).slice(0,20)).map(k=>row(c,k))},
 '/api/tasks/getAll':async c=>{const all=await mine(c);const pid=c.b.project?String(c.b.project):null;return all.filter(k=>!pid||hex(k.project_id)===pid).map(k=>row(c,k))},
 '/api/tasks/badge':async c=>{const a=await mine(c);return {today:0,count:a.filter(k=>k.status!=='completed').length,total_count:a.length}},
};

// ---- writes (OCE enforces project access and permissions; errors come back as {error} like Mizito) ----
const fail=m=>({error:m});
const deny=e=>/ 40[13]$/.test(e.message);
const full=id=>String(id).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
async function projectUuid(c,h){const ps=await c.oce.get('/projects/?limit=200');const a=Array.isArray(ps)?ps:(ps.items||[]);const p=a.find(x=>hex(x.id)===String(h));return p?p.id:null}
async function taskUuid(c,h){h=String(h||'');const t=(await mine(c)).find(k=>hex(k.id)===h);return t?t.id:null}
const dueOf=d=>{if(!d)return null;const t=new Date(d);return isNaN(t)?null:t.toISOString().slice(0,10)};
async function responsibleOf(c,b){const a=(b.assignee||[]).find(x=>x&&x!==-1);if(!a||a===c.me.hexId)return c.me.id;
  const s=await require('./chat').load(c);const u=s.colBy[a];return u?u.id:c.me.id}
async function commentUuid(c,tok,h){const id=await taskUuid(c,tok);if(!id||!h)return null;const l=await c.oce.get('/collaboration/comments/?entity_type=task&entity_id='+id+'&limit=500');
  const all=(l.items||[]).flatMap(m=>[m].concat(m.replies||[]));const m=all.find(x=>hex(x.id)===String(h));return m?m.id:null}
async function oneRow(c,id){const k=await c.oce.get('/tasks/'+id);return row(c,k)}
function commentRow(c,m){return {_id:hex(m.id),comment:m.text,comment_owner:hex(m.author_id),created_at:c.iso(m.created_at),modified_at:c.iso(m.edited_at||m.updated_at),attachments:[],mention:[],replied_comment_id:m.parent_comment_id?hex(m.parent_comment_id):null,deleted:!!m.is_deleted}}
async function addOne(c,b){
  const pid=b.project?await projectUuid(c,b.project):null;if(!pid)return fail('پروژه پیدا نشد');
  const body={project_id:pid,task_type:'task',title:String(b.title||'').trim(),description:b.notes||null,status:'open',responsible_id:await responsibleOf(c,b),due_date:dueOf(b.deadline)};
  if(!body.title)return fail('عنوان وظیفه خالی است');
  const k=await c.oce.post('/tasks/',body);
  if(b.comment&&String(b.comment).trim())await c.oce.post('/collaboration/comments/',{entity_type:'task',entity_id:k.id,text:String(b.comment)});
  return row(c,k)}
const writes={
 '/api/tasks/add':async c=>{try{return await addOne(c,c.b)}catch(e){if(e.name==='Unauthorized'||/oce 401/.test(e.message))throw e;console.log('ERR tasks.add',e.message);return fail(deny(e)?'اجازهٔ ثبت وظیفه در این پروژه را ندارید':'ثبت وظیفه انجام نشد')}},
 '/api/tasks/save':async c=>{try{const id=await taskUuid(c,c.b.token||c.b.task_id);if(!id)return fail('وظیفه پیدا نشد');
   const body={};if(c.b.title!=null)body.title=String(c.b.title).trim()||undefined;if(c.b.notes!=null)body.description=c.b.notes;
   if('deadline' in c.b)body.due_date=dueOf(c.b.deadline);if(c.b.assignee)body.responsible_id=await responsibleOf(c,c.b);
   await c.oce.call('PATCH','/tasks/'+id,body);return await oneRow(c,id)}catch(e){if(/oce 401/.test(e.message))throw e;console.log('ERR tasks.save',e.message);return fail(deny(e)?'اجازهٔ ویرایش این وظیفه را ندارید':'ذخیره وظیفه انجام نشد')}},
 '/api/tasks/setCompleted':async c=>{try{const id=await taskUuid(c,c.b.token);if(!id)return fail('وظیفه پیدا نشد');
   if(c.b.completed)await c.oce.post('/tasks/'+id+'/complete/',{});else await c.oce.call('PATCH','/tasks/'+id,{status:'open'});
   return await oneRow(c,id)}catch(e){if(/oce 401/.test(e.message))throw e;console.log('ERR tasks.setCompleted',e.message);return fail(deny(e)?'اجازهٔ تغییر وضعیت این وظیفه را ندارید':'تغییر وضعیت وظیفه انجام نشد')}},
 '/api/tasks/get':async c=>{const id=await taskUuid(c,c.b.token||c.b.taskId);if(!id)return {no_access_deleted:true};const o=await oneRow(c,id);
   const l=await c.oce.get('/collaboration/comments/?entity_type=task&entity_id='+id);o.has_comments=o.has_comments_with_deleted=((l.items||[]).length>0);return o},
 '/api/tasks/getComments':async c=>{const id=await taskUuid(c,c.b.token);if(!id)return [];
   const l=await c.oce.get('/collaboration/comments/?entity_type=task&entity_id='+id+'&limit=500');
   return (l.items||[]).flatMap(m=>[m].concat(m.replies||[])).filter(m=>!m.is_deleted).sort((x,y)=>x.created_at.localeCompare(y.created_at)).map(m=>commentRow(c,m))},
 '/api/tasks/newComment':async c=>{try{const id=await taskUuid(c,c.b.token);if(!id)return fail('وظیفه پیدا نشد');if(!String(c.b.comment||'').trim())return fail('متن گزارش خالی است');
   const m=await c.oce.post('/collaboration/comments/',{entity_type:'task',entity_id:id,text:String(c.b.comment),parent_comment_id:c.b.reply_id?await commentUuid(c,c.b.token,c.b.reply_id):null});return commentRow(c,m)}catch(e){if(/oce 401/.test(e.message))throw e;console.log('ERR tasks.newComment',e.message);return fail('ثبت گزارش انجام نشد')}},
 '/api/tasks/editComment':async c=>{try{const id=await commentUuid(c,c.b.token,c.b.commentId);if(!id)return fail('گزارش پیدا نشد');const m=await c.oce.call('PATCH','/collaboration/comments/'+id,{text:String(c.b.newComment)});return commentRow(c,m)}catch(e){if(/oce 401/.test(e.message))throw e;return fail(deny(e)?'فقط نویسندهٔ گزارش می‌تواند آن را ویرایش کند':'ویرایش گزارش انجام نشد')}},
 '/api/tasks/deleteComment':async c=>{try{const id=await commentUuid(c,c.b.token,c.b.commentId);if(!id)return fail('گزارش پیدا نشد');await c.oce.call('DELETE','/collaboration/comments/'+id);return {}}catch(e){if(/oce 401/.test(e.message))throw e;return fail(deny(e)?'فقط نویسندهٔ گزارش می‌تواند آن را حذف کند':'حذف گزارش انجام نشد')}},
};
Object.assign(routes,writes);
module.exports={routes,mine,row};
