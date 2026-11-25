// Offline test: DM/colleague avatar redirects in modules/chat.js cdn(). Fake OCE, no network. Run: node --test test/
const test=require('node:test'),assert=require('node:assert');
const {cdn}=require('../modules/chat.js');

const P='cccccccc-0000-0000-0000-000000000003';
const mk=(tok,avatar)=>({oce:{token:tok,get:async p=>{if(p==='/team-chat/rooms/')return [];if(p==='/team-chat/colleagues/')return [{id:P,full_name:'C Three',avatar_url:avatar}];throw new Error('unexpected '+p)}},me:{id:'aaaaaaaa-0000-0000-0000-000000000001',hexId:'aaaaaaaa0000000000000000',name:'A'},iso:x=>x||'',J:x=>x,T:{}});
const AV='av-cccccccc0000000000000000';

test('relative avatar_url with ?v= cache buster -> OCE path without query, no redirect',async()=>{
  const r=await cdn(mk('tokAvRel1','/api/v1/users/'+P+'/avatar?v=1763000000'),AV);
  assert.deepEqual(r,{redirect:null,oceAvatar:'/api/v1/users/'+P+'/avatar'});
});

test('relative avatar_url without query -> oceAvatar unchanged',async()=>{
  const r=await cdn(mk('tokAvRel2','/api/v1/users/'+P+'/avatar'),AV);
  assert.deepEqual(r,{redirect:null,oceAvatar:'/api/v1/users/'+P+'/avatar'});
});

test('absolute https avatar_url -> redirect, no oceAvatar proxy',async()=>{
  const u='https://files.example.com/a.webp?sig=x';
  const r=await cdn(mk('tokAvAbs',u),AV);
  assert.deepEqual(r,{redirect:u,oceAvatar:null});
});

test('null avatar_url -> no avatar route result (caller serves placeholder)',async()=>{
  const r=await cdn(mk('tokAvNull',null),AV);
  assert.equal(r,null);
});
