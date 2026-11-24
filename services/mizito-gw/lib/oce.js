// Per-request OCE client. The browser's own OCE access token is forwarded as the user's auth; no service account exists.
const BASE=(process.env.OCE_BASE||'http://oce-app:8000').replace(/\/$/,'');
const hex=id=>String(id||'').replace(/-/g,'').slice(0,24);
const crypto=require('crypto');
const ME_TTL=60000, ME_MAX=2000, TIMEOUT=+process.env.OCE_TIMEOUT_MS||30000, meCache=new Map();
const keyOf=t=>crypto.createHash('sha256').update(t).digest('hex');
function sweepMe(){const n=Date.now();for(const [k,v] of meCache)if(v.exp<=n)meCache.delete(k);while(meCache.size>=ME_MAX)meCache.delete(meCache.keys().next().value)}
class Unauthorized extends Error{}
function client(token){
  if(!token) throw new Unauthorized('no token');
  async function call(method,path,body,raw){
    const r=await fetch(BASE+'/api/v1'+path,{method,headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(TIMEOUT)});
    if(r.status===401) throw new Unauthorized('oce 401');
    if(!r.ok) throw new Error('oce '+method+' '+path+' '+r.status);
    if(raw) return r;
    return r.status===204?null:r.json();
  }
  const o={token,get:p=>call('GET',p),post:(p,b)=>call('POST',p,b),raw:p=>call('GET',p,null,true),call:(m,p,b)=>call(m,p,b)};
  o.me=async()=>{const k=keyOf(token),c=meCache.get(k);if(c&&c.exp>Date.now())return c.v;
    const u=await o.get('/users/me');const v={id:u.id,hexId:hex(u.id),role:u.role||null,name:u.full_name||u.name||u.email||'?',raw:u};
    sweepMe();meCache.set(k,{v,exp:Date.now()+ME_TTL});return v};
  return o;
}
module.exports={client,hex,Unauthorized,BASE,TIMEOUT};
