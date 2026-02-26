import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import {
    IconDashboard, IconUsers, IconLoans, IconSettings,
    IconSearch, IconLogout, IconTrash, IconEdit,
    IconCheck, IconX, IconTrend, IconActivity, IconPieChart, IconStore
} from '../components/Icons';
import './AdminPage.css';

const AdminPage = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [merchants, setMerchants] = useState([]);
    const [requests, setRequests] = useState([]);
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedMerchant, setSelectedMerchant] = useState(null);
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [editData, setEditData] = useState({ plan: '', status: '', expiryDate: '' });

    // Search & Settings State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState({ merchants: [], customers: [], loans: [] });
    const [platformSettings, setPlatformSettings] = useState({
        bank_details: { iban: '', bank_name: '', account_holder: '' },
        global_alert: { active: false, message: '', type: 'info' }
    });

    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

    const login = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const res = await axios.post(`${API_URL}/system-manage-x7/login`, { password }, { withCredentials: true });
            localStorage.setItem('adminToken', res.data.token);
            setIsAuthenticated(true);
            fetchData(res.data.token);
        } catch (err) {
            setError(err.response?.data?.error || 'فشل في تسجيل الدخول');
        }
    };

    const fetchData = async (token = localStorage.getItem('adminToken')) => {
        setLoading(true);
        try {
            const config = { headers: { Authorization: `Bearer ${token}` }, withCredentials: true };
            const [merchantsRes, statsRes, requestsRes, settingsRes] = await Promise.all([
                axios.get(`${API_URL}/system-manage-x7/merchants`, config),
                axios.get(`${API_URL}/system-manage-x7/stats`, config),
                axios.get(`${API_URL}/system-manage-x7/subscription-requests`, config),
                axios.get(`${API_URL}/system-manage-x7/settings`, config)
            ]);
            setMerchants(merchantsRes.data);
            setStats(statsRes.data);
            setRequests(requestsRes.data);
            if (settingsRes.data) {
                setPlatformSettings(prev => ({ ...prev, ...settingsRes.data }));
            }
        } catch (err) {
            if (err.response?.status === 401) logout();
            setError('فشل جلب البيانات');
        } finally {
            setLoading(false);
        }
    };

    const handleGlobalSearch = async () => {
        if (searchQuery.length < 2) return;
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, withCredentials: true };
            const res = await axios.get(`${API_URL}/system-manage-x7/global-search?q=${searchQuery}`, config);
            setSearchResults(res.data);
        } catch (err) {
            console.error('Search error');
        }
    };

    const handleSaveSettings = async (key, value) => {
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, withCredentials: true };
            await axios.post(`${API_URL}/system-manage-x7/settings`, { key, value }, config);
            alert('تم حفظ الإعدادات');
            fetchData();
        } catch (err) {
            alert('فشل حفظ الإعدادات');
        }
    };

    const logout = () => {
        localStorage.removeItem('adminToken');
        setIsAuthenticated(false);
    };

    const handleUpdateSubscription = async () => {
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, withCredentials: true };
            await axios.put(`${API_URL}/system-manage-x7/merchants/${selectedMerchant.id}/subscription`, editData, config);
            setSelectedMerchant(null);
            fetchData();
        } catch (err) {
            alert('فشل التحديث');
        }
    };

    const handleActionRequest = async (id, action) => {
        const notes = action === 'Rejected' ? prompt('سبب الرفض:') : '';
        if (action === 'Rejected' && notes === null) return;

        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, withCredentials: true };
            await axios.post(`${API_URL}/system-manage-x7/subscription-requests/${id}/action`, { action, notes }, config);
            setSelectedRequest(null);
            fetchData();
        } catch (err) {
            alert('فشل تنفيذ الإجراء');
        }
    };

    const handleDeleteMerchant = async (id) => {
        const confirmText = window.prompt('لحذف التاجر وجميع بياناته بشكل نهائي، اكتب كلمة "حذف" في المربع أدناه:');
        if (confirmText !== 'حذف') {
            if (confirmText !== null) alert('لم تقم بكتابة "حذف" بشكل صحيح. تم إلغاء العملية.');
            return;
        }
        try {
            const config = { headers: { Authorization: `Bearer ${localStorage.getItem('adminToken')}` }, withCredentials: true };
            await axios.delete(`${API_URL}/system-manage-x7/merchants/${id}`, config);
            fetchData();
        } catch (err) {
            alert('فشل الحذف');
        }
    };

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            setIsAuthenticated(true);
            fetchData(token);
        }
    }, []);

    if (!isAuthenticated) {
        return (
            <div className="admin-login-container">
                <div className="admin-login-card">
                    <h1> لوحة التحكم - الإدارة</h1>
                    <form onSubmit={login}>
                        <input
                            type="password"
                            placeholder="كلمة المرور السرية"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                        {error && <p className="error-msg">{error}</p>}
                        <button type="submit">دخول الأدمين</button>
                    </form>
                </div>
            </div>
        );
    }

    const BASE_UPLOADS_URL = API_URL.replace('/api', '');

    const renderDashboard = () => (
        <div className="admin-dashboard">
            <div className="stats-grid">
                <div className="stat-card">
                    <h3><IconUsers size={18} color="var(--admin-accent)" /> التجار الكلي</h3>
                    <p className="stat-value">{stats?.total_merchants || 0}</p>
                    <span className="stat-label">نشط حالياً: {stats?.active_count || 0}</span>
                </div>
                <div className="stat-card">
                    <h3><IconLoans size={18} color="var(--coral)" /> إجمالي القروض</h3>
                    <p className="stat-value">{stats?.total_loans || 0}</p>
                    <span className="stat-label">السيولة: {stats?.total_volume?.toLocaleString()} ر.س</span>
                </div>
                <div className="stat-card">
                    <h3><IconActivity size={18} color="#10B981" /> العملاء المستفيدين</h3>
                    <p className="stat-value">{stats?.total_customers || 0}</p>
                    <span className="stat-label">نمو مستمر</span>
                </div>
            </div>

            <div className="charts-container">
                <div className="chart-box">
                    <h3>نمو التجار (آخر 6 أشهر)</h3>
                    <div style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={stats?.chartData || []}>
                                <defs>
                                    <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#E8633A" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#E8633A" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="month" stroke="#94A3B8" />
                                <YAxis stroke="#94A3B8" />
                                <Tooltip contentStyle={{ backgroundColor: '#0B1121', border: '1px solid #1E293B', borderRadius: 8 }} />
                                <Area type="monotone" dataKey="count" stroke="#E8633A" fillOpacity={1} fill="url(#colorCount)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderSearch = () => (
        <div className="admin-search">
            <div className="search-bar">
                <input
                    type="text"
                    placeholder="ابحث عن تاجر، عميل، أو رقم قرض..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGlobalSearch()}
                />
                <button onClick={handleGlobalSearch}>بحث شامل</button>
            </div>

            <div className="search-results">
                {searchResults.merchants.length > 0 && (
                    <div className="res-section">
                        <h4><IconStore size={14} /> التجار</h4>
                        {searchResults.merchants.map(m => <div key={m.id} className="res-item">{m.business_name} ({m.email})</div>)}
                    </div>
                )}
                {searchResults.customers.length > 0 && (
                    <div className="res-section">
                        <h4><IconUsers size={14} /> العملاء</h4>
                        {searchResults.customers.map(c => <div key={c.id} className="res-item">{c.name} - متجر: {c.merchant}</div>)}
                    </div>
                )}
                {searchResults.loans.length > 0 && (
                    <div className="res-section">
                        <h4><IconLoans size={14} /> القروض</h4>
                        {searchResults.loans.map(l => <div key={l.id} className="res-item">قرض #{l.id} - مبلغ: {l.amount} ر.س - متجر: {l.merchant}</div>)}
                    </div>
                )}
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="admin-settings">
            <div className="settings-section">
                <h3>️ تفاصيل البنك (للاشتراكات)</h3>
                <div className="settings-grid">
                    <div className="form-group">
                        <label>رقم الآيبان (IBAN)</label>
                        <input type="text" value={platformSettings.bank_details.iban} onChange={e => setPlatformSettings({ ...platformSettings, bank_details: { ...platformSettings.bank_details, iban: e.target.value } })} />
                    </div>
                    <div className="form-group">
                        <label>اسم البنك</label>
                        <input type="text" value={platformSettings.bank_details.bank_name} onChange={e => setPlatformSettings({ ...platformSettings, bank_details: { ...platformSettings.bank_details, bank_name: e.target.value } })} />
                    </div>
                    <div className="form-group">
                        <label>صاحب الحساب</label>
                        <input type="text" value={platformSettings.bank_details.account_holder} onChange={e => setPlatformSettings({ ...platformSettings, bank_details: { ...platformSettings.bank_details, account_holder: e.target.value } })} />
                    </div>
                </div>
                <button className="save-settings-btn" onClick={() => handleSaveSettings('bank_details', platformSettings.bank_details)}>حفظ بيانات البنك</button>
            </div>

            <hr style={{ opacity: 0.1, margin: '40px 0' }} />

            <div className="settings-section">
                <h3> تنبيه عام للمنصة</h3>
                <div className="form-group" style={{ marginBottom: 15 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <input type="checkbox" checked={platformSettings.global_alert.active} onChange={e => setPlatformSettings({ ...platformSettings, global_alert: { ...platformSettings.global_alert, active: e.target.checked } })} />
                        تفعيل التنبيه لجميع التجار
                    </label>
                </div>
                <div className="form-group">
                    <label>نص الرسالة</label>
                    <textarea value={platformSettings.global_alert.message} onChange={e => setPlatformSettings({ ...platformSettings, global_alert: { ...platformSettings.global_alert, message: e.target.value } })} style={{ minHeight: 100 }} />
                </div>
                <button className="save-settings-btn" onClick={() => handleSaveSettings('global_alert', platformSettings.global_alert)}>حفظ ونشر التنبيه</button>
            </div>
        </div>
    );

    return (
        <div className="admin-page-layout">
            <aside className="admin-sidebar">
                <h2>أصيل المالي</h2>
                <div className="admin-info">
                    <p>المسؤول: <strong>أدمن</strong></p>
                    <button onClick={logout} className="logout-btn">تسجيل خروج</button>
                </div>
                <nav>
                    <ul>
                        <li className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
                            <IconDashboard size={20} /> نظرة عامة
                        </li>
                        <li className={activeTab === 'merchants' ? 'active' : ''} onClick={() => setActiveTab('merchants')}>
                            <IconStore size={20} /> التجار
                        </li>
                        <li className={activeTab === 'requests' ? 'active' : ''} onClick={() => setActiveTab('requests')}>
                            <IconPieChart size={20} /> الطلبات
                            {requests.filter(r => r.status === 'Pending').length > 0 && (
                                <span className="req-count-badge">{requests.filter(r => r.status === 'Pending').length}</span>
                            )}
                        </li>
                        <li className={activeTab === 'search' ? 'active' : ''} onClick={() => setActiveTab('search')}>
                            <IconSearch size={20} /> البحث
                        </li>
                        <li className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>
                            <IconSettings size={20} /> الإعدادات
                        </li>
                    </ul>
                </nav>
            </aside>

            <main className="admin-main">
                <header className="admin-header">
                    <h1>
                        {activeTab === 'dashboard' && 'الإحصائيات والأداء العام'}
                        {activeTab === 'merchants' && 'إدارة التجار والاشتراكات'}
                        {activeTab === 'requests' && 'طلبات ترقية الباقة'}
                        {activeTab === 'search' && 'البحث الشامل في المنصة'}
                        {activeTab === 'settings' && 'إعدادات المنصة العامة'}
                    </h1>
                </header>

                <div className="merchants-table-container">
                    {loading ? (
                        <p>جاري التحميل...</p>
                    ) : activeTab === 'dashboard' ? renderDashboard() :
                        activeTab === 'merchants' ? (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>التاجر</th>
                                        <th>الإيميل</th>
                                        <th>الباقة</th>
                                        <th>الحالة</th>
                                        <th>العملاء/القروض</th>
                                        <th>التسجيل</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {merchants.map(m => (
                                        <tr key={m.id}>
                                            <td><strong>{m.business_name}</strong></td>
                                            <td>{m.email}</td>
                                            <td><span className={`badge plan-${m.subscription_plan}`}>{m.subscription_plan}</span></td>
                                            <td><span className={`badge status-${m.subscription_status}`}>{m.subscription_status}</span></td>
                                            <td>{m.customer_count} / {m.loan_count}</td>
                                            <td>{new Date(m.created_at).toLocaleDateString('ar-SA')}</td>
                                            <td>
                                                <button className="edit-btn" onClick={() => {
                                                    setSelectedMerchant(m);
                                                    setEditData({ plan: m.subscription_plan, status: m.subscription_status, expiryDate: m.expiry_date?.split('T')[0] || '' });
                                                }}><IconEdit size={16} /></button>
                                                <button className="del-btn" onClick={() => handleDeleteMerchant(m.id)}><IconTrash size={16} /></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : activeTab === 'requests' ? (
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>التاجر</th>
                                        <th>الباقة المطلوبة</th>
                                        <th>التاريخ</th>
                                        <th>الحالة</th>
                                        <th>الإيصال</th>
                                        <th>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {requests.map(r => (
                                        <tr key={r.id}>
                                            <td>
                                                <strong>{r.business_name}</strong>
                                                <div style={{ fontSize: '11px', opacity: 0.7 }}>{r.email}</div>
                                            </td>
                                            <td><span className={`badge plan-${r.plan}`}>{r.plan}</span></td>
                                            <td>{new Date(r.created_at).toLocaleString('ar-SA')}</td>
                                            <td><span className={`badge status-${r.status}`}>{r.status}</span></td>
                                            <td>
                                                <button className="view-receipt-btn" onClick={() => setSelectedRequest(r)}>️ عرض</button>
                                            </td>
                                            <td>
                                                {r.status?.toLowerCase() === 'pending' && (
                                                    <>
                                                        <button className="approve-btn" onClick={() => handleActionRequest(r.id, 'Approved')}><IconCheck size={18} /></button>
                                                        <button className="reject-btn" onClick={() => handleActionRequest(r.id, 'Rejected')}><IconX size={18} /></button>
                                                    </>
                                                )}
                                                {r.status?.toLowerCase() !== 'pending' && <span style={{ fontSize: '11px' }}>{r.admin_notes || 'لا يوجد ملاحظات'}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : activeTab === 'search' ? renderSearch() : renderSettings()
                    }
                </div>

                {/* Merchant Edit Modal */}
                {selectedMerchant && (
                    <div className="modal-overlay">
                        <div className="admin-modal">
                            <h2>تعديل اشتراك: {selectedMerchant.business_name}</h2>
                            <div className="form-group plan-selection">
                                <label>الباقة المختارة</label>
                                <div className="plan-cards-grid">
                                    {[
                                        { id: 'Free', name: 'Free', label: 'مجانية', color: '#64748b' },
                                        { id: 'Basic', name: 'Basic', label: 'أساسية', color: '#0369a1' },
                                        { id: 'Pro', name: 'Pro', label: 'احترافية', color: '#c2410c' },
                                        { id: 'Enterprise', name: 'Enterprise', label: 'أعمال', color: '#7e22ce' }
                                    ].map(p => (
                                        <div
                                            key={p.id}
                                            className={`plan-card ${editData.plan === p.id ? 'active' : ''}`}
                                            style={{ '--plan-color': p.color }}
                                            onClick={() => setEditData({ ...editData, plan: p.id })}
                                        >
                                            <div className="plan-card-icon">
                                                {p.id === 'Free' && <IconUsers size={20} />}
                                                {p.id === 'Basic' && <IconActivity size={20} />}
                                                {p.id === 'Pro' && <IconTrend size={20} />}
                                                {p.id === 'Enterprise' && <IconDashboard size={20} />}
                                            </div>
                                            <span className="plan-name">{p.name}</span>
                                            <span className="plan-label">{p.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="modal-row">
                                <div className="form-group">
                                    <label>حالة الاشتراك</label>
                                    <select value={editData.status} onChange={e => setEditData({ ...editData, status: e.target.value })}>
                                        <option value="Active">نشط (Active)</option>
                                        <option value="Cancelled">ملغي (Cancelled)</option>
                                        <option value="PastDue">متأخر (PastDue)</option>
                                        <option value="Inactive">غير نشط (Inactive)</option>
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>تاريخ الانتهاء</label>
                                    <input type="date" value={editData.expiryDate} onChange={e => setEditData({ ...editData, expiryDate: e.target.value })} />
                                </div>
                            </div>
                            <div className="modal-actions">
                                <button className="save-btn" onClick={handleUpdateSubscription}>حفظ التغييرات</button>
                                <button className="cancel-btn" onClick={() => setSelectedMerchant(null)}>إلغاء</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Receipt Preview Modal */}
                {selectedRequest && (
                    <div className="modal-overlay" onClick={() => setSelectedRequest(null)}>
                        <div className="admin-modal receipt-modal" style={{ padding: 10, width: 'auto', maxWidth: '90%' }} onClick={e => e.stopPropagation()}>
                            <h3>إيصال الدفع - {selectedRequest.business_name}</h3>
                            <div className="receipt-preview-container">
                                {selectedRequest.receipt_url.endsWith('.pdf') ? (
                                    <embed src={`${BASE_UPLOADS_URL}${selectedRequest.receipt_url}`} width="600" height="800" type="application/pdf" />
                                ) : (
                                    <img src={`${BASE_UPLOADS_URL}${selectedRequest.receipt_url}`} alt="Receipt" style={{ maxWidth: '100%', maxHeight: '80vh' }} />
                                )}
                            </div>
                            <div className="modal-actions">
                                <button className="cancel-btn" onClick={() => setSelectedRequest(null)}>إغلاق</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default AdminPage;

