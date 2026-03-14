'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { customersAPI, loansAPI, reportsAPI } from '@/lib/api';
import {
  IconAnalytics,
  IconDashboard,
  IconLogout,
  IconLoans,
  IconPlus,
  IconScale,
  IconSettings,
  IconStar,
  IconDiamond,
  IconStore,
  IconUpload,
  IconUsers,
} from './icons';
import AnimatedBackground from './AnimatedBackground';
import SupportWidget from './SupportWidget';
import '@/app/dashboard/layout-shell.css';

type Merchant = {
  store_name?: string;
  email?: string;
  subscription_plan?: string;
  role?: 'merchant' | 'employee' | string;
  permissions?: Record<string, boolean> | null;
};

type NavItem = {
  path: string;
  label: string;
  Icon: React.ComponentType<{ size?: number; color?: string; className?: string }>;
  group: 'operations' | 'insights' | 'system';
};

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'الرئيسية', Icon: IconDashboard, group: 'operations' },
  { path: '/dashboard/customers', label: 'العملاء', Icon: IconUsers, group: 'operations' },
  { path: '/dashboard/loans', label: 'القروض', Icon: IconLoans, group: 'operations' },
  { path: '/dashboard/najiz', label: 'قضايا ناجز', Icon: IconScale, group: 'operations' },
  { path: '/dashboard/analytics', label: 'التحليلات', Icon: IconAnalytics, group: 'insights' },
  { path: '/dashboard/settings', label: 'الإعدادات', Icon: IconSettings, group: 'system' },
];

const QUICK_ACTIONS = [
  { path: '/dashboard/loans/new', label: 'إضافة قرض', Icon: IconPlus },
  { path: '/dashboard/loans/import', label: 'رفع ملف', Icon: IconUpload },
];

const GROUP_LABELS: Record<NavItem['group'], string> = {
  operations: 'التشغيل اليومي',
  insights: 'الرؤية والتحليل',
  system: 'النظام',
};

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  free: { label: 'مجاني', color: '#64748b' },
  basic: { label: 'أساسي', color: '#3B82F6' },
  pro: { label: 'احترافي', color: '#8B5CF6' },
  enterprise: { label: 'أعمال', color: '#60A5FA' },
};

const scheduleIdle = (callback: () => void) => {
  if (typeof window === 'undefined') return () => {};
  const idle = (window as any).requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined;
  const cancelIdle = (window as any).cancelIdleCallback as ((id: number) => void) | undefined;
  if (idle) {
    const id = idle(callback, { timeout: 2000 });
    return () => cancelIdle?.(id);
  }
  const id = window.setTimeout(callback, 600);
  return () => window.clearTimeout(id);
};

const readStoredMerchant = (): Merchant => {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem('merchant') || '{}');
  } catch {
    return {};
  }
};

function AseelLogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <svg
      viewBox="0 0 88 88"
      className={`aseel-mark ${compact ? 'compact' : ''}`}
      role="img"
      aria-label="شعار أصيل المالي"
    >
      <defs>
        <linearGradient id="aseel-core" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#60A5FA" />
        </linearGradient>
        <linearGradient id="aseel-frame" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>

      <rect x="18" y="18" width="52" height="52" rx="16" fill="url(#aseel-core)" />
      <rect x="13" y="13" width="62" height="62" rx="20" fill="none" stroke="url(#aseel-frame)" strokeWidth="3" opacity="0.9" />
      <rect x="30" y="31" width="7" height="26" rx="3.5" fill="#F8FAFC" />
      <rect x="43" y="26" width="7" height="31" rx="3.5" fill="#E2E8F0" />
      <rect x="56" y="36" width="7" height="21" rx="3.5" fill="#CBD5E1" />
      <circle cx="59.5" cy="29.5" r="4.3" fill="#F8FAFC" />
    </svg>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const currentItem = NAV_ITEMS.find((item) => item.path === pathname);
  if (!currentItem || pathname === '/dashboard') return null;
  return (
    <nav className="breadcrumb" aria-label="مسار التصفح">
      <Link href="/dashboard" className="breadcrumb-link">الرئيسية</Link>
      <span className="breadcrumb-sep" aria-hidden="true">›</span>
      <span className="breadcrumb-current" aria-current="page">{currentItem.label}</span>
    </nav>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const collapsed = false;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [currentUser] = useState<Merchant>(readStoredMerchant);
  const merchant = currentUser;
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return (localStorage.getItem('theme') || 'light') === 'dark';
  });

  const currentTitle = useMemo(() => {
    const current = NAV_ITEMS.find((item) => pathname === item.path || pathname?.startsWith(`${item.path}/`));
    return current?.label || 'لوحة التحكم';
  }, [pathname]);

  const hasPageAccess = useCallback((path: string) => {
    if (!currentUser.role || currentUser.role === 'merchant') return true;
    const perms = currentUser.permissions || {};
    if (path.startsWith('/dashboard/loans')) return !!perms.can_view_loans;
    if (path.startsWith('/dashboard/customers')) return !!perms.can_view_customers;
    if (path.startsWith('/dashboard/najiz')) return !!(perms.can_view_najiz || perms.can_view_loans);
    if (path.startsWith('/dashboard/analytics')) return !!perms.can_view_analytics;
    if (path.startsWith('/dashboard/settings')) return !!perms.can_view_settings;
    if (path === '/dashboard') return !!perms.can_view_dashboard;
    return true;
  }, [currentUser.permissions, currentUser.role]);

  const visibleNavItems = useMemo(
    () => NAV_ITEMS.filter((item) => hasPageAccess(item.path)),
    [hasPageAccess]
  );
  const visibleQuickActions = useMemo(() => {
    if (!currentUser.role || currentUser.role === 'merchant') return QUICK_ACTIONS;
    const perms = currentUser.permissions || {};
    return QUICK_ACTIONS.filter((action) => {
      if (action.path.includes('/new')) return !!perms.can_add_loans;
      if (action.path.includes('/import')) return !!perms.can_upload_loans;
      return true;
    });
  }, [currentUser.permissions, currentUser.role]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    const palette = 'aero-silver';
    localStorage.setItem('color_palette', palette);
    document.documentElement.setAttribute('data-color-palette', palette);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const token = localStorage.getItem('token');
    if (!token && pathname !== '/login') {
      toast.error('انتهت الجلسة، الرجاء تسجيل الدخول مجدداً.');
      router.replace('/login');
    }
  }, [pathname, router]);

  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!pathname || hasPageAccess(pathname)) return;
    const fallback = visibleNavItems[0]?.path || '/login';
    if (pathname !== fallback) {
      router.replace(fallback);
    }
  }, [pathname, hasPageAccess, router, visibleNavItems]);

  useEffect(() => {
    if (!visibleNavItems.length) return;
    const routes = visibleNavItems
      .map((item) => item.path)
      .filter((path) => path !== pathname)
      .slice(0, 4);
    if (routes.length === 0) return;
    return scheduleIdle(() => {
      routes.forEach((path) => router.prefetch(path));
    });
  }, [router, pathname, visibleNavItems]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const connection = (navigator as any)?.connection;
    if (connection?.saveData) return;
    if (typeof connection?.effectiveType === 'string' && ['slow-2g', '2g'].includes(connection.effectiveType)) {
      return;
    }

    return scheduleIdle(() => {
      customersAPI.prefetchAll({ page: 1, limit: 15 });
      loansAPI.prefetchAll({ page: 1, limit: 20 });
      if (visibleNavItems.some((item) => item.path === '/dashboard/najiz')) {
        loansAPI.prefetchAll({ is_najiz_case: true, limit: 100, skip_count: true });
      }
      if (visibleNavItems.some((item) => item.path === '/dashboard/analytics')) {
        reportsAPI.getAnalytics({ interval: 'year' });
      }
    });
  }, [visibleNavItems]);

  useEffect(() => {
    const runMonthEndNotice = async () => {
      if (currentUser.role && currentUser.role !== 'merchant') return;
      const now = new Date();
      const day = now.getDate();
      if (day < 28) return;

      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const key = `month_end_overdue_notice_${y}-${m}`;
      if (localStorage.getItem(key) === '1') return;

      try {
        const res = await reportsAPI.getDashboard({});
        const d = res.data || res;
        const overdueCount = Number(d?.metrics?.overdueCustomers || 0);
        if (overdueCount > 0) {
          toast.warning(`تنبيه نهاية الشهر: لديك ${overdueCount.toLocaleString('en-US')} عميل متأخر عن السداد.`);
          localStorage.setItem(key, '1');
        }
      } catch {
        // Silent: this notice is non-critical.
      }
    };

    return scheduleIdle(runMonthEndNotice);
  }, [currentUser.role]);

  const handleLogout = useCallback(() => {
    localStorage.clear();
    router.push('/login');
  }, [router]);

  const plan = useMemo(
    () => PLAN_LABELS[merchant.subscription_plan?.toLowerCase() || 'free'] || PLAN_LABELS.free,
    [merchant.subscription_plan]
  );

  return (
    <div className={`ops-shell ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
      <AnimatedBackground />

      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} aria-hidden="true" />}

      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
        aria-controls="sidebar-nav"
        aria-expanded={mobileOpen}
      >
        <span className={`hamburger ${mobileOpen ? 'open' : ''}`}><span /><span /><span /></span>
      </button>

      <aside id="sidebar" className="ops-sidebar" aria-label="القائمة الجانبية">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <div className="brand-logo-creative" aria-label="أصيل المالي">
              <AseelLogoMark />
              <div className="brand-logo-caption">إدارة ذكية للعملاء والمعاملات المالية</div>
            </div>
          </div>

          {!collapsed && (
            <div className="sidebar-merchant">
              <div className="merchant-avatar"><IconStore size={19} color="#fff" /></div>
              <div className="merchant-info-text">
                <div className="merchant-name">{merchant.store_name || 'المتجر'}</div>
                <div className="merchant-email">{merchant.email || ''}</div>
              </div>
              <div
                className="plan-badge"
                style={{ background: `${plan.color}20`, color: plan.color, borderColor: `${plan.color}40` }}
              >
                {plan.label}
              </div>
            </div>
          )}

          {!collapsed && (
            <div className="quick-actions" aria-label="إجراءات سريعة">
              {visibleQuickActions.map(({ path, label, Icon }) => (
                <Link key={path} href={path} className="quick-action" onClick={() => setMobileOpen(false)}>
                  <Icon size={16} />
                  <span>{label}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <nav id="sidebar-nav" className="sidebar-nav" aria-label="تنقل لوحة التحكم">
          {(Object.keys(GROUP_LABELS) as NavItem['group'][]).map((group) => {
            const items = visibleNavItems.filter((item) => item.group === group);
            if (items.length === 0) return null;

            return (
              <section key={group} className="nav-group">
                {!collapsed && <h3 className="nav-group-title">{GROUP_LABELS[group]}</h3>}
                {items.map(({ path, label, Icon }) => {
                  const active = pathname === path;
                  return (
                    <Link
                      key={path}
                      href={path}
                      className={`nav-item ${active ? 'active' : ''}`}
                      aria-current={active ? 'page' : undefined}
                      onClick={() => setMobileOpen(false)}
                    >
                      <span className="nav-icon"><Icon size={18} /></span>
                      {!collapsed && <span className="nav-label">{label}</span>}
                    </Link>
                  );
                })}
              </section>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <button
            className="theme-toggle-btn"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'تفعيل الوضع النهاري' : 'تفعيل الوضع الليلي'}
            aria-pressed={darkMode}
          >
            <span className="theme-icon" aria-hidden="true">
              {darkMode ? <IconDiamond size={18} /> : <IconStar size={18} />}
            </span>
            {!collapsed && <span className="theme-label">{darkMode ? 'وضع نهاري' : 'وضع ليلي'}</span>}
          </button>

          <button className="sidebar-logout" onClick={handleLogout} aria-label="تسجيل الخروج">
            <IconLogout size={16} />
            {!collapsed && <span>تسجيل الخروج</span>}
          </button>
        </div>
      </aside>

      <main className="ops-main">
        <header className="topbar">
          <div>
            <h1 className="topbar-title">{currentTitle}</h1>
            <Breadcrumb pathname={pathname} />
          </div>
          <label className="command-box" aria-label="بحث سريع">
            <input placeholder="ابحث عن عميل، قرض، أو أمر..." />
            <kbd>⌘K</kbd>
          </label>
        </header>

        <section className="page-surface">
          {children}
        </section>
      </main>

      <SupportWidget />
    </div>
  );
}
