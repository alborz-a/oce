// Offline tests for the run4 read stubs: settings planInfo details, history, deal/payment/monitor reads. No network.
const test=require('node:test'),assert=require('node:assert');
const {routes}=require('../modules/misc');

const ctx=(b={})=>({b,me:{hexId:'user-1'}});

test('planInfo without details keeps the old shape',async()=>{
  const r=await routes['/api/workspace/planInfo'](ctx({}));
  assert.deepEqual(r,{used:0,volume:1099511627776,remain_days:3650});
});

test('planInfo details: loader fields non-null, owner_id is caller',async()=>{
  const r=await routes['/api/workspace/planInfo'](ctx({details:true}));
  assert.ok(r.max_members_count>0);
  assert.equal(r.owner_id,'user-1');
  assert.equal(r.is_enterprise_plan,true);
  assert.ok(r.plan_expired_at>'2099-01-01');
  for(const f of ['max_members','gift_members','max_file_size_mb','max_inbox_size','max_delay','max_nonzero_coeff','remain_in_board','plan_type','plan_code'])
    assert.notEqual(r[f],undefined,f);
});

test('settings history: object with items array (client does c.items||[])',async()=>{
  const r=await routes['/api/workspace/getSettingsHistory'](ctx({before:null,filters:{}}));
  assert.deepEqual(r.items,[]);
  assert.equal(r.hasMore,false);
});

test('deal and payment reads return arrays',async()=>{
  for(const p of ['/api/deal/getAll','/api/deal/getReportStatistics','/api/payment/getReportStatistics','/api/payment/getAllPayments','/api/monitor/minutes'])
    assert.deepEqual(await routes[p](ctx({filter:{}})),[],p);
});

test('monitor user is object; tasksAssigned has user and total sub-charts',async()=>{
  assert.deepEqual(await routes['/api/monitor/user'](ctx({uid:'x'})),{});
  const t=await routes['/api/monitor/chart/tasksAssigned'](ctx({uid:'x',not_owner:true}));
  assert.deepEqual(t.user.values,[]);
  assert.deepEqual(t.total.labels,[]);
  assert.equal(t.all_count,0);
});

test('write endpoints are NOT stubbed (stay 404)',()=>{
  for(const p of ['/api/workspace/setWorkspaceSettings','/api/workspace/updateTitle','/api/workspace/updateUserPermission','/api/deal/update','/api/payment/update'])
    assert.equal(routes[p],undefined,p);
});
