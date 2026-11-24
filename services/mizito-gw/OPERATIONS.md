# mizito-gw operations (oce host)
- Code: /opt/mizito-gw/mizito-gw (tar upload from services/mizito-gw incl. node_modules and mirror/). Config: /etc/mizito-gw.env (not in git; template mizito-gw.env.example).
- Unit: /etc/systemd/system/mizito-gw.service (copy of mizito-gw.service). Runs as nobody, Restart=always.
- Start/stop/status: `systemctl start|stop|restart|status mizito-gw`; logs `journalctl -u mizito-gw -f`.
- Health: `curl http://127.0.0.1:18090/healthz`. nginx: /mizito/ and /socket.io/ locations (backup /opt/mizito-gw/oce-nginx.bak-20261124).
- Update: `alb ssh --host oce --upload gw.tgz /tmp/gw.tgz`; extract into /opt/mizito-gw; `systemctl restart mizito-gw`.
- Rollback: remove the two nginx locations, `systemctl disable --now mizito-gw`. Old /colleagues section is untouched.
