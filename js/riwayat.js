/* =========================================================
   SmartFarm IoT — Halaman Riwayat

   Sumber data:
   Laravel API /api/activity-logs

   Filter:
   Semua / Pakan / Lampu / Sistem
   ========================================================= */

document.addEventListener('DOMContentLoaded', async () => {

  const list =
    document.getElementById('riwayatList');

  const empty =
    document.getElementById('emptyState');

  let activeFilter = 'Semua';

  let riwayatData = [];


  /* =========================================================
     ICON SVG
     ========================================================= */

  const iconSvg = {

    pakan: `
      <svg width="18" height="18"
        viewBox="0 0 24 24" fill="none">

        <path
          d="M3 9h18l-1.6 9.6A2 2 0 0 1 17.43 20H6.57a2 2 0 0 1-1.97-1.4L3 9Z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"/>

        <path
          d="M7 9a5 5 0 0 1 10 0"
          stroke="currentColor"
          stroke-width="1.8"/>

      </svg>
    `,


    lampu: `
      <svg width="18" height="18"
        viewBox="0 0 24 24" fill="none">

        <path
          d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.45 1.1 1.24 1.1 2.05V16h5v-.15c0-.81.5-1.6 1.1-2.05A6 6 0 0 0 12 3Z"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linejoin="round"/>

      </svg>
    `,


    hardware: `
      <svg width="18" height="18"
        viewBox="0 0 24 24" fill="none">

        <rect
          x="4" y="4"
          width="16"
          height="16"
          rx="4"
          stroke="currentColor"
          stroke-width="1.7"/>

        <path
          d="M9 4V2M15 4V2M9 22v-2M15 22v-2M4 9H2M4 15H2M22 9h-2M22 15h-2"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"/>

      </svg>
    `

  };


  /* =========================================================
     CLASS ICON
     ========================================================= */

  const iconClass = {

    pakan:
      'ico-green',

    lampu:
      'ico-yellow',

    hardware:
      'ico-plus'

  };


  /* =========================================================
     FILTER
     ========================================================= */

  const filterMap = {

    Pakan:
      'pakan',

    Lampu:
      'lampu',

    Sistem:
      'hardware'

  };


  /* =========================================================
     HELPER WAKTU
     ========================================================= */

  function timeAgo(timestamp) {

    if (!timestamp) {
      return '-';
    }


    const detik =
      Math.round(
        (Date.now() - timestamp) / 1000
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
     FORMAT TANGGAL
     ========================================================= */

  function formatDate(dateString) {

    if (!dateString) {
      return '-';
    }


    const date =
      new Date(dateString);


    if (Number.isNaN(date.getTime())) {
      return '-';
    }


    return date.toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }
    );

  }


  /* =========================================================
     FORMAT JAM
     ========================================================= */

  function formatTime(dateString) {

    if (!dateString) {
      return '-';
    }


    const date =
      new Date(dateString);


    if (Number.isNaN(date.getTime())) {
      return '-';
    }


    return date.toLocaleTimeString(
      'id-ID',
      {
        hour: '2-digit',
        minute: '2-digit'
      }
    );

  }


  /* =========================================================
     MAPPING DATA DATABASE
     ========================================================= */

  function mapRecord(record, icon, timestamp, fallbackTitle) {
    const date = timestamp ? new Date(timestamp) : null;
    const validDate = date && !Number.isNaN(date.getTime());
    const status = record.status || 'success';
    const trigger = [record.trigger_type, record.activity_type, record.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return {
      id: record.id,
      icon,
      title: record.description || fallbackTitle || 'Aktivitas sistem',
      time: validDate ? formatTime(date.toISOString()) : '-',
      relativeTime: validDate ? timeAgo(date.getTime()) : '-',
      date: validDate ? formatDate(date.toISOString()) : '-',
      timestamp: validDate ? date.getTime() : 0,
      mode: trigger.includes('manual') || trigger.includes('pengguna') ? 'Manual' : 'Otomatis',
      status: status === 'success'
        ? 'Berhasil'
        : status === 'failed'
          ? 'Gagal'
          : status
    };
  }

  function mapActivity(log) {
    const activityType = String(log.activity_type || '').toLowerCase();
    const icon = activityType.includes('pakan') || activityType.includes('feed')
      ? 'pakan'
      : activityType.includes('lampu') || activityType.includes('lamp')
        ? 'lampu'
        : 'hardware';
    return mapRecord(log, icon, log.created_at, 'Aktivitas sistem');
  }

  function mapFeedHistory(record) {
    const amount = Number(record.feed_amount);
    const title = Number.isFinite(amount) ? `Pakan ${amount} g` : 'Pakan diberikan';
    return mapRecord(record, 'pakan', record.fed_at, title);
  }

  function mapLampHistory(record) {
    const title = `Lampu ${record.lamp_status ? 'ON' : 'OFF'}`;
    return mapRecord(record, 'lampu', record.changed_at, title);
  }


  /* =========================================================
     AMBIL DATA DARI LARAVEL
     ========================================================= */

  async function loadRiwayat() {

    try {

      const results = await Promise.allSettled([
        API.getFeedHistory(),
        API.getLampHistory(),
        API.getActivityLogs()
      ]);
      const [feeds, lamps, logs] = results.map((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Gagal mengambil sumber riwayat ke-${index + 1}:`, result.reason);
          return [];
        }
        return Array.isArray(result.value) ? result.value : [];
      });

      riwayatData = [
        ...feeds.map(mapFeedHistory),
        ...lamps.map(mapLampHistory),
        ...logs.map(mapActivity)
      ].sort((a, b) => b.timestamp - a.timestamp);


      render(
        activeFilter
      );


    } catch (error) {

      console.error(
        'Gagal mengambil data riwayat:',
        error
      );


      riwayatData = [];


      render(
        activeFilter
      );

    }

  }


  /* =========================================================
     RENDER RIWAYAT
     ========================================================= */

  function render(filter) {

    activeFilter =
      filter;


    const filterIcon =
      filterMap[filter];


    const items =
      riwayatData.filter(
        item =>

          filter === 'Semua' ||
          item.icon === filterIcon
      );


    if (!items.length) {

      list.innerHTML = '';

      empty.style.display =
        'block';

      return;

    }


    empty.style.display =
      'none';


    list.innerHTML =

      items
        .map(item => {

          const icon =
            iconSvg[item.icon] ||
            iconSvg.hardware;


          const iconClassName =
            iconClass[item.icon] ||
            'ico-plus';


          return `

            <li class="riwayat-item">

              <span
                class="control-ico ${iconClassName}">

                ${icon}

              </span>


              <div class="riwayat-main">

                <div class="riwayat-title">

                  <span>
                    ${item.title}
                  </span>

                  <span class="sep">
                    •
                  </span>

                  <span class="time">
                    ${item.relativeTime}
                  </span>

                </div>


                <div class="riwayat-meta">

                  <span class="riwayat-date">

                    ${item.date}
                    ${item.time !== '-'
                      ? ` · ${item.time}`
                      : ''}

                  </span>


                  <span
                    class="mode-pill ${
                      item.mode === 'Otomatis'
                        ? 'mode-otomatis'
                        : 'mode-manual'
                    }">

                    ${item.mode}

                  </span>

                </div>

              </div>


              <span class="riwayat-status">

                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none">

                  <path
                    d="M8 12.5l2.5 2.5L16 9.5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"/>

                  <circle
                    cx="12"
                    cy="12"
                    r="9.2"
                    stroke="currentColor"
                    stroke-width="1.6"/>

                </svg>

                ${item.status}

              </span>

            </li>

          `;

        })
        .join('');

  }


  /* =========================================================
     FILTER TAB
     ========================================================= */

  document
    .querySelectorAll('.filter-tab')
    .forEach(tab => {

      tab.addEventListener(
        'click',
        () => {

          document
            .querySelectorAll('.filter-tab')
            .forEach(t =>
              t.classList.remove(
                'active'
              )
            );


          tab.classList.add(
            'active'
          );


          render(
            tab.dataset.filter
          );

        }
      );

    });


  /* =========================================================
     LOAD AWAL
     ========================================================= */

  await loadRiwayat();


  /* =========================================================
     UPDATE WAKTU OTOMATIS
     ========================================================= */

  document.addEventListener(
    'sf-tick',
    () => {

      render(
        activeFilter
      );

    }
  );

});