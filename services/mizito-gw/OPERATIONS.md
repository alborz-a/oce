# mizito-gw operations (oce host)
- Code: /opt/mizito-gw/mizito-gw (tar upload from services/mizito-gw incl. node_modules and mirror/). Config: /etc/mizito-gw.env (not in git; template mizito-gw.env.example).
- Unit: /etc/systemd/system/mizito-gw.service (copy of mizito-gw.service). Runs as nobody, Restart=always.
- Start/stop/status: `systemctl start|stop|restart|status mizito-gw`; logs `journalctl -u mizito-gw -f`.
- Health: `curl http://127.0.0.1:18090/healthz`. nginx: /mizito/ and /socket.io/ locations (backup /opt/mizito-gw/oce-nginx.bak-20261124).
- Update: `alb ssh --host oce --upload gw.tgz /tmp/gw.tgz`; extract into /opt/mizito-gw; `systemctl restart mizito-gw`.
- Rollback: remove the two nginx locations, `systemctl disable --now mizito-gw`. Old /colleagues section is untouched.
- Covers: /opt/mizito-gw/covers/<oce_project_id>.<jpg|jpeg|png|webp> (root-owned, 644, outside code dir; env MIZITO_COVER_DIR). Served at /_rs/cdn/cover/<id>. Interim until OCE GET picture route (RSD-1.4).

- Synthetic task filter: env MIZITO_HIDE_SYNTHETIC_TASKS (default on; 0 disables, then restart). Rule in lib/synthetic.js. OCE data is not changed. Rollback = set 0 in /etc/mizito-gw.env and restart mizito-gw.
- Private room gate (2026-11-25): env MIZITO_HIDE_PRIVATE_ROOM_IDS (comma list of room ids; unset = c245187c-56c0-4d5e-9a0c-391cbd7f4a19; empty = off) and MIZITO_PRIVATE_ROOM_ADMIN_ROLES (default admin,owner; OCE user roles are admin|manager|editor|viewer). Rule in lib/private-rooms.js; hooks in modules/chat.js (roomOf, getDialogs, messages merge, hiddenDoc), modules/projects.js, modules/realtime.js, server.js (dialog-keyed route -> 404, /cdn ph-/dl- -> 404). Non-admin company-room merge skips the general room. OCE data is not changed. Rollback = set MIZITO_HIDE_PRIVATE_ROOM_IDS= (empty) in /etc/mizito-gw.env and restart mizito-gw, or restore the backup dir /opt/mizito-gw/mizito-gw.bak-20261125-privroom.
