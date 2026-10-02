/* =========================================================
   SmartFarm IoT — Halaman Isi Ulang Pakan
   Terhubung ke Laravel API
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

  // =======================================================
  // Menampilkan kondisi stok pakan
  // =======================================================
  function paintLevel(pct) {
    const nilai = pct == null ? null : Number(pct);
    const known = Number.isFinite(nilai);
    const aman = known && nilai > 30;

    document.getElementById('levelValue').textContent =
      known ? `${nilai}%` : '--';

    document.getElementById('levelValue').classList.toggle('ok', aman);

    document.getElementById('levelBarFill').style.width =
      known ? `${nilai}%` : '0%';

    document.getElementById('levelBarFill').classList.toggle('ok', aman);

    const badge = document.getElementById('levelBadge');

    badge.textContent =
      known
        ? (aman ? 'Stok Aman' : 'Hampir Habis')
        : 'Menunggu Data';

    badge.classList.toggle(
      'badge-orange',
      known && !aman
    );

    badge.classList.toggle(
      'badge-green',
      aman
    );

    const estimate = document.getElementById('levelEstimate');
    const estimateText = document.getElementById('levelEstimateText');

    const perkiraanHari = known
      ? Math.max(1, Math.round(nilai / 20))
      : null;

    estimate.classList.toggle('ok', aman);

    estimateText.textContent = known
      ? `Perkiraan Habis: ${
          aman ? perkiraanHari + ' hari lagi' : '1 hari lagi'
        }`
      : 'Menunggu data sensor HC-SR04';
  }


  // =======================================================
  // Ambil stok terbaru dari Laravel
  // =======================================================
  async function loadStock() {
    try {
      const sensors = await API.getSensorData();

      const sensor = sensors?.[0];

      if (sensor) {
        const stok = sensor.feed_stock == null ? null : Number(sensor.feed_stock);
        const validStock = Number.isFinite(stok) ? stok : null;

        SF.patch({
          stokPakan: validStock
        });

        paintLevel(validStock);
      } else {
        SF.patch({ stokPakan: null });
        paintLevel(null);
      }

    } catch (error) {
      console.error(
        'Gagal mengambil data stok pakan:',
        error
      );

      SF.patch({ stokPakan: null });
      paintLevel(null);
    }
  }


  // =======================================================
  // Muat stok ketika halaman dibuka
  // =======================================================
  await loadStock();


  // =======================================================
  // Stepper jumlah pakan
  // =======================================================
  const stepper = document.getElementById('isiStepper');

  initStepper(stepper, {
    min: 1,
    max: 50,
    step: 1
  });

  stepper.querySelector(
    '[data-step="value"]'
  ).textContent = '10 kg';


  // =======================================================
  // Tombol Konfirmasi Isi Pakan
  // =======================================================
  const konfirmasiBtn =
    document.getElementById('konfirmasiBtn');

  konfirmasiBtn.addEventListener('click', async () => {

    const kg = parseInt(
      stepper.querySelector(
        '[data-step="value"]'
      ).textContent,
      10
    );

    if (!Number.isFinite(kg) || kg < 1) {
      showToast('Jumlah pakan tidak valid');
      return;
    }

    // Cegah tombol ditekan berkali-kali
    konfirmasiBtn.disabled = true;
    const teksAwal = konfirmasiBtn.textContent;
    konfirmasiBtn.textContent = 'Menyimpan...';

    try {

      // Kirim data isi ulang ke Laravel
      const result = await API.refillFeed({
        device_id: 1,
        amount_kg: kg
      });

      // Stok terbaru dari database
      const stokBaru = result?.stok_sesudah == null
        ? NaN
        : Number(result.stok_sesudah);
      if (!Number.isFinite(stokBaru) || stokBaru < 0 || stokBaru > 100) {
        throw new Error('Respons refill tidak berisi stok database yang valid.');
      }

      // Simpan ke state frontend
      SF.patch({
        stokPakan: stokBaru
      });

      // Perbarui tampilan
      paintLevel(stokBaru);

      showToast(
        `Berhasil menambah ${kg} kg pakan`
      );

      // Kembali ke Monitoring
      setTimeout(() => {
        window.location.href = 'monitoring.html';
      }, 900);

    } catch (error) {

      console.error(
        'Gagal menyimpan isi ulang pakan:',
        error
      );

      showToast(
        'Gagal menyimpan isi ulang pakan'
      );

      konfirmasiBtn.disabled = false;
      konfirmasiBtn.textContent = teksAwal;
    }
  });

});