import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
    IconDashboard, IconLoans, IconUsers, IconPlus,
    IconUpload, IconAnalytics, IconSettings, IconLogout,
    IconChevronLeft, IconChevronRight, IconStore, IconShield
} from './Icons';
import { authAPI, settingsAPI } from '../services/api';
import AnimatedBackground from './AnimatedBackground';
import SupportWidget from './SupportWidget';
import './Layout.css';

const NAV_ITEMS = [
    { path: '/dashboard', label: 'الرئيسية', Icon: IconDashboard },
    { path: '/loans', label: 'القروض', Icon: IconLoans },
    { path: '/najiz-cases', label: 'قضايا ناجز', Icon: IconShield },
    { path: '/customers', label: 'العملاء', Icon: IconUsers },
    { path: '/add-loan', label: 'إضافة قرض', Icon: IconPlus },
    { path: '/excel-upload', label: 'رفع ملف', Icon: IconUpload },
    { path: '/analytics', label: 'التحليلات', Icon: IconAnalytics },
    { path: '/settings', label: 'الإعدادات', Icon: IconSettings },
    { path: '/pricing', label: 'الباقات', Icon: () => <span style={{ fontSize: 18 }}></span> },
];

// Breadcrumb component
function Breadcrumb({ location }) {
    const currentItem = NAV_ITEMS.find(item => item.path === location.pathname);
    if (!currentItem || location.pathname === '/dashboard') return null;
    return (
        <nav className="breadcrumb" aria-label="مسار التصفح">
            <Link to="/dashboard" className="breadcrumb-link">الرئيسية</Link>
            <span className="breadcrumb-sep" aria-hidden="true">›</span>
            <span className="breadcrumb-current" aria-current="page">{currentItem.label}</span>
        </nav>
    );
}

export default function Layout({ children }) {
    const navigate = useNavigate();
    const location = useLocation();
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');

    // ── Dark Mode ──
    const [darkMode, setDarkMode] = useState(() => {
        return localStorage.getItem('theme') === 'dark';
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    }, [darkMode]);

    // Close mobile menu on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [location.pathname]);

    // ── Refresh Merchant Data ──
    useEffect(() => {
        const refreshMerchant = async () => {
            try {
                const response = await settingsAPI.getProfile();
                const profile = response.data?.profile || response.profile;
                if (profile) {
                    const currentMerchant = JSON.parse(localStorage.getItem('merchant') || '{}');
                    const updatedMerchant = { ...currentMerchant, ...profile };
                    localStorage.setItem('merchant', JSON.stringify(updatedMerchant));
                }
            } catch (error) {
                console.error('Failed to refresh merchant data:', error);
            }
        };
        refreshMerchant();
    }, [location.pathname]);

    const handleLogout = () => {
        localStorage.clear();
        navigate('/login');
    };

    // Plan badge
    const planLabel = {
        free: { label: 'مجاني', color: '#64748b' },
        basic: { label: 'أساسي', color: '#3B82F6' },
        pro: { label: 'احترافي', color: '#8B5CF6' },
        enterprise: { label: 'أعمال', color: '#E8633A' },
    };
    const plan = planLabel[merchant.subscription_plan?.toLowerCase()] || planLabel.free;

    return (
        <div className={`app-shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
            {/* Stars behind everything */}
            <AnimatedBackground />

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="mobile-overlay"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Mobile hamburger button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                aria-expanded={mobileOpen}
                aria-controls="sidebar"
            >
                <span className={`hamburger ${mobileOpen ? 'open' : ''}`} aria-hidden="true">
                    <span /><span /><span />
                </span>
            </button>

            {/* Sidebar */}
            <aside
                id="sidebar"
                className="sidebar glass-card"
                role="navigation"
                aria-label="القائمة الرئيسية"
            >
                {/* Brand */}
                <div className="sidebar-brand">
                    <div className="brand-logo" role="img" aria-label="شعار أصيل المالي">
                        <span>أ</span>
                    </div>
                    {!collapsed && (
                        <div className="brand-text">
                            <span className="brand-name">أصيل المالي</span>
                            <span className="brand-sub">نظام إدارة القروض</span>
                        </div>
                    )}
                    <button
                        className="collapse-btn"
                        onClick={() => setCollapsed(!collapsed)}
                        title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
                        aria-label={collapsed ? 'توسيع القائمة الجانبية' : 'طي القائمة الجانبية'}
                        aria-expanded={!collapsed}
                    >
                        {collapsed
                            ? <IconChevronRight size={16} color="var(--text-muted)" />
                            : <IconChevronLeft size={16} color="var(--text-muted)" />
                        }
                    </button>
                </div>

                {/* Merchant Info */}
                {!collapsed && (
                    <div className="sidebar-merchant" role="status" aria-label="معلومات الحساب">
                        <div className="merchant-avatar" aria-hidden="true">
                            <IconStore size={16} color="var(--accent)" />
                        </div>
                        <div className="merchant-info-text">
                            <div className="merchant-name">{merchant.store_name || merchant.businessName || 'المتجر'}</div>
                            <div className="merchant-email">{merchant.email || ''}</div>
                        </div>
                        <div
                            className="plan-badge"
                            style={{ background: plan.color + '20', color: plan.color, border: `1px solid ${plan.color}40` }}
                            aria-label={`الباقة: ${plan.label}`}
                        >
                            {plan.label}
                        </div>
                    </div>
                )}

                {/* Nav */}
                <nav className="sidebar-nav" aria-label="روابط التنقل">
                    {NAV_ITEMS.map(({ path, label, Icon }) => {
                        const active = location.pathname === path;
                        const isFree = merchant.subscription_plan?.toLowerCase() === 'free';
                        const isBasic = merchant.subscription_plan?.toLowerCase() === 'basic';

                        // Feature gating labels
                        let badge = null;
                        if ((isFree || isBasic) && (path === '/analytics' || path === '/excel-upload')) {
                            badge = '';
                        }

                        return (
                            <button
                                key={path}
                                className={`nav-item ${active ? 'active' : ''}`}
                                onClick={() => navigate(path)}
                                title={label}
                                aria-current={active ? 'page' : undefined}
                                aria-label={label}
                            >
                                <span className="nav-icon" aria-hidden="true">
                                    <Icon size={18} color={active ? 'var(--accent)' : 'rgba(255, 255, 255, 0.5)'} />
                                </span>
                                {!collapsed && (
                                    <>
                                        <span className="nav-label">{label}</span>
                                        {badge && <span className="nav-badge" style={{ marginLeft: 'auto', fontSize: 10 }} aria-label="مميزة" title="يتطلب ترقية الباقة">{badge}</span>}
                                    </>
                                )}
                                {active && <span className="nav-indicator" aria-hidden="true" />}
                            </button>
                        );
                    })}
                </nav>

                {/* Dark Mode Toggle */}
                <button
                    className="theme-toggle-btn"
                    onClick={() => setDarkMode(!darkMode)}
                    title={darkMode ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
                    aria-label={darkMode ? 'التبديل للوضع النهاري' : 'التبديل للوضع الليلي'}
                    aria-pressed={darkMode}
                >
                    <span className="theme-icon" aria-hidden="true">{darkMode ? '️' : ''}</span>
                    {!collapsed && (
                        <span className="theme-label">
                            {darkMode ? 'وضع نهاري' : 'وضع ليلي'}
                        </span>
                    )}
                </button>

                {/* Logout */}
                <button
                    className="sidebar-logout"
                    onClick={handleLogout}
                    title="تسجيل الخروج من النظام"
                    aria-label="تسجيل الخروج"
                >
                    <IconLogout size={17} color="#EF4444" aria-hidden="true" />
                    {!collapsed && <span>خروج</span>}
                </button>
            </aside>

            {/* Main Content */}
            <main id="main-content" className="main-content" tabIndex="-1">
                <Breadcrumb location={location} />
                {children}
            </main>

            {/* Customer Service Widget */}
            <SupportWidget />
        </div>
    );
}
