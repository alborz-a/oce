#!/bin/sh
# No-model build gate. FAILS on seeded tokens, as-user hooks, snapshots and any *.mizito.ir host in what the gateway ships.
D="$(cd "$(dirname "$0")/.." && pwd)"; fail=0
bad(){ echo "FAIL: $1"; fail=1; }
# 1. source tree (gateway code, shim) must not contain impersonation hooks or dummy tokens
for pat in '/__as/' 'w2as' '?as=' 'dummy-local-token' 'dummy token' 'users-role.json'; do
  if grep -rIlF --exclude-dir=node_modules --exclude-dir=mirror --exclude=check-build.sh --exclude='*.md' -- "$pat" "$D" >/dev/null 2>&1; then bad "source contains '$pat'"; fi
done
find "$D" -path "$D/node_modules" -prune -o \( -name 'snapshot*.json' -o -name 'users-role.json' \) -print 2>/dev/null | grep -q . && bad "snapshot/users-role file present"
# 1b. the shipped mirror itself: same hooks, no backup files (served statically), no snapshot/role dumps
if [ -d "$D/mirror" ]; then
  for pat in '/__as/' 'w2as' '?as=' 'dummy-local-token' 'dummy token' 'users-role.json'; do
    if grep -rIlF --exclude='*.bak*' -- "$pat" "$D/mirror" >/dev/null 2>&1; then bad "mirror contains '$pat'"; fi
  done
  find "$D/mirror" \( -name '*.bak*' -o -name '*.orig' -o -name '*~' \) -print 2>/dev/null | grep -q . && bad "mirror contains backup files (served statically)"
  hosts=$(grep -rIlE 'https?://([a-z0-9-]+\.)*mizito\.ir' --exclude='*.bak*' --exclude=a_.js "$D/mirror" 2>/dev/null | head -3 | tr '\n' ' ')
  [ -n "$hosts" ] && bad "mirror files reference a mizito.ir host: $hosts"
fi
# 2. shipped c_.js: gateway strips hosts at serve time, so test the served bytes
if [ -f "$D/mirror/c_.js" ]; then
  out=$(cd "$D" && node -e '
const http=require("http");const s=require("./server.js");s.listen(0,"127.0.0.1",()=>{const p=s.address().port;
const g=(u,cb)=>http.get({port:p,path:u},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>cb(b))});
g("/c_.js",a=>g("/",b=>{const m=(a+b).match(/[a-z0-9.-]*mizito\.ir/gi);console.log(m?"HOSTS:"+[...new Set(m)].join(","):"clean");process.exit(0)}))});' 2>&1 | tail -1)
  case "$out" in clean) ;; *) bad "served c_.js: $out";; esac
else echo "note: mirror/ absent, served c_.js check skipped"; fi
[ "$fail" = 0 ] && echo "check-build: OK" || { echo "check-build: FAILED"; exit 1; }
