const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists (serverless-safe)
const uploadDir = path.join(process.cwd(), 'uploads/receipts');
try {
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
} catch (err) {
    // In serverless environments, the filesystem may be read-only.
    // Fallback to /tmp which is writable.
    const tmpDir = path.join('/tmp', 'uploads/receipts');
    if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
    }
    module.exports = {
        uploadReceipt: multer({
            storage: multer.diskStorage({
                destination: (req, file, cb) => cb(null, tmpDir),
                filename: (req, file, cb) => {
                    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
                    cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
                }
            }),
            fileFilter: (req, file, cb) => {
                const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
                if (allowedTypes.includes(file.mimetype)) {
                    cb(null, true);
                } else {
                    cb(new Error('نوع الملف غير مدعوم. يرجى رفع صورة أو ملف PDF.'), false);
                }
            },
            limits: { fileSize: 5 * 1024 * 1024 }
        })
    };
    return;
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('نوع الملف غير مدعوم. يرجى رفع صورة أو ملف PDF.'), false);
    }
};

const uploadReceipt = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

module.exports = { uploadReceipt };
