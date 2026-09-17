# SmartFarm IoT — Web Mobile Terhubung Hardware

Website mobile-first untuk monitoring & kontrol SmartFarm (kandang ayam pintar), dibangun dengan HTML, CSS, dan JavaScript murni (tanpa framework/build tool). Desain asli (8 layar Figma) dipertahankan sepenuhnya — yang ditambahkan adalah **lapisan koneksi hardware, sensor, dan logika otomasi** sehingga alurnya benar-benar meniru sistem SmartFarm nyata:

```
WEB MOBILE  <──>  CONTROLLER / HARDWARE (ESP32)  <──>  SENSOR & PERANGKAT
```

## Cara menjalankan
Karena antar-halaman saling terhubung via link relatif dan menggunakan `localStorage`, buka melalui server lokal (jangan double-click file langsung):

```bash
cd smartfarm
python3 -m http.server 8080
```
Lalu buka `http://localhost:8080/index.html` di browser (resize ke lebar HP untuk melihat tampilan mobile, atau buka langsung dari HP di jaringan yang sama).

## Struktur halaman
| File | Halaman |
|---|---|
| `index.html` | Beranda / Dashboard — status hardware, kontrol utama, ringkasan |
| `hubungkan-esp32.html` | Penaut ESP32 — alamat endpoint, status, dan log WebSocket |
| `monitoring.html` | Monitoring realtime — hardware, sensor, stok, jadwal, aktivitas |
| `riwayat.html` | Riwayat aktivitas (filter Semua/Pakan/Lampu/**Sistem**) |
| `pakan-otomatis.html` | Detail & kontrol pakan otomatis |
| `jadwal-pakan.html` | Atur jadwal pemberian pakan |
| `lampu-otomatis.html` | Detail & kontrol lampu otomatis + sensor cahaya |
| `jadwal-lampu.html` | Atur jadwal, kecerahan & mode Otomatis/Manual lampu |
| `isi-ulang-pakan.html` | Isi ulang stok pakan |

## Arsitektur (dipisah sesuai lapisan, siap dihubungkan ke hardware asli)

```
js/shared.js      → DATABASE   : state tunggal (jadwal, stok, status, riwayat) di localStorage
js/hardware.js    → HARDWARE   : satu-satunya file yang "bicara" dgn controller/sensor/aktuator (HAL)
js/automation.js  → LOGIC      : aturan otomatisasi (cek koneksi → baca sensor → putuskan aksi → simpan)
js/*.js (per halaman) → UI     : render tampilan & interaksi pengguna, tidak pernah mengasumsikan hardware
css/hardware.css  → komponen UI status hardware (dipakai bersama di beberapa halaman)
```

Kontrak antar lapisan sengaja dibuat sederhana supaya mudah dikembangkan:
- **UI → Logic/Hardware**: memanggil `HW.xxx()` (mis. tombol manual) atau `window.triggerFeeding()`, tidak pernah menulis status "berhasil" sendiri.
- **Logic/Hardware → UI**: hanya lewat event `sf-tick` (setiap ~1 detik) dan `hw-status-changed`/`hw-connecting` (instan saat koneksi berubah). Setiap halaman cukup `document.addEventListener('sf-tick', e => render(e.detail))`.
- **Tidak pernah ada status palsu**: `HW.runFeeder()` dan `HW.setLamp()` hanya melapor sukses jika `hardwareConnected === true`; kalau tidak, UI menampilkan peringatan "Hubungkan hardware terlebih dahulu…" — sesuai permintaan, sistem tidak berpura-pura menjalankan perangkat fisik.

### Menghubungkan ke ESP32 melalui WebSocket
Buka halaman **Hubungkan ESP32** dari kartu hardware di Beranda atau Monitoring, lalu masukkan alamat endpoint WebSocket, misalnya `ws://192.168.4.1:81`. Browser menyimpan alamat terakhir di `localStorage` dan mencoba menyambung ulang ketika halaman SmartFarm lain dibuka. Status hardware hanya menjadi terhubung setelah WebSocket berhasil dibuka.

| Fungsi | Perilaku browser | Pesan WebSocket |
|---|---|---|
| `HW.connect(url)` | membuka WebSocket ke URL yang dipilih | handshake `{ "type": "hello", "device": "smartfarm-web", "version": 1, "sensors": { "clock": "DS3231", "feedLevel": "HC-SR04" } }` |
| `HW.disconnect()` | menutup WebSocket | controller menerima event koneksi tertutup |
| `HW.readLightSensor()` | membaca nilai sensor terakhir | nilai `light` dari paket `sensor`/`status` |
| `HW.runFeeder(gram)` | mengirim perintah | `{ "type": "feed", "grams": 500 }` |
| `HW.setLamp(on)` | mengirim perintah | `{ "type": "lamp", "on": true }` |

RTC waktu sistem menggunakan **DS3231** dan level pakan menggunakan **HC-SR04**. ESP32 dapat mengirim paket RTC `{ "type": "rtc", "rtc": { "year": 2026, "month": 9, "day": 17, "hour": 12, "minute": 30, "second": 0 } }`, lalu paket sensor `{ "type": "sensor", "distanceCm": 18.4, "light": "Gelap", "lampOn": false }`. Jarak dikonversi menjadi persentase berdasarkan `feedEmptyDistanceCm` (default 40 cm) dan `feedFullDistanceCm` (default 5 cm). Pesan apa pun memperbarui waktu data terakhir; heartbeat berkala membuat kartu monitoring tetap akurat. Pesan error dapat dikirim sebagai `{ "type": "error", "message": "..." }`.

### Simulasi sensor cahaya untuk pengujian
Karena sensor cahaya (LDR) fisik belum terpasang, halaman **Lampu Otomatis** punya toggle "Ikuti Sensor / Paksa Gelap / Paksa Terang" (`sensorCahayaManual` di state) supaya kedua kondisi (siang & malam) bisa didemokan kapan saja tanpa menunggu waktu sungguhan. Set kembali ke "Ikuti Sensor" agar otomasi memakai jam sistem seperti sensor asli.

## Logika otomasi (`js/automation.js`)
Berjalan setiap 1 detik selagi sebuah halaman terbuka, mengikuti alur di spesifikasi:
1. **Cek koneksi hardware** — kalau terputus, semua otomasi berhenti dan status berubah "Menunggu Hardware", tidak ada aksi yang dijalankan.
2. **Baca sensor cahaya** realtime, catat ke riwayat setiap kali kondisi berubah.
3. **Lampu**: menyala hanya jika *dalam jadwal* **dan** kondisi *Gelap* (mode Manual di Jadwal Lampu membuat sistem tidak menimpa kendali pengguna).
4. **Pakan**: waktu jadwal dibaca dari RTC DS3231. Begitu mencapai jadwal aktif (dan hari ini termasuk hari terpilih), motor/servo "dijalankan" via `HW.runFeeder()`. Level stok setelahnya mengikuti pembacaan HC-SR04, dengan status proses Menunggu → Menjalankan → Berhasil → Menunggu lagi.
5. **Stok pakan**: notifikasi otomatis begitu stok ≤ 30%, dengan tombol Isi Ulang; hilang otomatis begitu stok diisi ulang.

## Interaktivitas
- Semua toggle, jadwal, status hardware, dan riwayat **saling tersinkronisasi antar halaman** lewat `localStorage` + event `sf-tick` — mengubah status di satu halaman langsung terlihat di halaman lain.
- Tombol "Beri Pakan Sekarang" dan "Nyalakan Sekarang" melalui alur hardware yang sama dengan otomasi (bukan sekadar mengubah tampilan), dan otomatis nonaktif/disabled saat hardware belum terhubung.
- Time picker, slider kecerahan, stepper takaran, filter tab, dan pemilih hari semuanya fungsional.
- Fully responsive dari layar HP kecil (320–360px) sampai desktop (tampil sebagai frame HP), tanpa horizontal scroll.

## Kustomisasi lanjutan
- Warna & token desain ada di `css/base.css` (bagian `:root`).
- Untuk menyambungkan ke backend/API sungguhan (bukan hanya `localStorage`), ganti fungsi `load()`/`save()` di `js/shared.js` (objek `SF`) agar membaca/menulis ke API.

# ayam-boiler
