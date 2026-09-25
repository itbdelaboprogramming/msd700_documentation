---
outline: deep
search: false
---

# Referensi API

<RoleBadge role="developer" />

Dokumen ini adalah referensi REST API lengkap untuk `backend_node` (server API Express), merinci semua endpoint, mekanisme autentikasi, parameter permintaan, struktur respons, dan kode status HTTP.

Untuk payload MQTT yang dibungkus endpoint ini, lihat [Kontrak Pesan](/id/development/message-contracts). Untuk finite state machine, lihat [State and Behavior](/id/development/state-and-behavior). Untuk arsitektur sistem, lihat [Arsitektur](/id/development/architecture).

## Konvensi API

### Base URL

| Lingkungan | Base URL | Deskripsi Routing |
| --- | --- | --- |
| **Server Produksi** | `https://msd.nglobal.jp/services/rosbackend` | Di-reverse-proxy lewat Apache2 ke `localhost:5000` |
| **Server Pengembangan** | `http://<server-ip>:5001` | Akses HTTP langsung ke kontainer backend pengembangan |
| **Server Lokal Unit** | `http://<unit-ip>:5002` | Akses HTTP langsung ke `backend_local` onboard Jetson SBC |

### Autentikasi dan Otorisasi

Semua rute terproteksi membutuhkan header HTTP `Authorization` yang membawa sebuah JSON Web Token (JWT):

```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

Token ditandatangani secara kriptografis menggunakan HS256 dan divalidasi terhadap sebuah keyring bersama. Di dalam container file keyring adalah `/run/secrets/jwt_keyring` (di-mount dari `${SECRETS_DIR:-/srv/msd/secrets}/jwt_keyring.dev.json` pada service `*_dev`; produksi fallback ke env var `JWT_SECRET_KEY`/`JWT_SECRET`). Secret key aktif menandatangani token baru, sementara key yang baru saja dirotasi tetap valid selama periode grace transisi.

```mermaid
sequenceDiagram
  autonumber
  participant Client as Client Application
  participant Backend as backend_node
  participant DB as MySQL Database

  Client->>Backend: POST /user/login { username, password }
  Backend->>DB: Query user credentials & rental profiles
  DB-->>Backend: User record verified
  Backend-->>Client: 200 OK { success, msg, username, full_name, user_id, token, refresh_token }
  Note over Client: Include token in Bearer header on subsequent calls

  Client->>Backend: POST /api/navigation/pointstamped (Bearer token)
  Backend-->>Client: 401 Unauthorized (when token expires)

  Client->>Backend: POST /user/refresh { refresh_token }
  Backend-->>Client: 200 OK { token, refresh_token } (fresh token pair)
```

| Klaim Token `typ` | Lingkup & Penerimaan | Aturan Penolakan |
| --- | --- | --- |
| `access` (token operator standar) | Akses penuh ke operasi dan peta fleet robot yang ditugaskan. | Ditolak jika kedaluwarsa atau ditandatangani dengan secret tidak valid. |
| `refresh` | Hanya diterima secara eksklusif pada `/user/refresh`. | Ditolak oleh middleware API standar dengan HTTP 401. |
| `admin` | Diterima pada rute administratif (`/admin/api/*`). | Ditolak oleh rute operator robot standar karena kekurangan konteks pengguna. |

### Middleware Otorisasi Unit (`attachUnit`)

Setiap kali sebuah permintaan menuju robot spesifik, field `unit_id` di body permintaan (atau parameter query) diproses lewat middleware `attachUnit`:

```mermaid
flowchart TB
  REQ["HTTP Request + Bearer Token"] --> V_TOK["verifyToken<br/>JWT Keyring Validation"]
  V_TOK -->|Invalid or Expired| E_401["HTTP 401 Unauthorized"]
  V_TOK --> ATTACH["attachUnit Middleware"]
  ATTACH -->|No unit_id present| PASS["Pass to Handler"]
  ATTACH -->|Malformed ULID| E_400["HTTP 400 Invalid Unit ID"]
  ATTACH -->|User lacks Rental Profile for Unit| E_403["HTTP 403 Forbidden: Unit Not Assigned"]
  ATTACH -->|Valid & Authorized| EXEC["Execute Target Handler"]
```

## Amplop Respons Standar

### Respons Sukses
```json
{
  "success": true,
  "msg": "Command executed successfully.",
  "details": {
    "status": true,
    "message": "Goal published to move_base"
  }
}
```

### Respons Error
```json
{
  "success": false,
  "msg": "Robot rejected command: emergency stop active."
}
```

### Respons Array / List
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "ulid": "01JZ8QK2H0000000000000MAP",
      "display_name": "Main Warehouse Floor",
      "created_at": "2026-08-15T10:30:00Z"
    }
  ]
}
```

## Endpoint Autentikasi

### 1. Login Pengguna
`POST /user/login`

Mengautentikasi akun operator dan menerbitkan token akses/refresh.

- **Request Body**:
```json
{
  "username": "operator1",
  "password": "SecurePassword123"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Login user success",
  "username": "operator1",
  "full_name": "Operator One",
  "user_id": "01JZ7YV5CQUSER00000000000",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

Tidak ada `role` atau `profile_id` dalam response. Unit mana yang boleh disentuh ditentukan per request dari rental profile (lihat `attachUnit` di bawah), bukan dari payload login.
```

### 2. Refresh Token
`POST /user/refresh`

Menukar refresh token yang valid dengan pasangan token baru.

- **Request Body**:
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIs..."
}
```

## Manajemen Unit dan Operasi Fleet

### 1. Daftar Unit yang Dapat Diakses
`GET /unit/all`

Mengembalikan semua robot terdaftar yang ditugaskan ke rental profile aktif pengguna terautentikasi. (Tidak ada `GET /api/units`; status live seperti baterai berasal dari heartbeat ping, bukan daftar ini.)

- **Headers**: `Authorization: Bearer <token>`
- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "01JZ8P9WZ0UNIT00000000000",
      "unit_name": "Unit 01",
      "topic_root": "/unit_01JZ8P9WZ0UNIT00000000000",
      "profile_name": "Nakayama",
      "created_at": "2026-08-10T14:20:00Z"
    }
  ]
}
```

### 2. Ping Heartbeat Robot
`POST /api/hardware/ping`

Mengirim heartbeat liveness ke robot lewat MQTT (round-trip) dan menjaga operating lease pemanggil. Field `page` menentukan apa yang dijaga ping: daftar unit hanya membaca status, sedangkan halaman operasi menahan tier watchdog idle/shutdown.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "session_id": "8b1c3f2a-605d-4871-bc01-e28a9b3d1f04",
  "claim": true,
  "release": false,
  "page": "navigation",
  "force_takeover": false
}
```

Terkait tapi berbeda: `POST /api/unit/heartbeat` adalah keepalive container yang dipakai container relay per-unit. Ia tidak menerima field lease dan hanya mengembalikan `{ "success": true }`.

### 3. Emergency Stop / Pause
`POST /api/emergency_stop`

Mengalihkan emergency stop hardware atau pause pergerakan. Boolean dipetakan ke perintah robot: `true` mengirim `activate`, `false` mengirim `deactivate` lewat topik `system_command`/`system_feedback` yang sama seperti semuanya.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "enable": true
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Emergency stop state updated."
}
```

## Navigasi dan Dispatch Misi

### 1. Inisialisasi Mode Navigasi
`POST /api/navigation/init`

Meluncurkan stack navigasi pada robot dengan sebuah peta yang ditentukan.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "map_id": "01JZ8QK2H0000000000000MAP"
}
```

Peta tersebut harus salah satu yang direkam oleh unit ini, di dalam sebuah rental yang diikuti oleh pemanggil. Sebuah peta yang terlihat oleh pemanggil tetapi milik robot yang **berbeda** ditolak di sini dengan `404` dan
`"That map does not belong to this unit"`. Sebelum 2026-09-10 ini diteruskan begitu saja: robot kemudian mencoba mengambil file peta yang tidak pernah diunggahnya, navigasi tidak pernah menyala, dan kegagalannya hanya muncul di log unit sementara dashboard sudah menampilkan permulaan yang berhasil.

### 2. Kirim Goal Waypoint
`POST /api/navigation/pointstamped`

Mengirim satu koordinat tujuan target ke stack navigasi robot.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "X": 5.25,
  "Y": -3.10,
  "Z": 0.0
}
```

### 3. Mulai Coverage Area Boustrophedon
`POST /api/boustrophedon/init`

Meluncurkan coverage sweep boustrophedon otonom di atas batas poligon yang ditentukan.

- **Headers**: `Authorization: Bearer <token>`
- **Request Body**:
```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "areas": [
    [
      { "x": 0.0, "y": 0.0 },
      { "x": 12.0, "y": 0.0 },
      { "x": 12.0, "y": 6.0 },
      { "x": 0.0, "y": 6.0 }
    ]
  ],
  "exclusions": [
    [
      { "x": 4.0, "y": 2.0 },
      { "x": 6.0, "y": 2.0 },
      { "x": 6.0, "y": 4.0 },
      { "x": 4.0, "y": 4.0 }
    ]
  ]
}
```

## Operasi Mapping (SLAM)

### 1. Kontrol Mapping
`POST /api/mapping`

Satu endpoint mengendalikan seluruh sesi mapping. Tepat satu dari `start`, `pause`, `stop` bernilai true per panggilan. Stop menyimpan occupancy grid aktif, menghasilkan metadata thumbnail, dan mengunggah aset; field nama yang disimpan adalah `map_name`, bukan `display_map_name`.

- **Request Body** (contoh stop + simpan):
```json
{
  "unit_id": "01JZ8P9WZ0UNIT00000000000",
  "stop": true,
  "map_name": "Warehouse Sector 4",
  "homebase_x": 0.0,
  "homebase_y": 0.0,
  "homebase_z": 0.0,
  "homebase_ox": 0.0,
  "homebase_oy": 0.0,
  "homebase_oz": 0.0,
  "homebase_ow": 1.0
}
```

### 2. Buang Sesi Mapping
`POST /api/mapping/discard`

Membatalkan sesi aktif tanpa menyimpan.

- **Request Body**: `{ "unit_id": "01JZ8P9WZ0UNIT00000000000" }`

### 3. Progres Simpan Mapping (SSE)
`GET /api/mapping/progress/:request_id?token=<jwt>`

Stream Server-Sent Events untuk penyimpanan yang dipicu stop. JWT ditaruh di query string karena `EventSource` tidak bisa menyetel header.

## Manajemen Data Peta dan Rute

### 1. Daftar Peta
`GET /api/maps_data?unit_id=<unit ULID>`

`unit_id` opsional di wire dan wajib secara praktis untuk apa pun yang dilihat seorang operator. Tanpa itu, respons berisi setiap peta dalam lingkup rental pemanggil, yang merupakan apa yang diinginkan tampilan arsip dan admin. Dengan itu, daftarnya dipersempit menjadi peta yang direkam robot tersebut, yang merupakan apa yang dibutuhkan halaman Database: sebuah rental bisa memegang beberapa robot, dan peta yang direkam oleh sibling tidak bisa dinavigasi pada robot ini. Meneruskan sebuah unit yang tidak dimiliki pemanggil lewat rental aktif adalah sebuah `403`, bukan daftar kosong. `GET /api/maps/:mapId` menerima parameter yang sama dan menerapkan lingkup yang sama.

- **Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "01JZ8QK2H0000000000000MAP",
      "map_name": "Warehouse Ground Floor",
      "unit_id": "01JZ7K3M9QA0B1C2D3E4F5G6H7",
      "unit_name": "unit1",
      "created_by_username": "operator1",
      "modified_by_username": "operator1",
      "created_at": "2026-08-10T14:20:00Z",
      "modified_at": "2026-08-10T14:20:00Z",
      "homebase_x": 0.0,
      "homebase_y": 0.0
    }
  ]
}
```

::: warning Nama peta hanya unik per (unit, rental)
Dua robot pada satu rental masing-masing bisa memiliki peta bernama `hazard test`, dan keduanya adalah peta berbeda dengan ULID berbeda. Jangan mendeduplikasi sebuah daftar peta berdasarkan nama: membuang entri kedua membuang sebuah peta nyata dan menyimpan milik robot tetangga, dan membuka nama tersebut kemudian me-resolve ke sebuah ULID yang tidak bisa dimuat robot itu. Deduplikasi berdasarkan `id`, dan batasi lingkup berdasarkan `unit_id`.
:::

### 2. Simpan Rute Waypoint Kustom
`POST /api/routes`

- **Request Body**:
```json
{
  "profile_id": 4,
  "map_id": "01JZ8QK2H0000000000000MAP",
  "route_name": "Inspection Loop Alpha",
  "route_type": "round-trip",
  "waypoints": [
    { "x": 1.0, "y": 2.0, "yaw": 0.0 },
    { "x": 5.0, "y": 2.0, "yaw": 1.57 }
  ]
}
```

## Sistem Auto Align

`POST /api/autoalign/start`

Memulai validasi konvergensi particle filter dan penyelarasan orientasi otomatis terhadap geometri referensi.

- **Request Body**: `{ "unit_id": "01JZ8P9WZ0UNIT00000000000" }`
- **Response (200 OK)**:
```json
{
  "success": true,
  "msg": "Auto align algorithm initiated."
}
```

## Dokumentasi Terkait

- [Kontrak Pesan](/id/development/message-contracts): Format serialisasi topik MQTT dan ROS.
- [State and Behavior](/id/development/state-and-behavior): State machine terperinci dan transisi kegagalan.
- [Skema Database](/id/development/database-schema): Tabel MySQL dan model relasi entitas.
