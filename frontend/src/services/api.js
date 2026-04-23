import axios from 'axios';

// Default local backend URL, can be overridden by Vercel environment variables
const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? '/api/' : 'http://localhost:5000/api/');

console.log(`[API] Environment: ${import.meta.env.PROD ? 'Production' : 'Local Development'}`);
console.log('[API] Final Backend URL:', API_URL);

const api = axios.create({
    baseURL: API_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to fix URL joining and include the JWT token
api.interceptors.request.use(
    (config) => {
        // Fix: If URL starts with '/', Axios baseURL joining replaces the whole path.
        // Stripping the leading slash makes it relative to the baseURL.
        if (config.url.startsWith('/')) {
            config.url = config.url.substring(1);
        }

        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// --- Token Refresh Logic ---
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

// Add a response interceptor to handle token expiration
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If error is 401 Unauthorized and we haven't already tried to refresh the token
        if (error.response && error.response.status === 401 && !originalRequest._retry) {
            console.warn(`[API] 401 Unauthorized: ${originalRequest.url}. Attempting token refresh...`);

            // Skip refresh attempt if the failed request was a login or a refresh call itself
            if (originalRequest.url.includes('auth/login') || originalRequest.url.includes('auth/refresh')) {
                return Promise.reject(error);
            }

            if (isRefreshing) {
                console.log('[API] Refresh already in progress, queuing request');
                // If a refresh is already in progress, queue this request
                return new Promise(function (resolve, reject) {
                    failedQueue.push({ resolve, reject });
                })
                    .then(token => {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                        return api(originalRequest);
                    })
                    .catch(err => {
                        return Promise.reject(err);
                    });
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Ensure we use the absolute URL for refresh to avoid proxy issues during the refresh itself
                const REFRESH_URL = API_URL.startsWith('http') ? `${API_URL}auth/refresh` : `${window.location.origin}${API_URL}auth/refresh`;
                console.log('[API] Calling refresh endpoint:', REFRESH_URL);

                const response = await axios.post(REFRESH_URL, {}, { withCredentials: true });
                const { token } = response.data;

                console.log('[API] Silent Token Refresh Successful');

                // Save new token
                localStorage.setItem('token', token);

                // Update original request headers and retry
                originalRequest.headers.Authorization = `Bearer ${token}`;
                processQueue(null, token);

                return api(originalRequest);
            } catch (refreshError) {
                console.error('[API] Silent Token Refresh Failed:', refreshError.response?.data?.message || refreshError.message);
                processQueue(refreshError, null);

                // Only redirect if we are not already on the login page
                if (!window.location.pathname.includes('/login')) {
                    console.warn('[API] Redirecting to login due to failed refresh');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    window.location.href = '/login';
                }
                return Promise.reject(refreshError);
            } finally {
                isRefreshing = false;
            }
        }

        if (error.response?.status === 403) {
            console.error('[API] 403 Forbidden - Access Denied:', error.response.data?.message);
        }

        return Promise.reject(error);
    }
);

export default api;
