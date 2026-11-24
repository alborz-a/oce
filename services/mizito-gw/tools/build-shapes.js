// Dev tool (not run at deploy): extract ONE template per Mizito endpoint from a HAR index and scrub free text.
// usage: node tools/build-shapes.js <har-index.json>  -> shapes/templates.json
const fs=require('fs'),path=require('path');
const I=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const KEEP=/^[0-9a-f]{24}$|^\d{4}-\d\d-\d\dT[\d:.]+Z$|^[a-z_]{1,24}$|^[a-z0-9]+\d?(\.\d+)*-?\d*$/;
function scrub(v){if(typeof v==='string')return KEEP.test(v)?v:'';if(Array.isArray(v))return v.slice(0,1).map(scrub);
  if(v&&typeof v==='object'){const o={};for(const k of Object.keys(v))o[k]=scrub(v[k]);return o}return v}
const pick=(k,f)=>{const l=I[k];if(!l)throw new Error('missing '+k);const h=f?l.find(f):l[0];return JSON.parse(h.body)};
const out={
 userId:scrub(pick('POST /api/workspace/userId')),
 user:scrub(pick('POST /api/workspace/getUsers').users[1]||pick('POST /api/workspace/getUsers').users[0]),
 project:scrub(pick('POST /api/projects/getList').projects[0]),
 summary:scrub(pick('POST /api/projects/allSummary')),
 letter:scrub(pick('POST /api/inbox/getInbox')[0]),
 task:scrub(pick('POST /api/tasks/upcoming',x=>x.req.includes('calendar_repeated'))[0])

};
// userId carries the client_version string; keep it verbatim (cache_id gate).
out.userId.client_version=JSON.parse(I['POST /api/workspace/userId'][0].body).client_version;
fs.writeFileSync(path.join(__dirname,'..','shapes','templates.json'),JSON.stringify(out));
console.log('ok',Object.keys(out).join(','));
