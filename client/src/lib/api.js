import { getApiBaseUrl } from './runtimeConfig';

const API_URL = getApiBaseUrl();

export async function apiFetch(path, options = {}, token) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });
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
  getMe: (token) => apiFetch('/api/users/me', {}, token),
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
  assignRider: (token, id, payload) =>
    apiFetch(`/api/deliveries/${id}/assign-rider`, { method: 'POST', body: JSON.stringify(payload) }, token),
  startTransit: (token, id) =>
    apiFetch(`/api/deliveries/${id}/start-transit`, { method: 'POST' }, token),
  unlockWithToken: (token, id, tokenCode) =>
    apiFetch(`/api/deliveries/${id}/unlock`, { method: 'POST', body: JSON.stringify({ token: tokenCode }) }, token),
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
};
