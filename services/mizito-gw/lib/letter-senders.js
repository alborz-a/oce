// Display-only sender names for imported letters whose Mizito sender has no OCE account (read-only; no accounts created).
// Data: JSON {"<letter id hex24>": "<sender display name>"} at MIZITO_LETTER_SENDERS (not in git). Empty/missing file = feature off.
const fs=require('fs'),crypto=require('crypto');
const FILE=process.env.MIZITO_LETTER_SENDERS||'';
let map=null;
function load(){if(map)return map;map={};if(FILE){try{map=JSON.parse(fs.readFileSync(FILE,'utf8'))||{}}catch(e){console.log('letter-senders: unreadable',e.message)}}return map}
// stable 24-hex id per name; prefix 'dd' keeps it apart from OCE hex ids
const idOf=n=>'dd'+crypto.createHash('sha1').update(String(n)).digest('hex').slice(0,22);
const senderOf=h=>{const n=load()[h];return n?{id:idOf(n),name:n}:null};
const names=()=>[...new Set(Object.values(load()))];
module.exports={senderOf,idOf,names};
