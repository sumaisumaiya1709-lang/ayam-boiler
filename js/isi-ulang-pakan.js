/* =========================================================
   SmartFarm IoT — Halaman Isi Ulang Pakan
   Menambah stok pakan secara manual dan mencatatnya ke
   riwayat & aktivitas.
   ========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Menggambar ulang kartu "Sisa Pakan Saat Ini" (persen, bar, badge, perkiraan habis)
  function paintLevel(pct){
    const aman = pct > 30;

    document.getElementById('levelValue').textContent = `${pct}%`;
    document.getElementById('levelValue').classList.toggle('ok', aman);

    document.getElementById('levelBarFill').style.width = `${pct}%`;
    document.getElementById('levelBarFill').classList.toggle('ok', aman);

    const badge = document.getElementById('levelBadge');
    badge.textContent = aman ? 'Stok Aman' : 'Hampir Habis';
    badge.classList.toggle('badge-orange', !aman);
    badge.classList.toggle('badge-green', aman);

    // Perkiraan berapa hari lagi stok akan habis (kira-kira 1% berkurang tiap 20% waktu)
    const estimate = document.getElementById('levelEstimate');
    const estimateText = document.getElementById('levelEstimateText');
    const perkiraanHari = Math.max(1, Math.round(pct / 20));
    estimate.classList.toggle('ok', aman);
    estimateText.textContent = `Perkiraan Habis: ${aman ? perkiraanHari + ' hari lagi' : '1 hari lagi'}`;
  }

  let stok = SF.get('stokPakan');
  paintLevel(stok);

  // Stepper jumlah pakan yang akan diisi (dalam kg)
  const stepper = document.getElementById('isiStepper');
  initStepper(stepper, { min:1, max:50, step:1 });
  stepper.querySelector('[data-step="value"]').textContent = '10 kg';

  // Tombol "Konfirmasi Isi Pakan"
  document.getElementById('konfirmasiBtn').addEventListener('click', () => {
    const kg = parseInt(stepper.querySelector('[data-step="value"]').textContent, 10);

    // 1 kg pakan dianggap menaikkan stok sekitar 2,5%, tidak boleh melebihi 100%
    const tambahanPersen = Math.min(100 - stok, Math.round(kg * 2.5));
    stok = Math.min(100, stok + tambahanPersen);
    SF.patch({ stokPakan: stok, stokIsiUlang: stok, stokWarned: false });
    paintLevel(stok);

    const jam = SF.fmtJam();
    SF.addAktivitas({ type:'refill', title:`Sisa pakan diisi ulang oleh pengguna (+${kg} kg)`, time: jam });
    SF.addRiwayat({ icon:'pakan', title:'Isi Ulang Pakan', time: jam, date:'Hari ini', mode:'Manual', status:'Selesai' });

    showToast(`Berhasil menambah ${kg} kg pakan`);
    setTimeout(() => { window.location.href = 'monitoring.html'; }, 900);
  });
});
