// Offline: stored old-Mizito snapshots (notes owner-only, monitoring/CRM manager-only). No network.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path');
const d=fs.mkdtempSync(path.join(os.tmpdir(),'r2-'));
fs.writeFileSync(path.join(d,'notes.json'),'[{"title":"n"}]');fs.writeFileSync(path.join(d,'customers.json'),'[{"name":"c"}]');fs.writeFileSync(path.join(d,'chart_tasksDone.json'),'{"labels":["a"],"values":[1]}');
process.env.MIZITO_DATA_DIR=d;process.env.MIZITO_DATA_OWNER='AAAA';
const {routes}=require('../modules/misc.js');
const mgr={me:{id:'aaaa'},isManager:true},emp={me:{id:'bbbb'},isManager:false};
test('notes only for owner; customers/charts only for managers',async()=>{
  assert.equal((await routes['/api/notes/getAll'](mgr)).length,1);assert.deepEqual(await routes['/api/notes/getAll'](emp),[]);
  assert.equal((await routes['/api/monitor/customers'](mgr)).length,1);assert.deepEqual(await routes['/api/monitor/customers'](emp),[]);
  assert.deepEqual((await routes['/api/monitor/chart/tasksDone'](mgr)).values,[1]);assert.deepEqual((await routes['/api/monitor/chart/tasksDone'](emp)).values,[]);
  assert.deepEqual(await routes['/api/monitor/workspace'](mgr),{});
});
