// Tasks domain: OCE /tasks/my-tasks/ (the caller's tasks). Writes deferred.
const {hex}=require('../lib/oce');
async function mine(c){const t=await c.oce.get('/tasks/my-tasks/?limit=500');return Array.isArray(t)?t:(t.items||[])}
function row(c,k){const o=c.J(c.T.task);o._id=hex(k.id);o.title=k.title;o.notes=k.description||'';o.owner=k.created_by?hex(k.created_by):c.me.hexId;o.assignee=[c.me.hexId];o.assignee_last=[];o.responsible=null;
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
module.exports={routes,mine,row};
