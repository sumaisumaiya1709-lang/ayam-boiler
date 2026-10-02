/* =========================================================
   SmartFarm IoT — Halaman Monitoring

   Fungsi:
   1. Menampilkan status hardware
   2. Mengambil data sensor dari Laravel / MySQL
   3. Menampilkan stok pakan
   4. Menampilkan kondisi cahaya
   5. Mengambil aktivitas terbaru dari Laravel / MySQL
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

  /* =========================================================
     ELEMENT HALAMAN
     ========================================================= */

  const hwPill =
    document.getElementById('hwPill');

  const hwPillText =
    document.getElementById('hwPillText');

  const hwConnectBtn =
    document.getElementById('hwConnectBtn');

  const hwWarningBanner =
    document.getElementById('hwWarningBanner');

  const hwSensorPakan =
    document.getElementById('hwSensorPakan');

  const hwSensorPakanText =
    document.getElementById('hwSensorPakanText');

  const hwSensorCahaya =
    document.getElementById('hwSensorCahaya');

  const hwSensorCahayaText =
    document.getElementById('hwSensorCahayaText');

  const hwLastSeen =
    document.getElementById('hwLastSeen');

  const stockWarningBanner =
    document.getElementById('stockWarningBanner');

  const activityList =
    document.getElementById('activityList');


  /* =========================================================
     ICON AKTIVITAS
     ========================================================= */

  const icons = {

    pakan: `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M3 9h18l-1.6 9.6A2 2 0 0 1 17.43 20H6.57a2 2 0 0 1-1.97-1.4L3 9Z"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"/>
        <path d="M7 9a5 5 0 0 1 10 0"
          stroke="currentColor"
          stroke-width="1.7"/>
      </svg>
    `,

    'lampu-off': `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.24 1.1 2.05V16h5v-.15c0-.81.5-1.6 1.1-2.05A6 6 0 0 0 12 3Z"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"/>
      </svg>
    `,

    'lampu-on': `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.24 1.1 2.05V16h5v-.15c0-.81.5-1.6 1.1-2.05A6 6 0 0 0 12 3Z"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linejoin="round"/>
      </svg>
    `,

    refill: `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <path d="M12 5v14M5 12h14"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"/>
      </svg>
    `,

    'hardware-on': `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="4"
          stroke="currentColor"
          stroke-width="1.7"/>
      </svg>
    `,

    'hardware-off': `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="4" width="16" height="16" rx="4"
          stroke="currentColor"
          stroke-width="1.7"/>
        <path d="M4 4l16 16"
          stroke="currentColor"
          stroke-width="1.7"/>
      </svg>
    `,

    sensor: `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="4.2"
          stroke="currentColor"
          stroke-width="1.7"/>
        <path d="M12 2.5v2.3M12 19.2v2.3M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.3M19.2 12h2.3M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"/>
      </svg>
    `,

    system: `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8"
          stroke="currentColor"
          stroke-width="1.7"/>
        <path d="M8 12h8M12 8v8"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"/>
      </svg>
    `,

    warning: `
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9"
          stroke="currentColor"
          stroke-width="1.7"/>
        <path d="M12 8v5M12 16v.01"
          stroke="currentColor"
          stroke-width="1.9"
          stroke-linecap="round"/>
      </svg>
    `
  };


  /* =========================================================
     WARNA / CLASS ICON AKTIVITAS
     ========================================================= */

  const iconClass = {

    pakan: 'ico-green',

    'lampu-off': 'ico-yellow',

    'lampu-on': 'ico-yellow',

    refill: 'ico-plus',

    'hardware-on': 'ico-green',

    'hardware-off': 'ico-yellow',

    sensor: 'ico-yellow',

    system: 'ico-green',

    warning: 'ico-yellow'

  };


  /* =========================================================
     HELPER WAKTU
     ========================================================= */

  function timeAgo(ts) {

    if (!ts) {
      return '-';
    }

    const detik =
      Math.round(
        (Date.now() - ts) / 1000
      );

    if (detik < 5) {
      return 'baru saja';
    }

    if (detik < 60) {
      return `${detik} detik lalu`;
    }

    const menit =
      Math.round(detik / 60);

    if (menit < 60) {
      return `${menit} menit lalu`;
    }

    const jam =
      Math.round(menit / 60);

    if (jam < 24) {
      return `${jam} jam lalu`;
    }

    const hari =
      Math.round(jam / 24);

    return `${hari} hari lalu`;
  }


  /* =========================================================
     AMBIL DATA SENSOR DARI LARAVEL
     ========================================================= */

  async function syncSensorFromApi() {

    try {

      const sensors =
        await API.getSensorData();

      const sensor =
        sensors?.[0];

      if (!sensor) {
        SF.patch({
          stokPakan: null,
          sensorTemperature: null,
          sensorHumidity: null,
          sensorApiLightCondition: null
        });
        render(SF.all());
        return;
      }

      const stock = sensor.feed_stock == null ? null : Number(sensor.feed_stock);
      const temperature = sensor.temperature == null ? null : Number(sensor.temperature);
      const humidity = sensor.humidity == null ? null : Number(sensor.humidity);
      const rawLight = String(sensor.light_condition || '').toLowerCase();
      const apiLightCondition = rawLight === 'dark' || rawLight === 'gelap'
        ? 'Gelap'
        : rawLight === 'bright' || rawLight === 'terang'
          ? 'Terang'
          : null;


      SF.patch({

        stokPakan:
          Number.isFinite(stock) ? stock : null,

        sensorApiLightCondition: apiLightCondition,

        sensorTemperature:
          Number.isFinite(temperature) ? temperature : null,

        sensorHumidity:
          Number.isFinite(humidity) ? humidity : null,

        sensorRecordedAt:
          sensor.recorded_at
            ? new Date(
                sensor.recorded_at
              ).getTime()
            : null

      });

      render(SF.all());

    } catch (error) {

      console.error(
        'Gagal mengambil data sensor dari Laravel:',
        error
      );

      SF.patch({
        stokPakan: null,
        sensorTemperature: null,
        sensorHumidity: null,
        sensorApiLightCondition: null
      });
      render(SF.all());

    }
  }


  /* =========================================================
     AMBIL RIWAYAT AKTIVITAS DARI LARAVEL
     ========================================================= */

  async function syncActivityFromApi() {

    try {

      const logs =
        await API.getActivityLogs();


      console.log(
        'Data riwayat dari Laravel:',
        logs
      );


      if (!Array.isArray(logs)) {

        console.warn(
          'Data activity-logs bukan array.'
        );

        SF.patch({
          aktivitas: []
        });

        return;
      }


      const aktivitas =
        logs.map(log => {

          let type =
            String(
              log.activity_type || 'system'
            ).toLowerCase();


          /*
           * Pastikan tipe aktivitas
           * yang tidak dikenal tetap
           * menggunakan icon system.
           */

          const tipeYangDidukung = [
            'pakan',
            'lampu-off',
            'lampu-on',
            'refill',
            'hardware-on',
            'hardware-off',
            'sensor',
            'system',
            'warning'
          ];


          if (
            !tipeYangDidukung.includes(type)
          ) {

            type = 'system';

          }


          return {

            type: type,

            title:
              log.description ||
              'Aktivitas sistem',

            time:
              log.created_at
                ? timeAgo(
                    new Date(
                      log.created_at
                    ).getTime()
                  )
                : '-'

          };

        });


      /*
       * Simpan hasil API
       * ke SmartFarm state.
       */

      SF.patch({
        aktivitas: aktivitas
      });


      console.log(
        'Riwayat berhasil dimasukkan ke SF:',
        SF.get('aktivitas')
      );


    } catch (error) {

      console.error(
        'Gagal mengambil riwayat aktivitas dari Laravel:',
        error
      );

    }
  }


  /* =========================================================
     RENDER HALAMAN
     ========================================================= */

  function render(st) {

    const connected =
      st.hardwareStatus === 'ONLINE';

    document.getElementById('temperatureValue').textContent =
      Number.isFinite(st.sensorTemperature)
        ? `${st.sensorTemperature} °C`
        : '--';

    document.getElementById('humidityValue').textContent =
      Number.isFinite(st.sensorHumidity)
        ? `${st.sensorHumidity}%`
        : '--';


    /* =====================================================
       HARDWARE
       ===================================================== */

    hwPill.classList.toggle(
      'on',
      connected
    );

    hwPill.classList.toggle(
      'off',
      !connected
    );

    hwPillText.textContent =
      connected
        ? 'Terhubung'
        : 'Tidak Terhubung';

    hwConnectBtn.hidden =
      connected;

    hwWarningBanner.hidden =
      connected;


    /* =====================================================
       SENSOR PAKAN
       ===================================================== */

    const feedSensorReady =
      connected &&
      st.sensorPakanAktif &&
      Number.isFinite(
        st.feedLevelPercent
      );

    hwSensorPakan.classList.toggle(
      'on',
      feedSensorReady
    );

    hwSensorPakan.classList.toggle(
      'off',
      !feedSensorReady
    );

    hwSensorPakanText.textContent =
      feedSensorReady
        ? `${st.feedLevelPercent}%`
        : connected
          ? 'Menunggu Data'
          : 'Tidak Aktif';


    /* =====================================================
       SENSOR CAHAYA
       ===================================================== */

    const hardwareLightReady =
      connected && st.sensorCahayaAktif && !!st.kondisiCahaya;
    const databaseLightReady = !!st.sensorApiLightCondition;

    hwSensorCahaya.classList.toggle(
      'on',
      hardwareLightReady || databaseLightReady
    );

    hwSensorCahaya.classList.toggle(
      'off',
      !hardwareLightReady && !databaseLightReady
    );

    hwSensorCahayaText.textContent =
      hardwareLightReady
        ? `${st.kondisiCahaya} (ESP32)`
        : databaseLightReady
          ? `${st.sensorApiLightCondition} (API)`
        : connected
          ? 'Menunggu Data'
          : 'Tidak Aktif';


    /* =====================================================
       HARDWARE TERAKHIR
       ===================================================== */

    hwLastSeen.textContent =
      connected

        ? `RTC DS3231: ${
            st.rtcValid
              ? SF.fmtJam(SF.now())
              : 'menunggu data'
          } · masuk ${timeAgo(
            st.hardwareLastSeen
          )}`

        : 'RTC DS3231: tidak terhubung';


    /* =====================================================
       STATUS OTOMATIS
       ===================================================== */

    const pakanDot =
      document.getElementById(
        'pakanDot'
      );

    const lampuDot =
      document.getElementById(
        'lampuDot'
      );


    if (pakanDot) {

      pakanDot.classList.toggle(
        'off',
        !connected
      );

    }


    if (lampuDot) {

      lampuDot.classList.toggle(
        'off',
        !connected
      );

    }


    const pakanTextMap = {

      menunggu:
        'Menunggu Jadwal',

      berjalan:
        'Menjalankan Pakan...',

      berhasil:
        'Pakan Berhasil',

      'menunggu-hardware':
        'Menunggu Hardware'

    };


    const pakanConnText =
      document.getElementById(
        'pakanConnText'
      );


    if (pakanConnText) {

      pakanConnText.textContent =
        st.pakanOtomatis

          ? (
              pakanTextMap[
                st.pakanProsesStatus
              ] ||
              'Menunggu Jadwal'
            )

          : 'Nonaktif';

    }


    const lampuConnText =
      document.getElementById(
        'lampuConnText'
      );


    if (lampuConnText) {

      lampuConnText.textContent =

        !connected

          ? 'Tidak Terhubung'

          : (
              st.lampuStatus
                ? 'Menyala'
                : 'Mati'
            );

    }


    /* =====================================================
       JADWAL
       ===================================================== */

    const jadwalPakan =
      document.getElementById(
        'jadwalPakanBerikutnya'
      );

    if (jadwalPakan) {

      jadwalPakan.textContent =
        st.pakanScheduleAvailable
          ? `${st.pakanJadwalAktif} WIB`
          : '--';

    }


    const jadwalLampu =
      document.getElementById(
        'jadwalLampuMon'
      );

    if (jadwalLampu) {

      jadwalLampu.textContent =
        st.lampScheduleAvailable
          ? `${st.lampuNyala}–${st.lampuMati}`
          : '--';

    }


    /* =====================================================
       STOK PAKAN
       ===================================================== */

    const stok =
      Number(st.stokPakan);

    const ring =
      document.getElementById(
        'stokRing'
      );

    const jariJari =
      42;

    const kelilingLingkaran =
      2 *
      Math.PI *
      jariJari;


    if (ring) {

      ring.style.strokeDasharray =
        `${kelilingLingkaran}`;

      const stockReady =
        Number.isFinite(stok);

      const bagianKosong =
        stockReady

          ? kelilingLingkaran -
            (stok / 100) *
            kelilingLingkaran

          : kelilingLingkaran;


      ring.style.strokeDashoffset =
        bagianKosong;


      ring.setAttribute(
        'stroke',

        stockReady &&
        stok <= st.ambangStokPakan

          ? '#D64545'

          : '#2E8B57'
      );

    }


    const stokValue =
      document.getElementById(
        'stokValue'
      );


    const stockReady =
      Number.isFinite(stok);


    if (stokValue) {

      stokValue.textContent =
        stockReady
          ? `${stok}%`
          : '--';

    }


    const days =
      stockReady

        ? Math.max(
            1,
            Math.round(
              stok / 25
            )
          )

        : null;


    const stokDesc =
      document.getElementById(
        'stokDesc'
      );


    if (stokDesc) {

      stokDesc.textContent =

        !stockReady

          ? (
              connected
                ? 'Menunggu data sensor'
                : 'Hubungkan perangkat untuk melihat ketersediaan pakan'
            )

          : (

              stok <= st.ambangStokPakan

                ? 'Stok menipis, segera isi ulang pakan'

                : `Sisa pakan mencukupi untuk ${days} hari ke depan`

            );

    }


    if (stockWarningBanner) {

      stockWarningBanner.hidden =
        !stockReady ||
        stok > st.ambangStokPakan;

    }


    /* =====================================================
       RIWAYAT AKTIVITAS
       ===================================================== */

    if (!activityList) {

      console.warn(
        'Element #activityList tidak ditemukan.'
      );

      return;

    }


    const aktivitas =
      Array.isArray(st.aktivitas)
        ? st.aktivitas
        : [];


    /*
     * Jika ada data dari database,
     * tampilkan maksimal 12 aktivitas.
     */

    if (aktivitas.length > 0) {

      activityList.innerHTML =
        aktivitas
          .slice(0, 12)
          .map(a => {

            const type =
              a.type || 'system';


            const icon =
              icons[type] ||
              icons.system;


            const kelasIcon =
              iconClass[type] ||
              'ico-green';


            const title =
              a.title ||
              'Aktivitas sistem';


            const time =
              a.time ||
              '-';


            return `

              <li class="activity-item">

                <span class="control-ico ${kelasIcon}">

                  ${icon}

                </span>

                <div class="activity-text">

                  <strong>
                    ${title}
                  </strong>

                  <span>
                    ${time}
                  </span>

                </div>

              </li>

            `;

          })
          .join('');

    } else {

      activityList.innerHTML = `

        <li class="muted">
          Belum ada aktivitas.
        </li>

      `;

    }

  }


  /* =========================================================
     SINKRONISASI PERTAMA
     ========================================================= */

  await syncSensorFromApi();

  await syncActivityFromApi();
  setInterval(syncSensorFromApi, 15000);
  setInterval(syncActivityFromApi, 30000);


  /*
   * Setelah sensor dan riwayat
   * selesai diambil dari Laravel,
   * baru render halaman.
   */

  render(
    SF.all()
  );


  /* =========================================================
     UPDATE OTOMATIS SMARTFARM
     ========================================================= */

  document.addEventListener(
    'sf-tick',
    e => {

      render(
        e.detail
      );

    }
  );


  /* =========================================================
     STATUS HARDWARE BERUBAH
     ========================================================= */

  document.addEventListener(
    'hw-status-changed',
    () => {

      render(
        SF.all()
      );

    }
  );


  /* =========================================================
     TOMBOL HUBUNGKAN HARDWARE
     ========================================================= */

  if (hwConnectBtn) {

    hwConnectBtn.addEventListener(
      'click',
      () => {

        hwConnectBtn.disabled =
          true;

        hwConnectBtn.textContent =
          'Menghubungkan...';


        hwPill.classList.remove(
          'off'
        );

        hwPill.classList.add(
          'connecting'
        );


        hwPillText.textContent =
          'Menghubungkan...';


        HW.connect()

          .then(() => {

            hwConnectBtn.disabled =
              false;

            hwConnectBtn.textContent =
              'Coba Hubungkan Lagi';


            hwPill.classList.remove(
              'connecting'
            );


            showToast(
              'Hardware berhasil terhubung'
            );


            render(
              SF.all()
            );

          })

          .catch(() => {

            hwConnectBtn.disabled =
              false;

            hwConnectBtn.textContent =
              'Coba Hubungkan Lagi';


            hwPill.classList.remove(
              'connecting'
            );


            render(
              SF.all()
            );


            showToast(
              'Hardware belum terhubung'
            );

          });

      }
    );

  }

});