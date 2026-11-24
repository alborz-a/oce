(function(){
// Boot shim: reuse the user's OCE session. Token read from sessionStorage and localStorage.
// No token -> OCE login with return URL (one-shot guard). Still no token or 401 after a login -> static error page with backup link. Never a redirect loop.
var LOGIN='__OCE_LOGIN__',O=location.origin,KEY='oe_access_token',GUARD='rsd_gw_login_once',BACKUP='/legacy-mizito/',T=null;
function read(){try{return localStorage.getItem(KEY)||sessionStorage.getItem(KEY)}catch(e){return null}}
function guardOn(){try{return sessionStorage.getItem(GUARD)==='1'}catch(e){return false}}
function guardSet(v){try{if(v)sessionStorage.setItem(GUARD,'1');else sessionStorage.removeItem(GUARD)}catch(e){}}
function errPage(){try{window.stop()}catch(e){}
  document.open();document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رویال استار</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;direction:rtl"><h2>ورود به رویال استار انجام نشد</h2><p>لطفاً دوباره وارد حساب خود شوید، یا از نسخهٔ پشتیبان استفاده کنید.</p><p><a href="'+BACKUP+'">ورود به نسخهٔ پشتیبان</a></p></body></html>');document.close()}
// OCE session end: same keys as frontend useAuthStore clearSession (oe_access_token, oe_refresh_token) plus the shim token; cookie oce_ui (not httpOnly) expired.
function clearOce(){try{var ks=[KEY,'oe_refresh_token','token'];for(var i=0;i<ks.length;i++){localStorage.removeItem(ks[i]);sessionStorage.removeItem(ks[i])}sessionStorage.setItem('oe_manual_login','1')}catch(e){}
  try{document.cookie='oce_ui=; Path=/; Max-Age=0; SameSite=Lax; Secure'}catch(e){}}
function toLogin(){clearOce();if(guardOn()){errPage();return}guardSet(true);var r=encodeURIComponent(location.pathname+location.search+location.hash);location.replace(LOGIN+'?next='+r)}
T=read();
if(!T){toLogin();return}
try{localStorage.setItem('token',T);sessionStorage.setItem('token',T)}catch(e){}
function tok(){return read()||T}
function same(u){return typeof u==='string'&&((u.charAt(0)==='/'&&u.charAt(1)!=='/'&&u.charAt(1)!=='\\')||u===O||u.indexOf(O+'/')===0||u.indexOf(O+'?')===0)}
function okSeen(){guardSet(false)}
var f=window.fetch;if(f)window.fetch=function(a,b){if(typeof a==='string'&&same(a)){b=b||{};b.headers=Object.assign({},b.headers||{},{Authorization:'Bearer '+tok()})}
  return f.call(this,a,b).then(function(r){if(isLogoutUrl(typeof a==='string'?a:''))logoutDone();if(r.status===401)toLogin();else if(r.status>=200&&r.status<300&&same(typeof a==='string'?a:''))okSeen();return r})};
var xo=XMLHttpRequest.prototype.open,xs=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return xo.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(){var x=this;try{if(same(x.__u))x.setRequestHeader('Authorization','Bearer '+tok())}catch(e){}
  x.addEventListener('load',function(){if(isLogoutUrl(x.__u))logoutDone();if(x.status===401&&same(x.__u))toLogin();else if(x.status>=200&&x.status<300&&same(x.__u))okSeen()});return xs.apply(this,arguments)};
// Logout: the Mizito profile menu item (ng-click logout()) clears the OCE session at once (the app reloads /login, which kills timers), then OCE login. Logout requests also end here.
var lgDone=false;function logoutDone(){if(lgDone)return;lgDone=true;clearOce();try{location.replace(LOGIN)}catch(e){}}
function isLogoutUrl(u){return typeof u==='string'&&/\/(auth|session)\/logout(\?|\/|$)/.test(u)}
try{document.addEventListener('click',function(e){var t=e.target;while(t&&t.nodeType===1){var ng=t.getAttribute&&t.getAttribute('ng-click');if(ng&&/(^|[^A-Za-z_])logout\(/.test(ng)){clearOce();setTimeout(logoutDone,4000);return}t=t.parentNode}},true)}catch(e){}
try{if(/^#\/ws\/im\/[0-9a-f]{24}$/.test(location.hash))location.hash=location.hash+'/'}catch(e){}
// Hide workspace switcher/create card and support/help buttons that render after the CSS (class list mirrors brand.js HIDE_SEL).
try{var SEL='__HIDE_SEL__';function hide(){try{var n=document.querySelectorAll(SEL);for(var i=0;i<n.length;i++)n[i].style.setProperty('display','none','important')}catch(e){}}
var FA='رویال استار',MZT=/م[یي]زِ?[كک]ار/,MZ=/م[یي]زِ?[كک]ار/g,REG='md-toolbar,.workspace_header,.bl-appbar,.active-workspace-container,.header_workspace_name,.menu-profile-container';
function fixText(){try{var h=document.querySelector('h3.active-workspace-title');if(h&&h.textContent.trim()!==FA)h.textContent=FA;
var rs=document.querySelectorAll(REG);for(var r=0;r<rs.length;r++){var w=document.createTreeWalker(rs[r],NodeFilter.SHOW_TEXT),t;while((t=w.nextNode())){if(MZT.test(t.nodeValue))t.nodeValue=t.nodeValue.replace(MZ,'').replace(/\s{2,}/g,' ')}}}catch(e){}}
var mo=new MutationObserver(function(){hide();fixText()});document.addEventListener('DOMContentLoaded',function(){hide();mo.observe(document.body,{childList:true,subtree:true});hide();fixText()})}catch(e){}
})();
