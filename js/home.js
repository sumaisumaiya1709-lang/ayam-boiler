/* =========================================================
   SmartFarm IoT — Halaman Beranda (index.html)
   Menampilkan sapaan, status hardware, kartu kontrol pakan &
   lampu, serta ringkasan aktivitas hari ini.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {

  /* ---- Sapaan sesuai jam saat ini ---- */
  const hour = SF.now().getHours();
  let greet = 'Selamat Pagi';
  if (hour >= 11 && hour < 15) greet = 'Selamat Siang';
  else if (hour >= 15 && hour < 18) greet = 'Selamat Sore';
  else if (hour >= 18 || hour < 4) greet = 'Selamat Malam';
  document.getElementById('greeting').textContent = `${greet}, Admin! 👋`;

  /* Mencegah kartu kontrol pindah halaman saat yang diklik adalah
     tombol saklar (switch) di dalamnya, bukan kartunya sendiri. */
  document.querySelectorAll('[data-nav-stop]').forEach(el => {
    el.addEventListener('click', e => e.preventDefault());
  });

  // Mengubah warna & teks badge (Aktif/Nonaktif) sesuai status on/off
  function refreshBadge(id, on){
    const badge = document.getElementById(id);
    badge.classList.toggle('badge-green', on);
    badge.classList.toggle('badge-orange', !on);
    badge.lastChild.textContent = on ? 'Aktif' : 'Nonaktif';
  }

  document.querySelector('[data-key="pakanOtomatis"]').addEventListener('sf-toggle', e => {
    refreshBadge('badgePakan', e.detail.on);
    showToast(e.detail.on ? 'Pakan otomatis diaktifkan' : 'Pakan otomatis dinonaktifkan');
  });
  document.querySelector('[data-key="lampuOtomatis"]').addEventListener('sf-toggle', e => {
    refreshBadge('badgeLampu', e.detail.on);
    showToast(e.detail.on ? 'Pencahayaan otomatis diaktifkan' : 'Pencahayaan otomatis dinonaktifkan');
  });

  /* ---------------- Kartu status hardware ---------------- */
  const hwPill = document.getElementById('hwPill');
  const hwPillText = document.getElementById('hwPillText');
  const hwConnectBtn = document.getElementById('hwConnectBtn');
  const hwWarningBanner = document.getElementById('hwWarningBanner');
  const hwSensorPakan = document.getElementById('hwSensorPakan');
  const hwSensorPakanText = document.getElementById('hwSensorPakanText');
  const hwSensorCahaya = document.getElementById('hwSensorCahaya');
  const hwSensorOtomatisText = document.getElementById('hwSensorOtomatisText');
  const hwLastSeen = document.getElementById('hwLastSeen');
  const heroHwText = document.getElementById('heroHwText');
  const heroStatusText = document.getElementById('heroStatusText');
  const heroDot = document.getElementById('heroDot');

  // Mengubah timestamp menjadi teks "berapa lama yang lalu", misal "3 menit lalu"
  function timeAgo(ts){
    if(!ts) return '-';
    const detik = Math.round((Date.now() - ts) / 1000);
    if(detik < 5) return 'baru saja';
    if(detik < 60) return `${detik} detik lalu`;
    const menit = Math.round(detik / 60);
    return `${menit} menit lalu`;
  }

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
    hwSensorPakanText.textContent = connected ? 'Aktif' : 'Tidak Aktif';

    hwSensorCahaya.classList.toggle('on', connected);
    hwSensorCahaya.classList.toggle('off', !connected);
    hwSensorOtomatisText.textContent = connected ? 'Aktif' : 'Standby';

    hwLastSeen.textContent = connected
      ? `Data terakhir: ${timeAgo(st.hardwareLastSeen)}`
      : 'Tidak ada data masuk';

    heroHwText.textContent = connected ? 'ESP32 Terhubung' : 'ESP32 Terputus';
    heroStatusText.textContent = connected ? 'Sistem Online' : 'Sistem Offline';
    heroDot.classList.toggle('offline', !connected);

    document.getElementById('jadwalPakanText').textContent = `Jadwal: ${st.pakanJadwalAktif} WIB`;
    document.getElementById('jadwalLampuText').textContent = `Mulai: ${st.lampuNyala} WIB`;
    document.getElementById('totalPakanText').textContent = `${st.totalPemberianPakanHariIni} Kali Selesai`;
    document.getElementById('durasiLampuText').textContent = `${st.durasiPencahayaan} Jam Aktif`;

    refreshBadge('badgePakan', st.pakanOtomatis);
    refreshBadge('badgeLampu', st.lampuOtomatis);
  }

  render(SF.all()); // gambar tampilan pertama kali saat halaman dibuka

  // Gambar ulang tampilan setiap kali ada data baru dari automation.js/hardware.js
  document.addEventListener('sf-tick', e => render(e.detail));
  document.addEventListener('hw-status-changed', () => render(SF.all()));
  document.addEventListener('hw-connecting', () => render(SF.all()));

  // Tombol "Hubungkan Hardware"
  hwConnectBtn.addEventListener('click', () => {
    hwConnectBtn.disabled = true;
    hwConnectBtn.textContent = 'Menghubungkan...';
    hwPill.classList.remove('off');
    hwPill.classList.add('connecting');
    hwPillText.textContent = 'Menghubungkan...';
    HW.connect().then(() => {
      hwConnectBtn.disabled = false;
      hwConnectBtn.textContent = 'Hubungkan Hardware';
      hwPill.classList.remove('connecting');
      showToast('Hardware berhasil terhubung');
      render(SF.all());
    });
  });

});
