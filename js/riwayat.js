/* =========================================================
   SmartFarm IoT — Halaman Riwayat
   Menampilkan daftar riwayat pakan/lampu/sistem dengan filter
   tab (Semua / Pakan / Lampu / Sistem).
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('riwayatList');
  const empty = document.getElementById('emptyState');
  let activeFilter = 'Semua'; // filter yang sedang aktif

  // Ikon SVG untuk tiap jenis riwayat
  const iconSvg = {
    pakan: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9h18l-1.6 9.6A2 2 0 0 1 17.43 20H6.57a2 2 0 0 1-1.97-1.4L3 9Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M7 9a5 5 0 0 1 10 0" stroke="currentColor" stroke-width="1.8"/></svg>`,
    lampu: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.24 1.1 2.05V16h5v-.15c0-.81.5-1.6 1.1-2.05A6 6 0 0 0 12 3Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
    hardware: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="4" stroke="currentColor" stroke-width="1.7"/><path d="M9 4V2M15 4V2M9 22v-2M15 22v-2M4 9H2M4 15H2M22 9h-2M22 15h-2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`
  };
  const iconClass = { pakan:'ico-green', lampu:'ico-yellow', hardware:'ico-plus' };
  // Menerjemahkan nama tab filter ke nama icon yang tersimpan di data
  const filterMap = { Pakan:'pakan', Lampu:'lampu', Sistem:'hardware' };

  // Menggambar ulang daftar riwayat sesuai filter yang dipilih
  function render(filter){
    activeFilter = filter;
    const st = SF.all();
    const items = st.riwayat.filter(r => filter === 'Semua' || r.icon === filterMap[filter]);
    if(!items.length){
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = items.map(r => `
      <li class="riwayat-item">
        <span class="control-ico ${iconClass[r.icon] || 'ico-green'}">${iconSvg[r.icon] || iconSvg.pakan}</span>
        <div class="riwayat-main">
          <div class="riwayat-title">
            <span>${r.title}</span>
            <span class="sep">•</span>
            <span class="time">${r.time}</span>
          </div>
          <div class="riwayat-meta">
            <span class="riwayat-date">${r.date}</span>
            <span class="mode-pill ${r.mode === 'Otomatis' ? 'mode-otomatis' : 'mode-manual'}">${r.mode}</span>
          </div>
        </div>
        <span class="riwayat-status">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M8 12.5l2.5 2.5L16 9.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="12" r="9.2" stroke="currentColor" stroke-width="1.6"/></svg>
          ${r.status}
        </span>
      </li>
    `).join('');
  }

  render('Semua'); // tampilan awal saat halaman dibuka

  // Tombol tab filter (Semua/Pakan/Lampu/Sistem)
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      render(tab.dataset.filter);
    });
  });

  /* Baris riwayat baru (pakan/lampu/hardware) bisa muncul otomatis saat
     halaman ini terbuka — gambar ulang daftar sesuai filter yang aktif. */
  document.addEventListener('sf-tick', () => render(activeFilter));
});
