import axios from 'axios';

// Create axios instance with base configuration
const baseURL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
console.log('API Base URL:', baseURL);

/** Full backend URL for browser redirects (e.g. Google OAuth). */
export const getGoogleAuthUrl = () => `${baseURL}/auth/google`;

const api = axios.create({
    baseURL,
    timeout: 30000,
    withCredentials: true, // Send cookies automatically
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add JWT token to all requests
api.interceptors.request.use(
    async (config) => {
        // Fetch token from Clerk
        if (window.Clerk && window.Clerk.session) {
            try {
                const token = await window.Clerk.session.getToken();
                if (token) {
                    config.headers.Authorization = `Bearer ${token}`;
                }
            } catch (e) {
                console.error("Failed to get Clerk token", e);
            }
        }

        // Add merchant_id to all requests for multi-tenancy
        const merchantId = localStorage.getItem('merchant_id');
        if (merchantId) {
            config.headers['X-Merchant-ID'] = merchantId;
        }

        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Handle 401 Unauthorized - Token expired or invalid
        if (error.response?.status === 401 && !originalRequest._retry) {
            console.warn('[AUTH] Token expired, attempting to refresh...');
            originalRequest._retry = true;

            // Try to get a fresh token from Clerk
            if (window.Clerk && window.Clerk.session) {
                try {
                    const newToken = await window.Clerk.session.getToken({ skipCache: true });
                    if (newToken) {
                        console.log('[AUTH] Token refreshed successfully. Retrying request.');
                        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                        originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
                        return api(originalRequest);
                    }
                } catch (retryErr) {
                    console.error('[AUTH] Token refresh failed', retryErr);
                }
            }

            // If refresh fails or no Clerk session, redirect to login
            console.error('[AUTH] Force logout due to expired session');
            localStorage.clear();
            window.location.href = '/login';
            return Promise.reject(error);
        }

        // Handle 403 Forbidden - Subscription expired or limits reached
        if (error.response?.status === 403) {
            // We NO LONGER redirect to /subscription-expired globally to avoid blocking the app
            return Promise.reject(error);
        }

        // Handle 429 Too Many Requests - Rate limiting
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'] || 5;
            await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
            return api(originalRequest);
        }

        // Handle network errors
        if (!error.response) {
            console.error('Network error:', error.message);
        }

        return Promise.reject(error);
    }
);

// API Endpoints

// Authentication
export const authAPI = {
    login: (identifier, password, rememberMe = false) => api.post('/auth/login', { identifier, password, rememberMe }),
    verifyOTP: (sessionId, code, rememberMe = false) => api.post('/auth/verify-otp', { sessionId, code, rememberMe }),
    resendOTP: (sessionId) => api.post('/auth/resend-otp', { sessionId }),
    /** Redirect to backend Google OAuth (use window.location.href = getGoogleAuthUrl()). */
    getGoogleAuthUrl,
    register: (data) => api.post('/auth/register', data),
    logout: () => api.post('/auth/logout'),
    endAllSessions: () => api.post('/auth/end-all-sessions'),
    refreshToken: () => api.post('/auth/refresh'),
    forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
    resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

// Dashboard
export const dashboardAPI = {
    getMetrics: () => api.get('/dashboard/metrics'),
    getRecentActivity: () => api.get('/dashboard/recent-activity'),
    getChartData: (period) => api.get(`/dashboard/chart-data?period=${period}`),
};

// Settings
export const settingsAPI = {
    getProfile: () => api.get('/settings/profile'),
    updateProfile: (data) => api.patch('/settings/profile', data),
    changePassword: (currentPassword, newPassword) =>
        api.post('/settings/change-password', { currentPassword, newPassword }),
    updateWhatsApp: (phoneId, accessToken) =>
        api.post('/settings/whatsapp', { phoneId, accessToken }),
    getAPIKey: () => api.get('/settings/api-key'),
    regenerateAPIKey: () => api.post('/settings/api-key/regenerate'),
};

// Utility functions
export const uploadFile = async (file, type = 'receipt') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);

    return api.post('/upload', formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
            const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            console.log(`Upload progress: ${percentCompleted}%`);
        },
    });
};

export const downloadFile = async (url, filename) => {
    try {
        const response = await api.get(url, { responseType: 'blob' });
        const blob = new Blob([response.data]);
        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        link.click();
        window.URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Download failed:', error);
        throw error;
    }
};

// Loans API
export const loansAPI = {
    getAll: (params) => api.get('/loans', { params }),
    getById: (id) => api.get(`/loans/${id}`),
    create: (data) => api.post('/loans', data),
    update: (id, data) => api.patch(`/loans/${id}`, data),
    updateStatus: (id, status) => api.patch(`/loans/${id}/status`, { status }),
    delete: (id) => api.delete(`/loans/${id}`),
    /** Upload CSV or XLSX file (multipart/form-data, field name: file). */
    upload: (formData) => api.post('/loans/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
    export: async (filters) => {
        const response = await api.get('/reports/export', {
            params: filters,
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `loans-report-${Date.now()}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
    }
};

// Customers API
export const customersAPI = {
    getAll: (params) => api.get('/customers', { params }),
    getById: (id) => api.get(`/customers/${id}`),
    create: (data) => api.post('/customers', data),
    update: (id, data) => api.patch(`/customers/${id}`, data),
    delete: (id) => api.delete(`/customers/${id}`)
};

// Reports API
export const reportsAPI = {
    getDashboard: () => api.get('/reports/dashboard'),
    getAnalytics: () => api.get('/reports/analytics'),
    getAIAnalysis: () => api.get('/reports/ai-analysis'),
    exportReport: (filters) => api.get('/reports/export', { params: filters, responseType: 'blob' })
};

// Subscription API
export const subscriptionAPI = {
    createCheckoutSession: (planId) => api.post('/subscription/create-checkout', { planId }),
    getStatus: () => api.get('/subscription/status')
};

// Employees API
export const employeesAPI = {
    getAll: () => api.get('/employees'),
    create: (data) => api.post('/employees', data),
    update: (id, data) => api.patch(`/employees/${id}`, data),
    delete: (id) => api.delete(`/employees/${id}`)
};

export default api;

