(function(){
// Boot shim: reuse the user's OCE session. No token -> OCE login with return URL. Never a placeholder credential.
var LOGIN='__OCE_LOGIN__',O=location.origin,T=null;
try{T=localStorage.getItem('oe_access_token')}catch(e){}
function toLogin(){var r=encodeURIComponent(location.pathname+location.search+location.hash);location.replace(LOGIN+'?next='+r)}
if(!T){toLogin();return}
try{localStorage.setItem('token',T);sessionStorage.setItem('token',T)}catch(e){}
function tok(){try{return localStorage.getItem('oe_access_token')||T}catch(e){return T}}
function same(u){return typeof u==='string'&&((u.charAt(0)==='/'&&u.charAt(1)!=='/'&&u.charAt(1)!=='\\')||u===O||u.indexOf(O+'/')===0||u.indexOf(O+'?')===0)}
var f=window.fetch;if(f)window.fetch=function(a,b){if(typeof a==='string'&&same(a)){b=b||{};b.headers=Object.assign({},b.headers||{},{Authorization:'Bearer '+tok()})}
  return f.call(this,a,b).then(function(r){if(r.status===401)toLogin();return r})};
var xo=XMLHttpRequest.prototype.open,xs=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(m,u){this.__u=u;return xo.apply(this,arguments)};
XMLHttpRequest.prototype.send=function(){var x=this;try{if(same(x.__u))x.setRequestHeader('Authorization','Bearer '+tok())}catch(e){}
  x.addEventListener('load',function(){if(x.status===401&&same(x.__u))toLogin()});return xs.apply(this,arguments)};
try{if(/^#\/ws\/im\/[0-9a-f]{24}$/.test(location.hash))location.hash=location.hash+'/'}catch(e){}
})();
