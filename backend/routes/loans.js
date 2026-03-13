const express = require('express');
const Joi = require('joi');
const db = require('../config/database');

const fs = require('fs');
const path = require('path');
const multer = require('multer');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');

const { authenticateToken, injectMerchantId, checkPermission, injectRlsContext, stepUpAuth } = require('../middleware/auth');
const { trackActivity } = require('../utils/anomalyDetector');
const { uploadReceipt } = require('../middleware/upload');
const { getCache, setCache, clearCacheByPrefix } = require('../utils/cache');

// Store uploads in /tmp for fast I/O
const upload = multer({
    dest: '/tmp/uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50 MB
});

const rateLimit = require('express-rate-limit');

// ── Rate Limiting for Destructive Actions ──
const destructiveActionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10, // Max 10 destructive actions per 15 mins
    message: { error: 'تجاوزت الحد المسموح للعمليات الحساسة. حاول لاحقاً.' },
    standardHeaders: true,
    legacyHeaders: false,
});


// ─── Enrichment helpers ───
const enrichLoan = (l) => ({
    ...l,
    whatsappLink: l.mobile_number ? `https://wa.me/${l.mobile_number.replace(/\D/g, '')}` : null,
    najizLink: l.national_id ? `https://www.najiz.sa/applications/landing/verification?id=${encodeURIComponent(l.national_id)}` : null,
    najiz_collected_amount: l.najiz_collected_amount || 0
});

const { checkPlanLimit } = require('../middleware/planLimits');

const router = express.Router();

const invalidateReportsCache = async (merchantId) => {
    if (!merchantId) return;
    try {
        await clearCacheByPrefix(`reports:dashboard:${merchantId}`);
        await clearCacheByPrefix(`reports:analytics:${merchantId}:`);
        await clearCacheByPrefix(`reports:ai:${merchantId}`);
        await clearCacheByPrefix(`loans:list:${merchantId}:`);
        await clearCacheByPrefix(`customers:list:${merchantId}:`);
    } catch {
        // Best-effort cache invalidation
    }
};

// Allow status updates for users who can access loans page
// (merchant always allowed, employee needs either view or add loans permission).
const checkLoanStatusPermission = (req, res, next) => {
    if (!req.user || !req.user.role || req.user.role === 'merchant') return next();
    const perms = req.user.permissions || {};
    if (perms.can_add_loans || perms.can_view_loans) return next();
    return res.status(403).json({ error: 'ليس لديك صلاحية لتحديث حالة القرض' });
};

// Upload loan attachment (bond/id image or PDF)
router.post(
    '/upload-attachment',
    authenticateToken,
    injectMerchantId,
    checkPermission('can_add_loans'),
    uploadReceipt.single('file'),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
            }

            const attachmentUrl = `/uploads/receipts/${req.file.filename}`;
            return res.status(201).json({
                message: 'تم رفع المرفق بنجاح',
                attachmentUrl,
                originalName: req.file.originalname,
                size: req.file.size
            });
        } catch (err) {
            console.error('Upload attachment error:', err);
            return res.status(500).json({ error: 'فشل رفع المرفق' });
        }
    }
);

router.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'حجم الملف كبير. الحد الأقصى 5MB.' });
        }
        return res.status(400).json({ error: err.message || 'خطأ في رفع الملف' });
    }
    if (err && err.message && err.message.includes('نوع الملف غير مدعوم')) {
        return res.status(400).json({ error: err.message });
    }
    return next(err);
});



// ─────────────────────────────────────────────────────────
// DELETE /api/loans/:id — Delete Loan (Soft Delete)
// ─────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, injectMerchantId, checkPermission('can_add_loans'), destructiveActionLimiter, stepUpAuth, injectRlsContext, async (req, res) => {
    const { id } = req.params;
    const merchantId = req.merchantId;

    try {
        // Track anomaly
        const isAnomaly = await trackActivity(merchantId, req.user.userId, 'loan_delete');
        if (isAnomaly) {
            return res.status(429).json({ error: 'تم رصد نشاط مشبوه. تم حظر العملية مؤقتاً.' });
        }

        const result = await req.dbClient.query(
            `UPDATE loans
             SET deleted_at = CURRENT_TIMESTAMP
             WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL
             RETURNING id`,
            [id, merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'القرض غير موجود أو لا تملك صلاحية حذفه' });
        }

        await invalidateReportsCache(merchantId);
        res.status(200).json({ message: 'تم حذف القرض بنجاح (Soft Delete)', id: result.rows[0].id });
    } catch (err) {
        console.error('Error deleting loan:', err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─────────────────────────────────────────────────────────
// GET /api/loans/:id — Get Single Loan
// ─────────────────────────────────────────────────────────
router.get('/:id', authenticateToken, injectMerchantId, checkPermission('can_view_loans'), injectRlsContext, async (req, res) => {
    const { id } = req.params;
    const merchantId = req.merchantId;

    try {
        const result = await req.dbClient.query(
            `SELECT
                l.id, l.merchant_id, l.customer_id, l.amount, l.receipt_number,
                l.transaction_date, l.status, l.created_at, l.updated_at,
                l.najiz_case_number, l.najiz_case_amount, l.najiz_status,
                l.najiz_collected_amount, l.is_najiz_case, l.principal_amount, l.profit_percentage,
                c.national_id, c.full_name, c.mobile_number
            FROM loans l
            JOIN customers c ON l.customer_id = c.id
            WHERE l.id = $1 AND l.merchant_id = $2 AND l.deleted_at IS NULL`,
            [id, merchantId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'القرض غير موجود' });
        }

        res.json(enrichLoan(result.rows[0]));
    } catch (err) {
        console.error('Error fetching loan:', err);
        res.status(500).json({ error: 'خطأ في الخادم' });
    }
});

// ─────────────────────────────────────────────────────────
// POST /api/loans/upload — FAST bulk upload
// Processes the entire file in a SINGLE DB transaction
// with batch UNNEST inserts — no per-row API calls
// ─────────────────────────────────────────────────────────
router.post('/upload', authenticateToken, injectMerchantId, checkPermission('can_upload_loans'), upload.single('file'), async (req, res) => {
    console.log('[DEBUG] Upload request received from merchant:', req.merchantId);
    if (!req.file) {
        console.error('[ERROR] No file uploaded');
        return res.status(400).json({ error: 'لم يتم رفع أي ملف' });
    }

    // Security checking MIME Type
    const allowedMimeTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
    if (!allowedMimeTypes.includes(req.file.mimetype) && !req.file.originalname.match(/\.(csv|xlsx|xls)$/i)) {
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Invalid file type. Only CSV and Excel files are allowed.' });
    }

    const filePath = req.file.path;
    const merchantId = req.merchantId;
    const sheetName = req.body.sheet || null;
    const overrideDate = req.body.overrideDate || null; // New field for date unification

    // ── Column aliases ───────────────────────────────
    const NATIONAL_ID_KEYS = ['رقم الهوية', 'الهوية', 'هوية', 'national_id', 'id', 'ID', 'بطاقة الأحوال', 'السجل المدني', 'رقم السجل'];
    const FULL_NAME_KEYS = ['اسم العميل', 'الاسم', 'اسم', 'full_name', 'name', 'العميل'];
    const MOBILE_KEYS = ['رقم الجوال', 'الجوال', 'جوال', 'mobile', 'phone', 'رقم الهاتف', 'رقم التواصل', 'التواصل'];
    const AMOUNT_KEYS = ['المبلغ', 'مبلغ', 'amount', 'المبلغ الإجمالي', 'قيمة القرض', 'الرصيد'];
    const RECEIPT_KEYS = ['رقم السند', 'رقم الإيصال', 'سند', 'إيصال', 'receipt', 'receipt_number'];
    const DATE_KEYS = ['التاريخ', 'تاريخ', 'date', 'transaction_date', 'تاريخ المعاملة', 'تاريخ السداد'];

    // Utility function for smart date parsing
    // Utility function for smart date parsing
    const parseSmartDate = (value) => {
        if (!value) return null;

        // Handle Excel numeric serial dates (e.g., 46082 -> 2026-03-01)
        if (typeof value === 'number' && value > 20000) {
            const date = new Date(Math.round((value - 25569) * 86400 * 1000));
            return date.toISOString().split('T')[0];
        }

        // Convert to string and clean up
        let strVal = String(value).trim();

        // ── Arabic Month Mapping ────────────────
        const ARABIC_MONTHS = {
            'يناير': '01', 'فبراير': '02', 'مارس': '03', 'أبريل': '04', 'مايو': '05', 'يونيو': '06',
            'يوليو': '07', 'أغسطس': '08', 'سبتمبر': '09', 'أكتوبر': '10', 'نوفمبر': '11', 'ديسمبر': '12',
            'جانفي': '01', 'فيفري': '02', 'مارس': '03', 'أفريل': '04', 'ماي': '05', 'جوان': '06',
            'جويلية': '07', 'أوت': '08', 'سبتمبر': '09', 'أكتوبر': '10', 'نوفمبر': '11', 'ديسمبر': '12'
        };

        // Try to replace Arabic month names with numbers
        for (const [monthName, monthNum] of Object.entries(ARABIC_MONTHS)) {
            if (strVal.includes(monthName)) {
                const yearMatch = strVal.match(/\d{4}/);
                const year = yearMatch ? yearMatch[0] : new Date().getFullYear();
                const dayMatch = strVal.replace(year, '').match(/\d{1,2}/);
                const day = dayMatch ? dayMatch[0].padStart(2, '0') : '01';
                return `${year}-${monthNum}-${day}`;
            }
        }

        const englishNumbersVal = strVal.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => d.charCodeAt(0) - 1632);
        const parsed = new Date(englishNumbersVal);
        if (!isNaN(parsed.getTime())) {
            return parsed.toISOString().split('T')[0];
        }

        const parts = englishNumbersVal.split(/[-/]/);
        if (parts.length === 3) {
            if (parts[0].length === 4) {
                return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else if (parts[2].length === 4) {
                return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
        }

        return null;
    };

    const normalize = (k) => String(k || '').trim().toLowerCase().replace(/\s+/g, '');

    const pick = (obj, keys) => {
        const objKeys = Object.keys(obj);
        for (const alias of keys) {
            const normalizedAlias = normalize(alias);
            const foundKey = objKeys.find(k => normalize(k) === normalizedAlias || normalize(k).includes(normalizedAlias));
            if (foundKey) return obj[foundKey];
        }
        return null;
    };

    const hasColumn = (headers, keys) => {
        return headers.some((header) => {
            const normalizedHeader = normalize(header);
            return keys.some((alias) => normalizedHeader === normalize(alias) || normalizedHeader.includes(normalize(alias)));
        });
    };

    const validateHeaders = (headers) => {
        const missing = [];
        if (!hasColumn(headers, NATIONAL_ID_KEYS)) missing.push('رقم الهوية');
        if (!hasColumn(headers, FULL_NAME_KEYS)) missing.push('الاسم');
        if (!hasColumn(headers, AMOUNT_KEYS)) missing.push('المبلغ');
        return missing;
    };

    const makeHeaderError = (missing) => {
        const err = new Error(`الملف لا يحتوي الأعمدة المطلوبة: ${missing.join('، ')}`);
        err.statusCode = 400;
        return err;
    };

    // ── Helper: Process a batch of rows ──────────────────
    const processBatch = async (batchRows, mId, oDate, startRowOffset = 1, client) => {
        const validatedRows = [];
        const batchErrors = [];

        batchRows.forEach((r, index) => {
            const rowNumber = startRowOffset + index + 2; // +2 because header row starts at 1
            const fullName = String(pick(r, FULL_NAME_KEYS) || '').trim();
            const nationalId = String(pick(r, NATIONAL_ID_KEYS) || '').replace(/\D/g, '');
            const mobileNumberRaw = String(pick(r, MOBILE_KEYS) || '').replace(/\D/g, '');
            const amountRaw = pick(r, AMOUNT_KEYS);
            const amount = Number(String(amountRaw ?? '').replace(/,/g, '').trim());
            const receiptNumber = String(pick(r, RECEIPT_KEYS) || '').trim() || null;
            const parsedDate = oDate || parseSmartDate(pick(r, DATE_KEYS)) || new Date().toISOString().split('T')[0];

            if (!nationalId || !/^\d{10}$/.test(nationalId)) {
                batchErrors.push({ row: rowNumber, error: 'رقم الهوية يجب أن يكون 10 أرقام' });
                return;
            }
            if (!fullName) {
                batchErrors.push({ row: rowNumber, error: 'اسم العميل مطلوب' });
                return;
            }
            if (!Number.isFinite(amount) || amount <= 0) {
                batchErrors.push({ row: rowNumber, error: 'المبلغ غير صالح' });
                return;
            }
            if (!parsedDate) {
                batchErrors.push({ row: rowNumber, error: 'التاريخ غير صالح' });
                return;
            }

            validatedRows.push({
                fullName,
                nationalId,
                mobileNumber: mobileNumberRaw || '0000000000',
                amount,
                receiptNumber,
                transactionDate: parsedDate
            });
        });

        if (validatedRows.length === 0) return { success: 0, errors: batchErrors };

        let dbClient = client;
        let ownsClient = false;
        try {

            if (!dbClient) {
                if (db.pool && typeof db.pool.connect === 'function') {
                    dbClient = await db.pool.connect();
                    ownsClient = true;
                } else {
                    dbClient = {
                        query: db.query,
                        release: () => { }
                    };
                }
            }

            if (ownsClient) {
                await dbClient.query('BEGIN');
            }

            const uniqueCustomersMap = new Map();
            for (const row of validatedRows) {
                if (!uniqueCustomersMap.has(row.nationalId)) {
                    uniqueCustomersMap.set(row.nationalId, {
                        nationalId: row.nationalId,
                        fullName: row.fullName,
                        mobileNumber: row.mobileNumber
                    });
                }
            }

            const uniqueCustomers = Array.from(uniqueCustomersMap.values());
            const mids = uniqueCustomers.map(() => mId);
            const natIds = uniqueCustomers.map(c => c.nationalId);
            const names = uniqueCustomers.map(c => c.fullName);
            const mobiles = uniqueCustomers.map(c => c.mobileNumber);

            const customerRes = await dbClient.query(
                `INSERT INTO customers (merchant_id, national_id, full_name, mobile_number)
                 SELECT * FROM UNNEST($1::uuid[], $2::text[], $3::text[], $4::text[])
                   AS t(merchant_id, national_id, full_name, mobile_number)
                 ON CONFLICT (merchant_id, national_id) DO UPDATE
                   SET full_name = COALESCE(NULLIF(EXCLUDED.full_name, 'غير محدد'), customers.full_name),
                       mobile_number = COALESCE(NULLIF(EXCLUDED.mobile_number, '0000000000'), customers.mobile_number)
                 RETURNING id, national_id`,
                [mids, natIds, names, mobiles]
            );

            const customerByNationalId = new Map();
            for (const row of customerRes.rows || []) {
                customerByNationalId.set(String(row.national_id), row.id);
            }

            const loanMerchants = [];
            const loanCusts = [];
            const loanAmounts = [];
            const loanReceipts = [];
            const loanDates = [];

            for (const row of validatedRows) {
                const customerId = customerByNationalId.get(String(row.nationalId));
                if (!customerId) {
                    batchErrors.push({ row: startRowOffset + 2, error: `تعذر ربط العميل بالهوية ${row.nationalId}` });
                    continue;
                }
                loanMerchants.push(mId);
                loanCusts.push(customerId);
                loanAmounts.push(row.amount);
                loanReceipts.push(row.receiptNumber);
                loanDates.push(row.transactionDate);
            }

            if (loanCusts.length > 0) {
                await dbClient.query(
                    `INSERT INTO loans (merchant_id, customer_id, amount, receipt_number, transaction_date, status)
                     SELECT m, c, a, r, d::date, 'Active'
                     FROM UNNEST($1::uuid[], $2::uuid[], $3::numeric[], $4::text[], $5::text[]) AS t(m, c, a, r, d)`,
                    [loanMerchants, loanCusts, loanAmounts, loanReceipts, loanDates]
                );
            }

            if (ownsClient) {
                await dbClient.query('COMMIT');
            }

            if (ownsClient && dbClient && typeof dbClient.release === 'function') {
                dbClient.release();
            }
            return { success: loanCusts.length, errors: batchErrors };
        } catch (err) {
            if (ownsClient && dbClient && typeof dbClient.query === 'function') {
                try { await dbClient.query('ROLLBACK'); } catch (e) { }
            }
            if (ownsClient && dbClient && typeof dbClient.release === 'function') {
                dbClient.release();
            }
            throw err;
        }
    };

    try {
        let totalProcessed = 0;
        let totalSuccess = 0;
        const allErrors = [];
        const BATCH_SIZE = 5000;
        let currentBatch = [];

        const isCsv = req.file.mimetype === 'text/csv' || req.file.originalname.toLowerCase().endsWith('.csv');

        if (isCsv) {
            let headerChecked = false;
            await new Promise((resolve, reject) => {
                const stream = fs.createReadStream(filePath).pipe(csv());
                stream.on('data', async (row) => {
                    if (!headerChecked) {
                        const missing = validateHeaders(Object.keys(row || {}));
                        if (missing.length > 0) {
                            stream.destroy(makeHeaderError(missing));
                            return;
                        }
                        headerChecked = true;
                    }
                    totalProcessed++;
                    currentBatch.push(row);
                    if (currentBatch.length >= BATCH_SIZE) {
                        stream.pause();
                        try {
                            const res = await processBatch(currentBatch, merchantId, overrideDate, totalProcessed - BATCH_SIZE);
                            totalSuccess += res.success;
                            if (res.errors) allErrors.push(...res.errors);
                            currentBatch = [];
                            stream.resume();
                        } catch (err) {
                            stream.destroy(err);
                        }
                    }
                });
                stream.on('end', async () => {
                    try {
                        if (currentBatch.length > 0) {
                            const res = await processBatch(currentBatch, merchantId, overrideDate, totalProcessed - currentBatch.length);
                            totalSuccess += res.success;
                            if (res.errors) allErrors.push(...res.errors);
                        }
                        resolve();
                    } catch (err) {
                        reject(err);
                    }
                });
                stream.on('error', reject);
            });
        } else {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(filePath);
            const ws = sheetName ? (workbook.getWorksheet(sheetName) || workbook.getWorksheet(1)) : workbook.getWorksheet(1);
            const headers = [];
            ws.getRow(1).eachCell((cell, col) => {
                headers[col] = cell.value ? String(cell.value).trim() : `col_${col}`;
            });
            const missing = validateHeaders(headers.filter(Boolean));
            if (missing.length > 0) {
                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                return res.status(400).json({ error: `الملف لا يحتوي الأعمدة المطلوبة: ${missing.join('، ')}` });
            }
            const wsRows = [];
            ws.eachRow((row, rowNum) => {
                if (rowNum === 1) return;
                const obj = {};
                row.eachCell({ includeEmpty: true }, (cell, col) => {
                    if (headers[col]) {
                        let val = cell.value;
                        if (val instanceof Date) val = val.toISOString().split('T')[0];
                        else if (val && typeof val === 'object' && val.text) val = val.text;
                        obj[headers[col]] = val;
                    }
                });
                wsRows.push(obj);
            });
            for (let i = 0; i < wsRows.length; i += BATCH_SIZE) {
                const batch = wsRows.slice(i, i + BATCH_SIZE);
                const res = await processBatch(batch, merchantId, overrideDate, i);
                totalSuccess += res.success;
                if (res.errors) allErrors.push(...res.errors);
            }
            totalProcessed = wsRows.length;
        }

        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        await invalidateReportsCache(merchantId);
        return res.json({
            message: 'تمت المعالجة بنجاح',
            summary: {
                totalRowsInFile: totalProcessed,
                success: totalSuccess,
                failed: totalProcessed - totalSuccess,
                errors: allErrors
            }
        });
    } catch (err) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('Upload error:', err);
        const status = err.statusCode || 500;
        const message = status === 400 ? err.message : `فشل معالجة الملف: ${err.message}`;
        return res.status(status).json({ error: message });
    }
});

// Apply auth middleware to remaining routes
router.use(authenticateToken);
router.use(injectMerchantId);
router.use(injectRlsContext);

// Validation schema
const loanSchema = Joi.object({
    customerId: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(), // Total Loan Amount
    principal_amount: Joi.number().positive().optional().allow(null, 0),
    profit_percentage: Joi.number().min(0).max(100).optional().allow(null, 0),
    receiptNumber: Joi.string().max(100).optional().allow('', null),
    receiptImageUrl: Joi.string().uri().optional().allow('', null),
    transactionDate: Joi.date().optional().allow(null),
    status: Joi.string().optional().allow('Active', 'Paid', 'Raised', 'Cancelled'),
    najiz_case_number: Joi.string().optional().allow('', null),
    najiz_case_amount: Joi.number().optional().allow('', null),
    najiz_status: Joi.string().optional().allow('', null),
    notes: Joi.string().max(500).optional().allow('', null)
}).options({ stripUnknown: true });

// GET /api/loans — List with pagination & filters
router.get('/', checkPermission('can_view_loans'), async (req, res) => {
    try {
        const { page = 1, limit = 20, status, customerId, startDate, endDate, search, is_najiz_case } = req.query;
        const pageNumber = Math.max(1, parseInt(page, 10) || 1);
        const limitNumber = Math.min(100, parseInt(limit, 10) || 20);
        const offset = (pageNumber - 1) * limitNumber;
        let conds = ['l.merchant_id = $1', 'l.deleted_at IS NULL'];
        let params = [req.merchantId];
        let i = 2;

        if (is_najiz_case === 'true') {
            conds.push('l.is_najiz_case = true');
        }

        if (status) { conds.push(`l.status = $${i++}`); params.push(status); }
        if (req.query.delayed === 'true') {
            conds.push(`l.status = 'Active'`);
            conds.push(`l.created_at < NOW() - INTERVAL '30 days'`);
        }
        if (customerId) { conds.push(`l.customer_id = $${i++}`); params.push(customerId); }
        if (startDate) { conds.push(`l.transaction_date >= $${i++}`); params.push(startDate); }
        if (endDate) { conds.push(`l.transaction_date <= $${i++}`); params.push(endDate); }
        if (search) { conds.push(`(c.full_name ILIKE $${i} OR c.national_id ILIKE $${i})`); params.push(`%${search}%`); i++; }

        const where = conds.join(' AND ');

        const isMockedDb = Boolean(req.dbClient?.query?._isMockFunction);
        const cacheParams = {
            page: pageNumber,
            limit: limitNumber,
            status: status || null,
            customerId: customerId || null,
            startDate: startDate || null,
            endDate: endDate || null,
            search: search || null,
            delayed: req.query.delayed === 'true',
            is_najiz_case: is_najiz_case || null
        };
        const cacheKey = `loans:list:${req.merchantId}:${Buffer.from(JSON.stringify(cacheParams)).toString('base64')}`;
        const useCache = !isMockedDb;
        if (useCache) {
            const cached = await getCache(cacheKey);
            if (cached) {
                res.set('Cache-Control', 'private, max-age=30');
                return res.json(cached);
            }
        }

        const [countRes, dataRes] = await Promise.all([
            req.dbClient.query(`SELECT COUNT(*) FROM loans l LEFT JOIN customers c ON l.customer_id = c.id WHERE ${where}`, params),
            req.dbClient.query(
                `SELECT l.id, l.amount, l.principal_amount, l.profit_percentage, l.receipt_number, l.receipt_image_url,
                        l.status, l.transaction_date, l.created_at, l.notes,
                        c.id AS customer_id, c.full_name AS customer_name,
                        c.national_id, c.mobile_number,
                        l.najiz_case_number, l.najiz_case_amount, l.najiz_status,
                        l.najiz_collected_amount, l.is_najiz_case,
                        l.najiz_plaintiff_name, l.najiz_plaintiff_national_id, l.najiz_raised_date
                 FROM loans l LEFT JOIN customers c ON l.customer_id = c.id
                 WHERE ${where}
                 ORDER BY l.created_at DESC
                 LIMIT $${i} OFFSET $${i + 1}`,
                [...params, limitNumber, offset]
            )
        ]);

        const totalCount = parseInt(countRes.rows[0].count);
        const payload = {
            loans: dataRes.rows.map(enrichLoan),
            pagination: {
                page: pageNumber,
                limit: limitNumber,
                totalCount,
                totalPages: Math.ceil(totalCount / limitNumber)
            }
        };

        const ttlSeconds = Number(process.env.LOANS_LIST_CACHE_TTL || 30);
        if (useCache) {
            await setCache(cacheKey, payload, Number.isFinite(ttlSeconds) ? ttlSeconds : 30);
            res.set('Cache-Control', 'private, max-age=30');
        }
        res.json(payload);
    } catch (err) {
        console.error('Get loans error:', err);
        res.status(500).json({ error: 'Failed to fetch loans' });
    }
});



// POST /api/loans
router.post('/', checkPermission('can_add_loans'), checkPlanLimit('loans'), async (req, res) => {
    try {
        const { error, value } = loanSchema.validate(req.body);
        if (error) return res.status(400).json({ error: error.details[0].message });
        const {
            customerId, amount, principal_amount, profit_percentage,
            receiptNumber, receiptImageUrl, transactionDate, notes, status,
            najiz_case_number, najiz_case_amount, najiz_status, najiz_fee_percentage
        } = value;

        // Ensure customer exists and belongs to merchant
        const check = await db.query('SELECT id FROM customers WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL', [customerId, req.merchantId]);
        if (!check.rows.length) {
            return res.status(404).json({ error: 'العميل غير موجود. تأكد من اختيار العميل بشكل صحيح.' });
        }

        const initialStatus = status || 'Active';
        const isRaised = initialStatus === 'Raised';

        const r = await db.query(
            `INSERT INTO loans (
                merchant_id, customer_id, amount, principal_amount, profit_percentage,
                receipt_number, receipt_image_url, transaction_date, notes, status,
                najiz_case_number, najiz_case_amount, najiz_status, is_najiz_case, najiz_fee_percentage
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [
                req.merchantId, customerId, amount, principal_amount || amount, profit_percentage || 0,
                receiptNumber, receiptImageUrl, transactionDate || new Date(), notes, initialStatus,
                isRaised ? najiz_case_number : null,
                isRaised ? (najiz_case_amount || amount || null) : null,
                isRaised ? najiz_status : null,
                isRaised,
                isRaised ? (najiz_fee_percentage !== undefined ? najiz_fee_percentage : 30) : null
            ]
        );
        await invalidateReportsCache(req.merchantId);
        res.status(201).json({ message: 'Loan created successfully', loan: enrichLoan(r.rows[0]) });
    } catch (err) {
        console.error('Create loan error:', err);
        res.status(500).json({ error: 'Failed to create loan' });
    }
});

// PATCH /api/loans/:id/status
router.patch('/:id/status', checkLoanStatusPermission, async (req, res) => {
    try {
        const { id } = req.params;
        const { status, najiz_collected_amount } = req.body;
        const allowedStatuses = ['Active', 'Paid', 'Raised', 'Cancelled', 'Overdue'];

        if (!status) {
            return res.status(400).json({ error: 'Status is required' });
        }
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة القرض غير صحيحة' });
        }

        // Preserve Najiz history when paid, clear it only when moved back to Active/Cancelled.
        const query = `
            UPDATE loans
            SET
                status = $1::varchar,
                is_najiz_case = CASE
                    WHEN $1::varchar = 'Raised' THEN true
                    WHEN $1::varchar = 'Paid' THEN COALESCE(is_najiz_case, false)
                    ELSE false
                END,
                najiz_raised_date = CASE
                    WHEN $1::varchar = 'Raised' THEN COALESCE(najiz_raised_date, CURRENT_TIMESTAMP)
                    WHEN $1::varchar = 'Paid' THEN najiz_raised_date
                    ELSE NULL
                END,
                najiz_case_number = CASE WHEN $1::varchar IN ('Active', 'Cancelled') THEN NULL ELSE najiz_case_number END,
                najiz_status = CASE WHEN $1::varchar IN ('Active', 'Cancelled') THEN NULL ELSE najiz_status END,
                najiz_case_amount = CASE
                    WHEN $1::varchar IN ('Active', 'Cancelled') THEN NULL
                    WHEN $1::varchar = 'Raised' THEN COALESCE(najiz_case_amount, amount)
                    ELSE najiz_case_amount
                END,
                najiz_fee_percentage = CASE WHEN $1::varchar IN ('Active', 'Cancelled') THEN NULL ELSE najiz_fee_percentage END,
                najiz_plaintiff_name = CASE WHEN $1::varchar IN ('Active', 'Cancelled') THEN NULL ELSE najiz_plaintiff_name END,
                najiz_plaintiff_national_id = CASE WHEN $1::varchar IN ('Active', 'Cancelled') THEN NULL ELSE najiz_plaintiff_national_id END,
                najiz_collected_amount = CASE
                    WHEN $1::varchar = 'Paid' THEN COALESCE($4::numeric, NULLIF(najiz_collected_amount, 0), najiz_case_amount, amount, 0)
                    WHEN $1::varchar IN ('Active', 'Cancelled') THEN 0
                    ELSE najiz_collected_amount
                END
            WHERE id = $2 AND merchant_id = $3
            RETURNING *
        `;

        const collectedAmountParam = najiz_collected_amount !== undefined
            ? Math.max(0, Number(najiz_collected_amount) || 0)
            : null;

        const r = await req.dbClient.query(query, [status, id, req.merchantId, collectedAmountParam]);
        if (r.rows.length === 0) return res.status(404).json({ error: 'Loan not found' });
        await invalidateReportsCache(req.merchantId);
        res.json({ message: 'Status updated successfully', loan: enrichLoan(r.rows[0]) });
    } catch (err) {
        console.error('Update status error:', err);
        if (String(err.message || '').includes('Invalid status transition')) {
            return res.status(400).json({ error: 'الانتقال بين حالتي القرض غير مسموح بهذه الطريقة' });
        }
        res.status(500).json({ error: 'Failed to update status' });
    }
});

// PATCH /api/loans/:id
router.patch('/:id', checkPermission('can_add_loans'), async (req, res) => {
    try {
        const { id } = req.params;
        const {
            amount, principal_amount, profit_percentage, status, notes,
            receiptNumber, receipt_number, transactionDate, transaction_date,
            najiz_case_number, najiz_case_amount, najiz_status,
            najiz_collected_amount, is_najiz_case,
            najiz_plaintiff_name, najiz_plaintiff_national_id, najiz_raised_date
        } = req.body;
        const allowedStatuses = ['Active', 'Paid', 'Raised', 'Cancelled', 'Overdue'];
        if (status !== undefined && !allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'حالة القرض غير صحيحة' });
        }

        const currentLoanRes = await req.dbClient.query(
            `SELECT id, status, is_najiz_case
             FROM loans
             WHERE id = $1 AND merchant_id = $2 AND deleted_at IS NULL`,
            [id, req.merchantId]
        );

        if (currentLoanRes.rows.length === 0) {
            return res.status(404).json({ error: 'Loan not found or unauthorized' });
        }

        const currentLoan = currentLoanRes.rows[0];
        const finalStatus = status !== undefined ? status : currentLoan.status;
        const explicitClearNajiz = status !== undefined && (finalStatus === 'Active' || finalStatus === 'Cancelled');

        // Keep Najiz context for paid cases and partial edits; clear only when explicitly moved to Active/Cancelled.
        const effectiveIsNajizCase = is_najiz_case !== undefined
            ? Boolean(is_najiz_case)
            : (finalStatus === 'Raised'
                ? true
                : (explicitClearNajiz ? false : Boolean(currentLoan.is_najiz_case)));
        const allowNajizFields = !explicitClearNajiz && (
            effectiveIsNajizCase ||
            finalStatus === 'Raised' ||
            (finalStatus === 'Paid' && Boolean(currentLoan.is_najiz_case))
        );

        const updates = [];
        const params = [];
        let i = 1;

        if (amount !== undefined) { updates.push(`amount = $${i++} `); params.push(amount); }
        if (principal_amount !== undefined) { updates.push(`principal_amount = $${i++} `); params.push(principal_amount); }
        if (profit_percentage !== undefined) { updates.push(`profit_percentage = $${i++} `); params.push(profit_percentage); }
        // Accept both camelCase and snake_case keys from frontend.
        const normalizedReceiptNumber = receiptNumber !== undefined ? receiptNumber : receipt_number;
        const normalizedTransactionDate = transactionDate !== undefined ? transactionDate : transaction_date;
        if (normalizedReceiptNumber !== undefined) {
            updates.push(`receipt_number = $${i++} `);
            params.push(normalizedReceiptNumber);
        }
        if (normalizedTransactionDate !== undefined) {
            updates.push(`transaction_date = $${i++} `);
            params.push(normalizedTransactionDate);
        }

        if (status !== undefined) {
            updates.push(`status = $${i++} `);
            params.push(status);
        }

        if (notes !== undefined) { updates.push(`notes = $${i++} `); params.push(notes); }

        if (najiz_case_number !== undefined) {
            updates.push(`najiz_case_number = $${i++} `);
            params.push(allowNajizFields ? najiz_case_number : null);
        }
        if (najiz_case_amount !== undefined) {
            updates.push(`najiz_case_amount = $${i++} `);
            params.push(allowNajizFields ? najiz_case_amount : null);
        }
        if (najiz_status !== undefined) {
            updates.push(`najiz_status = $${i++} `);
            params.push(allowNajizFields ? najiz_status : null);
        }
        if (najiz_collected_amount !== undefined) {
            updates.push(`najiz_collected_amount = $${i++} `);
            const safeCollectedAmount = Math.max(0, Number(najiz_collected_amount) || 0);
            params.push(allowNajizFields ? safeCollectedAmount : 0);
        }
        if (najiz_plaintiff_name !== undefined) {
            updates.push(`najiz_plaintiff_name = $${i++} `);
            params.push(allowNajizFields ? najiz_plaintiff_name : null);
        }
        if (najiz_plaintiff_national_id !== undefined) {
            updates.push(`najiz_plaintiff_national_id = $${i++} `);
            params.push(allowNajizFields ? najiz_plaintiff_national_id : null);
        }
        if (najiz_raised_date !== undefined) {
            updates.push(`najiz_raised_date = $${i++} `);
            params.push(allowNajizFields ? najiz_raised_date : null);
        }

        if (explicitClearNajiz) {
            updates.push('najiz_case_number = NULL');
            updates.push('najiz_case_amount = NULL');
            updates.push('najiz_status = NULL');
            updates.push('najiz_collected_amount = 0');
            updates.push('najiz_plaintiff_name = NULL');
            updates.push('najiz_plaintiff_national_id = NULL');
            updates.push('najiz_raised_date = NULL');
            updates.push('najiz_fee_percentage = NULL');
        }

        if (is_najiz_case !== undefined) {
            updates.push(`is_najiz_case = $${i++} `);
            params.push(Boolean(is_najiz_case));
        } else if (status !== undefined) {
            updates.push(`is_najiz_case = $${i++} `);
            params.push(effectiveIsNajizCase);
        }

        if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

        params.push(id, req.merchantId);
        const result = await req.dbClient.query(
            `UPDATE loans SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
             WHERE id = $${i} AND merchant_id = $${i + 1} AND deleted_at IS NULL RETURNING * `,
            params
        );

        if (result.rows.length === 0) return res.status(404).json({ error: 'Loan not found or unauthorized' });

        await invalidateReportsCache(req.merchantId);
        res.json({ message: 'Loan updated successfully', loan: enrichLoan(result.rows[0]) });
    } catch (err) {
        console.error('Update loan error:', err);
        if (String(err.message || '').includes('Invalid status transition')) {
            return res.status(400).json({ error: 'الانتقال بين حالتي القرض غير مسموح بهذه الطريقة' });
        }
        res.status(500).json({ error: 'Failed to update loan' });
    }
});

// DELETE /api/loans/:id (Redirect to soft delete logic above)
// Already refactored above.

module.exports = router;
