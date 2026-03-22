const request = require('supertest');
const app = require('../server');
const db = require('../config/database');
const path = require('path');
const fs = require('fs');

jest.mock('../config/database');

describe('Loans Controller - Bulk Upload', () => {
    let token;
    const mockMerchantId = '123e4567-e89b-12d3-a456-426614174000';

    beforeAll(() => {
        const jwt = require('jsonwebtoken');
        const { JWT_SECRET } = require('../middleware/auth');
        token = jwt.sign({ merchantId: mockMerchantId, email: 'test@example.com' }, JWT_SECRET);
    });

    beforeEach(() => {
        jest.clearAllMocks();
        delete db.pool;
    });

    describe('POST /api/loans/upload', () => {
        it('should process a CSV file and return summary with errors', async () => {
            // Mock Auth Middleware Session Check
            db.query.mockResolvedValueOnce({
                rows: [{ id: mockMerchantId, session_version: 1 }]
            });

            // Mock DB Pool for transaction
            const mockClient = {
                query: jest.fn().mockResolvedValue({ rows: [] }),
                release: jest.fn(),
            };
            db.pool = {
                connect: jest.fn().mockResolvedValue(mockClient)
            };

            // Mock successful customer insertion
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // BEGIN
            mockClient.query.mockResolvedValueOnce({
                rows: [{ id: 'cust1', national_id: '1234567890' }]
            }); // INSERT customers
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // INSERT loans
            mockClient.query.mockResolvedValueOnce({ rows: [] }); // COMMIT

            const csvContent = 'اسم العميل,رقم الهوية,رقم الجوال,المبلغ\n' +
                'Valid User,1234567890,0501234567,1000\n' +
                'Invalid User,,0500000000,500'; // Missing ID

            const testFilePath = path.join(__dirname, 'test_upload.csv');
            fs.writeFileSync(testFilePath, csvContent);

            const res = await request(app)
                .post('/api/loans/upload')
                .set('Authorization', `Bearer ${token}`)
                .attach('file', testFilePath);

            expect(res.statusCode).toEqual(200);
            expect(res.body.summary.totalRowsInFile).toEqual(2);
            expect(res.body.summary.success).toEqual(1);
            expect(res.body.summary.failed).toEqual(1);
            expect(res.body.summary.errors.length).toEqual(1);
            expect(res.body.summary.errors[0].error).toContain('رقم الهوية');

            if (fs.existsSync(testFilePath)) fs.unlinkSync(testFilePath);
        });

        it('should handle invalid file type', async () => {
            db.query.mockResolvedValueOnce({
                rows: [{ id: mockMerchantId, session_version: 1 }]
            });

            const res = await request(app)
                .post('/api/loans/upload')
                .set('Authorization', `Bearer ${token}`)
                .send({}); // No file

            expect(res.statusCode).toEqual(400);
            expect(res.body.error).toEqual('لم يتم رفع أي ملف');
        });
    });
});

describe('Loans Controller - Najiz updates', () => {
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

    it('should persist Najiz collected amount and keep Najiz flag when editing a case', async () => {
        db.query
            .mockResolvedValueOnce({ rows: [{ session_version: 1 }] })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'loan-1',
                    is_najiz_case: false
                }]
            })
            .mockResolvedValueOnce({
                rows: [{
                    id: 'loan-1',
                    status: 'Raised',
                    is_najiz_case: true,
                    amount: '1500',
                    principal_amount: '1500',
                    profit_percentage: '0',
                    national_id: '1111111111',
                    mobile_number: '0501234567',
                    customer_name: 'Test Customer',
                    najiz_case_amount: '1500',
                    najiz_collected_amount: '1250',
                    najiz_status: 'قيد الرفع',
                    najiz_plaintiff_name: 'عمر',
                    najiz_plaintiff_national_id: '1111111111'
                }]
            });

        const res = await request(app)
            .patch('/api/loans/loan-1/najiz')
            .set('Authorization', `Bearer ${token}`)
            .send({
                najiz_case_amount: 1500,
                najiz_collected_amount: 1250,
                najiz_plaintiff_name: 'عمر',
                najiz_plaintiff_national_id: '1111111111'
            });

        expect(res.statusCode).toEqual(200);
        expect(res.body.loan.is_najiz_case).toBe(true);
        expect(Number(res.body.loan.najiz_collected_amount)).toBe(1250);

        const updateQuery = db.query.mock.calls[2][0];
        expect(updateQuery).toContain('is_najiz_case');
        expect(updateQuery).toContain('najiz_collected_amount');
    });
});
