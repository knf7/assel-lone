'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loansAPI, customersAPI } from '@/lib/api';
import { toast } from 'sonner';
import {
    IconUpload, IconDownload, IconPlus, IconTrash,
    IconWhatsapp, IconScale, IconEdit
} from '@/components/layout/icons';
import MoneyRain from '@/components/layout/MoneyRain';
import './loans.css';

const LoansPage = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const initialCache = useMemo(
        () => loansAPI.peekAll({ page: 1, limit: 20 }),
        []
    );
    const [loans, setLoans] = useState<any[]>(() => initialCache?.loans || []);
    const [loading, setLoading] = useState(!initialCache);
    const [filters, setFilters] = useState({
        search: '',
        status: '',
        startDate: '',
        endDate: '',
        delayed: false
    });
    const [pagination, setPagination] = useState({
        page: initialCache?.pagination?.page ?? 1,
        limit: initialCache?.pagination?.limit ?? 20,
        totalPages: initialCache?.pagination?.totalPages ?? 1
    });
    const [showImportModal, setShowImportModal] = useState(false);
    const [editingLoan, setEditingLoan] = useState<any>(null);
    const [showMoneyRain, setShowMoneyRain] = useState(false);
    const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);

    useEffect(() => {
        const statusParam = searchParams.get('status');
        const delayedParam = searchParams.get('delayed');
        if (statusParam || delayedParam) {
            setFilters(prev => ({
                ...prev,
                status: statusParam || '',
                delayed: delayedParam === 'true'
            }));
        }
    }, [searchParams]);

    const fetchLoans = useCallback(async (pageOverride?: number) => {
        try {
            const requestPage = pageOverride ?? pagination.page;
            const params = {
                ...filters,
                page: requestPage,
                limit: pagination.limit
            };
            const cached = loansAPI.peekAll(params);
            if (cached) {
                setLoans(cached.loans || []);
                setPagination(prev => ({
                    ...prev,
                    page: requestPage,
                    totalPages: cached.pagination?.totalPages ?? prev.totalPages
                }));
                setLoading(false);
            } else if (loans.length === 0) {
                setLoading(true);
            }
            const response = await loansAPI.getAll(params);
            const data = response.data || response;
            setLoans(data.loans || []);
            setPagination(prev => ({
                ...prev,
                page: requestPage,
                totalPages: data.pagination?.totalPages ?? 1
            }));
        } catch (error) {
            console.error('Failed to fetch loans:', error);
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.limit, pagination.page, loans.length]);

    useEffect(() => {
        fetchLoans();
    }, [fetchLoans]);

    const handleStatusChange = async (loanId: string, newStatus: string) => {
        try {
            await loansAPI.updateStatus(loanId, newStatus);
            if (newStatus === 'Paid') {
                setShowMoneyRain(true);
            }
            await fetchLoans();
        } catch (error: any) {
            try {
                await loansAPI.update(loanId, { status: newStatus });
                if (newStatus === 'Paid') {
                    setShowMoneyRain(true);
                }
                await fetchLoans();
                return;
            } catch (fallbackError: any) {
                toast.error(
                    fallbackError?.response?.data?.error ||
                    error?.response?.data?.error ||
                    fallbackError?.message ||
                    error?.message ||
                    'فشل تحديث الحالة'
                );
            }
        }
    };

    const handleDelete = (loanId: string) => {
        setDeleteLoanId(loanId);
    };

    const confirmDelete = async () => {
        if (!deleteLoanId) return;
        try {
            await loansAPI.delete(deleteLoanId);
            await fetchLoans();
            toast.success('تم حذف القرض');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'فشل حذف القرض');
        } finally {
            setDeleteLoanId(null);
        }
    };

    const handleExport = async () => {
        try {
            await loansAPI.export(filters);
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'فشل تصدير البيانات');
        }
    };

    return (
        <div className="loans-page-container">
            <MoneyRain isRaining={showMoneyRain} onComplete={() => setShowMoneyRain(false)} />

            <div className="page-header">
                <h1>إدارة القروض</h1>
                <div className="header-actions">
                    <button className="btn-export" onClick={() => setShowImportModal(true)}>
                        <IconUpload className="btn-icon-inline" size={16} /> استيراد قروض
                    </button>
                    <button className="btn-export" onClick={handleExport}>
                        <IconDownload className="btn-icon-inline" size={16} /> تصدير Excel
                    </button>
                    <button className="btn-primary" onClick={() => router.push('/dashboard/loans/new')}>
                        <IconPlus className="btn-icon-inline" size={16} /> إضافة قرض جديد
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
                    <option value="Paid">تم التسديد</option>
                    <option value="Raised">قضايا</option>
                    <option value="Cancelled">ملغي</option>
                </select>

                <input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="date-input"
                />

                <input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="date-input"
                />

                <button
                    className="btn-clear"
                    onClick={() => setFilters({ search: '', status: '', startDate: '', endDate: '', delayed: false })}
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
                                    <th>المبلغ الأساسي</th>
                                    <th>المبلغ النهائي</th>
                                    <th>المبلغ المرفوع عليه</th>
                                    <th>المبلغ المحصل</th>
                                    <th>المسار</th>
                                    <th>رقم السند</th>
                                    <th>الحالة</th>
                                    <th>تاريخ المعاملة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loans.length === 0 ? (
                                    <tr>
                                        <td colSpan={11} className="empty-state">
                                            لا توجد قروض مسجلة
                                        </td>
                                    </tr>
                                ) : (
                                    loans.map(loan => (
                                        <tr
                                            key={loan.id}
                                            className={(() => {
                                                const txDate = loan.transaction_date ? new Date(loan.transaction_date) : new Date();
                                                const now = new Date();
                                                const txMonthKey = txDate.getFullYear() * 12 + txDate.getMonth();
                                                const currentMonthKey = now.getFullYear() * 12 + now.getMonth();
                                                const isAfterMonthEnd = txMonthKey < currentMonthKey;
                                                if (loan.status === 'Paid') return 'loan-row-paid';
                                                if (loan.status === 'Raised') return 'loan-row-raised';
                                                if (loan.status === 'Active' && isAfterMonthEnd) return 'loan-row-overdue';
                                                return '';
                                            })()}
                                        >
                                            {(() => {
                                                const principal = parseFloat(loan.principal_amount || loan.amount || 0);
                                                const total = parseFloat(loan.amount || 0);
                                                const raised = parseFloat(loan.najiz_case_amount || 0);
                                                const collected = loan.status === 'Paid'
                                                    ? (parseFloat(loan.najiz_case_amount || loan.najiz_collected_amount || loan.amount || 0))
                                                    : (parseFloat(loan.najiz_collected_amount || 0));
                                                const caseTrack = loan.is_najiz_case || loan.najiz_case_number;
                                                return (
                                                    <>
                                            <td className="customer-name-cell">
                                                <div className="customer-main">{loan.customer_name}</div>
                                                <div className="customer-sub">عميل</div>
                                            </td>
                                            <td className="id-cell">{loan.national_id}</td>
                                            <td className="amount amount-cell">{principal.toLocaleString('en-US')} ﷼</td>
                                            <td className="amount amount-cell">{total.toLocaleString('en-US')} ﷼</td>
                                            <td className="amount amount-cell">{raised > 0 ? `${raised.toLocaleString('en-US')} ﷼` : '—'}</td>
                                            <td className="amount amount-cell">{collected > 0 ? `${collected.toLocaleString('en-US')} ﷼` : '—'}</td>
                                            <td>
                                                <span className={`status-badge status-track ${caseTrack ? 'status-overdue' : 'status-cancelled'}`}>
                                                    {caseTrack ? (loan.status === 'Paid' ? 'كان بالقضايا' : 'بالقضايا') : 'عادي'}
                                                </span>
                                            </td>
                                            <td className="receipt-cell">{loan.receipt_number || '-'}</td>
                                            <td>
                                                <span className={`status-badge status-flat status-${loan.status.toLowerCase()}`}>
                                                    {loan.status === 'Active' ? 'نشط' :
                                                        loan.status === 'Paid' ? 'تم التسديد' :
                                                            loan.status === 'Raised' ? 'قضايا' :
                                                                loan.status === 'Cancelled' ? 'ملغي' : loan.status}
                                                </span>
                                            </td>
                                            <td className="date-cell">{new Date(loan.transaction_date).toLocaleDateString('ar-SA')}</td>
                                            <td className="actions">
                                                <div className="actions-wrap">
                                                    <div className="actions-block-title">إجراءات عامة</div>
                                                    <div className="icon-actions">
                                                    <button
                                                        className="btn-action btn-edit"
                                                        onClick={() => setEditingLoan(loan)}
                                                        title="تعديل بيانات القرض"
                                                    >
                                                        <IconEdit size={15} />
                                                        <span>تعديل</span>
                                                    </button>

                                                    {loan.whatsappLink && (
                                                        <a
                                                            href={loan.whatsappLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn-action btn-whatsapp"
                                                            title="تواصل واتساب مباشر"
                                                        >
                                                            <IconWhatsapp size={15} />
                                                            <span>واتساب</span>
                                                        </a>
                                                    )}

                                                    {loan.national_id && (
                                                        <a
                                                            href="https://najiz.sa"
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="btn-action btn-najiz"
                                                            title="ناجز"
                                                        >
                                                            <IconScale size={15} />
                                                            <span>ناجز</span>
                                                        </a>
                                                    )}

                                                    <button
                                                        className="btn-action btn-delete"
                                                        onClick={() => handleDelete(loan.id)}
                                                        title="حذف"
                                                    >
                                                        <IconTrash size={15} />
                                                        <span>حذف</span>
                                                    </button>
                                                    </div>
                                                    <div className="actions-block-title">تغيير الحالة</div>
                                                    <div className="state-actions">
                                                        <button
                                                            className="btn-action-label btn-raised"
                                                            onClick={() => handleStatusChange(loan.id, 'Raised')}
                                                            disabled={loan.status === 'Raised'}
                                                        >
                                                            تحويل إلى قضايا
                                                        </button>
                                                        <button
                                                            className="btn-action-label btn-paid"
                                                            onClick={() => handleStatusChange(loan.id, 'Paid')}
                                                            disabled={loan.status === 'Paid'}
                                                        >
                                                            تحويل إلى تم التسديد
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>
                                                    </>
                                                );
                                            })()}
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

            {editingLoan && <EditLoanModal loan={editingLoan} onClose={() => setEditingLoan(null)} onSuccess={async () => {
                setEditingLoan(null);
                await fetchLoans();
                toast.success('تم تحديث بيانات القرض');
            }} />}
            {showImportModal && <ImportLoansModal onClose={() => setShowImportModal(false)} onSuccess={async () => {
                setShowImportModal(false);
                setShowMoneyRain(true);
                await fetchLoans(1);
                toast.success('تم استيراد القروض وتحديث القائمة');
            }} />}

            {deleteLoanId && (
                <div className="modal-overlay" onClick={() => setDeleteLoanId(null)}>
                    <div className="modal-content glass-card" style={{ maxWidth: '460px' }} onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>تأكيد حذف القرض</h2>
                            <button className="modal-close" onClick={() => setDeleteLoanId(null)}>×</button>
                        </div>
                        <p className="modal-hint">سيتم حذف القرض من القائمة، هل تريد المتابعة؟</p>
                        <div className="modal-actions">
                            <button type="button" className="btn-secondary" onClick={() => setDeleteLoanId(null)}>إلغاء</button>
                            <button type="button" className="btn-primary" onClick={confirmDelete}>تأكيد الحذف</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Modals ──────────────────────────────────────────

const ImportLoansModal = ({ onClose, onSuccess }: any) => {
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setMessage({ type: 'error', text: 'اختر ملفاً أولاً' });
            return;
        }
        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const response = await loansAPI.upload(formData);
            const data = response.data || response;
            const summary = data.summary || {};
            setMessage({ type: 'success', text: `تم استيراد ${summary.success ?? 0} قرض بنجاح` });
            setTimeout(() => onSuccess(), 1500);
        } catch (err: any) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'فشل رفع الملف' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>استيراد قروض من ملف</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <p className="modal-hint">يدعم الملفات: CSV أو Excel (.xlsx, .xls). الأعمدة المتوقع: رقم الهوية/العميل، المبلغ، رقم السند، التاريخ.</p>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>الملف</label>
                        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileChange} />
                        {file && <span className="file-name">{file.name}</span>}
                    </div>
                    {message.text && <div className={`${message.type}-message`}>{message.text}</div>}
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
                        <button type="submit" className="btn-primary" disabled={loading || !file}>{loading ? 'جاري الرفع...' : 'استيراد'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AddLoanModal = ({ onClose, onSuccess }: any) => {
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
    const [customers, setCustomers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, []);

    const fetchCustomers = async () => {
        try {
            const response = await customersAPI.getAll({ limit: 100 });
            const data = response.data || response;
            setCustomers(data.customers || []);
        } catch (error) {
            console.error('Failed to fetch customers:', error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...formData,
                amount: ((parseFloat(String(formData.principal_amount)) || 0) * (1 + (parseFloat(String(formData.profit_percentage)) || 0) / 100)).toFixed(2)
            };
            await loansAPI.create(payload);
            onSuccess();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'فشل إضافة القرض');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>إضافة قرض جديد</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group">
                        <label>العميل *</label>
                        <select required value={formData.customerId} onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}>
                            <option value="">اختر العميل</option>
                            {customers.map(c => <option key={c.id} value={c.id}>{c.full_name} - {c.national_id}</option>)}
                        </select>
                    </div>
                    <div className="form-group-row">
                        <div className="form-group">
                            <label>المبلغ الأساسي *</label>
                            <input type="number" required min="0" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ width: '120px' }}>
                            <label>نسبة الفائدة %</label>
                            <input type="number" min="0" max="100" value={formData.profit_percentage} onChange={(e) => setFormData({ ...formData, profit_percentage: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>المبلغ الإجمالي</label>
                        <input type="text" disabled value={((parseFloat(formData.principal_amount) || 0) * (1 + (formData.profit_percentage || 0) / 100)).toFixed(2) + ' ﷼'} className="input-highlight" />
                    </div>
                    <div className="form-group">
                        <label>الحالة</label>
                        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                            <option value="Active">نشط</option>
                            <option value="Paid">مدفوع</option>
                            <option value="Raised">مرتفع (ناجز)</option>
                        </select>
                    </div>
                    {formData.status === 'Raised' && (
                        <div className="najiz-section">
                            <div className="form-group"><label>رقم القضية</label><input type="text" value={formData.najiz_case_number} onChange={(e) => setFormData({ ...formData, najiz_case_number: e.target.value })} /></div>
                            <div className="form-group"><label>حالة القضية</label><input type="text" value={formData.najiz_status} onChange={(e) => setFormData({ ...formData, najiz_status: e.target.value })} /></div>
                        </div>
                    )}
                    <div className="form-group"><label>رقم السند</label><input type="text" value={formData.receiptNumber} onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })} /></div>
                    <div className="form-group"><label>تاريخ المعاملة *</label><input type="date" required value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} /></div>
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'جاري الحفظ...' : 'حفظ'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditLoanModal = ({ loan, onClose, onSuccess }: any) => {
    const [formData, setFormData] = useState({
        principal_amount: loan.principal_amount || loan.amount || '',
        profit_percentage: loan.profit_percentage || 0,
        status: loan.status || 'Active',
        receiptNumber: loan.receipt_number || '',
        transactionDate: loan.transaction_date ? new Date(loan.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        notes: loan.notes || '',
        najiz_case_number: loan.najiz_case_number || '',
        najiz_status: loan.najiz_status || ''
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                principal_amount: parseFloat(String(formData.principal_amount)) || 0,
                profit_percentage: Number(formData.profit_percentage) || 0,
                status: formData.status,
                receipt_number: formData.receiptNumber,
                transaction_date: formData.transactionDate,
                notes: formData.notes,
                najiz_case_number: formData.najiz_case_number,
                najiz_status: formData.najiz_status,
                amount: (
                    (parseFloat(String(formData.principal_amount)) || 0) *
                    (1 + (Number(formData.profit_percentage) || 0) / 100)
                ).toFixed(2)
            };
            await loansAPI.update(loan.id, payload);
            onSuccess();
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'فشل تعديل القرض');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content glass-card" style={{ maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>تعديل بيانات القرض</h2>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="form-group-row">
                        <div className="form-group">
                            <label>المبلغ الأساسي *</label>
                            <input type="number" required min="0" step="0.01" value={formData.principal_amount} onChange={(e) => setFormData({ ...formData, principal_amount: e.target.value })} />
                        </div>
                        <div className="form-group" style={{ width: '120px' }}>
                            <label>نسبة الفائدة %</label>
                            <input type="number" min="0" max="100" value={formData.profit_percentage} onChange={(e) => setFormData({ ...formData, profit_percentage: parseInt(e.target.value) || 0 })} />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>الحالة</label>
                        <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })}>
                            <option value="Active">نشط</option>
                            <option value="Paid">مدفوع</option>
                            <option value="Raised">مرتفع (ناجز)</option>
                        </select>
                    </div>
                    <div className="form-group"><label>رقم السند</label><input type="text" value={formData.receiptNumber} onChange={(e) => setFormData({ ...formData, receiptNumber: e.target.value })} /></div>
                    <div className="form-group"><label>تاريخ المعاملة *</label><input type="date" required value={formData.transactionDate} onChange={(e) => setFormData({ ...formData, transactionDate: e.target.value })} /></div>
                    <div className="modal-actions">
                        <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
                        <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'جاري الحفظ...' : 'حفظ التعديلات'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoansPage;
