// Request context: user's token -> OCE client -> /me. Lookup maps (hex id -> uuid) are built only from lists OCE returns for this user.
const {client,hex}=require('./oce');
const T=require('../shapes/templates.json');
const J=x=>JSON.parse(JSON.stringify(x));
const LABEL_ROLES=(process.env.LABEL_ROLES||'owner,manager').split(',');
const WID='0'.repeat(23)+'1';
const PLABEL='0000000000000000000000a1';
const label=me=>LABEL_ROLES.includes(me.role)?'OCE (RSC)':'رویال استار';
const iso=s=>s?new Date(s).toISOString():null;
function tokenOf(req){const a=req.headers.authorization||'';const m=/^Bearer\s+(\S+)$/i.exec(a);return m?m[1]:null}
async function make(req,body){
  const oce=client(tokenOf(req));const me=await oce.me();
  let b={};try{b=JSON.parse(body||'{}')}catch(e){}if(!b||typeof b!=='object'||Array.isArray(b))b={};
  return {oce,me,b,T,J,hex,WID,PLABEL,iso,label:label(me),isManager:me.role==='manager'||me.role==='owner',tok:tokenOf(req)};
}
module.exports={make,label,LABEL_ROLES,WID,PLABEL,J,T,iso,tokenOf};
