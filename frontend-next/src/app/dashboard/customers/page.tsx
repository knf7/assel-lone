'use client';

import React, { useState, useEffect, useCallback, useMemo, useDeferredValue, useTransition, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { customersAPI } from '@/lib/api';
import { toast } from 'sonner';
import { IconWhatsapp, IconScale, IconEdit } from '@/components/layout/icons';
import { useDataSync } from '@/hooks/useDataSync';
import { useDebounce } from '@/hooks/useDebounce';
import './customers.css';

export default function CustomersPage() {
    const router = useRouter();
    const initialCache = useMemo(
        () => customersAPI.peekAll({ page: 1, limit: 15, include_stats: false }),
        []
    );
    const [customers, setCustomers] = useState<any[]>(() => initialCache?.customers || []);
    const [loading, setLoading] = useState(!initialCache);
    const [errorMsg, setErrorMsg] = useState('');
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebounce(search, 350);
    const deferredSearch = useDeferredValue(debouncedSearch);
    const [, startTransition] = useTransition();
    const [page, setPage] = useState<number>(initialCache?.pagination?.page ?? 1);
    const [totalPages, setTotalPages] = useState<number>(initialCache?.pagination?.totalPages ?? 1);
    const [showAdd, setShowAdd] = useState(false);
    const [editingCustomer, setEditingCustomer] = useState<any>(null);
    const [ratingCustomer, setRatingCustomer] = useState<any>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const requestIdRef = useRef(0);
    const statsRequestRef = useRef(0);
    const customersRef = useRef<any[]>(initialCache?.customers || []);
    const hasVisibleCustomersRef = useRef(Boolean(initialCache?.customers?.length));

    const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const shouldRetry = (err: any) => {
        const status = err?.response?.status;
        if (!status) return true;
        if (status === 401 || status === 403) return false;
        return status >= 500 || status === 429;
    };

    const loadCustomerStats = useCallback(async (list: any[]) => {
        const ids = list.map((c) => c.id).filter(Boolean);
        if (ids.length === 0) return;
        const requestId = ++statsRequestRef.current;
        try {
            const res = await customersAPI.getStats(ids);
            if (requestId !== statsRequestRef.current) return;
            const stats = res.data?.stats || res.stats || {};
            setCustomers((prev) => prev.map((c) => {
                const stat = stats[c.id];
                if (!stat) return c;
                return { ...c, ...stat, stats_pending: false };
            }));
        } catch {
            // keep lightweight list if stats fail
        }
    }, []);

    useEffect(() => {
        customersRef.current = customers;
    }, [customers]);

    const fetchCustomers = useCallback(async (pageOverride?: number) => {
        const requestId = ++requestIdRef.current;
        const requestPage = pageOverride ?? page;
        const searchValue = deferredSearch.trim();
        const skipCount = Boolean(searchValue);
        const includeStats = false;
        const params = {
            page: requestPage,
            limit: 15,
            search: searchValue || undefined,
            skip_count: skipCount || undefined,
            include_stats: includeStats ? undefined : false
        };
        const cached = customersAPI.peekAll(params);
        const usedCache = Boolean(cached);
        if (cached) {
            const cachedList = cached.customers || [];
            const nextCustomers = includeStats
                ? cachedList
                : cachedList.map((c: any) => ({ ...c, stats_pending: true }));
            hasVisibleCustomersRef.current = hasVisibleCustomersRef.current || nextCustomers.length > 0;
            setCustomers(nextCustomers);
            setPage(requestPage);
            setTotalPages(cached.pagination?.totalPages ?? 1);
            setLoading(false);
            if (!includeStats) {
                loadCustomerStats(nextCustomers);
            }
        } else if (customersRef.current.length === 0) {
            setLoading(true);
        }
        setErrorMsg('');
        try {
            const performRequest = async (attempt = 0): Promise<any> => {
                try {
                    return await customersAPI.getAll(params);
                } catch (err) {
                    if (shouldRetry(err) && attempt < 2) {
                        await delay(400 * (attempt + 1));
                        return performRequest(attempt + 1);
                    }
                    throw err;
                }
            };

            const res = await performRequest();
            if (requestId !== requestIdRef.current) return;
            const d = res.data;
            const list = d.customers || [];
            const nextCustomers = includeStats
                ? list
                : list.map((c: any) => ({ ...c, stats_pending: true }));
            hasVisibleCustomersRef.current = hasVisibleCustomersRef.current || nextCustomers.length > 0;
            setCustomers(nextCustomers);
            setPage(requestPage);
            const nextTotalPages = d.pagination?.totalPages ?? 1;
            setTotalPages(nextTotalPages);

            if (requestPage < nextTotalPages) {
                customersAPI.prefetchAll({ ...params, page: requestPage + 1 });
            }
            if (requestPage > 1) {
                customersAPI.prefetchAll({ ...params, page: requestPage - 1 });
            }
            if (!includeStats) {
                loadCustomerStats(nextCustomers);
            }
        } catch (err: any) {
            if (requestId !== requestIdRef.current) return;
            const hasExisting = hasVisibleCustomersRef.current || customersRef.current.length > 0 || usedCache;
            if (!hasExisting) {
                setCustomers([]);
                setTotalPages(1);
            }
            const status = err?.response?.status;
            if (status === 401) {
                setErrorMsg('انتهت الجلسة. الرجاء تسجيل الدخول من جديد.');
            } else if (status === 403) {
                setErrorMsg('غير مصرح. تأكد من صلاحيات الحساب أو الاشتراك.');
            } else if (status >= 500) {
                if (hasExisting) {
                    setErrorMsg('');
                    toast.warning('تعذر تحديث القائمة الآن، تم عرض آخر بيانات محفوظة.');
                } else {
                    setErrorMsg('خطأ في الخادم. حاول مرة أخرى بعد قليل.');
                }
            } else {
                if (hasExisting) {
                    setErrorMsg('');
                    toast.warning('تعذر الاتصال بالخادم الآن، تم عرض آخر بيانات محفوظة.');
                } else {
                    setErrorMsg('تعذر الاتصال بالخادم. تحقق من إعدادات الـ API أو أعد المحاولة.');
                }
            }
        }
        finally { setLoading(false); }
    }, [page, deferredSearch]);

    useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

    const scheduleRefresh = useCallback((delay = 250) => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => fetchCustomers(page), delay);
    }, [fetchCustomers, page]);

    useDataSync(() => {
        scheduleRefresh(200);
    }, { scopes: ['customers', 'loans', 'dashboard'], debounceMs: 200 });

    const exportCSV = async () => {
        const res = await customersAPI.getAll({ limit: 9999 });
        const list = res.data.customers || [];
        const headers = ['الاسم', 'رقم الهوية', 'الجوال', 'إجمالي الدين'];
        const rows = list.map((c: any) => [c.full_name, c.national_id, c.mobile_number, c.total_debt || 0]);
        const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `customers-${Date.now()}.csv`;
        link.click();
    };

    const totalCustomers = customers.length;
    const statsLoading = customers.some((c) => c.stats_pending);
    const customersWithDebt = statsLoading ? 0 : customers.filter((c) => parseFloat(c.total_debt || 0) > 0).length;
    const clearCustomers = statsLoading ? 0 : totalCustomers - customersWithDebt;
    const pageItems = useMemo(() => {
        const items: Array<number | 'ellipsis'> = [];
        if (totalPages <= 1) return items;
        const start = Math.max(1, page - 2);
        const end = Math.min(totalPages, page + 2);
        if (start > 1) {
            items.push(1);
            if (start > 2) items.push('ellipsis');
        }
        for (let i = start; i <= end; i += 1) {
            items.push(i);
        }
        if (end < totalPages) {
            if (end < totalPages - 1) items.push('ellipsis');
            items.push(totalPages);
        }
        return items;
    }, [page, totalPages]);

    return (
        <div className="customers-page-container">
            {showAdd && (
                <AddCustomerModal
                    onClose={() => setShowAdd(false)}
                    onSaved={async () => {
                        setShowAdd(false);
                        await fetchCustomers(1);
                        scheduleRefresh(200);
                        toast.success('تم إضافة العميل وتحديث القائمة');
                    }}
                />
            )}

            {editingCustomer && (
                <EditCustomerModal
                    customer={editingCustomer}
                    onClose={() => setEditingCustomer(null)}
                    onSaved={async (updatedCustomer?: any) => {
                        setEditingCustomer(null);
                        if (updatedCustomer) {
                            const normalized = {
                                ...updatedCustomer,
                                whatsappLink: updatedCustomer.whatsappLink
                                    || (updatedCustomer.mobile_number ? `https://wa.me/${String(updatedCustomer.mobile_number).replace(/\D/g, '')}` : null)
                            };
                            setCustomers((prev) => prev.map((c) => (
                                c.id === normalized.id ? { ...c, ...normalized } : c
                            )));
                        }
                        scheduleRefresh(200);
                        toast.success('تم تحديث بيانات العميل');
                    }}
                />
            )}

            {ratingCustomer && (
                <RateCustomerModal
                    customer={ratingCustomer}
                    onClose={() => setRatingCustomer(null)}
                    onSaved={async () => {
                        setRatingCustomer(null);
                        await fetchCustomers();
                        toast.success('تم حفظ التقييم بنجاح');
                    }}
                />
            )}

            <div className="page-top fade-up">
                <div>
                    <h1 className="page-title">إدارة العملاء</h1>
                    <p className="page-sub">{customers.length} عميل معروض</p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={exportCSV}> تصدير CSV</button>
                    <button className="btn btn-primary" onClick={() => setShowAdd(true)}>＋ عميل جديد</button>
                </div>
            </div>

            <div className="toolbar-card glass-card fade-up">
                <div className="search-wrap">
                    <span className="search-icon">🔍</span>
                    <input
                        className="search-field"
                        placeholder="ابحث بالاسم أو رقم الهوية أو الجوال..."
                        value={search}
                        onChange={e => {
                            const nextValue = e.target.value;
                            startTransition(() => {
                                setSearch(nextValue);
                                setPage(1);
                            });
                        }}
                    />
                </div>
            </div>

            <div className="customers-kpis fade-up" aria-label="ملخص العملاء">
                <div className="kpi-card">
                    <span className="kpi-label">إجمالي العملاء</span>
                    <strong className="kpi-value">{totalCustomers.toLocaleString('en-US')}</strong>
                </div>
                <div className="kpi-card kpi-warn">
                    <span className="kpi-label">عملاء لديهم دين</span>
                    <strong className="kpi-value">{statsLoading ? '—' : customersWithDebt.toLocaleString('en-US')}</strong>
                </div>
                <div className="kpi-card kpi-good">
                    <span className="kpi-label">عملاء بدون دين</span>
                    <strong className="kpi-value">{statsLoading ? '—' : clearCustomers.toLocaleString('en-US')}</strong>
                </div>
            </div>

            <div className="table-card fade-up">
                {errorMsg && customers.length === 0 && (
                    <div className="form-error" style={{ margin: '12px' }}>
                        {errorMsg}
                    </div>
                )}
                {loading ? (
                    <div className="table-loading">
                        <div className="db-spinner" />
                        <p>جاري التحميل...</p>
                    </div>
                ) : customers.length === 0 ? (
                    <div className="table-empty">
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
                                    <th>التقييم</th>
                                    <th>إجمالي الدين</th>
                                    <th>الحالة</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {customers.map((c, i) => {
                                    const statsPending = Boolean(c.stats_pending);
                                    const debt = statsPending ? 0 : parseFloat(c.total_debt || 0);
                                    const status = statsPending ? '' : (c.customer_status || '').toLowerCase();
                                    const rowStateClass = status === 'paid'
                                        ? 'row-state-paid'
                                        : status === 'raised'
                                            ? 'row-state-raised'
                                            : status === 'unpaid'
                                                ? 'row-state-unpaid'
                                                : '';
                                    const hasRating = !statsPending && c.rating !== null && c.rating !== undefined && !Number.isNaN(Number(c.rating));
                                    const ratingValue = hasRating ? Number(c.rating) : null;
                                    const normalizedRating = ratingValue === null ? null : Math.max(0, Math.min(10, ratingValue));
                                    return (
                                        <tr key={c.id} className={rowStateClass}>
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
                                            <td>
                                                {statsPending ? (
                                                    <span className="muted">—</span>
                                                ) : !hasRating ? (
                                                    <span className="muted">لم يتم التقييم</span>
                                                ) : (
                                                    <div className="rating-wrap">
                                                        <div className="rating-bar">
                                                            <div className="rating-fill" style={{ width: `${(normalizedRating || 0) * 10}%` }} />
                                                        </div>
                                                        <span className="rating-value">{(normalizedRating || 0).toFixed(1)}/10</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`td-amount ${debt > 0 ? 'amount-debt' : 'amount-zero'}`}>
                                                {statsPending ? '—' : (debt > 0 ? `${debt.toLocaleString('en-US')} ﷼` : 'لا دين')}
                                            </td>
                                            <td>
                                                {statsPending && <span className="badge badge-neutral">جارٍ التحديث</span>}
                                                {status === 'paid' && <span className="badge badge-success">تم السداد</span>}
                                                {status === 'raised' && <span className="badge badge-danger">قضايا</span>}
                                                {status === 'unpaid' && <span className="badge badge-warn">لم يسدد</span>}
                                                {status === 'new' && <span className="badge badge-neutral">جديد</span>}
                                            </td>
                                            <td>
                                                <div className="action-btns">
                                                    <button
                                                        className="btn-action-icon"
                                                        onClick={() => setEditingCustomer(c)}
                                                        title="تعديل بيانات العميل"
                                                        aria-label="تعديل بيانات العميل"
                                                    >
                                                        <IconEdit size={16} />
                                                    </button>
                                                    <button
                                                        className="btn-action-icon"
                                                        onClick={() => setRatingCustomer(c)}
                                                        title="تقييم العميل"
                                                        aria-label="تقييم العميل"
                                                    >
                                                        ★
                                                    </button>
                                                    {c.whatsappLink && (
                                                        <a href={c.whatsappLink} target="_blank" rel="noopener noreferrer" className="btn-action-icon btn-whatsapp-icon" title="واتساب" aria-label="فتح واتساب">
                                                            <IconWhatsapp size={16} />
                                                        </a>
                                                    )}
                                                    {c.national_id && (
                                                        <a href="https://najiz.sa" target="_blank" rel="noopener noreferrer" className="btn-action-icon btn-najiz-icon" title="ناجز" aria-label="فتح منصة ناجز">
                                                            <IconScale size={16} />
                                                        </a>
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

                {totalPages > 1 && (
                    <div className="pagination">
                        <button className="btn btn-ghost" disabled={page === 1} onClick={() => setPage((p: number) => p - 1)}>‹ السابق</button>
                        {pageItems.map((item, idx) => (
                            item === 'ellipsis'
                                ? <span key={`ellipsis-${idx}`} className="page-ellipsis">…</span>
                                : (
                                    <button
                                        key={item}
                                        className={`btn btn-ghost page-number ${item === page ? 'active' : ''}`}
                                        onClick={() => setPage(item)}
                                    >
                                        {item}
                                    </button>
                                )
                        ))}
                        <span className="page-info">صفحة {page} من {totalPages}</span>
                        <button className="btn btn-ghost" disabled={page >= totalPages} onClick={() => setPage((p: number) => p + 1)}>التالي ›</button>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Modals ──────────────────────────────────────────

function RateCustomerModal({ customer, onClose, onSaved }: any) {
    const [scope, setScope] = useState<'delivery' | 'monthly'>('delivery');
    const [score, setScore] = useState('8');
    const [month, setMonth] = useState(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });
    const [loanId, setLoanId] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [paidLoans, setPaidLoans] = useState<any[]>([]);

    useEffect(() => {
        const loadPaidLoans = async () => {
            if (scope !== 'delivery') return;
            try {
                const res = await customersAPI.getById(customer.id);
                const customerLoans = res.data?.loans || [];
                const paid = customerLoans.filter((l: any) => l.status === 'Paid');
                setPaidLoans(paid);
                if (paid.length > 0 && !loanId) {
                    setLoanId(paid[0].id);
                }
            } catch {
                setPaidLoans([]);
            }
        };
        loadPaidLoans();
    }, [scope, customer.id, loanId]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (scope === 'delivery' && paidLoans.length === 0) {
            setError('لا توجد قروض مسددة لهذا العميل حالياً');
            return;
        }
        if (scope === 'delivery' && !loanId) {
            setError('اختر قرضاً مسدداً قبل حفظ التقييم');
            return;
        }
        setLoading(true);
        setError('');
        try {
            await customersAPI.saveRating(customer.id, {
                scope,
                score: Number(score),
                loanId: scope === 'delivery' ? loanId : null,
                month: scope === 'monthly' ? month : null,
                notes: notes || null
            });
            onSaved();
        } catch (err: any) {
            setError(err?.response?.data?.error || 'فشل حفظ التقييم');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box glass-card">
                <div className="modal-header">
                    <h2 className="modal-title">تقييم العميل: {customer.full_name}</h2>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
                </div>
                {error && <div className="form-error">{error}</div>}
                <form onSubmit={submit} className="modal-form">
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">نوع التقييم</label>
                            <select className="form-input" value={scope} onChange={(e) => setScope(e.target.value as 'delivery' | 'monthly')}>
                                <option value="delivery">بعد التسليم (مرتبط بقرض)</option>
                                <option value="monthly">تقييم شهري للعميل المتكرر</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">الدرجة (من 10)</label>
                            <input
                                className="form-input"
                                type="number"
                                min={1}
                                max={10}
                                step={0.1}
                                value={score}
                                onChange={(e) => setScore(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {scope === 'delivery' ? (
                        <div className="form-group">
                            <label className="form-label">القرض المسلّم (حالة تم التسديد)</label>
                            <select className="form-input" value={loanId} onChange={(e) => setLoanId(e.target.value)} required>
                                {paidLoans.length === 0 && <option value="">لا توجد قروض مسددة لهذا العميل</option>}
                                {paidLoans.map((loan) => (
                                    <option key={loan.id} value={loan.id}>
                                        {loan.transaction_date ? new Date(loan.transaction_date).toLocaleDateString('ar-SA') : '—'} - {Number(loan.amount || 0).toLocaleString('en-US')} ﷼
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <div className="form-group">
                            <label className="form-label">شهر التقييم</label>
                            <input className="form-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label">ملاحظات (اختياري)</label>
                        <textarea
                            className="form-input"
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="سبب التقييم أو ملاحظات التنفيذ..."
                        />
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose}>إلغاء</button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || (scope === 'delivery' && paidLoans.length === 0)}
                        >
                            {loading ? '⏳ جاري الحفظ...' : 'حفظ التقييم'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function AddCustomerModal({ onClose, onSaved }: any) {
    const [form, setForm] = useState({ full_name: '', national_id: '', mobile_number: '', email: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const payload = {
                fullName: form.full_name,
                nationalId: form.national_id,
                mobileNumber: form.mobile_number,
                email: form.email
            };
            await customersAPI.create(payload);
            onSaved();
        } catch (err: any) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء الحفظ');
        } finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box glass-card">
                <div className="modal-header">
                    <h2 className="modal-title"> إضافة عميل جديد</h2>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
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
                            <input className="form-input numeric" name="national_id" value={form.national_id} onChange={handle} placeholder="1XXXXXXXXX" required inputMode="numeric" dir="ltr" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">رقم الجوال *</label>
                            <input className="form-input numeric" name="mobile_number" value={form.mobile_number} onChange={handle} placeholder="05XXXXXXXX" required inputMode="numeric" dir="ltr" />
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

function EditCustomerModal({ customer, onClose, onSaved }: any) {
    const [form, setForm] = useState({
        full_name: customer.full_name || '',
        national_id: customer.national_id || '',
        mobile_number: customer.mobile_number || '',
        email: customer.email || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handle = (e: any) => setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true); setError('');
        try {
            const payload = {
                fullName: form.full_name,
                nationalId: form.national_id,
                mobileNumber: form.mobile_number,
                email: form.email
            };
            const res = await customersAPI.update(customer.id, payload);
            const updated = (res as any)?.data?.customer;
            onSaved(updated);
        } catch (err: any) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء التعديل');
        } finally { setLoading(false); }
    };

    return (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="modal-box glass-card">
                <div className="modal-header">
                    <h2 className="modal-title"> تعديل بيانات العميل</h2>
                    <button className="modal-close-btn" onClick={onClose}>×</button>
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
                            <input className="form-input numeric" name="national_id" value={form.national_id} onChange={handle} required inputMode="numeric" dir="ltr" />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">رقم الجوال *</label>
                            <input className="form-input numeric" name="mobile_number" value={form.mobile_number} onChange={handle} required inputMode="numeric" dir="ltr" />
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
