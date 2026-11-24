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
  if(p.endsWith('/messages/')||p==='/tasks/my-tasks/')return j(200,[]);
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
  for(const p of ['/..%2f..%2fserver.js','/../server.js','/mizito/../server.js']){const r=await raw(p);assert.ok([403,404].includes(r.status),p+' '+r.status);assert.ok(!/srv\.listen/.test(r.body))}
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
test('avatar proxy: html upstream is never served as html; odd paths 404',async()=>{
  const r=await raw('/cdn/av-cccccccc0000000000000000',{headers:{authorization:'Bearer tokA'}});
  assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/octet-stream');assert.equal(r.headers['x-content-type-options'],'nosniff');assert.match(r.headers['content-security-policy'],/sandbox/);
  // 'dddd' avatar_url starts with // -> not proxied
  const r2=await raw('/cdn/av-dddddddd0000000000000000',{headers:{authorization:'Bearer tokA'}});assert.ok(r2.status===404||r2.status===200);assert.notEqual(r2.status,302)});
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
test('shim: token only to same origin',()=>{
  const src=fs.readFileSync(path.join(__dirname,'../shim/boot.js'),'utf8');let same;
  const ctx={location:{origin:'https://portal.royalstars.co',pathname:'/',search:'',hash:'',replace(){}},localStorage:{getItem:()=>'t',setItem(){}},sessionStorage:{setItem(){}},XMLHttpRequest:function(){},window:{}};ctx.XMLHttpRequest.prototype={open(){},send(){}};
  vm.runInNewContext(src.replace('function same(u)','globalThis.__same=function same(u)').replace(/var f=window\.fetch;[\s\S]*$/,'})();'),Object.assign(ctx,{globalThis:ctx}));same=ctx.__same;
  assert.ok(same('/api/x'));assert.ok(same('https://portal.royalstars.co/api'));
  for(const u of ['//evil.com/x','/\\evil.com','https://portal.royalstars.co.evil.com/x','https://evil.com/','javascript:1'])assert.ok(!same(u),u)});
