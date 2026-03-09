'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { loansAPI, customersAPI } from '@/lib/api';
import { toast } from 'sonner';
import MoneyRain from '@/components/layout/MoneyRain';

type ExistingCustomer = {
    id: string;
    national_id: string;
};

export default function AddLoanPage() {
    const router = useRouter();
    const attachmentRef = useRef<HTMLInputElement>(null);
    const [loading, setLoading] = useState(false);
    const [uploadingAttachment, setUploadingAttachment] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [attachmentName, setAttachmentName] = useState('');
    const [showMoneyRain, setShowMoneyRain] = useState(false);

    const [formData, setFormData] = useState({
        customerName: '',
        nationalId: '',
        mobile: '',
        principalAmount: '',
        interestAmount: '',
        totalAmount: '',
        bondNumber: '',
        bondDate: new Date().toISOString().split('T')[0],
        receiptImageUrl: '',
        status: 'Active',
        najiz_case_number: '',
        najiz_case_amount: '',
        najiz_status: 'قيد التنفيذ'
    });

    const calculateInterest = (principal: string) => {
        const principalNum = parseFloat(principal) || 0;
        const interest = principalNum * 0.30;
        const total = principalNum + interest;

        setFormData(prev => ({
            ...prev,
            principalAmount: principal,
            interestAmount: interest.toFixed(2),
            totalAmount: total.toFixed(2)
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let customer;
            try {
                const customersResponse = await customersAPI.getAll({ search: formData.nationalId, limit: 10 });
                const data = customersResponse.data || customersResponse;
                const list = data.customers || [];
                customer = (list as ExistingCustomer[]).find((c) => c.national_id === formData.nationalId);
            } catch { }

            if (!customer) {
                const customerResponse = await customersAPI.create({
                    fullName: formData.customerName,
                    nationalId: formData.nationalId,
                    mobileNumber: formData.mobile
                });
                customer = (customerResponse.data && customerResponse.data.customer) ? customerResponse.data.customer : customerResponse.data;
            }

            await loansAPI.create({
                customerId: customer.id,
                amount: parseFloat(formData.totalAmount),
                principal_amount: parseFloat(formData.principalAmount),
                profit_percentage: 30,
                receiptNumber: formData.bondNumber,
                receiptImageUrl: formData.receiptImageUrl || null,
                transactionDate: formData.bondDate,
                status: formData.status,
                najiz_case_number: formData.status === 'Raised' ? formData.najiz_case_number : null,
                najiz_case_amount: formData.status === 'Raised' ? parseFloat(formData.najiz_case_amount) : null,
                najiz_status: formData.status === 'Raised' ? formData.najiz_status : null
            });

            setSuccess(true);
            setShowMoneyRain(true);
            toast.success('تم حفظ القرض بنجاح');
            setTimeout(() => {
                router.replace(`/dashboard/loans?ref=${Date.now()}`);
            }, 900);
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { error?: string } } };
            setError(apiError.response?.data?.error || 'حدث خطأ أثناء إضافة القرض');
        } finally {
            setLoading(false);
        }
    };

    const handleNajizClick = () => {
        const najizUrl = `https://najiz.sa`;
        const windowFeatures = 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no';
        window.open(najizUrl, 'najiz', windowFeatures);
    };

    const handleAttachmentPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        if (!['jpg', 'jpeg', 'png', 'webp', 'pdf'].includes(ext)) {
            setError('نوع المرفق غير مدعوم. ارفع صورة أو PDF فقط.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('حجم المرفق كبير. الحد الأقصى 5MB.');
            return;
        }
        try {
            setUploadingAttachment(true);
            const payload = new FormData();
            payload.append('file', file);
            const res = await loansAPI.uploadAttachment(payload);
            const attachmentUrl = res.data?.attachmentUrl;
            if (!attachmentUrl) throw new Error('Attachment URL missing');
            setAttachmentName(file.name);
            setFormData((prev) => ({ ...prev, receiptImageUrl: attachmentUrl }));
            setError('');
            toast.success('تم إرفاق صورة/ملف السند');
        } catch (err: unknown) {
            const apiError = err as { response?: { data?: { error?: string } } };
            console.error('Attachment upload error:', err);
            setError(apiError?.response?.data?.error || 'فشل رفع الملف المرفق');
        } finally {
            setUploadingAttachment(false);
            if (attachmentRef.current) attachmentRef.current.value = '';
        }
    };

    return (
        <div className="add-loan-page-wrapper">
            <MoneyRain isRaining={showMoneyRain} onComplete={() => setShowMoneyRain(false)} />
            <div className="loan-form-container">
                <form onSubmit={handleSubmit} className="loan-form glass-card">
                    <div className="form-section">
                        <h2>بيانات العميل</h2>
                        <div className="form-row">
                            <div className="form-group">
                                <label>اسم العميل *</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.customerName}
                                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                                    required
                                    placeholder="أدخل اسم العميل الكامل"
                                />
                            </div>
                            <div className="form-group">
                                <label>رقم الهوية *</label>
                                <input
                                    type="text"
                                    className="input numeric-field"
                                    value={formData.nationalId}
                                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                                    required
                                    pattern="[0-9]{10}"
                                    placeholder="1234567890"
                                    maxLength={10}
                                    inputMode="numeric"
                                    dir="ltr"
                                />
                                <small>10 أرقام</small>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>رقم الجوال *</label>
                                <input
                                    type="tel"
                                    className="input numeric-field"
                                    value={formData.mobile}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    required
                                    pattern="05[0-9]{8}"
                                    placeholder="05xxxxxxxx"
                                    maxLength={10}
                                    inputMode="numeric"
                                    dir="ltr"
                                />
                                <small>يبدأ بـ 05</small>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2>بيانات القرض</h2>
                        <div className="form-row">
                            <div className="form-group">
                                <label>المبلغ الأساسي *</label>
                                <input
                                    type="number"
                                    className="input numeric-field"
                                    value={formData.principalAmount}
                                    onChange={(e) => calculateInterest(e.target.value)}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                    inputMode="decimal"
                                />
                            </div>
                            <div className="form-group">
                                <label>مبلغ الفائدة (30%)</label>
                                <input
                                    type="text"
                                    className="input calculated numeric-field"
                                    value={formData.interestAmount}
                                    readOnly
                                    placeholder="يتم الحساب تلقائياً"
                                    dir="ltr"
                                />
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group total-amount">
                                <label>إجمالي المبلغ</label>
                                <input
                                    type="text"
                                    className="input calculated total numeric-field"
                                    value={formData.totalAmount}
                                    readOnly
                                    placeholder="0.00"
                                    dir="ltr"
                                />
                                <span className="currency">﷼</span>
                            </div>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>حالة القرض *</label>
                                <select
                                    className="input"
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                >
                                    <option value="Active">نشط</option>
                                    <option value="Raised">مرفوع (ناجز)</option>
                                    <option value="Paid">تم السداد</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>رقم السند</label>
                                <input
                                    type="text"
                                    className="input"
                                    value={formData.bondNumber}
                                    onChange={(e) => setFormData({ ...formData, bondNumber: e.target.value })}
                                    placeholder="e.g. BOND-2026-001"
                                    dir="ltr"
                                />
                            </div>
                            <div className="form-group">
                                <label>تاريخ السند</label>
                                <input
                                    type="date"
                                    className="input"
                                    value={formData.bondDate}
                                    onChange={(e) => setFormData({ ...formData, bondDate: e.target.value })}
                                />
                            </div>
                        </div>

                        {formData.status === 'Raised' && (
                            <div className="najiz-fields">
                                <h3>بيانات قضية ناجز</h3>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>رقم القضية *</label>
                                        <input
                                            type="text"
                                            className="input"
                                            value={formData.najiz_case_number}
                                            onChange={(e) => setFormData({ ...formData, najiz_case_number: e.target.value })}
                                            required
                                            placeholder="أدخل رقم القضية"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>مبلغ السند *</label>
                                        <input
                                            type="number"
                                            className="input numeric-field"
                                            value={formData.najiz_case_amount}
                                            onChange={(e) => setFormData({ ...formData, najiz_case_amount: e.target.value })}
                                            required
                                            min="0"
                                            step="0.01"
                                            placeholder="0.00"
                                            inputMode="decimal"
                                        />
                                        <small>إجمالي مبلغ الحق: {formData.totalAmount} ﷼</small>
                                    </div>
                                </div>
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>حالة التنفيذ في ناجز *</label>
                                        <select
                                            className="input"
                                            value={formData.najiz_status}
                                            onChange={(e) => setFormData({ ...formData, najiz_status: e.target.value })}
                                        >
                                            <option value="قيد التنفيذ">قيد التنفيذ</option>
                                            <option value="منتهية">منتهية</option>
                                            <option value="متعثرة">متعثرة</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {error && <div className="error-message">{error}</div>}
                    {success && <div className="success-message">تم إضافة القرض بنجاح</div>}

                    <div className="form-actions">
                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            {loading ? 'جاري الحفظ...' : 'حفظ القرض'}
                        </button>
                        <button type="button" className="btn btn-secondary" onClick={handleNajizClick}>
                            رفع عبر ناجز
                        </button>
                        <button type="button" className="btn btn-outline" onClick={() => router.push('/dashboard/loans')}>
                            إلغاء
                        </button>
                    </div>
                </form>

                <div className="loan-info-card">
                    <h3>💡 معلومات القرض</h3>
                    <ul>
                        <li>يتم حساب الفائدة تلقائياً بنسبة 30%</li>
                        <li>رقم الهوية يجب أن يكون 10 أرقام</li>
                        <li>رقم الجوال يجب أن يبدأ بـ 05</li>
                        <li>يمكنك رفع القضية عبر ناجز مباشرة</li>
                    </ul>
                </div>

                <div className="loan-info-card import-assistant-card">
                    <h3>📎 مرفقات القرض</h3>
                    <p className="import-helper-note">
                        أضف صورة/ملف السند أو الهوية لربطها بالقرض (JPG, PNG, WEBP, PDF).
                    </p>
                    <div className="import-actions">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={() => attachmentRef.current?.click()}
                            disabled={uploadingAttachment}
                        >
                            {uploadingAttachment ? 'جاري الرفع...' : 'إضافة صورة/ملف'}
                        </button>
                        <input
                            ref={attachmentRef}
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.pdf"
                            className="import-hidden-input"
                            onChange={handleAttachmentPick}
                        />
                        {formData.receiptImageUrl && (
                            <button
                                type="button"
                                className="btn btn-outline"
                                onClick={() => {
                                    setFormData((prev) => ({ ...prev, receiptImageUrl: '' }));
                                    setAttachmentName('');
                                }}
                            >
                                حذف المرفق
                            </button>
                        )}
                    </div>
                    {attachmentName && <p className="import-meta">المرفق المختار: {attachmentName}</p>}
                    {formData.receiptImageUrl && (
                        <a
                            href={formData.receiptImageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="import-meta"
                        >
                            عرض المرفق
                        </a>
                    )}
                </div>
            </div>
        </div>
    );
}
