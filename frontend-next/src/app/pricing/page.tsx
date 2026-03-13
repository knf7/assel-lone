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
  tagline: string;
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
    tagline: 'حل عملي للبدايات',
    price: 99,
    yearlyPrice: 79,
    icon: <IconRocket size={32} color="currentColor" />,
    color: '#3B82F6',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    popular: false,
    features: [
      { text: '50 عميل', included: true },
      { text: '50 قرض', included: true },
      { text: 'لوحة تحكم أساسية', included: true },
      { text: 'تقارير شهرية', included: false },
      { text: 'موظفون إضافيون', included: false },
      { text: 'استيراد إكسل', included: false },
      { text: 'تصدير إكسل', included: false },
    ],
  },
  {
    id: 'pro',
    name: 'متوسطة',
    tagline: 'أفضل توازن للنمو',
    price: 220,
    yearlyPrice: 176,
    icon: <IconDiamond size={32} color="currentColor" />,
    color: '#60A5FA',
    gradient: 'linear-gradient(135deg, #60A5FA 0%, #64748B 100%)',
    popular: true,
    features: [
      { text: '150 عميل', included: true },
      { text: '200 قرض', included: true },
      { text: 'موظف واحد', included: true },
      { text: 'تقارير شهرية', included: true },
      { text: 'استيراد إكسل', included: true },
      { text: 'تصدير إكسل', included: false },
      { text: 'تحليلات مخاطر بالذكاء الاصطناعي', included: false },
    ],
  },
  {
    id: 'enterprise',
    name: 'برو',
    tagline: 'أقصى قدرات وتحليلات متقدمة',
    price: 350,
    yearlyPrice: 280,
    icon: <IconCrown size={32} color="currentColor" />,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
    popular: false,
    features: [
      { text: '500 عميل', included: true },
      { text: '700 قرض', included: true },
      { text: 'موظفان', included: true },
      { text: 'تقارير شهرية', included: true },
      { text: 'تحليلات مخاطر بالذكاء الاصطناعي', included: true },
      { text: 'استيراد إكسل', included: true },
      { text: 'تصدير إكسل', included: true },
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

        <div className="pricing-cards">
          {plans.map((plan) => (
            <div key={plan.id} className={`pricing-card ${plan.popular ? 'featured' : ''}`}>
              {plan.popular && <div className="plan-popular-badge">الأكثر طلباً</div>}

              <div className="plan-header">
                <div className="plan-icon" style={{ background: plan.gradient }}>
                  {plan.icon}
                </div>
                <div>
                  <h3 className="plan-name">{plan.name}</h3>
                  <div className="plan-tagline">{plan.tagline}</div>
                </div>
              </div>

              <div className="plan-price-row">
                <span className="plan-amount">{isYearly ? plan.yearlyPrice : plan.price}</span>
                <span className="plan-currency">﷼</span>
                <span className="plan-period">/ شهرياً</span>
              </div>

              {isYearly && <div className="yearly-total">{plan.yearlyPrice * 12} ﷼ / سنوياً</div>}

              <ul className="plan-features">
                {plan.features.map((feature, index) => (
                  <li
                    key={index}
                    className={`plan-feature-item ${feature.included ? '' : 'plan-feature-disabled'}`}
                  >
                    <span
                      className={`plan-feature-check ${feature.included ? (plan.popular ? 'check-orange' : 'check-blue') : ''}`}
                    >
                      {feature.included ? <IconCheck size={12} /> : <IconX size={12} />}
                    </span>
                    {feature.text}
                  </li>
                ))}
              </ul>

              <button
                className={plan.popular ? 'plan-cta-primary' : 'plan-cta-secondary'}
                onClick={() => handleSubscribe(plan)}
                disabled={loading === plan.id}
                type="button"
              >
                {loading === plan.id ? 'جاري المعالجة...' : 'طلب ترقية'}
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

        <div className="pricing-note">
          <p>جميع الأسعار بالريال السعودي وتشمل ضريبة القيمة المضافة.</p>
          <div className="pricing-links">
            <a href="mailto:aseel.ksa.sa.org@gmail.com">aseel.ksa.sa.org@gmail.com</a>
            <span>•</span>
            <a href="tel:0583719925">0583719925</a>
            <span>•</span>
            <a href="https://www.linkedin.com/in/khalid-alshammari-37ab95370?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app" target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
          </div>
          <p>جميع الحقوق محفوظة لأصيل المالية</p>
        </div>
      </div>
    </div>
  );
}
