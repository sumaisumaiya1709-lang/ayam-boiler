document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('connectionForm');
  const urlInput = document.getElementById('wsUrl');
  const connectButton = document.getElementById('connectButton');
  const disconnectButton = document.getElementById('disconnectButton');
  const statusText = document.getElementById('connectionStatus');
  const pill = document.getElementById('connectionPill');
  const pillText = document.getElementById('connectionPillText');
  const log = document.getElementById('packetLog');
  const packetCount = document.getElementById('packetCount');
  let count = 0;

  urlInput.value = SF.get('hardwareWsUrl') || '';

  function addLog(message){
    const empty = log.querySelector('.packet-empty');
    if(empty) empty.remove();
    const item = document.createElement('li');
    const label = document.createElement('span');
    const time = document.createElement('span');
    label.textContent = message;
    time.textContent = SF.fmtJam();
    item.append(label, time);
    log.prepend(item);
    while(log.children.length > 8) log.lastElementChild.remove();
    count += 1;
    packetCount.textContent = `${count} pesan`;
  }

  function render(st, connecting = false){
    const connected = st.hardwareStatus === 'ONLINE';
    statusText.textContent = connecting ? 'Menghubungkan...' : (connected ? 'ESP32 terhubung' : 'Tidak terhubung');
    pill.classList.toggle('on', connected && !connecting);
    pill.classList.toggle('off', !connected && !connecting);
    pill.classList.toggle('connecting', connecting);
    pillText.textContent = connecting ? 'Menghubungkan' : (connected ? 'Online' : 'Offline');
    connectButton.hidden = connected && !connecting;
    disconnectButton.hidden = !connected && !connecting;
    connectButton.disabled = connecting;
    connectButton.innerHTML = connecting
      ? 'Menghubungkan...'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M8 12h8M13 7l5 5-5 5M5 5v14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg> Hubungkan ke ESP32';
  }

  render(SF.all());
  document.addEventListener('hw-connecting', () => render(SF.all(), true));
  document.addEventListener('hw-status-changed', () => render(SF.all()));
  document.addEventListener('hw-heartbeat', () => render(SF.all()));
  document.addEventListener('hw-message', event => addLog(`Diterima: ${event.detail.type || 'paket ESP32'}`));
  document.addEventListener('hw-error', event => addLog(`Error: ${event.detail}`));

  form.addEventListener('submit', event => {
    event.preventDefault();
    const endpoint = urlInput.value.trim();
    if(!endpoint){ urlInput.focus(); return; }
    addLog(`Mencoba koneksi ke ${endpoint}`);
    render(SF.all(), true);
    HW.connect(endpoint).then(() => {
      addLog('WebSocket terbuka, menunggu heartbeat ESP32');
      render(SF.all());
      showToast('Menunggu heartbeat ESP32');
    }).catch(error => {
      SF.patch({ hardwareConnected:false, sensorPakanAktif:false, sensorCahayaAktif:false });
      render(SF.all());
      addLog(error.message);
      showToast('Koneksi ESP32 gagal');
    });
  });

  disconnectButton.addEventListener('click', () => {
    HW.disconnect('Koneksi diputuskan dari halaman penaut');
    addLog('Koneksi WebSocket diputuskan');
    render(SF.all());
  });
});
