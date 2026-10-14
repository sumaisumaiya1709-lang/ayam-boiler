/* SmartFarm REST adapter for the Laravel API.
 * Local state is a browser cache, never the production source of truth.
 */
const API = (() => {
 const config = {
  baseUrl: 'https://hospitality-biz-montana-machinery.trycloudflare.com',
  enabled: true
  };

  async function request(path, options = {}) {
    if(!config.enabled || !config.baseUrl){
      throw new Error('Laravel API belum dikonfigurasi.');
    }
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type':'application/json', ...(options.headers || {}) },
    });
    if(!response.ok) throw new Error(`API gagal (${response.status}).`);
    return response.status === 204 ? null : response.json();
  }

  function configure(options = {}) {
    if(typeof options.baseUrl === 'string') config.baseUrl = options.baseUrl.replace(/\/$/, '');
    if(typeof options.enabled === 'boolean') config.enabled = options.enabled;
  }

  const json = body => ({ method:'POST', body: JSON.stringify(body) });
  return {
    configure,
    request,
    getDeviceStatus: () => request('/api/devices'),
    getSensorData: () => request('/api/sensor-readings'),
    getFeedSchedules: () => request('/api/feed-schedules'),
    createFeedSchedule: schedule => request('/api/feed-schedules', json(schedule)),
    updateFeedSchedule: (id, schedule) => request(`/api/feed-schedules/${id}`, { ...json(schedule), method:'PUT' }),
    deleteFeedSchedule: id => request(`/api/feed-schedules/${id}`, { method:'DELETE' }),
    getLampSchedules: () => request('/api/lamp-schedules'),
    createLampSchedule: schedule => request('/api/lamp-schedules', json(schedule)),
    updateLampSchedule: (id, schedule) => request(`/api/lamp-schedules/${id}`, { ...json(schedule), method:'PUT' }),
    deleteLampSchedule: id => request(`/api/lamp-schedules/${id}`, { method:'DELETE' }),
    getFeedHistory: () => request('/api/feed-history'),
    getLampHistory: () => request('/api/lamp-history'),
    getActivityLogs: () => request('/api/activity-logs'),
    refillFeed: data => request('/api/feed-refill', json(data)),
  };
})();
