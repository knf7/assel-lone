import React, { useState, useEffect, useCallback } from 'react';
import { FaWhatsapp, FaBalanceScale, FaEdit } from 'react-icons/fa';
import { customersAPI } from '../../services/api';
import Layout from '../../components/layout/Layout';
import './CustomersPage.css';

// ─── Add Customer Modal ───
function AddCustomerModal({ onClose, onSaved }) {
    const [form, setForm] = useState({ full_name: '', national_id: '', mobile_number: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async e => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await customersAPI.create({
                fullName: form.full_name,
                nationalId: form.national_id,
                mobileNumber: form.mobile_number,
                email: form.email
            });
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء الحفظ');
        } finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2 className="modal-title"> إضافة عميل جديد</h2>
                    <button className="modal-close" onClick={onClose}></button>
                </div>
                {error && <div className="form-error">{error}</div>}
                <form onSubmit={submit} className="modal-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">الاسم الكامل *</label>
                            <input className="form-input" name="full_name" value={form.full_name} onChange={handle} placeholder="محمد عبدالله" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">رقم الهوية *</label>
                            <input className="form-input" name="national_id" value={form.national_id} onChange={handle} placeholder="1XXXXXXXXX" required />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">رقم الجوال *</label>
                            <input className="form-input" name="mobile_number" value={form.mobile_number} onChange={handle} placeholder="05XXXXXXXX" required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">البريد الإلكتروني</label>
                            <input className="form-input" type="email" name="email" value={form.email} onChange={handle} placeholder="email@example.com" />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? '⏳ جاري الحفظ...' : ' حفظ العميل'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// ─── Edit Customer Modal ───
function EditCustomerModal({ customer, onClose, onSaved }) {
    const [form, setForm] = useState({
        full_name: customer.full_name || '',
        national_id: customer.national_id || '',
        mobile_number: customer.mobile_number || '',
        email: customer.email || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = e => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async e => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            await customersAPI.update(customer.id, {
                fullName: form.full_name,
                nationalId: form.national_id,
                mobileNumber: form.mobile_number,
                email: form.email
            });
            onSaved();
        } catch (err) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء التعديل');
        } finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box">
                <div className="modal-header">
                    <h2 className="modal-title">️ تعديل بيانات العميل</h2>
                    <button className="modal-close" onClick={onClose}></button>
                </div>
                {error && <div className="form-error">{error}</div>}
                <form onSubmit={submit} className="modal-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">الاسم الكامل *</label>
                            <input className="form-input" name="full_name" value={form.full_name} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">رقم الهوية *</label>
                            <input className="form-input" name="national_id" value={form.national_id} onChange={handle} required />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">رقم الجوال *</label>
                            <input className="form-input" name="mobile_number" value={form.mobile_number} onChange={handle} required />
                        </div>
                        <div className="form-group">
                            <label className="form-label">البريد الإلكتروني</label>
                            <input className="form-input" type="email" name="email" value={form.email} onChange={handle} />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? '⏳ جاري الحفظ...' : ' حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}


// ─── Main Page ───
export default function CustomersPage() {
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showAdd, setShowAdd] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState(null);

    // Get merchant tier
    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');
    const plan = merchant.subscription_plan?.toLowerCase();
    const isProOrEnterprise = plan === 'pro' || plan === 'enterprise';

    const fetchCustomers = useCallback(async () => {
        setLoading(true);
        try {
            const res = await customersAPI.getAll({ page, limit: 15, search: search || undefined });
            const d = res.data;
            setCustomers(d.customers || []);
            setTotalPages(d.pagination?.totalPages ?? 1);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [page, search]);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    // CSV export
    const exportCSV = async () => {
        const res = await customersAPI.getAll({ limit: 9999 });
        const list = res.data.customers || [];
        const headers = ['الاسم', 'رقم الهوية', 'الجوال', 'إجمالي الدين'];
        const rows = list.map(c => [c.full_name, c.national_id, c.mobile_number, c.total_debt || 0]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `customers-${Date.now()}.csv`;
        link.click();
    };

    return (
        <Layout>
            {showAdd && (
                <AddCustomerModal
                    onClose={() => setShowAdd(false)}
                    onSaved={() => { setShowAdd(false); fetchCustomers(); }}
                />
            )}

            {editingCustomer && (
                <EditCustomerModal
                    customer={editingCustomer}
                    onClose={() => setEditingCustomer(null)}
                    onSaved={() => { setEditingCustomer(null); fetchCustomers(); }}
                />
            )}

            {/* Header */}
            <div className="page-top fade-up">
                <div>
                    <h1 className="page-title">العملاء</h1>
                    <p className="page-sub">{customers.length} عميل معروض</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={exportCSV}> تصدير CSV</button>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ عميل جديد</button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="toolbar-card glass-card fade-up">
                <div className="search-wrap">
                    <span className="search-icon"></span>
                    <input
                        className="search-field"
                        placeholder="ابحث بالاسم أو رقم الهوية أو الجوال..."
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1); }}
                    />
                </div>
            </div>

            {/* Table */}
            <div className="table-card fade-up">
                {loading ? (
                    <div className="table-loading">
                        <div className="db-spinner" />
                        <p>جاري التحميل...</p>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="table-empty">
                        <span></span>
                        <p>لا يوجد عملاء{search ? ' بهذا البحث' : ' بعد'}</p>
                        {!search && <button className="btn btn-primary" onClick={() => setShowAdd(true)}>إضافة أول عميل</button>}
                    </div>
                ) : (
                    <div className="table-scroll">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    <th>الاسم</th>
                                    <th>رقم الهوية</th>
                                    <th>الجوال</th>
                                    <th>إجمالي الدين</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c, i) => {
                                    const debt = parseFloat(c.total_debt || 0);
                                    const isOverdue = c.status === 'Overdue' || debt > 0;
                                    return (
                                        <tr key={c.id} className={isOverdue && debt > 0 ? 'row-overdue' : ''}>
                                            <td className="td-num">{(page - 1) * 15 + i + 1}</td>
                                            <td>
                                                <div className="customer-cell">
                                                    <div className="customer-avatar" style={{ background: `hsl(${(c.full_name?.charCodeAt(0) || 0) * 40},60%,55%)` }}>
                                                        {(c.full_name || '؟')[0]}
                                                    </div>
                                                    <span className="customer-name">{c.full_name}</span>
                                                </div>
                                            </td>
                                            <td className="td-mono">{c.national_id || '—'}</td>
                                            <td className="td-mono">{c.mobile_number || '—'}</td>
                                            <td className={`td-amount ${debt > 0 ? 'amount-debt' : 'amount-zero'}`}>
                                                {debt > 0 ? `${debt.toLocaleString('ar-SA')} ر.س` : ' لا دين'}
                                            </td>
                                            <td>
                                                {debt > 0 ? (
                                                    <span className="badge badge-danger">️ لديه دين</span>
                                                ) : (
                                                    <span className="badge badge-success"> مدفوع</span>
                                                )}
                                            </td>
                                            <td>
                                                <div className="action-btns" style={{ display: 'flex', gap: '8px' }}>
                                                    <button
                                                        className="btn-action btn-edit"
                                                        onClick={() => setEditingCustomer(c)}
                                                        title="تعديل بيانات العميل"
                                                        style={{ color: 'var(--accent)', background: 'var(--glass-border)', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                                                    >
                                                        <FaEdit size={16} />
                                                    </button>

                                                    {isProOrEnterprise && (
                                                        <>
                                                            {c.whatsappLink && (
                                                                <a
                                                                    href={c.whatsappLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn-action btn-whatsapp"
                                                                    title="واتساب مباشر (باقة برو/أعمال)"
                                                                >
                                                                    <FaWhatsapp size={16} />
                                                                </a>
                                                            )}
                                                            {c.najizLink && (
                                                                <a
                                                                    href={c.najizLink}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="btn-action btn-najiz"
                                                                    title="ناجز (باقة برو/أعمال)"
                                                                >
                                                                    <FaBalanceScale size={16} />
                                                                </a>
                                                            )}
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="pagination">
                        <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹ السابق</button>
                        <span className="page-info">صفحة {page} من {totalPages}</span>
                        <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>التالي ›</button>
                    </div>
                )}
            </div>
        </Layout>
    );
}
