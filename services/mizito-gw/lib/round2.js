// Stored snapshot of old Mizito read-only screens (notes, CRM customers, monitoring, payments). Dir = MIZITO_DATA_DIR (not in git). Missing file = empty answer.
// Access: notes only for MIZITO_DATA_OWNER (OCE user uuid of the notes' owner); everything else manager/owner roles only.
const fs=require('fs'),path=require('path');
const DIR=process.env.MIZITO_DATA_DIR||'';const OWNER=(process.env.MIZITO_DATA_OWNER||'').toLowerCase();
const cache={};
function get(name,dflt){if(!DIR)return dflt;if(name in cache)return cache[name];let v=dflt;try{v=JSON.parse(fs.readFileSync(path.join(DIR,name+'.json'),'utf8'))}catch(e){}cache[name]=v;return v}
const isOwner=c=>!!OWNER&&String(c&&c.me&&c.me.id||'').toLowerCase()===OWNER;
const guard=(name,dflt)=>async c=>c&&c.isManager?get(name,dflt):dflt;
module.exports={get,isOwner,guard};
