import React, { useState, useEffect } from 'react';
import {
    BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from 'recharts';
import { reportsAPI } from '../services/api';
import Layout from '../components/Layout';
import { IconDiamond } from '../components/Icons';
import './AnalyticsPage.css';

function AnalyticsPage() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState(null);
    const [period, setPeriod] = useState('year'); // year, month, week

    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');
    const plan = merchant.subscription_plan?.toLowerCase();
    const isPremium = plan === 'pro' || plan === 'enterprise';

    // بيانات وهمية للعرض في حالة عدم توفر البيانات
    const mockData = {
        monthlyPerformance: [
            { name: 'يناير', loans: 4000, collected: 2400, profit: 400 },
            { name: 'فبراير', loans: 3000, collected: 1398, profit: 300 },
            { name: 'مارس', loans: 2000, collected: 9800, profit: 200 },
            { name: 'أبريل', loans: 2780, collected: 3908, profit: 278 },
            { name: 'مايو', loans: 1890, collected: 4800, profit: 189 },
            { name: 'يونيو', loans: 2390, collected: 3800, profit: 239 },
            { name: 'يوليو', loans: 3490, collected: 4300, profit: 349 },
        ],
        statusDistribution: [
            { name: 'مدفوع', value: 400, color: '#4CAF50' },
            { name: 'جاري', value: 300, color: '#2196F3' },
            { name: 'متأخر', value: 100, color: '#F44336' },
            { name: 'متعثر', value: 50, color: '#FF9800' },
        ],
        overdueAnalysis: [
            { name: '1-30 يوم', value: 10 },
            { name: '31-60 يوم', value: 5 },
            { name: '61-90 يوم', value: 3 },
            { name: '+90 يوم', value: 2 },
        ],
        kpi: {
            totalLoans: 125000,
            totalCollected: 85000,
            totalProfit: 15000,
            collectionRate: 68
        }
    };

    useEffect(() => {
        fetchAnalytics();
    }, [period]);

    const monthNames = { '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل', '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس', '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر' };
    const statusColors = { Active: '#2196F3', Paid: '#4CAF50', Cancelled: '#9E9E9E', Overdue: '#F44336' };
    const statusLabels = { Active: 'نشط', Paid: 'مدفوع', Cancelled: 'ملغي', Overdue: 'متأخر' };

    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const response = await reportsAPI.getAnalytics();
            const raw = response.data || response;
            const debtTrend = (raw.debtTrend || []).map((r) => ({
                name: monthNames[r.month?.slice(5, 7)] || r.month,
                loans: parseFloat(r.total) || 0,
                collected: 0,
                profit: 0
            }));
            const statusDistribution = (raw.statusDistribution || []).map((r) => ({
                name: statusLabels[r.status] || r.status,
                value: parseInt(r.count, 10) || 0,
                color: statusColors[r.status] || '#666'
            }));
            const totalLoans = (raw.debtTrend || []).reduce((s, r) => s + (parseFloat(r.total) || 0), 0);
            const paidTotal = (raw.statusDistribution || []).find((r) => r.status === 'Paid');
            const paidSum = paidTotal ? parseFloat(paidTotal.total) || 0 : 0;
            const rate = totalLoans > 0 ? Math.round((paidSum / totalLoans) * 100) : 0;
            setData({
                monthlyPerformance: debtTrend,
                statusDistribution,
                overdueAnalysis: [],
                kpi: {
                    totalLoans: Math.round(totalLoans),
                    totalCollected: Math.round(paidSum),
                    totalProfit: Math.round(paidSum * 0.1),
                    collectionRate: rate
                }
            });
        } catch (error) {
            console.error('Error fetching analytics:', error);
            setData(mockData);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        // reportsAPI.exportReport({ period });
        alert('جاري تصدير التقرير...');
    };

    if (!isPremium) {
        return (
            <Layout>
                <div className="upgrade-locked-container fade-up">
                    <div className="upgrade-icon">
                        <IconDiamond size={64} color="var(--blue-600)" />
                    </div>
                    <h2>التحليلات التفصيلية متاحة في باقة برو</h2>
                    <p>احصل على رؤية كاملة لاتفاقياتك، نسب التحصيل، وتحليل الأرباح الذكي.</p>
                    <button className="btn btn-primary" onClick={() => window.location.href = '/pricing'}>
                        ترقية الباقة الآن
                    </button>
                </div>
            </Layout>
        );
    }

    if (loading) {
        return (
            <Layout>
                <div className="db-loading">
                    <div className="db-spinner" />
                    <p>جاري تحليل البيانات...</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="page-top fade-up">
                <div>
                    <h1 className="page-title"> التحليلات التفصيلية</h1>
                    <p className="page-sub">إحصائيات وتحليل أداء محفظة القروض</p>
                </div>
                <div className="page-actions">
                    <select className="form-input" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 'auto' }}>
                        <option value="year">سنوي</option>
                        <option value="month">شهري</option>
                        <option value="week">أسبوعي</option>
                    </select>
                </div>
            </div>

            <div className="analytics-grid">
                {/* KPI Cards */}
                <div className="kpi-section">
                    <div className="kpi-card glass-card">
                        <div className="kpi-icon icon-money" aria-hidden="true" />
                        <div className="kpi-info">
                            <h3>إجمالي القروض</h3>
                            <p>{(data.kpi?.totalLoans ?? 0).toLocaleString('ar-SA')} ر.س</p>
                        </div>
                    </div>
                    <div className="kpi-card glass-card">
                        <div className="kpi-icon icon-check" aria-hidden="true" />
                        <div className="kpi-info">
                            <h3>المبالغ المحصلة</h3>
                            <p>{(data.kpi?.totalCollected ?? 0).toLocaleString('ar-SA')} ر.س</p>
                        </div>
                    </div>
                    <div className="kpi-card glass-card">
                        <div className="kpi-icon icon-chart" aria-hidden="true" />
                        <div className="kpi-info">
                            <h3>صافي الأرباح</h3>
                            <p className="profit">+{(data.kpi?.totalProfit ?? 0).toLocaleString('ar-SA')} ر.س</p>
                        </div>
                    </div>
                    <div className="kpi-card glass-card">
                        <div className="kpi-icon icon-pie" aria-hidden="true" />
                        <div className="kpi-info">
                            <h3>نسبة التحصيل</h3>
                            <div className="progress-bar">
                                <div
                                    className="progress-fill"
                                    style={{ width: `${data.kpi?.collectionRate ?? 0}%` }}
                                ></div>
                            </div>
                            <p>{data.kpi?.collectionRate ?? 0}%</p>
                        </div>
                    </div>
                </div>

                {/* Main Charts */}
                <div className="charts-row charts-row-full">
                    <div className="chart-card glass-card large chart-card-full-width">
                        <h3>الأداء المالي (إجمالي القروض حسب الشهر)</h3>
                        <ResponsiveContainer width="100%" height={340}>
                            <AreaChart data={data.monthlyPerformance || []}>
                                <defs>
                                    <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#FF6B35" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#FF6B35" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorCollected" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1B3B6F" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#1B3B6F" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <XAxis dataKey="name" stroke="#fff" />
                                <YAxis stroke="#fff" />
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                        borderRadius: '10px',
                                        color: '#333'
                                    }}
                                />
                                <Legend />
                                <Area type="monotone" dataKey="loans" name="إجمالي القروض (ر.س)" stroke="#FF6B35" fillOpacity={1} fill="url(#colorLoans)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="charts-row">
                    <div className="chart-card glass-card medium">
                        <h3>توزيع حالات القروض</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={data.statusDistribution || []}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label
                                >
                                    {(data.statusDistribution || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card glass-card medium">
                        <h3>تحليل التأخير (بالأيام)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={data.overdueAnalysis?.length ? data.overdueAnalysis : [{ name: 'لا بيانات', value: 0 }]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                <XAxis dataKey="name" stroke="#fff" />
                                <YAxis stroke="#fff" />
                                <Tooltip cursor={{ fill: 'rgba(255,255,255,0.1)' }} />
                                <Bar dataKey="value" name="عدد العملاء" fill="#FF6B35" radius={[10, 10, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </Layout>
    );
}

export default AnalyticsPage;
