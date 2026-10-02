/* =========================================================
   SmartFarm IoT — Halaman Pakan Otomatis
   Detail & kontrol pemberian pakan: jadwal aktif, tombol
   "Beri Pakan Sekarang", dan riwayat pemberian pakan.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {

  const beriPakanBtn = document.getElementById('beriPakanBtn');
  const procChip = document.getElementById('procChip');
  const procChipText = document.getElementById('procChipText');
  const pakanWarningBanner = document.getElementById('pakanWarningBanner');
  const pakanSwitch = document.getElementById('pakanSwitch');

  // Mengubah teks & titik status "Pakan Otomatis Aktif/Nonaktif"
  function refreshStatus(on){
    document.getElementById('statusFeederText').textContent = on ? 'Pakan Otomatis Aktif' : 'Pakan Otomatis Nonaktif';
    document.getElementById('statusDotFeeder').classList.toggle('off', !on);
  }
  pakanSwitch.addEventListener('sf-toggle', async e => {
    const active = e.detail.on;
    SF.patch({ pakanOtomatis: !active });
    pakanSwitch.classList.toggle('on', !active);
    pakanSwitch.setAttribute('aria-checked', !active);
    pakanSwitch.disabled = true;

    try {
      const schedules = await API.getFeedSchedules();
      const schedule = Array.isArray(schedules)
        ? schedules.find(item => Number(item.device_id) === 1)
        : null;
      if (!schedule) throw new Error('Jadwal pakan untuk perangkat tidak ditemukan.');

      await API.updateFeedSchedule(schedule.id, {
        device_id: 1,
        feeding_time: String(schedule.feeding_time).slice(0, 5),
        feed_amount: Number(schedule.feed_amount),
        is_active: active,
        days: Array.isArray(schedule.days) ? schedule.days : []
      });

      SF.patch({
        pakanOtomatis: active,
        pakanUlangi: active,
        pakanScheduleActive: active
      });
      showToast(active ? 'Pakan otomatis diaktifkan' : 'Pakan otomatis dinonaktifkan');
    } catch (error) {
      console.error('Gagal memperbarui status jadwal pakan:', error);
      pakanSwitch.classList.toggle('on', !active);
      pakanSwitch.setAttribute('aria-checked', !active);
      showToast('Status pakan gagal disimpan ke database');
    } finally {
      pakanSwitch.disabled = false;
      render(SF.all());
    }
  });

  /* Slot menampilkan jadwal database; perubahan jam dilakukan dari halaman jadwal. */
  const slots = document.querySelectorAll('.slot');
  slots.forEach(s => {
    s.addEventListener('click', () => {
      window.location.href = 'jadwal-pakan.html';
    });
  });

  // Menggambar ulang daftar riwayat pemberian pakan
  function renderHistory(){
    const data = SF.get('riwayatPakan');
    document.getElementById('feedHistory').innerHTML = data.length ? data.map(f => `
      <li>
        <div class="fh-left">
          <span class="fh-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </span>
          <div>
            <strong>${f.title}</strong>
            <span class="sub">${f.desc}</span>
          </div>
        </div>
        <span class="badge badge-green">${f.status}</span>
      </li>
    `).join('') : '<li class="muted">Belum ada riwayat pemberian pakan.</li>';
  }

  // Terjemahan setiap status proses pakan menjadi kelas CSS + teks yang tampil
  const procMap = {
    'menunggu': { cls:'wait', text:'Menunggu Jadwal' },
    'berjalan': { cls:'busy', text:'Menjalankan Pakan...' },
    'berhasil': { cls:'ok', text:'Pakan Berhasil Dikeluarkan' },
    'menunggu-hardware': { cls:'err', text:'Menunggu Hardware Terhubung' },
  };

  // Menggambar ulang seluruh tampilan halaman berdasarkan data (st) terbaru
  function render(st){
    document.getElementById('stokPersen').textContent = Number.isFinite(st.stokPakan) ? `${st.stokPakan}%` : '--';
    document.getElementById('takaranText').textContent = st.pakanScheduleAvailable ? `${st.pakanTakaran} g / Sesi` : '--';
    document.getElementById('terakhirText').textContent = st.pakanTerakhir || 'Belum ada';
    const scheduleTime = st.pakanScheduleAvailable ? st.pakanJadwalAktif : '';
    slots.forEach((slot, index) => {
      const visible = index === 0 && !!scheduleTime;
      slot.hidden = !visible;
      if (visible) {
        slot.dataset.time = scheduleTime;
        slot.textContent = scheduleTime;
        slot.classList.add('active');
      }
    });
    const active = st.pakanScheduleAvailable && st.pakanScheduleActive && st.pakanOtomatis;
    refreshStatus(active);
    pakanSwitch.classList.toggle('on', active);
    pakanSwitch.setAttribute('aria-checked', active);

    const p = procMap[st.pakanProsesStatus] || procMap['menunggu'];
    procChip.className = `proc-chip ${p.cls}`;
    procChipText.textContent = p.text;

    const hardwareOnline = st.hardwareStatus === 'ONLINE';
    pakanWarningBanner.hidden = hardwareOnline;
    beriPakanBtn.disabled = !hardwareOnline || st.pakanProsesStatus === 'berjalan';
    beriPakanBtn.style.opacity = beriPakanBtn.disabled ? .6 : 1;

    renderHistory();
  }

    // Mengambil stok pakan terbaru dari Laravel
  async function loadStockFromApi(){
    try {
      const sensors = await API.getSensorData();
      const sensor = sensors?.[0];

      const stock = sensor?.feed_stock == null ? null : Number(sensor.feed_stock);
      if(Number.isFinite(stock)){
        SF.patch({
          stokPakan: stock
        });
      } else {
        SF.patch({ stokPakan: null });
      }
      render(SF.all());
    } catch(error){
      console.error('Gagal mengambil stok pakan dari Laravel:', error);
      SF.patch({ stokPakan: null });
      render(SF.all());
    }
  }

  async function loadFeedHistoryFromApi(){
    try {
      const history = await API.getFeedHistory();
      const entries = Array.isArray(history) ? history : [];
      SF.set('riwayatPakan', entries.map(item => {
        const date = item.fed_at ? new Date(item.fed_at) : null;
        const time = date && !Number.isNaN(date.getTime())
          ? `Hari ini, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
          : 'Waktu tidak tersedia';
        const amount = Number(item.feed_amount);
        return {
          title: time,
          desc: Number.isFinite(amount) ? `Pakan: ${amount} gram` : 'Pakan diberikan',
          status: item.status === 'success' ? 'Selesai' : (item.status || '—')
        };
      }));
      renderHistory();
    } catch (error) {
      console.error('Gagal mengambil riwayat pakan dari Laravel:', error);
      SF.set('riwayatPakan', []);
      renderHistory();
    }
  }

  loadStockFromApi();
  loadFeedHistoryFromApi();

  render(SF.all()); // gambar tampilan pertama kali saat halaman dibuka

  // Gambar ulang tampilan setiap kali ada data baru dari automation.js/hardware.js
  document.addEventListener('sf-tick', e => render(e.detail));
  document.addEventListener('hw-status-changed', () => render(SF.all()));

  // Tombol "Beri Pakan Sekarang"
  beriPakanBtn.addEventListener('click', () => {
    if(!HW.isConnected()){
      showToast('Hubungkan hardware terlebih dahulu untuk menjalankan sistem otomatis.');
      return;
    }
    if(SF.get('pakanProsesStatus') === 'berjalan') return;

    showToast('Menjalankan motor/servo pakan...');
    window.triggerFeeding(SF.get('pakanTakaran'), 'Manual').then(res => {
      if(res && res.ok){
        showToast('Pakan berhasil diberikan sekarang');
      } else if(res && res.reason === 'not-connected'){
        showToast('Gagal: hardware tidak terhubung.');
      }
    });
  });
});
