// Neutral answers for Mizito housekeeping endpoints (billing, support, whats-new). No OCE data involved.
const k=v=>async()=>v;
const routes={
 '/api/support/getClientUnreadCount':k({count:0}),'/api/chat/loadSettings':k([]),'/api/notes/getAll':k([]),
 // client reads d.settings.support_workspace_roles (Mizito perms modal); no OCE permission model yet, so roles off
 '/api/workspace/getPermissions':k({settings:{support_workspace_roles:false}}),
 // client: plans list (empty = no plan rows; highest-plan loop skipped)
 '/api/workspace/getPlans':k([]),
 // client: monitor customers list is an array (angular.forEach then a.customers = d)
 '/api/monitor/customers':k([]),
 '/api/dashboard/getAllWorkspacesUsers':k([]),'/api/dashboard/notifySeen':k(true),'/api/dashboard/getPending':k([]),
 '/api/workspace/planInfo':k({used:0,volume:1099511627776,remain_days:3650}),'/api/payment/getReportDetails':k([]),
 '/api/chat/setTyping':k(true),'/api/chat/search':k([]),'/api/feedback/checkRequireParticipant':k({require:false}),'/api/dashboard/checkWhatsNew':k({count:0,message:null}),
};
module.exports={routes};
