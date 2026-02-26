import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { authAPI } from '../services/api';
import AnimatedBackground from '../components/AnimatedBackground';
import './LoginPage.css';

// ── Password strength calculator ──
function getPasswordStrength(pw) {
    if (!pw) return { score: 0, label: '', color: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    const levels = [
        { label: 'ضعيفة جداً', color: '#EF4444' },
        { label: 'ضعيفة', color: '#F97316' },
        { label: 'متوسطة', color: '#F59E0B' },
        { label: 'جيدة', color: '#22C55E' },
        { label: 'قوية', color: '#10B981' },
        { label: 'ممتازة', color: '#059669' },
    ];
    return { score, ...levels[Math.min(score, levels.length - 1)] };
}

// ── Email validator ──
function validateEmail(email) {
    if (!email) return '';
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!pattern.test(email)) return 'صيغة البريد الإلكتروني غير صحيحة';
    const disposable = ['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com'];
    const domain = email.split('@')[1]?.toLowerCase();
    if (disposable.includes(domain)) return 'لا يمكن استخدام بريد مؤقت';
    return '';
}

// ═══════════════════════════════════════════════════
// OTP Verification Screen
// ═══════════════════════════════════════════════════
function OTPScreen({ sessionId, maskedEmail, onVerified, onBack, setAuth, rememberMe }) {
    const [digits, setDigits] = useState(['', '', '', '', '', '']);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [resending, setResending] = useState(false);
    const [countdown, setCountdown] = useState(300); // 5 minutes
    const [resendCooldown, setResendCooldown] = useState(0);
    const inputRefs = useRef([]);
    const navigate = useNavigate();

    // Countdown timer
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    // Resend cooldown
    useEffect(() => {
        if (resendCooldown <= 0) return;
        const timer = setInterval(() => setResendCooldown(c => c - 1), 1000);
        return () => clearInterval(timer);
    }, [resendCooldown]);

    // Auto-focus first input
    useEffect(() => {
        inputRefs.current[0]?.focus();
    }, []);

    const formatTime = (s) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    };

    const handleDigitChange = useCallback((index, value) => {
        if (!/^\d?$/.test(value)) return;

        setDigits(prev => {
            const next = [...prev];
            next[index] = value;
            return next;
        });
        setError('');

        // Auto-focus next input
        if (value && index < 5) {
            inputRefs.current[index + 1]?.focus();
        }
    }, []);

    const handleKeyDown = useCallback((index, e) => {
        if (e.key === 'Backspace' && !digits[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    }, [digits]);

    const handlePaste = useCallback((e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
        if (pasted.length === 6) {
            setDigits(pasted.split(''));
            inputRefs.current[5]?.focus();
        }
    }, []);

    // Auto-submit when all 6 digits entered
    const code = digits.join('');

    const handleSubmit = useCallback(async () => {
        if (code.length !== 6) {
            setError('أدخل الرمز المكون من 6 أرقام');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await authAPI.verifyOTP(sessionId, code, rememberMe);
            const user = response.data.user || response.data.merchant;
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('merchant', JSON.stringify(user));
            localStorage.setItem('user', JSON.stringify(user));
            setAuth(true);
            navigate('/dashboard');
        } catch (err) {
            const msg = err.response?.data?.error || 'فشل التحقق';
            setError(msg);
            setDigits(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } finally {
            setLoading(false);
        }
    }, [code, sessionId, setAuth, navigate, rememberMe]);

    // Auto-submit on 6 digits
    useEffect(() => {
        if (code.length === 6) {
            handleSubmit();
        }
    }, [code, handleSubmit]);

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        setResending(true);
        try {
            await authAPI.resendOTP(sessionId);
            setCountdown(300);
            setResendCooldown(30);
            setError('');
            setDigits(['', '', '', '', '', '']);
            inputRefs.current[0]?.focus();
        } catch (err) {
            setError(err.response?.data?.error || 'فشل إعادة الإرسال');
        } finally {
            setResending(false);
        }
    };

    return (
        <div className="login-page">
            <AnimatedBackground />
            <div className="login-container glass-card otp-container">
                <div className="otp-header">
                    <div className="otp-icon"></div>
                    <h2>التحقق بخطوتين</h2>
                    <p>أدخل الرمز المرسل إلى</p>
                    <span className="otp-email">{maskedEmail}</span>
                </div>

                {countdown <= 0 ? (
                    <div className="otp-expired">
                        <span className="otp-expired-icon"></span>
                        <p>انتهت صلاحية الرمز</p>
                        <button className="btn-resend" onClick={handleResend} disabled={resending}>
                            {resending ? 'جاري الإرسال...' : 'إرسال رمز جديد'}
                        </button>
                    </div>
                ) : (
                    <>
                        {error && <div className="error-message otp-error">{error}</div>}

                        <div className="otp-digits" onPaste={handlePaste}>
                            {digits.map((d, i) => (
                                <input
                                    key={i}
                                    ref={el => inputRefs.current[i] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={d}
                                    onChange={e => handleDigitChange(i, e.target.value)}
                                    onKeyDown={e => handleKeyDown(i, e)}
                                    className={`otp-digit ${d ? 'otp-digit-filled' : ''}`}
                                    disabled={loading}
                                    autoComplete="one-time-code"
                                />
                            ))}
                        </div>

                        <div className="otp-timer">
                            <span className="timer-icon"></span>
                            <span className={countdown < 60 ? 'timer-urgent' : ''}>
                                {formatTime(countdown)}
                            </span>
                        </div>

                        <button
                            className="submit-btn otp-submit"
                            onClick={handleSubmit}
                            disabled={loading || code.length !== 6}
                        >
                            {loading ? (
                                <span className="otp-loading">
                                    <span className="otp-spinner" />
                                    جاري التحقق...
                                </span>
                            ) : 'تأكيد'}
                        </button>

                        <div className="otp-actions">
                            <button
                                className="btn-resend"
                                onClick={handleResend}
                                disabled={resending || resendCooldown > 0}
                            >
                                {resendCooldown > 0
                                    ? `إعادة إرسال (${resendCooldown}ث)`
                                    : resending ? 'جاري الإرسال...' : ' إعادة إرسال الرمز'}
                            </button>
                            <button className="btn-back" onClick={onBack}>
                                ↩ رجوع لتسجيل الدخول
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════
// Main Login Page
// ═══════════════════════════════════════════════════
function LoginPage({ setAuth }) {
    const [isLogin, setIsLogin] = useState(true);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotMessage, setForgotMessage] = useState('');
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        password: '',
        businessName: '',
        mobile: ''
    });
    const [error, setError] = useState('');
    const [emailError, setEmailError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    useEffect(() => {
        const savedUser = localStorage.getItem('remembered_user');
        if (savedUser) {
            setFormData(prev => ({ ...prev, email: savedUser }));
            setRememberMe(true);
        }
    }, []);

    // 2FA state
    const [otpStep, setOtpStep] = useState(false);
    const [sessionId, setSessionId] = useState('');
    const [maskedEmail, setMaskedEmail] = useState('');

    const navigate = useNavigate();
    const pwStrength = useMemo(() => getPasswordStrength(formData.password), [formData.password]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData({ ...formData, [name]: value });
        if (name === 'email') setEmailError(validateEmail(value));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const emailErr = validateEmail(formData.email);
        if (emailErr) { setEmailError(emailErr); return; }
        if (!isLogin && formData.password.length < 8) {
            setError('كلمة المرور يجب أن تكون 8 أحرف على الأقل');
            return;
        }

        setLoading(true);

        try {
            let response;
            if (isLogin) {
                // Use formData.email as identifier (it can be username or email)
                response = await authAPI.login(formData.email, formData.password, rememberMe);

                // ── 2FA: Check if OTP is required ──
                if (response.data.requires2FA) {
                    setSessionId(response.data.sessionId);
                    setMaskedEmail(response.data.email);
                    setOtpStep(true);
                    setLoading(false);
                    return;
                }

                // Direct login (fallback)
                const user = response.data.user || response.data.merchant;
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('merchant', JSON.stringify(user));
                localStorage.setItem('user', JSON.stringify(user));
                if (rememberMe) {
                    localStorage.setItem('remembered_user', formData.email);
                } else {
                    localStorage.removeItem('remembered_user');
                }
                setAuth(true);
                navigate('/dashboard');
            } else {
                response = await authAPI.register({
                    username: formData.username,
                    businessName: formData.businessName,
                    email: formData.email,
                    password: formData.password,
                    mobile: formData.mobile
                });

                const user = response.data.user || response.data.merchant;
                localStorage.setItem('token', response.data.token);
                localStorage.setItem('merchant', JSON.stringify(user));
                localStorage.setItem('user', JSON.stringify(user));
                setShowSuccess(true);
                setTimeout(() => {
                    setAuth(true);
                    navigate('/dashboard');
                }, 1500);
            }
        } catch (err) {
            const msg = err.response?.data?.error || err.message || 'حدث خطأ. حاول مرة أخرى';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleRedirect = () => {
        window.location.href = authAPI.getGoogleAuthUrl();
    };

    // ── 2FA OTP Screen ──
    if (otpStep) {
        return (
            <OTPScreen
                sessionId={sessionId}
                maskedEmail={maskedEmail}
                setAuth={setAuth}
                rememberMe={rememberMe}
                onBack={() => {
                    setOtpStep(false);
                    setSessionId('');
                    setMaskedEmail('');
                }}
            />
        );
    }

    // ── Registration Success ──
    if (showSuccess) {
        return (
            <div className="login-page">
                <AnimatedBackground />
                <div className="login-container glass-card success-container">
                    <div className="success-animation">
                        <div className="success-check"></div>
                        <h2>تم إنشاء الحساب بنجاح! </h2>
                        <p>جاري تحويلك للوحة التحكم...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <AnimatedBackground />

            <div className="login-container glass-card">
                <div className="login-header">
                    <div className="login-logo glass">
                        <span className="logo-text">أ</span>
                    </div>
                    <h1>{isLogin ? 'مرحباً بعودتك' : 'إنشاء حساب جديد'}</h1>
                    <p>{isLogin ? 'سجل دخولك للمتابعة' : 'ابدأ رحلتك معنا اليوم'}</p>
                </div>

                <div className="login-tabs">
                    <button
                        className={isLogin ? 'active' : ''}
                        onClick={() => { setIsLogin(true); setError(''); setEmailError(''); }}
                    >
                        تسجيل دخول
                    </button>
                    <button
                        className={!isLogin ? 'active' : ''}
                        onClick={() => { setIsLogin(false); setError(''); setEmailError(''); }}
                    >
                        حساب جديد
                    </button>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label>اسم المستخدم</label>
                                <input
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    placeholder="مثال: ahmed123"
                                    required
                                    pattern="^[A-Za-z0-9_]{3,30}$"
                                    title="يجب أن يحتوي على أحرف وأرقام إنجليزية فقط، من 3 إلى 30 حرف"
                                />
                            </div>
                            <div className="form-group">
                                <label>اسم المتجر / الشركة</label>
                                <input
                                    type="text"
                                    name="businessName"
                                    value={formData.businessName}
                                    onChange={handleChange}
                                    placeholder="مثال: متجر الرياض"
                                    required
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label>{isLogin ? 'البريد الإلكتروني أو اسم المستخدم' : 'البريد الإلكتروني'}</label>
                        <input
                            type={isLogin ? "text" : "email"}
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder={isLogin ? "user@example.com أو username" : "name@company.com"}
                            required
                            className={emailError ? 'input-error' : ''}
                        />
                        {emailError && <span className="field-error">{emailError}</span>}
                    </div>

                    {!isLogin && (
                        <div className="form-group">
                            <label>رقم الجوال</label>
                            <input
                                type="tel"
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleChange}
                                placeholder="05XXXXXXXX"
                                required
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label>كلمة المرور</label>
                        <input
                            type="password"
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="••••••••"
                            required
                            minLength={8}
                        />
                        {formData.password && (
                            <div className="pw-strength">
                                <div className="pw-bar-track">
                                    <div
                                        className="pw-bar-fill"
                                        style={{
                                            width: `${(pwStrength.score / 5) * 100}%`,
                                            background: pwStrength.color,
                                        }}
                                    />
                                </div>
                                <span className="pw-label" style={{ color: pwStrength.color }}>
                                    {pwStrength.label}
                                </span>
                            </div>
                        )}
                        {isLogin && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#94A3B8', fontSize: '14px' }}>
                                    <input
                                        type="checkbox"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        style={{ accentColor: '#3B82F6', width: '16px', height: '16px' }}
                                    />
                                    <span>تذكرني</span>
                                </label>
                                <button type="button" onClick={() => setShowForgotPassword(true)} className="forgot-password-link" style={{ margin: 0 }}>
                                    نسيت كلمة المرور؟
                                </button>
                            </div>
                        )}
                    </div>

                    <button type="submit" className="submit-btn" disabled={loading || !!emailError}>
                        {loading ? 'جاري المعالجة...' : (isLogin ? 'دخول' : 'تسجيل')}
                    </button>
                </form>

            </div>

            {/* Forgot Password Modal */}
            {showForgotPassword && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
                    <div className="modal-content glass-card" style={{ maxWidth: 400, padding: 30, borderRadius: 16 }}>
                        <h2 style={{ marginTop: 0 }}>استعادة كلمة المرور</h2>
                        <p style={{ marginBottom: 20, color: '#94A3B8', fontSize: '14px', lineHeight: 1.6 }}>أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة التعيين.</p>
                        <form onSubmit={async (e) => {
                            e.preventDefault();
                            setLoading(true);
                            try {
                                const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/forgot-password`, { email: forgotEmail });
                                setForgotMessage({ type: 'success', text: res.data.message });
                            } catch (err) {
                                setForgotMessage({ type: 'error', text: err.response?.data?.error || 'حدث خطأ' });
                            } finally {
                                setLoading(false);
                            }
                        }}>
                            <div className="form-group">
                                <input
                                    type="email"
                                    placeholder="البريد الإلكتروني"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    required
                                />
                            </div>
                            {forgotMessage && <div className={`message ${forgotMessage.type}`} style={{ marginBottom: 10 }}>{forgotMessage.text}</div>}
                            <div className="form-actions" style={{ marginTop: 20, gap: 10, display: 'flex' }}>
                                <button type="submit" className="submit-btn" style={{ flex: 1, padding: '12px', fontSize: '16px' }} disabled={loading}>{loading ? 'جاري...' : 'إرسال الرابط'}</button>
                                <button type="button" className="btn-secondary" onClick={() => setShowForgotPassword(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }} disabled={loading}>إلغاء</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}

export default LoginPage;
