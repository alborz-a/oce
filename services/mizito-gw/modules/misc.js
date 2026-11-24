// Neutral answers for Mizito housekeeping endpoints (billing, support, whats-new). No OCE data involved.
const k=v=>async()=>v;
const routes={
 '/api/support/getClientUnreadCount':k({count:0}),'/api/chat/loadSettings':k([]),
 '/api/dashboard/getAllWorkspacesUsers':k([]),'/api/dashboard/notifySeen':k(true),'/api/dashboard/getPending':k([]),
 '/api/workspace/planInfo':k({used:0,volume:1099511627776,remain_days:3650}),'/api/payment/getReportDetails':k([]),
 '/api/chat/setTyping':k(true),'/api/chat/search':k([]),'/api/feedback/checkRequireParticipant':k({require:false}),'/api/dashboard/checkWhatsNew':k({count:0,message:null}),
};
module.exports={routes};
