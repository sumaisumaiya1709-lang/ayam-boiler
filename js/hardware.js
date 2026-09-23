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

  let socket = null;
  let connectPromise = null;
  const pending = new Map();
  const ACK_TIMEOUT = 10000;
  const HEARTBEAT_TIMEOUT = 15000;

  // Memberi tahu halaman lain bahwa status koneksi hardware berubah
  function fireStatus(){
    document.dispatchEvent(new CustomEvent('hw-status-changed'));
  }

  // Socket terbuka bukan bukti hardware hidup; command tetap menunggu ACK ESP32.
  function isConnected(){ return !!SF.get('hardwareConnected') && SF.get('hardwareStatus') === 'ONLINE'; }

  function send(message){
    if(!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  // Watchdog hanya menilai freshness heartbeat; tidak pernah mengubah last_seen.
  setInterval(() => {
    const lastSeen = SF.get('hardwareLastSeen');
    if(!lastSeen || Date.now() - lastSeen > HEARTBEAT_TIMEOUT){
      if(SF.get('hardwareStatus') === 'ONLINE'){
        SF.patch({ hardwareStatus:'OFFLINE', sensorPakanAktif:false, sensorCahayaAktif:false, feedDistanceCm:null, feedLevelPercent:null, stokPakan:null, kondisiCahaya:null });
        fireStatus();
      }
    }
  }, 5000);

  function applyPacket(packet){
    if(!packet || typeof packet !== 'object') return;
    const type = packet.type || packet.event;
    if(packet.request_id && pending.has(packet.request_id)){
      const command = pending.get(packet.request_id);
      pending.delete(packet.request_id);
      clearTimeout(command.timer);
      command.resolve({ ok: packet.status === 'success', ...packet });
    }
    if(type === 'heartbeat' || type === 'sensor_data' || type === 'sensor' || type === 'status' || type === 'ultrasonic'){
      SF.patch({ hardwareLastSeen: packet.timestamp ? new Date(packet.timestamp).getTime() : Date.now(), hardwareStatus:'ONLINE', hardwareConnected:true });
      document.dispatchEvent(new CustomEvent('hw-heartbeat'));
    }
    document.dispatchEvent(new CustomEvent('hw-message', { detail: packet }));

    if(type === 'rtc' || packet.rtc || packet.rtcIso){
      const rtc = normalizeRtc(packet.rtcIso || packet.rtc || packet);
      if(rtc) SF.patch({ rtcIso: rtc.toISOString(), rtcValid: true });
    }

    if(type === 'sensor_data' || type === 'sensor' || type === 'status' || type === 'ultrasonic'){
      const patch = {};
      const light = packet.light_condition || packet.light;
      const validLight = light === 'Gelap' || light === 'Terang' || light === 'dark' || light === 'bright';
      if(validLight){
        patch.kondisiCahaya = (light === 'dark' ? 'Gelap' : light === 'bright' ? 'Terang' : light);
        patch.sensorCahayaAktif = true;
      }
      if(typeof packet.lamp_status === 'boolean') patch.lampuStatus = packet.lamp_status;
      if(typeof packet.lampOn === 'boolean') patch.lampuStatus = packet.lampOn;
      const distance = Number(
        packet.distanceCm
        ?? packet.distance_cm
        ?? packet.feedDistanceCm
        ?? packet.distance
        ?? packet.hcsr04?.distanceCm
      );
      if(Number.isFinite(distance) && distance >= 0){
        patch.feedDistanceCm = distance;
        patch.feedLevelPercent = distanceToPercent(distance, SF.get('feedEmptyDistanceCm'), SF.get('feedFullDistanceCm'));
        patch.stokPakan = patch.feedLevelPercent;
        patch.sensorPakanAktif = true;
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

  function markSocketReady(){
    SF.patch({
      hardwareConnected: true,
      hardwareStatus: 'UNKNOWN',
      sensorPakanAktif: false,
      sensorCahayaAktif: false,
    });
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
          // Socket hanya siap untuk menunggu heartbeat; status ONLINE ditetapkan
          // setelah ESP32 benar-benar mengirim heartbeat atau data sensor.
          markSocketReady();
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
          disconnect('Koneksi WebSocket terputus');
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
    pending.forEach(command => { clearTimeout(command.timer); command.resolve({ ok:false, reason:'disconnected' }); });
    pending.clear();
    if(!SF.get('hardwareConnected')) return;
    SF.patch({
      hardwareConnected: false,
      hardwareStatus: 'OFFLINE',
      sensorPakanAktif: false,
      sensorCahayaAktif: false,
      feedDistanceCm: null,
      feedLevelPercent: null,
      stokPakan: null,
      kondisiCahaya: null,
      rtcValid: false,
      pakanProsesStatus: 'menunggu-hardware',
    });
    SF.addAktivitas({ type:'hardware-off', title: reason || 'Hardware terputus dari sistem', time: SF.fmtJam() });
    SF.addRiwayat({ icon:'hardware', title:'Hardware Terputus', time: SF.fmtJam(), date:'Hari ini', mode:'Sistem', status:'Terputus' });
    fireStatus();
  }

  /* The light value comes only from the ESP32 sensor packet. */
  function readLightSensor(){
    return SF.get('kondisiCahaya');
  }

  function command(type, payload){
    if(!isConnected()) return Promise.resolve({ ok:false, reason:'not-connected' });
    const request_id = `${SF.get('deviceId')}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    return new Promise(resolve => {
      const timer = setTimeout(() => { pending.delete(request_id); resolve({ ok:false, reason:'ack-timeout', request_id }); }, ACK_TIMEOUT);
      pending.set(request_id, { resolve, timer });
      if(!send({ type, request_id, ...payload })){
        clearTimeout(timer); pending.delete(request_id); resolve({ ok:false, reason:'socket-not-open', request_id });
      }
    });
  }

  function runFeeder(gram){ return command('feed', { grams:Number(gram) }); }
  function setLamp(on){ return command('lamp', { on:!!on }); }
  function sendConfiguration(config){ return command('configuration', { config }); }

  // Halaman baru mencoba menyambung ulang ke endpoint terakhir yang disimpan.
  if(SF.get('hardwareConnected') && SF.get('hardwareWsUrl')) connect().catch(() => disconnect('Koneksi WebSocket gagal dipulihkan'));

  return { isConnected, connect, disconnect, readLightSensor, runFeeder, setLamp, sendConfiguration };
})();
