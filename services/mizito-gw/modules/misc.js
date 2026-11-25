// Neutral answers for Mizito housekeeping endpoints (billing, support, whats-new). No OCE data involved.
const k=v=>async()=>v;
const R=require('../lib/round2');
const routes={
 '/api/support/getClientUnreadCount':k({count:0}),'/api/chat/loadSettings':k([]),'/api/notes/getAll':async c=>R.isOwner(c)?R.get('notes',[]):[],
 // client reads d.settings.support_workspace_roles (Mizito perms modal); no OCE permission model yet, so roles off
 '/api/workspace/getPermissions':k({settings:{support_workspace_roles:false}}),
 // client: plans list (empty = no plan rows; highest-plan loop skipped)
 '/api/workspace/getPlans':k([]),
 // client: monitor customers list is an array (angular.forEach then a.customers = d)
 '/api/monitor/customers':R.guard('customers',[]),
 '/api/dashboard/getAllWorkspacesUsers':async c=>{const OD=require('../lib/owner-dash');if(!OD.on(c))return [];const r=await require('./chat').routes['/api/workspace/getUsers'](c);const us=r.users.filter(u=>!u.deleted);const ws=OD.snap('dash-wsusers',null);
  if(!ws)return [{workspace_id:c.WID,users:us.map(u=>Object.assign({},u,{workspace_id:c.WID}))}];
  const nm=u=>((u.first_name||'')+' '+(u.last_name||'')).trim();
  return ws.map((w,i)=>{const last=i===ws.length-1,id=last?c.WID:w.workspace_id;const list=last?us:w.names.map(n=>r.users.find(u=>nm(u)===n||(n==='آرش پیرنیا'&&u._id===c.me.hexId))).filter(Boolean);return {workspace_id:id,users:list.map(u=>Object.assign({},u,{workspace_id:id}))}})},
 '/api/dashboard/notifySeen':k(true),'/api/dashboard/getPending':k([]),
 // client getPlanInfo(true) (settings pages): loader clears loadingPlanInfo only when max_members_count is truthy, so the details branch must return non-null plan fields. owner_id = caller id (client compares it with getUserId()). No users field: client passes it to saveApiUsers as an array.
 '/api/workspace/planInfo':async c=>{const OD=require('../lib/owner-dash');const base=OD.on(c)&&OD.snap('dash-plan',null)?{used:OD.snap('dash-plan').used,volume:OD.snap('dash-plan').volume,remain_days:require('../lib/owner-dash').remainDays()}:{used:0,volume:1099511627776,remain_days:3650};
   if(!(c.b&&c.b.details))return base;
   return Object.assign(base,{max_members_count:1000,max_members:1000,gift_members:0,max_file_size_mb:1024,max_inbox_size:1024,max_delay:0,max_nonzero_coeff:0,remain_in_board:0,plan_type:'enterprise',plan_code:'enterprise',plan_expired_at:'2099-12-31T23:59:59.000Z',is_enterprise_plan:true,business_type:'',owner_id:c.me&&c.me.hexId});
 },
 // client reads c.items (|| []), c.recordingStartedAt, hasMore, nextCursor
 '/api/workspace/getSettingsHistory':async()=>({items:[],recordingStartedAt:null,hasMore:false,nextCursor:null}),
 // client: deal and payment lists/statistics are arrays (angular.forEach / direct return)
 '/api/deal/getAll':k([]),'/api/deal/getReportStatistics':R.guard('deal_stats',[]),'/api/payment/getReportStatistics':R.guard('payment_stats',[]),'/api/payment/getAllPayments':k([]),
 // monitor user page: profile object; minutes list; tasksAssigned chart has labels/values plus user and total sub-charts (b.user.values, b.total.values)
 '/api/monitor/user':k({}),'/api/monitor/workspace':R.guard('workspace',{}),'/api/monitor/projectsSummary':R.guard('projects_summary',{summaries:[]}),'/api/monitor/minutes':k([]),
 '/api/monitor/chart/tasksAssigned':k({labels:[],values:[],all_count:0,user:{labels:[],values:[],all_count:0},total:{labels:[],values:[],all_count:0}}),
 '/api/payment/getReportDetails':k([]),
 '/api/chat/setTyping':k(true),'/api/chat/search':k([]),'/api/feedback/checkRequireParticipant':k({require:false}),'/api/dashboard/checkWhatsNew':k({count:0,message:null}),
};
// monitoring charts: stored snapshots of old Mizito (manager only), empty shape otherwise
for(const [ep,f] of [['chatMessages','chatMessages'],['inboxMessages','inboxMessages'],['tasksCreated','tasksCreated'],['tasksDone','tasksDone'],['customers','customers_chart'],['notes','notes_chart']])
  routes['/api/monitor/chart/'+ep]=R.guard('chart_'+f,{labels:[],values:[]});
module.exports={routes};
