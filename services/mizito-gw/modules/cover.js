// GET /cdn/cover/<projectId>: project cover bytes from the gateway cover dir. Caller must be logged in and own the project in its OCE list.
const fs=require('fs');
const {Unauthorized}=require('../lib/oce');
const {listRaw}=require('./projects');
const {COVER_DIR,ID_RE,coverFile}=require('../lib/cover-store');
const SEC={'x-content-type-options':'nosniff','x-frame-options':'SAMEORIGIN','referrer-policy':'same-origin'};
// make(): returns the per-request ctx (ctxlib.make(req,'')); throws Unauthorized without a valid session.
async function handle(res,id,{make,dir=COVER_DIR}={}){
  const send=(code,type,body,extra)=>{res.writeHead(code,Object.assign({'content-type':type||'text/plain','cache-control':'no-store'},SEC,extra||{}));res.end(body)};
  if(typeof id!=='string'||!ID_RE.test(id))return send(404,'','');
  let c;try{c=await make()}catch(e){return send(e instanceof Unauthorized?401:404,'','')}
  let mine;try{mine=await listRaw(c)}catch(e){return send(404,'','')}
  if(!Array.isArray(mine)||!mine.some(p=>String(p.id).toLowerCase()===id))return send(404,'','');
  const f=coverFile(id,dir);if(!f)return send(404,'','');
  send(200,f.type,fs.readFileSync(f.file),{'cache-control':'private, max-age=300','content-security-policy':"sandbox; default-src 'none'"});
}
module.exports={handle};
