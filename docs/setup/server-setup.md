# Server Setup

<RoleBadge role="technician" />

How to install and configure the **MSD700 Server**, the cloud/dashboard half of the system.
Complete [Prerequisites](/setup/prerequisites) first.

::: info Why start with the Server?
A Unit can run fully offline once it has enrolled, but it can't enrol *for the first time* without
somewhere to enrol against. Standing up the Server first means [Unit Setup](/setup/unit-setup) has
something to talk to on the first try, instead of failing at the very last step.
:::

## Overview

Every server-side piece (the web dashboard, the backend API, the MQTT broker robots connect
through, the database, and the media/video-signalling servers) is a Docker container, all defined
in one `docker-compose.yml` inside the `ros-web-ui` repository. You bring the whole set up with one
command per environment (`server_prod` or `server_dev`); nothing is installed directly on the host
except Docker and Apache.

## 1. Clone and place the repo

```bash
git clone https://github.com/itbdelaboprogramming/ros-web-ui.git
cd ros-web-ui
```

## 2. Create the secrets the containers expect

Two things live *outside* the Docker image on purpose: the JWT signing keyring and the HiveMQ TLS
keystore. Both are read from a fixed host path, `/srv/msd/secrets` by default.

```bash
# JWT signing keyring: used by the backend, media server and signalling server to
# verify login tokens.
./scripts/secrets.sh init            # production keyring
./scripts/secrets.sh init --dev      # dev keyring, if you're also running server_dev
```

::: info Why a file instead of an environment variable?
Two reasons. First, the Docker build copies the whole `source/` tree into the image, so anything
in an `.env` file *inside* that tree would get baked into the image itself: changing a secret
would mean rebuilding. A file mounted in at container start avoids that entirely. Second, this is a
**keyring**, not a single secret: rotating it demotes the old key to "still accepted for a grace
window" instead of invalidating every logged-in session and every connected robot at once. Run
`./scripts/secrets.sh status` any time to see what's active without printing the secret values
themselves.
:::

For the MQTT broker's TLS certificate, export your domain's Let's Encrypt certificate as a PKCS#12
keystore at `/srv/msd/secrets/hivemq/keystore.p12` (both the prod and dev brokers read the same
file; only the published port differs). If you're joining an existing deployment, ask whoever
manages the certificate renewal; don't generate a second one that config.xml doesn't expect.

## 3. Configure `.env`

Create a `.env` file at the repository root (next to `docker-compose.yml`). There's no committed
template: these are the keys the compose file actually reads, with the defaults it falls back to
if you omit one:

| Key | Purpose | Typical default |
| --- | --- | --- |
| `MAPS_FOLDER` | Host path where saved maps live; must match on both the container and the Unit side | `/home/ubuntu/ros_maps` |
| `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_ROOT_PASSWORD` | Database credentials | (required) |
| `MYSQL_PORT_PROD` / `MYSQL_PORT_DEV` | Host-side DB port, kept apart so both profiles can run side by side | `3307` / `3308` |
| `BACKEND_PORT_PROD` / `BACKEND_PORT_DEV` | Backend API port | `5000` / `5001` |
| `MEDIA_SERVER_PORT_PROD` / `MEDIA_SERVER_PORT_DEV` | Media (map image) server port | `3003` / `4003` |
| `SIGNALLING_PORT_WS_PROD` / `SIGNALLING_PORT_WS_DEV` | WebRTC signalling port | `3001` / `4001` |
| `ROSBRIDGE_PORT_DEV` | Dev rosbridge port (prod is fixed at `9090`) | `9091` |
| `FRONTEND_PORT_PROD` / `FRONTEND_PORT_DEV` | Dashboard web server port | `3000` / `3100` |
| `HIVE_MQTT_TLS_PORT_PROD` / `HIVE_MQTT_TLS_PORT_DEV` | MQTT broker TLS port robots connect to | `8883` / `8884` |
| `HIVEMQ_KEYSTORE` | Path to the keystore from step 2 | `/srv/msd/secrets/hivemq/keystore.p12` |
| `NAKAYAMA_HOST` | Public hostname robots and the dashboard dial for MQTT | your domain, e.g. `msd.nglobal.jp` |
| `SERVER_PUBLIC_IP` | Public IP used when building the *dev* dashboard (prod uses HTTPS URLs behind Apache, not a raw IP) | - |
| `USER_UID` / `USER_GID` | Ownership of files the containers write on the host | `1001` |
| `DOCKER_GID` | Host's `docker` group id, so the backend can manage per-unit containers | `998` |
| `UNIT_IDLE_TIMEOUT_MS` | How long an idle unit's container stays up before it's stopped automatically | `1800000` (30 min) |
| `TURN_LISTENING_IP`, `TURN_EXTERNAL_IP`, `TURN_USER`, `TURN_PASSWORD` | Required only if you run the `coturn` relay for WebRTC video | - |

::: warning
`MAPS_FOLDER` has to be the same value the *Unit* uses too. A mismatch here is the classic "map
saving silently breaks" bug: the backend writes to a path that only exists inside its own container.
:::

## 4. Start the services

Pick one profile. `server_dev` is the safer first run: it uses a separate database, ports, and
MQTT broker, so a mistake here can't touch anything real:

```bash
docker compose --profile server_dev up -d
# once you've verified it works:
docker compose --profile server_prod up -d
```

::: info What actually starts
A one-shot permissions fixer runs first (creates and `chown`s the maps/media/backup directories so
the app containers, which run as an unprivileged user, can write to them); you don't run this by
hand, it's a dependency the other services wait on. Then: MySQL, the HiveMQ broker, the backend +
rosbridge, the media server, the signalling server, and the Next.js dashboard, all in one `up`.
:::

## 5. Put Apache in front of it

Apache terminates HTTPS and reverse-proxies each service to a clean public path, so the dashboard's
browser code never has to know raw ports. A starting point is in
`scripts/apache-snippet.conf`... but if you're setting up fresh, prefer copying the block that's
*actually running* for the docs site's own vhost as your reference for `ProxyPass`/`ProxyPassReverse`
syntax, since it also covers the WebSocket-specific quirks (rosbridge needs an explicit `Host`
header rewrite, or the handshake fails with "missing port in HTTP Host header").

At minimum, proxy:

| Public path | Backend |
| --- | --- |
| `/services/rosbackend` | `http://localhost:<BACKEND_PORT_PROD>` |
| `/services/rosbridge` | `ws://localhost:9090` (needs the `Host` header fix, see above) |
| `/services/media` | `http://localhost:<MEDIA_SERVER_PORT_PROD>` |
| `/services/signalling` | `ws://localhost:<SIGNALLING_PORT_WS_PROD>` |
| `/` (catch-all, must come last) | `http://localhost:<FRONTEND_PORT_PROD>` |

## 6. Verify

```bash
docker compose ps                       # everything should show "healthy" or "Up"
docker compose logs -f nakayama_cloud    # backend log; watch for "Connection lost" (DB race) or MQTT errors
```

Then open your domain in a browser: you should reach the login page. A successful login with no
units listed is expected at this point; a unit only appears once one has enrolled (see
[Unit Setup](/setup/unit-setup)) and your account has been granted access to it.

## Next step

Continue to [Unit Setup](/setup/unit-setup), then [System Setup](/setup/system-setup) to connect them together.

If something goes wrong, see [Troubleshooting](/setup/troubleshooting).
