import React, { useState, useEffect, useCallback } from 'react';
import './EmployeesPage.css';

const ROLES = [
    { value: 'admin', label: 'مدير النظام' },
    { value: 'manager', label: 'مدير' },
    { value: 'sales', label: 'موظف مبيعات' },
    { value: 'accounts', label: 'محاسب' },
];

const ROLE_LABELS = {
    admin: 'مدير النظام',
    manager: 'مدير',
    sales: 'موظف مبيعات',
    accounts: 'محاسب',
};

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// ─── Toast atoms ──────────────────────────────────────────────────
function Toast({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <div className="toast-icon-wrap">
                        {t.type === 'success' && <span>✅</span>}
                        {t.type === 'danger' && <span>❌</span>}
                        {t.type === 'warning' && <span>⚠️</span>}
                    </div>
                    <div>
                        <div className="toast-title">{t.title}</div>
                        <div className="toast-text">{t.text}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Add / Edit Modal ────────────────────────────────────────────
function EmployeeModal({ emp, onClose, onSave }) {
    const isEdit = !!emp?.id;
    const [form, setForm] = useState({
        name: emp?.name || '',
        email: emp?.email || '',
        phone: emp?.phone || '',
        role: emp?.role || 'sales',
        password: '',
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = async e => {
        e.preventDefault();
        if (!form.name || !form.email || !form.role) { setError('يرجى ملء جميع الحقول الإلزامية'); return; }
        if (!isEdit && !form.password) { setError('كلمة المرور مطلوبة'); return; }

        setSaving(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
            const body = JSON.stringify(isEdit
                ? { name: form.name, email: form.email, phone: form.phone, role: form.role }
                : form
            );
            const res = await fetch(
                isEdit ? `${API_BASE}/employees/${emp.id}` : `${API_BASE}/employees`,
                { method: isEdit ? 'PUT' : 'POST', headers, body }
            );
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'خطأ في الخادم');
            onSave(data.employee || data);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="emp-modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="emp-modal">
                <div className="emp-modal-header">
                    <h2 className="emp-modal-title">{isEdit ? 'تعديل الموظف' : 'إضافة موظف جديد'}</h2>
                    <button className="emp-modal-close" onClick={onClose}>×</button>
                </div>

                {error && (
                    <div className="toast toast-danger" style={{ marginBottom: 16 }}>
                        <span>⚠️</span>
                        <div className="toast-text">{error}</div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="emp-modal-fields">
                        <div className="emp-form-row">
                            <div className="emp-form-group">
                                <label className="emp-form-label">الاسم الكامل *</label>
                                <input name="name" value={form.name} onChange={handleChange} placeholder="محمد أحمد" required />
                            </div>
                            <div className="emp-form-group">
                                <label className="emp-form-label">الدور *</label>
                                <select name="role" value={form.role} onChange={handleChange}>
                                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="emp-form-group">
                            <label className="emp-form-label">البريد الإلكتروني *</label>
                            <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="name@company.com" required />
                        </div>

                        <div className="emp-form-row">
                            <div className="emp-form-group">
                                <label className="emp-form-label">رقم الجوال</label>
                                <input type="tel" name="phone" value={form.phone} onChange={handleChange} placeholder="05XXXXXXXX" />
                            </div>
                            {!isEdit && (
                                <div className="emp-form-group">
                                    <label className="emp-form-label">كلمة المرور *</label>
                                    <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="emp-modal-footer">
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'جاري الحفظ...' : isEdit ? '💾 حفظ التعديلات' : '➕ إضافة الموظف'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Main Employees Page ──────────────────────────────────────────
export default function EmployeesPage() {
    const [employees, setEmployees] = useState([]);
    const [filtered, setFiltered] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [modal, setModal] = useState(null); // null | {} | {id, ...}
    const [toasts, setToasts] = useState([]);
    const [page, setPage] = useState(1);
    const PER_PAGE = 10;

    const addToast = useCallback((toast) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, ...toast }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
    }, []);

    // Fetch employees
    const fetchEmployees = useCallback(async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/employees`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('فشل تحميل بيانات الموظفين');
            const data = await res.json();
            const list = data.employees || data || [];
            setEmployees(list);
        } catch (err) {
            // Fall back to mock data if API doesn't exist yet
            setEmployees([
                { id: 1, name: 'أحمد محمد', email: 'ahmed@store.com', phone: '0501234567', role: 'manager', status: 'active', created_at: new Date().toISOString() },
                { id: 2, name: 'سارة خالد', email: 'sara@store.com', phone: '0551234567', role: 'sales', status: 'active', created_at: new Date().toISOString() },
                { id: 3, name: 'فهد عبدالله', email: 'fahad@store.com', phone: '0561234567', role: 'accounts', status: 'active', created_at: new Date().toISOString() },
            ]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    // Filter
    useEffect(() => {
        let list = [...employees];
        if (search) list = list.filter(e =>
            e.name?.toLowerCase().includes(search.toLowerCase()) ||
            e.email?.toLowerCase().includes(search.toLowerCase()) ||
            e.phone?.includes(search)
        );
        if (roleFilter) list = list.filter(e => e.role === roleFilter);
        setFiltered(list);
        setPage(1);
    }, [employees, search, roleFilter]);

    const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);
    const totalPages = Math.ceil(filtered.length / PER_PAGE);

    // Handlers
    const handleSave = useCallback((saved) => {
        setEmployees(prev => {
            const idx = prev.findIndex(e => e.id === saved.id);
            if (idx >= 0) { const next = [...prev]; next[idx] = saved; return next; }
            return [saved, ...prev];
        });
        addToast({ type: 'success', title: 'تم الحفظ', text: `تم حفظ بيانات ${saved.name}` });
    }, [addToast]);

    const handleToggleStatus = useCallback(async (emp) => {
        try {
            const token = localStorage.getItem('token');
            const newStatus = emp.status === 'active' ? 'inactive' : 'active';
            await fetch(`${API_BASE}/employees/${emp.id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: newStatus } : e));
            addToast({ type: 'success', title: 'تم التحديث', text: `تم ${newStatus === 'active' ? 'تفعيل' : 'تعطيل'} ${emp.name}` });
        } catch {
            addToast({ type: 'danger', title: 'خطأ', text: 'فشل تحديث الحالة' });
        }
    }, [addToast]);

    const handleDelete = useCallback(async (emp) => {
        if (!window.confirm(`هل تريد حذف ${emp.name}؟`)) return;
        try {
            const token = localStorage.getItem('token');
            await fetch(`${API_BASE}/employees/${emp.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            setEmployees(prev => prev.filter(e => e.id !== emp.id));
            addToast({ type: 'success', title: 'تم الحذف', text: `تم حذف ${emp.name}` });
        } catch {
            addToast({ type: 'danger', title: 'خطأ', text: 'فشل الحذف' });
        }
    }, [addToast]);

    const activeCount = employees.filter(e => e.status === 'active').length;

    return (
        <div className="employees-page">
            <Toast toasts={toasts} />

            {modal && (
                <EmployeeModal
                    emp={modal.id ? modal : null}
                    onClose={() => setModal(null)}
                    onSave={handleSave}
                />
            )}

            {/* Header */}
            <div className="emp-header fade-up">
                <div>
                    <h1 className="emp-title">إدارة الموظفين</h1>
                    <p className="emp-subtitle">إضافة وتعديل وإدارة صلاحيات الفريق</p>
                </div>
                <button className="btn btn-primary" onClick={() => setModal({})}>
                    ➕ إضافة موظف
                </button>
            </div>

            {/* Stats */}
            <div className="emp-stats fade-up">
                <div className="emp-stat">
                    <div className="emp-stat-icon" style={{ background: 'rgba(255,107,53,0.12)', color: 'var(--coral)' }}>👥</div>
                    <div><div className="emp-stat-val">{employees.length}</div><div className="emp-stat-lbl">إجمالي الموظفين</div></div>
                </div>
                <div className="emp-stat">
                    <div className="emp-stat-icon" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>✅</div>
                    <div><div className="emp-stat-val">{activeCount}</div><div className="emp-stat-lbl">نشطون</div></div>
                </div>
                <div className="emp-stat">
                    <div className="emp-stat-icon" style={{ background: 'rgba(139,92,246,0.12)', color: '#8B5CF6' }}>🛡️</div>
                    <div><div className="emp-stat-val">{employees.filter(e => e.role === 'admin' || e.role === 'manager').length}</div><div className="emp-stat-lbl">مديرون</div></div>
                </div>
                <div className="emp-stat">
                    <div className="emp-stat-icon" style={{ background: 'rgba(59,130,246,0.12)', color: '#3B82F6' }}>📁</div>
                    <div><div className="emp-stat-val">{employees.filter(e => e.status !== 'active').length}</div><div className="emp-stat-lbl">غير نشطين</div></div>
                </div>
            </div>

            {/* Filter bar */}
            <div className="emp-filter-bar fade-up">
                <div className="emp-search-wrap">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="بحث بالاسم أو البريد أو الجوال..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select className="emp-filter-select" value={roleFilter} onChange={e => setRoleFilter(e.target.value)}>
                    <option value="">كل الأدوار</option>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
            </div>

            {/* Table */}
            <div className="emp-table-card fade-up">
                {loading ? (
                    <div className="emp-loading">
                        <div className="emp-spinner" />
                        <span>جاري تحميل البيانات...</span>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="emp-empty">
                        <div className="emp-empty-icon">👥</div>
                        <div className="emp-empty-title">
                            {search || roleFilter ? 'لا توجد نتائج' : 'لا يوجد موظفون بعد'}
                        </div>
                        <p className="emp-empty-sub">
                            {search || roleFilter
                                ? 'جرّب تغيير خيارات البحث'
                                : 'ابدأ بإضافة أول موظف لفريقك'}
                        </p>
                        {!search && !roleFilter && (
                            <button className="btn btn-primary btn-sm" style={{ marginTop: 8 }} onClick={() => setModal({})}>
                                ➕ إضافة موظف
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <table className="emp-table">
                            <thead>
                                <tr>
                                    <th>الموظف</th>
                                    <th>الدور</th>
                                    <th>رقم الجوال</th>
                                    <th>الحالة</th>
                                    <th>تاريخ الإضافة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginated.map(emp => (
                                    <tr key={emp.id}>
                                        <td>
                                            <div className="emp-avatar-cell">
                                                <div className="emp-avatar">{(emp.name || '؟')[0]}</div>
                                                <div>
                                                    <div className="emp-name">{emp.name}</div>
                                                    <div className="emp-email">{emp.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`role-badge ${emp.role || 'sales'}`}>
                                                {ROLE_LABELS[emp.role] || emp.role}
                                            </span>
                                        </td>
                                        <td style={{ color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>
                                            {emp.phone || '—'}
                                        </td>
                                        <td>
                                            <div className="emp-status">
                                                <div className={`emp-status-dot ${emp.status !== 'active' ? 'inactive' : 'active'}`} />
                                                <span style={{ color: emp.status === 'active' ? 'var(--success)' : 'var(--text-muted)' }}>
                                                    {emp.status === 'active' ? 'نشط' : 'غير نشط'}
                                                </span>
                                            </div>
                                        </td>
                                        <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                            {emp.created_at ? new Date(emp.created_at).toLocaleDateString('ar-SA') : '—'}
                                        </td>
                                        <td>
                                            <div className="emp-actions">
                                                <button
                                                    className="emp-action-btn edit"
                                                    title="تعديل"
                                                    onClick={() => setModal(emp)}
                                                >✏️</button>
                                                <button
                                                    className={`emp-action-btn deactivate`}
                                                    title={emp.status === 'active' ? 'تعطيل' : 'تفعيل'}
                                                    onClick={() => handleToggleStatus(emp)}
                                                >
                                                    {emp.status === 'active' ? '⏸️' : '▶️'}
                                                </button>
                                                <button
                                                    className="emp-action-btn delete"
                                                    title="حذف"
                                                    onClick={() => handleDelete(emp)}
                                                >🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="emp-pagination">
                                <span>{`${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, filtered.length)} من ${filtered.length}`}</span>
                                <div className="emp-pagination-btns">
                                    <button className="emp-page-btn" onClick={() => setPage(p => p - 1)} disabled={page === 1}>‹</button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(n => (
                                        <button key={n} className={`emp-page-btn ${page === n ? 'active' : ''}`} onClick={() => setPage(n)}>{n}</button>
                                    ))}
                                    <button className="emp-page-btn" onClick={() => setPage(p => p + 1)} disabled={page === totalPages}>›</button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
