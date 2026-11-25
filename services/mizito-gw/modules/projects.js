// Projects domain: OCE /projects/ (scoped by OCE to the caller). Settings members, Gantt phases/links: deferred.
const {hex}=require('../lib/oce');const chat=require('./chat');
const COLORS=['blue','green','red','orange','purple','teal'];
const ADMIN=['owner','lead','project_manager'];
const {memo}=require('../lib/cache');
const {groupLabel,groupsOf,coverFields,coverPhoto}=require('../lib/project-meta');const {hasCoverFile}=require('../lib/cover-store');
async function members(c,pid){return memo(c.oce.token,'pm:'+pid,60000,async()=>{try{const m=await c.oce.get('/projects/'+pid+'/members/');return Array.isArray(m)?m:[]}catch(e){return []}})}
async function list(c){const arr=await memo(c.oce.token,'projects',15000,()=>c.oce.pages('/projects/',200,2000));
  const s=await chat.load(c);const roomOf={};s.rooms.forEach(r=>{if(r.project_id)roomOf[hex(r.project_id)]=hex(r.id)});
  const act=arr.filter(p=>p.status!=='archived');const ms=await Promise.all(act.map(p=>members(c,p.id)));return act.map((p,i)=>{const o=c.J(c.T.project);o._id=hex(p.id);o.title=p.name;o.owner=p.owner_id?hex(p.owner_id):c.me.hexId;o.color=COLORS[i%6];
    o.deleted=false;const g=groupLabel(p);o.labels=g?[g._id]:[];const hc=hasCoverFile(String(p.id));Object.assign(o,coverFields(p,hc));const ph=coverPhoto(p,hc);if(ph)o.photo=ph;o.members_admin=(ms[i]||[]).filter(m=>ADMIN.includes(m.role)).map(m=>hex(m.user_id));if(p.owner_id&&!o.members_admin.includes(hex(p.owner_id)))o.members_admin.push(hex(p.owner_id));o.kanban_boards=[{_id:hex(p.id).slice(0,23)+'b',title:'برای انجام',color:'green2'}];o.dialog=roomOf[hex(p.id)]||null;o.archived=false;return o})}
// Project-wide task counts per project (all members, not caller-only): OCE GET /tasks/stats/?project_id= (total, completed_count). Failure = zeros.
async function stats(c,pid){return memo(c.oce.token,'pstats:'+pid,30000,async()=>{try{const s=await c.oce.get('/tasks/stats/?project_id='+pid);return {n:Number(s.total)||0,c:Number(s.completed_count)||0}}catch(e){console.warn('projects: tasks/stats failed for project '+pid+' status '+((e&&(e.status||e.statusCode))||'none'));return {n:0,c:0}}})}
async function counts(c,raw){const ks=await Promise.all(raw.map(p=>stats(c,p.id)));const per={};raw.forEach((p,i)=>{per[hex(p.id)]=ks[i]});return per}
const routes={
 '/api/projects/getList':async c=>{const p=await list(c);return {projects:p,project_status:p.map((x,i)=>({project_id:x._id,order:i}))}},
// chatSummary: client reads counters after a chat; gateway has no per-chat task counts yet, so zero values (no 404)
 '/api/projects/chatSummary':async()=>({me_completed:0,others_completed:0,me_completed_count:0,others_completed_count:0,me_remain_count:0}),
 '/api/projects/getListAdmin':async c=>list(c),
 '/api/projects/allSummary':async c=>{const t=c.J(c.T.summary),s0=t.summaries[0]||{};const raw=await listRaw(c);const [p,per]=await Promise.all([list(c),counts(c,raw.filter(x=>x.status!=='archived'))]);
  t.summaries=p.map(pr=>{const o=c.J(s0),k=per[pr._id]||{n:0,c:0};Object.keys(o).forEach(x=>{if(typeof o[x]==='number')o[x]=0});
   o.project=pr._id;o.name=pr.title;o.project_title=pr.title;o.total_tasks=o.total_tasks_count=k.n;o.others_completed=o.others_completed_count=k.c;o.is_archived=false;o.dialog=pr.dialog;o.boards={};o.last_completed=null;return o});return t},
 '/api/labels/getAll':async c=>{if(c.b.type!=='project')return {labels:[],label_status:[]};const raw=(await listRaw(c)).filter(x=>x.status!=='archived');
   const all=groupsOf(raw).map(g=>({_id:g._id,title:g.title,color:g.color,type:'project',deleted:false}));
   return {labels:all,label_status:all.map((l,i)=>({label_id:l._id,order:i}))}},
 '/api/projects/get':async c=>{const id=String(c.b.projectId||c.b.project||c.b._id||'');return (await list(c)).find(x=>x._id===id)||{}},
 // deferred: phases/links need OCE schedule data; manager-only gate kept, empty groups otherwise
 '/api/projects/getGanttData':async c=>c.isManager?require('../shapes/projects_getGanttData.json'):{groups:[],links:[],error:'forbidden'},
};
const listRaw=c=>memo(c.oce.token,'projects',15000,()=>c.oce.pages('/projects/',200,2000));
module.exports={routes,list,members,ADMIN,listRaw};
