// Offline tests for the 2026-11-25 re-adds: monitor endpoints and title source. No network.
const test=require('node:test'),assert=require('node:assert');
const {routes}=require('../modules/brand');
const {label}=require('../lib/ctx');

const MONITOR=['/api/monitor/workspace','/api/monitor/chart/chatMessages','/api/monitor/chart/inboxMessages','/api/monitor/chart/tasksCreated','/api/monitor/chart/tasksDone','/api/monitor/chart/customers','/api/monitor/chart/notes','/api/monitor/chart/getPast30DoneTasksPercents'];

test('monitor: all 8 client monitor routes are registered (no 404)',()=>{
  for(const p of MONITOR)assert.equal(typeof routes[p],'function',p);
});

test('monitor: chart routes return well-formed empty {labels,values}',async()=>{
  for(const p of MONITOR.slice(1,7)){
    const r=await routes[p]({});
    assert.deepEqual(r,{labels:[],values:[]},p);
  }
});

test('monitor: past30 percents returns empty array; workspace returns object',async()=>{
  assert.deepEqual(await routes['/api/monitor/chart/getPast30DoneTasksPercents']({}),[]);
  const w=await routes['/api/monitor/workspace']({});
  assert.equal(typeof w,'object');assert.notEqual(w,null);
});

test('title source: label is always رویال استار, also for owner and manager roles',()=>{
  for(const role of ['owner','manager','member','customer'])assert.equal(label({role}),'رویال استار',role);
});

test('notes/getAll: empty array (client loadNotes iterates the result), no 404',async()=>{
  const {routes:m}=require('../modules/misc');
  assert.deepEqual(await m['/api/notes/getAll']({}),[]);
});
