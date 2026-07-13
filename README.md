# Sistem Parkir Manless Berbasis Web

Aplikasi Sistem Parkir Manless berbasis web ini mendukung alur masuk kendaraan secara otomatis (manless) serta alur keluar kendaraan yang dioperasikan secara manual oleh petugas (POS kasir pintu keluar). Sistem ini dilengkapi dengan **Hardware Simulator** terintegrasi di dalam halaman web agar dapat langsung diuji tanpa perangkat keras fisik.

## Teknologi Utama
- **Backend**: NestJS, TypeScript, Socket.IO, TypeORM, SQLite (fallback database lokal).
- **Frontend**: React, TypeScript, Vite, Tailwind CSS v4, Recharts, Lucide Icons.

---

## Langkah Menjalankan Aplikasi

### 1. Instal Dependensi (Backend & Frontend)
Buka terminal/command prompt di folder root ini dan jalankan:
```bash
npm run install-all
```

### 2. Jalankan Server Dev
Jalankan perintah berikut di folder root:
```bash
npm run dev
```

Server backend dan frontend akan berjalan secara simultan:
- **Web Dashboard & Simulator**: [http://localhost:5173](http://localhost:5173)
- **Backend API & WebSockets**: [http://localhost:3000](http://localhost:3000)

---

## Akun Demo
Gunakan kredensial berikut untuk masuk ke dashboard:

- **Administrator (Hak Akses Penuh)**:
  - Username: `admin`
  - Password: `admin123`

- **Operator (Hak Akses Terbatas)**:
  - Username: `operator`
  - Password: `operator123`

*(Tersedia tombol pintas pre-fill pada form login untuk memudahkan pengujian).*

---

## Panduan Alur Pengujian

1. **Login**: Masuk sebagai `admin`.
2. **Masuk Kendaraan Harian**:
   - Buka tab **Sensor Simulator** -> Pilih **Gate Masuk 1**.
   - Klik **Mobil Datang (Loop)** -> Masukkan plat nomor -> Klik **Tekan Tombol Karcis**.
   - Tiket tercetak di layar dan palang gerbang akan terbuka secara visual.
   - Klik **Mobil Lewat (Loop)** untuk mensimulasikan mobil masuk & menutup gerbang.
3. **Lihat Dashboard**: Buka tab **Dashboard Live** untuk melihat statistik okupansi dan logs sensor ter-update real-time.
4. **Keluar Kendaraan (Layanan POS Loket Kasir)**:
   - Buka tab **Loket Kasir Keluar** di menu sidebar.
   - Pilih gerbang keluar (misal: Gate Keluar 1).
   - Pilih karcis kendaraan terparkir dari dropdown (simulasi scan karcis fisik oleh barcode scanner).
   - Klik **Scan & Cek Karcis**.
   - Pada input **Plat Nomor**, isi atau koreksi nomor plat kendaraan secara manual (jika ANPR tidak mendeteksinya).
   - Pilih metode bayar (**Tunai** atau **QRIS**):
     - **Tunai**: Input nominal uang yang diterima, sistem menghitung kembalian.
     - **QRIS**: Menampilkan visual QR code QRIS.
   - Klik **Selesaikan Pembayaran & Buka Pintu Keluar**.
   - **Hasil**: Struk bukti bayar tercetak di monitor petugas, palang gerbang terbuka secara visual.
   - Buka kembali tab **Sensor Simulator**, lalu klik **Mobil Lewat (Loop)** untuk mensimulasikan kendaraan meninggalkan gerbang (menurunkan palang).
5. **Karcis Hilang**:
   - Buka tab **Loket Kasir Keluar** di menu sidebar, lalu pilih sub-tab **Karcis Hilang (Denda)**.
   - Cari atau pilih plat nomor kendaraan yang kehilangan tiket -> Klik **Cari**.
   - Masukkan nomor NIK KTP dan nomor seri STNK pengendara untuk otorisasi berkas.
   - Selesaikan pembayaran denda kehilangan karcis (Tarif normal + Denda Rp 50.000) via QRIS atau Cash.
   - Klik **Selesaikan Pembayaran & Buka Pintu Keluar**.
6. **Laporan & Analytics**:
   - Buka menu **Statistik Laporan** untuk melihat grafik volume lalu lintas, metode pembayaran, serta mengekspor data transaksi ke file Excel/CSV.
