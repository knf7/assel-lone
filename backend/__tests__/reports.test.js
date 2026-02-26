const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

jest.mock('../config/database');

describe('Reports / Analytics Controller', () => {
    let token;
    const merchantId = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        token = jwt.sign({ merchantId, email: 'test@example.com' }, JWT_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Default mock for session version check in authenticateToken
        db.query.mockResolvedValue({ rows: [{ session_version: 1 }] });
    });

    describe('GET /api/reports/dashboard', () => {
        it('should return complete dashboard metrics', async () => {
            // Mocking multiple queries in /dashboard
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] }) // Auth
                .mockResolvedValueOnce({ rows: [{ total_debt: '5000' }] }) // Debt
                .mockResolvedValueOnce({ rows: [{ total_customers: 10, active_customers: 5 }] }) // Customers
                .mockResolvedValueOnce({ rows: [{ count: 2 }] }) // monthRes
                .mockResolvedValueOnce({ rows: [{ paid: '2000', total: '7000' }] }) // rateRes
                .mockResolvedValueOnce({ rows: [{ overdue_count: 1 }] }) // overdueRes
                .mockResolvedValueOnce({ rows: [] }); // recentRes

            const res = await request(app)
                .get('/api/reports/dashboard')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.metrics.totalDebt).toBe(5000);
            expect(res.body.metrics.collectionRate).toBe(28.57);
        });

        it('should handle zero total debt in collection rate', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] }) // Auth
                .mockResolvedValueOnce({ rows: [{ total_debt: '0' }] })
                .mockResolvedValueOnce({ rows: [{ total_customers: 0, active_customers: 0 }] })
                .mockResolvedValueOnce({ rows: [{ count: 0 }] })
                .mockResolvedValueOnce({ rows: [{ paid: '0', total: '0' }] }) // Total = 0
                .mockResolvedValueOnce({ rows: [{ overdue_count: 0 }] })
                .mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .get('/api/reports/dashboard')
                .set('Cookie', [`token=${token}`]);

            expect(res.body.metrics.collectionRate).toBe(0);
        });
    });

    describe('GET /api/reports/ai-analysis', () => {
        it('should reject non-enterprise users', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] }) // Auth
                .mockResolvedValueOnce({ rows: [{ subscription_plan: 'Basic' }] }); // Plan check

            const res = await request(app)
                .get('/api/reports/ai-analysis')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(403);
            expect(res.body.requiresUpgrade).toBe(true);
        });

        it('should provide rich insights for enterprise users', async () => {
            // 1. Auth check
            db.query.mockResolvedValueOnce({ rows: [{ session_version: 1 }] });
            // 2. Plan check
            db.query.mockResolvedValueOnce({ rows: [{ subscription_plan: 'Enterprise' }] });
            // 3. Parallel queries
            db.query.mockResolvedValueOnce({
                rows: [{
                    total_portfolio: '10000', paid_amount: '9000', active_amount: '1000', total_loans: 10, paid_count: 9, active_count: 1
                }]
            }); // Totals
            db.query.mockResolvedValueOnce({ rows: [{ month: '2026-02', total: '5000' }, { month: '2026-01', total: '4000' }] }); // Monthly
            db.query.mockResolvedValueOnce({ rows: [] }); // Overdue clients
            db.query.mockResolvedValueOnce({ rows: [{ month: '2026-02', total: '5000' }] }); // Best month
            db.query.mockResolvedValueOnce({ rows: [{ avg_amount: 1000, max_amount: 1000 }] }); // Avg
            db.query.mockResolvedValueOnce({ rows: [{ high_risk: 0, medium_risk: 0, low_risk: 1 }] }); // Risk

            const res = await request(app)
                .get('/api/reports/ai-analysis')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.summary.collectionRate).toBe(90);
            expect(res.body.summary.growthRate).toBe(25); // (5000-4000)/4000
            expect(res.body.insights[0].type).toBe('success'); // Collection > 80%
        });
    });

    describe('GET /api/reports/export', () => {
        it('should export Excel with default date range', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] }) // Auth
                .mockResolvedValueOnce({
                    rows: [
                        { id: '1', full_name: 'Client A', amount: '1000', status: 'Active', transaction_date: '2026-02-01' }
                    ]
                }); // Data

            const res = await request(app)
                .get('/api/reports/export')
                .set('Cookie', [`token=${token}`]);

            expect(res.header['content-type']).toContain('spreadsheetml');
            expect(res.statusCode).toEqual(200);
        });
    });
});
