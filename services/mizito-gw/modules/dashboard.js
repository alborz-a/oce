const tasks=require('./tasks');
const routes={'/api/dashboard/getAllSummary':async c=>{const a=await tasks.mine(c);const s=c.J(c.T.dashboard);
  const open=a.filter(k=>k.status!=='completed').length;for(const k of Object.keys(s))if(typeof s[k]==='number')s[k]=0;
  if('tasks' in s)s.tasks=open;if('open_tasks' in s)s.open_tasks=open;return s}};
module.exports={routes};
