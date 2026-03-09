'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { reportsAPI, settingsAPI } from '@/lib/api';
import './analytics.css';

type ProfileResponse = {
  profile?: {
    subscription_plan?: string;
    subscription_status?: string;
    expiry_date?: string;
  };
};

type AnalyticsResponse = {
  debtTrend?: Array<{ month: string; total: string; loan_count: string }>;
  statusDistribution?: Array<{ status: string; count: string; total: string }>;
  overdueBreakdown?: Array<{ bucket: string; count: string; total: string }>;
  monthlyCollection?: Array<{ month: string; collected: string; count: string }>;
  profitSplit?: { regularProfit?: number; najizProfit?: number; totalProfit?: number };
  summary?: {
    regularCollected?: number;
    najizCollected?: number;
    totalCollected?: number;
    portfolioTotal?: number;
    collectionRate?: number;
  };
};

type KPI = {
  portfolioTotal: number;
  totalCollected: number;
  regularProfit: number;
  najizProfit: number;
  totalProfit: number;
  collectionRate: number;
};

const MONTH_NAMES: Record<string, string> = {
  '01': 'يناير',
  '02': 'فبراير',
  '03': 'مارس',
  '04': 'أبريل',
  '05': 'مايو',
  '06': 'يونيو',
  '07': 'يوليو',
  '08': 'أغسطس',
  '09': 'سبتمبر',
  '10': 'أكتوبر',
  '11': 'نوفمبر',
  '12': 'ديسمبر',
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  Active: { label: 'نشط', color: 'var(--coral)' },
  Paid: { label: 'مسدد', color: 'var(--success)' },
  Cancelled: { label: 'ملغي', color: 'var(--text-muted)' },
  Overdue: { label: 'متأخر', color: 'var(--danger)' },
  Raised: { label: 'مرفوع', color: 'var(--warning)' },
};

const formatNumber = (value: number) => value.toLocaleString('en-US');
const formatCurrency = (value: number) => `${formatNumber(value)} ﷼`;
const formatBucketLabel = (bucket: string, range: string) => {
  if (!bucket) return '—';
  if (range === 'week') return bucket;
  if (range === 'month') return `أسبوع ${bucket.split('-').pop() || bucket}`;
  const monthPart = bucket.slice(5, 7);
  return MONTH_NAMES[monthPart] || bucket;
};
const planLabel: Record<string, string> = {
  free: 'مجاني',
  basic: 'أساسي',
  pro: 'احترافي',
  enterprise: 'أعمال',
};
const statusLabel: Record<string, string> = {
  active: 'فعال',
  trialing: 'تجريبي',
  past_due: 'متعثر',
  canceled: 'ملغي',
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('year');
  const [subscriptionPlan, setSubscriptionPlan] = useState('Free');
  const [subscriptionStatus, setSubscriptionStatus] = useState('Active');
  const [debtTrend, setDebtTrend] = useState<Array<{ name: string; loans: number; collected: number }>>([]);
  const [statusDistribution, setStatusDistribution] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [overdueAnalysis, setOverdueAnalysis] = useState<Array<{ name: string; value: number }>>([]);
  const [kpi, setKpi] = useState<KPI>({
    portfolioTotal: 0,
    totalCollected: 0,
    regularProfit: 0,
    najizProfit: 0,
    totalProfit: 0,
    collectionRate: 0,
  });

  const isFreePlan = useMemo(() => subscriptionPlan.toLowerCase() === 'free', [subscriptionPlan]);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const profileRes = await settingsAPI.getProfile();
        const profile = (profileRes.data as ProfileResponse)?.profile;
        setSubscriptionPlan(profile?.subscription_plan || 'Free');
        setSubscriptionStatus(profile?.subscription_status || 'Active');
      } catch {
        setSubscriptionPlan('Free');
        setSubscriptionStatus('Active');
      }
    };

    fetchProfile();
  }, []);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setLoading(true);
      try {
        const response = await reportsAPI.getAnalytics({ interval: period });
        const raw: AnalyticsResponse = response.data || response;

        const trend = (raw.debtTrend || []).map((row) => {
          return {
            name: formatBucketLabel(row.month, period),
            loans: Number.parseFloat(row.total) || 0,
            collected: 0,
          };
        });

        const monthlyCollectedMap = new Map<string, number>();
        (raw.monthlyCollection || []).forEach((row) => {
          const key = formatBucketLabel(row.month, period);
          monthlyCollectedMap.set(key, Number.parseFloat(row.collected) || 0);
        });

        const enrichedTrend = trend.map((row) => ({
          ...row,
          collected: monthlyCollectedMap.get(row.name) || 0,
        }));

        const statuses = (raw.statusDistribution || []).map((row) => ({
          name: STATUS_META[row.status]?.label || row.status,
          value: Number.parseInt(row.count, 10) || 0,
          color: STATUS_META[row.status]?.color || 'var(--text-muted)',
        }));

        const overdue = (raw.overdueBreakdown || []).map((row) => ({
          name: row.bucket,
          value: Number.parseInt(row.count, 10) || 0,
        }));

        const totalLoansAmount = enrichedTrend.reduce((sum, row) => sum + row.loans, 0);
        const totalCollectedAmount = Number(raw.summary?.totalCollected ?? 0);
        const portfolioTotalAmount = Number(raw.summary?.portfolioTotal ?? totalLoansAmount);
        const regularProfit = Number(raw.profitSplit?.regularProfit || 0);
        const najizProfit = Number(raw.profitSplit?.najizProfit || 0);
        const totalProfit = Number(raw.profitSplit?.totalProfit ?? regularProfit + najizProfit);
        const rate = Number(raw.summary?.collectionRate ?? (portfolioTotalAmount > 0 ? (totalCollectedAmount / portfolioTotalAmount) * 100 : 0));

        setDebtTrend(enrichedTrend);
        setStatusDistribution(statuses);
        setOverdueAnalysis(overdue);
        setKpi({
          portfolioTotal: Math.round(portfolioTotalAmount),
          totalCollected: Math.round(totalCollectedAmount),
          regularProfit: Math.round(regularProfit),
          najizProfit: Math.round(najizProfit),
          totalProfit: Math.round(totalProfit),
          collectionRate: Math.round(rate),
        });
      } catch {
        setDebtTrend([]);
        setStatusDistribution([]);
        setOverdueAnalysis([]);
        setKpi({
          portfolioTotal: 0,
          totalCollected: 0,
          regularProfit: 0,
          najizProfit: 0,
          totalProfit: 0,
          collectionRate: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [period]);

  if (loading) {
    return (
      <div className="db-loading">
        <div className="db-spinner" />
        <p>جاري تحميل التحليلات...</p>
      </div>
    );
  }

  return (
    <div className="analytics-page-container">
      <div className="page-top fade-up">
        <div>
          <h1 className="page-title">التحليلات المتقدمة</h1>
          <p className="page-sub">مؤشرات مباشرة مبنية على بيانات محفظتك الفعلية</p>
          <p className="subscription-chip">
            الباقة: <strong>{planLabel[subscriptionPlan.toLowerCase()] || subscriptionPlan}</strong>
            {' · '}
            الحالة: <strong>{statusLabel[subscriptionStatus.toLowerCase()] || subscriptionStatus}</strong>
          </p>
        </div>
        <div className="page-actions">
          <select className="form-input" value={period} onChange={(e) => setPeriod(e.target.value)} style={{ width: 'auto' }}>
            <option value="year">سنوي</option>
            <option value="6months">آخر 6 أشهر</option>
            <option value="month">شهري</option>
            <option value="week">أسبوعي</option>
          </select>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="kpi-section">
          <div className="kpi-card glass-card">
            <div className="kpi-info">
              <h3>إجمالي المحفظة</h3>
              <p>{formatCurrency(kpi.portfolioTotal)}</p>
            </div>
          </div>
          <div className="kpi-card glass-card">
            <div className="kpi-info">
              <h3>إجمالي التحصيل</h3>
              <p>{formatCurrency(kpi.totalCollected)}</p>
            </div>
          </div>
          <div className="kpi-card glass-card">
            <div className="kpi-info">
              <h3>الربح التقديري</h3>
              <p className="profit">+{formatCurrency(kpi.totalProfit)}</p>
            </div>
          </div>
          <div className="kpi-card glass-card">
            <div className="kpi-info">
              <h3>ربح القروض العادية</h3>
              <p className="profit">+{formatCurrency(kpi.regularProfit)}</p>
            </div>
          </div>
          <div className="kpi-card glass-card">
            <div className="kpi-info">
              <h3>ربح القضايا (ناجز)</h3>
              <p className="profit">+{formatCurrency(kpi.najizProfit)}</p>
            </div>
          </div>
          <div className="kpi-card glass-card">
            <div className="kpi-info">
              <h3>نسبة التحصيل</h3>
              <div className="progress-bar"><div className="progress-fill" style={{ width: `${kpi.collectionRate}%` }} /></div>
              <p>{kpi.collectionRate}%</p>
            </div>
          </div>
        </div>

        <div className="charts-row charts-row-full">
          <div className="chart-card glass-card large">
            <h3>اتجاه المحفظة (القروض مقابل التحصيل)</h3>
            <ResponsiveContainer width="100%" height={340}>
              <AreaChart data={debtTrend}>
                <defs>
                  <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--coral)" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="var(--coral)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--success)" stopOpacity={0.7} />
                    <stop offset="95%" stopColor="var(--success)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <Tooltip formatter={(value: number | string | undefined) => [formatCurrency(Number(value || 0)), 'القيمة']} />
                <Legend />
                <Area type="monotone" dataKey="loans" name="القروض" stroke="var(--coral)" fillOpacity={1} fill="url(#colorLoans)" />
                <Area type="monotone" dataKey="collected" name="المحصل" stroke="var(--success)" fillOpacity={1} fill="url(#colorCollected)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-card glass-card">
            <h3>توزيع حالات القروض</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" label>
                  {statusDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | string | undefined) => [formatNumber(Number(value || 0)), 'العدد']} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card glass-card">
            <h3>مقارنة الربح: قضايا ناجز مقابل القروض العادية</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={[
                  { name: 'قروض عادية', profit: kpi.regularProfit },
                  { name: 'قضايا ناجز', profit: kpi.najizProfit },
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} />
                <Tooltip formatter={(value: number | string | undefined) => [formatCurrency(Number(value || 0)), 'الربح']} />
                <Bar dataKey="profit" name="الربح" fill="var(--success)" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card glass-card">
            <h3>تحليل التعثر</h3>
            {isFreePlan ? (
              <div className="locked-box">
                <p>قم بالترقية إلى الباقة الاحترافية لفتح تحليل التعثر.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={overdueAnalysis.length ? overdueAnalysis : [{ name: 'لا توجد بيانات', value: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                  <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} />
                  <Tooltip cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                  <Bar dataKey="value" name="العملاء" fill="var(--coral)" radius={[10, 10, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
