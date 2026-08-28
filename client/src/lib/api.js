import { getApiBaseUrl } from './runtimeConfig';

const API_URL = getApiBaseUrl();

function networkError(path) {
  const hosted = typeof window !== 'undefined' && !/localhost|127\.0\.0\.1/i.test(window.location.hostname);
  const error = new Error(
    hosted
      ? 'Cannot reach the API. Wait ~30 seconds if the server is waking up, then retry.'
      : path.startsWith('/api/auth/login')
        ? 'Cannot reach the API server. Start it with: cd server && npm run dev'
        : 'Network error — is the server running on port 3001?',
  );
  error.code = 'NETWORK_ERROR';
  return error;
}

export async function apiFetch(path, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const attempts = typeof window !== 'undefined' && !/localhost|127\.0\.0\.1/i.test(window.location.hostname)
    ? 3
    : 1;
  let res;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        lastError = networkError(path);
        if (attempt < attempts) {
          await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
          continue;
        }
        throw lastError;
      }
      lastError = null;
      break;
    } catch (err) {
      lastError = err.code === 'NETWORK_ERROR' ? err : networkError(path);
      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, 4000 * attempt));
        continue;
      }
      throw lastError;
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.error || 'Request failed');
    error.status = res.status;
    error.code = data.code;
    throw error;
  }

  return data;
}

export const api = {
  login: (payload) =>
    apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  getMe: (token) => apiFetch('/api/users/me', {}, token),
  updateMyProfile: (token, payload) =>
    apiFetch('/api/users/me', { method: 'PATCH', body: JSON.stringify(payload) }, token),
  sendRegisterOtp: (payload) =>
    apiFetch('/api/auth/register/send-otp', { method: 'POST', body: JSON.stringify(payload) }),
  verifyRegister: (payload) =>
    apiFetch('/api/auth/register/verify', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (email) =>
    apiFetch('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPasswordWithOtp: (payload) =>
    apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify(payload) }),
  getUsers: (token) => apiFetch('/api/users', {}, token),
  getPendingUsers: (token) => apiFetch('/api/users/pending', {}, token),
  approveUser: (token, userId, roleId) =>
    apiFetch(`/api/users/${userId}/approve`, { method: 'POST', body: JSON.stringify({ role_id: roleId }) }, token),
  rejectUser: (token, userId) =>
    apiFetch(`/api/users/${userId}/reject`, { method: 'POST' }, token),
  updateUserRole: (token, userId, roleId) =>
    apiFetch(`/api/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role_id: roleId }) }, token),
  updateUser: (token, userId, payload) =>
    apiFetch(`/api/users/${userId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  resetUserPassword: (token, userId, password) =>
    apiFetch(`/api/users/${userId}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }, token),
  deleteUser: (token, userId) =>
    apiFetch(`/api/users/${userId}`, { method: 'DELETE' }, token),
  getRoles: (token) => apiFetch('/api/users/roles', {}, token),
  createUser: (token, payload) =>
    apiFetch('/api/users', { method: 'POST', body: JSON.stringify(payload) }, token),

  getDevices: (token) => apiFetch('/api/devices', {}, token),
  getAllDeviceAccess: (token) => apiFetch('/api/devices/access/list', {}, token),
  getDevice: (token, deviceId) => apiFetch(`/api/devices/${deviceId}`, {}, token),
  createDevice: (token, payload) =>
    apiFetch('/api/devices', { method: 'POST', body: JSON.stringify(payload) }, token),
  updateDevice: (token, deviceId, payload) =>
    apiFetch(`/api/devices/${deviceId}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  unlockDevice: (token, deviceId) => apiFetch(`/api/devices/${deviceId}/unlock`, { method: 'POST' }, token),
  lockDevice: (token, deviceId) => apiFetch(`/api/devices/${deviceId}/lock`, { method: 'POST' }, token),
  toggleAlarm: (token, deviceId, active) =>
    apiFetch(`/api/devices/${deviceId}/alarm`, { method: 'POST', body: JSON.stringify({ active }) }, token),
  grantAccess: (token, deviceId, payload) =>
    apiFetch(`/api/devices/${deviceId}/access`, { method: 'POST', body: JSON.stringify(payload) }, token),
  revokeAccess: (token, deviceId, userId) =>
    apiFetch(`/api/devices/${deviceId}/access/${userId}`, { method: 'DELETE' }, token),

  getAlerts: (token) => apiFetch('/api/alerts', {}, token),
  getDeviceAlerts: (token, deviceId) => apiFetch(`/api/alerts/device/${deviceId}`, {}, token),
  acknowledgeAlert: (token, alertId) =>
    apiFetch(`/api/alerts/${alertId}/acknowledge`, { method: 'POST' }, token),

  getPublicDeliveryConfig: () => apiFetch('/api/deliveries/public/config'),
  estimateDeliveryPublic: (payload) =>
    apiFetch('/api/deliveries/public/estimate', { method: 'POST', body: JSON.stringify(payload) }),

  getDeliveryConfig: (token) => apiFetch('/api/deliveries/config', {}, token),
  estimateDelivery: (token, payload) =>
    apiFetch('/api/deliveries/estimate', { method: 'POST', body: JSON.stringify(payload) }, token),
  getDeliveries: (token) => apiFetch('/api/deliveries', {}, token),
  createDelivery: (token, payload) =>
    apiFetch('/api/deliveries', { method: 'POST', body: JSON.stringify(payload) }, token),
  submitPaymentProof: (token, id, payload) =>
    apiFetch(`/api/deliveries/${id}/payment-proof`, { method: 'POST', body: JSON.stringify(payload) }, token),
  verifyPayment: (token, id) =>
    apiFetch(`/api/deliveries/${id}/verify-payment`, { method: 'POST' }, token),
  rejectPayment: (token, id, payload) =>
    apiFetch(`/api/deliveries/${id}/reject-payment`, { method: 'POST', body: JSON.stringify(payload || {}) }, token),
  cancelDelivery: (token, id, payload) =>
    apiFetch(`/api/deliveries/${id}/cancel`, { method: 'POST', body: JSON.stringify(payload || {}) }, token),
  assignRider: (token, id, payload) =>
    apiFetch(`/api/deliveries/${id}/assign-rider`, { method: 'POST', body: JSON.stringify(payload) }, token),
  sendDeliveryToken: (token, id) =>
    apiFetch(`/api/deliveries/${id}/send-token`, { method: 'POST' }, token),
  requestDeliveryToken: (token, id) =>
    apiFetch(`/api/deliveries/${id}/request-token`, { method: 'POST' }, token),
  startTransit: (token, id) =>
    apiFetch(`/api/deliveries/${id}/start-transit`, { method: 'POST' }, token),
  unlockWithToken: (token, id, tokenCode) =>
    apiFetch(`/api/deliveries/${id}/unlock`, { method: 'POST', body: JSON.stringify({ token: tokenCode }) }, token),
  customerLockDelivery: (token, id) =>
    apiFetch(`/api/deliveries/${id}/customer-lock`, { method: 'POST' }, token),
  completeDelivery: (token, id) =>
    apiFetch(`/api/deliveries/${id}/complete`, { method: 'POST' }, token),
  managerLockDelivery: (token, id) =>
    apiFetch(`/api/deliveries/${id}/manager-lock`, { method: 'POST' }, token),
  managerUnlockDelivery: (token, id) =>
    apiFetch(`/api/deliveries/${id}/manager-unlock`, { method: 'POST' }, token),

  getReviews: (token) => apiFetch('/api/reviews', {}, token),
  submitReview: (token, payload) =>
    apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify(payload) }, token),

  getPublicPromoVideos: (section = 'roles') =>
    apiFetch(`/api/promo-videos/public/${section}`).then((d) => d.videos || []),
  getPromoVideos: (token) => apiFetch('/api/promo-videos', {}, token),
  createPromoVideo: (token, payload) =>
    apiFetch('/api/promo-videos', { method: 'POST', body: JSON.stringify(payload) }, token),
  updatePromoVideo: (token, id, payload) =>
    apiFetch(`/api/promo-videos/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }, token),
  playPromoVideo: (token, id) =>
    apiFetch(`/api/promo-videos/${id}/play`, { method: 'POST' }, token),
  stopPromoVideo: (token, id) =>
    apiFetch(`/api/promo-videos/${id}/stop`, { method: 'POST' }, token),
  stopAllPromoVideos: (token, section = 'roles') =>
    apiFetch('/api/promo-videos/broadcast/stop', { method: 'POST', body: JSON.stringify({ section }) }, token),
  deletePromoVideo: (token, id) =>
    apiFetch(`/api/promo-videos/${id}`, { method: 'DELETE' }, token),
  uploadPromoVideo: async (token, file) => {
    const formData = new FormData();
    formData.append('video', file);
    const res = await fetch(`${API_URL}/api/promo-videos/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  getReportSummary: (token, { from, to } = {}) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return apiFetch(`/api/reports/summary?${q}`, {}, token);
  },
  getActivityHistory: (token, { from, to, limit } = {}) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    if (limit) q.set('limit', String(limit));
    return apiFetch(`/api/reports/history?${q}`, {}, token);
  },
  getGeneratedReports: (token) => apiFetch('/api/reports/generated', {}, token),
  getDeliveryHistory: (token, id) => apiFetch(`/api/reports/delivery/${id}`, {}, token),
};

export async function downloadReportPdf(token, path, { from, to } = {}) {
  const q = new URLSearchParams();
  if (from) q.set('from', from);
  if (to) q.set('to', to);
  const qs = q.toString();
  const url = `${API_URL}/api/reports/pdf/${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'PDF download failed');
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] || `report-${Date.now()}.pdf`;
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(objectUrl);
}
