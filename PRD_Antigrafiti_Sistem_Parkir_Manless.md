# PRD - Sistem Parkir Manless Berbasis Web

## 1. Product Vision
Membangun sistem parkir manless (tanpa petugas) berbasis web yang mendukung kendaraan harian dan member bulanan, terintegrasi dengan barrier gate, loop detector, RFID, ANPR, CCTV, dan printer thermal.

---

## 2. Tujuan Proyek
- Mengotomatisasi proses masuk dan keluar kendaraan.
- Mengurangi kebutuhan operator di gate.
- Meningkatkan keamanan melalui ANPR dan dokumentasi foto.
- Mendukung pembayaran tunai dan non-tunai.
- Menyediakan monitoring dan laporan secara realtime.
- Mendukung operasi 24/7 pada jaringan lokal (on-premise).

---

## 3. Teknologi

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS

### Backend
- NestJS
- TypeScript
- Socket.IO
- MQTT

### Database
- PostgreSQL (On-Premise)
- Redis

### ANPR Service
- Python
- YOLOv8
- PaddleOCR
- OpenCV

### Deployment
- Ubuntu Server
- Docker Compose
- Nginx

---

## 4. Arsitektur Sistem

```text
ESP32 Gate Controller
        │
        ├── Loop Detector
        ├── RFID Reader
        ├── Tombol Karcis
        └── Barrier Gate
                │
                ▼
        Local Network (LAN)
                │
                ▼
     NestJS API + PostgreSQL + Redis
                │
        ┌───────┼────────┐
        │       │        │
        ▼       ▼        ▼
     ANPR     Printer   Dashboard
     Service   LAN       React
```

---

## 5. Aktor Sistem

1. Pengunjung Harian
2. Member Bulanan
3. Operator
4. Supervisor
5. Administrator

---

## 6. Modul Sistem

- Dashboard Monitoring
- Kendaraan Masuk
- Kendaraan Keluar
- Pembayaran
- Member Bulanan
- Tarif Parkir
- Karcis Hilang
- Laporan
- User Management
- Audit Log
- Konfigurasi Gate

---

## 7. Hardware

### Gate Masuk
- ESP32 Ethernet
- Loop Detector kendaraan datang
- Loop Detector setelah barrier
- RFID Reader
- Tombol Karcis
- Barrier Gate
- IP Camera Masuk
- Printer Tiket LAN

### Gate Keluar
- ESP32 Ethernet
- Loop Detector setelah barrier
- Barrier Gate
- IP Camera Keluar
- Printer Struk LAN

---

## 8. Alur Kendaraan Masuk (Karcis)

1. Loop detector mendeteksi kendaraan.
2. Sistem menunggu tombol karcis.
3. CCTV melakukan capture.
4. ANPR membaca plat nomor.
5. Sistem menyimpan data.
6. Printer mencetak tiket.
7. Barrier terbuka.
8. Loop setelah barrier menutup barrier.

### Acceptance Criteria
- Tiket tercetak maksimal 2 detik.
- Foto dan plat nomor tersimpan.
- Barrier terbuka maksimal 1 detik setelah tiket tercetak.

---

## 9. Alur Kendaraan Masuk (Member)

1. Kendaraan terdeteksi.
2. Pengguna tap kartu RFID.
3. Sistem validasi member.
4. Capture CCTV dan ANPR.
5. Data disimpan.
6. Barrier terbuka.
7. Barrier tertutup setelah kendaraan lewat.

### Acceptance Criteria
- Kartu tidak aktif ditolak.
- Semua transaksi member tercatat.

---

## 10. Alur Kendaraan Keluar

1. Scan karcis atau tap RFID.
2. Sistem verifikasi.
3. Sistem menghitung tarif.
4. Pembayaran dilakukan.
5. Printer mencetak struk.
6. Barrier terbuka.
7. Barrier tertutup setelah kendaraan lewat.

### Acceptance Criteria
- Perhitungan tarif akurat.
- Struk tercetak.
- Transaksi tersimpan.

---

## 11. Karcis Hilang

1. Operator memilih menu Karcis Hilang.
2. Verifikasi STNK.
3. Verifikasi identitas.
4. Input biaya denda.
5. Approval.
6. Barrier terbuka.

### Acceptance Criteria
- Seluruh proses tercatat di audit log.
- Dokumen verifikasi tersimpan.

---

## 12. Kebutuhan Fungsional

### FR-001
Menerima event dari loop detector.

### FR-002
Mendukung tiket parkir.

### FR-003
Mendukung member bulanan RFID.

### FR-004
Capture CCTV.

### FR-005
Deteksi plat nomor.

### FR-006
Cetak tiket dan struk.

### FR-007
Pembayaran tunai dan non-tunai.

### FR-008
Laporan dan dashboard.

### FR-009
Audit log.

### FR-010
Multi-gate.

---

## 13. Kebutuhan Non-Fungsional

- Operasional 24/7.
- Respon gate < 1 detik.
- Mendukung mode offline sementara.
- Backup database otomatis.
- Mendukung multi-user.
- Seluruh komunikasi menggunakan LAN.

---

## 14. Database Utama

- parking_entries
- parking_exits
- payments
- members
- member_vehicles
- lost_tickets
- users
- audit_logs
- gate_events

---

## 15. Integrasi Perangkat

### ESP32
- MQTT
- WebSocket
- REST API

### CCTV
- RTSP

### Printer
- ESC/POS melalui LAN

---

## 16. Roadmap

### Phase 1
Infrastruktur server dan database.

### Phase 2
Integrasi ESP32 dan barrier.

### Phase 3
Modul tiket dan member.

### Phase 4
ANPR dan CCTV.

### Phase 5
Pembayaran dan laporan.

### Phase 6
UAT dan Go Live.

---

## 17. Deliverables

- Web Dashboard
- API Backend
- Database PostgreSQL
- ANPR Service
- Gate Controller Firmware
- Dokumentasi API
- Dokumentasi Deployment
- SOP Operasional
