'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { loansAPI } from '@/lib/api';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    IconSearch, IconSave, IconExternalLink, IconDollarSign,
    IconShield, IconMessageCircle
} from '@/components/layout/icons';
import { useDataSync } from '@/hooks/useDataSync';
import './najiz.css';

type NajizCase = {
    id: string;
    status: string;
    customer_name?: string;
    national_id?: string;
    najiz_case_number?: string;
    najiz_status?: string;
    amount?: string | number;
    najiz_case_amount?: string | number;
    najiz_collected_amount?: string | number;
    najiz_raised_date?: string;
    najiz_plaintiff_name?: string;
    najiz_plaintiff_national_id?: string;
    whatsappLink?: string;
    receipt_image_url?: string | null;
    receiptImageUrl?: string | null;
    transaction_date: string;
};

export default function NajizCasesPage() {
    const [cases, setCases] = useState<NajizCase[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [uploadingAttachmentId, setUploadingAttachmentId] = useState<string | null>(null);
    const [confirmPaidCaseId, setConfirmPaidCaseId] = useState<string | null>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const parseMoneyInput = (value: string | number | null | undefined) => {
        if (value === null || value === undefined || value === '') return null;
        const raw = String(value);
        const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
        const persianDigits = '۰۱۲۳۴۵۶۷۸۹';
        const normalizedDigits = raw
            .replace(/[٠-٩]/g, (d) => String(arabicDigits.indexOf(d)))
            .replace(/[۰-۹]/g, (d) => String(persianDigits.indexOf(d)));
        const stripped = normalizedDigits.replace(/[٬،,]/g, '').replace(/[^\d.-]/g, '');
        const parsed = Number(stripped);
        return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
    };

    const fetchCases = useCallback(async (forceFresh = false) => {
        try {
            setLoading(true);
            const params: any = { is_najiz_case: true, limit: 100, skip_count: true };
            if (forceFresh) {
                params._t = Date.now();
            }
            const response = await loansAPI.getAll(params);
            const data = response.data || response;
            setCases(
                (data.loans || []).map((loan: NajizCase) => ({
                    ...loan,
                    najiz_case_amount: loan.najiz_case_amount ?? '',
                    najiz_collected_amount: loan.najiz_collected_amount ?? ''
                }))
            );
        } catch (error) {
            console.error('Failed to fetch Najiz cases:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCases();
    }, [fetchCases]);

    const scheduleRefresh = useCallback((delay = 250, forceFresh = false) => {
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(() => fetchCases(forceFresh), delay);
    }, [fetchCases]);

    useDataSync(() => {
        scheduleRefresh(200, true);
    }, { scopes: ['loans', 'dashboard', 'reports', 'najiz'], debounceMs: 200 });

    const totalCases = cases.length;
    const totalRaisedAmount = cases.reduce((sum, c) => sum + (Number(c.najiz_case_amount ?? 0) || 0), 0);
    const totalCollectedAmount = cases.reduce((sum, c) => sum + (Number(c.najiz_collected_amount ?? 0) || 0), 0);
    const totalPaidCases = cases.filter(c => c.status === 'Paid').length;
    const totalActiveCases = cases.filter(c => c.status === 'Raised').length;
    const formatAmount = (value: number) => value.toLocaleString('en-US');
    const formatDate = (value: string | Date) => new Date(value).toLocaleDateString('en-GB');

    const handleCaseAmountChange = (id: string, value: string) => {
        setCases(prev => prev.map(c =>
            c.id === id ? { ...c, najiz_case_amount: value } : c
        ));
    };

    const handlePlaintiffNameChange = (id: string, value: string) => {
        setCases(prev => prev.map(c =>
            c.id === id ? { ...c, najiz_plaintiff_name: value } : c
        ));
    };

    const handlePlaintiffIdChange = (id: string, value: string) => {
        setCases(prev => prev.map(c =>
            c.id === id ? { ...c, najiz_plaintiff_national_id: value } : c
        ));
    };

    const handleCollectedAmountChange = (id: string, value: string) => {
        setCases(prev => prev.map(c =>
            c.id === id ? { ...c, najiz_collected_amount: value } : c
        ));
    };

    const saveNajizDetails = async (loan: NajizCase) => {
        try {
            setUpdatingId(loan.id);
            const caseAmount = parseMoneyInput(loan.najiz_case_amount);
            const collectedAmount = parseMoneyInput(loan.najiz_collected_amount);
            const response = await loansAPI.updateNajizCase(loan.id, {
                is_najiz_case: true,
                najiz_case_amount: caseAmount,
                najiz_collected_amount: collectedAmount,
                najiz_plaintiff_name: loan.najiz_plaintiff_name,
                najiz_plaintiff_national_id: loan.najiz_plaintiff_national_id,
                najiz_status: loan.najiz_status,
                najiz_raised_date: loan.najiz_raised_date,
                najiz_case_number: loan.najiz_case_number
            });
            const updatedLoan = response?.data?.loan ?? null;
            setCases(prev => prev.map((currentLoan) =>
                currentLoan.id === loan.id
                    ? {
                        ...currentLoan,
                        ...updatedLoan,
                        is_najiz_case: true,
                        najiz_case_amount: updatedLoan?.najiz_case_amount ?? caseAmount ?? '',
                        najiz_collected_amount: updatedLoan?.najiz_collected_amount ?? collectedAmount ?? ''
                    }
                    : currentLoan
            ));
            scheduleRefresh(500, true);
        } catch {
            toast.error('فشل حفظ التحديثات');
            return;
        } finally {
            setUpdatingId(null);
        }
        toast.success('تم حفظ التحديثات');
    };

    const openMarkAsPaidConfirm = (loanId: string) => {
        setConfirmPaidCaseId(loanId);
    };

    const confirmMarkAsPaid = async () => {
        if (!confirmPaidCaseId) return;
        try {
            const paidCaseId = confirmPaidCaseId;
            const targetCase = cases.find(c => c.id === confirmPaidCaseId);
            const response = await loansAPI.updateStatus(confirmPaidCaseId, 'Paid', {
                is_najiz_case: true,
                najiz_collected_amount: parseMoneyInput(targetCase?.najiz_collected_amount)
            });
            const updatedLoan = response?.data?.loan ?? null;
            setCases(prev => prev.map((currentLoan) =>
                currentLoan.id === paidCaseId
                    ? {
                        ...currentLoan,
                        ...updatedLoan,
                        is_najiz_case: true,
                        status: 'Paid',
                        najiz_collected_amount:
                            updatedLoan?.najiz_collected_amount
                            ?? targetCase?.najiz_collected_amount
                            ?? ''
                    }
                    : currentLoan
            ));
            scheduleRefresh(500, true);
            toast.success('تم تحديث الحالة إلى: تم السداد');
        } catch {
            toast.error('فشل في التحديث');
        } finally {
            setConfirmPaidCaseId(null);
        }
    };

    const filteredCases = cases.filter(c =>
        (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.national_id || '').includes(searchTerm) ||
        (c.najiz_case_number || '').includes(searchTerm)
    );

    const resolveAttachmentUrl = (loan: NajizCase) => {
        const rawUrl = loan.receipt_image_url || loan.receiptImageUrl;
        if (!rawUrl) return null;
        if (/^https?:\/\//i.test(rawUrl)) return rawUrl;
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const base = (apiBase.replace(/\/api\/?$/, '') || 'https://aseel-backend.vercel.app');
        return `${base}${rawUrl}`;
    };

    const uploadNajizAttachment = async (loan: NajizCase, file?: File) => {
        if (!file) return;
        try {
            setUploadingAttachmentId(loan.id);
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await loansAPI.uploadAttachment(formData);
            const attachmentUrl =
                uploadRes?.data?.attachmentUrl
                || uploadRes?.data?.attachmentPath;

            if (!attachmentUrl) {
                throw new Error('missing-attachment-url');
            }

            const updateRes = await loansAPI.update(loan.id, {
                receiptImageUrl: attachmentUrl,
                is_najiz_case: true
            });
            const updatedLoan = updateRes?.data?.loan;
            setCases((prev) => prev.map((row) => (
                row.id === loan.id
                    ? { ...row, ...(updatedLoan || {}), receipt_image_url: updatedLoan?.receipt_image_url || attachmentUrl }
                    : row
            )));
            scheduleRefresh(350, true);
            toast.success('تم رفع المرفق وربطه بالقضية');
        } catch (error: any) {
            toast.error(error?.response?.data?.error || 'فشل رفع المرفق');
        } finally {
            setUploadingAttachmentId(null);
        }
    };

    return (
        <div className="najiz-page-container">
            <div className="najiz-page-header">
                <div className="header-info">
                    <h1> قضايا ناجز</h1>
                    <p>إدارة وتحصيل المبالغ للقضايا المرفوعة في منصة ناجز</p>
                </div>

                <div className="najiz-dashboard-stats">
                    <div className="stat-pill glass-card">
                        <span className="stat-label">إجمالي القضايا</span>
                        <div className="stat-value">{totalCases.toLocaleString('en-US')}</div>
                    </div>
                    <div className="stat-pill glass-card">
                        <span className="stat-label">نشطة</span>
                        <div className="stat-value warning">{totalActiveCases.toLocaleString('en-US')}</div>
                    </div>
                    <div className="stat-pill glass-card">
                        <span className="stat-label">مكتملة (سُدِدت)</span>
                        <div className="stat-value success">{totalPaidCases.toLocaleString('en-US')}</div>
                    </div>
                    <div className="stat-pill glass-card">
                        <span className="stat-label">إجمالي المبالغ المرفوعة</span>
                        <div className="stat-value accent">{formatAmount(totalRaisedAmount)} ﷼</div>
                    </div>
                    <div className="stat-pill glass-card">
                        <span className="stat-label">إجمالي التحصيل الفعلي</span>
                        <div className="stat-value success">{formatAmount(totalCollectedAmount)} ﷼</div>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="search-box">
                        <IconSearch className="search-icon" size={18} />
                        <input
                            type="text"
                            placeholder="بحث بالاسم، الهوية، أو رقم القضية..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">جاري تحميل القضايا...</div>
            ) : (
                <div className="cases-grid">
                    {filteredCases.length === 0 ? (
                        <div className="empty-cases">
                            <IconShield size={48} />
                            <p>لا توجد قضايا مرفوعة حالياً</p>
                        </div>
                    ) : (
                        filteredCases.map(loan => (
                            <div key={loan.id} className={`case-card glass-card ${loan.status === 'Paid' ? 'case-paid' : ''}`}>
                                <div className="case-card-header">
                                    <div className="customer-info">
                                        <h3>{loan.customer_name}</h3>
                                        <span>{loan.national_id}</span>
                                    </div>
                                    <div className={`case-badge ${loan.status === 'Paid' ? 'active' : ''}`}>
                                        {loan.status === 'Paid' ? 'مكتملة (تم السداد)' : (loan.najiz_status || 'قيد الرفع')}
                                    </div>
                                </div>

                                <div className="case-details">
                                    <div className="detail-item">
                                        <label>رقم القضية</label>
                                        <div className="detail-value">{loan.najiz_case_number || 'غير محدد'}</div>
                                    </div>
                                    <div className="detail-item">
                                        <label>المبلغ الأساسي (المديونية)</label>
                                        <div className="detail-value highlight">{formatAmount(Number(loan.amount || 0) || 0)} ﷼</div>
                                    </div>
                                    <div className="detail-item">
                                        <label>أيام الرفع</label>
                                        <div className="detail-value bold">
                                            {loan.najiz_raised_date
                                                ? `${Math.floor((Date.now() - new Date(loan.najiz_raised_date).getTime()) / (1000 * 60 * 60 * 24))} يوم`
                                                : 'غير محدد'}
                                        </div>
                                    </div>
                                </div>

                                <div className="collection-section">
                                    <label>المبلغ المرفوع به (المستحق)</label>
                                    <div className="amount-input-wrapper">
                                        <IconDollarSign className="input-icon" size={16} />
                                        <input
                                            type="number"
                                            className="input"
                                            value={loan.najiz_case_amount ?? ''}
                                            placeholder="المبلغ المراد تحصيله عبر ناجز"
                                            onChange={(e) => handleCaseAmountChange(loan.id, e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="collection-section">
                                    <label>المبلغ المحصّل فعليًا من ناجز</label>
                                    <div className="amount-input-wrapper">
                                        <IconDollarSign className="input-icon" size={16} />
                                        <input
                                            type="number"
                                            className="input"
                                            value={loan.najiz_collected_amount ?? ''}
                                            placeholder="أدخل ما تم تحصيله فعليًا"
                                            onChange={(e) => handleCollectedAmountChange(loan.id, e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="plaintiff-section">
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>المدعي (صاحب السند)</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={loan.najiz_plaintiff_name || ''}
                                                placeholder="اسم المدعي"
                                                onChange={(e) => handlePlaintiffNameChange(loan.id, e.target.value)}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>رقم الهوية للمدعي</label>
                                            <input
                                                type="text"
                                                className="input"
                                                value={loan.najiz_plaintiff_national_id || ''}
                                                placeholder="10xxxxxxxx"
                                                onChange={(e) => handlePlaintiffIdChange(loan.id, e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="action-buttons">
                                    <button
                                        className="btn btn-primary"
                                        onClick={() => saveNajizDetails(loan)}
                                        disabled={updatingId === loan.id}
                                    >
                                        <IconSave size={16} /> {updatingId === loan.id ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                                    </button>
                                    <label className="btn btn-secondary upload-btn-inline">
                                        {uploadingAttachmentId === loan.id ? 'جاري الرفع...' : 'إرفاق مستند'}
                                        <input
                                            type="file"
                                            hidden
                                            accept=".png,.jpg,.jpeg,.pdf"
                                            disabled={uploadingAttachmentId === loan.id}
                                            onChange={(e) => {
                                                const selectedFile = e.target.files?.[0];
                                                uploadNajizAttachment(loan, selectedFile);
                                                e.currentTarget.value = '';
                                            }}
                                        />
                                    </label>
                                    {loan.status !== 'Paid' && (
                                        <button
                                            className="btn btn-success"
                                            onClick={() => openMarkAsPaidConfirm(loan.id)}
                                        >
                                            تم السداد (سُدِدت)
                                        </button>
                                    )}
                                </div>

                                <div className="case-card-footer">
                                    <div className="footer-links">
                                        <a href="https://najiz.sa" target="_blank" rel="noopener noreferrer" className="link-najiz">
                                            <IconExternalLink size={14} /> ناجز
                                        </a>
                                        {resolveAttachmentUrl(loan) && (
                                            <a href={resolveAttachmentUrl(loan) || '#'} target="_blank" rel="noopener noreferrer" className="link-attachment">
                                                <IconExternalLink size={14} /> عرض المرفق
                                            </a>
                                        )}
                                        {loan.whatsappLink && (
                                            <a href={loan.whatsappLink} target="_blank" rel="noopener noreferrer" className="link-whatsapp">
                                                <IconMessageCircle size={14} /> واتساب
                                            </a>
                                        )}
                                    </div>
                                    <div className="transaction-date">
                                        المعاملة: {formatDate(loan.transaction_date)}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            <Dialog open={!!confirmPaidCaseId} onOpenChange={(open) => !open && setConfirmPaidCaseId(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>تأكيد تغيير الحالة</DialogTitle>
                        <DialogDescription>
                            هل تود تحويل هذه القضية إلى حالة <strong>تم السداد</strong>؟
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <button className="btn btn-secondary" onClick={() => setConfirmPaidCaseId(null)}>
                            إلغاء
                        </button>
                        <button className="btn btn-success" onClick={confirmMarkAsPaid}>
                            نعم، تأكيد
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
