import React, { useState, useEffect } from 'react';
import api, { settingsAPI, authAPI, employeesAPI } from '../../services/api';
import Layout from '../../components/layout/Layout';
import './SettingsPage.css';

const SettingsPage = () => {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState({
        username: '',
        business_name: '',
        email: '',
        mobile_number: '',
        whatsapp_phone_id: ''
    });

    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [employees, setEmployees] = useState([]);
    const [showEmployeeModal, setShowEmployeeModal] = useState(false);
    const [employeeForm, setEmployeeForm] = useState({
        fullName: '',
        email: '',
        password: '',
        permissions: {
            can_view_loans: true,
            can_add_loans: true,
            can_view_customers: true,
            can_view_analytics: false
        }
    });

    const [otpModal, setOtpModal] = useState(false);
    const [otpCode, setOtpCode] = useState('');

    const [messages, setMessages] = useState({ profile: null, password: null, security: null, employees: null });

    const currentUser = JSON.parse(localStorage.getItem('user') || localStorage.getItem('merchant') || '{}');
    const isMerchant = currentUser.role === 'merchant';

    useEffect(() => {
        fetchProfile();
        if (isMerchant) {
            fetchEmployees();
        }
    }, [isMerchant]);

    const fetchProfile = async () => {
        try {
            setLoading(true);
            const res = await settingsAPI.getProfile();
            const data = res.data?.profile || res.data;
            if (data) {
                setProfile({
                    username: data.username || '',
                    business_name: data.business_name || '',
                    email: data.email || '',
                    mobile_number: data.mobile_number || '',
                    whatsapp_phone_id: data.whatsapp_phone_id || ''
                });
            }
        } catch (err) {
            console.error('Error fetching profile', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchEmployees = async () => {
        try {
            const res = await employeesAPI.getAll();
            setEmployees(res.data.employees || []);
        } catch (err) {
            console.error('Error fetching employees', err);
        }
    };

    const handleEmployeeSubmit = async (e) => {
        e.preventDefault();
        setMessages({ ...messages, employees: { type: 'loading', text: 'جاري الإضافة...' } });
        try {
            await employeesAPI.create(employeeForm);
            setMessages({ ...messages, employees: { type: 'success', text: 'تمت إضافة الموظف بنجاح!' } });
            setEmployeeForm({
                fullName: '', email: '', password: '',
                permissions: { can_view_loans: true, can_add_loans: true, can_view_customers: true, can_view_analytics: false }
            });
            setShowEmployeeModal(false);
            fetchEmployees();
            setTimeout(() => setMessages({ ...messages, employees: null }), 3000);
        } catch (err) {
            const errorText = err.response?.data?.error || 'فشل إضافة الموظف';
            setMessages({ ...messages, employees: { type: 'error', text: errorText } });
        }
    };

    const handleDeleteEmployee = async (id) => {
        if (!window.confirm('هل أنت متأكد من حذف هذا الموظف؟')) return;
        try {
            await employeesAPI.delete(id);
            fetchEmployees();
        } catch (err) {
            alert('فشل حذف الموظف');
        }
    };

    const updateLocalMerchant = (updatedProfile) => {
        const currentMerchant = JSON.parse(localStorage.getItem('merchant') || '{}');
        const newMerchantData = {
            ...currentMerchant,
            businessName: updatedProfile.business_name || profile.business_name,
            email: updatedProfile.email || profile.email
        };
        localStorage.setItem('merchant', JSON.stringify(newMerchantData));
        localStorage.setItem('user', JSON.stringify(newMerchantData));
    };

    const handleProfileSubmit = async (e) => {
        // ... (lines omitted for brevity, keeping same logic)
        e.preventDefault();
        setMessages({ ...messages, profile: { type: 'loading', text: 'جاري الحفظ...' } });
        try {
            const res = await settingsAPI.updateProfile(profile);

            if (res.data?.requiresOTP) {
                setMessages({ ...messages, profile: null });
                setOtpModal(true);
                return;
            }

            // Fallback if backend doesn't require OTP (e.g. earlier logic)
            const updatedProfile = res.data?.profile || res.data;
            updateLocalMerchant(updatedProfile);

            setMessages({ ...messages, profile: { type: 'success', text: 'تم التحديث بنجاح!' } });
            setTimeout(() => setMessages({ ...messages, profile: null }), 3000);
        } catch (err) {
            const errorText = err.response?.data?.error || 'فشل تحديث البيانات';
            setMessages({ ...messages, profile: { type: 'error', text: errorText } });
        }
    };

    const handleVerifyProfileOTP = async (e) => {
        e.preventDefault();
        setMessages({ ...messages, profile: { type: 'loading', text: 'جاري التحقق...' } });
        try {
            const res = await api.post('/settings/verify-profile-update', { code: otpCode });
            const updatedProfile = res.data?.profile || res.data;
            updateLocalMerchant(updatedProfile);

            setOtpModal(false);
            setOtpCode('');
            setMessages({ ...messages, profile: { type: 'success', text: 'تم تحديث البيانات بنجاح!' } });
            setTimeout(() => setMessages({ ...messages, profile: null }), 3000);
        } catch (err) {
            const errorText = err.response?.data?.error || 'فشل التحقق من الرمز';
            setMessages({ ...messages, profile: { type: 'error', text: errorText } });
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessages({ ...messages, password: { type: 'error', text: 'كلمة المرور الجديدة غير متطابقة' } });
            return;
        }

        setMessages({ ...messages, password: { type: 'loading', text: 'جاري الحفظ...' } });
        try {
            await settingsAPI.changePassword(passwordData.currentPassword, passwordData.newPassword);
            setMessages({ ...messages, password: { type: 'success', text: 'تم تغيير كلمة المرور بنجاح!' } });
            setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            setTimeout(() => setMessages({ ...messages, password: null }), 3000);
        } catch (err) {
            const errorText = err.response?.data?.error || 'فشل تغيير كلمة المرور';
            setMessages({ ...messages, password: { type: 'error', text: errorText } });
        }
    };

    const handleEndSessions = async () => {
        if (!window.confirm('هل أنت متأكد من إنهاء جميع الجلسات النشطة؟ ستحتاج لتسجيل الدخول مرة أخرى.')) return;

        setMessages({ ...messages, security: { type: 'loading', text: 'جاري إنهاء الجلسات...' } });
        try {
            await authAPI.endAllSessions();
            setMessages({ ...messages, security: { type: 'success', text: 'تم إنهاء جميع الجلسات. جاري تسجيل الخروج...' } });
            setTimeout(() => {
                localStorage.clear();
                window.location.href = '/login';
            }, 2000);
        } catch (err) {
            setMessages({ ...messages, security: { type: 'error', text: 'فشل إنهاء الجلسات' } });
            setTimeout(() => setMessages({ ...messages, security: null }), 3000);
        }
    };

    if (loading) {
        return (
            <Layout>
                <div className="page-header">
                    <h1>إعدادات الحساب</h1>
                </div>
                <div className="loading">جاري التحميل...</div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="page-header">
                <h1>إعدادات الحساب</h1>
            </div>

            <div className="settings-container">
                <div className="settings-card glass-card">
                    <h2>المعلومات الأساسية</h2>
                    <form onSubmit={handleProfileSubmit}>
                        <div className="form-group">
                            <label>اسم المستخدم</label>
                            <input
                                type="text"
                                value={profile.username}
                                onChange={e => setProfile({ ...profile, username: e.target.value })}
                                placeholder="Username"
                            />
                        </div>
                        <div className="form-group">
                            <label>اسم المتجر / النشاط</label>
                            <input
                                type="text"
                                value={profile.business_name}
                                onChange={e => setProfile({ ...profile, business_name: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>البريد الإلكتروني</label>
                            <input
                                type="email"
                                value={profile.email}
                                onChange={e => setProfile({ ...profile, email: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>رقم الجوال</label>
                            <input
                                type="text"
                                value={profile.mobile_number}
                                onChange={e => setProfile({ ...profile, mobile_number: e.target.value })}
                                placeholder="05XXXXXXXX"
                            />
                        </div>
                        <div className="form-group">
                            <label>WhatsApp Phone ID (للربط)</label>
                            <input
                                type="text"
                                value={profile.whatsapp_phone_id}
                                onChange={e => setProfile({ ...profile, whatsapp_phone_id: e.target.value })}
                                placeholder="رقم المعرف الخاص بواتساب"
                            />
                        </div>

                        {messages.profile && (
                            <div className={`message ${messages.profile.type}`}>
                                {messages.profile.text}
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="submit" className="btn-primary">حفظ التغييرات</button>
                        </div>
                    </form>
                </div>

                <div className="settings-card glass-card">
                    <h2>الأمان والجلسات</h2>
                    <div className="security-info" style={{ marginBottom: 20 }}>
                        <p style={{ opacity: 0.8, fontSize: '0.9rem', marginBottom: 15 }}>
                            لحماية حسابك، يمكنك إنهاء جميع الجلسات المفتوحة على الأجهزة الأخرى. سيؤدي هذا لتسجيل خروجك من المتصفحات الحالية والجديدة.
                        </p>
                        {messages.security && (
                            <div className={`message ${messages.security.type}`} style={{ marginBottom: 15 }}>
                                {messages.security.text}
                            </div>
                        )}
                        <button
                            onClick={handleEndSessions}
                            className="btn-primary"
                            style={{ backgroundColor: '#f39c12', width: '100%' }}
                        >
                             إنهاء جميع الجلسات النشطة
                        </button>
                    </div>
                </div>

                {isMerchant && (
                    <div className="settings-card glass-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <h2 style={{ margin: 0 }}> إدارة الموظفين</h2>
                            <button className="btn-primary" onClick={() => setShowEmployeeModal(true)}>+ إضافة موظف</button>
                        </div>

                        <div className="employees-list">
                            {employees.length === 0 ? (
                                <p style={{ opacity: 0.6, textAlign: 'center' }}>لا يوجد موظفين مضافين حالياً.</p>
                            ) : (
                                <div className="table-responsive">
                                    <table className="employees-table">
                                        <thead>
                                            <tr>
                                                <th>الاسم</th>
                                                <th>البريد الإلكتروني</th>
                                                <th>الصلاحيات</th>
                                                <th>الإجراءات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {employees.map(emp => (
                                                <tr key={emp.id}>
                                                    <td>{emp.full_name}</td>
                                                    <td>{emp.email}</td>
                                                    <td>
                                                        <div className="permission-tags">
                                                            {emp.permissions.can_view_loans && <span className="tag">قروض</span>}
                                                            {emp.permissions.can_view_customers && <span className="tag">عملاء</span>}
                                                            {emp.permissions.can_view_analytics && <span className="tag">تحليلات</span>}
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <button className="btn-delete" onClick={() => handleDeleteEmployee(emp.id)}>حذف</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="settings-card glass-card">
                    <h2>الأمان وتغيير كلمة المرور</h2>
                    {/* ... (existing password form) */}
                    <form onSubmit={handlePasswordSubmit}>
                        <div className="form-group">
                            <label>كلمة المرور الحالية</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>كلمة المرور الجديدة</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                required
                                minLength="6"
                            />
                        </div>
                        <div className="form-group">
                            <label>تأكيد كلمة المرور الجديدة</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                required
                            />
                        </div>

                        {messages.password && (
                            <div className={`message ${messages.password.type}`}>
                                {messages.password.text}
                            </div>
                        )}

                        <div className="form-actions">
                            <button type="submit" className="btn-primary" style={{ backgroundColor: '#e74c3c' }}>
                                تحديث كلمة المرور
                            </button>
                        </div>
                    </form>
                </div>

                {/* ── Billing / Subscription ── */}
                <div className="settings-card glass-card">
                    <h2> الاشتراك والفوترة</h2>
                    <div className="billing-info">
                        <div className="billing-row">
                            <span className="billing-label">الباقة الحالية</span>
                            <span className="billing-value billing-plan">
                                {(() => {
                                    const m = JSON.parse(localStorage.getItem('merchant') || '{}');
                                    const plan = m.subscriptionPlan || 'Free';
                                    const labels = { Free: 'مجانية', Basic: 'الأساسية ٩٩ ر.س', Pro: 'الاحترافية ٢٢٠ ر.س', Enterprise: 'المؤسسية ٣٥٠ ر.س' };
                                    return labels[plan] || plan;
                                })()}
                            </span>
                        </div>
                        <div className="billing-row">
                            <span className="billing-label">الحالة</span>
                            <span className="billing-value" style={{ color: '#10B981', fontWeight: 700 }}>
                                {(() => {
                                    const m = JSON.parse(localStorage.getItem('merchant') || '{}');
                                    const s = m.subscriptionStatus || 'Active';
                                    const labels = { Active: ' نشط', Cancelled: ' ملغي', PastDue: '️ متأخر', Inactive: '⏸️ موقف' };
                                    return labels[s] || s;
                                })()}
                            </span>
                        </div>
                    </div>
                    <div className="form-actions" style={{ gap: 12, display: 'flex' }}>
                        <button
                            className="btn-primary"
                            style={{ background: 'linear-gradient(135deg, #E8633A, #C1532E)' }}
                            onClick={() => window.location.href = '/pricing'}
                        >
                            ⬆️ ترقية الباقة
                        </button>
                    </div>
                </div>
            </div>

            {/* OTP Modal Overlay for Profile Update */}
            {otpModal && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="modal-content glass-card" style={{ maxWidth: 400, padding: 30, borderRadius: 16 }}>
                        <h2 style={{ marginTop: 0 }}>تأكيد النعديلات</h2>
                        <p style={{ marginBottom: 20, color: '#94A3B8', fontSize: '14px', lineHeight: 1.6 }}>أدخل رمز التحقق (OTP) المكون من 6 أرقام والذي تم إرساله إلى بريدك الإلكتروني الحالي لتأكيد تغيير البيانات.</p>
                        <form onSubmit={handleVerifyProfileOTP}>
                            <div className="form-group">
                                <input
                                    type="text"
                                    placeholder="رمز التحقق"
                                    value={otpCode}
                                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').substring(0, 6))}
                                    required
                                    style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '8px', padding: '15px' }}
                                />
                            </div>
                            <div className="form-actions" style={{ marginTop: 20, gap: 10, display: 'flex' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>تأكيد الرمز</button>
                                <button type="button" className="btn-secondary" onClick={() => setOtpModal(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Add Employee Modal */}
            {showEmployeeModal && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="modal-content glass-card" style={{ maxWidth: 500, width: '90%', padding: 30, borderRadius: 16 }}>
                        <h2 style={{ marginTop: 0 }}>إضافة موظف جديد</h2>
                        <form onSubmit={handleEmployeeSubmit}>
                            <div className="form-group">
                                <label>الاسم الكامل</label>
                                <input
                                    type="text"
                                    value={employeeForm.fullName}
                                    onChange={e => setEmployeeForm({ ...employeeForm, fullName: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>البريد الإلكتروني</label>
                                <input
                                    type="email"
                                    value={employeeForm.email}
                                    onChange={e => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>كلمة المرور</label>
                                <input
                                    type="password"
                                    value={employeeForm.password}
                                    onChange={e => setEmployeeForm({ ...employeeForm, password: e.target.value })}
                                    required
                                    minLength="8"
                                />
                            </div>

                            <div className="form-group">
                                <label>الصلاحيات</label>
                                <div className="permissions-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={employeeForm.permissions.can_view_loans} onChange={e => setEmployeeForm({ ...employeeForm, permissions: { ...employeeForm.permissions, can_view_loans: e.target.checked } })} />
                                        عرض القروض
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={employeeForm.permissions.can_add_loans} onChange={e => setEmployeeForm({ ...employeeForm, permissions: { ...employeeForm.permissions, can_add_loans: e.target.checked } })} />
                                        إضافة/تعديل
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={employeeForm.permissions.can_view_customers} onChange={e => setEmployeeForm({ ...employeeForm, permissions: { ...employeeForm.permissions, can_view_customers: e.target.checked } })} />
                                        عرض العملاء
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                                        <input type="checkbox" checked={employeeForm.permissions.can_view_analytics} onChange={e => setEmployeeForm({ ...employeeForm, permissions: { ...employeeForm.permissions, can_view_analytics: e.target.checked } })} />
                                        عرض التحليلات
                                    </label>
                                </div>
                            </div>

                            {messages.employees && (
                                <div className={`message ${messages.employees.type}`} style={{ margin: '15px 0' }}>
                                    {messages.employees.text}
                                </div>
                            )}

                            <div className="form-actions" style={{ marginTop: 25, gap: 10, display: 'flex' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>إضافة الموظف</button>
                                <button type="button" className="btn-secondary" onClick={() => setShowEmployeeModal(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)' }}>إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </Layout>
    );
};

export default SettingsPage;
