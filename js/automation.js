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

  // Mulai "detak" pengecekan otomasi begitu halaman selesai dimuat,
  // lalu ulangi terus setiap 1 detik selama halaman ini terbuka.
  document.addEventListener('DOMContentLoaded', () => {
    runTick();
    setInterval(runTick, 1000);
  });

  // Satu putaran pengecekan otomasi: cek koneksi -> baca sensor -> putuskan aksi
  function runTick(){
    const st = SF.all();
    const now = SF.now();

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
    if(!st.lampuOtomatis || st.lampuMode === 'Manual' || !kondisi) return;
    if(!st.lampuHari.includes(SF.todayAbbr(now))) return;

    const nowHM = SF.hhmm(now);
    const dalamJadwal = inWindow(nowHM, st.lampuNyala, st.lampuMati);
    const shouldBeOn = dalamJadwal && kondisi === 'Gelap';

    if(shouldBeOn !== !!st.lampuStatus && !lampInFlight){
      lampInFlight = true;
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
    if(!st.pakanOtomatis || !st.pakanUlangi) return;        // fitur nonaktif
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
