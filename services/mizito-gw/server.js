// mizito-gw 1.0: real Mizito frontend on the OCE backend. Per-user, live, same origin under BASE (default /mizito).
// No snapshot, no fixed credential, no service account, no request to any *.mizito.ir host.
const http=require('http'),fs=require('fs'),path=require('path');
const BASE=process.env.MIZITO_BASE_PATH||'/mizito';
const ROOT=process.env.MIRROR_DIR||path.join(__dirname,'mirror');
const ctxlib=require('./lib/ctx'),{Unauthorized}=require('./lib/oce');
const brand=require('./modules/brand'),chat=require('./modules/chat');
const routes=Object.assign({},...['brand','chat','projects','tasks','letters','dashboard'].map(m=>require('./modules/'+m).routes));
const MIME={'.js':'application/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ico':'image/x-icon','.json':'application/json','.jpg':'image/jpeg'};
const ABS=/(["'(=])\/(assets\/|views\/|lib\/|cdn\/|api\/|capi\/|c_\.js|a_\.js|app\.css|manifest\.webmanifest|sw\.js)/g;
const HOSTS=/https?:\/\/(?:[a-z0-9-]+\.)*mizito\.ir/gi;
const text=t=>/javascript|html|json|manifest|css/.test(t);
function send(res,code,body,type,extra){if(code===200&&text(type||'')){body=Buffer.isBuffer(body)?body.toString():body;if(typeof body==='string'){body=brand.brand(body);if(/javascript|html|css/.test(type))body=body.replace(HOSTS,'').replace(ABS,'$1'+BASE+'/$2')}}
  res.writeHead(code,Object.assign({'content-type':type||'text/plain','cache-control':'no-store'},extra||{}));res.end(body)}
const json=(res,code,o)=>send(res,code,JSON.stringify(o),'application/json; charset=utf-8');
function readFileCached(f){return fs.readFileSync(f)}
try{const c=fs.readFileSync(path.join(ROOT,'c_.js'),'utf8');brand.CACHE_ID=brand.cacheId(c)||brand.CACHE_ID}catch(e){}
const srv=http.createServer((req,res)=>{
  let p=decodeURIComponent((req.url.split('?')[0]));
  if(p==='/healthz')return json(res,200,{ok:true});
  if(p.startsWith('/api/')||p.startsWith('/capi/')){
    const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',async()=>{
      if(req.method==='OPTIONS')return send(res,204,'');
      const h=routes[p];if(!h)return json(res,404,{error:'not implemented in gateway',path:p});
      try{const c=await ctxlib.make(req,Buffer.concat(chunks).toString());return json(res,200,await h(c))}
      catch(e){if(e instanceof Unauthorized)return json(res,401,{error:'unauthorized'});console.log('ERR',p,e.message);return json(res,500,{error:'upstream'})}
    });return;
  }
  if(p.startsWith('/cdn/')){return (async()=>{try{const c=await ctxlib.make(req,'');const r=await chat.cdn(c,p.slice(5));
      if(r&&r.redirect){res.writeHead(302,{Location:r.redirect,'cache-control':'no-store'});return res.end()}
      if(r&&r.oceAvatar){const u=await c.oce.raw(r.oceAvatar.replace(/^\/api\/v1/,''));const b=Buffer.from(await u.arrayBuffer());res.writeHead(200,{'content-type':u.headers.get('content-type')||'image/webp','cache-control':'private, max-age=300'});return res.end(b)}
      const f=path.join(ROOT,'assets/img/person-logo.png');return send(res,200,fs.readFileSync(f),'image/png')}catch(e){return send(res,e instanceof Unauthorized?401:404,'')}})()}
  if(p==='/')p='/index.html';
  const f=path.normalize(path.join(ROOT,p));if(!f.startsWith(ROOT))return send(res,403,'');
  fs.readFile(f,(e,d)=>{if(e)return send(res,404,'');const ext=path.extname(f);
    if(p==='/index.html')return send(res,200,brand.indexHtml(d.toString()).replace(/<head>/,'<head><base href="'+BASE+'/">'),MIME['.html']);
    if(p==='/c_.js'){let s=d.toString().replace(HOSTS,'');s=brand.c_js(s).replace('Config.App.api_url=_o;Config.App.cdn_url=_o;','Config.App.api_url=_o+"'+BASE+'";Config.App.cdn_url=_o+"'+BASE+'";');return send(res,200,s,MIME['.js'])}
    send(res,200,d,MIME[ext]||'application/octet-stream',p==='/sw.js'?{'service-worker-allowed':BASE+'/'}:null)});
});
require('./modules/realtime').attach(srv);
if(require.main===module)srv.listen(+process.env.PORT||18090,process.env.HOST||'0.0.0.0',()=>console.log('mizito-gw listening',process.env.PORT||18090,'base',BASE,'cache_id',brand.CACHE_ID));
module.exports=srv;
