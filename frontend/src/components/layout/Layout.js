import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';

import AnimatedBackground from '../ui/AnimatedBackground';
import SupportWidget from '../ui/SupportWidget';
import './Layout.css';

// ─── Icons (exact copy of icons.tsx) ──────────────────────────────────────────
const icon = (path, viewBox = '0 0 24 24') =>
    ({ size = 20, color = 'currentColor', strokeWidth = 1.8, ...rest }) => (
        <svg width={size} height={size} viewBox={viewBox} fill="none"
            stroke={color} strokeWidth={strokeWidth}
            strokeLinecap="round" strokeLinejoin="round" {...rest}>
            {path}
        </svg>
    );

const IconDashboard = icon(<><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>);
const IconLoans = icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" /></>);
const IconShield = icon(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />);
const IconUsers = icon(<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>);
const IconPlus = icon(<><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>);
const IconUpload = icon(<><polyline points="16 16 12 12 8 16" /><line x1="12" y1="12" x2="12" y2="21" /><path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" /></>);
const IconAnalytics = icon(<><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>);
const IconSettings = icon(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></>);
const IconLogout = icon(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></>);
const IconChevronLeft = icon(<polyline points="15 18 9 12 15 6" />);
const IconChevronRight = icon(<polyline points="9 18 15 12 9 6" />);
const IconStore = icon(<><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>);
const IconUserEmployee = icon(<><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></>);

// ─── Nav Items (exact match to LayoutShell.tsx NAV_ITEMS + Employees added) ───
const NAV_ITEMS = [
    { path: '/dashboard', label: 'الرئيسية', Icon: IconDashboard },
    { path: '/loans', label: 'القروض', Icon: IconLoans },
    { path: '/najiz', label: 'قضايا ناجز', Icon: IconShield },
    { path: '/customers', label: 'العملاء', Icon: IconUsers },
    { path: '/employees', label: 'الموظفون', Icon: IconUserEmployee },
    { path: '/add-loan', label: 'إضافة قرض', Icon: IconPlus },
    { path: '/excel-upload', label: 'رفع ملف', Icon: IconUpload },
    { path: '/analytics', label: 'التحليلات', Icon: IconAnalytics },
    { path: '/settings', label: 'الإعدادات', Icon: IconSettings },
];

// ─── Plan Labels ───────────────────────────────────────────────────────────────
const PLAN_LABELS = {
    free: { label: 'مجاني', color: '#64748b' },
    basic: { label: 'أساسي', color: '#3B82F6' },
    pro: { label: 'احترافي', color: '#8B5CF6' },
    enterprise: { label: 'أعمال', color: '#E8633A' },
};

// ─── Breadcrumb ────────────────────────────────────────────────────────────────
function Breadcrumb({ pathname }) {
    const currentItem = NAV_ITEMS.find(item => item.path === pathname);
    if (!currentItem || pathname === '/dashboard') return null;
    return (
        <nav className="breadcrumb" aria-label="مسار التصفح">
            <NavLink to="/dashboard" className="breadcrumb-link">الرئيسية</NavLink>
            <span className="breadcrumb-sep" aria-hidden="true">›</span>
            <span className="breadcrumb-current" aria-current="page">{currentItem.label}</span>
        </nav>
    );
}

// ─── Layout Shell ──────────────────────────────────────────────────────────────
export default function Layout({ children }) {
    const location = useLocation();
    const navigate = useNavigate();

    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [merchant, setMerchant] = useState({});
    const [darkMode, setDarkMode] = useState(false);

    useEffect(() => {
        const m = JSON.parse(localStorage.getItem('merchant') || '{}');
        setMerchant(m);
        const theme = localStorage.getItem('theme') || 'light';
        setDarkMode(theme === 'dark');
        document.documentElement.setAttribute('data-theme', theme);
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, []);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
        localStorage.setItem('theme', darkMode ? 'dark' : 'light');
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    // Close mobile menu on route change
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('merchant');
        localStorage.removeItem('user');
        navigate('/login');
    };

    const planKey = merchant.subscription_plan?.toLowerCase() || 'free';
    const plan = PLAN_LABELS[planKey] || PLAN_LABELS.free;

    return (
        <div className={`app-shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
            <AnimatedBackground />

            {/* Mobile overlay */}
            {mobileOpen && (
                <div
                    className="mobile-overlay"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Mobile menu button */}
            <button
                className="mobile-menu-btn"
                onClick={() => setMobileOpen(!mobileOpen)}
                aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
            >
                <div className={`hamburger ${mobileOpen ? 'open' : ''}`}>
                    <span /><span /><span />
                </div>
            </button>

            {/* Sidebar */}
            <aside id="sidebar" className="sidebar">

                {/* Brand */}
                <div className="sidebar-brand">
                    <div
                        className="brand-logo"
                        onClick={() => navigate('/')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate('/')}
                        title="الصفحة الرئيسية"
                    >
                        أ
                    </div>
                    {!collapsed && (
                        <div
                            className="brand-text"
                            onClick={() => navigate('/')}
                            role="button"
                            tabIndex={0}
                            onKeyDown={e => e.key === 'Enter' && navigate('/')}
                        >
                            <span className="brand-name">أصيل المالي</span>
                            <span className="brand-sub">نظام إدارة القروض</span>
                        </div>
                    )}
                    <button
                        className="collapse-btn"
                        onClick={() => setCollapsed(!collapsed)}
                        aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
                    >
                        {collapsed
                            ? <IconChevronRight size={14} color="rgba(255,255,255,0.5)" />
                            : <IconChevronLeft size={14} color="rgba(255,255,255,0.5)" />
                        }
                    </button>
                </div>

                {/* Merchant Info */}
                {!collapsed && (
                    <div
                        className="sidebar-merchant"
                        onClick={() => navigate('/settings')}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && navigate('/settings')}
                        title="الإعدادات"
                    >
                        <div className="merchant-avatar">
                            <IconStore size={14} color="#fff" />
                        </div>
                        <div className="merchant-info-text">
                            <div className="merchant-name">{merchant.store_name || 'المتجر'}</div>
                            <div className="merchant-email">{merchant.email || ''}</div>
                        </div>
                        <div
                            className="plan-badge"
                            style={{
                                background: plan.color + '20',
                                color: plan.color,
                                border: `1px solid ${plan.color}40`
                            }}
                        >
                            {plan.label}
                        </div>
                    </div>
                )}

                {/* Navigation */}
                <nav className="sidebar-nav" style={{ marginTop: '16px' }}>
                    {NAV_ITEMS.map(({ path, label, Icon }) => {
                        const active = location.pathname === path;
                        return (
                            <NavLink
                                key={path}
                                to={path}
                                className={`nav-item ${active ? 'active' : ''}`}
                            >
                                <span className="nav-icon">
                                    <Icon
                                        size={18}
                                        color={active ? '#FF6B35' : 'rgba(255,255,255,0.4)'}
                                    />
                                </span>
                                {!collapsed && (
                                    <span className="nav-label">{label}</span>
                                )}
                                {active && <span className="nav-indicator" />}
                            </NavLink>
                        );
                    })}
                </nav>

                {/* Bottom: Theme + Logout */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                        className="theme-toggle-btn"
                        onClick={() => setDarkMode(!darkMode)}
                    >
                        <span className="theme-icon">{darkMode ? '☀️' : '🌙'}</span>
                        {!collapsed && (
                            <span className="theme-label">
                                {darkMode ? 'وضع نهاري' : 'وضع ليلي'}
                            </span>
                        )}
                    </button>

                    <button className="sidebar-logout" onClick={handleLogout}>
                        <IconLogout size={16} color="rgba(239,68,68,0.6)" />
                        {!collapsed && <span>خروج</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <Breadcrumb pathname={location.pathname} />
                    {children}
                </div>
            </main>

            <SupportWidget />
        </div>
    );
}
