const nodemailer = require('nodemailer');
const path = require('path');

let transporter = null;

/**
 * Initialize mailer.
 * In development: uses Ethereal (fake SMTP) and logs preview URL.
 * In production: uses real SMTP from env vars.
 */
async function getTransporter() {
    if (transporter) return transporter;

    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        // Production SMTP
        console.log(`📡 Initializing Real SMTP: ${process.env.SMTP_HOST} (${process.env.SMTP_USER})`);
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '587', 10),
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Development: Ethereal
        const testAccount = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
                user: testAccount.user,
                pass: testAccount.pass,
            },
        });
        console.log('📧 Ethereal mail account:', testAccount.user);
    }

    return transporter;
}

/**
 * Send OTP verification email.
 * @param {string} to      Recipient email
 * @param {string} code    6-digit OTP
 */
async function sendOTPEmail(to, code) {
    const transport = await getTransporter();

    const html = `
    <div dir="rtl" style="font-family: 'Cairo', 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 30px; background: linear-gradient(135deg, #0B1121 0%, #1A2B4A 100%); border-radius: 16px; color: #E2E8F0;">
        <div style="text-align: center; margin-bottom: 24px;">
            <div style="display: inline-block; width: 60px; height: 60px; border-radius: 16px; background: linear-gradient(135deg, #E8633A, #FF8C61); line-height: 60px; font-size: 28px; font-weight: 800; color: #fff;">أ</div>
        </div>
        <h2 style="text-align: center; color: #fff; margin: 0 0 8px; font-size: 22px;">رمز التحقق</h2>
        <p style="text-align: center; color: #94A3B8; margin: 0 0 24px; font-size: 14px;">أدخل الرمز التالي لإتمام تسجيل الدخول</p>
        <div style="text-align: center; padding: 20px; background: rgba(255,255,255,0.06); border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 20px;">
            <span style="font-size: 36px; font-weight: 800; letter-spacing: 12px; color: #E8633A; font-family: monospace;">${code}</span>
        </div>
        <p style="text-align: center; color: #64748B; font-size: 12px; margin: 0;">⏱ ينتهي الرمز خلال 5 دقائق</p>
        <hr style="border: none; border-top: 1px solid rgba(255,255,255,0.06); margin: 24px 0;">
        <p style="text-align: center; color: #475569; font-size: 11px; margin: 0;">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
    </div>
    `;

    const info = await transport.sendMail({
        from: `"أصيل المالي" <${process.env.SMTP_FROM || 'noreply@aseel.sa'}>`,
        to,
        subject: `🔐 رمز التحقق: ${code}`,
        html,
    });

    // In dev mode, log the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
        console.log('──────────────────────────────────');
        console.log(`📧 OTP Email Preview: ${previewUrl}`);
        console.log(`🔑 OTP Code: ${code}`);
        console.log('──────────────────────────────────');
    }

    return info;
}

/**
 * Send Admin Notification Email on new subscription request.
 * @param {string} businessName 
 * @param {string} email 
 * @param {string} plan 
 * @param {string} [receiptPath] Optional path to the receipt file to attach
 */
async function sendAdminNotificationEmail(businessName, email, plan, receiptPath) {
    const transport = await getTransporter();

    // Default to sending to the configured admin email or the SMTP User itself
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER || 'admin@aseel.sa';

    const html = `
    <div dir="rtl" style="font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 30px; background: #0B1121; color: #E2E8F0;">
        <h2 style="color: #FF8C61;">طلب ترقية باقة جديد 🚀</h2>
        <p>مرحباً أيها المدير،</p>
        <p>التاجر <strong>${businessName}</strong> قدم طلباً لترقية اشتراكه إلى باقة <strong>${plan}</strong>.</p>
        <p>البريد الإلكتروني للتاجر: ${email}</p>
        <p>مرفق مع هذه الرسالة إيصال التحويل البنكي للمراجعة.</p>
        <p>يرجى الدخول للوحة التحكم لتأكيد الطلب أو رفضه.</p>
    </div>`;

    const mailOptions = {
        from: `"Aseel Admin" <${process.env.SMTP_FROM || 'noreply@aseel.sa'}>`,
        to: adminEmail,
        subject: '🚀 أصيل المالي - طلب اشتراك جديد',
        html,
    };

    if (receiptPath) {
        const ext = path.extname(receiptPath) || '.png';
        mailOptions.attachments = [
            {
                filename: `receipt${ext}`,
                path: receiptPath
            }
        ];
    }

    await transport.sendMail(mailOptions);
}

/**
 * Send Reset Password Email.
 * @param {string} to 
 * @param {string} resetLink 
 */
async function sendResetPasswordEmail(to, resetLink) {
    const transport = await getTransporter();

    const html = `
    <div dir="rtl" style="font-family: 'Cairo', 'Segoe UI', sans-serif; padding: 30px; background: #0B1121; color: #E2E8F0; text-align: center;">
        <h2 style="color: #FF8C61;">استعادة كلمة المرور 🔐</h2>
        <p>لقد طلبنا إعادة تعيين كلمة المرور لحسابك في أصيل المالي.</p>
        <a href="${resetLink}" style="display: inline-block; padding: 12px 24px; background: #E8633A; color: #fff; text-decoration: none; border-radius: 8px; margin: 20px 0;">اضغط هنا لتعيين كلمة مرور جديدة</a>
        <p>إذا لم تطلب هذا التغيير، تجاهل هذه الرسالة ولا تقلق، حسابك بأمان.</p>
        <p style="color: #64748B; font-size: 12px;">صلاحية هذا الرابط 30 دقيقة فقط.</p>
    </div>`;

    const info = await transport.sendMail({
        from: `"أصيل المالي" <${process.env.SMTP_FROM || 'noreply@aseel.sa'}>`,
        to,
        subject: '🔐 استعادة كلمة المرور - أصيل المالي',
        html,
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
        console.log('──────────────────────────────────');
        console.log(`📧 Password Reset Preview URL: ${previewUrl}`);
        console.log('──────────────────────────────────');
    }

    return info;
}

module.exports = {
    sendOTPEmail,
    sendAdminNotificationEmail,
    sendResetPasswordEmail
};
