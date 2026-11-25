// socket.io v2 (engine.io v3, websocket). Per-client upstream: each browser's own token opens its own OCE team-chat WS. No shared service connection.
const WS=require('ws');const {client,hex,BASE}=require('../lib/oce');const {WID}=require('../lib/ctx');const chat=require('./chat');
const pkt=(ev,d)=>'42'+JSON.stringify([ev,d]);
exports.attach=function(server){
  const wss=new WS.Server({noServer:true,maxPayload:65536});
  const GWB=process.env.MIZITO_BASE_PATH||'/_rs';
  server.on('upgrade',(req,sock,head)=>{let u=req.url||'';if(u.startsWith(GWB+'/'))u=u.slice(GWB.length);if(!u.startsWith('/socket.io/'))return sock.destroy();wss.handleUpgrade(req,sock,head,ws=>wss.emit('connection',ws,req))});
  wss.on('connection',ws=>{const c={ws,up:null,sid:Math.random().toString(36).slice(2,12)};
    ws.send('0'+JSON.stringify({sid:c.sid,upgrades:[],pingInterval:25000,pingTimeout:60000}));
    ws.on('message',buf=>{const s=String(buf);
      if(s==='40'){ws.send('40'+JSON.stringify({sid:c.sid}));return}
      if(s==='2'){ws.send('3');return}
      if(s.startsWith('42')){let d;try{d=JSON.parse(s.slice(2))}catch(e){return}
        if(Array.isArray(d)&&d[0]==='authenticate'&&d[1]&&typeof d[1].token==='string'&&d[1].token.length<4096&&!c.up)upstream(c,d[1].token)}});
    const iv=setInterval(()=>{if(ws.readyState===1)ws.send('2')},25000);
    ws.on('close',()=>{clearInterval(iv);if(c.up)try{c.up.close()}catch(e){}});ws.on('error',()=>{});
  });
};
function upstream(c,token){
  const oce=client(token);const ctx={oce};
  const up=new WS(BASE.replace(/^http/,'ws')+'/api/v1/team-chat/ws/',{handshakeTimeout:15000,maxPayload:4194304});c.up=up;
  up.on('open',()=>up.send(JSON.stringify({type:'auth',token})));
  up.on('message',async buf=>{try{let e;try{e=JSON.parse(String(buf))}catch(x){return}
    if(e.event==='ready'){try{const rooms=await oce.get('/team-chat/rooms/');up.send(JSON.stringify({type:'subscribe',room_ids:rooms.map(r=>r.id)}))}catch(x){}}
    if(e.event==='message.created'&&e.message&&c.ws.readyState===1){try{const me=await oce.me(),cx={oce,me,iso:x=>x?new Date(x).toISOString():null},st=await chat.load(cx),k=chat.canonMap(cx,st)[e.message.room_id];if(k&&k!==e.message.room_id)e.message=Object.assign({},e.message,{room_id:k})}catch(x){}await require('./files').prefetch(ctx,[e.message]);for(const b of require('./files').expand(e.message,0,chat.message))c.ws.send(pkt('m',{type:'chat_message',body:b,workspace_id:WID}))}}catch(x){console.log('ERR realtime',x.message)}});
  up.on('close',()=>{c.up=null;try{if(c.ws.readyState===1)c.ws.close()}catch(x){}});up.on('error',()=>{});
}
