import React from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';
import './PricingPage.css';

function SubscriptionExpiredPage() {
    const navigate = useNavigate();
    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');

    return (
        <div className="pricing-page">
            <AnimatedBackground />
            <div className="pricing-content" style={{ maxWidth: 520 }}>
                <div className="plan-card" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: 64, marginBottom: 16 }}>⏰</div>
                    <h2 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 12px' }}>
                        انتهى اشتراكك
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 15, margin: '0 0 8px' }}>
                        باقة <strong>{merchant.subscriptionPlan || 'الأساسية'}</strong> انتهت صلاحيتها
                    </p>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '0 0 28px' }}>
                        جدّد اشتراكك للاستمرار في استخدام جميع الميزات
                    </p>

                    <button
                        className="plan-cta"
                        style={{ background: 'linear-gradient(135deg, #E8633A, #C1532E)', marginBottom: 12 }}
                        onClick={() => navigate('/pricing')}
                    >
                         تجديد الاشتراك
                    </button>

                    <button
                        className="btn-back-dash"
                        onClick={() => { localStorage.clear(); navigate('/login'); }}
                    >
                        تسجيل خروج
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SubscriptionExpiredPage;
