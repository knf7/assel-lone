const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const { setProfileUpdateData, getProfileUpdateData, deleteProfileUpdateData } = require('../config/redis');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');
const bcrypt = require('bcrypt');

jest.mock('../config/database', () => ({
    query: jest.fn(),
    pool: {
        connect: jest.fn()
    }
}));
jest.mock('../config/redis');
jest.mock('../utils/mailer');

describe('Settings Controller', () => {
    let token;
    const merchantId = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        token = jwt.sign({ merchantId, email: 'test@example.com' }, JWT_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Auth check mock
        db.query.mockResolvedValue({ rows: [{ session_version: 1 }] });
    });

    describe('GET /api/settings/profile', () => {
        it('should fetch profile data', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ business_name: 'Aseel Store', email: 'test@example.com' }] });

            const res = await request(app)
                .get('/api/settings/profile')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.profile.business_name).toBe('Aseel Store');
        });
    });

    describe('PATCH /api/settings/profile', () => {
        it('should propose changes and send OTP', async () => {
            const mockClient = {
                query: jest.fn().mockImplementation((q) => {
                    if (q.includes('SELECT id FROM merchants WHERE email')) return { rows: [] };
                    if (q.includes('SELECT email FROM merchants WHERE id')) return { rows: [{ email: 'old@example.com' }] };
                    return { rows: [] };
                }),
                release: jest.fn()
            };
            db.pool.connect.mockResolvedValue(mockClient);

            // Auth check query
            db.query.mockResolvedValueOnce({ rows: [{ session_version: 1 }] });

            const res = await request(app)
                .patch('/api/settings/profile')
                .set('Cookie', [`token=${token}`])
                .send({ business_name: 'New Name' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.requiresOTP).toBe(true);
        });
    });

    describe('POST /api/settings/change-password', () => {
        it('should update password with valid current password', async () => {
            const oldHash = await bcrypt.hash('old-pass', 10);
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ password_hash: oldHash }] }) // password check
                .mockResolvedValueOnce({ rows: [] }); // update call

            const res = await request(app)
                .post('/api/settings/change-password')
                .set('Cookie', [`token=${token}`])
                .send({ currentPassword: 'old-pass', newPassword: 'new-pass' });

            expect(res.statusCode).toEqual(200);
        });
    });
});
