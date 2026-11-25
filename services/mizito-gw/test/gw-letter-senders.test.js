// Offline: deleted-sender display names for imported letters (lib/letter-senders.js + modules/chat getUsers). No network.
const test=require('node:test'),assert=require('node:assert'),fs=require('fs'),os=require('os'),path=require('path');
const f=path.join(os.tmpdir(),'ls-'+process.pid+'.json');
fs.writeFileSync(f,JSON.stringify({'aaaaaaaaaaaaaaaaaaaaaaaa':'علی آقاجانی'}));
process.env.MIZITO_LETTER_SENDERS=f;
const LS=require('../lib/letter-senders');
test('sender map gives stable dd-prefixed 24-hex id and name',()=>{
  const d=LS.senderOf('aaaaaaaaaaaaaaaaaaaaaaaa');
  assert.equal(d.name,'علی آقاجانی');assert.match(d.id,/^dd[0-9a-f]{22}$/);
  assert.equal(LS.idOf('علی آقاجانی'),d.id);
  assert.equal(LS.senderOf('bbbbbbbbbbbbbbbbbbbbbbbb'),null);
  assert.deepEqual(LS.names(),['علی آقاجانی']);
});
test.after(()=>{try{fs.unlinkSync(f)}catch(e){}});
