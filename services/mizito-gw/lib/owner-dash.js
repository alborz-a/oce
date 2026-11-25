// Owner dashboard parity: for MIZITO_DATA_OWNER only (flag MIZITO_OWNER_DASH=1) serve the stored old-Mizito dashboard values (data dir files dash-*.json). Everyone else: live OCE data. Read-only; no DB writes.
const R=require('./round2');
const on=c=>process.env.MIZITO_OWNER_DASH==='1'&&R.isOwner(c);
const snap=(n,d)=>R.get(n,d);
const names=()=>snap('dash-users',{});
// Mizito user id -> gateway user id: OCE colleague with same full name, else display-only deleted-user id (letter-senders idOf)
function uid(c,mid,colleagues){const n=names()[mid];if(!n)return mid;const u=(colleagues||[]).find(x=>String(x.full_name||'').trim()===n);if(u)return String(u.id).replace(/-/g,'').slice(0,24);return require('./letter-senders').idOf(n)}
const extraNames=()=>{const a=snap('dash-allsummary',{}),n=names(),o=[];const m=a.max_inbox_size&&a.max_inbox_size.user;if(m&&n[m])o.push(n[m]);const w=snap('dash-wsusers',[]);w.slice(0,-1).forEach(x=>x.names.forEach(nm=>{if(nm&&nm!=='آرش پیرنیا')o.push(nm)}));return o};
const fs=require('fs'),path=require('path');
const DIR=process.env.MIZITO_DATA_DIR||'';
// photo file of a colleague by full name (stored old-Mizito avatars: <dir>/avatars/<mizito id>.jpg)
function photoFile(name){if(!DIR||!name)return null;const n=names();const mid=Object.keys(n).find(k=>n[k]===String(name).trim());if(!mid)return null;const f=path.join(DIR,'avatars',mid+'.jpg');return fs.existsSync(f)?f:null}
// last task line (old workspace/getUsers work_status) by full name
function workStatus(name){const w=snap('dash-work',{});return w[String(name||'').trim()]||{}}
// plan banner: days to expiry (negative = overdue) from MIZITO_PLAN_EXPIRED_AT (default 2026-10-30, old value -24 on 2026-11-23)
const remainDays=()=>Math.floor((Date.parse(process.env.MIZITO_PLAN_EXPIRED_AT||'2026-10-30T20:30:00Z')-Date.now())/864e5);
// display-only (deleted) user id -> photo file: dd-id is idOf(name)
function photoFileById(id){const LS=require('./letter-senders');const n=Object.values(names()).find(x=>LS.idOf(x)===id);return n?photoFile(n):null}
const OLD=process.env.MIZITO_OLD_UI==='1';
module.exports={on,snap,uid,names,extraNames,photoFile,photoFileById,workStatus,OLD,remainDays};
