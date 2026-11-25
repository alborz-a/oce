// Owner dashboard parity: for MIZITO_DATA_OWNER only (flag MIZITO_OWNER_DASH=1) serve the stored old-Mizito dashboard values (data dir files dash-*.json). Everyone else: live OCE data. Read-only; no DB writes.
const R=require('./round2');
const on=c=>process.env.MIZITO_OWNER_DASH==='1'&&R.isOwner(c);
const snap=(n,d)=>R.get(n,d);
const names=()=>snap('dash-users',{});
// Mizito user id -> gateway user id: OCE colleague with same full name, else display-only deleted-user id (letter-senders idOf)
function uid(c,mid,colleagues){const n=names()[mid];if(!n)return mid;const u=(colleagues||[]).find(x=>String(x.full_name||'').trim()===n);if(u)return String(u.id).replace(/-/g,'').slice(0,24);return require('./letter-senders').idOf(n)}
const extraNames=()=>{const a=snap('dash-allsummary',{}),n=names(),o=[];const m=a.max_inbox_size&&a.max_inbox_size.user;if(m&&n[m])o.push(n[m]);return o};
module.exports={on,snap,uid,names,extraNames};
