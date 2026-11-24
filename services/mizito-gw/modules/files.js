// File/photo send in chat. Per-user: the caller's own OCE token does every upload and the team-chat post.
// Wire: POST /api/content/upload (multipart, field "upload") is buffered per user (the room is unknown at upload time);
// chat.send {dialog,message,media} uploads it to OCE (Document, plus Photo for images) in the room's project, then posts
// a team-chat message with document_ids + metadata.files. Download: content.getDownloadLink -> /cdn/dl/<token>.
const crypto=require('crypto');
const {BASE,hex}=require('../lib/oce');
const PENDING=new Map(); // content id -> {user,name,mime,buf,at}
const META=new Map();    // OCE photo uuid -> {name,mime,size} for imported attachments
const TTL=3600000;
const hex32=u=>String(u).replace(/-/g,'');
const uuidOf=h=>h.replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,'$1-$2-$3-$4-$5');
const isImg=(mime,name)=>/^image\/(png|jpe?g|webp|gif)/.test(mime||'')||/\.(png|jpe?g|webp|gif)$/i.test(name||'');
const plain=s=>String(s||'').replace(/<[^>]*>/g,'').trim();
function sweep(){const n=Date.now();for(const [k,v] of PENDING)if(n-v.at>TTL)PENDING.delete(k)}
function mediaObj(id,name,mime,size,image){
  if(image){const ph={_id:id,id,name,photo_medium:{content:id,size,w:800,h:800,content_key:id},photo_large:{content:id,size,w:800,h:800,content_key:id}};return {_:'messageMediaPhoto',photo:ph}}
  return {_:'messageMediaDocument',document:{_id:id,id,name,size,mime_type:mime,content:id,file_name:name}};
}
const readBody=req=>new Promise(ok=>{const c=[];req.on('data',d=>c.push(d));req.on('end',()=>ok(Buffer.concat(c)))});

// raw (pre-body) handler: multipart upload. Returns true when it took the request.
function raw(req,res,p,ctxlib,json){
  if(!(req.method==='POST'&&p==='/api/content/upload'))return false;
  (async()=>{
    const buf=await readBody(req);const c=await ctxlib.make(req,'');
    const fd=await new Request('http://x/',{method:'POST',headers:{'content-type':req.headers['content-type']||''},body:buf,duplex:'half'}).formData();
    const f=fd.get('upload');if(!f||typeof f==='string')return json(res,200,{error:true,msg:'no file'});
    sweep();const id='gw'+crypto.randomBytes(12).toString('hex');const b=Buffer.from(await f.arrayBuffer());
    PENDING.set(id,{user:c.me.hexId,name:f.name,mime:f.type||'application/octet-stream',buf:b,at:Date.now()});
    json(res,200,mediaObj(id,f.name,f.type,b.length,isImg(f.type,f.name)&&fd.get('sendAsFile')!=='true'));
  })().catch(e=>{console.log('ERR upload',e.message);json(res,e.name==='Unauthorized'?401:500,{error:'upload'})});
  return true;
}

async function sendMedia(c,chat,room){
  const m=c.b.media||{};const cid=(m.photo&&m.photo.photo_medium&&m.photo.photo_medium.content)||(m.document&&m.document.content);
  const p=PENDING.get(cid);if(!p||p.user!==c.me.hexId)throw new Error('unknown content');
  if(!room.project_id)throw new Error('room has no project');
  const t=c.oce.token,image=isImg(p.mime,p.name),text=plain(c.b.message);
  const mk=cap=>{const fd=new FormData();if(cap)fd.append('caption',cap);fd.append('file',new Blob([p.buf],{type:p.mime}),p.name);return fd};
  const H={authorization:'Bearer '+t};
  const dr=await fetch(BASE+'/api/v1/documents/upload/?project_id='+room.project_id+'&category='+(image?'photo':'other'),{method:'POST',headers:H,body:mk()});
  if(!dr.ok)throw new Error('oce document upload '+dr.status);const doc=await dr.json();
  let photoId=null;
  if(image){const pr=await fetch(BASE+'/api/v1/documents/photos/upload/?project_id='+room.project_id,{method:'POST',headers:H,body:mk(text||p.name)});if(pr.ok)photoId=(await pr.json()).id}
  const sha=crypto.createHash('sha256').update(p.buf).digest('hex');
  const msg=await c.oce.post('/team-chat/rooms/'+room.id+'/messages/',{text,reply_to_id:null,document_ids:[doc.id],mentions:[],metadata:{files:[{document_id:doc.id,photo_id:photoId,name:p.name,mime:p.mime,size:p.buf.length,sha256:sha}]}});
  PENDING.delete(cid);return expand(msg,0,chat.message)[0];
}

// OCE message -> array of Mizito messages, one per attachment (caption on the first). `base` is chat.message.
function expand(m,idx,base){
  const b=base(m,idx);const ids=(Array.isArray(m.document_ids)?m.document_ids:[]).filter(Boolean);
  if(!ids.length)return [b];
  const files=m.metadata&&Array.isArray(m.metadata.files)?m.metadata.files:null;
  return ids.map((id,i)=>{
    const f=files&&files.find(x=>x.document_id===id);const meta=f||META.get(id)||{};
    const image=f?(isImg(f.mime,f.name)&&!!f.photo_id):(META.has(id)?isImg(meta.mime,meta.name):true);
    const content=f?(f.photo_id?'ph-'+hex32(f.photo_id):'dl-'+hex32(f.document_id)):'ph-'+hex32(id);
    const o=Object.assign({},b,{_id:i?b._id+'-'+i:b._id,message:''});
    const media=mediaObj(content,meta.name||'file',meta.mime,meta.size||-1,image);media.caption=i?'':(m.text||'');o.media=media;return o});
}
// names/mimes of imported attachments (tells images from files, e.g. a DWG that is not a picture)
async function prefetch(c,list){
  const ids=[...new Set((list||[]).flatMap(m=>(m.metadata&&m.metadata.files)?[]:(m.document_ids||[])))].filter(i=>!META.has(i)).slice(0,60);
  await Promise.all(ids.map(async id=>{try{const j=await c.oce.get('/documents/photos/'+id);
    META.set(id,{name:j.filename||j.file_name||j.name||(j.file_path||'').split('/').pop()||'',mime:j.mime_type||j.content_type||'',size:j.file_size||-1})}catch(e){}}));
}

const SAFE_HDR={'x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'"};
const safeImg=t=>/^image\/(png|jpe?g|webp|gif)/.test(t||'')?t.split(';')[0]:'application/octet-stream';
// /cdn/<name> additions: pending preview, dl-<doc> stream, ph-<photo> stream when OCE has no presigned url. Returns {status,type,body,headers} or null.
async function cdn(c,name){
  let m;
  if((m=/^(gw[0-9a-f]{24})$/.exec(name))){const f=PENDING.get(m[1]);return f&&f.user===c.me.hexId?{type:safeImg(f.mime),body:f.buf,headers:SAFE_HDR}:{status:404}}
  if((m=/^dl\/dl-([0-9a-f]{32})$/.exec(name))||(m=/^dl-([0-9a-f]{32})$/.exec(name))){
    const r=await c.oce.raw('/documents/'+uuidOf(m[1])+'/download/');const body=Buffer.from(await r.arrayBuffer());
    const cd=r.headers.get('content-disposition')||'';const nm=(cd.match(/filename\*?=(?:UTF-8'')?"?([^";]+)/i)||[])[1]||'download.bin';
    return {type:'application/octet-stream',body,headers:{...SAFE_HDR,'content-name':encodeURI(decodeURIComponent(nm)),'content-disposition':'attachment; filename="'+encodeURIComponent(decodeURIComponent(nm))+'"'}};
  }
  if((m=/^(?:dl\/)?ph-([0-9a-f]{32})$/.exec(name))){
    const u=uuidOf(m[1]);const j=await c.oce.get('/documents/photos/'+u+'/file-url/');const url=j.url||j.file_url||j.download_url;
    if(url)return {redirect:url};
    const r=await c.oce.raw('/documents/photos/'+u+'/file/');return {type:safeImg(r.headers.get('content-type')),body:Buffer.from(await r.arrayBuffer()),headers:SAFE_HDR};
  }
  return null;
}

function mkRoutes(chat){return {
  '/api/content/getDownloadLink':async c=>String(c.b.content||''),
  '/api/chat/send':async c=>{
    const m=c.b.media;if(!m||!(m._==='messageMediaPhoto'||m._==='messageMediaDocument'))return chat.routes['/api/chat/send'](c);
    const s=await chat.load(c);const r=s.roomBy[c.b.dialog];if(!r)throw new Error('unknown dialog');
    return sendMedia(c,chat,r)}}}
module.exports={raw,expand,prefetch,cdn,get routes(){return mkRoutes(require('./chat'))},isImg};
