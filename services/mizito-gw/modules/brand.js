// Brand + boot shim + workspace identity. No mizito.ir host may reach the browser. Visible text is Royal Star (رویال استار).
const fs=require('fs'),path=require('path');
const {WID}=require('../lib/ctx');
const FA='رویال استار';
const ESC=[...FA].map(c=>c===' '?' ':'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0')).join('');
const RAW_RE=/م[یي]‌?ز[یي]‌?تو/g;
const ESC_RE=/\\u0645(?:\\u06cc|\\u064a)(?:\\u200c)?\\u0632(?:\\u06cc|\\u064a)(?:\\u200c)?\\u062a\\u0648/gi;
// «میزکار» (Mizito workspace word): static assets only, never API JSON
const KAR_RAW_RE=/م[یي]‌?ز[كک]‌?[اآ]ر/g;
const KAR_ESC_RE=/\\u0645(?:\\u06cc|\\u064a)(?:\\u200c)?\\u0632(?:\\u06a9|\\u0643)\\u0627\\u0631/gi;
const brand=s=>s.replace(RAW_RE,FA).replace(ESC_RE,ESC);
const brandStatic=s=>brand(s).replace(KAR_RAW_RE,FA).replace(KAR_ESC_RE,ESC);
const SECTION=process.env.MIZITO_BASE_PATH||'/mizito';
const OCE_LOGIN=process.env.OCE_LOGIN_PATH||'/login';
const SHIM=fs.readFileSync(path.join(__dirname,'..','shim','boot.js'),'utf8').replace('__OCE_LOGIN__',OCE_LOGIN);
const LOGO_SVG='assets/img/royal-star-logo.svg';
function indexHtml(raw){
  let s=raw.replace(/<head>/,'<head><style>.license{display:none!important}</style><script>'+SHIM+'</script>');
  s=s.replace(/<script async src="https:\/\/www\.googletagmanager[\s\S]*?<\/script>\s*<script>[\s\S]*?<\/script>/,'');
  s=s.replace(/assets\/img\/mizito_logo_full\.png(\?v=\d+)?/g,LOGO_SVG+'?v=1');
  s=s.replace(/<title>[\s\S]*?<\/title>/,'<title>'+FA+'</title>');
  return s;
}
// Neutralise Mizito links in served JS/HTML: any mizito.ir URL becomes "#" (no-op), never a relative gateway path.
const MIZITO_URL_RE=/https?:\/\/(?:[a-z0-9-]+\.)*mizito\.ir[^"'\s)`]*/gi;
function neutralLinks(s){return s.replace(MIZITO_URL_RE,'#')}
// Manifest: Royal Star name, icons served from overrides.
function manifest(raw){try{const m=JSON.parse(raw);m.name=FA;m.short_name=FA;m.lang='fa';m.dir='rtl';return JSON.stringify(m)}catch(e){return raw}}
// cache_id gate: Mizito reloads in a loop unless workspace/userId client_version == Config.App.cache_id.
function cacheId(s){const m=/cache_id\W{1,4}(\d[\d.\-]*\d)/.exec(s)||/c_\.js\?v=(\d[\d.\-]*\d)/.exec(s);return m?m[1]:null}
function c_js(raw){return raw+`;try{var _o=location.origin;Config.App.api_url=_o;Config.App.cdn_url=_o;Config.App.io_url=_o;Config.App.domains=[location.hostname];Config.App.client_url=_o+'/#/';}catch(e){}`}
module.exports={brand,brandStatic,neutralLinks,manifest,indexHtml,c_js,cacheId,FA,routes:{
  '/api/workspace/name':async c=>JSON.stringify(c.label),
  '/api/workspace/userId':async c=>{const w=c.J(c.T.userId);w.uid=c.me.hexId;w.wid=WID;w.phone='';
    if(module.exports.CACHE_ID)w.client_version=module.exports.CACHE_ID; // equals c_.js cache_id by construction
    w.workspaces=[{_id:WID,title:c.label,active:true}];
    Object.assign(w,{wallpaper:'back-pattern',plan_upgrade_need:false,plan_is_demo:false,plan_ds_near_ex:false,plan_ds_ex:false,plan_storage_almost_full:false,remain_days:3650});
    w.access_admin=w.access_owner=c.isManager;return w},
}};
