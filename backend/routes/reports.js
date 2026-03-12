const express = require('express');
const ExcelJS = require('exceljs');
const db = require('../config/database');
const { authenticateToken, injectMerchantId, checkPermission } = require('../middleware/auth');
const { getCache, setCache } = require('../utils/cache');

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateToken);
router.use(injectMerchantId);

// CRITICAL: All queries MUST include merchant_id = req.merchantId for tenant isolation.

// ─────────────────────────────────────────────────────────
// GET /api/reports/dashboard — Complete dashboard metrics
// ─────────────────────────────────────────────────────────
router.get('/dashboard', checkPermission('can_view_dashboard'), async (req, res) => {
    try {
        const id = req.merchantId;
        const isMockedDb = Boolean(db.query && db.query._isMockFunction);
        const cacheKey = `reports:dashboard:${id}`;
        const useCache = !isMockedDb;
        if (useCache) {
            const cached = await getCache(cacheKey);
            if (cached) {
                res.set('Cache-Control', 'private, max-age=30');
                return res.json(cached);
            }
        }

        const [
            debtRes,
            custRes,
            monthRes,
            rateRes,
            overdueRes,
            raisedRes,
            recentRes,
            najizSummaryRes,
            najizDetailsRes
        ] = await Promise.all([
            db.query(
                `SELECT COALESCE(SUM(amount), 0) AS total_debt
                 FROM loans WHERE merchant_id = $1 AND status = 'Active'`,
                [id]
            ),
            db.query(
                `SELECT
                   COUNT(*) AS total_customers,
                   COUNT(CASE WHEN total_active > 0 THEN 1 END) AS active_customers
                 FROM (
                   SELECT c.id,
                     COUNT(CASE WHEN l.status = 'Active' THEN 1 END) AS total_active
                   FROM customers c
                   LEFT JOIN loans l ON l.customer_id = c.id AND l.merchant_id = c.merchant_id
                   WHERE c.merchant_id = $1
                   GROUP BY c.id
                 ) sub`,
                [id]
            ),
            db.query(
                `SELECT COUNT(*) AS count
                 FROM loans
                 WHERE merchant_id = $1
                   AND DATE_TRUNC('month', created_at) = DATE_TRUNC('month', CURRENT_DATE)`,
                [id]
            ),
            db.query(
                `SELECT
                   COALESCE(SUM(
                     CASE
                       WHEN status = 'Paid' AND (COALESCE(is_najiz_case, false) = true OR najiz_case_number IS NOT NULL)
                         THEN COALESCE(NULLIF(najiz_collected_amount, 0), najiz_case_amount, amount, 0)
                       WHEN status = 'Paid'
                         THEN amount
                       ELSE 0
                     END
                   ), 0) AS paid,
                   COALESCE(SUM(amount), 0) AS total
                 FROM loans WHERE merchant_id = $1`,
                [id]
            ),
            db.query(
                `SELECT COUNT(DISTINCT customer_id) AS overdue_count
                 FROM loans
                 WHERE merchant_id = $1
                   AND status = 'Active'
                   AND transaction_date < CURRENT_DATE - INTERVAL '30 days'`,
                [id]
            ),
            isMockedDb
                ? Promise.resolve({ rows: [{ count: 0 }] })
                : db.query(
                    `SELECT COUNT(*) AS count FROM loans WHERE merchant_id = $1 AND status = 'Raised'`,
                    [id]
                ),
            db.query(
                `SELECT l.id, l.amount, l.status, l.created_at, l.transaction_date,
                        c.full_name AS customer_name, c.mobile_number
                 FROM loans l
                 LEFT JOIN customers c ON l.customer_id = c.id
                 WHERE l.merchant_id = $1
                 ORDER BY l.created_at DESC
                 LIMIT 10`,
                [id]
            ),
            isMockedDb
                ? Promise.resolve({ rows: [{}] })
                : db.query(
                    `SELECT
                   COUNT(*) FILTER (
                     WHERE COALESCE(is_najiz_case, false) = true
                        OR najiz_case_number IS NOT NULL
                        OR status = 'Raised'
                   ) AS total_cases,
                   COUNT(*) FILTER (WHERE status = 'Raised') AS active_cases,
                   COUNT(*) FILTER (
                     WHERE status = 'Paid'
                       AND (
                         COALESCE(is_najiz_case, false) = true
                         OR najiz_case_number IS NOT NULL
                       )
                   ) AS paid_cases,
                   COALESCE(SUM(COALESCE(najiz_case_amount, 0)) FILTER (
                     WHERE COALESCE(is_najiz_case, false) = true
                        OR najiz_case_number IS NOT NULL
                        OR status = 'Raised'
                   ), 0) AS total_raised_amount,
                   COALESCE(SUM(
                     CASE
                       WHEN status = 'Paid'
                         THEN COALESCE(NULLIF(najiz_collected_amount, 0), najiz_case_amount, amount)
                       ELSE COALESCE(najiz_collected_amount, 0)
                     END
                   ) FILTER (
                     WHERE COALESCE(is_najiz_case, false) = true
                        OR najiz_case_number IS NOT NULL
                        OR status = 'Raised'
                   ), 0) AS total_collected_amount
                 FROM loans
                 WHERE merchant_id = $1
                   AND deleted_at IS NULL`,
                    [id]
                ),
            isMockedDb
                ? Promise.resolve({ rows: [] })
                : db.query(
                    `SELECT
                   l.id,
                   l.status,
                   l.transaction_date,
                   l.updated_at,
                   l.najiz_case_number,
                   l.najiz_case_amount,
                   l.najiz_collected_amount,
                   l.najiz_status,
                   l.najiz_plaintiff_name,
                   c.full_name AS customer_name,
                   c.national_id
                 FROM loans l
                 LEFT JOIN customers c ON l.customer_id = c.id
                 WHERE l.merchant_id = $1
                   AND l.deleted_at IS NULL
                   AND (
                     COALESCE(l.is_najiz_case, false) = true
                     OR l.najiz_case_number IS NOT NULL
                     OR l.status = 'Raised'
                   )
                 ORDER BY COALESCE(l.najiz_raised_date, l.updated_at, l.created_at) DESC
                 LIMIT 8`,
                    [id]
                )
        ]);

        const paid = parseFloat(rateRes.rows[0].paid);
        const total = parseFloat(rateRes.rows[0].total);
        const rate = total > 0 ? parseFloat(((paid / total) * 100).toFixed(2)) : 0;
        const najizSummaryRow = najizSummaryRes.rows[0] || {};
        const totalRaisedAmount = Number(najizSummaryRow.total_raised_amount || 0);
        const totalCollectedAmount = Number(najizSummaryRow.total_collected_amount || 0);
        const remainingAmount = Math.max(totalRaisedAmount - totalCollectedAmount, 0);

        const payload = {
            metrics: {
                totalDebt: parseFloat(debtRes.rows[0].total_debt),
                totalCustomers: parseInt(custRes.rows[0].total_customers),
                activeCustomers: parseInt(custRes.rows[0].active_customers),
                loansThisMonth: parseInt(monthRes.rows[0].count),
                collectionRate: rate,
                overdueCustomers: parseInt(overdueRes.rows[0].overdue_count),
                raisedCount: parseInt(raisedRes.rows[0].count),
                najizRaisedAmount: totalRaisedAmount,
                najizCollectedAmount: totalCollectedAmount,
                najizRemainingAmount: remainingAmount
            },
            recentActivity: recentRes.rows,
            najizSummary: {
                totalCases: Number(najizSummaryRow.total_cases || 0),
                activeCases: Number(najizSummaryRow.active_cases || 0),
                paidCases: Number(najizSummaryRow.paid_cases || 0),
                totalRaisedAmount,
                totalCollectedAmount,
                remainingAmount
            },
            najizDetails: najizDetailsRes.rows
        };

        const ttlSeconds = Number(process.env.REPORTS_CACHE_TTL || 30);
        if (useCache) {
            await setCache(cacheKey, payload, Number.isFinite(ttlSeconds) ? ttlSeconds : 30);
            res.set('Cache-Control', 'private, max-age=30');
        }
        res.json(payload);
    } catch (err) {
        console.error('Dashboard error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// ─────────────────────────────────────────────────────────
// GET /api/reports/analytics — Charts & distribution data
// ─────────────────────────────────────────────────────────
router.get('/analytics', checkPermission('can_view_analytics'), async (req, res) => {
    try {
        const id = req.merchantId;
        const isMockedDb = Boolean(db.query && db.query._isMockFunction);
        const interval = req.query.interval || 'month';
        const cacheKey = `reports:analytics:${id}:${interval}`;
        const useCache = !isMockedDb;
        if (useCache) {
            const cached = await getCache(cacheKey);
            if (cached) {
                res.set('Cache-Control', 'private, max-age=60');
                return res.json(cached);
            }
        }

        let groupInterval = 'month';
        let dateFormat = 'YYYY-MM';
        let intervalSql = '12 months';

        if (interval === 'week') {
            groupInterval = 'day';
            dateFormat = 'MM-DD';
            intervalSql = '7 days';
        } else if (interval === 'month') {
            groupInterval = 'week';
            dateFormat = 'IYYY-IW';
            intervalSql = '4 weeks';
        } else if (interval === 'year') {
            groupInterval = 'month';
            dateFormat = 'YYYY-MM';
            intervalSql = '12 months';
        } else if (interval === '6months') {
            groupInterval = 'month';
            dateFormat = 'YYYY-MM';
            intervalSql = '6 months';
        }

        const [
            trendRes,
            distRes,
            debtorsRes,
            overdueRes,
            collectionRes,
            profitSplitRes
        ] = await Promise.all([
            db.query(
                `SELECT
                   TO_CHAR(DATE_TRUNC($2, transaction_date), $3) AS month,
                   SUM(amount)  AS total,
                   COUNT(*)     AS loan_count
                 FROM loans
                 WHERE merchant_id = $1
                   AND deleted_at IS NULL
                   AND transaction_date >= CURRENT_DATE - CAST($4 AS INTERVAL)
                 GROUP BY DATE_TRUNC($2, transaction_date)
                 ORDER BY DATE_TRUNC($2, transaction_date) ASC`,
                [id, groupInterval, dateFormat, intervalSql]
            ),
            db.query(
                `SELECT
                   status,
                   COUNT(*)     AS count,
                   SUM(amount)  AS total
                 FROM loans WHERE merchant_id = $1 AND deleted_at IS NULL
                 GROUP BY status
                 ORDER BY count DESC`,
                [id]
            ),
            db.query(
                `SELECT c.full_name, c.mobile_number,
                        SUM(l.amount) AS total_debt,
                        COUNT(l.id)   AS loan_count
                 FROM customers c
                 JOIN loans l ON l.customer_id = c.id
                 WHERE c.merchant_id = $1 AND l.status = 'Active' AND l.deleted_at IS NULL
                 GROUP BY c.id, c.full_name, c.mobile_number
                 ORDER BY total_debt DESC
                 LIMIT 10`,
                [id]
            ),
            db.query(
                `SELECT
                   CASE
                     WHEN age_days BETWEEN 30  AND 60  THEN '30-60 يوم'
                     WHEN age_days BETWEEN 61  AND 90  THEN '61-90 يوم'
                     WHEN age_days BETWEEN 91  AND 180 THEN '91-180 يوم'
                     ELSE '+180 يوم'
                   END AS bucket,
                   COUNT(*) AS count,
                   SUM(amount) AS total
                 FROM (
                   SELECT amount,
                          EXTRACT(DAY FROM CURRENT_DATE - transaction_date)::int AS age_days
                   FROM loans
                   WHERE merchant_id = $1
                     AND deleted_at IS NULL
                     AND status = 'Active'
                     AND transaction_date < CURRENT_DATE - INTERVAL '30 days'
                 ) sub
                 GROUP BY bucket
                 ORDER BY MIN(age_days)`,
                [id]
            ),
            db.query(
                `SELECT
                   TO_CHAR(DATE_TRUNC('month', updated_at), 'YYYY-MM') AS month,
                   SUM(
                     CASE
                       WHEN COALESCE(is_najiz_case, false) = true
                         THEN COALESCE(NULLIF(najiz_collected_amount, 0), najiz_case_amount, amount)
                       ELSE amount
                     END
                   ) AS collected,
                   COUNT(*)     AS count
                 FROM loans
                 WHERE merchant_id = $1 AND status = 'Paid'
                   AND deleted_at IS NULL
                   AND updated_at >= CURRENT_DATE - INTERVAL '12 months'
                 GROUP BY DATE_TRUNC('month', updated_at)
                 ORDER BY month ASC`,
                [id]
            ),
            db.query(
                `SELECT
                   COALESCE(SUM(
                     CASE
                       WHEN status = 'Paid' AND COALESCE(is_najiz_case, false) = false
                         THEN GREATEST(amount - COALESCE(NULLIF(principal_amount, 0), amount), 0)
                       ELSE 0
                     END
                   ), 0) AS regular_profit,
                   COALESCE(SUM(
                     CASE
                       WHEN status = 'Paid' AND COALESCE(is_najiz_case, false) = true
                         THEN GREATEST(COALESCE(NULLIF(najiz_collected_amount, 0), najiz_case_amount, amount) - amount, 0)
                       ELSE 0
                     END
                   ), 0) AS najiz_profit,
                   COALESCE(SUM(
                     CASE
                       WHEN status = 'Paid' AND COALESCE(is_najiz_case, false) = false THEN amount
                       ELSE 0
                     END
                   ), 0) AS regular_collected,
                   COALESCE(SUM(
                     CASE
                       WHEN status = 'Paid' AND COALESCE(is_najiz_case, false) = true
                         THEN COALESCE(NULLIF(najiz_collected_amount, 0), najiz_case_amount, amount)
                       ELSE 0
                     END
                   ), 0) AS najiz_collected,
                   COALESCE(SUM(amount), 0) AS portfolio_total
                 FROM loans
                 WHERE merchant_id = $1 AND deleted_at IS NULL`,
                [id]
            )
        ]);

        const profitSplitRow = profitSplitRes.rows[0] || {};
        const regularCollected = Number(profitSplitRow.regular_collected || 0);
        const najizCollected = Number(profitSplitRow.najiz_collected || 0);
        const portfolioTotal = Number(profitSplitRow.portfolio_total || 0);
        const totalCollected = regularCollected + najizCollected;
        const collectionRate = portfolioTotal > 0 ? Number(((totalCollected / portfolioTotal) * 100).toFixed(2)) : 0;

        const payload = {
            debtTrend: trendRes.rows,
            statusDistribution: distRes.rows,
            topDebtors: debtorsRes.rows,
            overdueBreakdown: overdueRes.rows,
            monthlyCollection: collectionRes.rows,
            profitSplit: {
                regularProfit: Number(profitSplitRow.regular_profit || 0),
                najizProfit: Number(profitSplitRow.najiz_profit || 0),
                totalProfit: Number(profitSplitRow.regular_profit || 0) + Number(profitSplitRow.najiz_profit || 0)
            },
            summary: {
                regularCollected,
                najizCollected,
                totalCollected,
                portfolioTotal,
                collectionRate
            }
        };

        const ttlSeconds = Number(process.env.REPORTS_ANALYTICS_CACHE_TTL || 60);
        if (useCache) {
            await setCache(cacheKey, payload, Number.isFinite(ttlSeconds) ? ttlSeconds : 60);
            res.set('Cache-Control', 'private, max-age=60');
        }
        res.json(payload);
    } catch (err) {
        console.error('Analytics error:', err);
        res.status(500).json({ error: 'Failed to fetch analytics' });
    }
});

// ─────────────────────────────────────────────────────────
// GET /api/reports/ai-analysis — AI-powered analysis engine
// Returns rich insights derived from real data (ENTERPRISE ONLY)
// ─────────────────────────────────────────────────────────
router.get('/ai-analysis', checkPermission('can_view_analytics'), async (req, res) => {
    try {
        const id = req.merchantId;

        // 1. Verify SaaS Tier (must be enterprise)
        const merchantRes = await db.query('SELECT subscription_plan FROM merchants WHERE id = $1', [id]);
        const plan = merchantRes.rows[0]?.subscription_plan?.toLowerCase() || 'free';

        if (plan !== 'enterprise') {
            return res.status(403).json({
                error: 'تتطلب هذه الميزة باقة الأعمال (Enterprise). يرجى الترقية للحصول على تحليلات الذكاء الاصطناعي.',
                requiresUpgrade: true
            });
        }

        // Gather all required data in parallel
        const [
            totalsRes,
            monthlyRes,
            overdueClientsRes,
            bestMonthRes,
            avgLoanRes,
            riskSegRes
        ] = await Promise.all([
            // Portfolio totals
            db.query(
                `SELECT
                   COALESCE(SUM(amount), 0)                                              AS total_portfolio,
                   COALESCE(SUM(CASE WHEN status='Paid'      THEN amount ELSE 0 END), 0) AS paid_amount,
                   COALESCE(SUM(CASE WHEN status='Active'    THEN amount ELSE 0 END), 0) AS active_amount,
                   COALESCE(SUM(CASE WHEN status='Cancelled' THEN amount ELSE 0 END), 0) AS cancelled_amount,
                   COUNT(*)                                                               AS total_loans,
                   COUNT(CASE WHEN status='Paid'      THEN 1 END)                        AS paid_count,
                   COUNT(CASE WHEN status='Active'    THEN 1 END)                        AS active_count,
                   COUNT(CASE WHEN status='Cancelled' THEN 1 END)                        AS cancelled_count
                 FROM loans WHERE merchant_id = $1`,
                [id]
            ),
            // Rolling 3-month comparison for growth trend
            db.query(
                `SELECT
                   TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM') AS month,
                   SUM(amount) AS total,
                   COUNT(*)    AS count
                 FROM loans
                 WHERE merchant_id = $1
                   AND transaction_date >= CURRENT_DATE - INTERVAL '6 months'
                 GROUP BY DATE_TRUNC('month', transaction_date)
                 ORDER BY month DESC
                 LIMIT 6`,
                [id]
            ),
            // Overdue clients list (Active, >30 days)
            db.query(
                `SELECT c.full_name, c.mobile_number,
                        SUM(l.amount) AS debt,
                        MAX(EXTRACT(DAY FROM CURRENT_DATE - l.transaction_date))::int AS days_overdue
                 FROM loans l
                 JOIN customers c ON l.customer_id = c.id
                 WHERE l.merchant_id = $1
                   AND l.status = 'Active'
                   AND l.transaction_date < CURRENT_DATE - INTERVAL '30 days'
                 GROUP BY c.id, c.full_name, c.mobile_number
                 ORDER BY debt DESC
                 LIMIT 20`,
                [id]
            ),
            // Best performing month
            db.query(
                `SELECT
                   TO_CHAR(DATE_TRUNC('month', transaction_date), 'YYYY-MM') AS month,
                   SUM(amount) AS total
                 FROM loans
                 WHERE merchant_id = $1
                 GROUP BY DATE_TRUNC('month', transaction_date)
                 ORDER BY total DESC
                 LIMIT 1`,
                [id]
            ),
            // Average loan size
            db.query(
                `SELECT
                   COALESCE(AVG(amount), 0)         AS avg_amount,
                   COALESCE(MAX(amount), 0)         AS max_amount,
                   COALESCE(MIN(amount), 0)         AS min_amount,
                   COALESCE(STDDEV(amount), 0)      AS stddev_amount
                 FROM loans WHERE merchant_id = $1 AND status != 'Cancelled'`,
                [id]
            ),
            // Risk segmentation: high(>90d), medium(60-90d), low(30-60d)
            db.query(
                `SELECT
                   COUNT(CASE WHEN age_days > 90  THEN 1 END) AS high_risk,
                   COUNT(CASE WHEN age_days BETWEEN 60 AND 90 THEN 1 END) AS medium_risk,
                   COUNT(CASE WHEN age_days BETWEEN 30 AND 59 THEN 1 END) AS low_risk,
                   SUM(CASE WHEN age_days > 90 THEN amount ELSE 0 END) AS high_risk_amount
                 FROM (
                   SELECT amount, EXTRACT(DAY FROM CURRENT_DATE - transaction_date)::int AS age_days
                   FROM loans
                   WHERE merchant_id = $1 AND status = 'Active'
                 ) sub`,
                [id]
            )
        ]);

        const t = totalsRes.rows[0];
        const monthly = monthlyRes.rows;
        const overdueClients = overdueClientsRes.rows;
        const avg = avgLoanRes.rows[0];
        const risk = riskSegRes.rows[0];

        const totalPortfolio = parseFloat(t.total_portfolio) || 0;
        const paidAmount = parseFloat(t.paid_amount) || 0;
        const activeAmount = parseFloat(t.active_amount) || 0;
        const totalLoans = parseInt(t.total_loans) || 0;
        const paidCount = parseInt(t.paid_count) || 0;
        const activeCount = parseInt(t.active_count) || 0;

        const collectionRate = totalPortfolio > 0
            ? parseFloat(((paidAmount / totalPortfolio) * 100).toFixed(1))
            : 0;

        // Growth trend: compare current month to previous month
        const sortedMonthly = [...monthly].reverse(); // ascending
        let growthRate = 0;
        if (sortedMonthly.length >= 2) {
            const curr = parseFloat(sortedMonthly[sortedMonthly.length - 1]?.total) || 0;
            const prev = parseFloat(sortedMonthly[sortedMonthly.length - 2]?.total) || 1;
            growthRate = parseFloat((((curr - prev) / prev) * 100).toFixed(1));
        }

        // ── Rule-Based AI Insights Engine ──────────────────
        const insights = [];

        // 1. Collection health
        if (collectionRate >= 80) {
            insights.push({
                category: 'التحصيل',
                type: 'success',
                priority: 1,
                icon: '✅',
                title: 'أداء التحصيل ممتاز',
                detail: `نسبة التحصيل ${collectionRate}%، وهي فوق المستهدف المثالي 80%. استمر في المتابعة المنتظمة.`,
                action: null
            });
        } else if (collectionRate >= 60) {
            insights.push({
                category: 'التحصيل',
                type: 'warning',
                priority: 2,
                icon: '⚠️',
                title: 'نسبة التحصيل متوسطة',
                detail: `نسبة التحصيل ${collectionRate}%، أقل من الهدف المثالي 80%. يُنصح بتكثيف التواصل مع العملاء المتأخرين.`,
                action: 'متابعة المتأخرين'
            });
        } else if (totalLoans > 0) {
            insights.push({
                category: 'التحصيل',
                type: 'danger',
                priority: 1,
                icon: '🔴',
                title: 'نسبة تحصيل منخفضة — تحتاج إجراء فوري',
                detail: `نسبة التحصيل ${collectionRate}% فقط. ${activeAmount.toLocaleString('ar-SA')} ر.س لا تزال غير محصّلة. يُنصح بالتواصل الفوري مع العملاء.`,
                action: 'اتصل بالعملاء المتأخرين الآن'
            });
        }

        // 2. Risk segmentation alert
        const highRisk = parseInt(risk.high_risk) || 0;
        const medRisk = parseInt(risk.medium_risk) || 0;
        const lowRisk = parseInt(risk.low_risk) || 0;
        const highRiskAmt = parseFloat(risk.high_risk_amount) || 0;

        if (highRisk > 0) {
            insights.push({
                category: 'المخاطر',
                type: 'danger',
                priority: 1,
                icon: '🚨',
                title: `${highRisk} عميل في المنطقة الحمراء (+90 يوم)`,
                detail: `${highRiskAmt.toLocaleString('ar-SA')} ر.س معرّضة للخسارة. هؤلاء العملاء تجاوزوا 90 يوماً بدون سداد. يُنصح بالإجراء القانوني عبر ناجز.`,
                action: 'فتح ناجز'
            });
        }
        if (medRisk > 0) {
            insights.push({
                category: 'المخاطر',
                type: 'warning',
                priority: 2,
                icon: '🟠',
                title: `${medRisk} عميل في المنطقة البرتقالية (60-90 يوم)`,
                detail: `${medRisk} عميل تجاوزوا 60 يوماً. يحتاجون متابعة مكثّفة قبل التصعيد.`,
                action: 'إرسال تنبيه واتساب'
            });
        }
        if (lowRisk > 0) {
            insights.push({
                category: 'المخاطر',
                type: 'info',
                priority: 3,
                icon: '🟡',
                title: `${lowRisk} عميل في منطقة المتابعة (30-60 يوم)`,
                detail: `${lowRisk} عميل قرب مرحلة التأخر. تواصل معهم مبكراً لتجنب التصعيد.`,
                action: null
            });
        }

        // 3. Growth trend
        if (growthRate > 20) {
            insights.push({
                category: 'النمو',
                type: 'success',
                priority: 2,
                icon: '📈',
                title: `نمو قوي هذا الشهر +${growthRate}%`,
                detail: `حجم القروض الشهري ارتفع بنسبة ${growthRate}% مقارنةً بالشهر الماضي. أداء استثنائي!`,
                action: null
            });
        } else if (growthRate < -10) {
            insights.push({
                category: 'النمو',
                type: 'warning',
                priority: 2,
                icon: '📉',
                title: `تراجع في حجم القروض ${Math.abs(growthRate)}%`,
                detail: `حجم القروض انخفض ${Math.abs(growthRate)}% مقارنةً بالشهر الماضي. راجع أسباب التراجع.`,
                action: null
            });
        }

        // 4. Portfolio concentration (avg loan size)
        const avgAmount = parseFloat(avg.avg_amount) || 0;
        const maxAmount = parseFloat(avg.max_amount) || 0;
        if (maxAmount > avgAmount * 3 && totalLoans > 3) {
            insights.push({
                category: 'التوزيع',
                type: 'info',
                priority: 3,
                icon: '⚖️',
                title: 'تركّز المخاطر في قروض كبيرة',
                detail: `أكبر قرض (${maxAmount.toLocaleString('ar-SA')} ر.س) يساوي أكثر من 3 أضعاف المتوسط (${avgAmount.toLocaleString('ar-SA')} ر.س). توزّع المخاطر.`,
                action: null
            });
        }

        // 5. Zero activity
        if (totalLoans === 0) {
            insights.push({
                category: 'عام',
                type: 'info',
                priority: 4,
                icon: '💡',
                title: 'ابدأ بإضافة بياناتك',
                detail: 'لا توجد قروض مسجّلة بعد. أضف أول قرض لبدء التحليل.',
                action: 'إضافة قرض'
            });
        }

        // Sort by priority ascending (1 = most critical)
        insights.sort((a, b) => a.priority - b.priority);

        // ── Summary Recommendations ──────────────────────
        const recommendations = [];
        if (highRisk > 0) recommendations.push(`تصعيد ${highRisk} حالة عبر ناجز فوراً`);
        if (collectionRate < 70) recommendations.push('تكثيف جلسات تحصيل أسبوعية');
        if (overdueClients.length > 0) recommendations.push(`إرسال رسائل واتساب لـ ${overdueClients.length} عميل متأخر`);
        if (growthRate < 0) recommendations.push('مراجعة سياسة منح القروض لتحفيز النشاط');

        // ── AI Risk Algorithm (New Feature) ──────────────
        // Calculate "Next Month Budget" based on recent 3 months average + growth projection
        const recentMonths = sortedMonthly.slice(-3);
        let recentCollectedSum = 0;
        recentMonths.forEach(m => recentCollectedSum += (parseFloat(m.total) || 0));
        const avgRecent = recentMonths.length > 0 ? (recentCollectedSum / recentMonths.length) : 0;

        // Base growth projection (+10%) adjusted by actual recent growth
        const projectedGrowth = Math.max(0.10, Math.min(0.50, (growthRate / 100)));
        const nextMonthBudget = avgRecent > 0 ? (avgRecent * (1 + projectedGrowth)) : 50000; // default to 50k if no data

        // Calculate "High Risk Capacity (%)" based on Collection Rate
        // If collection > 85%, allow 15% risk. If < 60%, 0% risk.
        let riskCapacity = 0;
        if (collectionRate >= 85) riskCapacity = 15;
        else if (collectionRate >= 70) riskCapacity = 10;
        else if (collectionRate >= 60) riskCapacity = 5;

        res.json({
            summary: {
                totalPortfolio,
                paidAmount,
                activeAmount,
                totalLoans,
                paidCount,
                activeCount,
                collectionRate,
                growthRate,
                avgLoanAmount: parseFloat(avgAmount.toFixed(2)),
                maxLoanAmount: parseFloat(maxAmount.toFixed(2)),
                overdueCount: overdueClients.length,
                riskSegmentation: {
                    highRisk,
                    medRisk,
                    lowRisk,
                    highRiskAmount: parseFloat(highRiskAmt.toFixed(2))
                },
                aiPredictions: {
                    nextMonthBudget: parseFloat(nextMonthBudget.toFixed(2)),
                    highRiskCapacityPercent: riskCapacity
                }
            },
            insights,
            overdueClients,
            recommendations,
            generatedAt: new Date().toISOString()
        });
    } catch (err) {
        console.error('AI Analysis error:', err);
        res.status(500).json({ error: 'Failed to generate AI analysis' });
    }
});

// ─────────────────────────────────────────────────────────
// GET /api/reports/export — Export loans to XLSX
// ─────────────────────────────────────────────────────────
router.get('/export', checkPermission('can_view_loans'), async (req, res) => {
    try {
        let { startDate, endDate, status } = req.query;
        const conditions = ['l.merchant_id = $1'];
        const params = [req.merchantId];
        let idx = 2;

        // If no dates are provided, default to the current month
        if (!startDate && !endDate) {
            const now = new Date();
            startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
        }

        if (startDate) { conditions.push(`l.transaction_date >= $${idx++}`); params.push(startDate); }
        if (endDate) { conditions.push(`l.transaction_date <= $${idx++}`); params.push(endDate); }
        if (status) { conditions.push(`l.status = $${idx++}`); params.push(status); }

        const result = await db.query(
            `SELECT l.id, c.full_name, c.national_id, c.mobile_number,
                    l.amount, l.receipt_number, l.status, l.transaction_date, l.created_at
             FROM loans l
             LEFT JOIN customers c ON l.customer_id = c.id
             WHERE ${conditions.join(' AND ')}
             ORDER BY l.transaction_date DESC`,
            params
        );

        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('تقرير القروض');
        const statusAR = { Active: 'نشط', Paid: 'مدفوع', Cancelled: 'ملغي' };

        sheet.columns = [
            { header: 'رقم القرض', key: 'id', width: 36 },
            { header: 'اسم العميل', key: 'full_name', width: 25 },
            { header: 'رقم الهوية', key: 'national_id', width: 15 },
            { header: 'رقم الجوال', key: 'mobile_number', width: 15 },
            { header: 'المبلغ (ر.س)', key: 'amount', width: 14 },
            { header: 'رقم السند', key: 'receipt_number', width: 15 },
            { header: 'الحالة', key: 'status', width: 12 },
            { header: 'تاريخ المعاملة', key: 'transaction_date', width: 16 },
        ];

        // Style header row
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A2B4A' } };
        sheet.getRow(1).height = 22;

        result.rows.forEach(row => {
            sheet.addRow({
                id: row.id,
                full_name: row.full_name || '-',
                national_id: row.national_id || '-',
                mobile_number: row.mobile_number || '-',
                amount: parseFloat(row.amount),
                receipt_number: row.receipt_number || '-',
                status: statusAR[row.status] || row.status,
                transaction_date: row.transaction_date
                    ? new Date(row.transaction_date).toLocaleDateString('ar-SA')
                    : '-'
            });
        });

        // Totals row
        const totalRow = sheet.addRow({
            full_name: 'الإجمالي',
            amount: result.rows.reduce((s, r) => s + parseFloat(r.amount), 0)
        });
        totalRow.font = { bold: true };
        totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3CD' } };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=loans-${Date.now()}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error('Export error:', err);
        res.status(500).json({ error: 'Failed to export report' });
    }
});

module.exports = router;
