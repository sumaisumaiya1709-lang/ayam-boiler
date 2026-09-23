# SmartFarm IoT — Web Mobile Terhubung Hardware

Website mobile-first untuk monitoring & kontrol SmartFarm (kandang ayam pintar), dibangun dengan HTML, CSS, dan JavaScript murni (tanpa framework/build tool). UI dipertahankan; arsitektur sekarang menyiapkan REST API Laravel/MySQL dan ESP32 sebagai eksekutor otomasi utama.

```
	WEB DASHBOARD  <──>  LARAVEL API  <──>  MYSQL
				 \              |
					\-- WebSocket prototype -- ESP32 -- sensor/servo/relay
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
| `jadwal-lampu.html` | Atur jadwal ON/OFF & mode Otomatis/Manual lampu |
| `isi-ulang-pakan.html` | Isi ulang stok pakan |

## Arsitektur (dipisah sesuai lapisan, siap dihubungkan ke hardware asli)

```
js/shared.js      → CACHE       : state UI/prototype di localStorage
js/api.js         → API         : satu pintu REST Laravel, nonaktif sampai backend tersedia
js/hardware.js    → HARDWARE    : satu-satunya file yang bicara dengan ESP32
js/automation.js  → FALLBACK    : aturan browser sementara; produksi dijalankan ESP32
js/*.js (per halaman) → UI     : render tampilan & interaksi pengguna, tidak pernah mengasumsikan hardware
css/hardware.css  → komponen UI status hardware (dipakai bersama di beberapa halaman)
```

Kontrak antar lapisan sengaja dibuat sederhana supaya mudah dikembangkan:
- **UI → Logic/Hardware**: memanggil `HW.xxx()` (mis. tombol manual) atau `window.triggerFeeding()`, tidak pernah menulis status "berhasil" sendiri.
- **Logic/Hardware → UI**: hanya lewat event `sf-tick` (setiap ~1 detik) dan `hw-status-changed`/`hw-connecting` (instan saat koneksi berubah). Setiap halaman cukup `document.addEventListener('sf-tick', e => render(e.detail))`.
- **ACK wajib**: `HW.runFeeder()` dan `HW.setLamp()` hanya melapor sukses setelah menerima `feed_result`/`lamp_result` dengan `request_id` yang sesuai. WebSocket open saja bukan bukti aktuator berhasil.
- **Heartbeat nyata**: `hardwareLastSeen` hanya diperbarui oleh paket ESP32. Status perangkat adalah `ONLINE`, `OFFLINE`, atau `UNKNOWN`.

### Menghubungkan ke ESP32 melalui WebSocket
Buka halaman **Hubungkan ESP32** dari kartu hardware di Beranda atau Monitoring, lalu masukkan alamat endpoint WebSocket, misalnya `ws://192.168.4.1:81`. Browser menyimpan alamat terakhir di `localStorage` dan mencoba menyambung ulang ketika halaman SmartFarm lain dibuka. Status hardware hanya menjadi terhubung setelah WebSocket berhasil dibuka.

| Fungsi | Perilaku browser | Pesan WebSocket |
|---|---|---|
| `HW.connect(url)` | membuka WebSocket ke URL yang dipilih | handshake `{ "type": "hello", "device": "smartfarm-web", "version": 1, "sensors": { "clock": "DS3231", "feedLevel": "HC-SR04" } }` |
| `HW.disconnect()` | menutup WebSocket | controller menerima event koneksi tertutup |
| `HW.readLightSensor()` | membaca nilai sensor terakhir | nilai `light` dari paket `sensor`/`status` |
| `HW.runFeeder(gram)` | mengirim dan menunggu ACK | `{ "type": "feed", "request_id": "...", "grams": 500 }` |
| `HW.setLamp(on)` | mengirim dan menunggu ACK | `{ "type": "lamp", "request_id": "...", "on": true }` |

RTC waktu sistem menggunakan **DS3231** dan level pakan menggunakan **HC-SR04**. Sensor tambahan bersifat opsional. `sensor_data` dapat berisi `feed_level`, `distance_cm`, `light_condition`, `lamp_status`, `temperature`, dan `humidity`. Hanya heartbeat/data dari ESP32 yang memperbarui waktu terakhir.

### Sensor cahaya
Halaman **Lampu Otomatis** hanya menampilkan kondisi LDR yang benar-benar dikirim ESP32. Sebelum paket sensor cahaya diterima, nilainya ditampilkan sebagai `—` dan automation menunggu data.

## Logika otomasi (`js/automation.js`)
Berjalan setiap 1 detik selagi sebuah halaman terbuka, mengikuti alur di spesifikasi:
1. **Cek koneksi hardware** — kalau terputus, semua otomasi berhenti dan status berubah "Menunggu Hardware", tidak ada aksi yang dijalankan.
2. **Baca sensor cahaya** realtime dari ESP32, catat ke riwayat setiap kali kondisi berubah.
3. **Lampu**: menyala hanya jika *dalam jadwal* **dan** kondisi *Gelap* (mode Manual di Jadwal Lampu membuat sistem tidak menimpa kendali pengguna).
4. **Pakan**: waktu jadwal dibaca dari RTC DS3231. Begitu mencapai jadwal aktif (dan hari ini termasuk hari terpilih), motor/servo "dijalankan" via `HW.runFeeder()`. Level stok setelahnya mengikuti pembacaan HC-SR04, dengan status proses Menunggu → Menjalankan → Berhasil → Menunggu lagi.
5. **Stok pakan**: notifikasi otomatis begitu pembacaan HC-SR04 valid dan stok ≤ 30%. Sebelum sensor mengirim data, stok ditampilkan sebagai `--`, bukan 0%.

## Interaktivitas
- Semua toggle, jadwal, status hardware, dan riwayat **saling tersinkronisasi antar halaman** lewat `localStorage` + event `sf-tick` — mengubah status di satu halaman langsung terlihat di halaman lain.
- Tombol "Beri Pakan Sekarang" dan "Nyalakan Sekarang" melalui alur hardware yang sama dengan otomasi (bukan sekadar mengubah tampilan), dan otomatis nonaktif/disabled saat hardware belum terhubung.
- Time picker, stepper takaran, filter tab, dan pemilih hari semuanya fungsional. Lampu hanya memiliki kondisi ON/OFF.
- Fully responsive dari layar HP kecil (320–360px) sampai desktop (tampil sebagai frame HP), tanpa horizontal scroll.

## Kustomisasi lanjutan
- Warna & token desain ada di `css/base.css` (bagian `:root`).
- `js/api.js` adalah titik sambung REST Laravel. Aktifkan dan konfigurasi `API.configure({ baseUrl, enabled:true })` setelah endpoint Laravel tersedia; jangan menambahkan `fetch()` di file halaman.

### Protokol ESP32

Heartbeat: `{ "type":"heartbeat", "device_id":"KANDANG_01", "timestamp":"2026-09-23T10:00:00Z" }`.

Sensor: `{ "type":"sensor_data", "device_id":"KANDANG_01", "timestamp":"...", "feed_level":73, "distance_cm":14.2, "light_condition":"dark", "lamp_status":true }`.

Command pakan: `{ "type":"feed", "request_id":"KANDANG_01-...", "grams":500 }` lalu `{ "type":"feed_result", "request_id":"...", "status":"success", "grams":500 }` atau `status:"failed", "error":"motor_timeout"`.

Command lampu: `{ "type":"lamp", "request_id":"...", "on":true }` lalu `{ "type":"lamp_result", "request_id":"...", "status":"success", "on":true }`. Lampu relay hanya ON/OFF; LDR hanya menentukan `dark`/`bright`.

Konfigurasi jadwal: `{ "type":"configuration", "request_id":"...", "config": { "device_id":"KANDANG_01", "lamp_schedule": { "start_time":"18:00", "end_time":"06:00", "mode":"automatic", "days":["Sen"] } } }` dan ESP32 membalas result dengan `request_id` yang sama. Setelah diterima, ESP32 menjalankan jadwal sendiri tanpa dashboard.

### Kontrak Laravel/MySQL

Backend yang akan datang minimal membutuhkan `devices`, `sensor_readings`, `feed_schedules`, `lamp_schedules`, `feed_history`, `lamp_history`, dan `activity_logs`. Semua tabel turunan memakai foreign key ke `devices`; histori sensor/aksi tidak disimpan sebagai sumber utama di localStorage. Migration sengaja belum dibuat karena Laravel dan kebutuhan deployment belum tersedia.

# ayam-boiler
