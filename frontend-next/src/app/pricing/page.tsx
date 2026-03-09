'use client';

import { ChangeEvent, ReactElement, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { toast } from 'sonner';
import AnimatedBackground from '@/components/layout/AnimatedBackground';
import {
  IconCheck,
  IconChevronLeft,
  IconCrown,
  IconDiamond,
  IconRocket,
  IconUpload,
  IconX,
} from '@/components/layout/icons';

type PlanId = 'basic' | 'pro' | 'enterprise';
type PlanFeature = { text: string; included: boolean };
type Plan = {
  id: PlanId;
  name: string;
  price: number;
  yearlyPrice: number;
  icon: ReactElement;
  color: string;
  gradient: string;
  popular: boolean;
  features: PlanFeature[];
};

type PublicSettings = {
  bank_details?: {
    bank_name?: string;
    account_holder?: string;
    iban?: string;
  };
};

const plans: Plan[] = [
  {
    id: 'basic',
    name: 'الأساسية',
    price: 99,
    yearlyPrice: 79,
    icon: <IconRocket size={32} color="currentColor" />,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    popular: false,
    features: [
      { text: '50 عميل', included: true },
      { text: '300 قرض', included: true },
      { text: 'لوحة تحكم أساسية', included: true },
      { text: 'تقارير شهرية', included: true },
      { text: 'دعم بريد إلكتروني', included: true },
      { text: 'لا يدعم موظفين إضافيين', included: true },
      { text: 'تحليلات AI', included: false },
      { text: 'تصدير Excel', included: false },
      { text: 'رفع ملفات Excel', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'الاحترافية',
    price: 220,
    yearlyPrice: 176,
    icon: <IconDiamond size={32} color="currentColor" />,
    color: '#60A5FA',
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #64748B 100%)',
    popular: true,
    features: [
      { text: '500 عميل', included: true },
      { text: '5,000 قرض', included: true },
      { text: 'موظف واحد (1) إضافي', included: true },
      { text: 'لوحة تحكم متقدمة', included: true },
      { text: 'تقارير يومية', included: true },
      { text: 'دعم واتساب + بريد', included: true },
      { text: 'تحليلات AI', included: true },
      { text: 'تصدير Excel', included: true },
      { text: 'رفع ملفات Excel', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'المؤسسية',
    price: 350,
    yearlyPrice: 280,
    icon: <IconCrown size={32} color="currentColor" />,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    popular: false,
    features: [
      { text: 'عملاء بلا حدود', included: true },
      { text: 'قروض بلا حدود', included: true },
      { text: 'موظفين متعددين', included: true },
      { text: 'صلاحيات متقدمة للموظفين', included: true },
      { text: 'لوحة تحكم كاملة', included: true },
      { text: 'تقارير فورية', included: true },
      { text: 'دعم أولوية 24/7', included: true },
      { text: 'تحليلات AI متقدمة', included: true },
      { text: 'تصدير Excel', included: true },
    ],
  },
];

type ApiError = {
  response?: {
    data?: {
      error?: string;
    };
    status?: number;
  };
};

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<PlanId | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [requestStatus, setRequestStatus] = useState<'success' | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PublicSettings | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsLoggedIn(Boolean(localStorage.getItem('token')));

    const fetchPublicSettings = async () => {
      try {
        const res = await api.get('/public/settings');
        setPlatformSettings(res.data);
      } catch {
        setPlatformSettings(null);
      }
    };
    fetchPublicSettings();
  }, []);

  const handleSubscribe = (plan: Plan) => {
    if (!isLoggedIn) {
      router.push('/login');
      return;
    }
    setSelectedPlan(plan);
  };

  const handleSubmitRequest = async () => {
    if (!selectedPlan || !receiptFile) {
      toast.error('الرجاء إرفاق صورة الإيصال');
      return;
    }

    setLoading(selectedPlan.id);
    const formData = new FormData();
    formData.append('plan', selectedPlan.id);
    formData.append('receipt', receiptFile);

    try {
      await api.post('/subscription-requests/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setRequestStatus('success');
      toast.success('تم إرسال الطلب بنجاح');
      setTimeout(() => {
        setSelectedPlan(null);
        setRequestStatus(null);
        setReceiptFile(null);
      }, 3000);
    } catch (error) {
      const apiError = error as ApiError;
      if (apiError.response && [401, 403].includes(apiError.response.status || 0)) {
        localStorage.clear();
        toast.error('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.');
        router.push('/login');
      } else {
        toast.error(apiError.response?.data?.error || 'فشل إرسال الطلب');
      }
    } finally {
      setLoading(null);
    }
  };

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    setReceiptFile(file);
  };

  return (
    <div className="pricing-page">
      <AnimatedBackground />

      <div className="pricing-content">
        <header className="pricing-header">
          <div className="pricing-badge">خطط الأسعار</div>
          <h1>اختر الباقة المناسبة لعملك</h1>
          <p>ابدأ مجاناً وترقّ حسب احتياجك. الدفع عبر التحويل البنكي حالياً.</p>

          <div className="billing-toggle">
            <span className={!isYearly ? 'active' : ''}>شهري</span>
            <button
              className={`toggle-switch ${isYearly ? 'yearly' : ''}`}
              onClick={() => setIsYearly(!isYearly)}
              aria-label="تبديل الفوترة"
              type="button"
            >
              <span className="toggle-knob" />
            </button>
            <span className={isYearly ? 'active' : ''}>
              سنوي
              <span className="save-badge">وفّر 20%</span>
            </span>
          </div>
        </header>

        <div className="plans-grid">
          {plans.map((plan) => (
            <div key={plan.id} className={`plan-card ${plan.popular ? 'plan-popular' : ''}`}>
              {plan.popular && <div className="popular-ribbon">الأكثر طلباً</div>}

              <div className="plan-icon" style={{ background: plan.gradient }}>
                {plan.icon}
              </div>

              <h3 className="plan-name">{plan.name}</h3>

              <div className="plan-price">
                <span className="price-amount">{isYearly ? plan.yearlyPrice : plan.price}</span>
                <span className="price-currency">﷼</span>
                <span className="price-period">/ شهرياً</span>
              </div>

              {isYearly && <div className="yearly-total">{plan.yearlyPrice * 12} ﷼ / سنوياً</div>}

              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li key={index} className={feature.included ? 'included' : 'excluded'}>
                    <span className="feature-icon">{feature.included ? '' : ''}</span>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <button
                className="plan-cta"
                style={{ background: plan.gradient }}
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.id}
                type="button"
              >
                {loading === plan.id ? (
                  <span className="cta-loading">
                    <span className="cta-spinner" />
                    جاري المعالجة...
                  </span>
                ) : 'طلب ترقية'}
              </button>
            </div>
          ))}
        </div>

        {selectedPlan && (
          <div className="modal-overlay">
            <div className="admin-modal" style={{ maxWidth: 500 }}>
              {requestStatus === 'success' ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <div style={{ fontSize: 64, marginBottom: 20 }} />
                  <h3>تم إرسال الطلب بنجاح!</h3>
                  <p>سيتم تفعيل الباقة بعد مراجعة الإيصال من قبل الإدارة.</p>
                </div>
              ) : (
                <>
                  <div className="modal-header-nav">
                    <button className="modal-back-btn" onClick={() => setSelectedPlan(null)} type="button">
                      <IconChevronLeft size={20} />
                      <span>الرجوع للخطط</span>
                    </button>
                  </div>
                  <h2 style={{ textAlign: 'center' }}>تأكيد طلب باقة: {selectedPlan.name}</h2>

                  <div className="bank-info-box">
                    <div className="bank-info-header">تفاصيل الحساب البنكي للتفعيل</div>
                    <p className="bank-amount-row">
                      <span>المبلغ المستحق:</span>
                      <strong>{isYearly ? selectedPlan.yearlyPrice * 12 : selectedPlan.price} ﷼</strong>
                    </p>
                    <div className="bank-details-grid">
                      <div>
                        <label>البنك:</label>
                        <span>{platformSettings?.bank_details?.bank_name || 'مصرف الراجحي'}</span>
                      </div>
                      <div>
                        <label>المستفيد:</label>
                        <span>{platformSettings?.bank_details?.account_holder || 'مؤسسة أصيل المالي'}</span>
                      </div>
                      <div className="iban-row">
                        <label>الآيبان:</label>
                        <span className="iban-value">{platformSettings?.bank_details?.iban || 'SA 0000 0000 0000 0000 0000'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="upload-section">
                    <label className="upload-label">إرفاق إيصال التحويل (صورة أو PDF)</label>
                    <div className={`upload-zone ${receiptFile ? 'has-file' : ''}`}>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={onFileChange}
                        id="receipt-upload"
                        hidden
                      />
                      <label htmlFor="receipt-upload" className="upload-trigger">
                        {receiptFile ? (
                          <div className="file-info">
                            <IconCheck size={32} color="#10B981" />
                            <span className="file-name">{receiptFile.name}</span>
                            <button className="remove-file" onClick={(event) => { event.preventDefault(); setReceiptFile(null); }} type="button">
                              <IconX size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="upload-placeholder">
                            <IconUpload size={32} color="var(--coral)" />
                            <span>اضغط لرفع الإيصال</span>
                            <small>PNG, JPG, PDF (Max 5MB)</small>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button
                      className="plan-cta"
                      style={{ background: selectedPlan.gradient }}
                      onClick={() => void handleSubmitRequest()}
                      disabled={!receiptFile || Boolean(loading)}
                      type="button"
                    >
                      {loading ? 'جاري الإرسال...' : 'إرسال طلب التفعيل'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        <div className="pricing-footer">
          <p>جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة.</p>
          <p>
            هل لديك استفسار؟ تواصل معنا عبر
            {' '}
            <a href="mailto:support@aseel.sa">support@aseel.sa</a>
          </p>
        </div>
      </div>
    </div>
  );
}
