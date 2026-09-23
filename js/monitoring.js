/* =========================================================
   SmartFarm IoT — Halaman Monitoring
   Menampilkan status hardware & sensor, stok pakan, dan
   daftar aktivitas terbaru secara realtime.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {

  const hwPill = document.getElementById('hwPill');
  const hwPillText = document.getElementById('hwPillText');
  const hwConnectBtn = document.getElementById('hwConnectBtn');
  const hwWarningBanner = document.getElementById('hwWarningBanner');
  const hwSensorPakan = document.getElementById('hwSensorPakan');
  const hwSensorPakanText = document.getElementById('hwSensorPakanText');
  const hwSensorCahaya = document.getElementById('hwSensorCahaya');
  const hwSensorCahayaText = document.getElementById('hwSensorCahayaText');
  const hwLastSeen = document.getElementById('hwLastSeen');
  const stockCard = document.getElementById('stockCard');
  const stockWarningBanner = document.getElementById('stockWarningBanner');

  // Mengubah timestamp menjadi teks "berapa lama yang lalu", misal "3 menit lalu"
  function timeAgo(ts){
    if(!ts) return '-';
    const detik = Math.round((Date.now() - ts) / 1000);
    if(detik < 5) return 'baru saja';
    if(detik < 60) return `${detik} detik lalu`;
    return `${Math.round(detik / 60)} menit lalu`;
  }

  // Kumpulan ikon SVG untuk tiap jenis aktivitas di daftar riwayat
  const icons = {
    pakan: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M3 9h18l-1.6 9.6A2 2 0 0 1 17.43 20H6.57a2 2 0 0 1-1.97-1.4L3 9Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M7 9a5 5 0 0 1 10 0" stroke="currentColor" stroke-width="1.7"/></svg>`,
    'lampu-off': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.24 1.1 2.05V16h5v-.15c0-.81.5-1.6 1.1-2.05A6 6 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    'lampu-on': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.24 1.1 2.05V16h5v-.15c0-.81.5-1.6 1.1-2.05A6 6 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    refill: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`,
    'hardware-on': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.7"/></svg>`,
    'hardware-off': `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.7"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.7"/></svg>`,
    sensor: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4.2" stroke="currentColor" stroke-width="1.7"/><path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
    warning: `<svg width="17" height="17" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.7"/><path d="M12 8v5M12 16v.01" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>`
  };
  // Warna latar ikon untuk tiap jenis aktivitas (dipasangkan dengan `icons` di atas)
  const iconClass = {
    pakan:'ico-green', 'lampu-off':'ico-yellow', 'lampu-on':'ico-yellow', refill:'ico-plus',
    'hardware-on':'ico-green', 'hardware-off':'ico-yellow', sensor:'ico-yellow', warning:'ico-yellow'
  };

  // Menggambar ulang seluruh tampilan halaman berdasarkan data (st) terbaru
  function render(st){
    const connected = st.hardwareStatus === 'ONLINE';

    hwPill.classList.toggle('on', connected);
    hwPill.classList.toggle('off', !connected);
    hwPillText.textContent = connected ? 'Terhubung' : 'Tidak Terhubung';
    hwConnectBtn.hidden = connected;
    hwWarningBanner.hidden = connected;

    hwSensorPakan.classList.toggle('on', connected);
    hwSensorPakan.classList.toggle('off', !connected);
    hwSensorPakanText.textContent = connected
      ? (Number.isFinite(st.feedDistanceCm) ? `${st.feedDistanceCm} cm / ${st.feedLevelPercent}%` : 'Menunggu data')
      : 'Tidak Aktif';

    hwSensorCahaya.classList.toggle('on', connected);
    hwSensorCahaya.classList.toggle('off', !connected);
    hwSensorCahayaText.textContent = connected ? (st.kondisiCahaya === 'Gelap' ? '🌙 Gelap' : '☀️ Terang') : 'Tidak Aktif';

    hwLastSeen.textContent = connected
      ? `RTC DS3231: ${st.rtcValid ? SF.fmtJam(SF.now()) : 'menunggu data'} · masuk ${timeAgo(st.hardwareLastSeen)}`
      : 'RTC DS3231: tidak terhubung';

    /* Kartu Pakan & Lampu di grid perangkat */
    const pakanDot = document.getElementById('pakanDot');
    const lampuDot = document.getElementById('lampuDot');
    pakanDot.classList.toggle('off', !connected);
    lampuDot.classList.toggle('off', !connected);

    const pakanTextMap = {
      menunggu: 'Menunggu Jadwal', berjalan: 'Menjalankan Pakan...', berhasil: 'Pakan Berhasil',
      'menunggu-hardware': 'Menunggu Hardware'
    };
    document.getElementById('pakanConnText').textContent = st.pakanOtomatis
      ? (pakanTextMap[st.pakanProsesStatus] || 'Menunggu Jadwal')
      : 'Nonaktif';
    document.getElementById('lampuConnText').textContent = !connected
      ? 'Tidak Terhubung'
      : (st.lampuStatus ? 'Menyala' : 'Mati');

    document.getElementById('jadwalPakanBerikutnya').textContent = `${st.pakanJadwalAktif} WIB`;
    document.getElementById('jadwalLampuMon').textContent = `${st.lampuNyala}–${st.lampuMati}`;

    /* Stok pakan: digambar sebagai lingkaran progres (ring) */
    const stok = st.stokPakan;
    const ring = document.getElementById('stokRing');
    const jariJari = 42;
    const kelilingLingkaran = 2 * Math.PI * jariJari;
    ring.style.strokeDasharray = `${kelilingLingkaran}`;
    // Semakin besar stok, semakin kecil "potongan kosong" pada lingkaran
    const bagianKosong = kelilingLingkaran - (stok / 100) * kelilingLingkaran;
    ring.style.strokeDashoffset = bagianKosong;
    ring.setAttribute('stroke', stok <= st.ambangStokPakan ? '#D64545' : '#2E8B57');
    document.getElementById('stokValue').textContent = `${stok}%`;

    const days = Math.max(1, Math.round(stok / 25));
    document.getElementById('stokDesc').textContent =
      stok <= st.ambangStokPakan
        ? 'Stok menipis, segera isi ulang pakan'
        : `Sisa pakan mencukupi untuk ${days} hari ke depan`;
    stockWarningBanner.hidden = stok > st.ambangStokPakan;

    /* Daftar aktivitas terbaru (maksimal 12 baris) */
    const list = document.getElementById('activityList');
    list.innerHTML = st.aktivitas.slice(0, 12).map(a => `
      <li class="activity-item">
        <span class="control-ico ${iconClass[a.type] || 'ico-green'}">${icons[a.type] || icons.sensor}</span>
        <div class="activity-text">
          <strong>${a.title}</strong>
          <span>${a.time}</span>
        </div>
      </li>
    `).join('');
  }

  render(SF.all()); // gambar tampilan pertama kali saat halaman dibuka

  // Gambar ulang tampilan setiap kali ada data baru dari automation.js/hardware.js
  document.addEventListener('sf-tick', e => render(e.detail));
  document.addEventListener('hw-status-changed', () => render(SF.all()));

  // Tombol "Hubungkan Hardware"
  hwConnectBtn.addEventListener('click', () => {
    hwConnectBtn.disabled = true;
    hwConnectBtn.textContent = 'Menghubungkan...';
    hwPill.classList.remove('off');
    hwPill.classList.add('connecting');
    hwPillText.textContent = 'Menghubungkan...';
    HW.connect().then(() => {
      hwConnectBtn.disabled = false;
      hwConnectBtn.textContent = 'Coba Hubungkan Lagi';
      hwPill.classList.remove('connecting');
      showToast('Hardware berhasil terhubung');
      render(SF.all());
    });
  });
});
