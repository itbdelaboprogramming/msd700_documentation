---
outline: deep
search: false
---

# Admin Console: System Health

<RoleBadge role="developer" />

The System Health tab (`SystemHealthPanel.tsx`) shows whether the server side of the system is
working: the services behind the dashboard, the ports they answer on, and the two SSL certificates
that keep browsers and robots connected. Every admin sees it; it only reads. The checks run in
`backend_node` (`scripts/system_health.js`) behind
[`GET /admin/api/system/health`](/development/message-contracts/http-api#admin-api), and the panel
asks for them every 30 seconds while it is open.

Each item carries a status (**Working**, **Needs attention**, **Not working**, **Not used**), one
plain sentence on what it means for operators, a note on what to do when action is needed, and a
**Details** list with the technical facts (ports, versions, errors, fingerprints).

## What is checked, and how {#checks}

| Item | Check | Not working means |
| --- | --- | --- |
| Database | `SELECT VERSION()` through the backend's own pool, 3 s timeout; slower than 1 s is a warning | Operators cannot sign in, the console cannot save |
| Backend API | Always working (it is answering); uptime, Node.js version, memory | |
| MQTT broker | The backend's own broker connection: connected or not, since when, last drop, last error | Robots receive no commands and report nothing |
| Live link | The [gateway](/development/message-contracts/rosbridge#gateway)'s `health()` plus a TCP connect to `LINK_GATEWAY_PORT`; "Not used" when that variable is unset | No live map or robot position |
| Web UI | HTTP GET of `WEBUI_URL`; any answer below 500 is up | Operators cannot open the dashboard |
| Public website | HTTP GET of `PUBLIC_SITE_URL` (the site through Apache); skipped when empty | Not reachable from the internet |
| Media server | HTTP GET of `/health` on `MEDIA_PORT` | Maps cannot be opened or saved |
| Camera signalling | TCP connect to `PORT_WS`, HTTP GET on `PORT_HTTP` | The robot camera cannot be opened |
| Website certificate | TLS handshake to `CERT_HOST` (default `NAKAYAMA_HOST`) on 443 | Browsers refuse the site |
| MQTT broker certificate | The certificate on the backend's live broker socket | Robots refuse the broker |

A **Connections and ports** table lists every port above with how it was decided ("Test query",
"Backend connection", "Connection test", "Web request", "Secure connection") and its response time.

::: warning Two probes are deliberately avoided
- **No TCP probe on MySQL.** MySQL counts a connection that closes before the handshake as an error
  for that host and blocks the host after `max_connect_errors` of them. The backend reaches MySQL
  through Docker's port proxy, so the blocked host would be the backend itself. The database is
  only ever checked with a real query.
- **No probe on the HiveMQ port.** A connection that closes before an MQTT `CONNECT` is logged by
  HiveMQ as `Client ID: UNKNOWN ... disconnected ungracefully`, the same reason the compose
  healthcheck probes port 8080 instead (see
  [Docker Reference § Healthchecks](/setup/docker-reference#healthchecks)). Reachability comes from
  the backend's own connection, and the certificate from that connection's TLS socket. Only when
  the connection is down is one handshake made to read the certificate (it may be the cause), cached
  for 10 minutes.
:::

## Certificates {#certificates}

Both certificates are read as the servers present them, not from `/etc/letsencrypt`, so an expired
or mismatched one is still described instead of refused.

| Days left | Status | Why |
| --- | --- | --- |
| 30 or more | Working | Shows when it was last renewed and when certbot renews it next (expiry minus 30 days) |
| 7 to 29 | Needs attention | certbot renews 30 days before expiry, so the renewal did not happen |
| under 7, expired, or not trusted | Not working | Clients refuse it, or will within days |

The tab also compares the two. When the broker presents a different certificate that expires at
least a day before the website's, the broker item turns **Needs attention** with "the broker
keystore was not rebuilt". This is the silent failure from
[Maintenance § Certificates](/setup/maintenance#certificates): certbot renews the PEM files Apache
reads, HiveMQ keeps serving its own PKCS#12 keystore, and the robots are cut off on the old expiry
date while the website still looks fine. The fix the panel names is `update_ssl.sh`, then a broker
restart when no robot is working.

## Configuration {#configuration}

Read by `backend_node` from its environment. The defaults are production's, so only
`nakayama_cloud_dev` sets them in `docker-compose.yml`.

| Variable | Default | Dev |
| --- | --- | --- |
| `WEBUI_URL` | `http://127.0.0.1:3000/` | `http://127.0.0.1:3100/` |
| `PUBLIC_SITE_URL` | `https://<NAKAYAMA_HOST>/` | empty (skipped): the public site is production's frontend behind the host's Apache, and production is down while dev runs |
| `MEDIA_PORT` | `3003` | `4003` |
| `CERT_HOST` | `NAKAYAMA_HOST` | not set |

`PORT_WS`, `PORT_HTTP`, `LINK_GATEWAY_PORT`, `PORT` and `PORT_SQL` are the ones the stack already sets.

## Load on the server {#load}

One snapshot is cached for 15 seconds and shared by every admin with the tab open; concurrent
requests share one run. **Check now** asks for a fresh run, but never more often than every
5 seconds. Every check has a 3 second timeout and they run in parallel, so a snapshot takes at most
about 3 seconds.

## Related

- [Message Contracts: HTTP API § Admin API](/development/message-contracts/http-api#admin-api): `GET /admin/api/system/health` (`?refresh=1` for a fresh run).
- [Overview](/development/webui/admin-console/overview): the console shell and its tabs.
- [Units § Unit Status](/development/webui/admin-console/units#unit-status): the per-robot live status, which this tab does not repeat.
- [Maintenance § Certificates](/setup/maintenance#certificates): how to renew and rebuild the broker keystore.
- [Docker Reference § Service and port map](/setup/docker-reference#service-and-port-map): the ports listed in this tab.
