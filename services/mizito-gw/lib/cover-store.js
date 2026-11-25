// Project cover files kept by the gateway (interim until OCE has a GET picture route, RSD-1.4).
// Layout: COVER_DIR/<oce_project_id>.<jpg|jpeg|png|webp>. No dependencies (safe to require from modules/projects.js).
const fs=require('fs'),path=require('path');
const COVER_DIR=path.resolve(process.env.MIZITO_COVER_DIR||'/opt/mizito-gw/covers');
const EXT={jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',webp:'image/webp'};
const ID_RE=/^[0-9a-f-]{32,36}$/;
const TTL=60000;
const seen=new Map();
// {file,type} for a valid project id with a cover file in dir; null otherwise. Id is validated, path re-checked under dir.
function coverFile(id,dir=COVER_DIR){
  if(typeof id!=='string'||!ID_RE.test(id))return null;
  for(const e of Object.keys(EXT)){const f=path.join(dir,id+'.'+e);if(f.startsWith(dir+path.sep)&&fs.existsSync(f))return {file:f,type:EXT[e]}}
  return null;
}
// Existence check memoized for 60s (file presence is global, not per user).
function hasCoverFile(id,dir=COVER_DIR){
  const k=dir+'|'+id,now=Date.now(),c=seen.get(k);
  if(c&&c.exp>now)return c.v;
  if(seen.size>5000)seen.clear();
  const v=!!coverFile(id,dir);seen.set(k,{v,exp:now+TTL});return v;
}
module.exports={COVER_DIR,ID_RE,coverFile,hasCoverFile};
