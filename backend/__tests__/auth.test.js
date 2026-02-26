const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const { getOTP, setOTP } = require('../config/redis');
const { sendOTPEmail } = require('../utils/mailer');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

jest.mock('../config/database');
jest.mock('../config/redis');
jest.mock('../utils/mailer');

describe('Auth Controller (Integration)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // Check existing
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: '1',
                    username: 'testuser',
                    business_name: 'Test Business',
                    email: 'test@example.com',
                    subscription_plan: 'Enterprise',
                    status: 'approved',
                    created_at: new Date()
                }]
            });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    businessName: 'Test Business',
                    email: 'test@example.com',
                    password: 'password123',
                    mobile: '0501234567'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.merchant.username).toEqual('testuser');
        });

        it('should fail if user already exists', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: '1' }] });

            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'existing',
                    businessName: 'Business',
                    email: 'existing@example.com',
                    password: 'password123',
                    mobile: '0501234567'
                });

            expect(res.statusCode).toEqual(409);
        });

        it('should handle database errors during registration', async () => {
            db.query.mockRejectedValueOnce(new Error('Pool error'));
            const res = await request(app)
                .post('/api/auth/register')
                .send({
                    username: 'testuser',
                    businessName: 'Test Business',
                    email: 'dbfail@example.com',
                    password: 'password123',
                    mobile: '0501234567'
                });
            expect(res.statusCode).toEqual(500);
        });
    });

    describe('POST /api/auth/login', () => {
        it('should fail login with wrong credentials', async () => {
            db.query.mockResolvedValueOnce({ rows: [] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'wrong', password: 'wrong' });

            expect(res.statusCode).toEqual(401);
        });

        it('should lock account after 5 failed attempts', async () => {
            const passwordHash = await bcrypt.hash('password123', 10);
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: '1',
                    failed_login_attempts: 4,
                    email: 'test@example.com',
                    password_hash: passwordHash,
                    status: 'approved'
                }]
            });
            const res = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'testuser', password: 'wrong' });

            expect(res.statusCode).toEqual(423);
        });

        it('should handle admin pending status', async () => {
            const passwordHash = await bcrypt.hash('password123', 10);
            db.query.mockResolvedValueOnce({
                rows: [{
                    id: '1',
                    email: 'test@example.com',
                    password_hash: passwordHash,
                    status: 'pending'
                }]
            });

            const res = await request(app)
                .post('/api/auth/login')
                .send({ identifier: 'testuser', password: 'password123' });

            expect(res.statusCode).toEqual(403);
        });
    });

    describe('POST /api/auth/verify-otp', () => {
        it('should verify OTP successfully', async () => {
            const sessionId = jwt.sign({ merchantId: '1', purpose: '2fa' }, JWT_SECRET);

            getOTP.mockResolvedValueOnce('123456'); // Mock getOTP import direct
            db.query.mockResolvedValueOnce({
                rows: [{ id: '1', username: 'testuser', email: 'test@example.com' }]
            });

            const res = await request(app)
                .post('/api/auth/verify-otp')
                .send({
                    sessionId: sessionId,
                    code: '123456'
                });

            expect(res.statusCode).toEqual(200);
            expect(res.body.merchant.username).toEqual('testuser');
        });

        it('should fail with expired OTP (not in redis)', async () => {
            const sessionId = jwt.sign({ merchantId: '1', purpose: '2fa' }, JWT_SECRET);
            getOTP.mockResolvedValueOnce(null);

            const res = await request(app)
                .post('/api/auth/verify-otp')
                .send({
                    sessionId: sessionId,
                    code: '123456'
                });

            expect(res.statusCode).toEqual(410);
        });

        it('should fail with wrong OTP code', async () => {
            const sessionId = jwt.sign({ merchantId: '1', purpose: '2fa' }, JWT_SECRET);
            getOTP.mockResolvedValueOnce('123456');

            const res = await request(app)
                .post('/api/auth/verify-otp')
                .send({
                    sessionId: sessionId,
                    code: '654321'
                });

            expect(res.statusCode).toEqual(401);
        });
    });
});
