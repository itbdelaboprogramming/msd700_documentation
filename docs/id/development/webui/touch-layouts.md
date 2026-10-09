---
outline: deep
search: false
---

# ROS Web UI: Tata Letak Ponsel & Tablet

<RoleBadge role="developer" />

Halaman operator (login dan daftar unit, Navigasi, Pemetaan, Database, signup) punya dua komposisi
sentuh selain komposisi desktop: tata letak ponsel (hanya portrait) dan tata letak tablet (kedua
orientasi). Keduanya memakai ulang state halaman, komponen peta, koneksi robot, dan dialog milik
desktop; yang berbeda hanya susunannya, jadi tidak ada yang berubah di jalur komunikasi. Konsol
admin tetap khusus desktop. Rendering desktop tidak berubah oleh pekerjaan sentuh ini dan sudah
dibandingkan piksel demi piksel dengan build sebelumnya. Untuk sudut pandang operator, lihat
[Ponsel & Tablet](/id/user-guide/phones-and-tablets).

## Memilih tata letak {#detection}

`DeviceGuard` (`src/components/device-guard/deviceGuard.tsx`) adalah satu-satunya tempat yang
memutuskan jenis perangkat, dari ciri perangkat, bukan ukuran jendela:

| Pemeriksaan | Hasil |
| --- | --- |
| `detectDesktop()`: `userAgentData.mobile`, user agent ponsel atau tablet, iPadOS (platform Mac dengan lebih dari satu titik sentuh), `pointer: coarse` bersama `hover: none`, atau layar yang sisi panjangnya di bawah 1024 px | Bukan desktop: tata letak sentuh |
| `detectPhone()`, hanya ditanyakan untuk non-desktop: sisi pendek layar di bawah 600 px CSS (`PHONE_MAX_SHORT_EDGE`) | Ponsel; selain itu tablet |
| Rute diawali `/admin` di non-desktop | Pemberitahuan khusus desktop, aplikasi di-unmount |
| Desktop dengan jendela di bawah `MIN_APP_WIDTH` x `MIN_APP_HEIGHT` (1400 x 720, bisa diganti lewat `NEXT_PUBLIC_MIN_APP_WIDTH/HEIGHT`) | Overlay "Screen size not supported", aplikasi tetap ter-mount |

Laptop layar sentuh melaporkan pointer halus dan hover dari trackpad-nya, jadi tetap memakai tata
letak desktop dan mendapat input sentuh lewat [gestur peta](/id/development/webui/navigation/overview#map-input).

Keputusan ini sampai ke komponen lewat dua context di `src/hooks/useMobileLayout.ts`:

- `useMobileLayout()`: true di ponsel **dan** tablet. Setiap kontrol yang berubah untuk sentuh
  (tombol bulat, joystick, kartu sebagai pengganti tooltip hover, Mode List terlipat) membaca ini.
- `useTabletLayout()`: true hanya di tablet. Dibaca oleh beberapa tempat yang menyusun halaman
  (`MobileShell`, halaman login, lebar header).

Keduanya adalah ciri perangkat, bukan ukuran jendela, sehingga satu sesi tidak pernah berganti
komposisi di tengah jalan dan me-remount peta atau stream kamera. `MobileLayoutProvider` di
`_app.tsx` memberikan jawaban yang sama untuk yang di-render di luar `DeviceGuard` (badge status
unit global).

Sebelum pengukuran pertama, `DeviceGuard` hanya me-render latar halaman. Dulu aplikasi langsung
di-render, tetapi komposisinya belum diketahui sebelum mengukur, dan me-render komposisi yang salah
lebih dulu akan me-mount koneksi robot, peta, dan kamera dua kali. Server dan frame klien pertama
sama-sama me-render latar, jadi hidrasi tetap cocok.

Ponsel yang dipegang landscape tetap me-mount aplikasi di bawah panel "Turn your phone upright",
sama seperti overlay jendela kecil di desktop: memutar ponsel di tengah run tidak boleh memutus
sesi.

## Komposisi halaman {#composition}

Setiap halaman operator bercabang satu kali, `isMobile ? <MobileShell …> : <JSX desktop>`, dan
memberikan children yang sama ke keduanya. Komponen daun menerima prop `compact` atau membaca
`useMobileLayout()` sendiri.

`MobileShell` (`src/components/mobile/MobileShell.tsx`), tata letak ponsel dari atas ke bawah:

| Bagian | Isi |
| --- | --- |
| Header bar | Logo, pil sapaan (nama dan unit, dipotong agar muat 360 px), tombol tutup |
| Baris fitur | Pil halaman saat ini (membuka menu sheet), `RobotConnectionStatus compact` |
| Panel utama | `children`: peta, atau daftar peta di Database |
| Slot drive bar | `#mobile-drive-bar`, kosong kecuali Manual Override aktif |
| Baris kamera | Prop `camera` ditambah slot `#mobile-drive-pad` |
| Bilah bawah | Menu, Camera (Half / Full), `bottomActions` halaman, Instructions, hak cipta |
| Menu sheet | Pemilih halaman dan `menuExtra` (Robot Control di Navigasi dan Pemetaan) |

`RobotConnectionStatus` ter-mount di setiap halaman operasi, termasuk Database: komponen ini adalah
ping dan heartbeat robot serta pemilik dialog koneksi terputus dan takeover, bukan sekadar
indikator LiDAR.

Menu sheet dan kamera **disembunyikan, tidak pernah di-unmount**. Robot Control di dalam sheet
mempertahankan state dan langganan robotnya selama operator melihat peta, dan menyembunyikan kamera
tidak memutus stream WebRTC lalu memaksa negosiasi ulang pada setiap toggle.

`TabletShell` menyusun tata letak tablet dari bagian yang sama: tab halaman (`FeatureTabs`) sebagai
pengganti menu sheet, pil status di header, dan kolom samping berisi kamera dan `menuExtra`. Kolom
itu ada di kiri saat landscape dan di bawah peta saat portrait, diatur hanya dengan kelas Tailwind
`landscape:` dan `portrait:`, sehingga memutar perangkat tidak pernah me-remount apa pun.

### Bagian yang dipindah {#moved-parts}

Hal yang di desktop tampil di tempat tetap, tetapi tidak muat di ponsel, dipindah sebagai berikut:

| Desktop | Tata letak sentuh |
| --- | --- |
| Minimap ikhtisar di sudut kiri atas peta | Di-portal ke `#mobile-preview-slot` di `MobileCameraPanel`, di balik toggle Camera / Preview (Navigasi) |
| Pil status di header | `MobileMapFooter` di bawah E-stop (ponsel), header `TabletShell` (tablet) |
| E-stop di footer peta | `MobileMapFooter`, `EmergencyButton compact` |
| Pil reconnecting di atas peta | `MobileMapFooter`, menggantikan nama peta |
| Tombol zoom, fit, dan rotate | Kolom "⋮" di kiri atas peta, di balik tombol "−" yang melipat semua kontrol peta |
| Tombol samping mode (rute, coverage, Auto Align, Set Position as Home Base) | Lingkaran 44 px dengan keterangan (`MOBILE_SIDE_BTN`, `MOBILE_SIDE_CAPTION` di `navConstants.ts`) |
| Tooltip hover di tombol rute | Kartu `MobileModeGuide` `multi-pin`, sekali per sesi (`hasSeenMultiPinGuide`) |
| Gambar Coverage, Map Sync, dan hasil Auto Align (SVG landscape) | Kartu `MobileModeGuide` `coverage`, `map-sync`, `align-result` dengan teks asli |
| Gambar instruksi halaman | `mobile_instruction_{control,mapping,database}.svg` di `ControlInstruction` |
| Label info di atas action bar | Strip yang bisa ditutup di atas footer peta; penutupan hanya berlaku untuk teks itu |
| Kolom tambahan Database dan **Go to the Map** | Ketuk baris membuka sheet: pratinjau, pengubah terakhir, ukuran, Rename, Delete, Go to the Map |
| Pengurutan lewat header kolom Database | **Sort maps** di bilah bawah: kolom dan arah dalam satu ketukan |

Mode List awalnya terlipat di perangkat sentuh (`useMapState(!isMobile)`) agar tidak menutupi peta
sampai diminta. `src/utils/statusColor.ts` menyimpan warna pil status agar header desktop dan pil
sentuh tidak bisa berbeda.

### Portal dan urutan tumpukan {#portals}

Sebagian konten sengaja di-render di luar parent React-nya:

- `PreviewMap` di-portal ke slot preview di panel kamera.
- `ManualAutopilotPanel` mem-portal dialognya (overlay sinkronisasi, konfirmasi autopilot) ke
  `document.body` di perangkat sentuh: di ponsel sakelarnya juga ditekan dari drive bar saat menu
  sheet, ancestor yang `invisible`, sedang tertutup.
- Di ponsel, drive bar dan joystick di-portal ke dua slot shell, dicari lewat id setelah mount.

Modal memakai lebar seukuran ponsel dan berada di atas kontrol peta (menu sheet `z-[70]`, kartu mode
dan instruksi `z-[80]`, sheet Database dan menu dokumen di halaman login `z-[90]`).

### Kunci session storage {#storage}

| Kunci | Arti |
| --- | --- |
| `mobileCameraPanel` | `hidden` setelah operator menyembunyikan panel kamera |
| `mobileMenuHintSeen` | Penunjuk kunjungan pertama ke tombol Menu sudah ditutup |
| `hasSeenMultiPinGuide` | Kartu Multiple Pinpoints sudah tampil di sesi ini |

## Mengemudi manual di layar sentuh {#joystick}

Perangkat sentuh tidak punya keyboard, jadi `ManualAutopilotPanel` menambahkan `TouchJoystick`.
Komponen ini menulis simpangannya (`x` ke kanan, `y` ke depan, masing-masing -1..1, atau `null`
saat tidak disentuh) ke `stickRef`, yang dibaca lebih dulu oleh loop publish 10 Hz yang sama dengan
tombol W A S D:

```ts
publishTwist(stick.y * SPEED_NORMAL.linear, -stick.x * SPEED_NORMAL.angular); // right = -z
```

Kecepatannya analog dan dibatasi pada kecepatan normal keyboard (0,4 m/s, 1,0 rad/s); mendorong
kenop sebagian menggantikan Shift untuk mode lambat. Zona mati 0,12 di tengah mengirim nol.

Robot berhenti dengan cara yang sama seperti saat tombol dilepas. `stickRef` dikosongkan, dan tick
berikutnya mengirim twist nol, pada `pointerup`, `pointercancel` dan hilangnya pointer capture, saat
joystick di-unmount (Manual Override dimatikan, halaman ditinggalkan, pad disembunyikan saat
mengemudi), saat window blur, dan saat mode manual berakhir.

| Perangkat | Penempatan |
| --- | --- |
| Ponsel | `docked`: di `#mobile-drive-pad` di samping kamera. `PhoneDriveBar` di `#mobile-drive-bar` di atasnya mengulang sakelar Manual dan Autopilot serta titik rosbridge, sehingga operator bisa berhenti tanpa membuka menu. Jika baris kamera disembunyikan, baris itu tetap ada selama pad berada di dalamnya. |
| Tablet | `floating`: tetap di kanan bawah (di atas peta saat portrait), dengan pegangan yang menyelipkannya ke tepi kanan. Menyelipkan joystick melepas stick lebih dulu. |

**Kontrak:** joystick mem-publish
[`geometry_msgs/Twist` di `server/key_vel`](/id/development/message-contracts/rosbridge#publications)
yang sama dengan keyboard; toggle-nya tidak berubah ([`POST /api/manual`](/id/development/message-contracts/http-api#manual),
[`POST /api/autopilot`](/id/development/message-contracts/http-api#autopilot)). Lihat
[Override Manual & Autopilot](/id/development/webui/navigation/manual-and-autopilot).
