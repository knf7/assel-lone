const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const jwt = require('jsonwebtoken');

jest.mock('../config/database');

describe('Admin Controller', () => {
    let adminToken;
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'aseel_admin_2024_super_secret';
    const OBFUSCATED_PATH = '/api/system-manage-x7';

    beforeAll(() => {
        adminToken = jwt.sign({ role: 'admin' }, ADMIN_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/system-manage-x7/login', () => {
        it('should login with correct password', async () => {
            const res = await request(app)
                .post(`${OBFUSCATED_PATH}/login`)
                .send({ password: process.env.ADMIN_PASSWORD || 'Aseel@Admin2024!' });

            expect(res.statusCode).toEqual(200);
            expect(res.body).toHaveProperty('token');
        });

        it('should fail with wrong password', async () => {
            const res = await request(app)
                .post(`${OBFUSCATED_PATH}/login`)
                .send({ password: 'wrong' });

            expect(res.statusCode).toEqual(401);
        });
    });

    describe('GET /api/system-manage-x7/merchants', () => {
        it('should return merchants list for admin', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: '1', business_name: 'B1' }] });

            const res = await request(app)
                .get(`${OBFUSCATED_PATH}/merchants`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body[0].business_name).toBe('B1');
        });
    });

    describe('GET /api/system-manage-x7/stats', () => {
        it('should return global stats', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ total_merchants: 10 }] })
                .mockResolvedValueOnce({ rows: [{ total_customers: 100 }] })
                .mockResolvedValueOnce({ rows: [{ month: '2026-02', count: 1 }] });

            const res = await request(app)
                .get(`${OBFUSCATED_PATH}/stats`)
                .set('Authorization', `Bearer ${adminToken}`);

            expect(res.statusCode).toEqual(200);
            expect(res.body.total_merchants).toBe(10);
        });
    });
});
