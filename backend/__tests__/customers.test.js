const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const jwt = require('jsonwebtoken');
const { JWT_SECRET } = require('../middleware/auth');

jest.mock('../config/database');

describe('Customers Controller', () => {
    let token;
    const merchantId = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        token = jwt.sign({ merchantId, email: 'test@example.com' }, JWT_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        db.query.mockResolvedValue({ rows: [{ session_version: 1 }] });
    });

    describe('GET /api/customers', () => {
        it('should list customers with pagination and search', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] }) // Auth
                .mockResolvedValueOnce({
                    rows: [{
                        id: '1', full_name: 'John Doe', national_id: '1111111111',
                        mobile_number: '0501111111', total_debt: 1000, total_loans: 1, total_count: '1'
                    }]
                });

            const res = await request(app)
                .get('/api/customers?search=John')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.customers[0].full_name).toBe('John Doe');
            expect(res.body.customers[0]).toHaveProperty('whatsappLink');
        });
    });

    describe('POST /api/customers', () => {
        it('should create a new customer', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] }) // Auth
                .mockResolvedValueOnce({ rows: [{ count: '5' }] }) // plan check (cur count)
                .mockResolvedValueOnce({ rows: [{ subscription_plan: 'Enterprise' }] }) // plan check (limit)
                .mockResolvedValueOnce({ rows: [] }) // duplicate check
                .mockResolvedValueOnce({
                    rows: [{ id: '2', full_name: 'New Dev', national_id: '2222222222', mobile_number: '0502222222' }]
                });

            const res = await request(app)
                .post('/api/customers')
                .set('Cookie', [`token=${token}`])
                .send({
                    fullName: 'New Dev',
                    nationalId: '2222222222',
                    mobileNumber: '0502222222'
                });

            expect(res.statusCode).toEqual(201);
            expect(res.body.customer.full_name).toBe('New Dev');
        });

        it('should fail with duplicate National ID', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ count: '5' }] })
                .mockResolvedValueOnce({ rows: [{ subscription_plan: 'Enterprise' }] })
                .mockResolvedValueOnce({ rows: [{ id: 'existing' }] }); // Duplicate found

            const res = await request(app)
                .post('/api/customers')
                .set('Cookie', [`token=${token}`])
                .send({
                    fullName: 'New Dev',
                    nationalId: '2222222222',
                    mobileNumber: '0502222222'
                });

            expect(res.statusCode).toEqual(409);
        });
    });

    describe('DELETE /api/customers/:id', () => {
        it('should prevent deleting customer with active loans', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ count: '1' }] }); // Active loans count

            const res = await request(app)
                .delete('/api/customers/1')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toContain('active loans');
        });

        it('should delete customer if no active loans', async () => {
            db.query
                .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
                .mockResolvedValueOnce({ rows: [{ count: '0' }] })
                .mockResolvedValueOnce({ rows: [{ id: '1' }] }); // Delete returning

            const res = await request(app)
                .delete('/api/customers/1')
                .set('Cookie', [`token=${token}`]);

            expect(res.statusCode).toEqual(200);
            expect(res.body.message).toBe('Customer deleted successfully');
        });
    });
});
