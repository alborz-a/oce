// Pure helpers: OCE project -> Mizito group label and cover fields. No I/O.
// Group source: OCE project metadata.mizito_group (ProjectResponse.metadata). Cover source: OCE picture_url (presigned, may be null).
const crypto=require('crypto');
const COLORS=['blue','green','red','orange','purple','teal'];
const hash=t=>crypto.createHash('sha256').update('mizito-group:'+t).digest('hex');
const groupTitle=p=>{const g=p&&p.metadata&&p.metadata.mizito_group;return typeof g==='string'&&g.trim()?g.trim():null};
// Stable label: _id = 24 hex chars from title hash, so the same group title always yields the same id.
function groupLabel(p){const t=groupTitle(p);if(!t)return null;const h=hash(t);return {_id:h.slice(0,24),title:t,color:COLORS[parseInt(h.slice(24,32),16)%COLORS.length]}}
// Distinct groups across OCE projects, first-seen order.
function groupsOf(arr){const m=new Map();for(const p of arr){const g=groupLabel(p);if(g&&!m.has(g._id))m.set(g._id,g)}return [...m.values()]}
// Cover: picture_url is the only OCE picture field. Null url = no cover (client keeps art placeholder).
function coverFields(p){const u=(p&&p.picture_url)||null;return {cover_has_photo:!!u,cover_file:u,cover_variant:u?'photo_large':null}}
module.exports={groupLabel,groupsOf,coverFields,groupTitle,COLORS};
