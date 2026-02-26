import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { reportsAPI, loansAPI } from '../services/api';
import Layout from '../components/Layout';
import {
    IconMoney, IconUsers, IconCalendar, IconCheck,
    IconAlertTriangle, IconStore, IconTrend, IconTrendDown,
    IconDownload, IconPlus, IconRocket, IconActivity,
    IconShield, IconUser, IconAlertCircle, IconInfo,
    IconClipboard, IconPieChart, IconWhatsapp, IconLoans,
    IconAnalytics, IconUpload
} from '../components/Icons';
import './DashboardPage.css';

const MONTH_NAMES = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
};

const STATUS_MAP = {
    Active: { label: 'نشط', color: '#3B82F6' },
    Paid: { label: 'مدفوع', color: '#22C55E' },
    Overdue: { label: 'متأخر', color: '#EF4444' },
    Cancelled: { label: 'ملغي', color: '#9CA3AF' },
};

// ─── Stat Card ───────────────────────────────────────
function StatCard({ label, value, sub, Icon, color, trend, loading, onClick }) {
    return (
        <div className={`stat-card fade-up ${onClick ? 'clickable' : ''}`} onClick={onClick}>
            <div className="stat-icon" style={{ background: color + '15', color }}>
                {Icon && <Icon size={22} color={color} />}
            </div>
            <div className="stat-body">
                <div className="stat-value">{loading ? <span className="sk-val" /> : value}</div>
                <div className="stat-label">{label}</div>
                {sub && <div className="stat-sub">{sub}</div>}
            </div>
            {trend !== undefined && (
                <div className={`stat-trend ${trend >= 0 ? 'up' : 'down'}`}>
                    {trend >= 0
                        ? <IconTrend size={13} color="#22C55E" />
                        : <IconTrendDown size={13} color="#EF4444" />}
                    <span>{Math.abs(trend)}%</span>
                </div>
            )}
        </div>
    );
}

// ─── Toast ───────────────────────────────────────────
function ToastContainer({ toasts }) {
    return (
        <div className="toast-container">
            {toasts.map(t => (
                <div key={t.id} className={`toast toast-${t.type}`}>
                    <div className="toast-icon-wrap">
                        {t.type === 'danger' && <IconAlertCircle size={18} color="#EF4444" />}
                        {t.type === 'warning' && <IconAlertTriangle size={18} color="#F59E0B" />}
                        {t.type === 'success' && <IconCheck size={18} color="#22C55E" />}
                        {t.type === 'info' && <IconInfo size={18} color="#3B82F6" />}
                    </div>
                    <div>
                        <div className="toast-title">{t.title}</div>
                        <div className="toast-text">{t.text}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}

// ─── Overdue Marquee ─────────────────────────────────
function OverdueMarquee({ clients }) {
    if (!clients || clients.length === 0) return null;
    const full = [...clients, ...clients];
    return (
        <div className="overdue-marquee-wrap fade-up">
            <div className="marquee-label-pill">
                <IconAlertTriangle size={14} color="#EF4444" />
                <span>متأخرون عن السداد</span>
            </div>
            <div className="marquee-track">
                <div className="marquee-inner">
                    {full.map((c, i) => (
                        <div key={i} className="marquee-chip">
                            <IconUser size={12} color="#EF4444" />
                            <span className="marquee-name">{c.full_name || c}</span>
                            {c.debt && <span className="marquee-debt">{parseFloat(c.debt).toLocaleString('ar-SA')} ر.س</span>}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── AI Insight Card ─────────────────────────────────
function InsightCard({ ins }) {
    const icons = {
        danger: <IconAlertCircle size={18} color="#EF4444" />,
        warning: <IconAlertTriangle size={18} color="#F59E0B" />,
        success: <IconCheck size={18} color="#22C55E" />,
        info: <IconInfo size={18} color="#3B82F6" />,
    };
    return (
        <div className={`insight-card insight-${ins.type}`}>
            <div className="insight-header">
                <div className={`insight-icon-wrap insight-icon-${ins.type}`}>
                    {icons[ins.type]}
                </div>
                <div className="insight-category">{ins.category}</div>
            </div>
            <div className="insight-title">{ins.title}</div>
            <p className="insight-detail">{ins.detail}</p>
            {ins.action && (
                <div className="insight-action">{ins.action}</div>
            )}
        </div>
    );
}

// ─── Risk Meter ──────────────────────────────────────
function RiskMeter({ high, med, low }) {
    const total = (high + med + low) || 1;
    return (
        <div className="risk-meter">
            <div className="risk-bar-wrap">
                <div className="risk-segment risk-high" style={{ width: `${(high / total) * 100}%` }} title={`خطر عال: ${high}`} />
                <div className="risk-segment risk-med" style={{ width: `${(med / total) * 100}%` }} title={`خطر متوسط: ${med}`} />
                <div className="risk-segment risk-low" style={{ width: `${(low / total) * 100}%` }} title={`متابعة: ${low}`} />
            </div>
            <div className="risk-legend">
                <span><span className="risk-dot risk-high" />{high} عالي</span>
                <span><span className="risk-dot risk-med" />{med} متوسط</span>
                <span><span className="risk-dot risk-low" />{low} منخفض</span>
            </div>
        </div>
    );
}

// ─── Free Trial Banner ───────────────────────────────
function FreeTrialBanner({ expiryDate }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        if (!expiryDate) return;

        const updateTimer = () => {
            const end = new Date(expiryDate).getTime();
            const now = new Date().getTime();
            const diff = end - now;

            if (diff <= 0) {
                setTimeLeft('انتهت الفترة التجريبية');
                return;
            }

            const hours = Math.floor(diff / (1000 * 60 * 60));
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            setTimeLeft(`${hours} ساعة و ${minutes} دقيقة`);
        };

        updateTimer();
        const interval = setInterval(updateTimer, 60000); // update every minute
        return () => clearInterval(interval);
    }, [expiryDate]);

    if (!expiryDate) return null;

    return (
        <div className="free-trial-banner fade-up">
            <div className="ft-icon"><IconRocket size={20} color="#fff" /></div>
            <div className="ft-content">
                <div className="ft-title">باقة الأعمال (Enterprise) - فترة تجريبية مجانية</div>
                <div className="ft-subtitle">تنتهي في: <strong>{timeLeft}</strong></div>
            </div>
            <button className="btn btn-outline ft-btn" onClick={() => window.location.href = '/pricing'}>
                الترقية الآن
            </button>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────
export default function DashboardPage() {
    const navigate = useNavigate();
    const [metrics, setMetrics] = useState(null);
    const [debtTrend, setDebtTrend] = useState([]);
    const [statusDist, setStatusDist] = useState([]);
    const [aiData, setAiData] = useState(null);
    const [chartInterval, setChartInterval] = useState('week'); // Default to weekly as requested
    const [loading, setLoading] = useState(true);
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((toast) => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, ...toast }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 6000);
    }, []);

    const fetchDashboard = useCallback(async () => {
        try {
            const [dashRes, analyticsRes, aiRes] = await Promise.all([
                reportsAPI.getDashboard(),
                reportsAPI.getAnalytics({ interval: chartInterval }).catch(() => ({ data: {} })),
                reportsAPI.getAIAnalysis().catch(() => ({ data: null }))
            ]);

            // ── Metrics ──
            const m = dashRes.data?.metrics || {};
            setMetrics(m);

            // ── Debt trend chart ──
            const analytics = analyticsRes.data || {};
            const trend = (analytics.debtTrend || []).map(r => {
                let name = r.month;
                if (chartInterval === 'week') {
                    // For week interval, the backend returns MM-DD. E.g "02-23"
                    const [m, d] = r.month.split('-');
                    name = `${d}/${m}`;
                } else if (chartInterval === 'month') {
                    // For month interval, the backend returns IYYY-IW. E.g "2026-08" (8th week)
                    const [, w] = r.month.split('-');
                    name = `أسبوع ${w}`;
                } else if (chartInterval === '6months' || chartInterval === 'year') {
                    // For 6months or year, the backend returns YYYY-MM. E.g "2026-02"
                    name = MONTH_NAMES[r.month?.slice(5, 7)] || r.month || '';
                }
                return {
                    month: name,
                    amount: parseFloat(r.total) || 0,
                    count: parseInt(r.loan_count) || 0
                };
            });
            setDebtTrend(trend);

            // ── Status distribution ──
            const dist = (analytics.statusDistribution || []).map(r => ({
                ...r,
                label: STATUS_MAP[r.status]?.label || r.status,
                color: STATUS_MAP[r.status]?.color || '#999',
                count: parseInt(r.count, 10) || 0
            }));
            setStatusDist(dist);

            // ── AI Data ──
            if (aiRes.data) setAiData(aiRes.data);

            // ── Due-today notifications from AI overdue clients ──
            const overdueClients = aiRes.data?.overdueClients || [];
            if (overdueClients.length > 0) {
                addToast({
                    type: 'warning',
                    title: 'عملاء متأخرون',
                    text: `${overdueClients.length} عميل لم يسددوا منذ +30 يوم`
                });
            }

            // Extreme risk alert
            const risk = aiRes.data?.summary?.riskSegmentation;
            if (risk?.highRisk > 0) {
                addToast({
                    type: 'danger',
                    title: 'تنبيه مخاطر عالية',
                    text: `${risk.highRisk} عميل تجاوز 90 يوماً — إجراء عاجل مطلوب`
                });
            }

        } catch (err) {
            console.error('Dashboard fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => { fetchDashboard(); }, [fetchDashboard, chartInterval]);

    // ── CSV Export ──────────────────────────────────
    const handleExportCSV = async () => {
        try {
            const res = await loansAPI.getAll({ limit: 9999 });
            const loans = res.data?.loans || [];
            if (!loans.length) {
                addToast({ type: 'warning', title: 'لا توجد بيانات', text: 'لم يتم العثور على قروض' });
                return;
            }
            const headers = ['الاسم', 'رقم الهوية', 'الجوال', 'المبلغ', 'الحالة', 'تاريخ المعاملة'];
            const rows = loans.map(l => [
                l.customer_name || '', l.national_id || '', l.mobile_number || '',
                l.amount || 0, STATUS_MAP[l.status]?.label || l.status || '',
                l.transaction_date ? new Date(l.transaction_date).toLocaleDateString('ar-SA') : ''
            ]);
            const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `قروض-${new Date().toISOString().slice(0, 10)}.csv`;
            link.click();
            addToast({ type: 'success', title: 'تم التصدير بنجاح', text: `${loans.length} سجل` });
        } catch {
            addToast({ type: 'danger', title: 'خطأ', text: 'فشل تصدير البيانات' });
        }
    };

    // ── Loading State ────────────────────────────────
    if (loading) {
        return (
            <Layout>
                <div className="db-loading">
                    <div className="db-spinner" />
                    <p>جاري تحميل البيانات...</p>
                </div>
            </Layout>
        );
    }

    const pieData = statusDist.filter(d => d.count > 0);
    const hasCharts = debtTrend.length > 0 || pieData.length > 0;
    const ai = aiData?.summary || {};
    const insights = aiData?.insights || [];
    const overdueClients = aiData?.overdueClients || [];
    const recommendations = aiData?.recommendations || [];
    const risk = ai.riskSegmentation || { highRisk: 0, medRisk: 0, lowRisk: 0 };
    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');

    return (
        <Layout>
            <ToastContainer toasts={toasts} />

            {/* ── Free Trial Banner ── */}
            {merchant.subscriptionPlan?.toLowerCase() === 'enterprise' && merchant.expiryDate && (
                <FreeTrialBanner expiryDate={merchant.expiryDate} />
            )}

            {/* ── Page Header ── */}
            <div className="db-header fade-up">
                <div>
                    <h1 className="db-title">لوحة التحكم</h1>
                    <p className="db-subtitle">
                        {new Date().toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        {merchant.store_name && <span className="db-store"> · {merchant.store_name}</span>}
                    </p>
                </div>
                <div className="db-actions">
                    <button className="btn btn-secondary" onClick={handleExportCSV}>
                        <IconDownload size={16} /> تصدير CSV
                    </button>
                    <button className="btn btn-primary" onClick={() => navigate('/add-loan')}>
                        <IconPlus size={16} /> إضافة قرض
                    </button>
                </div>
            </div>

            {/* ── Overdue Marquee ── */}
            <OverdueMarquee clients={overdueClients} />

            {/* ── Stats Grid ── */}
            <div className="stats-grid">
                <StatCard
                    label="إجمالي الديون" Icon={IconMoney} color="#E8633A"
                    value={`${(parseFloat(metrics?.totalDebt) || 0).toLocaleString('ar-SA')} ر.س`}
                    sub="إجمالي المحفظة النشطة"
                />
                <StatCard
                    label="إجمالي العملاء" Icon={IconUsers} color="#3B82F6"
                    value={metrics?.totalCustomers || 0}
                    sub={`${metrics?.activeCustomers || 0} لديهم قروض نشطة`}
                />
                <StatCard
                    label="قروض هذا الشهر" Icon={IconCalendar} color="#8B5CF6"
                    value={metrics?.loansThisMonth || 0}
                    sub="تمت إضافتهم هذا الشهر"
                />
                <StatCard
                    label="قضايا ناجز" Icon={IconShield} color="#8B5CF6"
                    value={metrics?.raisedCount || 0}
                    sub="قضايا مرفوعة في ناجز"
                    onClick={() => navigate('/loans?status=Raised')}
                />
                <StatCard
                    label="متأخرات (+30)" Icon={IconAlertTriangle} color="#EF4444"
                    value={metrics?.overdueCustomers || 0}
                    sub="عملاء تجاوزوا 30 يوماً"
                    onClick={() => navigate('/loans?delayed=true')}
                />
                <StatCard
                    label="نسبة التحصيل" Icon={IconCheck} color="#22C55E"
                    value={`${metrics?.collectionRate || 0}%`}
                    sub="من إجمالي قيمة القروض"
                    trend={ai.growthRate}
                />
            </div>

            {/* ── Charts Row ── */}
            <div className="db-charts fade-up">
                {/* Area Chart */}
                <div className="chart-card chart-card-lg">
                    <div className="chart-header">
                        <div>
                            <h3 className="chart-title">
                                <IconTrend size={16} color="#E8633A" /> حركة القروض
                            </h3>
                            <p className="chart-sub">تتبع مبالغ القروض عبر الزمن</p>
                        </div>
                        <div className="chart-interval-selector" style={{ display: 'flex', gap: '5px', background: 'rgba(26,43,74,0.05)', padding: '4px', borderRadius: '8px' }}>
                            {[
                                { id: 'week', label: 'أسبوعي' },
                                { id: 'month', label: 'شهري' },
                                { id: '6months', label: '6 شهور' },
                                { id: 'year', label: 'سنوي' }
                            ].map(btn => (
                                <button
                                    key={btn.id}
                                    className={`btn-interval ${chartInterval === btn.id ? 'active' : ''}`}
                                    onClick={() => setChartInterval(btn.id)}
                                    style={{
                                        fontSize: '0.75rem',
                                        padding: '4px 10px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: chartInterval === btn.id ? '#E8633A' : 'transparent',
                                        color: chartInterval === btn.id ? '#fff' : 'var(--text-muted)',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    {btn.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {!hasCharts ? (
                        <div className="chart-empty">
                            <IconLoans size={40} color="var(--border)" />
                            <p>لا توجد بيانات بعد</p>
                            <button className="btn btn-primary btn-sm" onClick={() => navigate('/add-loan')}>
                                <IconPlus size={14} /> إضافة أول قرض
                            </button>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={debtTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="gradCoral" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#E8633A" stopOpacity={0.25} />
                                        <stop offset="100%" stopColor="#E8633A" stopOpacity={0.02} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,43,74,0.06)" />
                                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9AABBE' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: '#9AABBE' }} axisLine={false} tickLine={false}
                                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                                <Tooltip
                                    contentStyle={{ background: '#1A2B4A', border: 'none', borderRadius: 10, color: '#fff', fontSize: 13 }}
                                    formatter={v => [`${Number(v).toLocaleString('ar-SA')} ر.س`, 'المبلغ']}
                                />
                                <Area type="monotone" dataKey="amount" stroke="#E8633A" strokeWidth={2.5}
                                    fill="url(#gradCoral)" dot={{ fill: '#E8633A', r: 4, strokeWidth: 0 }} activeDot={{ r: 6 }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Pie Chart + Risk */}
                <div className="chart-card chart-card-sm">
                    <div className="chart-header">
                        <div>
                            <h3 className="chart-title">
                                <IconPieChart size={16} color="#8B5CF6" /> توزيع حالات القروض
                            </h3>
                            <p className="chart-sub">نسبة كل حالة</p>
                        </div>
                    </div>
                    {pieData.length === 0 ? (
                        <div className="chart-empty">
                            <IconPieChart size={36} color="var(--border)" />
                            <p>لا توجد بيانات</p>
                        </div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={180}>
                                <PieChart>
                                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={52} outerRadius={78}
                                        paddingAngle={3} dataKey="count">
                                        {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                                    </Pie>
                                    <Tooltip
                                        formatter={(v, n, p) => [v, p.payload.label]}
                                        contentStyle={{ background: '#1A2B4A', border: 'none', borderRadius: 8, color: '#fff', fontSize: 12 }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="pie-legend">
                                {pieData.map((d, i) => (
                                    <div key={i} className="pie-legend-item">
                                        <span className="pie-dot" style={{ background: d.color }} />
                                        <span>{d.label}</span>
                                        <span className="pie-count">{d.count}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {/* Risk Segmentation */}
                    {(risk.highRisk + risk.medRisk + risk.lowRisk) > 0 && (
                        <div className="chart-divider">
                            <div className="chart-sub-title">
                                <IconShield size={14} color="#E8633A" /> تصنيف المخاطر
                            </div>
                            <RiskMeter high={risk.highRisk} med={risk.medRisk} low={risk.lowRisk} />
                        </div>
                    )}
                </div>
            </div>

            {/* ── AI Analysis Section ── */}
            {
                merchant?.subscription_plan?.toLowerCase() !== 'enterprise' ? (
                    <div className="ai-section fade-up locked-tier-section">
                        <div className="locked-overlay">
                            <IconShield size={32} color="#8B5CF6" />
                            <h3>تحليلات الذكاء الاصطناعي مقفلة</h3>
                            <p>تتطلب هذه الميزة باقة الأعمال (Enterprise). قم بترقية باقتك للوصول إلى توقعات الميزانية وتحليل المخاطر المتقدم.</p>
                            <button className="btn btn-primary" onClick={() => navigate('/settings')}>ترقية الباقة الآن</button>
                        </div>
                    </div>
                ) : insights.length > 0 && (
                    <div className="ai-section fade-up">
                        <div className="section-header">
                            <div className="section-title-wrap">
                                <div className="ai-badge">
                                    <IconRocket size={16} color="#8B5CF6" />
                                </div>
                                <div>
                                    <h3 className="section-title">تحليل ذكي للمحفظة (باقة الأعمال)</h3>
                                    <p className="section-sub">رؤى مُولّدة من بياناتك الفعلية مع خوارزمية المخاطر</p>
                                </div>
                            </div>
                            {aiData?.generatedAt && (
                                <span className="section-timestamp">
                                    آخر تحديث: {new Date(aiData.generatedAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>

                        {/* ── AI Predictions (Next Month Budget & High Risk Capacity) ── */}
                        {ai.aiPredictions && (
                            <div className="ai-predictions-grid">
                                <div className="ai-prediction-card">
                                    <h4>ميزانية الشهر القادم المتوقعة</h4>
                                    <div className="ai-pred-value">{ai.aiPredictions.nextMonthBudget.toLocaleString('ar-SA')} ر.س</div>
                                    <p>خوارزمية الذكاء الاصطناعي بناءً على متوسط التحصيل والنمو.</p>
                                </div>
                                <div className="ai-prediction-card">
                                    <h4>استيعاب القروض عالية المخاطر</h4>
                                    <div className="ai-pred-value" style={{ color: ai.aiPredictions.highRiskCapacityPercent > 0 ? '#10B981' : '#EF4444' }}>
                                        {ai.aiPredictions.highRiskCapacityPercent}%
                                    </div>
                                    <p>الحد الآمن الموصى به لإقراض عملاء جدد بمخاطر عالية حالياً.</p>
                                </div>
                            </div>
                        )}

                        <div className="insights-grid">
                            {insights.map((ins, i) => <InsightCard key={i} ins={ins} />)}
                        </div>

                        {/* Recommendations */}
                        {recommendations.length > 0 && (
                            <div className="recommendations-wrap">
                                <div className="rec-title">
                                    <IconClipboard size={14} color="#E8633A" /> توصيات مقترحة
                                </div>
                                <ul className="rec-list">
                                    {recommendations.map((r, i) => (
                                        <li key={i} className="rec-item">
                                            <span className="rec-num">{i + 1}</span>
                                            {r}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )
            }

            {/* ── Top Debtors ── */}
            {
                aiData?.overdueClients?.length > 0 && (
                    <div className="debtors-section fade-up">
                        <div className="section-header">
                            <div className="section-title-wrap">
                                <div className="section-icon-wrap">
                                    <IconAlertTriangle size={16} color="#EF4444" />
                                </div>
                                <div>
                                    <h3 className="section-title">العملاء المتأخرون</h3>
                                    <p className="section-sub">مرتّبون حسب قيمة الدين — يحتاجون متابعة فورية</p>
                                </div>
                            </div>
                            <button className="btn btn-sm btn-outline" onClick={() => navigate('/customers')}>
                                عرض الكل
                            </button>
                        </div>
                        <div className="debtors-list">
                            {aiData.overdueClients.slice(0, 8).map((c, i) => (
                                <div key={i} className={`debtor-row ${c.days_overdue > 90 ? 'debtor-high' : c.days_overdue > 60 ? 'debtor-med' : 'debtor-low'}`}>
                                    <div className="debtor-rank">{i + 1}</div>
                                    <div className="debtor-avatar">
                                        {(c.full_name || '؟')[0]}
                                    </div>
                                    <div className="debtor-info">
                                        <div className="debtor-name">{c.full_name}</div>
                                        <div className="debtor-days">متأخر {c.days_overdue} يوم</div>
                                    </div>
                                    <div className="debtor-amount">
                                        {parseFloat(c.debt).toLocaleString('ar-SA')} ر.س
                                    </div>
                                    <div className="debtor-actions">
                                        {c.mobile_number && (
                                            <a
                                                href={`https://wa.me/${c.mobile_number.replace(/\D/g, '').replace(/^0/, '966')}`}
                                                target="_blank" rel="noopener noreferrer"
                                                className="debtor-wa-btn"
                                                title="تواصل واتساب"
                                            >
                                                <IconWhatsapp size={16} />
                                            </a>
                                        )}
                                        <div className={`risk-pill ${c.days_overdue > 90 ? 'risk-pill-high' : c.days_overdue > 60 ? 'risk-pill-med' : 'risk-pill-low'}`}>
                                            {c.days_overdue > 90 ? 'عالي' : c.days_overdue > 60 ? 'متوسط' : 'متابعة'}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            }

            {/* ── Quick Actions ── */}
            <div className="quick-actions-section fade-up">
                <h3 className="section-title">إجراءات سريعة</h3>
                <div className="quick-actions-grid">
                    {[
                        { Icon: IconPlus, label: 'إضافة قرض جديد', sub: 'تسجيل عميل وقرض', path: '/add-loan', color: '#E8633A' },
                        { Icon: IconUsers, label: 'إدارة العملاء', sub: 'عرض وتعديل البيانات', path: '/customers', color: '#3B82F6' },
                        { Icon: IconUpload, label: 'رفع ملف Excel', sub: 'استيراد بيانات دفعي', path: '/excel-upload', color: '#22C55E' },
                        { Icon: IconAnalytics, label: 'التحليلات', sub: 'تقارير وإحصائيات', path: '/analytics', color: '#8B5CF6' },
                    ].map((a, i) => (
                        <button key={i} className="quick-action-card" onClick={() => navigate(a.path)}>
                            <div className="qa-icon" style={{ background: a.color + '15', color: a.color }}>
                                <a.Icon size={22} color={a.color} />
                            </div>
                            <div className="qa-text">
                                <div className="qa-label">{a.label}</div>
                                <div className="qa-sub">{a.sub}</div>
                            </div>
                            <IconAnalytics size={14} color="var(--text-muted)" style={{ transform: 'rotate(90deg)' }} />
                        </button>
                    ))}
                </div>
            </div>
        </Layout >
    );
}
