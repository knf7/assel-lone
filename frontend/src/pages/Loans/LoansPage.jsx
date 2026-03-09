import React, { useState, useEffect } from 'react';
import { FiUpload, FiDownload, FiPlus, FiCheck, FiTrash2 } from 'react-icons/fi';
import { FaWhatsapp, FaBalanceScale, FaEdit } from 'react-icons/fa';
import { loansAPI } from '../../services/api';
import Layout from '../../components/layout/Layout';
import MoneyRain from '../../components/ui/MoneyRain';
import './LoansPage.css';

const LoansPage = () => {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        startDate: '',
        endDate: '',
        delayed: false
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        totalPages: 1
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingLoan, setEditingLoan] = useState(null);
    const [showMoneyRain, setShowMoneyRain] = useState(false);

    // Get merchant tier
    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');
    const plan = merchant.subscription_plan?.toLowerCase();
    const isProOrEnterprise = plan === 'pro' || plan === 'enterprise';

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const statusParam = params.get('status');
        const delayedParam = params.get('delayed');
        if (statusParam || delayedParam) {
            setFilters(prev => ({
                ...prev,
                status: statusParam || '',
                delayed: delayedParam === 'true'
            }));
        }
    }, []);

    useEffect(() => {
        fetchLoans();
    }, [filters, pagination.page]);

    const fetchLoans = async () => {
        try {
            setLoading(true);
            const response = await loansAPI.getAll({
                ...filters,
                page: pagination.page,
                limit: pagination.limit
            });
            const data = response.data || response;
            setLoans(data.loans || []);
            setPagination(prev => ({
                ...prev,
                totalPages: data.pagination?.totalPages ?? 1
            }));
        } catch (error) {
            console.error('Failed to fetch loans:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (loanId, newStatus) => {
        try {
            await loansAPI.updateStatus(loanId, newStatus);
            if (newStatus === 'Paid') {
                setShowMoneyRain(true);
            }
            fetchLoans();
        } catch (error) {
            alert('فشل تحديث الحالة');
        }
    };

    const handleDelete = async (loanId) => {
        const confirmText = window.prompt('تأكيد الحذف: اكتب كلمة "حذف" في المربع أدناه للحذف النهائي.');
        if (confirmText !== 'حذف') return;

        try {
            await loansAPI.delete(loanId);
            fetchLoans();
        } catch (error) {
            alert('فشل حذف القرض');
        }
    };

    const handleExport = async () => {
        try {
            await loansAPI.export(filters);
        } catch (error) {
            alert('فشل تصدير البيانات');
        }
    };

    return (
        <Layout>
            <MoneyRain isRaining={showMoneyRain} onComplete={() => setShowMoneyRain(false)} />
            <div className="page-header">
                <h1>إدارة القروض</h1>
                <div className="header-actions">
                    <button className="btn-export" onClick={() => setShowImportModal(true)}>
                        <FiUpload className="btn-icon-inline" /> استيراد قروض
                    </button>
                    <button className="btn-export" onClick={handleExport}>
                        <FiDownload className="btn-icon-inline" /> تصدير Excel
                    </button>
                    <button className="btn-primary" onClick={() => setShowAddModal(true)}>
                        <FiPlus className="btn-icon-inline" /> إضافة قرض جديد
                    </button>
                </div>
            </div>

            <div className="filters-section">
                <input
                    type="text"
                    placeholder="بحث بالاسم أو رقم الهوية..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="search-input"
                />

                <select
                    value={filters.status}
                    onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                    className="filter-select"
                >
                    <option value="">كل الحالات</option>
                    <option value="Active">نشط</option>
                    <option value="Paid">مدفوع</option>
                    <option value="Raised">مرتفع (ناجز)</option>
                    <option value="Cancelled">ملغي</option>
                </select>

                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="date-input"
                    placeholder="من تاريخ"
                />

                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="date-input"
                    placeholder="إلى تاريخ"
                />

                <button
                    className="btn-clear"
                    onClick={() => setFilters({ search: '', status: '', startDate: '', endDate: '' })}
                >
                    مسح الفلاتر
                </button>
            </div>

            {loading ? (
                <div className="loading">جاري التحميل...</div>
            ) : (
                <>
                    <div className="loans-table-container">
                        <table className="loans-table">
                            <thead>
                                <tr>
                                    <th>اسم العميل</th>
                                    <th>رقم الهوية</th>
                                    <th>المبلغ</th>
                                    <th>رقم الإيصال</th>
                                    <th>الحالة</th>
                                    <th>تاريخ المعاملة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loans.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="empty-state">
                                            لا توجد قروض مسجلة
                                        </td>
                                    </tr>
                                ) : (
                                    loans.map(loan => (
                                        <tr key={loan.id}>
                                            <td>{loan.customer_name}</td>
                                            <td>{loan.national_id}</td>
                                            <td className="amount">{parseFloat(loan.amount).toLocaleString('ar-SA')} ريال</td>
                                            <td>{loan.receipt_number || '-'}</td>
                                            <td>
                                                <span className={`status-badge status-${loan.status.toLowerCase()}`}>
                                                    {loan.status === 'Active' ? 'نشط' :
                                                        loan.status === 'Paid' ? 'تم الدفع' :
                                                            loan.status === 'Raised' ? 'تم الرفع (ناجز)' :
                                                                loan.status === 'Cancelled' ? 'ملغي' : loan.status}
                                                </span>
                                            </td>
                                            <td>{new Date(loan.transaction_date).toLocaleDateString('ar-SA')}</td>
                                            <td className="actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                                <button
                                                    className="btn-action btn-edit"
                                                    onClick={() => setEditingLoan(loan)}
                                                    title="تعديل بيانات القرض"
                                                    style={{ color: 'var(--accent)', background: 'var(--glass-border)', padding: '6px', borderRadius: '6px', border: 'none', cursor: 'pointer' }}
                                                >
                                                    <FaEdit size={16} />
                                                </button>

                                                {loan.whatsappLink && (
                                                    <a
                                                        href={loan.whatsappLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-action btn-whatsapp"
                                                        title="تواصل واتساب مباشر"
                                                    >
                                                        <FaWhatsapp size={16} />
                                                    </a>
                                                )}
                                                {loan.najizLink && (
                                                    <a
                                                        href={loan.najizLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn-action btn-najiz"
                                                        title="ناجز"
                                                    >
                                                        <FaBalanceScale size={16} />
                                                    </a>
                                                )}

                                                {loan.status === 'Active' && (
                                                    <button
                                                        className="btn-action btn-raised"
                                                        onClick={() => handleStatusChange(loan.id, 'Raised')}
                                                        title="تحويل لناجز"
                                                        style={{ background: 'var(--accent)', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', border: 'none', fontWeight: 'bold' }}
                                                    >
                                                        تحويل لناجز
                                                    </button>
                                                )}
                                                {loan.status === 'Active' && (
                                                    <button
                                                        className="btn-action btn-paid"
                                                        onClick={() => handleStatusChange(loan.id, 'Paid')}
                                                        title="تحويل لمدفوع"
                                                        style={{ background: '#22C55E', color: '#fff', fontSize: '0.75rem', padding: '4px 8px', borderRadius: '4px', border: 'none', fontWeight: 'bold' }}
                                                    >
                                                        تحويل لمدفوع
                                                    </button>
                                                )}
                                                <button
                                                    className="btn-action btn-delete"
                                                    onClick={() => handleDelete(loan.id)}
                                                    title="حذف"
                                                >
                                                    <FiTrash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {pagination.totalPages > 1 && (
                        <div className="pagination">
                            <button
                                disabled={pagination.page === 1}
                                onClick={() => setPagination({ ...pagination, page: pagination.page - 1 })}
                            >
                                السابق
                            </button>
                            <span>صفحة {pagination.page} من {pagination.totalPages}</span>
                            <button
                                disabled={pagination.page === pagination.totalPages}
                                onClick={() => setPagination({ ...pagination, page: pagination.page + 1 })}
                            >
                                التالي
                            </button>
                        </div>
                    )}
                </>
            )}

            {showAddModal && (
                <AddLoanModal
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => {
                        setShowAddModal(false);
                        setShowMoneyRain(true);
                        fetchLoans();
                    }}
                />
            )}

            {editingLoan && (
                <EditLoanModal
                    loan={editingLoan}
                    onClose={() => setEditingLoan(null)}
                    onSuccess={() => {
                        setEditingLoan(null);
                        fetchLoans();
                    }}
                />
            )}

            {showImportModal && (
                <ImportLoansModal
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => {
                        setShowImportModal(false);
                        setShowMoneyRain(true);
                        fetchLoans();
                    }}
                />
            )}
        </Layout>
    );
};

// Import Loans Modal: CSV or XLSX via POST /api/loans/upload
const ImportLoansModal = ({ onClose, onSuccess }) => {
    const [file, setFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleFileChange = (e) => {
        const f = e.target.files?.[0];
        if (!f) return;
        const name = (f.name || '').toLowerCase();
        if (!name.endsWith('.csv') && !name.endsWith('.xlsx') && !name.endsWith('.xls')) {
            setMessage({ type: 'error', text: 'يرجى اختيار ملف CSV أو Excel (.csv, .xlsx, .xls)' });
            setFile(null);
            return;
        }
        setFile(f);
        setMessage({ type: '', text: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage({ type: 'error', text: 'اختر ملفاً أولاً' });
            return;
        }
        setLoading(true);
        setMessage({ type: '', text: '' });
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await loansAPI.upload(formData);
            const data = response.data || response;
            const summary = data.summary || {};
            const successCount = summary.success ?? 0;
            const failed = summary.failed ?? 0;
            const errors = summary.errors || [];
            let text = `تم استيراد ${successCount} قرض بنجاح`;
            if (failed > 0) text += `، وفشل ${failed}`;
            setMessage({ type: 'success', text });
            if (errors.length > 0) setMessage(m => ({ ...m, text: m.text + '. ' + errors.slice(0, 3).join('؛ ') }));
            setTimeout(() => onSuccess(), 1500);
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'فشل رفع الملف';
            setMessage({ type: 'error', text: msg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>استيراد قروض من ملف</h2>
                    <button type="button" className="modal-close" onClick={onClose}>×</button>
                </div>
                <p className="modal-hint">يدعم الملفات: CSV أو Excel (.xlsx, .xls). الأعمدة المتوقعة: رقم الهوية/العميل، المبلغ، رقم الإيصال، التاريخ.</p>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>الملف</label>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            onChange={handleFileChange}
                        />
                        {file && <span className="file-name">{file.name}</span>}
                    </div>
                    {message.text && (
                        <div className={message.type === 'error' ? 'error-message' : 'success-message'}>
                            {message.text}
                        </div>
                    )}
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
                        <button type="submit" className="btn-primary" disabled={loading || !file}>
                            {loading ? 'جاري الرفع...' : 'استيراد'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Add Loan Modal Component
const AddLoanModal = ({ onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        customerId: '',
        principal_amount: '',
        profit_percentage: 0,
        status: 'Active',
        receiptNumber: '',
        transactionDate: new Date().toISOString().split('T')[0],
        notes: '',
        najiz_case_number: '',
        najiz_case_amount: '',
        najiz_status: ''
    });
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const { customersAPI } = await import('../../services/api');
            const response = await customersAPI.getAll({ limit: 100 });
            const data = response.data || response;
            setCustomers(data.customers || []);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                amount: ((parseFloat(formData.principal_amount) || 0) * (1 + (parseFloat(formData.profit_percentage) || 0) / 100)).toFixed(2)
            };
            await loansAPI.create(payload);
            onSuccess();
        } catch (error) {
            alert('فشل إضافة القرض');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>إضافة قرض جديد</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>العميل *</label>
                        <select
                            required
                            value={formData.customerId}
                            onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                        >
                            <option value="">اختر العميل</option>
                            {customers.map(customer => (
                                <option key={customer.id} value={customer.id}>
                                    {customer.full_name} - {customer.national_id}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group row-group" style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label>المبلغ الأساسي (رأس المال) *</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.principal_amount}
                                onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                            />
                        </div>
                        <div style={{ width: '120px' }}>
                            <label>نسبة الفائدة %</label>
                            <input
                                type="number"
                                className="native-spinner-input"
                                value={formData.profit_percentage}
                                step="1"
                                min="0"
                                max="100"
                                onChange={(e) => setFormData({ ...formData, profit_percentage: e.target.value })}
                                style={{ width: '100%', textAlign: 'center' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>المبلغ الإجمالي (شامل الفائدة)</label>
                        <input
                            type="number"
                            disabled
                            value={((parseFloat(formData.principal_amount) || 0) * (1 + (parseFloat(formData.profit_percentage) || 0) / 100)).toFixed(2)}
                            style={{ background: 'var(--glass-bg)', color: 'var(--accent)' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>الحالة</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="Active">نشط</option>
                            <option value="Paid">مدفوع</option>
                            <option value="Raised">مرتفع (ناجز)</option>
                            <option value="Cancelled">ملغي</option>
                        </select>
                    </div>

                    {formData.status === 'Raised' && (
                        <div className="najiz-fields" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--accent)' }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--accent)' }}>بيانات قضية ناجز</h3>
                            <div className="form-group">
                                <label>رقم القضية</label>
                                <input
                                    type="text"
                                    value={formData.najiz_case_number}
                                    onChange={(e) => setFormData({ ...formData, najiz_case_number: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>مبلغ القضية (مبلغ السند)</label>
                                <input
                                    type="number"
                                    value={formData.najiz_case_amount}
                                    placeholder="اختياري"
                                    onChange={(e) => setFormData({ ...formData, najiz_case_amount: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>حالة القضية</label>
                                <input
                                    type="text"
                                    value={formData.najiz_status}
                                    onChange={(e) => setFormData({ ...formData, najiz_status: e.target.value })}
                                    placeholder="مثال: قيد التنفيذ، منتهية"
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>رقم الإيصال</label>
                        <input
                            type="text"
                            value={formData.receiptNumber}
                            onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>تاريخ المعاملة *</label>
                        <input
                            type="date"
                            required
                            value={formData.transactionDate}
                            onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>ملاحظات</label>
                        <textarea
                            rows="3"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            إلغاء
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'جاري الحفظ...' : 'حفظ'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// Edit Loan Modal Component
const EditLoanModal = ({ loan, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        principal_amount: loan.principal_amount || loan.amount || '',
        profit_percentage: loan.profit_percentage || 0,
        status: loan.status || 'Active',
        receiptNumber: loan.receipt_number || '',
        transactionDate: loan.transaction_date ? new Date(loan.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: loan.notes || '',
        najiz_case_number: loan.najiz_case_number || '',
        najiz_case_amount: loan.najiz_case_amount || '',
        najiz_status: loan.najiz_status || ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                principal_amount: parseFloat(formData.principal_amount) || 0,
                profit_percentage: parseFloat(formData.profit_percentage) || 0,
                status: formData.status,
                receipt_number: formData.receiptNumber,
                transaction_date: formData.transactionDate,
                notes: formData.notes,
                najiz_case_number: formData.najiz_case_number,
                najiz_case_amount: formData.najiz_case_amount === '' ? null : (parseFloat(formData.najiz_case_amount) || 0),
                najiz_status: formData.najiz_status,
                amount: ((parseFloat(formData.principal_amount) || 0) * (1 + (parseFloat(formData.profit_percentage) || 0) / 100)).toFixed(2)
            };
            await loansAPI.update(loan.id, payload);
            onSuccess();
        } catch (error) {
            alert(error?.response?.data?.error || 'فشل تعديل القرض');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>️ تعديل بيانات القرض</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group row-group" style={{ display: 'flex', gap: '15px' }}>
                        <div style={{ flex: 1 }}>
                            <label>المبلغ الأساسي (رأس المال) *</label>
                            <input
                                type="number"
                                required
                                min="0"
                                step="0.01"
                                value={formData.principal_amount}
                                onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })}
                            />
                        </div>
                        <div style={{ width: '120px' }}>
                            <label>نسبة الفائدة %</label>
                            <input
                                type="number"
                                className="native-spinner-input"
                                value={formData.profit_percentage}
                                step="1"
                                min="0"
                                max="100"
                                onChange={(e) => setFormData({ ...formData, profit_percentage: e.target.value })}
                                style={{ width: '100%', textAlign: 'center' }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>المبلغ الإجمالي (شامل الفائدة)</label>
                        <input
                            type="number"
                            disabled
                            value={((parseFloat(formData.principal_amount) || 0) * (1 + (parseFloat(formData.profit_percentage) || 0) / 100)).toFixed(2)}
                            style={{ background: 'var(--glass-bg)', color: 'var(--accent)' }}
                        />
                    </div>

                    <div className="form-group">
                        <label>الحالة</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        >
                            <option value="Active">نشط</option>
                            <option value="Paid">مدفوع</option>
                            <option value="Raised">مرتفع (ناجز)</option>
                            <option value="Cancelled">ملغي</option>
                        </select>
                    </div>

                    {formData.status === 'Raised' && (
                        <div className="najiz-fields" style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginBottom: '20px', border: '1px solid var(--accent)' }}>
                            <h3 style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--accent)' }}>بيانات قضية ناجز</h3>
                            <div className="form-group">
                                <label>رقم القضية</label>
                                <input
                                    type="text"
                                    value={formData.najiz_case_number}
                                    onChange={(e) => setFormData({ ...formData, najiz_case_number: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>مبلغ القضية (مبلغ السند)</label>
                                <input
                                    type="number"
                                    value={formData.najiz_case_amount}
                                    placeholder="اختياري"
                                    onChange={(e) => setFormData({ ...formData, najiz_case_amount: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>حالة القضية</label>
                                <input
                                    type="text"
                                    value={formData.najiz_status}
                                    onChange={(e) => setFormData({ ...formData, najiz_status: e.target.value })}
                                    placeholder="مثال: قيد التنفيذ، منتهية"
                                />
                            </div>
                        </div>
                    )}

                    <div className="form-group">
                        <label>رقم الإيصال</label>
                        <input
                            type="text"
                            value={formData.receiptNumber}
                            onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>تاريخ المعاملة *</label>
                        <input
                            type="date"
                            required
                            value={formData.transactionDate}
                            onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })}
                        />
                    </div>

                    <div className="form-group">
                        <label>ملاحظات</label>
                        <textarea
                            rows="2"
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        />
                    </div>

                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>
                            إلغاء
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoansPage;
