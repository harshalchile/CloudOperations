import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Interceptor for JWT Authorization & Active AWS Account Headers
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('authToken');
    if (token && token !== 'null' && token !== 'undefined' && token.trim() !== '') {
      config.headers.Authorization = `Bearer ${token.trim()}`;
    }
    const selectedAccountId = localStorage.getItem('selectedAccountId');
    if (selectedAccountId && selectedAccountId !== 'null' && selectedAccountId !== 'undefined') {
      config.headers['X-AWS-Account-ID'] = selectedAccountId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for Handling Auth Errors (401 Unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Clear all session & cache keys on 401 Unauthorized
      const sessionKeys = [
        'access_token',
        'authToken',
        'user',
        'cached_user',
        'selectedAccountId',
        'aws_accounts',
        'active_account',
        'dashboard_cache',
        'refresh_token'
      ];
      sessionKeys.forEach((key) => {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
      });

      // Dispatch global unauthorized event for AuthContext to sync state
      window.dispatchEvent(new CustomEvent('auth-unauthorized'));
    }
    return Promise.reject(error);
  }
);

export default api;
