// Brand + boot shim + workspace identity. No mizito.ir host may reach the browser.
const fs=require('fs'),path=require('path');
const {WID}=require('../lib/ctx');
const FA='رویال استار';
const ESC=[...FA].map(c=>c===' '?' ':'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
const RAW_RE=/م[یي]‌?ز[یي]‌?تو/g;
const ESC_RE=/\\u0645(?:\\u06cc|\\u064a)(?:\\u200c)?\\u0632(?:\\u06cc|\\u064a)(?:\\u200c)?\\u062a\\u0648/gi;
const brand=s=>s.replace(RAW_RE,FA).replace(ESC_RE,ESC);
const SECTION=process.env.MIZITO_BASE_PATH||'/mizito';
const OCE_LOGIN=process.env.OCE_LOGIN_PATH||'/login';
const SHIM=fs.readFileSync(path.join(__dirname,'..','shim','boot.js'),'utf8').replace('__OCE_LOGIN__',OCE_LOGIN);
function indexHtml(raw){
  let s=raw.replace(/<head>/,'<head><script>'+SHIM+'</script>');
  s=s.replace(/<script async src="https:\/\/www\.googletagmanager[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/,'');
  return s;
}
// cache_id gate: Mizito reloads in a loop unless workspace/userId client_version == Config.App.cache_id.
function cacheId(c_js){const m=/cache_id\W{1,4}([0-9][0-9.\-]*[0-9])/.exec(c_js);return m?m[1]:null}
function c_js(raw){return raw+`;try{var _o=location.origin;Config.App.api_url=_o;Config.App.cdn_url=_o;Config.App.io_url=_o;Config.App.domains=[location.hostname];Config.App.client_url=_o+'/#/';}catch(e){}`}
module.exports={brand,indexHtml,c_js,cacheId,routes:{
  '/api/workspace/name':async c=>JSON.stringify(c.label),
  '/api/workspace/userId':async c=>{const w=c.J(c.T.userId);w.uid=c.me.hexId;w.wid=WID;w.phone='';
    if(module.exports.CACHE_ID)w.client_version=module.exports.CACHE_ID; // equals c_.js cache_id by construction
    w.workspaces=[{_id:WID,title:c.label,active:true}];
    w.access_admin=w.access_owner=c.isManager;return w},
}};
