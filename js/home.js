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

  async function persistScheduleToggle(kind, active, toggle){
    const isFeed = kind === 'feed';
    const key = isFeed ? 'pakanOtomatis' : 'lampuOtomatis';
    const badge = isFeed ? 'badgePakan' : 'badgeLampu';
    SF.set(key, !active);
    toggle.classList.toggle('on', !active);
    toggle.setAttribute('aria-checked', !active);
    toggle.disabled = true;

    try {
      const schedules = isFeed
        ? await API.getFeedSchedules()
        : await API.getLampSchedules();
      const schedule = Array.isArray(schedules)
        ? schedules.find(item => Number(item.device_id) === 1)
        : null;
      if (!schedule) throw new Error('Jadwal untuk perangkat tidak ditemukan.');

      if (isFeed) {
        await API.updateFeedSchedule(schedule.id, {
          device_id: 1,
          feeding_time: String(schedule.feeding_time).slice(0, 5),
          feed_amount: Number(schedule.feed_amount),
          is_active: active,
          days: Array.isArray(schedule.days) ? schedule.days : []
        });
        SF.patch({ pakanOtomatis: active, pakanUlangi: active, pakanScheduleActive: active });
      } else {
        await API.updateLampSchedule(schedule.id, {
          device_id: 1,
          start_time: String(schedule.start_time).slice(0, 5),
          end_time: String(schedule.end_time).slice(0, 5),
          auto_mode: active,
          is_active: active ? true : !!schedule.is_active,
          days: Array.isArray(schedule.days) ? schedule.days : []
        });
        SF.patch({
          lampuOtomatis: active,
          lampuMode: active ? 'Otomatis' : 'Manual',
          lampScheduleActive: active ? true : !!schedule.is_active
        });
      }
      refreshBadge(badge, active);
      showToast(active ? 'Otomatisasi diaktifkan' : 'Otomatisasi dinonaktifkan');
    } catch (error) {
      console.error('Gagal menyimpan status otomasi dari Home:', error);
      toggle.classList.toggle('on', !active);
      toggle.setAttribute('aria-checked', !active);
      refreshBadge(badge, !active);
      showToast('Status otomasi gagal disimpan ke database');
    } finally {
      toggle.disabled = false;
    }
  }

  document.querySelector('[data-key="pakanOtomatis"]').addEventListener('sf-toggle', e => {
    persistScheduleToggle('feed', e.detail.on, e.currentTarget);
  });
  document.querySelector('[data-key="lampuOtomatis"]').addEventListener('sf-toggle', e => {
    persistScheduleToggle('lamp', e.detail.on, e.currentTarget);
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

    const feedSensorReady = connected && st.sensorPakanAktif && Number.isFinite(st.feedDistanceCm);
    hwSensorPakan.classList.toggle('on', feedSensorReady);
    hwSensorPakan.classList.toggle('off', !feedSensorReady);
    hwSensorPakanText.textContent = feedSensorReady ? 'Aktif' : (connected ? 'Menunggu Data' : 'Tidak Aktif');

    const lightSensorReady = connected && st.sensorCahayaAktif && !!st.kondisiCahaya;
    hwSensorCahaya.classList.toggle('on', lightSensorReady);
    hwSensorCahaya.classList.toggle('off', !lightSensorReady);
    hwSensorOtomatisText.textContent = lightSensorReady ? 'Aktif' : (connected ? 'Menunggu Data' : 'Standby');

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
    document.querySelectorAll('[data-key="pakanOtomatis"]').forEach(toggle => {
      const active = st.pakanScheduleAvailable && st.pakanScheduleActive && st.pakanOtomatis;
      toggle.classList.toggle('on', active);
      toggle.setAttribute('aria-checked', active);
    });
    document.querySelectorAll('[data-key="lampuOtomatis"]').forEach(toggle => {
      const active = st.lampScheduleAvailable && st.lampScheduleActive && st.lampuOtomatis;
      toggle.classList.toggle('on', active);
      toggle.setAttribute('aria-checked', active);
    });
  }

  render(SF.all()); // gambar tampilan pertama kali saat halaman dibuka

    // Sinkronisasi data Dashboard dari Laravel
  async function syncDashboardFromApi(){
    try {
      const [sensors, feedSchedules, lampSchedules] = await Promise.all([
        API.getSensorData(),
        API.getFeedSchedules(),
        API.getLampSchedules()
      ]);

      const sensor = sensors?.[0];
      const feedSchedule = Array.isArray(feedSchedules)
        ? feedSchedules.find(item => Number(item.device_id) === 1)
        : null;
      const lampSchedule = Array.isArray(lampSchedules)
        ? lampSchedules.find(item => Number(item.device_id) === 1)
        : null;

      if (sensor) {
        const stock = sensor.feed_stock == null ? null : Number(sensor.feed_stock);
        SF.patch({
          stokPakan: Number.isFinite(stock) ? stock : null
        });
      }

      if (feedSchedule) {
        SF.patch({
          pakanScheduleAvailable: true,
          pakanScheduleActive: !!feedSchedule.is_active,
          pakanJadwalAktif: String(feedSchedule.feeding_time).slice(0, 5),
          pakanTakaran: Number(feedSchedule.feed_amount),
          pakanOtomatis: !!feedSchedule.is_active,
          pakanUlangi: !!feedSchedule.is_active,
          pakanHari: Array.isArray(feedSchedule.days) ? feedSchedule.days : []
        });
      } else {
        SF.patch({ pakanScheduleAvailable: false, pakanScheduleActive: false, pakanOtomatis: false });
      }

      if (lampSchedule) {
        SF.patch({
          lampScheduleAvailable: true,
          lampScheduleActive: !!lampSchedule.is_active,
          lampuNyala: String(lampSchedule.start_time).slice(0, 5),
          lampuMati: String(lampSchedule.end_time).slice(0, 5),
          lampuMode: lampSchedule.auto_mode ? 'Otomatis' : 'Manual',
          lampuOtomatis: !!lampSchedule.auto_mode && !!lampSchedule.is_active,
          lampuHari: Array.isArray(lampSchedule.days) ? lampSchedule.days : []
        });
      } else {
        SF.patch({ lampScheduleAvailable: false, lampScheduleActive: false, lampuOtomatis: false });
      }

      render(SF.all());

    } catch (error) {
      console.error('Gagal mengambil data Dashboard dari Laravel:', error);
      SF.patch({
        stokPakan: null,
        pakanScheduleAvailable: false,
        pakanScheduleActive: false,
        pakanOtomatis: false,
        pakanUlangi: false,
        lampScheduleAvailable: false,
        lampScheduleActive: false,
        lampuOtomatis: false
      });
      render(SF.all());
    }
  }

  syncDashboardFromApi();
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
