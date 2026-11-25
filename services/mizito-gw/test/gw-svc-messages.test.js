// Offline test: Mizito service rows in modules/chat.js message(). No network. Run: node --test test/
const test=require('node:test'),assert=require('node:assert');
const {message}=require('../modules/chat.js');

const base=(text,extra)=>Object.assign({id:'aaaaaaaa-0000-0000-0000-000000000001',room_id:'bbbbbbbb-0000-0000-0000-000000000002',author_id:'cccccccc-0000-0000-0000-000000000003',created_at:'2026-11-25T10:00:00Z',text},extra||{});

test('[رویداد: messageActionChatAddUser] -> Farsi service text',()=>{
  const o=message(base('[رویداد: messageActionChatAddUser]'));
  assert.equal(o.message,'عضو جدید اضافه شد');
  assert.ok(!/messageAction|رویداد/.test(o.message));
});

test('ChatCreate and ChatDeleteUser map to Farsi',()=>{
  assert.equal(message(base('[رویداد: messageActionChatCreate]')).message,'گروه ساخته شد');
  assert.equal(message(base('[رویداد: messageActionChatDeleteUser]')).message,'عضو حذف شد');
});

test('unknown messageAction event -> hidden (null)',()=>{
  assert.equal(message(base('[رویداد: messageActionSomethingNew]')),null);
});

test('empty text without documents -> hidden (null), no [پیام سیستمی] placeholder',()=>{
  assert.equal(message(base('')),null);
  assert.equal(message(base(null)),null);
});

test('normal text message unchanged',()=>{
  const o=message(base('سلام'));
  assert.equal(o.message,'سلام');
  assert.equal(o._,'message');
});
