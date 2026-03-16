import axios from 'axios';

const API_CACHE_PREFIX = 'api-cache:';
const API_CACHE_TTL_MS = 1000 * 120;
const API_CACHE_STALE_MS = 1000 * 60 * 10;
const memoryCache = new Map<string, { data: any; savedAt: number }>();
export const DASHBOARD_DIRTY_KEY = 'dashboard-dirty';
const DATA_SYNC_STORAGE_KEY = 'aseel-data-sync';
const DATA_SYNC_CHANNEL = 'aseel-data-sync';
let syncChannel: BroadcastChannel | null = null;

export type DataSyncEvent = {
    scopes: string[];
    reason?: string;
    ts: number;
};

const getSyncChannel = () => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return null;
    if (!syncChannel) {
        syncChannel = new BroadcastChannel(DATA_SYNC_CHANNEL);
    }
    return syncChannel;
};

export const emitDataSync = (payload: { scopes: string[]; reason?: string }) => {
    if (typeof window === 'undefined') return;
    const event: DataSyncEvent = {
        scopes: Array.isArray(payload.scopes) ? payload.scopes : [String(payload.scopes)],
        reason: payload.reason,
        ts: Date.now(),
    };
    try {
        getSyncChannel()?.postMessage(event);
    } catch { /* ignore */ }
    try {
        localStorage.setItem(DATA_SYNC_STORAGE_KEY, JSON.stringify(event));
    } catch { /* ignore */ }
    try {
        window.dispatchEvent(new CustomEvent('aseel-sync', { detail: event }));
    } catch { /* ignore */ }
};

export const subscribeDataSync = (handler: (event: DataSyncEvent) => void) => {
    if (typeof window === 'undefined') return () => {};
    const channel = getSyncChannel();
    const onMessage = (event: MessageEvent) => handler(event.data);
    const onStorage = (event: StorageEvent) => {
        if (event.key !== DATA_SYNC_STORAGE_KEY || !event.newValue) return;
        try {
            handler(JSON.parse(event.newValue));
        } catch { /* ignore */ }
    };
    const onCustom = (event: Event) => {
        const detail = (event as CustomEvent).detail;
        if (detail) handler(detail);
    };
    channel?.addEventListener('message', onMessage);
    window.addEventListener('storage', onStorage);
    window.addEventListener('aseel-sync', onCustom as EventListener);
    return () => {
        channel?.removeEventListener('message', onMessage);
        window.removeEventListener('storage', onStorage);
        window.removeEventListener('aseel-sync', onCustom as EventListener);
    };
};

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

const readCached = (key: string, allowStale = false) => {
    const now = Date.now();
    const inMemory = memoryCache.get(key);
    if (inMemory) {
        const age = now - inMemory.savedAt;
        if (age < API_CACHE_TTL_MS) {
            return { data: inMemory.data, stale: false };
        }
        if (allowStale && age < API_CACHE_STALE_MS) {
            return { data: inMemory.data, stale: true };
        }
    }
    if (typeof window === 'undefined') return undefined;
    try {
        const raw = sessionStorage.getItem(key);
        if (!raw) return undefined;
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return undefined;
        if (!parsed.savedAt) return undefined;
        const age = now - parsed.savedAt;
        if (age > API_CACHE_STALE_MS) {
            sessionStorage.removeItem(key);
            return undefined;
        }
        memoryCache.set(key, { data: parsed.data, savedAt: parsed.savedAt });
        if (age < API_CACHE_TTL_MS) {
            return { data: parsed.data, stale: false };
        }
        return allowStale ? { data: parsed.data, stale: true } : undefined;
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

const peekCached = (url: string, config: any = {}) => {
    const key = buildCacheKey(url, config?.params);
    const cached = readCached(key, true);
    return cached?.data;
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

export const invalidateCacheForScopes = (scopes: string[]) => {
    const scopeSet = new Set(scopes || []);
    if (scopeSet.has('customers')) {
        clearCacheByPrefix('/customers');
    }
    if (scopeSet.has('loans')) {
        clearCacheByPrefix('/loans');
    }
    if (scopeSet.has('reports') || scopeSet.has('dashboard') || scopeSet.has('analytics')) {
        clearCacheByPrefix('/reports');
        clearDashboardCache(false);
    }
    if (scopeSet.has('najiz')) {
        clearCacheByPrefix('/najiz');
    }
    if (scopeSet.has('employees')) {
        clearCacheByPrefix('/employees');
    }
};

const clearDashboardCache = (emitSync = true) => {
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
        localStorage.setItem(DASHBOARD_DIRTY_KEY, String(Date.now()));
        if (emitSync) {
            emitDataSync({ scopes: ['dashboard', 'reports'], reason: 'dashboard-cache-cleared' });
        }
    } catch { /* ignore */ }
};

const getApiBaseUrl = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    if (envUrl) {
        const normalizedEnv = envUrl.replace(/\/$/, '');
        const hasApiSegment = /\/api(\/|$)/.test(normalizedEnv);
        const resolvedEnv = hasApiSegment ? normalizedEnv : `${normalizedEnv}/api`;
        if (typeof window !== 'undefined') {
            const isLocalhostEnv = resolvedEnv.includes('localhost') || resolvedEnv.includes('127.0.0.1');
            const isLocalhostBrowser = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (isLocalhostEnv && !isLocalhostBrowser) {
                return '/api';
            }
        }
        return resolvedEnv;
    }
    if (typeof window !== 'undefined') return '/api';
    const backendOrigin = process.env.BACKEND_URL
        || (process.env.VERCEL ? 'https://aseel-backend.vercel.app' : 'http://localhost:3100');
    return backendOrigin.endsWith('/api') ? backendOrigin : `${backendOrigin}/api`;
};

const api = axios.create({
    baseURL: getApiBaseUrl(),
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

const cachedGet = async (url: string, config: any = {}) => {
    const key = buildCacheKey(url, config?.params);
    const cached = readCached(key, true);
    if (cached !== undefined) {
        if (cached?.stale) {
            warmCache(url, config, true);
        }
        return Promise.resolve({ data: cached.data } as any);
    }
    const res = await api.get(url, config);
    writeCached(key, res.data);
    return res;
};

const warmCache = async (url: string, config: any = {}, force = false) => {
    const key = buildCacheKey(url, config?.params);
    const cached = readCached(key, true);
    if (!force && cached !== undefined && !cached?.stale) return;
    try {
        const res = await api.get(url, config);
        writeCached(key, res.data);
    } catch {
        // Best-effort prefetch; ignore failures
    }
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
    peekAll: (params: any) => peekCached('/loans', { params }),
    prefetchAll: (params: any) => warmCache('/loans', { params }),
    getById: (id: string) => cachedGet(`/loans/${id}`),
    create: async (data: any) => {
        const res = await api.post('/loans', data);
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['loans', 'customers', 'dashboard', 'reports', 'analytics', 'najiz'], reason: 'loan-created' });
        return res;
    },
    update: async (id: string, data: any) => {
        const res = await api.patch(`/loans/${id}`, data);
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['loans', 'customers', 'dashboard', 'reports', 'analytics', 'najiz'], reason: 'loan-updated' });
        return res;
    },
    updateStatus: async (id: string, status: string, extra: any = {}) => {
        const res = await api.patch(`/loans/${id}/status`, { status, ...extra });
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['loans', 'customers', 'dashboard', 'reports', 'analytics', 'najiz'], reason: 'loan-status' });
        return res;
    },
    delete: async (id: string) => {
        const res = await api.delete(`/loans/${id}`);
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['loans', 'customers', 'dashboard', 'reports', 'analytics', 'najiz'], reason: 'loan-deleted' });
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
        emitDataSync({ scopes: ['loans', 'customers', 'dashboard', 'reports', 'analytics', 'najiz'], reason: 'loan-upload' });
        return res;
    },
    uploadAttachment: async (formData: FormData) => {
        const res = await api.post('/loans/upload-attachment', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        clearCacheByPrefix('/loans');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['loans', 'customers', 'dashboard', 'reports', 'analytics', 'najiz'], reason: 'loan-attachment' });
        return res;
    },
};

export const customersAPI = {
    getAll: (params: any) => cachedGet('/customers', { params }),
    peekAll: (params: any) => peekCached('/customers', { params }),
    prefetchAll: (params: any) => warmCache('/customers', { params }),
    getStats: (ids: string[]) => cachedGet('/customers/stats', { params: { ids: ids.join(',') } }),
    getById: (id: string) => cachedGet(`/customers/${id}`),
    getRatings: (id: string, params?: any) => cachedGet(`/customers/${id}/ratings`, { params }),
    saveRating: async (id: string, data: any) => {
        const res = await api.post(`/customers/${id}/ratings`, data);
        clearCacheByPrefix('/customers');
        emitDataSync({ scopes: ['customers', 'dashboard', 'reports'], reason: 'customer-rating' });
        return res;
    },
    create: async (data: any) => {
        const res = await api.post('/customers', data);
        clearCacheByPrefix('/customers');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['customers', 'loans', 'dashboard', 'reports'], reason: 'customer-created' });
        return res;
    },
    update: async (id: string, data: any) => {
        const res = await api.patch(`/customers/${id}`, data);
        clearCacheByPrefix('/customers');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['customers', 'loans', 'dashboard', 'reports'], reason: 'customer-updated' });
        return res;
    },
    delete: async (id: string) => {
        const res = await api.delete(`/customers/${id}`);
        clearCacheByPrefix('/customers');
        clearCacheByPrefix('/reports');
        clearDashboardCache();
        emitDataSync({ scopes: ['customers', 'loans', 'dashboard', 'reports'], reason: 'customer-deleted' });
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
