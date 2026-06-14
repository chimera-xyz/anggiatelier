# Anggi Atelier Live Commerce

Sistem live commerce untuk TikTok Live Studio dengan checkout website, order WhatsApp manual, stok per varian, pembayaran manual, fulfillment, dan notifikasi overlay realtime.

## Fitur utama

- Katalog produk lengkap: foto, deskripsi, harga, berat/dimensi, status aktif.
- Stok per SKU warna dan ukuran, termasuk reservasi 30 menit anti-overselling.
- Checkout website dengan token ongkir bertanda tangan.
- Order WhatsApp dari template chat dengan parser dan reservasi stok yang sama.
- Bukti pembayaran privat; admin mengonfirmasi atau menolak secara manual.
- Status fulfillment terpisah: belum diproses, dikemas, dikirim, selesai.
- Packing slip, nomor resi, export CSV, sesi live, dan audit log.
- Overlay TikTok Live Studio dengan stream key, heartbeat, acknowledgement, Supabase Broadcast, dan polling fallback.
- Mode demo localStorage untuk mencoba UI tanpa Supabase.

## Menjalankan lokal

```bash
npm install
cp .env.example .env.local
npm run dev
```

Buka `http://localhost:3000/admin`. Saat belum terhubung ke Supabase, PIN demo adalah `1234`.

## Menyiapkan Supabase

1. Buat project Supabase.
2. Buka SQL Editor dan jalankan seluruh isi `supabase/schema.sql`.
3. Isi `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.
4. Buat nilai acak panjang untuk `ADMIN_SESSION_SECRET`, `SHIPPING_QUOTE_SECRET`, `OVERLAY_STREAM_KEY`, dan `CRON_SECRET`.
5. Ganti `ADMIN_PIN`, rekening, WhatsApp admin, dan `NEXT_PUBLIC_SITE_URL`.

`SUPABASE_SERVICE_ROLE_KEY` hanya boleh berada di environment server. Jangan pernah memakai prefix `NEXT_PUBLIC_` untuk secret tersebut.

## Memasang overlay di TikTok Live Studio

1. Deploy aplikasi dan login ke `/admin`.
2. Buka menu **LIVE Control**.
3. Salin URL **Live Studio Browser Source** yang ditampilkan dashboard.
4. Di TikTok Live Studio, tambahkan Browser/Web Source dan paste URL tersebut.
5. Sesuaikan source menjadi format portrait `1080 × 1920`.
6. Dashboard akan berubah menjadi **Overlay Connected** setelah heartbeat diterima.
7. Gunakan tombol tes notifikasi sebelum live dimulai.

Notifikasi pembelian hanya muncul setelah admin menekan **Konfirmasi + tampilkan LIVE**. Tidak ada payment gateway dan tidak ada konfirmasi pembayaran otomatis.

## Deploy ke Vercel

Import folder ini sebagai project Vercel, lalu salin seluruh environment variable dari `.env.example` ke Project Settings. `vercel.json` menjalankan pelepasan reservasi setiap 5 menit. Jika paket Vercel yang digunakan membatasi frekuensi Cron, hapus blok `crons`; reservasi tetap dilepas saat ada order baru atau dashboard memuat antrean.

Setelah domain produksi diketahui, perbarui `NEXT_PUBLIC_SITE_URL` agar URL Browser Source menggunakan domain yang benar.

## Pemeriksaan sebelum live launching

```bash
npm run lint
npm run build
```

Lakukan satu simulasi lengkap: buat order website, upload bukti, konfirmasi admin, cek notifikasi overlay, packing, input resi, lalu selesaikan order. Ulangi satu kali melalui alur WhatsApp.
