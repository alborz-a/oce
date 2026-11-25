// Private-room gate (owner order 2026-11-25). Rooms listed in MIZITO_HIDE_PRIVATE_ROOM_IDS are invisible to callers whose OCE user role is not in MIZITO_PRIVATE_ROOM_ADMIN_ROLES: hidden from chat list, history, send, realtime push, project chat link, merged company history and /cdn ph-/dl- files.
// MIZITO_HIDE_PRIVATE_ROOM_IDS unset = default room; set to empty string = gate off.
const {hex}=require('./oce');
const DEFAULT_ROOM='c245187c-56c0-4d5e-9a0c-391cbd7f4a19';
const IDS=new Set(String(process.env.MIZITO_HIDE_PRIVATE_ROOM_IDS===undefined?DEFAULT_ROOM:process.env.MIZITO_HIDE_PRIVATE_ROOM_IDS).split(',').map(x=>hex(x.trim())).filter(Boolean));
// OCE user roles (backend config: admin|manager|editor|viewer). 'owner' is a project-member role, kept for parity with the spec.
const ADMIN=new Set(String(process.env.MIZITO_PRIVATE_ROOM_ADMIN_ROLES||'admin,owner').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean));
// no role known = not admin = hidden (fail closed)
const isAdmin=c=>{const r=c&&c.me&&c.me.role;return !!r&&ADMIN.has(String(r).toLowerCase())};
const hiddenId=(c,id)=>!!id&&IDS.size>0&&IDS.has(hex(id))&&!isAdmin(c);
const visibleRooms=(c,rooms)=>rooms.filter(r=>!hiddenId(c,r.id));
module.exports={hiddenId,visibleRooms,isAdmin,IDS,ADMIN};
