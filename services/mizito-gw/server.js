// mizito-gw 1.0: real Mizito frontend on the OCE backend. Per-user, live, same origin under BASE (default /_rs).
// No snapshot, no fixed credential, no service account, no request to any *.mizito.ir host.
const http=require('http'),fs=require('fs'),path=require('path');
const BASE=process.env.MIZITO_BASE_PATH||'/_rs';
const ROOT=path.resolve(process.env.MIRROR_DIR||path.join(__dirname,'mirror'));
const OVERRIDES=path.join(__dirname,'overrides');
const ctxlib=require('./lib/ctx'),{Unauthorized}=require('./lib/oce');
const brand=require('./modules/brand'),chat=require('./modules/chat');
const routes=Object.assign({},...['brand','chat','projects','tasks','letters','dashboard','misc','files'].map(m=>require('./modules/'+m).routes));
const MIME={'.js':'application/javascript','.css':'text/css','.html':'text/html; charset=utf-8','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.ico':'image/x-icon','.json':'application/json','.jpg':'image/jpeg'};
const ABS=/(["'(=`])\/(assets\/|views\/|lib\/|c_\.js|a_\.js|app\.css|manifest\.webmanifest|sw\.js)/g;
// missing art images under assets/img answer a tiny placeholder (200) instead of 404; real files and overrides win. jpg has no alpha (white 1x1).
const ART_PH={'.png':Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABpfZFQAAAAABJRU5ErkJggg==','base64'),'.gif':Buffer.from('R0lGODlhAQABAIEAAAAAAAAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAgEAAEEBAA7','base64'),'.webp':Buffer.from('UklGRkAAAABXRUJQVlA4WAoAAAAQAAAAAAAAAAAAQUxQSAIAAAAAAFZQOCAYAAAAMAEAnQEqAQABAAFAJiWkAANwAP79NmgA','base64'),'.jpg':Buffer.from('/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD3+iiigD//2Q==','base64'),'.svg':Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')};
const artPlaceholder=(p,f)=>{if(!p.startsWith('/assets/img/')||!f.startsWith(ROOT+path.sep+'assets'+path.sep+'img'+path.sep))return null;const e=path.extname(f).toLowerCase();return ART_PH[e]?e:null};
const HOSTS=/https?:\/\/(?:[a-z0-9-]+\.)*mizito\.ir/gi;
const MAXBODY=+process.env.MAX_API_BODY||2097152;
const SEC={'x-content-type-options':'nosniff','x-frame-options':'SAMEORIGIN','referrer-policy':'same-origin'};
const text=t=>/javascript|html|json|manifest|css/.test(t);
function send(res,code,body,type,extra){if(code===200&&text(type||'')){body=Buffer.isBuffer(body)?body.toString():body;if(typeof body==='string'){if(/manifest/.test(type))body=brand.manifest(body,BASE);else if(/json/.test(type))body=brand.brand(body);else{body=brand.brandStatic(body);if(/javascript|html|css/.test(type))body=brand.neutralLinks(body).replace(ABS,'$1'+BASE+'/$2')}}}
  res.writeHead(code,Object.assign({'content-type':type||'text/plain','cache-control':'no-store'},SEC,extra||{}));res.end(body)}
const json=(res,code,o)=>send(res,code,JSON.stringify(o),'application/json; charset=utf-8');
function readFileCached(f){return fs.readFileSync(f)}
for(const f of ['c_.js','a_.js','index.html']){try{brand.CACHE_ID=brand.CACHE_ID||brand.cacheId(fs.readFileSync(path.join(ROOT,f),'utf8'))}catch(e){}}
const srv=http.createServer((req,res)=>{
  let p;try{p=decodeURIComponent((req.url.split('?')[0]))}catch(e){return send(res,400,'')}
  if(p.indexOf('\0')>=0)return send(res,400,'');
  if(p.startsWith(BASE+'/'))p=p.slice(BASE.length);
  if(p==='/healthz')return json(res,200,{ok:true});
  if(require('./modules/files').raw(req,res,p,ctxlib,json))return;
  if(p.startsWith('/api/')||p.startsWith('/capi/')){
    const chunks=[];let n=0,big=false;req.on('data',c=>{n+=c.length;if(n>MAXBODY){big=true;chunks.length=0;return}chunks.push(c)});req.on('end',async()=>{
      if(big)return json(res,413,{error:'too large'});
      if(req.method==='OPTIONS')return send(res,204,'');
      const h=routes[p];if(!h)return json(res,404,{error:'not implemented in gateway',path:p});
      try{const c=await ctxlib.make(req,Buffer.concat(chunks).toString());return json(res,200,await h(c))}
      catch(e){if(e instanceof Unauthorized)return json(res,401,{error:'unauthorized'});console.log('ERR',p,e.message);return json(res,500,{error:'upstream'})}
    });return;
  }
  if(p.startsWith('/cdn/')){return (async()=>{try{const c=await ctxlib.make(req,'');const r=await require('./modules/files').cdn(c,p.slice(5))||await chat.cdn(c,p.slice(5));
      if(r&&r.body){res.writeHead(r.status||200,Object.assign({'content-type':r.type||'application/octet-stream','content-length':r.body.length,'cache-control':'no-store'},SEC,r.headers||{}));return res.end(r.body)}
      if(r&&r.status){res.writeHead(r.status);return res.end()}
      if(r&&r.redirect&&/^https?:\/\//i.test(r.redirect)){res.writeHead(302,{Location:r.redirect,'cache-control':'no-store'});return res.end()}
      if(r&&r.oceAvatar){const ap=r.oceAvatar.replace(/^\/api\/v1/,'');if(!/^\/[A-Za-z0-9_\/.-]+$/.test(ap)||ap.includes('..')||ap.startsWith('//'))return send(res,404,'');const u=await c.oce.raw(ap);const b=Buffer.from(await u.arrayBuffer());const ct=u.headers.get('content-type')||'';res.writeHead(200,Object.assign({'content-type':/^image\/(png|jpe?g|webp|gif)/.test(ct)?ct.split(';')[0]:'application/octet-stream','cache-control':'private, max-age=300','content-security-policy':"sandbox; default-src 'none'"},SEC));return res.end(b)}
      const f=path.join(ROOT,'assets/img/person-logo.png');return send(res,200,fs.readFileSync(f),'image/png')}catch(e){if(e instanceof Unauthorized)return send(res,401,'');
    // avatar with no OCE file: neutral placeholder, never 404 (OCE 404 on the avatar file throws in lib/oce)
    if(/^\/cdn\/(dl\/)?av-/.test(p))return send(res,200,fs.readFileSync(path.join(ROOT,'assets/img/person-logo.png')),'image/png');return send(res,404,'')}})()}
  if(p==='/')p='/index.html';
  // Royal Star replacements (committed) win over mirror assets with Mizito branding
  if(p.startsWith('/assets/img/')){const of=path.normalize(path.join(OVERRIDES,p.slice('/assets/img/'.length)));if(of.startsWith(OVERRIDES+path.sep)&&fs.existsSync(of))return send(res,200,fs.readFileSync(of),MIME[path.extname(of)]||'application/octet-stream')}
  const f=path.normalize(path.join(ROOT,p));if(f!==ROOT&&!f.startsWith(path.resolve(ROOT)+path.sep))return send(res,403,'');
  fs.readFile(f,(e,d)=>{if(e){const ph=artPlaceholder(p,f);if(ph)return send(res,200,ART_PH[ph],MIME[ph],{'cache-control':'public, max-age=300'});return send(res,404,'')}const ext=path.extname(f);
    if(p==='/index.html')return send(res,200,brand.indexHtml(d.toString()).replace(/<head>/,'<head><base href="'+BASE+'/">'),MIME['.html']);
    if(p==='/c_.js'){let s=d.toString().replace(HOSTS,'');s=brand.c_js(s).replace('Config.App.api_url=_o;Config.App.cdn_url=_o;','Config.App.api_url=_o+"'+BASE+'";Config.App.cdn_url=_o+"'+BASE+'";');return send(res,200,s,MIME['.js'])}
    send(res,200,d,MIME[ext]||'application/octet-stream',p==='/sw.js'?{'service-worker-allowed':BASE+'/'}:null)});
});
srv.on('clientError',(e,s)=>{try{s.destroy()}catch(x){}});
require('./modules/realtime').attach(srv);
// safety net only: handlers catch their own errors; never let one stray rejection kill every user's session
process.on('unhandledRejection',e=>console.log('ERR unhandledRejection',e&&e.message));
process.on('uncaughtException',e=>console.log('ERR uncaughtException',e&&e.message));
if(require.main===module)srv.listen(+process.env.PORT||18090,process.env.HOST||'0.0.0.0',()=>console.log('mizito-gw listening',process.env.PORT||18090,'base',BASE,'cache_id',brand.CACHE_ID));
module.exports=srv;
