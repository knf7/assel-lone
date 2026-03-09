import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck, FiShield, FiTrendingUp, FiLayers, FiArrowLeft, FiActivity } from 'react-icons/fi';
import './LandingPage.css';

export default function LandingPage() {
    const navigate = useNavigate();
    const [activeFeature, setActiveFeature] = useState(0);

    const features = [
        {
            id: 'management',
            title: 'إدارة رقمية متكاملة وسلسة',
            desc: 'أتمتة كاملة لعملياتك مع العملاء. أضف بياناتهم وعقودهم ودع خوارزمياتنا تجدول الدفعات بدقة متناهية بعيداً عن التعقيد الورقي.',
            icon: <FiLayers size={80} />,
            color: '#3B82F6',
            glow: 'rgba(59, 130, 246, 0.6)'
        },
        {
            id: 'tracking',
            title: 'تتبع حي للمتأخرات',
            desc: 'نبض عملياتك في شاشة واحدة. راقب التزام العملاء بالدفع واستقبل تنبيهات فورية بالمتأخرات مع أدوات ذكية لمتابعة التحصيل وحماية حقوقك.',
            icon: <FiActivity size={80} />,
            color: '#EF4444',
            glow: 'rgba(239, 68, 68, 0.6)'
        },
        {
            id: 'automation',
            title: 'أتمتة ناجز وأمان بنكي',
            desc: 'ارتباط سلس ومباشر لتنفيذ مطالباتك واسترداد حقوقك آلياً. نظامنا مشفر بالكامل بمعايير بنكية عالمية لضمان أقصى درجات السرية.',
            icon: <FiShield size={80} />,
            color: '#10B981',
            glow: 'rgba(16, 185, 129, 0.6)'
        }
    ];

    return (
        <div className="landing-page">
            {/* Animated Background Blobs */}
            <div className="bg-blobs">
                <div className="blob blob-1"></div>
                <div className="blob blob-2"></div>
                <div className="blob blob-3"></div>
            </div>

            {/* Navigation Bar */}
            <nav className="landing-nav">
                <div className="landing-brand">
                    <span className="logo-icon">أ</span>
                    <span className="logo-text">أصيل المالي</span>
                </div>
                <div className="nav-actions">
                    <button className="btn-ghost-light" onClick={() => navigate('/login')}>
                        تسجيل الدخول
                    </button>
                    <button className="btn-premium" onClick={() => navigate('/register')}>
                        ابدأ تجربتك المجانية
                    </button>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="hero-section">
                <div className="hero-content">
                    <div className="badge-pill-premium">
                        <span className="pulse-dot"></span>
                        أحدث نظام لإدارة عملياتك وعملائك في المملكة
                    </div>
                    <h1 className="hero-title">
                        أدر عملائك <br />
                        <span className="text-gradient">بسهولة</span> و<span className="text-gradient-brand">فعالية</span>
                    </h1>
                    <p className="hero-subtitle">
                        منصة سحابية متكاملة تمنحك السيطرة الكاملة على إدارة عملائك، متابعة الدفعات، وأتمتة المطالبات عبر ناجز، من مكان واحد وبأعلى معايير الأمان والتشفير.
                    </p>
                    <div className="hero-cta">
                        <button className="btn-premium btn-lg" onClick={() => navigate('/register')}>
                            ابدأ مجاناً لمدة 45 يوماً
                            <FiArrowLeft className="icon-flip" />
                        </button>
                        <button className="btn-outline-light btn-lg" onClick={() => navigate('/login')}>
                            لدي حساب مسبق
                        </button>
                    </div>
                    <div className="hero-trust">
                        <FiShield className="trust-icon" />
                        <span>منصة سعودية موثوقة ومدعومة بالذكاء الاصطناعي</span>
                    </div>
                </div>

                {/* Performance Dashboard Display (Unframed) */}
                <div className="mockup-container">
                    <div className="performance-hero-showcase">
                        <div className="dashboard-preview">
                            <div className="performance-header">
                                <h3 className="dashboard-title">مؤشر الأداء العام</h3>
                                <span className="trend-badge"><FiTrendingUp /> +24% نمو</span>
                            </div>
                            <div className="performance-stats">
                                <div className="stat-card">
                                    <span className="stat-label">إجمالي التحصيلات هذا الشهر</span>
                                    <span className="stat-value">124,500 ر.س</span>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-label">العملاء النشطين</span>
                                    <span className="stat-value">842 عميل</span>
                                </div>
                                <div className="stat-card">
                                    <span className="stat-label">مؤشر الأمان</span>
                                    <span className="stat-value text-green">99.9%</span>
                                </div>
                            </div>
                            <div className="performance-chart-mock">
                                <div className="chart-bars">
                                    {[40, 60, 45, 80, 55, 90, 70, 100, 85].map((h, i) => (
                                        <div key={i} className="chart-bar-column">
                                            <div className="chart-bar-fill" style={{ height: `${h}%`, animationDelay: `${i * 0.1}s` }}></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* Legendary Features Showcase */}
            <section className="legendary-features">
                <div className="section-header">
                    <h2>لماذا <span>أصيل المالي</span>؟</h2>
                    <p>أدوات خرافية بُنيت للمستقبل، لتمنحك قوة تحكم مطلقة</p>
                </div>

                <div className="showcase-container">
                    <div className="showcase-list">
                        {features.map((feature, index) => (
                            <div
                                key={feature.id}
                                className={`showcase-item ${activeFeature === index ? 'active' : ''}`}
                                onMouseEnter={() => setActiveFeature(index)}
                                onClick={() => setActiveFeature(index)}
                            >
                                <div
                                    className="item-indicator"
                                    style={{
                                        backgroundColor: activeFeature === index ? feature.color : 'transparent',
                                        boxShadow: activeFeature === index ? `0 0 15px ${feature.color}` : 'none'
                                    }}
                                ></div>
                                <div className="item-text">
                                    <h3 style={{ color: activeFeature === index ? 'white' : '#94a3b8' }}>{feature.title}</h3>
                                    <div className="item-desc-wrapper" style={{ height: activeFeature === index ? '80px' : '0' }}>
                                        <p>{feature.desc}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="showcase-visual-area">
                        <div className="hologram-stage">
                            {/* Animated glowing core matching the active feature color */}
                            <div
                                className="hologram-glow"
                                style={{
                                    background: features[activeFeature].glow,
                                    boxShadow: `0 0 150px 80px ${features[activeFeature].glow}`
                                }}
                            ></div>

                            <div className="hologram-glass">
                                <div className="hologram-icon" style={{ color: features[activeFeature].color, filter: `drop-shadow(0 0 20px ${features[activeFeature].glow})` }}>
                                    {features[activeFeature].icon}
                                </div>
                            </div>

                            {/* Orbiting rings for sci-fi/premium effect */}
                            <div className="orbit orbit-1" style={{ borderColor: features[activeFeature].glow }}></div>
                            <div className="orbit orbit-2" style={{ borderColor: features[activeFeature].glow }}></div>
                            <div className="orbit orbit-3" style={{ borderColor: features[activeFeature].glow }}></div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <span className="logo-icon-small">أ</span>
                        <span>أصيل المالي &copy; {new Date().getFullYear()}</span>
                    </div>
                    <div className="footer-links">
                        <a href="#privacy">سياسة الخصوصية</a>
                        <a href="#terms">الشروط والأحكام</a>
                        <a href="mailto:support@aseel.sa">الدعم الفني</a>
                    </div>
                </div>
            </footer>
        </div>
    );
}
