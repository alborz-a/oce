// Offline test: synthetic Mizito-import tasks hidden by default (MIZITO_HIDE_SYNTHETIC_TASKS), flag '0' disables; counts/progress from the filtered list.
// Run: NODE_PATH=<repo>/frontend/node_modules node --test test/*.test.js
const test=require('node:test'),assert=require('node:assert');
const {SOURCES,TITLE,enabled,isSynthetic,filterSynthetic,progressCounts}=require('../lib/synthetic');

const T=(over)=>Object.assign({id:'x',title:'وظیفه',status:'open',metadata:{}},over);
const sample=()=>[
  T({id:'n1',title:'native',status:'completed'}),
  T({id:'a1',metadata:{source:'mizito-album'}}),
  T({id:'a2',metadata:{source:'mizito-album-pilot'},status:'completed'}),
  T({id:'e1',title:TITLE,metadata:{source:'mizito-export'}}),
  T({id:'m1',title:'real',metadata:{source:'mizito-export'},status:'completed'}),
  T({id:'z1',title:'zz-e2e-1114-P1',metadata:{}}),
];
const withFlag=(v,fn)=>{const old=process.env.MIZITO_HIDE_SYNTHETIC_TASKS;if(v===undefined)delete process.env.MIZITO_HIDE_SYNTHETIC_TASKS;else process.env.MIZITO_HIDE_SYNTHETIC_TASKS=v;try{return fn()}finally{if(old===undefined)delete process.env.MIZITO_HIDE_SYNTHETIC_TASKS;else process.env.MIZITO_HIDE_SYNTHETIC_TASKS=old}};

test('flag default on when unset',()=>withFlag(undefined,()=>{assert.equal(enabled(),true);assert.equal(isSynthetic(sample()[1]),true)}));
test('flag 1 on',()=>withFlag('1',()=>assert.equal(isSynthetic(sample()[1]),true)));
test('flag 0 disables: nothing hidden',()=>withFlag('0',()=>{assert.equal(enabled(),false);assert.equal(filterSynthetic(sample()).length,6);assert.equal(isSynthetic(sample()[3]),false)}));
test('filter by metadata.source album and album-pilot',()=>withFlag(undefined,()=>{
  assert.equal(isSynthetic(sample()[1]),true);assert.equal(isSynthetic(sample()[2]),true);
  assert.equal(isSynthetic(sample()[4]),false,'mizito-export with real title kept');
}));
test('filter by exact title «گفتگوی پروژه» regardless of source',()=>withFlag(undefined,()=>{
  assert.equal(isSynthetic(sample()[3]),true);
  assert.equal(isSynthetic(T({title:TITLE+' ',metadata:{}})),false,'not exact title kept');
}));
test('native and zz- test rows are kept (zz- not in rule)',()=>withFlag(undefined,()=>{
  const ids=filterSynthetic(sample()).map(t=>t.id);
  assert.deepEqual(ids,['n1','m1','z1']);
}));
test('null-safe',()=>withFlag(undefined,()=>{assert.equal(isSynthetic(null),false);assert.equal(isSynthetic(T({metadata:null})),false)}));
test('SOURCES constant is the approved pair',()=>assert.deepEqual([...SOURCES].sort(),['mizito-album','mizito-album-pilot']));
test('progress/counts from filtered list match Mizito formula',()=>withFlag(undefined,()=>{
  // filtered list: n1 (done), m1 (done), z1 (open) -> total 3, completed 2, progress 66.7
  assert.deepEqual(progressCounts(sample()),{n:3,c:2,p:66.7});
}));
test('flag 0 counts include synthetic rows',()=>withFlag('0',()=>{
  assert.deepEqual(progressCounts(sample()),{n:6,c:3,p:50});
}));
test('empty list -> zeros',()=>withFlag(undefined,()=>assert.deepEqual(progressCounts([]),{n:0,c:0,p:0})));

test('OCE-only test tasks are hidden (flag MIZITO_HIDE_TEST_TASKS)',()=>{
  const S=require('../lib/synthetic');
  const ts=[{title:'آزمون دسترسی — مهمت'},{title:'TEST-PARITY وظیفه آزمایشی'},{title:'TEST-DELETE-ME gw آراد'},{title:'وظیفه واقعی'}];
  assert.deepEqual(S.filterSynthetic(ts).map(t=>t.title),['وظیفه واقعی']);
  process.env.MIZITO_HIDE_TEST_TASKS='0';assert.equal(S.filterSynthetic(ts).length,4);delete process.env.MIZITO_HIDE_TEST_TASKS;
});
