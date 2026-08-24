---
outline: deep
---

# Server Setup

<RoleBadge role="technician" />

This guide provides step-by-step instructions for deploying the **MSD700 Cloud Server and Web Dashboard**.

Complete [Prerequisites](/setup/prerequisites) before proceeding.

::: info Production-First Architecture
This guide defaults to a standard **Production Deployment**. Development mode instructions and advanced custom parameters are located in the [Advanced Configurations](#advanced-configurations) section at the bottom.
:::

## System Topology

```mermaid
flowchart TB
  NET["Public Internet"] -->|":443 HTTPS / WSS"| AP["Apache2 Reverse Proxy<br/>TLS Termination & Ingress Routing"]
  NET -->|":8883 MQTTS"| MQ["HiveMQ CE (:8883)<br/>Encrypted Fleet Broker"]
  NET -.->|":3478 UDP/TCP"| TURN["coturn (:3478)<br/>WebRTC TURN Relay"]

  subgraph DockerServices["Docker Compose Production Stack"]
    AP --> FE["frontend_prod (:3000)<br/>Next.js Web Dashboard"]
    AP --> BE["backend_node (:5000)<br/>REST API & Container Manager"]
    AP --> RB["rosbridge_suite (:9090)<br/>WebSocket Telemetry"]
    AP --> MED["media-server (:3003)<br/>Map & Binary Asset Store"]
    AP --> SIG["signalling_server (:3001)<br/>WebRTC Signalling"]
    BE --> DB[("MySQL Central DB (:3307)<br/>Database: ROS_DB")]
    SEC["/srv/msd/secrets<br/>JWT Keyring & TLS Keystore"]
    SEC -.-> BE
    SEC -.-> MQ
  end
```

## Directory Structure Overview

Before running any commands, understand how the repositories are structured on the host filesystem:

```
~/ (e.g. /home/ubuntu)
└── ros-web-ui/                               # Main Server Repository (branch: v2)
    ├── docker-compose.yml                    # Docker Compose Multi-Service Definition
    ├── .env                                  # Environment & Port Configuration
    ├── scripts/
    │   └── secrets.sh                        # JWT Keyring Management Utility
    └── source/
        └── dependencies/
            ├── ROS-dashboard-backend/        # Express REST API (backend_node)
            ├── ROS-dashboard-next-ts/        # Frontend Dashboard (CLONED HERE, branch: v2)
            ├── media-server/                 # Static Map Media Server
            ├── signalling_server/            # WebRTC Camera Signalling
            └── ssl_update/
                └── update_ssl.sh             # Certbot to HiveMQ Keystore Converter
```

---

## Core Step-by-Step Setup

Follow these 6 steps in sequence to stand up a complete production server.

### Step 1: Clone Repositories

Clone `ros-web-ui` on branch `v2`, then clone the `ROS-dashboard-next-ts` frontend repository directly into `source/dependencies/`:

```bash
# 1. Clone main server repository on branch v2
git clone -b v2 git@github.com:itbdelaboprogramming/ros-web-ui.git ~/ros-web-ui

# 2. Clone the frontend dashboard repository directly into dependencies on branch v2
git clone -b v2 git@github.com:itbdelaboprogramming/ROS-dashboard-next-ts.git \
  ~/ros-web-ui/source/dependencies/ROS-dashboard-next-ts
```

::: tip Why is the frontend cloned inside dependencies?
The Dockerfile builds the Next.js frontend directly within the Docker build context of `ros-web-ui`. The `source/dependencies/ROS-dashboard-next-ts` path is gitignored by the parent repository.
:::

---

### Step 2: Initialize Security Secrets

Secrets live outside Docker containers in `/srv/msd/secrets/` to persist across image rebuilds.

```bash
# 1. Navigate to the ros-web-ui repository
cd ~/ros-web-ui

# 2. Initialize the production JWT Keyring
sudo mkdir -p /srv/msd/secrets
./scripts/secrets.sh init

# 3. Verify that the keyring was created
./scripts/secrets.sh status
```

---

### Step 3: Generate HiveMQ TLS Keystore

The HiveMQ MQTT broker requires a PKCS#12 keystore generated from your domain's Let's Encrypt SSL certificate.

```bash
# 1. Obtain Let's Encrypt certificate for your server domain
sudo certbot certonly --standalone -d msd.nglobal.jp

# 2. Run the automated keystore generator script in ros-web-ui
cd ~/ros-web-ui
sudo ./source/dependencies/ssl_update/update_ssl.sh
```

This script creates `/srv/msd/secrets/hivemq/keystore.p12` with UID `1001` ownership and `0600` permissions.

---

### Step 4: Configure Environment (`.env`)

Create `.env` at `~/ros-web-ui/.env`:

```bash
cd ~/ros-web-ui
nano .env
```

Paste the following production configuration:

```ini
# Storage path for recorded map files on the host
MAPS_FOLDER=/home/ubuntu/ros_maps

# Host User and Docker Group IDs (run: id -u, id -g, getent group docker | cut -d: -f3)
USER_UID=1001
USER_GID=1001
DOCKER_GID=998

# Idle timeout before stopping inactive unit containers (1800000 ms = 30 min)
UNIT_IDLE_TIMEOUT_MS=1800000

# Central Database Credentials
MYSQL_ROOT_PASSWORD=SetYourStrongRootPasswordHere
MYSQL_DATABASE=ROS_DB
MYSQL_USER=itbdelabo
MYSQL_PASSWORD=SetYourStrongUserPasswordHere

# MQTT Broker Settings
MQTT_BROKER_TYPE=nakayama
NAKAYAMA_HOST=msd.nglobal.jp
HIVEMQ_KEYSTORE=/srv/msd/secrets/hivemq/keystore.p12
HIVEMQ_UID=1001

# Production Port Map
MYSQL_PORT_PROD=3307
BACKEND_PORT_PROD=5000
MEDIA_SERVER_PORT_PROD=3003
SIGNALLING_PORT_WS_PROD=3001
SIGNALLING_PORT_HTTP_PROD=3002
HIVE_MQTT_TLS_PORT_PROD=8883
FRONTEND_PORT_PROD=3000

# WebRTC TURN Relay (coturn)
TURN_LISTENING_IP=192.168.100.14
TURN_EXTERNAL_IP=118.22.31.252/192.168.100.14
TURN_USER=msd700
TURN_PASSWORD=SetYourStrongTurnPasswordHere
```

---

### Step 5: Start Production Docker Containers

Launch the production compose stack:

```bash
cd ~/ros-web-ui

# Start production containers in detached mode
docker compose --profile server_prod up -d

# Verify all containers are Up or Healthy
docker compose --profile server_prod ps
```

---

### Step 6: Configure Apache Reverse Proxy

Apache terminates SSL on port 443 and routes incoming traffic to internal container ports.

```bash
# 1. Enable required Apache modules
sudo a2enmod ssl proxy proxy_http proxy_wstunnel headers rewrite alias
sudo systemctl restart apache2
```

Edit `/etc/apache2/sites-available/000-default-le-ssl.conf`:

```apache
<IfModule mod_ssl.c>
<VirtualHost *:443>
    ServerName msd.nglobal.jp
    ServerAdmin webmaster@localhost
    DocumentRoot /var/www/html

    ErrorLog ${APACHE_LOG_DIR}/error.log
    CustomLog ${APACHE_LOG_DIR}/access.log combined

    ProxyAddHeaders On

    # 1. WebRTC Signalling Server (WebSocket)
    ProxyPass /services/signalling ws://localhost:3001
    ProxyPassReverse /services/signalling ws://localhost:3001

    # 2. Media Server (Map files and images)
    ProxyPass /services/media http://localhost:3003
    ProxyPassReverse /services/media http://localhost:3003

    # 3. Express REST API Backend
    ProxyPass /services/rosbackend http://localhost:5000
    ProxyPassReverse /services/rosbackend http://localhost:5000

    # 4. rosbridge WebSocket Server
    <Location /services/rosbridge>
        ProxyPass ws://localhost:9090 timeout=86400 keepalive=On flushpackets=on
        ProxyPassReverse ws://localhost:9090
        RequestHeader set Host "localhost:9090"
    </Location>

    # 5. Documentation Site Static Files
    ProxyPass /itbdelabo/docs !
    Alias /itbdelabo/docs /home/itbdelabo/ITBdeLabo/Documentation/msd700_documentation/docs/.vitepress/dist

    <Directory /home/itbdelabo/ITBdeLabo/Documentation/msd700_documentation/docs/.vitepress/dist>
        Options -Indexes -MultiViews +FollowSymLinks
        AllowOverride None
        Require all granted
        DirectoryIndex index.html

        RewriteEngine On
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteCond %{REQUEST_FILENAME}.html -f
        RewriteRule ^ %{REQUEST_FILENAME}.html [L]

        ErrorDocument 404 /itbdelabo/docs/404.html
    </Directory>

    # 6. Web Dashboard Frontend (Catch-All, MUST BE LAST)
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/

    # SSL Certificate Paths
    SSLCertificateFile /etc/letsencrypt/live/msd.nglobal.jp/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/msd.nglobal.jp/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>
</IfModule>
```

Reload Apache:

```bash
sudo apache2ctl configtest
sudo systemctl reload apache2
```

---

## Unit Registration & Enrolment Flow

Once the server is running, physical robots can be registered:

```mermaid
sequenceDiagram
  autonumber
  participant Tech as Field Technician
  participant Unit as Robot Unit (Jetson)
  participant Server as Cloud Backend
  participant Admin as Admin Web Portal

  Tech->>Unit: Run enrollment script on Jetson
  Unit->>Server: POST /enroll/claim (sends nonce_hash & serial)
  Server-->>Unit: HTTP 202 (Returns Claim Code, e.g. "K7M2QP")
  Unit-->>Tech: Displays Claim Code "K7M2QP" on screen

  Tech->>Admin: Open https://msd.nglobal.jp/admin and login
  Tech->>Admin: Navigate to "Pending Units" and match "K7M2QP"
  Tech->>Admin: Assign Unit Name and Rental Profile -> Click "Approve"

  Server->>Server: Update status to "approved" in database
  Unit->>Server: POST /enroll/status (presents plaintext nonce)
  Server-->>Unit: HTTP 200 (Hands over Unit ULID & Device Secret)
  Unit->>Unit: Saves Certificates/robot/device.json and connects to HiveMQ
```

1. Log into the administration panel at `https://msd.nglobal.jp/admin`.
2. Under **Pending Units**, locate the 6-character claim code displayed by the technician on the robot.
3. Select an active **Rental Profile**, assign a unit display label, and click **Approve**.
4. The robot completes enrolment and appears in the fleet dashboard immediately.

---

## Advanced Configurations

<details>
<summary><b>Development Mode Profile (`server_dev`)</b></summary>

To run an isolated development stack alongside production:

1. Initialize dev keyring:
   ```bash
   cd ~/ros-web-ui
   ./scripts/secrets.sh init --dev
   ```

2. Start the dev profile:
   ```bash
   docker compose --profile server_dev up -d
   ```

3. Dev ports are offset to prevent collisions:
   - Dev MySQL: `3308`
   - Dev Backend: `5001`
   - Dev HiveMQ: `8884`
   - Dev rosbridge: `9091`
   - Dev Frontend: `3100`

</details>

<details>
<summary><b>Keyring Rotation & Grace Periods</b></summary>

Rotate the active JWT signing key without terminating active user sessions:

```bash
cd ~/ros-web-ui

# Rotate active key (old key remains valid for 48 hours)
./scripts/secrets.sh rotate --grace-hours 48

# Check status of keys in keyring
./scripts/secrets.sh status

# Remove expired keys after grace window
./scripts/secrets.sh prune
```

</details>

<details>
<summary><b>Manual HiveMQ Keystore Creation</b></summary>

If generating the keystore manually without `update_ssl.sh`:

```bash
sudo mkdir -p /srv/msd/secrets/hivemq
sudo openssl pkcs12 -export \
  -in   /etc/letsencrypt/live/msd.nglobal.jp/fullchain.pem \
  -inkey /etc/letsencrypt/live/msd.nglobal.jp/privkey.pem \
  -out  /srv/msd/secrets/hivemq/keystore.p12 \
  -name hivemq \
  -passout "pass:SetKeystorePasswordHere"

sudo chown -R 1001:1001 /srv/msd/secrets/hivemq
sudo chmod 700 /srv/msd/secrets/hivemq
sudo chmod 600 /srv/msd/secrets/hivemq/keystore.p12
```

</details>

---

## Verification & Health Checks

Run these diagnostic commands to confirm all server subsystems are operational:

```bash
# 1. Confirm all Docker containers are running
docker compose --profile server_prod ps

# 2. Test Apache HTTPS ingress
curl -sI https://msd.nglobal.jp/ | head -n 1

# 3. Test Backend API health endpoint
curl -s https://msd.nglobal.jp/services/rosbackend/

# 4. Check MQTT broker listening socket
sudo ss -lptn 'sport = :8883'
```

## Related Documentation

- [Unit Setup](/setup/unit-setup): Configure the physical Jetson SBC.
- [System Setup](/setup/system-setup): End-to-end integration and calibration.
- [Docker Reference](/setup/docker-reference): Container options and lifecycle details.
