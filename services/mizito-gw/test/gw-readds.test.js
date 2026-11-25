// Offline tests for the 2026-11-25 re-adds: monitor endpoints and title source. No network.
const test=require('node:test'),assert=require('node:assert');
const {label}=require('../lib/ctx');

test('title source: label is always رویال استار, also for owner and manager roles',()=>{
  for(const role of ['owner','manager','member','customer'])assert.equal(label({role}),'رویال استار',role);
});
