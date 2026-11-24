#!/bin/sh
# No-model build gate. FAILS on seeded tokens, as-user hooks, snapshots and any *.mizito.ir host in what the gateway ships.
D="$(cd "$(dirname "$0")/.." && pwd)"; fail=0
bad(){ echo "FAIL: $1"; fail=1; }
# 1. source tree (gateway code, shim) must not contain impersonation hooks or dummy tokens
for pat in '/__as/' 'w2as' '?as=' 'dummy-local-token' 'dummy token' 'users-role.json'; do
  if grep -rIlF --exclude-dir=node_modules --exclude-dir=mirror --exclude=check-build.sh --exclude='*.md' -- "$pat" "$D" >/dev/null 2>&1; then bad "source contains '$pat'"; fi
done
find "$D" -path "$D/node_modules" -prune -o \( -name 'snapshot*.json' -o -name 'users-role.json' \) -print 2>/dev/null | grep -q . && bad "snapshot/users-role file present"
# 2. shipped c_.js: gateway strips hosts at serve time, so test the served bytes
if [ -f "$D/mirror/c_.js" ]; then
  out=$(cd "$D" && node -e '
const http=require("http");const s=require("./server.js");s.listen(0,"127.0.0.1",()=>{const p=s.address().port;
http.get({port:p,path:"/c_.js"},r=>{let b="";r.on("data",d=>b+=d);r.on("end",()=>{const m=b.match(/[a-z0-9.-]*mizito\.ir/gi);console.log(m?"HOSTS:"+[...new Set(m)].join(","):"clean");process.exit(0)})})});' 2>&1 | tail -1)
  case "$out" in clean) ;; *) bad "served c_.js: $out";; esac
else echo "note: mirror/ absent, served c_.js check skipped"; fi
[ "$fail" = 0 ] && echo "check-build: OK" || { echo "check-build: FAILED"; exit 1; }
