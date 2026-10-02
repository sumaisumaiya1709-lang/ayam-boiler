/* =========================================================
   SmartFarm IoT — Halaman Lampu Otomatis
  Detail & kontrol lampu: durasi menyala, sensor cahaya,
  dan tombol "Nyalakan Sekarang".
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {

  const lampuWarningBanner = document.getElementById('lampuWarningBanner');
  const nyalakanBtn = document.getElementById('nyalakanBtn');
  const saklarSub = document.getElementById('saklarSub');
  const lampSwitch = document.getElementById('lampSwitch');

  // Menghitung berapa lama lampu menyala (dalam jam), dari jam nyala ke jam mati
  function calcDurasi(nyala, mati){
    const [h1,m1] = nyala.split(':').map(Number);
    const [h2,m2] = mati.split(':').map(Number);
    let mins = (h2*60+m2) - (h1*60+m1);
    if(mins <= 0) mins += 24*60; // durasi melewati tengah malam
    return Math.round(mins/60);
  }

  // Mengubah keterangan di bawah saklar sesuai mode otomatis/manual
  function refreshMode(on){
    saklarSub.textContent = on ? 'Sistem otomatis aktif' : 'Kendali manual (otomatis nonaktif)';
  }
  lampSwitch.addEventListener('sf-toggle', async e => {
    const active = e.detail.on;
    SF.patch({ lampuOtomatis: !active });
    lampSwitch.classList.toggle('on', !active);
    lampSwitch.setAttribute('aria-checked', !active);
    lampSwitch.disabled = true;

    try {
      const schedules = await API.getLampSchedules();
      const schedule = Array.isArray(schedules)
        ? schedules.find(item => Number(item.device_id) === 1)
        : null;
      if (!schedule) throw new Error('Jadwal lampu untuk perangkat tidak ditemukan.');

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
      showToast(active ? 'Lampu otomatis diaktifkan' : 'Lampu otomatis dinonaktifkan');
    } catch (error) {
      console.error('Gagal memperbarui mode lampu:', error);
      lampSwitch.classList.toggle('on', !active);
      lampSwitch.setAttribute('aria-checked', !active);
      showToast('Mode lampu gagal disimpan ke database');
    } finally {
      lampSwitch.disabled = false;
      render(SF.all());
    }
  });

  // Menggambar ulang daftar aktivitas khusus lampu (maksimal 5 baris terbaru)
  function renderActivity(){
    const icon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M3 12h4l2.2 7L13 4.5 15.2 12H21" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const items = SF.get('aktivitas').filter(a => a.type.startsWith('lampu')).slice(0,5);
    document.getElementById('lampActivity').innerHTML = items.map(a => `
      <li>
        <span class="control-ico ico-yellow">${icon}</span>
        <div>
          <strong>${a.title}</strong>
          <span class="sub">${a.time}</span>
        </div>
      </li>
    `).join('');
  }

  // Menggambar ulang seluruh tampilan halaman berdasarkan data (st) terbaru
  function render(st){
    const scheduleAvailable = st.lampScheduleAvailable;
    document.getElementById('waktuNyala').textContent = scheduleAvailable ? `${st.lampuNyala} WIB` : '--';
    document.getElementById('waktuMati').textContent = scheduleAvailable ? `${st.lampuMati} WIB` : '--';
    document.getElementById('durasiText').textContent = scheduleAvailable ? `${calcDurasi(st.lampuNyala, st.lampuMati)} Jam` : '--';
    const autoActive = scheduleAvailable && st.lampScheduleActive && st.lampuOtomatis;
    refreshMode(autoActive);
    lampSwitch.classList.toggle('on', autoActive);
    lampSwitch.setAttribute('aria-checked', autoActive);

    // Teks kondisi sensor cahaya: tanda hubung kalau hardware belum terhubung
    const hardwareOnline = st.hardwareStatus === 'ONLINE';
    document.getElementById('kondisiCahayaText').textContent = !hardwareOnline || !st.sensorCahayaAktif || !st.kondisiCahaya
      ? '—'
      : (st.kondisiCahaya === 'Gelap' ? '🌙 Gelap' : '☀️ Terang');

    /* Status FISIK lampu yang menentukan tampilan, bukan sekadar saklar mode otomatis */
    const physicallyOn = hardwareOnline && st.lampuStatus;
    document.getElementById('lampCaptionText').textContent = !hardwareOnline
      ? 'Hardware Tidak Terhubung'
      : (physicallyOn ? 'Lampu Menyala' : 'Lampu Mati');
    document.getElementById('lampDot').classList.toggle('off', !physicallyOn);
    document.getElementById('glowCircle').style.opacity = physicallyOn ? '1' : '0';
    document.getElementById('lampGlassFill').setAttribute('fill', physicallyOn ? '#FCE7A0' : '#C9C2AE');

    lampuWarningBanner.hidden = hardwareOnline;
    nyalakanBtn.disabled = !hardwareOnline;
    nyalakanBtn.style.opacity = nyalakanBtn.disabled ? .6 : 1;

    renderActivity();
  }

  render(SF.all()); // gambar tampilan pertama kali saat halaman dibuka

  // Gambar ulang tampilan setiap kali ada data baru dari automation.js/hardware.js
  document.addEventListener('sf-tick', e => render(e.detail));
  document.addEventListener('hw-status-changed', () => render(SF.all()));

  // Tombol "Nyalakan Sekarang"
  nyalakanBtn.addEventListener('click', () => {
    if(!HW.isConnected()){
      showToast('Hubungkan hardware terlebih dahulu untuk menjalankan sistem otomatis.');
      return;
    }
    HW.setLamp(true).then(res => {
      if(res.ok){
        SF.set('lampuStatus', true);
      SF.addAktivitas({ type:'lampu-on', title:'Lampu dinyalakan manual oleh pengguna', time: SF.fmtJam() });
      SF.addRiwayat({ icon:'lampu', title:'Lampu ON', time: SF.fmtJam(), date:'Hari ini', mode:'Manual', status:'Selesai' });
      showToast('Lampu dinyalakan sekarang');
      if(SF.get('lampuOtomatis') && SF.get('lampuMode') !== 'Manual'){
        showToast('Catatan: sistem otomatis dapat mengubahnya kembali sesuai jadwal & sensor.');
      }
      } else showToast(res.reason === 'ack-timeout' ? 'ESP32 tidak memberi konfirmasi lampu.' : 'Lampu gagal dinyalakan.');
    });
  });
});
