// Letters domain: OCE /correspondence/ per project the caller can see. Compose: deferred.
const {hex}=require('../lib/oce');const projects=require('./projects');
async function all(c){const out=[];
  const raw=await c.oce.get("/projects/?limit=200");const uuids=(Array.isArray(raw)?raw:(raw.items||[])).map(p=>p.id);
  for(const id of uuids.slice(0,40)){try{const r=await c.oce.get('/correspondence/?project_id='+id+'&limit=100');out.push(...(r.items||r))}catch(e){}}return out}
function row(c,l){const o=c.J(c.T.letter);o._id=o.msg_id=hex(l.id);o.from=l.created_by?hex(l.created_by):'';o.subject=l.subject;o.raw_content=o.short_content=(l.notes||'').trim();
  o.send_date=c.iso(l.date_sent||l.created_at);o.count=1;o.attachments_count=(l.attachments||[]).length;o.unread=false;o.thread=hex(l.id);o.labels=[];o.dialogs=[];
  if(l.reference_number)o.secretariat={register_type:2,year:1405,sec_register_date:o.send_date,sec_prefix:'',sec_number:l.reference_number,sec_postfix:''};else delete o.secretariat;return o}
const routes={
 '/api/inbox/getInbox':async c=>{const a=await all(c);const mine=a.filter(l=>c.b.mode==='outbox'?l.direction==='outgoing':l.direction!=='outgoing');return mine.map(l=>row(c,l))},
 '/api/inbox/badge':async c=>({inbox_count:0}),
};
module.exports={routes};
