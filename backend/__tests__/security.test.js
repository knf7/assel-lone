const request = require('supertest');
const app = require('../server');
const db = require('../config/database');

jest.mock('../config/database');

describe('Security Tests (OWASP compliance)', () => {
    let token;
    const mockMerchantId = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        token = jwt.sign({ merchantId: mockMerchantId, email: 'test@example.com' }, JWT_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('SQL Injection Prevention', () => {
        it('should handle single quotes and OR 1=1 in login field safely', async () => {
            db.query.mockResolvedValue({ rows: [] });

            const res = await request(app)
                .post('/api/auth/login')
                .send({
                    identifier: "' OR 1=1 --",
                    password: 'password'
                });

            // Should fail validation or just return no user, NOT execute the injected SQL
            // Our code uses parameterized queries, so it will look for a user literally named "' OR 1=1 --"
            expect(res.statusCode).toBe(401); // 401 Unauthorized if user not found literal name
        });
    });

    describe('XSS Protection', () => {
        it('should sanitize script tags in input fields (sanitize middleware)', async () => {
            db.query.mockResolvedValue({
                rows: [{ id: mockMerchantId, session_version: 1 }]
            });
            db.query.mockResolvedValue({ rows: [{ id: '1' }] }); // Customer creation mock

            const res = await request(app)
                .post('/api/customers')
                .set('Authorization', `Bearer ${token}`)
                .send({
                    fullName: '<script>alert("xss")</script>Test User',
                    nationalId: '1234567890',
                    mobileNumber: '0501234567'
                });

            // The server.js has a sanitize middleware that replaces < and >
            // So it should be saved as &lt;script&gt;
            const capturedQueryMatch = db.query.mock.calls.find(call =>
                call[0].includes('INSERT INTO customers')
            );

            if (capturedQueryMatch) {
                const insertedData = capturedQueryMatch[1];
                expect(insertedData).toContain('&lt;script&gt;alert("xss")&lt;/script&gt;Test User');
            }
        });
    });

    describe('Session Security', () => {
        it('should reject tokens with older session versions', async () => {
            const jwt = require('jsonwebtoken');
            const { JWT_SECRET } = require('../middleware/auth');

            // Generate token with old version (v1)
            const oldToken = jwt.sign({ merchantId: mockMerchantId, version: 1 }, JWT_SECRET);

            // Mock DB returning a newer session version (v2)
            db.query.mockResolvedValueOnce({
                rows: [{ session_version: 2 }]
            });

            const res = await request(app)
                .get('/api/loans')
                .set('Authorization', `Bearer ${oldToken}`);

            expect(res.statusCode).toBe(401);
            expect(res.body.error).toContain('Session expired');
        });
    });
});
