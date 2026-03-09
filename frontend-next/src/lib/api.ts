import axios from 'axios';


const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost/api',
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

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
    getAll: (params: any) => api.get('/loans', { params }),
    getById: (id: string) => api.get(`/loans/${id}`),
    create: (data: any) => api.post('/loans', data),
    update: (id: string, data: any) => api.patch(`/loans/${id}`, data),
    updateStatus: (id: string, status: string, extra: any = {}) => api.patch(`/loans/${id}/status`, { status, ...extra }),
    delete: (id: string) => api.delete(`/loans/${id}`),
    export: (params: any) => api.get('/reports/export-loans', { params, responseType: 'blob' }).then(res => {
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `loans_report_${new Date().toISOString().split('T')[0]}.xlsx`);
        document.body.appendChild(link);
        link.click();
    }),
    upload: (formData: FormData) => api.post('/loans/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
    uploadAttachment: (formData: FormData) => api.post('/loans/upload-attachment', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
    }),
};

export const customersAPI = {
    getAll: (params: any) => api.get('/customers', { params }),
    getById: (id: string) => api.get(`/customers/${id}`),
    getRatings: (id: string, params?: any) => api.get(`/customers/${id}/ratings`, { params }),
    saveRating: (id: string, data: any) => api.post(`/customers/${id}/ratings`, data),
    create: (data: any) => api.post('/customers', data),
    update: (id: string, data: any) => api.patch(`/customers/${id}`, data),
    delete: (id: string) => api.delete(`/customers/${id}`),
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
    getAll: (params?: any) => api.get('/employees', { params }),
    create: (data: any) => api.post('/employees', data),
    update: (id: string, data: any) => api.patch(`/employees/${id}`, data),
    activate: (id: string) => api.patch(`/employees/${id}/activate`),
    delete: (id: string) => api.delete(`/employees/${id}`),
};

export const reportsAPI = {
    getDashboard: (params: any) => api.get('/reports/dashboard', { params }),
    getAnalytics: (params: any) => api.get('/reports/analytics', { params }),
    getAIAnalysis: (params: any) => api.get('/reports/ai-analysis', { params }),
};

export default api;
