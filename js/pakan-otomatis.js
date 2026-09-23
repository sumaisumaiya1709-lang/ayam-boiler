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

  // Mengubah teks & titik status "Pakan Otomatis Aktif/Nonaktif"
  function refreshStatus(on){
    document.getElementById('statusFeederText').textContent = on ? 'Pakan Otomatis Aktif' : 'Pakan Otomatis Nonaktif';
    document.getElementById('statusDotFeeder').classList.toggle('off', !on);
  }
  document.getElementById('pakanSwitch').addEventListener('sf-toggle', e => {
    refreshStatus(e.detail.on);
    showToast(e.detail.on ? 'Pakan otomatis diaktifkan' : 'Pakan otomatis dinonaktifkan');
  });

  /* Pemilih slot jam pemberian pakan yang aktif */
  const slots = document.querySelectorAll('.slot');
  slots.forEach(s => {
    s.addEventListener('click', () => {
      slots.forEach(x => x.classList.remove('active'));
      s.classList.add('active');
      SF.patch({ pakanJadwalAktif: s.dataset.time, pakanLastRunKey: '' });
      showToast(`Jadwal aktif diatur ke ${s.dataset.time}`);
    });
  });

  // Menggambar ulang daftar riwayat pemberian pakan
  function renderHistory(){
    const data = SF.get('riwayatPakan');
    document.getElementById('feedHistory').innerHTML = data.map(f => `
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
    `).join('');
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
    document.getElementById('stokPersen').textContent = `${st.stokPakan}%`;
    document.getElementById('takaranText').textContent = `${st.pakanTakaran} g / Sesi`;
    document.getElementById('terakhirText').textContent = st.pakanTerakhir;
    refreshStatus(st.pakanOtomatis);

    slots.forEach(s => s.classList.toggle('active', s.dataset.time === st.pakanJadwalAktif));

    const p = procMap[st.pakanProsesStatus] || procMap['menunggu'];
    procChip.className = `proc-chip ${p.cls}`;
    procChipText.textContent = p.text;

    const hardwareOnline = st.hardwareStatus === 'ONLINE';
    pakanWarningBanner.hidden = hardwareOnline;
    beriPakanBtn.disabled = !hardwareOnline || st.pakanProsesStatus === 'berjalan';
    beriPakanBtn.style.opacity = beriPakanBtn.disabled ? .6 : 1;

    renderHistory();
  }

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
