// Dashboard summary: one workspace row built from the caller's own tasks and rooms (golden shape: array of {workspace_id,workspace_title,inbox,chat,task{today,overdue,with_time,no_time},meetings}).
const tasks=require('./tasks'),chat=require('./chat');
const {WID}=require('../lib/ctx');
const OD=require('../lib/owner-dash');
const routes={'/api/dashboard/getAllSummary':async c=>{
  if(OD.on(c)){const s=OD.snap('dash-summary',null);if(s){const ch=await chat.load(c);const unread=ch.rooms.reduce((n,r)=>n+(Number(r.unread)||0),0);return s.map((r,i)=>i?r:Object.assign({},r,{workspace_id:WID,chat:process.env.MIZITO_OLD_UI==='1'?r.chat:unread}))}}

  const [a,s]=await Promise.all([tasks.mine(c),chat.load(c)]);const open=a.filter(k=>k.status!=='completed');const today=new Date().toISOString().slice(0,10);
  const t={today:0,overdue:0,with_time:0,no_time:0};
  for(const k of open){if(!k.due_date){t.no_time++;continue}t.with_time++;const d=String(k.due_date).slice(0,10);if(d<today)t.overdue++;else if(d===today)t.today++}
  const unread=s.rooms.reduce((n,r)=>n+(Number(r.unread)||0),0);
  return [{workspace_id:WID,workspace_title:c.label,inbox:0,chat:unread,task:t,meetings:[]}]}};
module.exports={routes};
