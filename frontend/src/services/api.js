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
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const selectedAccountId = localStorage.getItem('selectedAccountId');
    if (selectedAccountId) {
      config.headers['X-AWS-Account-ID'] = selectedAccountId;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Interceptor for Handling Auth Errors (401)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
