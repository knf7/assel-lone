const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

jest.mock('../config/database');
jest.mock('stripe', () => {
    return jest.fn().mockImplementation(() => ({
        customers: {
            create: jest.fn().mockResolvedValue({ id: 'cus_123' })
        },
        checkout: {
            sessions: {
                create: jest.fn().mockResolvedValue({ url: 'http://stripe.com/checkout' })
            }
        },
        webhooks: {
            constructEvent: jest.fn().mockReturnValue({ type: 'customer.subscription.created', data: { object: { customer: 'cus_123' } } })
        }
    }));
});

describe('Subscription Controller', () => {
    let token;
    const merchantId = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        token = jwt.sign({ merchantId, email: 'test@example.com' }, JWT_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue({ rows: [{ session_version: 1 }] });
    });

    describe('POST /api/subscription/create-checkout', () => {
        it('should create a stripe checkout session', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ email: 'test@example.com', stripe_customer_id: null }] });

            const res = await request(app)
                .post('/api/subscription/create-checkout')
                .set('Cookie', [`token=${token}`])
                .send({ planId: 'pro' });

            expect(res.statusCode).toEqual(200);
            expect(res.body.sessionUrl).toBe('http://stripe.com/checkout');
        });

        it('should fail with invalid plan', async () => {
            const res = await request(app)
                .post('/api/subscription/create-checkout')
                .set('Cookie', [`token=${token}`])
                .send({ planId: 'invalid' });

            expect(res.statusCode).toEqual(400);
        });
    });

    describe('GET /api/subscription/status', () => {
        it('should return subscription status', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ subscription_plan: 'Enterprise', subscription_status: 'Active' }] });

            const res = await request(app)
                .get('/api/subscription/status')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.subscription_plan).toBe('Enterprise');
        });
    });
});
