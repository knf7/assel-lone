import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiShield, FiLink } from 'react-icons/fi';
import './LandingPage.css';

export default function LandingPage() {
    const navigate = useNavigate();

    const features = [
        {
            title: 'إدارة عميل واحدة وشاملة',
            desc: 'ملف موحد يجمع القرض، الحالة، التحصيل، والسجل التشغيلي بدون تنقل بين الشاشات.',
            icon: <FiCheck />,
        },
        {
            title: 'تحليلات لحظية وقرار سريع',
            desc: 'لوحات مؤشرات دقيقة توضّح الأداء وتوجّهك للإجراء الأسرع لتقليل المخاطر.',
            icon: <FiShield />,
        },
        {
            title: 'تكامل مباشر مع ناجز',
            desc: 'تتبع القضايا وتحديث حالاتها وتسجيل المبالغ المحصلة مباشرة داخل النظام.',
            icon: <FiLink />,
        },
    ];

    return (
        <div className="landing-simple">
            <nav className="landing-simple__nav">
                <div className="brand">
                    <span className="brand__icon">أ</span>
                    <span className="brand__text">أصيل المالي</span>
                </div>
                <div className="nav-actions">
                    <button className="btn btn-ghost" onClick={() => navigate('/login')}>تسجيل الدخول</button>
                    <button className="btn btn-primary" onClick={() => navigate('/register')}>ابدأ مجاناً</button>
                </div>
            </nav>

            <header className="landing-simple__hero">
                <div className="hero__content">
                    <div className="hero__logo">
                        <span>أ</span>
                    </div>
                    <h1>إدارة العملاء والتحصيل بثقة وسلاسة</h1>
                    <p>
                        منصة بسيطة وقوية لإدارة القروض والمتابعات مع تكامل مباشر مع ناجز.
                        كل شيء واضح وفي مكان واحد.
                    </p>
                    <div className="hero__cta">
                        <button className="btn btn-primary" onClick={() => navigate('/register')}>ابدأ الآن</button>
                        <button className="btn btn-outline" onClick={() => navigate('/login')}>لدي حساب</button>
                    </div>
                </div>
            </header>

            <section className="landing-simple__features">
                <h2>مميزات أساسية بدون تعقيد</h2>
                <div className="features-grid">
                    {features.map((f, i) => (
                        <div key={i} className="feature-card">
                            <div className="feature-icon">{f.icon}</div>
                            <h3>{f.title}</h3>
                            <p>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="landing-simple__najiz">
                <div className="najiz-card">
                    <h3>مرتبط بناجز</h3>
                    <p>
                        الربط المباشر مع منصة ناجز يختصر الوقت ويقلل الأخطاء.
                        التحديثات والتحصيلات تتسجل فورًا داخل ملف العميل.
                    </p>
                </div>
            </section>

            <footer className="landing-simple__footer">
                <span>© {new Date().getFullYear()} أصيل المالي</span>
                <div className="footer-links">
                    <a href="/privacy-policy">سياسة الخصوصية</a>
                    <a href="/terms">الشروط والأحكام</a>
                    <a href="mailto:support@aseel.sa">الدعم الفني</a>
                </div>
            </footer>
        </div>
    );
}
