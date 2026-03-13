import axios from 'axios';

const API_CACHE_PREFIX = 'api-cache:';
const API_CACHE_TTL_MS = 1000 * 120;
const memoryCache = new Map<string, { data: any; savedAt: number }>();

const getMerchantCacheTag = () => {
    if (typeof window === 'undefined') return 'server';
    try {
        return localStorage.getItem('merchant_id') || 'unknown';
    } catch {
        return 'unknown';
    }
};

const buildCacheKey = (url: string, params?: any) => {
    const tag = getMerchantCacheTag();
    const query = params ? JSON.stringify(params) : '';
    return `${API_CACHE_PREFIX}${tag}::${url}?${query}`;
};

const readCached = (key: string) => {
    const now = Date.now();
    const inMemory = memoryCache.get(key);
    if (inMemory && now - inMemory.savedAt < API_CACHE_TTL_MS) {
        return inMemory.data;
    }
    if (typeof window === 'undefined') return undefined;
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return undefined;
        if (!parsed.savedAt || now - parsed.savedAt > API_CACHE_TTL_MS) {
            sessionStorage.removeItem(key);
            return undefined;
        }
        memoryCache.set(key, { data: parsed.data, savedAt: parsed.savedAt });
        return parsed.data;
    } catch {
        return undefined;
    }
};

const writeCached = (key: string, data: any) => {
    const savedAt = Date.now();
    memoryCache.set(key, { data, savedAt });
    if (typeof window === 'undefined') return;
    try {
        sessionStorage.setItem(key, JSON.stringify({ data, savedAt }));
    } catch { /* ignore */ }
};

const clearCacheByPrefix = (urlPrefix: string) => {
    const matcher = `::${urlPrefix}`;
    memoryCache.forEach((_value, key) => {
        if (key.includes(matcher)) memoryCache.delete(key);
    });
    if (typeof window === 'undefined') return;
    try {
        Object.keys(sessionStorage).forEach((key) => {
            if (key.startsWith(API_CACHE_PREFIX) && key.includes(matcher)) {
                sessionStorage.removeItem(key);
            }
        });
    } catch { /* ignore */ }
};

const clearDashboardCache = () => {
    if (typeof window === 'undefined') return;
    const clearStore = (storage: Storage) => {
        Object.keys(storage).forEach((key) => {
            if (key.startsWith('dashboard-')) {
                storage.removeItem(key);
            }
        });
    };
    try {
        clearStore(sessionStorage);
        clearStore(localStorage);
    } catch { /* ignore */ }
};

const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

const cachedGet = async (url: string, config: any = {}) => {
    const key = buildCacheKey(url, config?.params);
    const cached = readCached(key);
    if (cached !== undefined) {
        return Promise.resolve({ data: cached } as any);
    }
    const res = await api.get(url, config);
    writeCached(key, res.data);
    return res;
};

// Request interceptor: Attach Clerk token + merchant_id
api.interceptors.request.use(async (config) => {
    if (typeof window !== 'undefined') {
        try {
            const token = localStorage.getItem('token');
            if (token) {
                config.headers['Authorization'] = `Bearer ${token}`;
            }
        } catch { }

        const merchantId = localStorage.getItem("merchant_id");
        if (merchantId) {
            config.headers["X-Merchant-ID"] = merchantId;
        }
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        if (error.response?.status === 403) {
            const errMsg = error.response?.data?.error?.toLowerCase() || '';
            if (errMsg.includes('subscription is inactive') || errMsg.includes('renew')) {
                if (typeof window !== 'undefined' && window.location.pathname !== '/subscription-expired') {
                    window.location.href = '/subscription-expired';
                }
            } else if (errMsg.includes('token') || errMsg.includes('unauthenticated')) {
                if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    window.location.href = '/login';
                }
            }
            // Other 403s (like plan limits or locked features) are handled by the components.
        }
        return Promise.reject(error);
    }
);

export const loansAPI = {
    getAll: (params: any) => cachedGet('/loans', { params }),
    getById: (id: string) => cachedGet(`/loans/${id}`),
    create: async (data: any) => {
        const res = await api.post('/loans', data);
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    update: async (id: string, data: any) => {
        const res = await api.patch(`/loans/${id}`, data);
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    updateStatus: async (id: string, status: string, extra: any = {}) => {
        const res = await api.patch(`/loans/${id}/status`, { status, ...extra });
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    delete: async (id: string) => {
        const res = await api.delete(`/loans/${id}`);
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    export: (params: any) => api.get('/reports/export-loans', { params, responseType: 'blob' }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `loans_report_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
    }),
    upload: async (formData: FormData) => {
        const res = await api.post('/loans/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    uploadAttachment: async (formData: FormData) => {
        const res = await api.post('/loans/upload-attachment', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
};

export const customersAPI = {
    getAll: (params: any) => cachedGet('/customers', { params }),
    getById: (id: string) => cachedGet(`/customers/${id}`),
    getRatings: (id: string, params?: any) => cachedGet(`/customers/${id}/ratings`, { params }),
    saveRating: async (id: string, data: any) => {
        const res = await api.post(`/customers/${id}/ratings`, data);
        clearCacheByPrefix('/customers');
        return res;
    },
    create: async (data: any) => {
        const res = await api.post('/customers', data);
        clearCacheByPrefix('/customers');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    update: async (id: string, data: any) => {
        const res = await api.patch(`/customers/${id}`, data);
        clearCacheByPrefix('/customers');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
    delete: async (id: string) => {
        const res = await api.delete(`/customers/${id}`);
        clearCacheByPrefix('/customers');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        return res;
    },
};

export const settingsAPI = {
    getProfile: () => api.get('/settings/profile'),
    updateProfile: (data: any) => api.patch('/settings/profile', data),
    changePassword: (currentPassword: string, newPassword: string) =>
        api.post('/settings/change-password', { currentPassword, newPassword }),
};

export const authAPI = {
    endAllSessions: () => api.post('/auth/end-all-sessions'),
};

export const employeesAPI = {
    getAll: (params?: any) => cachedGet('/employees', { params }),
    create: async (data: any) => {
        const res = await api.post('/employees', data);
        clearCacheByPrefix('/employees');
        return res;
    },
    update: async (id: string, data: any) => {
        const res = await api.patch(`/employees/${id}`, data);
        clearCacheByPrefix('/employees');
        return res;
    },
    activate: async (id: string) => {
        const res = await api.patch(`/employees/${id}/activate`);
        clearCacheByPrefix('/employees');
        return res;
    },
    delete: async (id: string) => {
        const res = await api.delete(`/employees/${id}`);
        clearCacheByPrefix('/employees');
        return res;
    },
};

export const reportsAPI = {
    getDashboard: (params: any) => cachedGet('/reports/dashboard', { params }),
    getAnalytics: (params: any) => cachedGet('/reports/analytics', { params }),
    getAIAnalysis: (params: any) => cachedGet('/reports/ai-analysis', { params }),
};

export default api;
