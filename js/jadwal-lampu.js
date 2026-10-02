/* =========================================================
   SmartFarm IoT — Halaman Atur Jadwal Lampu
   Mengatur jam nyala/mati, hari aktif, dan mode
   Otomatis/Manual untuk lampu kandang.
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

  /* =========================================================
     1. AMBIL DATA AWAL DARI STATE
     ========================================================= */

  let st = SF.all();

  /* =========================================================
     2. AMBIL JADWAL TERBARU DARI DATABASE
     ========================================================= */

  try {

    const schedules = await API.getLampSchedules();
    const schedule = schedules?.[0];

    if (schedule) {

      const nyalaDb =
        String(schedule.start_time).slice(0, 5);

      const matiDb =
        String(schedule.end_time).slice(0, 5);

      SF.patch({

        lampuNyala: nyalaDb,

        lampuMati: matiDb,

        lampuMode:
          schedule.auto_mode
            ? 'Otomatis'
            : 'Manual',

        lampuOtomatis:
          !!schedule.auto_mode && !!schedule.is_active,

        lampScheduleAvailable: true,

        lampScheduleActive: !!schedule.is_active,

        lampuHari:
          Array.isArray(schedule.days)
            ? schedule.days
            : []

      });

      const lampSwitch = document.querySelector('[data-key="lampuOtomatis"]');
      if (lampSwitch) {
        const active = !!schedule.auto_mode && !!schedule.is_active;
        lampSwitch.classList.toggle('on', active);
        lampSwitch.setAttribute('aria-checked', active);
      }

    }

  } catch (error) {

    console.error(
      'Gagal mengambil jadwal lampu dari database:',
      error
    );

    SF.patch({
      lampScheduleAvailable: false,
      lampScheduleActive: false,
      lampuOtomatis: false,
      lampuHari: []
    });

  }

  /* =========================================================
     3. AMBIL STATE TERBARU SETELAH DATABASE DISINKRONKAN
     ========================================================= */

  st = SF.all();

  /* =========================================================
     4. DATA JADWAL LAMPU
     ========================================================= */

  let nyala = st.lampuNyala;
  let mati = st.lampuMati;
  let mode = st.lampuMode || 'Otomatis';

  document.getElementById('nyalaVal').textContent = nyala;
  document.getElementById('matiVal').textContent = mati;

  /* =========================================================
     5. PILIHAN MODE
     ========================================================= */

  document.querySelectorAll('.seg-btn').forEach(btn => {

    btn.classList.toggle(
      'active',
      btn.dataset.mode === mode
    );

    btn.addEventListener('click', () => {

      document
        .querySelectorAll('.seg-btn')
        .forEach(b =>
          b.classList.remove('active')
        );

      btn.classList.add('active');

      mode = btn.dataset.mode;

    });

  });

  /* =========================================================
     6. PEMILIH HARI AKTIF
     ========================================================= */

  const pills =
    document.querySelectorAll(
      '#dayPills2 .day-pill'
    );

  let selectedDays =
    new Set(st.lampuHari || []);

  pills.forEach(p => {

    p.classList.toggle(
      'active',
      selectedDays.has(p.dataset.day)
    );

    p.addEventListener('click', () => {

      if (
        selectedDays.has(p.dataset.day)
      ) {

        selectedDays.delete(
          p.dataset.day
        );

      } else {

        selectedDays.add(
          p.dataset.day
        );

      }

      p.classList.toggle(
        'active'
      );

    });

  });

  /* =========================================================
     7. POP-UP UBAH WAKTU
     ========================================================= */

  const editor =
    document.getElementById('timeEditor');

  const editorInput =
    document.getElementById('editorInput');

  const editorLabel =
    document.getElementById('editorLabel');

  let editingTarget = null;

  document
    .querySelectorAll('.ubah-btn')
    .forEach(btn => {

      btn.addEventListener('click', () => {

        editingTarget =
          btn.dataset.target;

        editorLabel.textContent =
          editingTarget === 'nyala'
            ? 'Ubah Waktu Nyala'
            : 'Ubah Waktu Mati';

        editorInput.value =
          editingTarget === 'nyala'
            ? nyala
            : mati;

        editor.hidden = false;

      });

    });

  /* =========================================================
     8. TAMBAH / KURANGI WAKTU
     ========================================================= */

  function bumpTime(val, mins) {

    const [jam, menit] =
      val.split(':').map(Number);

    const totalMenitSehari =
      24 * 60;

    const totalMenitBaru =
      (
        jam * 60 +
        menit +
        mins +
        totalMenitSehari
      ) % totalMenitSehari;

    const jamBaru =
      Math.floor(
        totalMenitBaru / 60
      )
      .toString()
      .padStart(2, '0');

    const menitBaru =
      (
        totalMenitBaru % 60
      )
      .toString()
      .padStart(2, '0');

    return `${jamBaru}:${menitBaru}`;

  }

  document
    .getElementById('editorInc')
    .addEventListener('click', () => {

      editorInput.value =
        bumpTime(
          editorInput.value,
          15
        );

    });

  document
    .getElementById('editorDec')
    .addEventListener('click', () => {

      editorInput.value =
        bumpTime(
          editorInput.value,
          -15
        );

    });

  /* =========================================================
     9. TUTUP EDITOR WAKTU
     ========================================================= */

  document
    .getElementById('editorClose')
    .addEventListener('click', () => {

      if (editingTarget === 'nyala') {

        nyala =
          editorInput.value;

        document
          .getElementById('nyalaVal')
          .textContent = nyala;

      } else {

        mati =
          editorInput.value;

        document
          .getElementById('matiVal')
          .textContent = mati;

      }

      editor.hidden = true;

    });

  editor.addEventListener(
    'click',
    e => {

      if (e.target === editor) {
        editor.hidden = true;
      }

    }
  );

  /* =========================================================
     10. RESET JADWAL
     ========================================================= */

  document
    .getElementById('moreBtn')
    .addEventListener('click', () => {

      if (
        confirm(
          'Reset jadwal lampu ke pengaturan default (18:00–06:00)?'
        )
      ) {

        nyala = '18:00';
        mati = '06:00';

        document
          .getElementById('nyalaVal')
          .textContent = nyala;

        document
          .getElementById('matiVal')
          .textContent = mati;

        showToast(
          'Jadwal direset ke pengaturan default'
        );

      }

    });

  /* =========================================================
     11. SIMPAN
     ========================================================= */

  document
    .getElementById('simpanLampuBtn')
    .addEventListener('click', async () => {

      if (selectedDays.size === 0) {

        showToast(
          'Pilih minimal satu hari aktif'
        );

        return;

      }

      /* =====================================================
         DATA UNTUK WEB
         ===================================================== */

      const config = {

        lampuNyala:
          nyala,

        lampuMati:
          mati,

        lampuHari:
          Array.from(selectedDays),

        lampuMode:
          mode

      };

      /* =====================================================
         DATA UNTUK LARAVEL / MYSQL
         ===================================================== */

      const databaseData = {

        device_id: 1,

        start_time:
          nyala,

        end_time:
          mati,

        auto_mode:
          mode === 'Otomatis',

        is_active:
          true,

        days:
          Array.from(selectedDays)

      };

      /* =====================================================
         SIMPAN KE DATABASE
         ===================================================== */

      try {

        const savedSchedule = await API.createLampSchedule(
          databaseData
        );

        /* Database berhasil,
           baru update state frontend */

        SF.patch({
          ...config,
          lampuOtomatis: !!savedSchedule?.auto_mode && !!savedSchedule?.is_active,
          lampScheduleAvailable: true,
          lampScheduleActive: !!savedSchedule?.is_active
        });

        /* ===================================================
           KIRIM KE HARDWARE JIKA TERHUBUNG
           =================================================== */

        if (
          typeof HW !== 'undefined' &&
          HW.isConnected()
        ) {

          HW.sendConfiguration({

            device_id:
              SF.get('deviceId'),

            lamp_schedule:
              config

          }).catch(error => {

            console.warn(
              'Konfigurasi belum dikirim ke hardware:',
              error
            );

          });

        }

        showToast(
          'Perubahan jadwal lampu disimpan'
        );

        setTimeout(() => {

          window.location.href =
            'lampu-otomatis.html';

        }, 700);

      } catch (error) {

        console.error(
          'Gagal menyimpan jadwal lampu:',
          error
        );

        showToast(
          'Gagal menyimpan jadwal lampu ke database'
        );

      }

    });

});