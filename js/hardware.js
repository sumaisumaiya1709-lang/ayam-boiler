/* =========================================================
   SmartFarm IoT — HARDWARE CONNECTION LAYER (HAL)
   ---------------------------------------------------------
   This is the ONLY file that should know how to talk to the
   physical controller (ESP32) + its sensors and actuators.
   Every other script (UI pages, automation.js) calls the
   functions below and never touches "hardware truth" directly.

  Browser <-> ESP32 communication uses a JSON WebSocket protocol.
  The controller should accept: hello, feed, and lamp messages,
  then publish status/sensor/heartbeat messages back to the browser.
   ========================================================= */

const HW = (() => {

  let heartbeatTimer = null;
  let socket = null;
  let connectPromise = null;

  // Memberi tahu halaman lain bahwa status koneksi hardware berubah
  function fireStatus(){
    document.dispatchEvent(new CustomEvent('hw-status-changed'));
  }

  // Fallback watchdog untuk memastikan status lokal tidak stale.
  function startHeartbeat(){
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if(!SF.get('hardwareConnected')){ stopHeartbeat(); return; }
      SF.set('hardwareLastSeen', Date.now());
      document.dispatchEvent(new CustomEvent('hw-heartbeat'));
    }, 4000);
  }
  function stopHeartbeat(){
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  // Mengecek apakah hardware sedang terhubung
  function isConnected(){ return !!SF.get('hardwareConnected'); }

  function send(message){
    if(!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  function applyPacket(packet){
    if(!packet || typeof packet !== 'object') return;
    const type = packet.type || packet.event;
    SF.set('hardwareLastSeen', Date.now());
    document.dispatchEvent(new CustomEvent('hw-message', { detail: packet }));

    if(type === 'rtc' || packet.rtc || packet.rtcIso){
      const rtc = normalizeRtc(packet.rtcIso || packet.rtc || packet);
      if(rtc) SF.patch({ rtcIso: rtc.toISOString(), rtcValid: true });
    }

    if(type === 'sensor' || type === 'status' || type === 'ultrasonic'){
      const patch = {};
      if(packet.light === 'Gelap' || packet.light === 'Terang') patch.kondisiCahaya = packet.light;
      if(typeof packet.feedSensor === 'boolean') patch.sensorPakanAktif = packet.feedSensor;
      if(typeof packet.lightSensor === 'boolean') patch.sensorCahayaAktif = packet.lightSensor;
      if(typeof packet.lampOn === 'boolean') patch.lampuStatus = packet.lampOn;
      const distance = Number(
        packet.distanceCm
        ?? packet.feedDistanceCm
        ?? packet.distance
        ?? packet.hcsr04?.distanceCm
      );
      if(Number.isFinite(distance) && distance >= 0){
        patch.feedDistanceCm = distance;
        patch.feedLevelPercent = distanceToPercent(distance, SF.get('feedEmptyDistanceCm'), SF.get('feedFullDistanceCm'));
        patch.stokPakan = patch.feedLevelPercent;
      }
      if(Object.keys(patch).length) SF.patch(patch);
    }
    document.dispatchEvent(new CustomEvent('sf-tick', { detail: SF.all() }));
  }

  function normalizeRtc(value){
    if(typeof value === 'string' || typeof value === 'number'){
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if(value && typeof value === 'object'){
      const year = Number(value.year ?? value.y);
      const month = Number(value.month ?? value.mo);
      const day = Number(value.day ?? value.d);
      const hour = Number(value.hour ?? value.h ?? 0);
      const minute = Number(value.minute ?? value.min ?? 0);
      const second = Number(value.second ?? value.sec ?? 0);
      if(year && month && day) return new Date(year, month - 1, day, hour, minute, second);
    }
    return null;
  }

  function distanceToPercent(distance, emptyDistance, fullDistance){
    const empty = Number(emptyDistance) || 40;
    const full = Number(fullDistance) || 5;
    const span = empty - full;
    if(span <= 0) return 0;
    return Math.max(0, Math.min(100, Math.round(((empty - distance) / span) * 100)));
  }

  function markConnected(){
    const wasConnected = isConnected();
    SF.patch({
      hardwareConnected: true,
      hardwareLastSeen: Date.now(),
      sensorPakanAktif: true,
      sensorCahayaAktif: true,
    });
    if(!wasConnected){
      SF.addAktivitas({ type:'hardware-on', title:'Hardware berhasil terhubung ke sistem', time: SF.fmtJam() });
      SF.addRiwayat({ icon:'hardware', title:'Hardware Terhubung', time: SF.fmtJam(), date:'Hari ini', mode:'Sistem', status:'Selesai' });
    }
    startHeartbeat();
    fireStatus();
  }

  function connect(url){
    if(isConnected() && socket && socket.readyState === WebSocket.OPEN) return Promise.resolve(true);
    if(connectPromise) return connectPromise;
    const endpoint = (url || SF.get('hardwareWsUrl') || '').trim();
    if(!endpoint) return Promise.reject(new Error('Alamat WebSocket belum diisi.'));
    if(typeof WebSocket === 'undefined') return Promise.reject(new Error('Browser ini tidak mendukung WebSocket.'));

    SF.set('hardwareWsUrl', endpoint);
    document.dispatchEvent(new CustomEvent('hw-connecting'));
    connectPromise = new Promise((resolve, reject) => {
      let settled = false;
      const fail = error => {
        if(settled) return;
        settled = true;
        connectPromise = null;
        socket = null;
        reject(error instanceof Error ? error : new Error('Koneksi WebSocket gagal.'));
      };
      try{
        socket = new WebSocket(endpoint);
        socket.addEventListener('open', () => {
          send({
            type:'hello',
            device:'smartfarm-web',
            version:1,
            sensors:{ clock:'DS3231', feedLevel:'HC-SR04' }
          });
          // ESP32 boleh membalas hello/connected; koneksi juga dianggap siap
          // setelah socket open agar tetap kompatibel dengan firmware sederhana.
          markConnected();
          if(!settled){ settled = true; connectPromise = null; resolve(true); }
        });
        socket.addEventListener('message', event => {
          try{
            const packet = JSON.parse(event.data);
            applyPacket(packet);
            if(packet.type === 'error') document.dispatchEvent(new CustomEvent('hw-error', { detail: packet.message || 'ESP32 mengirim error.' }));
          }catch(e){
            document.dispatchEvent(new CustomEvent('hw-error', { detail:'Pesan ESP32 bukan JSON yang valid.' }));
          }
        });
        socket.addEventListener('close', () => {
          socket = null;
          connectPromise = null;
          if(isConnected()) disconnect('Koneksi WebSocket terputus');
        });
        socket.addEventListener('error', () => fail(new Error('Tidak dapat membuka koneksi ke ESP32.')));
      }catch(error){ fail(error); }
    });
    return connectPromise;
  }

  function disconnect(reason){
    const currentSocket = socket;
    socket = null;
    connectPromise = null;
    if(currentSocket && currentSocket.readyState < WebSocket.CLOSING) currentSocket.close();
    if(!isConnected()) return;
    SF.patch({
      hardwareConnected: false,
      sensorPakanAktif: false,
      sensorCahayaAktif: false,
      rtcValid: false,
      pakanProsesStatus: 'menunggu-hardware',
    });
    SF.addAktivitas({ type:'hardware-off', title: reason || 'Hardware terputus dari sistem', time: SF.fmtJam() });
    SF.addRiwayat({ icon:'hardware', title:'Hardware Terputus', time: SF.fmtJam(), date:'Hari ini', mode:'Sistem', status:'Terputus' });
    stopHeartbeat();
    fireStatus();
  }

  /* The last sensor value comes from the ESP32. A manual override remains
     available for testing when the controller has not published a value. */
  function readLightSensor(){
    const manual = SF.get('sensorCahayaManual');
    if(manual === 'Gelap' || manual === 'Terang') return manual;
    return SF.get('kondisiCahaya');
  }

  function runFeeder(gram){
    if(!isConnected()){
      return Promise.resolve({ ok:false, reason:'not-connected' });
    }
    const sent = send({ type:'feed', grams:Number(gram) });
    return Promise.resolve(sent ? { ok:true } : { ok:false, reason:'socket-not-open' });
  }

  function setLamp(on){
    if(!isConnected()) return { ok:false, reason:'not-connected' };
    return send({ type:'lamp', on:!!on }) ? { ok:true } : { ok:false, reason:'socket-not-open' };
  }

  // Halaman baru mencoba menyambung ulang ke endpoint terakhir yang disimpan.
  if(SF.get('hardwareConnected') && SF.get('hardwareWsUrl')) connect().catch(() => disconnect('Koneksi WebSocket gagal dipulihkan'));

  return { isConnected, connect, disconnect, readLightSensor, runFeeder, setLamp };
})();
