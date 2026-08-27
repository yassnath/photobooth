# PixieBooth

PixieBooth terdiri dari dua aplikasi frontend dengan satu backend:

- Kiosk photobooth: `/`
- Dashboard admin: `/admin`
- REST API, database, payment webhook, dan object storage: `server/`
- Printer/device agent lokal: `agent/`
- Launcher kiosk dan watchdog: `kiosk/`

Dashboard tidak lagi menjadi screen di dalam flow kiosk. Login admin memakai akun database dan session cookie HTTP-only.

## Prasyarat

- Node.js 22 atau lebih baru
- Chrome atau Edge untuk kiosk mode
- Windows untuk integrasi printer native yang disediakan
- HTTPS pada deployment publik agar kamera browser dan webhook pembayaran bekerja dengan aman

## Menjalankan Development

```powershell
npm install
# Jalankan ini hanya jika .env belum tersedia
Copy-Item .env.example .env
npm run dev
```

Alamat default:

- Kiosk: `http://localhost:5173`
- Dashboard: `http://localhost:5173/admin`
- API: `http://localhost:4174`
- Printer agent: `http://127.0.0.1:4175`

Ganti `ADMIN_BOOTSTRAP_PASSWORD` sebelum dipakai di luar mesin development. Akun bootstrap hanya dibuat ketika username tersebut belum ada di database.

## Supabase

Backend mendukung `sqlite` untuk development terisolasi dan `postgres` untuk Supabase. Konfigurasi project aktif berada di `.env`, yang sudah diabaikan Git.

Pada jaringan IPv4 gunakan **Session Pooler** port `5432` sebagai `DATABASE_URL`. Direct connection `db.<project-ref>.supabase.co:5432` memakai IPv6 dan lebih cocok untuk migration atau server yang mendukung IPv6.

Workflow CLI:

```powershell
npm run supabase:login
npm run supabase:link
npm run supabase:push
```

Login harus memakai akun Supabase yang memiliki akses ke project. Migration schema tersimpan di `supabase/migrations/`. Untuk mendorong migration tanpa project link:

```powershell
npx supabase db push --db-url $env:DATABASE_URL --dry-run
npx supabase db push --db-url $env:DATABASE_URL
```

Semua tabel operasional mengaktifkan RLS dan akses `anon`/`authenticated` dicabut. Hanya backend dengan koneksi PostgreSQL yang mengelola admin, voucher, payment, sesi, dan metadata media.

## Build Dan Pengujian

```powershell
npm run typecheck
npm run build
npm run test:api
npm run test:supabase
npm run test:responsive
```

`test:responsive` membutuhkan Google Chrome pada lokasi `CHROME_PATH` dan server yang sedang berjalan. Gunakan `PHOTOBOOTH_URL` bila alamatnya bukan `http://127.0.0.1:5173`.

## Pembayaran Dan Voucher

Untuk development, biarkan `PAYMENT_PROVIDER=mock`. Tombol simulasi pembayaran hanya muncul pada provider ini.

Untuk Midtrans Sandbox:

```dotenv
PAYMENT_PROVIDER=midtrans
MIDTRANS_SERVER_KEY=SB-Mid-server-...
MIDTRANS_CLIENT_KEY=SB-Mid-client-...
MIDTRANS_MERCHANT_ID=...
MIDTRANS_IS_PRODUCTION=false
PUBLIC_APP_URL=https://domain-photobooth.example
```

Atur Payment Notification URL di dashboard Midtrans ke:

```text
https://domain-photobooth.example/api/webhooks/midtrans
```

QR dibuat oleh backend untuk setiap order. Frontend hanya melanjutkan setelah status pembayaran tervalidasi. Webhook diverifikasi memakai signature Midtrans, sedangkan endpoint polling melakukan rekonsiliasi status ke Midtrans. Voucher divalidasi dan direservasi di transaksi database, termasuk kuota, waktu mulai, kedaluwarsa, dan nilai diskon.

## Penyimpanan Foto

Default `STORAGE_DRIVER=local` menyimpan object di `.photobooth-data/objects`. Metadata dapat tetap memakai PostgreSQL Supabase. Raw capture juga dicadangkan ke IndexedDB browser kiosk sebelum dikirim ke backend.

Untuk menyimpan file ke Supabase Storage, ambil service-role key dari project settings dan isi hanya pada backend:

```dotenv
STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=photobooth-media
```

Publishable key tidak dipakai untuk upload server karena tidak boleh melewati RLS. Bucket dibuat private dan file tetap diakses melalui public download token milik aplikasi.

Untuk S3 atau layanan kompatibel S3, isi:

```dotenv
STORAGE_DRIVER=s3
S3_ENDPOINT=https://s3.example.com
S3_REGION=ap-southeast-1
S3_BUCKET=photobooth
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
```

Public download menggunakan token acak, bukan path object langsung. `RESULT_RETENTION_HOURS` dan `RAW_PHOTO_RETENTION_HOURS` mengatur penghapusan otomatis metadata serta object foto.

## Printer Agent

Agent hanya mendengarkan di loopback dan menerima pekerjaan dari kiosk lokal.

```dotenv
PRINTER_MODE=windows
PRINTER_NAME=Nama Printer di Windows
BOOTH_AGENT_TOKEN=ganti-dengan-token-acak-yang-sama
```

Jalankan `npm run agent`. Gunakan `PRINTER_MODE=spool` untuk pengujian tanpa mencetak; file antrean akan disimpan sementara di `.photobooth-data/print-spool`.

## Kiosk, Watchdog, Dan Auto-start

Build aplikasi lalu jalankan launcher:

```powershell
npm run build
npm run kiosk
```

Launcher memastikan API dan agent aktif, membuka Chrome/Edge dalam app kiosk mode, dan membuka ulang browser ketika tertutup. Untuk mendaftarkan launcher ke Windows Startup:

```powershell
npm run kiosk:install
```

Hapus auto-start dengan `npm run kiosk:uninstall`. Snapshot sesi aktif disimpan di IndexedDB sehingga flow dapat dipulihkan setelah reload selama batas enam menit belum habis.

## Monitoring Dan Operasional

Agent mengirim heartbeat perangkat, status printer, panjang antrean, versi, uptime, dan screen kiosk ke backend. Informasi ini tersedia di tab **Booths** pada dashboard. Tab lain mengelola tema, filter, frame, voucher, dan seluruh sesi foto.

Untuk produksi, aktifkan backup Supabase, simpan `.env` di secret manager, pakai reverse proxy HTTPS, batasi akses dashboard, dan pantau log proses API serta agent. Putar ulang password database atau key apa pun yang pernah dibagikan melalui chat, lalu perbarui `.env` dan secret deployment.
