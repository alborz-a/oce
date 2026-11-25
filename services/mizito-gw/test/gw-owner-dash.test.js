const t=require('node:test'),a=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path');
t.test('owner-dash serves snapshot only for owner when flag on',()=>{
  const d=fs.mkdtempSync(path.join(os.tmpdir(),'od-'));fs.writeFileSync(path.join(d,'dash-badge.json'),'{"count":3,"total_count":5}');
  process.env.MIZITO_DATA_DIR=d;process.env.MIZITO_DATA_OWNER='AAA';process.env.MIZITO_OWNER_DASH='1';
  const OD=require('../lib/owner-dash');
  a.ok(OD.on({me:{id:'aaa'}}));a.ok(!OD.on({me:{id:'bbb'}}));a.deepEqual(OD.snap('dash-badge',null),{count:3,total_count:5});
  process.env.MIZITO_OWNER_DASH='0';a.ok(!OD.on({me:{id:'aaa'}}))});
