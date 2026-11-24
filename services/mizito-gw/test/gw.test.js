// Offline tests: gateway against a mock OCE. No real tokens, no network beyond 127.0.0.1. Run: node --test test/
const test=require('node:test'),assert=require('node:assert'),http=require('http'),fs=require('fs'),os=require('os'),path=require('path'),vm=require('vm'),WS=require('ws');
const TOK={tokA:{id:'aaaaaaaa-0000-0000-0000-000000000001',role:'staff',full_name:'A One'},tokB:{id:'bbbbbbbb-0000-0000-0000-000000000002',role:'staff',full_name:'B Two'}};
const ROOM_A='11111111-1111-1111-1111-111111111111';
let gw,oce,GW,hits=[];
const mirror=fs.mkdtempSync(path.join(os.tmpdir(),'gwm-'));fs.writeFileSync(path.join(mirror,'index.html'),'<head></head>x');fs.writeFileSync(path.join(mirror,'c_.js'),'cache_id:"1.0.4-1"');
fs.mkdirSync(path.join(mirror,'assets/img'),{recursive:true});fs.writeFileSync(path.join(mirror,'assets/img/person-logo.png'),'PNG');
function mock(){return new Promise(ok=>{oce=http.createServer((req,res)=>{
  const tok=(req.headers.authorization||'').replace(/^Bearer /,'');const u=TOK[tok];hits.push(req.method+' '+req.url+' '+tok);
  const j=(c,o,t)=>{res.writeHead(c,{'content-type':t||'application/json'});res.end(typeof o==='string'?o:JSON.stringify(o))};
  if(!u)return j(401,{});
  const p=req.url.replace('/api/v1','').split('?')[0];
  if(p==='/users/me')return j(200,u);
  if(p==='/team-chat/rooms/')return j(200,tok==='tokA'?[{id:ROOM_A,kind:'group',name:'g',member_ids:[TOK.tokA.id],project_id:null}]:[]);
  if(p==='/team-chat/colleagues/')return j(200,[{id:'cccccccc-0000-0000-0000-000000000003',full_name:'C Three',avatar_url:'/api/v1/documents/evil/file/'},{id:'dddddddd-0000-0000-0000-000000000004',full_name:'D Four',avatar_url:'//evil.example/x'}]);
  if(p==='/documents/evil/file/')return j(200,'<script>alert(1)</script>','text/html');
  const q=new URL(req.url,'http://x').searchParams,off=+q.get('offset')||0,lim=+q.get('limit')||50;const uid=n=>'%08x-0000-0000-0000-%012x'.replace('%08x',(n+0x10000000).toString(16)).replace('%012x',n.toString(16).padStart(12,'0'));
  if(p==='/tasks/my-tasks/'){if(tok!=='tokA')return j(200,{items:[],total:0});const all=Array.from({length:600},(_,i)=>({id:uid(i),title:'t'+i,status:'open',project_id:uid(9000),responsible_id:i%2?TOK.tokA.id:null,due_date:null}));return j(200,{items:all.slice(off,off+Math.min(lim,500)),total:600})}
  if(p==='/correspondence/mailbox/'){if(tok!=='tokA'||q.get('box')!=='inbox')return j(200,{items:[],total:0});const all=Array.from({length:250},(_,i)=>({id:uid(i),thread_id:uid(5000+i),subject:'s'+i,snippet:'x',sender_user_id:TOK.tokB.id,sent_at:'2026-11-01T00:00:00Z',unread:false,attachments_count:0,letter_number:null}));return j(200,{items:all.slice(off,off+Math.min(lim,100)),total:250})}
  if(/^\/correspondence\/[0-9a-f-]{36}\/thread\/$/.test(p))return j(200,{id:p.split('/')[2],thread_id:uid(5000),subject:'s0',letter_number:'ق- ۲۳۷ -۴۰۵',register_type:2,messages:[{id:uid(1),sender_user_id:TOK.tokB.id,recipients:[{user_id:TOK.tokA.id,name:'A'}],body_html:'<p>سلام</p>',sent_at:'2026-11-01T00:00:00Z',attachments:[]},{id:uid(2),sender_user_id:TOK.tokA.id,recipients:[],body_html:'پاسخ',sent_at:'2026-11-02T00:00:00Z',attachments:[]}]});
  if(p==='/projects/'){hits.push('PROJECTS');return j(200,{items:[{id:uid(9000),name:'P',owner_id:TOK.tokA.id,status:'active'}],total:1})}
  if(/\/projects\/.*\/members\/$/.test(p)){hits.push('MEMBERS');return j(200,[])}
  if(p.endsWith('/messages/')){const b=q.get('before');const all=Array.from({length:250},(_,i)=>({id:uid(100+i),room_id:ROOM_A,author_id:TOK.tokA.id,text:'m'+i,created_at:new Date(1.7e12+i*1000).toISOString(),document_ids:[]}));const end=b?all.findIndex(m=>m.id===b):all.length;return j(200,all.slice(Math.max(0,end-Math.min(lim,100)),end).reverse())}
  if(/\/file-url\/$/.test(p))return j(200,{url:'javascript:alert(1)'});
  j(404,{});
});oce.listen(0,'127.0.0.1',ok)})}
test.before(async()=>{await mock();process.env.OCE_BASE='http://127.0.0.1:'+oce.address().port;process.env.MIRROR_DIR=mirror;process.env.MAX_UPLOAD='1000';
  gw=require('../server.js');await new Promise(r=>gw.listen(0,'127.0.0.1',r));GW=gw.address().port});
test.after(()=>{gw.close();oce.close();setTimeout(()=>process.exit(0),50)});
const raw=(pth,o={})=>new Promise((ok,no)=>{const r=http.request({port:GW,host:'127.0.0.1',path:pth,method:o.method||'GET',headers:o.headers||{}},res=>{const c=[];res.on('data',d=>c.push(d));res.on('end',()=>ok({status:res.statusCode,headers:res.headers,body:Buffer.concat(c).toString()}))});r.on('error',no);r.end(o.body)});
const api=(p,tok,b)=>raw('/api/'+p,{method:'POST',headers:Object.assign({'content-type':'application/json'},tok?{authorization:'Bearer '+tok}:{}),body:JSON.stringify(b||{})});

test('unauthenticated and bad token -> 401, nothing reaches OCE data routes',async()=>{
  assert.equal((await api('chat/getDialogs')).status,401);
  assert.equal((await api('chat/getDialogs','nope')).status,401);
  assert.equal((await raw('/cdn/ph-'+'a'.repeat(32))).status,401);
  assert.equal((await raw('/api/content/upload',{method:'POST'})).status,401);
});
test('malformed URL escape and NUL byte do not crash',async()=>{
  assert.equal((await raw('/%E0%A4%A')).status,400);
  assert.equal((await raw('/%00')).status,400);
  assert.equal((await raw('/healthz')).status,200);
});
test('static path traversal blocked',async()=>{
  for(const p of ['/..%2f..%2fserver.js','/../server.js','/_rs/../server.js']){const r=await raw(p);assert.ok([403,404].includes(r.status),p+' '+r.status);assert.ok(!/srv\.listen/.test(r.body))}
});
test('user B cannot read user A room (membership comes from OCE list)',async()=>{
  const a=await api('chat/getFullChat','tokA',{dialog:ROOM_A.replace(/-/g,'').slice(0,24)});assert.ok(a.body.includes('participants'));
  const b=await api('chat/getFullChat','tokB',{dialog:ROOM_A.replace(/-/g,'').slice(0,24)});assert.equal(b.body,'{}');
  assert.equal((await api('chat/getHistory','tokB',{dialog:ROOM_A.replace(/-/g,'').slice(0,24)})).body,'[]');
  const s=await api('chat/send','tokB',{dialog:ROOM_A.replace(/-/g,'').slice(0,24),message:'x'});assert.equal(s.status,500);
});
test('non-object JSON body does not 500-loop or crash',async()=>{
  const r=await raw('/api/chat/getHistory',{method:'POST',headers:{authorization:'Bearer tokA'},body:'null'});assert.equal(r.status,200)});
test('me cache keyed by full token: same 40-char tail with other head is rejected',async()=>{
  await api('workspace/userId','tokA');const r=await api('workspace/userId','X'+'tokA');assert.equal(r.status,401)});
test('avatar proxy: html upstream is never served as html; every avatar miss answers 200 placeholder',async()=>{
  const r=await raw('/cdn/av-cccccccc0000000000000000',{headers:{authorization:'Bearer tokA'}});
  assert.equal(r.status,200);assert.equal(r.headers['content-type'],'image/png');assert.equal(r.headers['x-content-type-options'],'nosniff');assert.equal(r.body,'PNG');
  // 'dddd' avatar_url starts with // -> placeholder, never 404, never 302
  const r2=await raw('/cdn/av-dddddddd0000000000000000',{headers:{authorization:'Bearer tokA'}});assert.equal(r2.status,200);assert.equal(r2.headers['content-type'],'image/png');assert.equal(r2.body,'PNG');
  // unknown avatar id, and the dl/ form, also 200 image
  for(const pth of ['/cdn/av-eeeeeeee0000000000000000','/cdn/dl/av-eeeeeeee0000000000000000']){const r3=await raw(pth,{headers:{authorization:'Bearer tokA'}});assert.equal(r3.status,200);assert.equal(r3.headers['content-type'],'image/png')}
});
test('non-http presigned redirect is dropped',async()=>{
  const r=await raw('/cdn/ph-'+'a'.repeat(32),{headers:{authorization:'Bearer tokA'}});assert.notEqual(r.status,302);assert.ok(!(r.headers.location||'').startsWith('javascript'))});
test('upload: over the cap -> 413, filename sanitised',async()=>{
  const mp=(name,len)=>{const bd='XBOUND';return {bd,body:Buffer.concat([Buffer.from('--'+bd+'\r\nContent-Disposition: form-data; name="upload"; filename="'+name+'"\r\nContent-Type: image/png\r\n\r\n'),Buffer.alloc(len,65),Buffer.from('\r\n--'+bd+'--\r\n')])}};
  let m=mp('a.png',200000);let r=await raw('/api/content/upload',{method:'POST',headers:{authorization:'Bearer tokA','content-type':'multipart/form-data; boundary='+m.bd,'content-length':m.body.length},body:m.body});assert.equal(r.status,413);
  m=mp('..%2f<x>.png',10);r=await raw('/api/content/upload',{method:'POST',headers:{authorization:'Bearer tokA','content-type':'multipart/form-data; boundary='+m.bd,'content-length':m.body.length},body:m.body});
  assert.equal(r.status,200);const j=JSON.parse(r.body);const nm=j.photo.name;assert.ok(!/[<>\/\\]/.test(nm),nm)});
test('oversized /api body -> 413',async()=>{
  const r=await raw('/api/chat/send',{method:'POST',headers:{authorization:'Bearer tokA'},body:'{"a":"'+'x'.repeat(2200000)+'"}'});assert.equal(r.status,413)});
test('socket: junk frames (null, non-array, non-string token) do not crash the server',async()=>{
  const ws=new WS('ws://127.0.0.1:'+GW+'/socket.io/?EIO=3&transport=websocket');await new Promise(r=>ws.on('open',r));
  for(const f of ['42null','42"x"','42{"a":1}','42[["authenticate"]]','42["authenticate",{"token":5}]','42[','4','']) ws.send(f);
  await new Promise(r=>setTimeout(r,150));assert.equal((await raw('/healthz')).status,200);ws.close()});
test('dashboard summary is built from the caller, no frozen Mizito snapshot',async()=>{
  const r=await api('dashboard/getAllSummary','tokA');const j=JSON.parse(r.body);assert.ok(Array.isArray(j)&&j.length===1);assert.ok(!/ساختمانی|بیزینس/.test(r.body));assert.equal(j[0].task.overdue,0)});
test('chat history pages past 100 and reports messages_count',async()=>{
  const d=ROOM_A.replace(/-/g,'').slice(0,24);const h=JSON.parse((await api('chat/getHistory','tokA',{dialog:d})).body);assert.equal(h.length,250);
  const v=JSON.parse((await api('chat/getChatView','tokA',{dialog:d})).body);assert.equal(v.messages_count,250);assert.equal(v.seen[0].seen_count,250)});
test('tasks: pages past 500, assignee comes from responsible_id',async()=>{
  const r=JSON.parse((await api('tasks/getAll','tokA',{})).body);assert.equal(r.length,600);
  assert.deepEqual(r[1].assignee,[TOK.tokA.id.replace(/-/g,'').slice(0,24)]);assert.deepEqual(r[0].assignee,[null])});
test('letters: pages past 100, getHistory returns thread shape',async()=>{
  const r=JSON.parse((await api('inbox/getInbox','tokA',{mode:'inbox'})).body);assert.equal(r.length,250);
  const h=JSON.parse((await api('inbox/getHistory','tokA',{thread:r[3].thread})).body);assert.ok(h._id&&h.subject==='s0'&&Array.isArray(h.messages)&&h.messages.length===1&&h.count===2&&h.secretariat.sec_number===237&&h.content.includes('سلام'));
  assert.equal((await api('inbox/getHistory','tokB',{thread:r[3].thread})).body,'{}')});
test('caches: repeated routes hit OCE once; cache is per token',async()=>{
  hits.length=0;await api('projects/getList','tokA');await api('projects/getList','tokA');await api('projects/getList','tokA');
  assert.equal(hits.filter(x=>x==='PROJECTS').length,1);assert.equal(hits.filter(x=>x==='MEMBERS').length,1);
  const rooms0=hits.filter(x=>x.includes('/team-chat/rooms/ ')).length;await api('chat/getDialogs','tokA');await api('chat/getDialogs','tokA');assert.ok(hits.filter(x=>x.includes('/team-chat/rooms/ ')).length-rooms0<=1);
  assert.equal(JSON.parse((await api('projects/getList','tokB')).body).projects.length,1)});
test('nginx snippet carries body cap and rate limit',()=>{const n=fs.readFileSync(path.join(__dirname,'../nginx.snippet.conf'),'utf8');assert.match(n,/client_max_body_size 26m/);assert.match(n,/limit_req_zone/);assert.match(n,/map \$http_upgrade \$connection_upgrade/)});
test('templates carry no real Mizito ObjectIds',()=>{const s=fs.readFileSync(path.join(__dirname,'../shapes/templates.json'),'utf8');assert.ok(!/\b6[0-9a-f]{23}\b/.test(s.replace(/\b0{0,}f[0-9a-f]{7}0{16}\b/g,'')))});
test('shim: token only to same origin',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../shim/boot.js'),'utf8');let same;
  const ctx={location:{origin:'https://portal.royalstars.co',pathname:'/',search:'',hash:'',replace(){}},localStorage:{getItem:()=>'t',setItem(){}},sessionStorage:{setItem(){}},XMLHttpRequest:function(){},window:{}};ctx.XMLHttpRequest.prototype={open(){},send(){}};
  vm.runInNewContext(src.replace('function same(u)','globalThis.__same=function same(u)').replace(/var f=window\.fetch;[\s\S]*$/,'})();'),Object.assign(ctx,{globalThis:ctx}));same=ctx.__same;
  assert.ok(same('/api/x'));assert.ok(same('https://portal.royalstars.co/api'));
  for(const u of ['//evil.com/x','/\\evil.com','https://portal.royalstars.co.evil.com/x','https://evil.com/','javascript:1'])assert.ok(!same(u),u)});

test('manifest icons carry the BASE prefix and Royal Star name',async()=>{
  fs.writeFileSync(path.join(mirror,'manifest.webmanifest'),JSON.stringify({name:'Mizito',short_name:'Mizito',icons:[{src:'/assets/img/icon-192.png',sizes:'192x192'},{src:'/assets/img/icon-512.png',sizes:'512x512'}]}));
  const r=await raw('/manifest.webmanifest');const m=JSON.parse(r.body);
  assert.strictEqual(m.name,'رویال استار');assert.strictEqual(m.short_name,'رویال استار');
  for(const i of m.icons)assert.ok(i.src.startsWith('/_rs/assets/img/'),i.src);
});
test('splash loader is blanked in served index (no logo, no text, no dots)',async()=>{
  const r=await raw('/_rs/');assert.strictEqual(r.status,200);
  assert.ok(/\.loader\s*\*\{display:none!important\}/.test(r.body));
  assert.ok(/<base href="\/_rs\/">/.test(r.body));assert.ok(!/mizito\.svg|app-loading-title/.test(r.body));
});
test('office icons served from overrides (favicon, apple-touch 152/167, 192, 512)',async()=>{
  for(const p of ['/assets/img/icons/icon_152.png','/assets/img/icons/icon_167.png','/assets/img/icon-192.png','/assets/img/icon-512.png','/assets/img/favicon.ico']){
    const r=await raw(p);assert.strictEqual(r.status,200,p);assert.ok(r.body.length>100,p);
  }
  const ico=await raw('/assets/img/favicon.ico');assert.match(String(ico.headers['content-type']),/image\/x-icon/);
});
test('missing art images answer a 200 transparent placeholder, real files win, non-image stays 404',async()=>{
  const cc={'cache-control':'public, max-age=300'};
  const rb=p=>new Promise((ok,no)=>http.get({port:GW,host:'127.0.0.1',path:p},r=>{const c=[];r.on('data',d=>c.push(d));r.on('end',()=>ok({status:r.statusCode,headers:r.headers,buf:Buffer.concat(c)}))}).on('error',no));
  const png=await rb('/assets/img/emoji/1f389.png');assert.equal(png.status,200);assert.equal(png.headers['content-type'],'image/png');assert.equal(png.headers['cache-control'],cc['cache-control']);assert.ok(png.buf.subarray(0,8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])));
  const bp=await raw('/_rs/assets/img/birthday_popper.svg');assert.equal(bp.status,200);assert.match(String(bp.headers['content-type']),/image\/svg\+xml/);assert.match(bp.body,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"><\/svg>$/);
  const bw=await rb('/_rs/assets/img/birthday_popper.webp');assert.equal(bw.status,200);assert.equal(bw.headers['content-type'],'image/webp');assert.equal(bw.buf.subarray(8,12).toString(),'WEBP');
  const gif=await raw('/assets/img/x/none.gif');assert.equal(gif.status,200);assert.equal(gif.headers['content-type'],'image/gif');
  const jpg=await raw('/assets/img/x/none.jpg');assert.equal(jpg.status,200);assert.equal(jpg.headers['content-type'],'image/jpeg');
  const real=await raw('/assets/img/person-logo.png');assert.equal(real.status,200);assert.equal(real.body,'PNG');
  assert.equal((await raw('/assets/img/notes.txt')).status,404);
  assert.equal((await raw('/assets/img/../../../etc/none.png')).status,403);
  assert.equal((await raw('/views/missing.html')).status,404);
  assert.equal((await raw('/api/v1/none.png')).status,404);
});

// shim logout: runs shim/boot.js in a vm sandbox with fake browser globals. Checks OCE keys, oce_ui cookie, /login target, 401 path, no loop.
function runShim(){
  const mkStore=()=>{const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),_m:m}};
  const ls=mkStore(),ss=mkStore();ls.setItem('oe_access_token','TOK-A');ls.setItem('oe_refresh_token','REF-A');
  const cookies=[],lis={},timers=[],navs=[];let fetchStatus=200;const calls=[];
  const doc={cookie:'',body:{},addEventListener:(t,f)=>{(lis[t]=lis[t]||[]).push(f)},querySelectorAll:()=>[],open(){},write(){},close(){}};
  const sandbox={location:{origin:'https://p.test',pathname:'/_rs/',search:'',hash:'',replace:u=>navs.push(u),stop:()=>{}},localStorage:ls,sessionStorage:ss,document:new Proxy(doc,{set(t,k,v){if(k==='cookie')cookies.push(String(v));else t[k]=v;return true}}),
    window:{stop(){},fetch:(a,b)=>{calls.push(a);return Promise.resolve({status:fetchStatus})}},XMLHttpRequest:function(){},NodeFilter:{SHOW_TEXT:4},MutationObserver:function(){this.observe=()=>{}},setTimeout:f=>{timers.push(f);return 0},clearTimeout(){}, console};
  sandbox.window.XMLHttpRequest=sandbox.XMLHttpRequest;sandbox.XMLHttpRequest.prototype={open(){},send(){},setRequestHeader(){},addEventListener(){}};
  sandbox.window.document=sandbox.document;sandbox.window.location=sandbox.location;
  let src=fs.readFileSync(path.join(__dirname,'..','shim','boot.js'),'utf8').replace('__OCE_LOGIN__','/login').replace('__HIDE_SEL__','.none');
  const ctx=vm.createContext(sandbox);vm.runInContext(src,ctx);
  return {ls,ss,cookies,lis,timers,navs,calls,setStatus:s=>{fetchStatus=s},win:sandbox.window};
}
test('shim logout: API logout clears OCE keys and oce_ui cookie, then /login',async()=>{
  const s=runShim();
  await s.win.fetch('https://p.test/auth/logout',{method:'POST'});await new Promise(r=>setImmediate(r));
  assert.equal(s.ls.getItem('oe_access_token'),null);assert.equal(s.ls.getItem('oe_refresh_token'),null);assert.equal(s.ls.getItem('token'),null);assert.equal(s.ss.getItem('oe_access_token'),null);
  assert.ok(s.cookies.some(c=>/^oce_ui=;.*Max-Age=0/.test(c)&&/Path=\//.test(c)&&/Secure/.test(c)&&/SameSite=Lax/.test(c)));
  assert.deepEqual(s.navs,['/login']);
});
test('shim logout: menu click (ng-click logout()) clears and goes to /login via timer fallback once',async()=>{
  const s=runShim();const click=s.lis.click[0];
  click({target:{nodeType:1,getAttribute:n=>n==='ng-click'?'logout()':null,parentNode:null}});
  assert.equal(s.timers.length,1);s.timers[0]();s.timers[0]();
  assert.equal(s.ls.getItem('oe_access_token'),null);assert.deepEqual(s.navs,['/login']);
});
test('shim 401 path clears oce_ui cookie and does not loop (guard -> error page, no second navigation)',async()=>{
  const s=runShim();s.setStatus(401);
  await s.win.fetch('https://p.test/_rs/api/x',{});await new Promise(r=>setImmediate(r));
  assert.ok(s.cookies.some(c=>/^oce_ui=;.*Max-Age=0/.test(c)));assert.equal(s.ls.getItem('oe_access_token'),null);
  assert.equal(s.navs.length,1);assert.match(s.navs[0],/^\/login\?next=/);
});
test('workspace/switch answers 200 with the single workspace (no 404 in the console)',async()=>{
  const r=await raw('/api/workspace/switch',{method:'POST',headers:{authorization:'Bearer tokA','content-type':'application/json'},body:'{"id":"x"}'});
  assert.equal(r.status,200);const j=JSON.parse(r.body);assert.ok(j.ok);assert.ok(j._id);assert.equal(j.workspaces.length,1);assert.equal(j.workspaces[0]._id,j._id);
});
