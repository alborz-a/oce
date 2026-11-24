// Small per-user TTL cache. Key = sha256(token) + name; bounded; never shared across tokens.
const crypto=require('crypto');
const M=new Map(),MAX=5000;
const hk=t=>crypto.createHash('sha256').update(t).digest('hex').slice(0,32);
async function memo(token,name,ttl,fn){
  const k=hk(token)+':'+name,now=Date.now(),c=M.get(k);
  if(c&&c.exp>now)return c.p;
  if(M.size>=MAX){for(const [x,v] of M)if(v.exp<=now)M.delete(x);while(M.size>=MAX)M.delete(M.keys().next().value)}
  const p=fn();M.set(k,{p,exp:now+ttl});p.catch(()=>{if(M.get(k)&&M.get(k).p===p)M.delete(k)});return p}
const drop=(token,name)=>M.delete(hk(token)+':'+name);
module.exports={memo,drop};
