(function(){
// Boot shim: reuse the user's OCE session. Token read from sessionStorage and localStorage.
// No token -> OCE login with return URL (one-shot guard). Still no token or 401 after a login -> static error page with backup link. Never a redirect loop.
var LOGIN='__OCE_LOGIN__',O=location.origin,KEY='oe_access_token',GUARD='rsd_gw_login_once',BACKUP='/legacy-mizito/',T=null;
function read(){try{return localStorage.getItem(KEY)||sessionStorage.getItem(KEY)}catch(e){return null}}
function guardOn(){try{return sessionStorage.getItem(GUARD)==='1'}catch(e){return false}}
function guardSet(v){try{if(v)sessionStorage.setItem(GUARD,'1');else sessionStorage.removeItem(GUARD)}catch(e){}}
function errPage(){try{window.stop()}catch(e){}
  document.open();document.write('<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>رویال استار</title></head><body style="font-family:sans-serif;text-align:center;padding:40px;direction:rtl"><h2>ورود به رویال استار انجام نشد</h2><p>لطفاً دوباره وارد حساب خود شوید، یا از نسخهٔ پشتیبان استفاده کنید.</p><p><a href="'+BACKUP+'">ورود به نسخهٔ پشتیبان</a></p></body></html>');document.close()}
function toLogin(){if(guardOn()){errPage();return}guardSet(true);var r=encodeURIComponent(location.pathname+location.search+location.hash);location.replace(LOGIN+'?next='+r)}
T=read();
if(!T){toLogin();return}
try{localStorage.setItem('token',T);sessionStorage.setItem('token',T)}catch(e){}
function tok(){return read()||T}
function same(u){return typeof u==='string'&&((u.charAt(0)==='/'&&u.charAt(1)!=='/'&&u.charAt(1)!=='\\')||u===O||u.indexOf(O+'/')===0||u.indexOf(O+'?')===0)}
function okSeen(){guardSet(false)}
var f=window.fetch;if(f)window.fetch=function(a,b){if(typeof a==='string'&&same(a)){b=b||{};b.headers=Object.assign({},b.headers||{},{Authorization:'Bearer '+tok()})}
  return f.call(this,a,b).then(function(r){if(r.status===401)toLogin();else if(r.status>=200&&r.status<300&&same(typeof a==='string'?a:''))okSeen();return r})};
var xo=XMLHttpRequest.prototype.open,xs=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return xo.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(){var x=this;try{if(same(x.__u))x.setRequestHeader('Authorization','Bearer '+tok())}catch(e){}
  x.addEventListener('load',function(){if(x.status===401&&same(x.__u))toLogin();else if(x.status>=200&&x.status<300&&same(x.__u))okSeen()});return xs.apply(this,arguments)};
try{if(/^#\/ws\/im\/[0-9a-f]{24}$/.test(location.hash))location.hash=location.hash+'/'}catch(e){}
// Hide workspace switcher/create card and support/help buttons that render after the CSS (class list mirrors brand.js HIDE_SEL).
try{var SEL='__HIDE_SEL__';function hide(){try{var n=document.querySelectorAll(SEL);for(var i=0;i<n.length;i++)n[i].style.setProperty('display','none','important')}catch(e){}}
var mo=new MutationObserver(function(){hide()});document.addEventListener('DOMContentLoaded',function(){hide();mo.observe(document.body,{childList:true,subtree:true})})}catch(e){}
})();
