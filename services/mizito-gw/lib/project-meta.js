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
// hasFile: gateway cover file exists for p.id (lib/cover-store). Served by modules/cover at BASE + /cdn/cover/<id>.
function coverFields(p,hasFile){const u=(p&&p.picture_url)||null;if(!u&&hasFile&&p&&p.id)return {cover_has_photo:true,cover_file:(process.env.MIZITO_BASE_PATH||'/_rs')+'/cdn/cover/'+p.id,cover_variant:'photo_large'};return {cover_has_photo:!!u,cover_file:u,cover_variant:u?'photo_large':null}}
// Client photo object for a project with a gateway cover file. Same shape as the user avatar photo (modules/chat mizUser).
// content_key cv-<projectId> is served by server.js /cdn/cv-<id> (owner-checked, lib/cover-store dir).
function coverPhoto(p,hasFile){if(!hasFile||!p||!p.id)return null;const t='cv-'+String(p.id);const ph={content:t,size:-1,w:256,h:256,content_key:t};return {_id:String(p.id).replace(/-/g,''),name:'c.jpg',photo_medium:ph,photo_large:Object.assign({},ph)}}
// cv-<projectId> content key (optional dl/ prefix) -> project id; null otherwise.
function coverKeyId(k){const m=/^(?:dl\/)?cv-([0-9a-f-]{32,36})$/.exec(String(k||''));return m?m[1]:null}
module.exports={groupLabel,groupsOf,coverFields,coverPhoto,coverKeyId,groupTitle,COLORS};
