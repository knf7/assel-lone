import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import AnimatedBackground from '../components/AnimatedBackground';
import './LoginPage.css'; // Reuse login styling

function ResetPasswordPage() {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const navigate = useNavigate();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage({ type: '', text: '' });

        if (password !== confirmPassword) {
            return setMessage({ type: 'error', text: 'كلمتا المرور غير متطابقتين' });
        }
        if (password.length < 8) {
            return setMessage({ type: 'error', text: 'يجب أن تكون كلمة المرور 8 خانات على الأقل' });
        }

        setLoading(true);
        try {
            const res = await axios.post(`${process.env.REACT_APP_API_URL || 'http://localhost:3001/api'}/auth/reset-password`, {
                token,
                newPassword: password
            });
            setMessage({ type: 'success', text: res.data.message });
            setTimeout(() => navigate('/login'), 3000);
        } catch (err) {
            setMessage({ type: 'error', text: err.response?.data?.error || 'حدث خطأ غير متوقع' });
        } finally {
            setLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="login-page">
                <AnimatedBackground />
                <div className="login-container glass-card" style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#EF4444' }}>رابط غير صالح</h2>
                    <p>هذا الرابط غير صالح أو انتهت صلاحيته.</p>
                    <button className="submit-btn" onClick={() => navigate('/login')} style={{ marginTop: '20px' }}>
                        العودة لتسجيل الدخول
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="login-page">
            <AnimatedBackground />
            <div className="login-container glass-card">
                <div className="login-header">
                    <h2>إعادة تعيين كلمة المرور</h2>
                    <p>أدخل كلمة مرور جديدة قوية وآمنة لمتجرك</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>كلمة المرور الجديدة</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>تأكيد كلمة المرور</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    {message.text && (
                        <div className={`error-message`} style={{
                            background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : undefined,
                            color: message.type === 'success' ? '#10B981' : undefined,
                            borderColor: message.type === 'success' ? 'rgba(34, 197, 94, 0.3)' : undefined
                        }}>
                            {message.text}
                        </div>
                    )}

                    <button type="submit" className="submit-btn" disabled={loading}>
                        {loading ? 'جاري المعالجة...' : 'تحديث كلمة المرور'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default ResetPasswordPage;
