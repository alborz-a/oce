// Projects domain: OCE /projects/ (scoped by OCE to the caller). Settings members, Gantt phases/links: deferred.
const {hex}=require('../lib/oce');const chat=require('./chat');
const COLORS=['blue','green','red','orange','purple','teal'];
const ADMIN=['owner','lead','project_manager'];
const {memo}=require('../lib/cache');const OD=require('../lib/owner-dash');
const {groupLabel,groupsOf,coverFields,coverPhoto}=require('../lib/project-meta');const {hasCoverFile}=require('../lib/cover-store');
async function members(c,pid){return memo(c.oce.token,'pm:'+pid,60000,async()=>{try{const m=await c.oce.get('/projects/'+pid+'/members/');return Array.isArray(m)?m:[]}catch(e){return []}})}
async function list(c){const arr=await memo(c.oce.token,'projects',15000,()=>c.oce.pages('/projects/',200,2000));
  const s=await chat.load(c);const roomOf={};s.rooms.forEach(r=>{if(r.project_id&&!require('../lib/private-rooms').hiddenId(c,r.id))roomOf[hex(r.project_id)]=hex(r.id)});
  const act=arr.filter(p=>p.status!=='archived');const ms=await Promise.all(act.map(p=>members(c,p.id)));return act.map((p,i)=>{const o=c.J(c.T.project);o._id=hex(p.id);o.title=p.name;o.owner=p.owner_id?hex(p.owner_id):c.me.hexId;o.color=COLORS[i%6];
    o.deleted=false;const g=groupLabel(p);o.labels=g?[g._id]:[];const hc=hasCoverFile(String(p.id));Object.assign(o,coverFields(p,hc));const ph=coverPhoto(p,hc);if(ph)o.photo=ph;o.members_admin=(ms[i]||[]).filter(m=>ADMIN.includes(m.role)).map(m=>hex(m.user_id));if(p.owner_id&&!o.members_admin.includes(hex(p.owner_id)))o.members_admin.push(hex(p.owner_id));o.kanban_boards=[{_id:hex(p.id).slice(0,23)+'b',title:'برای انجام',color:'green2'}];o.dialog=roomOf[hex(p.id)]||null;o.archived=false;return o})}
// Project-wide task counts per project (all members, not caller-only): OCE GET /tasks/?project_id= paged, synthetic tasks hidden (lib/synthetic.js). Failure = zeros.
const {progressCounts}=require('../lib/synthetic');
async function stats(c,pid){return memo(c.oce.token,'pstats:'+pid,30000,async()=>{try{const k=progressCounts(await c.oce.pages('/tasks/?project_id='+pid,500,20000));return {n:k.n,c:k.c,p:k.p}}catch(e){console.warn('projects: tasks list failed for project '+pid+' status '+((e&&(e.status||e.statusCode))||'none'));return {n:0,c:0,p:0}}})}
async function counts(c,raw){const ks=await Promise.all(raw.map(p=>stats(c,p.id)));const per={};raw.forEach((p,i)=>{per[hex(p.id)]=ks[i]});return per}
const routes={
 '/api/projects/getList':async c=>{const p=await list(c);return {projects:p,project_status:p.map((x,i)=>({project_id:x._id,order:i}))}},
// chatSummary: client reads counters after a chat; gateway has no per-chat task counts yet, so zero values (no 404)
 '/api/projects/chatSummary':async()=>({me_completed:0,others_completed:0,me_completed_count:0,others_completed_count:0,me_remain_count:0}),
 '/api/projects/getListAdmin':async c=>list(c),
 '/api/projects/allSummary':async c=>{const t=c.J(c.T.summary),s0=t.summaries[0]||{};const raw=await listRaw(c);const [p,per]=await Promise.all([list(c),counts(c,raw.filter(x=>x.status!=='archived'))]);
  t.summaries=p.map(pr=>{const o=c.J(s0),k=per[pr._id]||{n:0,c:0};Object.keys(o).forEach(x=>{if(typeof o[x]==='number')o[x]=0});
   o.project=pr._id;o.name=pr.title;o.project_title=pr.title;o.total_tasks=o.total_tasks_count=k.n;o.others_completed=o.others_completed_count=k.c;o.is_archived=false;o.dialog=pr.dialog;o.boards={};o.last_completed=null;return o});
   if(OD.on(c)){const a=OD.snap('dash-allsummary',null);if(a&&a.summaries){const nz=v=>String(v||'').replace(/[۰-۹]/g,d=>'۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).replace(/\s+/g,' ').trim(),by={};t.summaries.forEach(x=>{by[nz(x.name)]=x});const col=(await chat.load(c)).col;
     const sm=a.summaries.map(sn=>{const g=by[nz(sn.name)];if(!g)return null;const o=Object.assign({},sn,{project:g.project,dialog:g.dialog,boards:g.boards||{},project_title:g.project_title||sn.name,is_archived:false});return o}).filter(Boolean);
     if(sm.length){t.summaries=sm;if(a.max_delay){const md=c.J(a.max_delay);md.user=OD.uid(c,md.user,col);if(md.task){const tk=md.task;const sn=a.summaries.find(x=>x.project===tk.project),g=sn&&by[nz(sn.name)];if(g){tk.project=g.project;tk.dialog=g.dialog}tk.owner=OD.uid(c,tk.owner,col);tk.assignee=(tk.assignee||[]).map(x=>OD.uid(c,x,col))}t.max_delay=md}
     if(a.max_inbox_size)t.max_inbox_size={user:OD.uid(c,a.max_inbox_size.user,col),size:a.max_inbox_size.size}}}}
   return t},
 '/api/labels/getAll':async c=>{if(c.b.type!=='project')return {labels:[],label_status:[]};const raw=(await listRaw(c)).filter(x=>x.status!=='archived');
   const all=groupsOf(raw).map(g=>({_id:g._id,title:g.title,color:g.color,type:'project',deleted:false}));
   return {labels:all,label_status:all.map((l,i)=>({label_id:l._id,order:i}))}},
 '/api/projects/get':async c=>{const id=String(c.b.projectId||c.b.project||c.b._id||'');return (await list(c)).find(x=>x._id===id)||{}},
 // deferred: phases/links need OCE schedule data; manager-only gate kept, empty groups otherwise
 '/api/projects/getGanttData':async c=>c.isManager?require('../shapes/projects_getGanttData.json'):{groups:[],links:[],error:'forbidden'},
};
const listRaw=c=>memo(c.oce.token,'projects',15000,()=>c.oce.pages('/projects/',200,2000));
module.exports={routes,list,members,ADMIN,listRaw};
