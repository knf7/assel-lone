import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loansAPI, customersAPI } from '../services/api';
import Layout from '../components/Layout';
import MoneyRain from '../components/MoneyRain';
import './AddLoanPage.css';

function AddLoanPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
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
        status: 'Active',
        najiz_case_number: '',
        najiz_case_amount: '',
        najiz_status: 'قيد التنفيذ'
    });
    // حساب الفائدة تلقائياً
    const calculateInterest = (principal) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // أولاً: إنشاء أو البحث عن العميل
            let customer;
            try {
                const customersResponse = await customersAPI.getAll({ search: formData.nationalId, limit: 10 });
                const data = customersResponse.data || customersResponse;
                const list = data.customers || [];
                customer = list.find(c => (c.national_id || c.nationalId) === formData.nationalId);
            } catch (err) {
                // العميل غير موجود
            }

            if (!customer) {
                // إنشاء عميل جديد (الـ API يتوقع: fullName, nationalId, mobileNumber)
                const customerResponse = await customersAPI.create({
                    fullName: formData.customerName,
                    nationalId: formData.nationalId,
                    mobileNumber: formData.mobile
                });
                customer = (customerResponse.data && customerResponse.data.customer) ? customerResponse.data.customer : customerResponse.data;
            }

            // ثانياً: إنشاء القرض (الـ API يتوقع: customerId, amount, principal_amount, profit_percentage, الخ)
            await loansAPI.create({
                customerId: customer.id,
                amount: parseFloat(formData.totalAmount),
                principal_amount: parseFloat(formData.principalAmount),
                profit_percentage: 30,
                receiptNumber: formData.bondNumber,
                transactionDate: formData.bondDate,
                status: formData.status,
                najiz_case_number: formData.status === 'Raised' ? formData.najiz_case_number : null,
                najiz_case_amount: formData.status === 'Raised' ? parseFloat(formData.najiz_case_amount) : null,
                najiz_status: formData.status === 'Raised' ? formData.najiz_status : null
            });

            setSuccess(true);
            setShowMoneyRain(true);
            setTimeout(() => {
                navigate('/loans');
            }, 3000);
        } catch (err) {
            setError(err.response?.data?.error || 'حدث خطأ أثناء إضافة القرض');
        } finally {
            setLoading(false);
        }
    };

    const handleNajizClick = () => {
        // فتح ناجز في نافذة جديدة بدون شريط العنوان
        const najizUrl = `https://najiz.sa`;
        const windowFeatures = 'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no';
        window.open(najizUrl, 'najiz', windowFeatures);
    };

    return (
        <Layout>
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
                                    className="input"
                                    value={formData.nationalId}
                                    onChange={(e) => setFormData({ ...formData, nationalId: e.target.value })}
                                    required
                                    pattern="[0-9]{10}"
                                    placeholder="1234567890"
                                    maxLength="10"
                                />
                                <small>10 أرقام</small>
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group">
                                <label>رقم الجوال *</label>
                                <input
                                    type="tel"
                                    className="input"
                                    value={formData.mobile}
                                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                                    required
                                    pattern="05[0-9]{8}"
                                    placeholder="05xxxxxxxx"
                                    maxLength="10"
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
                                    className="input"
                                    value={formData.principalAmount}
                                    onChange={(e) => calculateInterest(e.target.value)}
                                    required
                                    min="0"
                                    step="0.01"
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="form-group">
                                <label>مبلغ الفائدة (30%)</label>
                                <input
                                    type="text"
                                    className="input calculated"
                                    value={formData.interestAmount}
                                    readOnly
                                    placeholder="يتم الحساب تلقائياً"
                                />
                            </div>
                        </div>

                        <div className="form-row">
                            <div className="form-group total-amount">
                                <label>إجمالي المبلغ</label>
                                <input
                                    type="text"
                                    className="input calculated total"
                                    value={formData.totalAmount}
                                    readOnly
                                    placeholder="0.00"
                                />
                                <span className="currency">ر.س</span>
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

                        {formData.status === 'Raised' && (
                            <div className="form-section najiz-fields">
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
                                        <label>مبلغ السند (Bond Amount) *</label>
                                        <div className="najiz-amount-input-wrap" style={{ position: 'relative' }}>
                                            <input
                                                type="number"
                                                className="input"
                                                value={formData.najiz_case_amount}
                                                onChange={(e) => setFormData({ ...formData, najiz_case_amount: e.target.value })}
                                                required
                                                min="0"
                                                step="0.01"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <small style={{ display: 'block', marginTop: '5px', color: 'var(--text-muted)' }}>إجمالي مبلغ الحق: {formData.totalAmount} ر.س</small>
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

                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={handleNajizClick}
                        >
                            رفع عبر ناجز
                        </button>

                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={() => navigate('/loans')}
                        >
                            إلغاء
                        </button>
                    </div>
                </form>

                <div className="loan-info-card">
                    <div className="icon icon-document"></div>
                    <h3>معلومات القرض</h3>
                    <ul>
                        <li>يتم حساب الفائدة تلقائياً بنسبة 30%</li>
                        <li>رقم الهوية يجب أن يكون 10 أرقام</li>
                        <li>رقم الجوال يجب أن يبدأ بـ 05</li>
                        <li>يمكنك رفع القضية عبر ناجز مباشرة</li>
                    </ul>
                </div>
            </div>
        </Layout>
    );
}

export default AddLoanPage;
