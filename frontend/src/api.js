import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE}/auth/token/refresh/`, {
            refresh,
          });
          localStorage.setItem('access_token', data.access);
          if (data.refresh) localStorage.setItem('refresh_token', data.refresh);
          original.headers.Authorization = `Bearer ${data.access}`;
          return api(original);
        } catch {
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  },
);

export const authAPI = {
  login: (data) => axios.post(`${API_BASE}/auth/token/`, data),
  register: (data) => axios.post(`${API_BASE}/auth/register/`, data),
  refresh: (data) => axios.post(`${API_BASE}/auth/token/refresh/`, data),
};

export const servicesAPI = {
  list: () => api.get('/services/'),
  get: (id) => api.get(`/services/${id}/`),
  create: (data) => api.post('/services/', data),
  update: (id, data) => api.put(`/services/${id}/`, data),
  patch: (id, data) => api.patch(`/services/${id}/`, data),
  delete: (id) => api.delete(`/services/${id}/`),
  stats: (id) => api.get(`/services/${id}/stats/`),
  bulkStats: () => api.get('/services/bulk-stats/'),
};

export const validationRulesAPI = {
  list: (params) => api.get('/validation-rules/', { params }),
  create: (data) => api.post('/validation-rules/', data),
  update: (id, data) => api.put(`/validation-rules/${id}/`, data),
  delete: (id) => api.delete(`/validation-rules/${id}/`),
};

export const retryPoliciesAPI = {
  list: (params) => api.get('/retry-policies/', { params }),
  create: (data) => api.post('/retry-policies/', data),
  update: (id, data) => api.put(`/retry-policies/${id}/`, data),
  delete: (id) => api.delete(`/retry-policies/${id}/`),
};

export const pingEndpointsAPI = {
  list: () => api.get('/ping-endpoints/'),
  create: (data) => api.post('/ping-endpoints/', data),
  delete: (id) => api.delete(`/ping-endpoints/${id}/`),
};

export const checkResultsAPI = {
  list: (params) => api.get('/check-results/', { params }),
  get: (id) => api.get(`/check-results/${id}/`),
};

export const incidentsAPI = {
  list: (params) => api.get('/incidents/', { params }),
  get: (id) => api.get(`/incidents/${id}/`),
  patch: (id, data) => api.patch(`/incidents/${id}/`, data),
};

export const reportsAPI = {
  get: (params) => api.get('/reports/', { params }),
};

export const smtpAPI = {
  list: () => api.get('/notifications/smtp-config/'),
  get: (id) => api.get(`/notifications/smtp-config/${id}/`),
  create: (data) => api.post('/notifications/smtp-config/', data),
  update: (id, data) => api.put(`/notifications/smtp-config/${id}/`, data),
  patch: (id, data) => api.patch(`/notifications/smtp-config/${id}/`, data),
  delete: (id) => api.delete(`/notifications/smtp-config/${id}/`),
  test: (id, recipient) =>
    api.post(`/notifications/smtp-config/${id}/test/`, { recipient }),
};

export const policiesAPI = {
  list: (params) => api.get('/notifications/policies/', { params }),
  get: (id) => api.get(`/notifications/policies/${id}/`),
  create: (data) => api.post('/notifications/policies/', data),
  update: (id, data) => api.put(`/notifications/policies/${id}/`, data),
  patch: (id, data) => api.patch(`/notifications/policies/${id}/`, data),
  delete: (id) => api.delete(`/notifications/policies/${id}/`),
};

export const logsAPI = {
  list: (params) => api.get('/notifications/logs/', { params }),
};

export default api;
