/* =========================================================
   SmartFarm IoT — AUTOMATION LOGIC (controller rules)
   ---------------------------------------------------------
   Mirrors the loop that would otherwise run on the ESP32 itself:

     cek koneksi hardware -> baca sensor -> tentukan aksi -> jalankan
     -> update data -> simpan riwayat -> kembali menunggu

   This file NEVER touches the DOM of a specific page. It only
   reads/writes shared state (via SF) and calls the hardware layer
   (via HW). Every page listens for the 'sf-tick' event to know
   when to repaint itself with the latest state — that's the only
   contract between this file and the UI.
   ========================================================= */

(function(){
  let feedingInFlight = false; // true selagi motor pakan sedang bekerja (mencegah dobel jalan)
  let lampInFlight = false;
  let lastLampCommand = null;
  let lastLampAttemptAt = 0;
  let schedulesReady = false;

  // Mulai "detak" pengecekan otomasi begitu halaman selesai dimuat,
  // lalu ulangi terus setiap 1 detik selama halaman ini terbuka.
  document.addEventListener('DOMContentLoaded', async () => {
    await syncSchedules();
    runTick();
    setInterval(runTick, 1000);
    setInterval(syncSchedules, 30000);
  });

  async function syncSchedules(){
    try{
      const [feedSchedules, lampSchedules] = await Promise.all([
        API.getFeedSchedules(),
        API.getLampSchedules()
      ]);
      const feed = Array.isArray(feedSchedules)
        ? feedSchedules.find(schedule => Number(schedule.device_id) === 1)
        : null;
      const lamp = Array.isArray(lampSchedules)
        ? lampSchedules.find(schedule => Number(schedule.device_id) === 1)
        : null;
      const feedTime = feed ? String(feed.feeding_time).slice(0, 5) : '';

      SF.patch({
        pakanScheduleAvailable: !!feed,
        pakanScheduleActive: !!feed && !!feed.is_active,
        pakanJadwalAktif: feedTime,
        pakanSlots: feed ? [feedTime] : [],
        pakanTakaran: feed ? Number(feed.feed_amount) : SF.get('pakanTakaran'),
        pakanUlangi: !!feed && !!feed.is_active,
        pakanOtomatis: !!feed && !!feed.is_active,
        pakanHari: Array.isArray(feed?.days) ? feed.days : [],
        lampScheduleAvailable: !!lamp,
        lampScheduleActive: !!lamp && !!lamp.is_active,
        lampuNyala: lamp ? String(lamp.start_time).slice(0, 5) : '',
        lampuMati: lamp ? String(lamp.end_time).slice(0, 5) : '',
        lampuMode: lamp?.auto_mode ? 'Otomatis' : 'Manual',
        lampuOtomatis: !!lamp && !!lamp.auto_mode && !!lamp.is_active,
        lampuHari: Array.isArray(lamp?.days) ? lamp.days : []
      });
      schedulesReady = true;
      broadcastTick();
    }catch(error){
      schedulesReady = false;
      SF.patch({
        pakanScheduleAvailable: false,
        pakanScheduleActive: false,
        pakanOtomatis: false,
        pakanUlangi: false,
        lampScheduleAvailable: false,
        lampScheduleActive: false,
        lampuOtomatis: false
      });
      console.error('Gagal menyinkronkan jadwal otomasi dari Laravel:', error);
    }
  }

  // Satu putaran pengecekan otomasi: cek koneksi -> baca sensor -> putuskan aksi
  function runTick(){
    const st = SF.all();
    const now = SF.now();

    if(!schedulesReady){
      broadcastTick();
      return;
    }

    // Produksi: jadwal seharusnya sudah tersimpan di ESP32. Loop ini hanya
    // fallback prototype selama dashboard terbuka dan dapat dimatikan setelah firmware siap.
    if(!st.browserAutomationFallback) return;

    if(!HW.isConnected()){
      if(st.pakanProsesStatus !== 'menunggu-hardware'){
        SF.set('pakanProsesStatus', 'menunggu-hardware');
      }
      broadcastTick();
      return;
    }

    /* ---- Sensor cahaya: baca kondisi realtime ---- */
    const kondisi = HW.readLightSensor();
    if(kondisi && kondisi !== st.kondisiCahaya){
      SF.set('kondisiCahaya', kondisi);
      SF.addAktivitas({ type:'sensor', title:`Sensor cahaya mendeteksi kondisi ${kondisi.toLowerCase()}`, time: SF.fmtJam(now) });
    }

    /* ---- Lampu: jadwal + sensor cahaya (lihat bagian 8 spesifikasi) ---- */
    evaluateLamp(SF.all(), kondisi, now);

    /* ---- Pakan: jadwal otomatis ---- */
    evaluateFeeder(SF.all(), now);

    /* ---- Notifikasi stok pakan ---- */
    evaluateStock(SF.all());

    broadcastTick();
  }

  // Mengabarkan data terbaru ke semua halaman lewat event "sf-tick"
  function broadcastTick(){
    document.dispatchEvent(new CustomEvent('sf-tick', { detail: SF.all() }));
  }

  // Mengecek apakah jam sekarang (nowHM) berada di antara jam mulai
  // dan jam selesai. Contoh: inWindow('19:00', '18:00', '06:00') -> true
  function inWindow(nowHM, start, end){
    if(start === end) return false;
    if(start < end){
      // jendela waktu normal, contoh 08:00 - 17:00
      return nowHM >= start && nowHM < end;
    }
    // jendela waktu yang melewati tengah malam, contoh 18:00 - 06:00
    return nowHM >= start || nowHM < end;
  }

  function evaluateLamp(st, kondisi, now){
    // Mode Manual pada jadwal lampu berarti pengguna ingin kendali penuh,
    // sistem tidak boleh menimpa keputusan pengguna.
    if(!st.lampuOtomatis || !st.lampScheduleActive || st.lampuMode === 'Manual' || !kondisi) return;

    const nowHM = SF.hhmm(now);
    const crossesMidnight = st.lampuNyala > st.lampuMati;
    const scheduleDate = crossesMidnight && nowHM < st.lampuMati
      ? new Date(now.getTime() - 86400000)
      : now;
    const hariAktif = st.lampuHari.includes(SF.todayAbbr(scheduleDate));
    const dalamJadwal = hariAktif && inWindow(nowHM, st.lampuNyala, st.lampuMati);
    const shouldBeOn = dalamJadwal && kondisi === 'Gelap';

    const retryReady = lastLampCommand !== shouldBeOn || Date.now() - lastLampAttemptAt >= 10000;
    if(shouldBeOn !== !!st.lampuStatus && !lampInFlight && retryReady){
      lampInFlight = true;
      lastLampCommand = shouldBeOn;
      lastLampAttemptAt = Date.now();
      HW.setLamp(shouldBeOn).then(res => {
        lampInFlight = false;
        if(!res.ok) return;
        SF.set('lampuStatus', shouldBeOn);
        SF.addAktivitas({
          type: shouldBeOn ? 'lampu-on' : 'lampu-off',
          title: `Sistem otomatis: lampu ${shouldBeOn ? 'menyala' : 'mati'} (kondisi ${kondisi.toLowerCase()})`,
          time: SF.fmtJam(now)
        });
        SF.addRiwayat({
          icon:'lampu', title:`Lampu ${shouldBeOn ? 'ON' : 'OFF'}`,
          time: SF.fmtJam(now), date:'Hari ini', mode:'Otomatis', status:'Selesai'
        });
        broadcastTick();
      });
    }
  }

  // Mengecek apakah sekarang sudah waktunya memberi pakan otomatis
  function evaluateFeeder(st, now){
    if(!st.pakanScheduleActive || !st.pakanOtomatis || !st.pakanUlangi) return; // jadwal database nonaktif
    if(!st.pakanHari.includes(SF.todayAbbr(now))) return;   // bukan hari yang dipilih
    if(feedingInFlight) return;                             // motor sedang bekerja

    if(SF.hhmm(now) !== st.pakanJadwalAktif) return;        // belum jam jadwal

    // Kunci anti-duplikasi: tanggal + jam jadwal, supaya pakan tidak
    // dijalankan berkali-kali dalam menit yang sama.
    const key = `${SF.dateKey(now)}-${st.pakanJadwalAktif}`;
    if(st.pakanLastRunKey === key) return;

    SF.set('pakanLastRunKey', key);
    triggerFeeding(st.pakanTakaran, 'Otomatis');
  }

  /* Dijadikan fungsi global (window.triggerFeeding) supaya tombol di
     halaman lain, misalnya "Beri Pakan Sekarang", bisa memakai alur
     hardware yang sama persis untuk pemberian pakan manual. */
  window.triggerFeeding = function triggerFeeding(gram, mode){
    if(feedingInFlight) return Promise.resolve({ ok:false, reason:'busy' });
    if(!HW.isConnected()){
      SF.addAktivitas({ type:'warning', title:'Pakan tidak dapat dijalankan: hardware tidak terhubung', time: SF.fmtJam() });
      broadcastTick();
      return Promise.resolve({ ok:false, reason:'not-connected' });
    }

    feedingInFlight = true;
    SF.set('pakanProsesStatus', 'berjalan');
    broadcastTick();

    return HW.runFeeder(gram).then(res => {
      const now = SF.now();
      if(!res.ok){
        SF.set('pakanProsesStatus', 'menunggu-hardware');
        SF.addAktivitas({ type:'warning', title:'Pakan tidak dapat dijalankan: hardware tidak terhubung', time: SF.fmtJam(now) });
        feedingInFlight = false;
        broadcastTick();
        return res;
      }

      const jam = SF.hhmm(now);
      SF.patch({
        pakanProsesStatus: 'berhasil',
        pakanTerakhir: `Hari ini, ${jam}`,
        totalPemberianPakanHariIni: SF.get('totalPemberianPakanHariIni') + 1
      });
      SF.addAktivitas({ type:'pakan', title:`Pakan ${mode.toLowerCase()} berhasil dikeluarkan (${gram} g)`, time: SF.fmtJam(now) });
      SF.addRiwayat({ icon:'pakan', title:'Pakan', time: SF.fmtJam(now), date:'Hari ini', mode, status:'Selesai' });

      const feedList = SF.get('riwayatPakan');
      feedList.unshift({ title:`Hari ini, ${jam} WIB`, desc:`Pakan: ${gram} gram`, status:'Selesai' });
      SF.set('riwayatPakan', feedList);

      broadcastTick();
      setTimeout(() => {
        SF.set('pakanProsesStatus', 'menunggu');
        feedingInFlight = false;
        broadcastTick();
      }, 1800);

      return res;
    });
  };

  // Mengecek apakah stok pakan sudah menipis, lalu mengirim peringatan sekali saja
  function evaluateStock(st){
    const ambang = st.ambangStokPakan || 30;
    if(Number.isFinite(st.stokPakan) && st.stokPakan <= ambang && !st.stokWarned){
      SF.set('stokWarned', true);
      SF.addAktivitas({ type:'warning', title:'Stok pakan hampir habis, silakan lakukan isi ulang', time: SF.fmtJam() });
    } else if(Number.isFinite(st.stokPakan) && st.stokPakan > ambang && st.stokWarned){
      SF.set('stokWarned', false);
    }
  }
})();
