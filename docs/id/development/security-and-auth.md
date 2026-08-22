---
outline: deep
search: false
---
# Keamanan dan Otentikasi

<RoleBadge role="developer" />

Dokumen ini merinci model keamanan, mekanisme otentikasi kriptografi, isolasi domain kepercayaan, dan kebijakan kontrol akses yang diterapkan di seluruh platform robotika MSD700.

## Ikhtisar Arsitektur Keamanan

MSD700 menerapkan pertahanan mendalam di seluruh frontend web, backend cloud, perantara pesan, dan komputer papan tunggal (SBC) Jetson fisik.

```mermaid
flowchart TB
  subgraph Public["Public Internet Ingress"]
    HTTPS["HTTPS / WSS (:443)<br/>Apache TLS Termination"]
    MQTTS["MQTT TLS (:8883)<br/>HiveMQ CE Encrypted Ingress"]
  end

  subgraph CloudDomain["Cloud Server Trust Domain"]
    KEYRING["JWT Secret Keyring<br/>/srv/msd/secrets/jwt_keyring"]
    AUTH_MW["Express verifyToken Middleware"]
    ATTACH_MW["attachUnit Authorization Middleware"]
    MYSQL[("Central MySQL DB (:3307)<br/>Bcrypt Passwords")]
  end

  subgraph RobotDomain["Physical Robot Trust Domain (Jetson)"]
    DEV_SECRET["Device Secret (HMAC-SHA256)<br/>Certificates/robot/device.json"]
    ROBOT_TOKEN["Onboard Token Cache (12h TTL)<br/>Certificates/robot/token.cred"]
    LOCAL_KEYRING["Unit Local Keyring<br/>Isolated from Cloud Secrets"]
  end

  HTTPS --> AUTH_MW
  AUTH_MW --> ATTACH_MW
  ATTACH_MW --> MYSQL
  KEYRING -.-> AUTH_MW

  MQTTS <--> ROBOT_TOKEN
  DEV_SECRET --> ROBOT_TOKEN
  LOCAL_KEYRING -.->|"Local Auth Only"| RobotDomain
```

## Tiga Domain Perwalian Independen

Batasan keamanan dipisahkan menjadi tiga domain kepercayaan yang tidak dapat dipertukarkan:

| Kepercayaan Domain | Otoritas Penerbit | Tujuan Token | Titik Akhir Validasi | Aturan Isolasi |
| --- | --- | --- | --- | --- |
| **Domain Operator** | Backend Server Cloud (`backend_node`) | Mengautentikasi operator manusia yang mengakses dasbor web. | `verifyToken` di semua rute `/api/*` | Tidak dapat digunakan langsung oleh robot; ditolak pada rute `/local/*`. |
| **Robot Cloud Domain** | Layanan Pendaftaran Cloud (`/enroll/token`) | Mengautentikasi robot fisik yang terhubung ke HiveMQ dan server media cloud. | TLS HiveMQ + awan `media-server` | Dicakup secara ketat pada ULID yang ditetapkan robot; berlaku selama 12 jam. |
| **Satuan Domain Lokal** | Backend Lokal Terintegrasi (`backend_local`) | Mengautentikasi operator LAN lokal dan klien streaming video onboard. | `/local/*` titik akhir | Token cloud ditolak dengan tegas untuk memastikan kedaulatan offline lokal. |

## Pendaftaran Perangkat Keras Kriptografi (Protokol Nonce)

Robot yang belum terdaftar mendaftarkan dirinya ke server cloud melalui jabat tangan kriptografi tiga tahap.

```mermaid
sequenceDiagram
  autonumber
  participant Robot as Physical Robot (enroll.py)
  participant Backend as Cloud Server (/enroll)
  participant Admin as Admin Web Console

  Note over Robot: Stage 1: Registration Claim
  Robot->>Robot: Generate 32 cryptographically random bytes (nonce)<br/>Compute nonce_hash = sha256(nonce)<br/>Compute fingerprint = sha256(hardware_serial)
  Robot->>Backend: POST /enroll/claim { fingerprint, nonce_hash, hostname, mac }
  Backend->>Backend: Store in pending_units table (status: pending)
  Backend-->>Robot: HTTP 202 Accepted { claim_code: "K7M2QP" }
  Note over Robot: Displays 6-character claim code on screen

  Note over Admin: Stage 2: Administrator Authorization
  Admin->>Backend: Approve claim code "K7M2QP" for Unit ULID
  Backend->>Backend: Update pending_units (status: approved)

  Note over Robot: Stage 3: Secret Handover Verification
  loop Polling /enroll/status
    Robot->>Backend: POST /enroll/status { fingerprint, nonce }
  end
  Backend->>Backend: Validate sha256(nonce) == stored nonce_hash
  Backend->>Backend: Mint device_secret (random 64-byte token)
  Backend->>Backend: Store bcrypt(device_secret) in unit_devices table
  Backend-->>Robot: HTTP 200 OK { unit_id, device_secret, initial_token }
  Robot->>Robot: Write Certificates/robot/device.json (mode 0600)
```

### Mengapa Protokol Nonce 32-Byte Penting:
- **MAC / Perlindungan Spoofing Sidik Jari**: Alamat MAC perangkat keras dan nomor seri disiarkan di jaringan lokal dan terlihat di konsol admin. Tanpa rahasia, penyerang yang memalsukan alamat MAC dapat mengklaim kredensial saat robot fisik dimatikan.
- **Verifikasi Sekali Pakai**: Nonce teks biasa dikirimkan tepat satu kali melalui TLS selama penyerahan kredensial akhir. Setelah diverifikasi, server menghapus nonce yang tertunda.
- **Penyimpanan Rahasia Nol Mentah**: Basis data cloud hanya menyimpan hash `bcrypt` dari `device_secret`. Bahkan kebocoran database lengkap tidak membahayakan rahasia perangkat robot yang aktif.

## Gantungan Kunci JWT dan Rotasi Rahasia Tanpa Waktu Henti

Token autentikasi diverifikasi berdasarkan **JWT Keyring** yang disimpan di `/srv/msd/secrets/jwt_keyring`, bukan satu variabel lingkungan statis.

```json
{
  "active_kid": "key_2026_08_a",
  "keys": {
    "key_2026_08_a": {
      "secret": "9a8b7c6d5e4f3a2b1c0d...",
      "created_at": "2026-08-01T00:00:00Z"
    },
    "key_2026_07_b": {
      "secret": "1f2e3d4c5b6a7f8e9d0c...",
      "created_at": "2026-07-01T00:00:00Z"
    }
  }
}
```

### Aturan Rotasi Gantungan Kunci:
1. **Kunci Penandatanganan Aktif**: Semua token akses dan penyegaran yang baru dibuat ditandatangani dengan kunci yang diidentifikasi oleh `active_kid`.
2. **Verifikasi Grace Window**: Ketika token masuk tiba, `verifyToken` memeriksa tanda tangannya terhadap `active_kid`. Jika verifikasi gagal, verifikasi akan menguji kunci sebelumnya di gantungan kunci sebelum menolak dengan HTTP 401.
3. **Gangguan Sesi Nol**: Rotasi rahasia dalam produksi tidak memaksa semua operator aktif untuk login ulang secara bersamaan.

## Keamanan Sewa Operasi: Mencegah Pengambilalihan Multi-Operator

Untuk mencegah perintah yang bertentangan dari pengguna atau tab browser secara bersamaan, akses ke aktuasi motor diatur oleh **sewa pengoperasian eksklusif** yang disimpan dalam memori pada robot fisik.

```mermaid
flowchart LR
  OP1["Operator 1 (Active Session)"] -->|"Heartbeat Ping (claim: true)"| ROBOT["Robot Lease Manager<br/>(system_command.py)"]
  OP2["Operator 2 (Different User)"] -.->|"Rejected: In Use"| ROBOT
  OP1_TAB2["Operator 1 (Second Tab)"] -.->|"Origin Conflict (Prompt Takeover)"| ROBOT
```

- **Kedaluwarsa Detak Jantung**: Sewa berlaku selama 15 detik dan harus diperbarui melalui ping berkala.
- **Pemisahan Akun vs Sesi**:
  - `in_use`: Jika akun pengguna lain memegang sewa, eksekusi perintah diblokir.
  - `origin_conflict`: Jika akun pengguna yang sama membuka tab kedua atau beralih dari cloud ke jaringan lokal, UI akan meminta pengambilalihan secara eksplisit daripada mengganggu tab aktif secara diam-diam.

## Keamanan Jaringan dan Penghentian TLS

1. **Apache Reverse Proxy**: Semua lalu lintas HTTP, SSE, dan WebSocket eksternal menghentikan TLS di port Apache 443 menggunakan sertifikat dari Let's Encrypt (`/etc/letsencrypt/live/`).
2. **HiveMQ Mutual Transport Security**: Robot terhubung ke HiveMQ pada port 8883 melalui TLS. Sertifikat Keystore PKCS#12 berada di `/srv/msd/secrets/hivemq/keystore.p12`.
3. **Isolasi Kontainer**: Kontainer backend berkomunikasi melalui jaringan jembatan Docker internal (`ros_backend_net`), sehingga tidak mengekspos database internal atau port rosbridge langsung ke internet publik.

## Dokumentasi Terkait

- [Arsitektur](/id/development/architecture): Topologi platform lengkap dan domain kepercayaan.
- [Kontrak Pesan](/id/development/message-contracts): Definisi payload pendaftaran perangkat keras.
- [Referensi API](/id/development/api-reference): Otentikasi pengguna dan titik akhir penyegaran sesi.