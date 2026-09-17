/* =========================================================
   SmartFarm IoT — Halaman Atur Jadwal Lampu
   Mengatur jam nyala/mati, kecerahan, hari aktif, dan mode
   Otomatis/Manual untuk lampu kandang.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const st = SF.all();
  let nyala = st.lampuNyala;
  let mati = st.lampuMati;
  let mode = st.lampuMode || 'Otomatis';

  document.getElementById('nyalaVal').textContent = nyala;
  document.getElementById('matiVal').textContent = mati;

  /* ---- Tombol pilihan mode: Otomatis / Manual ---- */
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
    btn.addEventListener('click', () => {
      document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      mode = btn.dataset.mode;
    });
  });

  /* ---- Slider kecerahan lampu ---- */
  const slider = document.getElementById('brightnessSlider2');
  const valueLabel = document.getElementById('kecerahanVal');
  slider.value = st.lampuKecerahanJadwal;
  slider.style.setProperty('--val', `${st.lampuKecerahanJadwal}%`);
  valueLabel.textContent = `${st.lampuKecerahanJadwal}%`;
  slider.addEventListener('input', () => {
    slider.style.setProperty('--val', `${slider.value}%`);
    valueLabel.textContent = `${slider.value}%`;
  });

  /* ---- Pemilih hari aktif ---- */
  const pills = document.querySelectorAll('#dayPills2 .day-pill');
  let selectedDays = new Set(st.lampuHari);
  pills.forEach(p => {
    p.classList.toggle('active', selectedDays.has(p.dataset.day));
    p.addEventListener('click', () => {
      // Klik hari yang sudah aktif -> matikan. Klik hari nonaktif -> aktifkan.
      if(selectedDays.has(p.dataset.day)) selectedDays.delete(p.dataset.day);
      else selectedDays.add(p.dataset.day);
      p.classList.toggle('active');
    });
  });

  /* ---- Kotak pop-up untuk mengubah jam nyala/mati ---- */
  const editor = document.getElementById('timeEditor');
  const editorInput = document.getElementById('editorInput');
  const editorLabel = document.getElementById('editorLabel');
  let editingTarget = null; // 'nyala' atau 'mati', menandai jam mana yang sedang diedit

  document.querySelectorAll('.ubah-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      editingTarget = btn.dataset.target;
      editorLabel.textContent = editingTarget === 'nyala' ? 'Ubah Waktu Nyala' : 'Ubah Waktu Mati';
      editorInput.value = editingTarget === 'nyala' ? nyala : mati;
      editor.hidden = false;
    });
  });

  // Menambah atau mengurangi waktu (format "HH:MM") sebanyak `mins` menit,
  // dan otomatis berputar dari 23:59 kembali ke 00:00 (dan sebaliknya).
  function bumpTime(val, mins){
    const [jam, menit] = val.split(':').map(Number);
    const totalMenitSehari = 24 * 60;
    let totalMenitBaru = (jam * 60 + menit + mins + totalMenitSehari) % totalMenitSehari;
    const jamBaru = Math.floor(totalMenitBaru / 60).toString().padStart(2,'0');
    const menitBaru = (totalMenitBaru % 60).toString().padStart(2,'0');
    return `${jamBaru}:${menitBaru}`;
  }
  // Tombol +/- 15 menit di dalam kotak pop-up
  document.getElementById('editorInc').addEventListener('click', () => editorInput.value = bumpTime(editorInput.value, 15));
  document.getElementById('editorDec').addEventListener('click', () => editorInput.value = bumpTime(editorInput.value, -15));

  // Tombol selesai mengubah jam
  document.getElementById('editorClose').addEventListener('click', () => {
    if(editingTarget === 'nyala'){
      nyala = editorInput.value;
      document.getElementById('nyalaVal').textContent = nyala;
    } else {
      mati = editorInput.value;
      document.getElementById('matiVal').textContent = mati;
    }
    editor.hidden = true;
  });
  editor.addEventListener('click', e => { if(e.target === editor) editor.hidden = true; });

  /* ---- Tombol "Lainnya": reset cepat ke pengaturan default ---- */
  document.getElementById('moreBtn').addEventListener('click', () => {
    if(confirm('Reset jadwal lampu ke pengaturan default (18:00–06:00, 75%)?')){
      nyala = '18:00'; mati = '06:00';
      document.getElementById('nyalaVal').textContent = nyala;
      document.getElementById('matiVal').textContent = mati;
      slider.value = 75;
      slider.style.setProperty('--val','75%');
      valueLabel.textContent = '75%';
      showToast('Jadwal direset ke pengaturan default');
    }
  });

  // Tombol "Simpan"
  document.getElementById('simpanLampuBtn').addEventListener('click', () => {
    if(selectedDays.size === 0){
      showToast('Pilih minimal satu hari aktif');
      return;
    }
    SF.patch({
      lampuNyala: nyala,
      lampuMati: mati,
      lampuKecerahanJadwal: parseInt(slider.value,10),
      lampuHari: Array.from(selectedDays),
      lampuMode: mode
    });
    showToast('Perubahan jadwal lampu disimpan');
    setTimeout(() => { window.location.href = 'lampu-otomatis.html'; }, 700);
  });
});
