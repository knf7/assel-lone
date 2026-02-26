import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './DashboardHome.css';

const DashboardHome = () => {
    const [metrics, setMetrics] = useState({
        totalOutstanding: 0,
        activeCustomers: 0,
        loansThisMonth: 0,
        collectionRate: 0
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const merchantName = localStorage.getItem('merchant_name');
    const subscriptionPlan = localStorage.getItem('subscription_plan');

    useEffect(() => {
        fetchDashboardMetrics();
    }, []);

    const fetchDashboardMetrics = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/dashboard/metrics');
            setMetrics(response.data);
            setError('');
        } catch (err) {
            setError('فشل تحميل البيانات');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    if (loading) {
        return (
            <div className="dashboard-loading">
                <div className="spinner-large"></div>
                <p>جاري تحميل البيانات...</p>
            </div>
        );
    }

    return (
        <div className="dashboard-container">
            {/* Header */}
            <header className="dashboard-header">
                <div className="header-content">
                    <div className="header-left">
                        <h1>مرحباً، {merchantName}</h1>
                        <p className="subtitle">نظرة عامة على نشاطك التجاري</p>
                    </div>
                    <div className="header-right">
                        <div className="subscription-badge">
                            <span className={`badge badge-${subscriptionPlan?.toLowerCase()}`}>
                                {subscriptionPlan === 'Pro' ? ' Pro' : subscriptionPlan === 'Enterprise' ? ' Enterprise' : '🆓 مجاني'}
                            </span>
                        </div>
                        <button onClick={handleLogout} className="logout-button">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" />
                            </svg>
                            تسجيل الخروج
                        </button>
                    </div>
                </div>
            </header>

            {error && (
                <div className="error-banner">
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" />
                    </svg>
                    {error}
                    <button onClick={fetchDashboardMetrics}>إعادة المحاولة</button>
                </div>
            )}

            {/* Metrics Cards */}
            <div className="metrics-grid">
                <div className="metric-card card-primary">
                    <div className="metric-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div className="metric-content">
                        <p className="metric-label">إجمالي الديون المستحقة</p>
                        <h2 className="metric-value">{metrics.totalOutstanding.toLocaleString('ar-SA')} ريال</h2>
                        <div className="metric-trend trend-up">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" />
                            </svg>
                            <span>+12% من الشهر الماضي</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card card-success">
                    <div className="metric-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                    </div>
                    <div className="metric-content">
                        <p className="metric-label">العملاء النشطون</p>
                        <h2 className="metric-value">{metrics.activeCustomers}</h2>
                        <div className="metric-trend trend-neutral">
                            <span>إجمالي العملاء المسجلين</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card card-warning">
                    <div className="metric-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div className="metric-content">
                        <p className="metric-label">قروض هذا الشهر</p>
                        <h2 className="metric-value">{metrics.loansThisMonth}</h2>
                        <div className="metric-trend trend-up">
                            <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" />
                            </svg>
                            <span>+8 من الأسبوع الماضي</span>
                        </div>
                    </div>
                </div>

                <div className="metric-card card-info">
                    <div className="metric-icon">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <div className="metric-content">
                        <p className="metric-label">معدل التحصيل</p>
                        <h2 className="metric-value">{metrics.collectionRate}%</h2>
                        <div className="metric-trend trend-up">
                            <span>أداء ممتاز</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="quick-actions">
                <h3>إجراءات سريعة</h3>
                <div className="actions-grid">
                    <button className="action-button" onClick={() => navigate('/loans')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>تسجيل دين جديد</span>
                    </button>
                    <button className="action-button" onClick={() => navigate('/customers')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>إدارة العملاء</span>
                    </button>
                    <button className="action-button" onClick={() => navigate('/reports')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>التقارير</span>
                    </button>
                    <button className="action-button" onClick={() => navigate('/settings')}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span>الإعدادات</span>
                    </button>
                </div>
            </div>

            {/* Recent Activity */}
            <div className="recent-activity">
                <div className="section-header">
                    <h3>النشاط الأخير</h3>
                    <button className="view-all-button">عرض الكل</button>
                </div>
                <div className="activity-list">
                    <div className="activity-item">
                        <div className="activity-icon success">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                            </svg>
                        </div>
                        <div className="activity-content">
                            <p className="activity-title">تم تسجيل دين جديد</p>
                            <p className="activity-description">أحمد علي - 5,000 ريال</p>
                        </div>
                        <span className="activity-time">منذ 5 دقائق</span>
                    </div>
                    <div className="activity-item">
                        <div className="activity-icon info">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 016 6H2a6 6 0 016-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                            </svg>
                        </div>
                        <div className="activity-content">
                            <p className="activity-title">عميل جديد</p>
                            <p className="activity-description">محمد خالد</p>
                        </div>
                        <span className="activity-time">منذ ساعة</span>
                    </div>
                    <div className="activity-item">
                        <div className="activity-icon warning">
                            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" />
                            </svg>
                        </div>
                        <div className="activity-content">
                            <p className="activity-title">دين متأخر</p>
                            <p className="activity-description">سارة أحمد - 3,000 ريال</p>
                        </div>
                        <span className="activity-time">منذ 3 ساعات</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardHome;
