/* =========================================================
   SmartFarm IoT — Halaman Atur Jadwal Pakan
   Mengatur jam pemberian pakan, takaran, dan hari aktif,
   lalu menyimpannya ke data bersama (SF).
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const st = SF.all();

  /* ---- Pengatur jam & menit (time wheel) ---- */
  let jam = st.pakanJam, menit = st.pakanMenit, ampm = st.pakanAmPm;
  const hourEl = document.getElementById('hourValue');
  const minEl = document.getElementById('minuteValue');

  // Menampilkan ulang jam, menit, dan tombol AM/PM yang sedang aktif
  function paint(){
    hourEl.textContent = jam.toString().padStart(2,'0');
    minEl.textContent = menit.toString().padStart(2,'0');
    document.querySelectorAll('.ampm-btn').forEach(b => b.classList.toggle('active', b.dataset.ampm === ampm));
  }
  paint(); // tampilkan nilai awal saat halaman baru dibuka

  // Tombol +/- untuk jam: berputar dari 12 kembali ke 1, dan sebaliknya
  document.querySelector('[data-role="hour-inc"]').addEventListener('click', () => { jam = jam === 12 ? 1 : jam + 1; paint(); });
  document.querySelector('[data-role="hour-dec"]').addEventListener('click', () => { jam = jam === 1 ? 12 : jam - 1; paint(); });
  // Tombol +/- untuk menit: melompat 5 menit, berputar dari 55 ke 0 dan sebaliknya
  document.querySelector('[data-role="min-inc"]').addEventListener('click', () => { menit = (menit + 5) % 60; paint(); });
  document.querySelector('[data-role="min-dec"]').addEventListener('click', () => { menit = (menit - 5 + 60) % 60; paint(); });
  // Tombol AM/PM
  document.querySelectorAll('.ampm-btn').forEach(b => b.addEventListener('click', () => { ampm = b.dataset.ampm; paint(); }));

  /* ---- Stepper takaran pakan (gram) ---- */
  const takaranStepper = document.getElementById('takaranStepper');
  initStepper(takaranStepper, {
    min:100, max:2000, step:50,
    onChange: () => {}
  });
  takaranStepper.querySelector('[data-step="value"]').textContent = `${st.pakanTakaran} g`;

  /* ---- Pemilih hari aktif (Sen, Sel, Rab, ...) ---- */
  const pills = document.querySelectorAll('.day-pill');
  let selectedDays = new Set(st.pakanHari); // kumpulan hari yang sedang dipilih
  pills.forEach(p => {
    p.classList.toggle('active', selectedDays.has(p.dataset.day));
    p.addEventListener('click', () => {
      // Klik hari yang sudah aktif -> matikan. Klik hari nonaktif -> aktifkan.
      if(selectedDays.has(p.dataset.day)){
        selectedDays.delete(p.dataset.day);
      } else {
        selectedDays.add(p.dataset.day);
      }
      p.classList.toggle('active');
    });
  });

  // Tombol "Simpan"
  document.getElementById('simpanBtn').addEventListener('click', () => {
    if(selectedDays.size === 0){
      showToast('Pilih minimal satu hari');
      return;
    }
    const takaran = parseInt(takaranStepper.querySelector('[data-step="value"]').textContent, 10);

    // Mengubah format jam 12-jam (1-12 + AM/PM) menjadi format 24-jam
    // supaya bisa dibandingkan langsung dengan jam sistem (mis. "07:00")
    let jam24 = jam % 12;
    if(ampm === 'PM') jam24 += 12;
    const jam24Text = jam24.toString().padStart(2,'0');

    const config = {
      pakanJam: jam,
      pakanMenit: menit,
      pakanAmPm: ampm,
      pakanTakaran: takaran,
      pakanUlangi: document.querySelector('[data-key="pakanUlangi"]').classList.contains('on'),
      pakanHari: Array.from(selectedDays),
      pakanJadwalAktif: `${jam24Text}:${menit.toString().padStart(2,'0')}`,
      pakanLastRunKey: ''  // jadwal berubah -> izinkan trigger lagi hari ini jika waktunya cocok
    };
    SF.patch(config);
    if(typeof HW !== 'undefined' && HW.isConnected()) HW.sendConfiguration({ device_id: SF.get('deviceId'), feed_schedule: config }).catch(() => {});
    showToast('Jadwal pakan berhasil disimpan');
    setTimeout(() => { window.location.href = 'pakan-otomatis.html'; }, 700);
  });
});
