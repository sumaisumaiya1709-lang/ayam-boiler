/* =========================================================
   SmartFarm IoT — Tempat penyimpanan data bersama (SF = SmartFarm)
   ---------------------------------------------------------
   File ini dipakai oleh SEMUA halaman. Semua data (jadwal, stok,
   status hardware, riwayat, dll) disimpan di satu tempat yaitu
   localStorage milik browser, supaya setiap halaman selalu
   melihat data yang sama dan tetap sinkron.

   Cara pakai dari file lain:
     SF.get('namaData')        -> ambil satu nilai
     SF.set('namaData', nilai) -> ubah satu nilai lalu simpan
     SF.patch({ a: 1, b: 2 })  -> ubah beberapa nilai sekaligus
     SF.all()                  -> ambil semua data sekaligus
   ========================================================= */

const SF = (() => {
  const KEY = 'smartfarm_state_v1'; // nama "kotak" penyimpanan di localStorage

  // Nilai awal/default untuk semua data di website ini
  const defaults = {
    /* ---- Koneksi Hardware / Controller (ESP32) ---- */
    hardwareConnected: false,       // status koneksi web <-> controller
    hardwareName: 'ESP32 SmartFarm Controller',
    hardwareWsUrl: 'ws://192.168.4.1:81', // endpoint WebSocket ESP32
    hardwareLastSeen: Date.now(),   // timestamp data terakhir diterima dari hardware
    rtcIso: null,                    // waktu RTC DS3231 terakhir dari ESP32
    rtcValid: false,
    sensorPakanAktif: true,         // aktif hanya bila hardware terhubung
    feedDistanceCm: null,            // jarak permukaan pakan dari HC-SR04
    feedLevelPercent: 75,            // level pakan hasil kalibrasi HC-SR04
    feedEmptyDistanceCm: 40,         // jarak saat wadah kosong
    feedFullDistanceCm: 5,           // jarak saat wadah penuh
    sensorCahayaAktif: true,        // aktif hanya bila hardware terhubung
    sensorCahayaManual: null,       // null = ikuti sensor/waktu asli, 'Gelap'|'Terang' = override manual utk pengujian
    kondisiCahaya: 'Terang',        // dibaca terus-menerus oleh automation.js
    lampuStatus: false,             // status FISIK lampu (hasil aksi hardware), beda dari toggle mode lampuOtomatis
    pakanProsesStatus: 'menunggu',  // 'menunggu' | 'berjalan' | 'berhasil' | 'menunggu-hardware'
    pakanLastRunKey: '',            // anti-duplikasi: tanggal+jam terakhir pakan otomatis dijalankan
    ambangStokPakan: 30,            // % batas bawah stok sebelum notifikasi
    stokWarned: false,

    pakanOtomatis: true,
    pakanJadwalAktif: '12:00',      // jadwal aktif yang dijalankan otomatis oleh controller
    pakanJam: 12, pakanMenit: 0, pakanAmPm: 'PM',
    pakanSlots: ['07:00','12:00','17:00'],
    pakanTakaran: 500,
    pakanUlangi: true,
    pakanHari: ['Sen','Sel','Rab','Kam','Jum'],
    pakanTerakhir: 'Hari ini, 12:00',

    lampuOtomatis: true,
    lampuNyala: '18:00',
    lampuMati: '06:00',
    lampuKecerahan: 85,
    lampuKecerahanJadwal: 75,
    lampuHari: ['Sen','Sel','Rab','Kam','Jum'],
    lampuMode: 'Otomatis',

    stokPakan: 75,     // % ketersediaan pakan, disinkronkan dari HC-SR04
    stokIsiUlang: 30,  // % shown specifically on the refill screen

    riwayatPakan: [
      { title:'Hari ini, 12:00 WIB', desc:'Pakan: 500 gram', status:'Selesai' },
      { title:'Hari ini, 07:00 WIB', desc:'Pakan: 500 gram', status:'Selesai' },
      { title:'Kemarin, 17:00 WIB', desc:'Pakan: 500 gram', status:'Selesai' },
    ],

    aktivitas: [
      { type:'pakan', title:'Pakan Otomatis selesai dijalankan', time:'09:00 WIB' },
      { type:'lampu-off', title:'Lampu Otomatis dimatikan sistem', time:'06:00 WIB' },
      { type:'lampu-on', title:'Lampu Otomatis dinyalakan sistem', time:'Kemarin, 18:00 WIB' },
      { type:'refill', title:'Sisa pakan diisi ulang oleh pengguna', time:'Kemarin, 16:30 WIB' },
    ],

    riwayat: [
      { icon:'pakan', title:'Pakan', time:'07:00 WIB', date:'31 Agu 2026', mode:'Otomatis', status:'Selesai' },
      { icon:'lampu', title:'Lampu ON', time:'18:00 WIB', date:'31 Agu 2026', mode:'Otomatis', status:'Selesai' },
      { icon:'pakan', title:'Pakan', time:'07:00 WIB', date:'31 Agu 2026', mode:'Otomatis', status:'Selesai' },
      { icon:'lampu', title:'Lampu OFF', time:'06:00 WIB', date:'31 Agu 2026', mode:'Otomatis', status:'Selesai' },
      { icon:'pakan', title:'Pakan', time:'12:30 WIB', date:'30 Agu 2026', mode:'Manual', status:'Selesai' },
    ],

    totalPemberianPakanHariIni: 3,
    durasiPencahayaan: 8,
  };

  // Membaca data yang tersimpan di localStorage. Kalau belum ada
  // (misalnya baru pertama kali buka website), pakai nilai default.
  function load(){
    try{
      const raw = localStorage.getItem(KEY);
      if(!raw) return structuredClone(defaults);
      return Object.assign(structuredClone(defaults), JSON.parse(raw));
    }catch(e){
      return structuredClone(defaults);
    }
  }

  let state = load(); // data yang sedang aktif dipakai website

  // Menyimpan data terbaru ke localStorage
  function save(){
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function get(k){ return state[k]; }

  // Mengubah satu nilai lalu langsung menyimpannya
  function set(k, v){
    state[k] = v;
    save();
  }

  // Mengubah beberapa nilai sekaligus (lebih ringkas daripada set() berkali-kali)
  function patch(obj){
    Object.assign(state, obj);
    save();
  }

  // Menambah satu baris baru ke daftar Riwayat (paling atas)
  function addRiwayat(entry){
    state.riwayat.unshift(entry);
    save();
  }

  // Menambah satu baris baru ke daftar Aktivitas (paling atas)
  function addAktivitas(entry){
    state.aktivitas.unshift(entry);
    save();
  }

  // Mengembalikan semua data ke pengaturan awal
  function reset(){
    state = structuredClone(defaults);
    save();
  }

  /* ---- Fungsi bantu untuk tanggal & jam ---- */

  // Nama hari singkat dalam Bahasa Indonesia, dipakai oleh pemilih hari (Sen..Min)
  const DAY_ID = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

  // Mengambil singkatan nama hari ini, contoh: "Sen"
  function now(){
    const rtc = state.rtcIso && new Date(state.rtcIso);
    return state.rtcValid && rtc && !Number.isNaN(rtc.getTime()) ? rtc : new Date();
  }

  function todayAbbr(d){ return DAY_ID[(d || now()).getDay()]; }

  // Mengambil tanggal dalam format YYYY-MM-DD, dipakai sebagai kunci anti-duplikasi
  function dateKey(d){
    d = d || now();
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
  }

  // Mengambil jam:menit dengan 2 digit, contoh: "07:05"
  function hhmm(d){
    d = d || now();
    const jam = d.getHours().toString().padStart(2,'0');
    const menit = d.getMinutes().toString().padStart(2,'0');
    return `${jam}:${menit}`;
  }

  // Sama seperti hhmm(), tapi ditambah keterangan zona waktu "WIB"
  function fmtJam(d){ return hhmm(d) + ' WIB'; }

  return { get, set, patch, addRiwayat, addAktivitas, reset, all: () => state, now, todayAbbr, dateKey, hhmm, fmtJam };
})();

/* ---------------- Perilaku tombol saklar (switch) ---------------- */
// Membuat semua elemen ".switch" di halaman bisa diklik untuk
// menyalakan/mematikan sesuatu, dan otomatis tersimpan ke SF.
function initSwitches(){
  document.querySelectorAll('.switch[data-key]').forEach(sw => {
    const key = sw.dataset.key;
    const isOn = !!SF.get(key);
    sw.classList.toggle('on', isOn);
    sw.setAttribute('role','switch');
    sw.setAttribute('aria-checked', isOn);
    sw.addEventListener('click', () => {
      const nowOn = !sw.classList.contains('on');
      sw.classList.toggle('on', nowOn);
      sw.setAttribute('aria-checked', nowOn);
      SF.set(key, nowOn);
      sw.dispatchEvent(new CustomEvent('sf-toggle', { detail:{ on: nowOn }, bubbles:true }));
    });
  });
}

/* ---------------- Toast (notifikasi kecil di bawah layar) ---------------- */
let toastTimer = null;
// Menampilkan pesan singkat selama beberapa detik lalu hilang sendiri
function showToast(msg){
  let el = document.querySelector('.toast');
  if(!el){
    el = document.createElement('div');
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  requestAnimationFrame(() => el.classList.add('show'));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------------- Tombol kembali ---------------- */
// Membuat tombol dengan atribut [data-back] kembali ke halaman
// sebelumnya. Kalau tidak ada riwayat halaman sebelumnya, pindah
// ke halaman yang ditulis di atribut data-back (contoh: index.html).
function initBackButtons(){
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      const fallback = btn.getAttribute('data-back') || 'index.html';
      if(document.referrer && history.length > 1){
        history.back();
      } else {
        window.location.href = fallback;
      }
    });
  });
}

/* ---------------- Stepper: tombol (- angka +) ---------------- */
// root  = elemen pembungkus yang berisi tombol kurang, angka, tombol tambah
// min/max/step = batas bawah, batas atas, dan besar loncatan tiap klik
// onChange = fungsi yang dipanggil setiap kali angkanya berubah
function initStepper(root, { min=0, max=99999, step=1, onChange } = {}){
  const dec = root.querySelector('[data-step="dec"]');   // tombol "-"
  const inc = root.querySelector('[data-step="inc"]');   // tombol "+"
  const val = root.querySelector('[data-step="value"]'); // teks angka di tengah

  // Membaca angka yang sedang tampil (buang satuan seperti "g" atau "kg")
  function read(){ return parseInt(val.textContent.replace(/[^\d-]/g,''),10) || 0; }

  // Menulis angka baru ke layar, dibatasi supaya tidak kurang dari min / lebih dari max
  function write(n, unit){
    n = Math.min(max, Math.max(min, n));
    val.textContent = unit ? `${n} ${unit}` : n;
    onChange && onChange(n);
    return n;
  }

  dec && dec.addEventListener('click', () => write(read() - step, dec.dataset.unit));
  inc && inc.addEventListener('click', () => write(read() + step, inc.dataset.unit));
  return { read, write };
}

// Jalankan fungsi-fungsi di atas begitu halaman selesai dimuat
document.addEventListener('DOMContentLoaded', () => {
  initSwitches();
  initBackButtons();
});
