/* =========================================================
   SmartFarm IoT — Halaman Atur Jadwal Pakan

   Fungsi:
   1. Mengambil jadwal pakan terbaru dari Laravel / MySQL
   2. Menampilkan data jadwal ke halaman
   3. Mengatur jam, menit, AM/PM
   4. Mengatur takaran pakan
   5. Mengatur hari aktif
   6. Menyimpan perubahan ke Laravel / MySQL
   7. Menyimpan state ke SF
   8. Mengirim konfigurasi ke hardware jika terhubung
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

  /* =========================================================
     1. AMBIL DATA AWAL DARI STATE
     ========================================================= */

  let st = SF.all();

  /* =========================================================
     2. AMBIL JADWAL TERBARU DARI DATABASE
     ========================================================= */

  let scheduleId = null;

  try {

    const schedules = await API.getFeedSchedules();
    const schedule = schedules?.[0];

    if (schedule) {

      // Simpan ID jadwal database
      scheduleId = schedule.id;

      const waktu = String(schedule.feeding_time).slice(0, 5);
      const [jam24, menitDb] = waktu.split(':').map(Number);

      /* ---- Konversi 24 jam ke 12 jam ---- */

      let jam12 = jam24 % 12;

      if (jam12 === 0) {
        jam12 = 12;
      }

      const ampmDb = jam24 >= 12 ? 'PM' : 'AM';

      /* ---- Simpan data database ke SF ---- */

      SF.patch({

        pakanJam: jam12,

        pakanMenit: menitDb,

        pakanAmPm: ampmDb,

        pakanTakaran: Number(schedule.feed_amount),

        pakanUlangi: !!schedule.is_active,

        pakanOtomatis: !!schedule.is_active,

        pakanJadwalAktif: waktu,

        pakanHari: Array.isArray(schedule.days)
          ? schedule.days
          : []

      });

      const repeatSwitch = document.querySelector('[data-key="pakanUlangi"]');
      if (repeatSwitch) {
        repeatSwitch.classList.toggle('on', !!schedule.is_active);
        repeatSwitch.setAttribute('aria-checked', !!schedule.is_active);
      }

    }

  } catch (error) {

    console.error(
      'Gagal mengambil jadwal pakan dari database:',
      error
    );

    SF.patch({
      pakanScheduleAvailable: false,
      pakanScheduleActive: false,
      pakanOtomatis: false,
      pakanUlangi: false,
      pakanHari: []
    });

  }

  /* =========================================================
     3. AMBIL STATE TERBARU SETELAH DATABASE DISINKRONKAN
     ========================================================= */

  st = SF.all();

  /* =========================================================
     4. PENGATUR JAM & MENIT
     ========================================================= */

  let jam = st.pakanJam;
  let menit = st.pakanMenit;
  let ampm = st.pakanAmPm;

  const hourEl = document.getElementById('hourValue');
  const minEl = document.getElementById('minuteValue');

  function paint() {

    hourEl.textContent =
      jam.toString().padStart(2, '0');

    minEl.textContent =
      menit.toString().padStart(2, '0');

    document
      .querySelectorAll('.ampm-btn')
      .forEach(button => {

        button.classList.toggle(
          'active',
          button.dataset.ampm === ampm
        );

      });

  }

  paint();

  /* =========================================================
     5. TOMBOL TAMBAH JAM
     ========================================================= */

  document
    .querySelector('[data-role="hour-inc"]')
    .addEventListener('click', () => {

      jam = jam === 12 ? 1 : jam + 1;

      paint();

    });

  /* =========================================================
     6. TOMBOL KURANGI JAM
     ========================================================= */

  document
    .querySelector('[data-role="hour-dec"]')
    .addEventListener('click', () => {

      jam = jam === 1 ? 12 : jam - 1;

      paint();

    });

  /* =========================================================
     7. TOMBOL TAMBAH MENIT
     ========================================================= */

  document
    .querySelector('[data-role="min-inc"]')
    .addEventListener('click', () => {

      menit = (menit + 5) % 60;

      paint();

    });

  /* =========================================================
     8. TOMBOL KURANGI MENIT
     ========================================================= */

  document
    .querySelector('[data-role="min-dec"]')
    .addEventListener('click', () => {

      menit = (menit - 5 + 60) % 60;

      paint();

    });

  /* =========================================================
     9. AM / PM
     ========================================================= */

  document
    .querySelectorAll('.ampm-btn')
    .forEach(button => {

      button.addEventListener('click', () => {

        ampm = button.dataset.ampm;

        paint();

      });

    });

  /* =========================================================
     10. STEPPER TAKARAN PAKAN
     ========================================================= */

  const takaranStepper =
    document.getElementById('takaranStepper');

  initStepper(takaranStepper, {

    min: 100,

    max: 2000,

    step: 50,

    onChange: () => {}

  });

  takaranStepper
    .querySelector('[data-step="value"]')
    .textContent = `${st.pakanTakaran} g`;

  /* =========================================================
     11. PEMILIH HARI
     ========================================================= */

  const pills =
    document.querySelectorAll('.day-pill');

  let selectedDays =
    new Set(st.pakanHari || []);

  pills.forEach(pill => {

    pill.classList.toggle(
      'active',
      selectedDays.has(pill.dataset.day)
    );

    pill.addEventListener('click', () => {

      if (selectedDays.has(pill.dataset.day)) {

        selectedDays.delete(
          pill.dataset.day
        );

      } else {

        selectedDays.add(
          pill.dataset.day
        );

      }

      pill.classList.toggle(
        'active'
      );

    });

  });

  /* =========================================================
     12. TOMBOL SIMPAN
     ========================================================= */

  document
    .getElementById('simpanBtn')
    .addEventListener('click', async () => {

      /* -----------------------------------------------------
         Validasi hari
         ----------------------------------------------------- */

      if (selectedDays.size === 0) {

        showToast(
          'Pilih minimal satu hari'
        );

        return;

      }

      /* -----------------------------------------------------
         Ambil takaran
         ----------------------------------------------------- */

      const takaran = parseInt(

        takaranStepper
          .querySelector('[data-step="value"]')
          .textContent,

        10

      );

      /* -----------------------------------------------------
         Validasi takaran
         ----------------------------------------------------- */

      if (
        Number.isNaN(takaran) ||
        takaran < 100 ||
        takaran > 2000
      ) {

        showToast(
          'Takaran pakan tidak valid'
        );

        return;

      }

      /* =====================================================
         13. KONVERSI 12 JAM → 24 JAM
         ===================================================== */

      let jam24 = jam % 12;

      if (ampm === 'PM') {

        jam24 += 12;

      }

      const jam24Text =
        jam24
          .toString()
          .padStart(2, '0');

      const menitText =
        menit
          .toString()
          .padStart(2, '0');

      const waktuPakan =
        `${jam24Text}:${menitText}`;

      /* =====================================================
         14. STATUS ULANGI
         ===================================================== */

      const ulangiElement =
        document.querySelector(
          '[data-key="pakanUlangi"]'
        );

      const pakanUlangi =
        ulangiElement
          ? ulangiElement.classList.contains('on')
          : true;

      /* =====================================================
         15. DATA UNTUK WEB
         ===================================================== */

      const config = {

        pakanJam: jam,

        pakanMenit: menit,

        pakanAmPm: ampm,

        pakanTakaran: takaran,

        pakanUlangi: pakanUlangi,

        pakanOtomatis: pakanUlangi,

        pakanHari:
          Array.from(selectedDays),

        pakanJadwalAktif:
          waktuPakan,

        pakanLastRunKey: ''

      };

      /* =====================================================
         16. DATA UNTUK LARAVEL / MYSQL
         ===================================================== */

      const databaseData = {

        device_id: 1,

        feeding_time:
          waktuPakan,

        feed_amount:
          takaran,

        is_active:
          pakanUlangi,

        days:
          Array.from(selectedDays)

      };

      /* =====================================================
         17. SIMPAN KE DATABASE
         ===================================================== */

      try {

        let result;

        if (scheduleId !== null) {

          // Jadwal sudah ada → UPDATE
          result =
            await API.updateFeedSchedule(
              scheduleId,
              databaseData
            );

          console.log(
            'Jadwal pakan berhasil diperbarui:',
            result
          );

        } else {

          // Belum ada jadwal → CREATE
          result =
            await API.createFeedSchedule(
              databaseData
            );

          console.log(
            'Jadwal pakan berhasil dibuat:',
            result
          );

          // Simpan ID baru
          if (result?.id) {
            scheduleId = result.id;
          }

        }

        /* ---------------------------------------------------
           Database berhasil.
           Baru setelah itu update state web.
           --------------------------------------------------- */

        SF.patch({
          ...config,
          pakanScheduleAvailable: true,
          pakanScheduleActive: pakanUlangi
        });

        /* ===================================================
           18. KIRIM KE HARDWARE JIKA TERHUBUNG
           =================================================== */

        if (
          typeof HW !== 'undefined' &&
          HW.isConnected()
        ) {

          HW.sendConfiguration({

            device_id:
              SF.get('deviceId'),

            feed_schedule:
              config

          }).catch(error => {

            console.warn(
              'Konfigurasi belum dikirim ke hardware:',
              error
            );

          });

        }

        /* ===================================================
           19. PESAN BERHASIL
           =================================================== */

        showToast(
          'Jadwal pakan berhasil disimpan'
        );

        /* ===================================================
           20. KEMBALI KE HALAMAN PAKAN OTOMATIS
           =================================================== */

        setTimeout(() => {

          window.location.href =
            'pakan-otomatis.html';

        }, 700);

      } catch (error) {

        /* ===================================================
           21. JIKA DATABASE GAGAL
           =================================================== */

        console.error(
          'Gagal menyimpan jadwal pakan:',
          error
        );

        showToast(
          'Gagal menyimpan jadwal ke database'
        );

      }

    });

});