import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
    const navigate = useNavigate();

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'var(--bg)',
            fontFamily: 'var(--font-family)',
            direction: 'rtl',
            padding: '20px',
            textAlign: 'center',
        }}>
            <div style={{ maxWidth: 480 }}>
                {/* Large 404 */}
                <div style={{
                    fontSize: 'clamp(80px, 20vw, 140px)',
                    fontWeight: 900,
                    lineHeight: 1,
                    background: 'linear-gradient(135deg, #FF7043, #E64A19)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    marginBottom: '8px',
                    userSelect: 'none',
                }}>
                    404
                </div>

                {/* Icon */}
                <div style={{
                    fontSize: '48px',
                    marginBottom: '16px',
                    animation: 'pulse-glow 2s infinite',
                }}>
                    🔍
                </div>

                <h1 style={{
                    fontSize: '24px',
                    fontWeight: 800,
                    color: 'var(--text-primary)',
                    marginBottom: '12px',
                }}>
                    الصفحة غير موجودة
                </h1>

                <p style={{
                    fontSize: '15px',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.7,
                    marginBottom: '32px',
                }}>
                    عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
                    يُرجى التحقق من صحة الرابط أو العودة إلى الصفحة الرئيسية.
                </p>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                        className="btn btn-primary"
                        onClick={() => navigate('/dashboard')}
                        style={{ padding: '12px 24px', fontSize: '15px' }}
                    >
                        🏠 العودة للرئيسية
                    </button>
                    <button
                        className="btn btn-secondary"
                        onClick={() => navigate(-1)}
                        style={{ padding: '12px 24px', fontSize: '15px' }}
                    >
                        ↩ الصفحة السابقة
                    </button>
                </div>

                {/* Help text */}
                <p style={{
                    marginTop: '40px',
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                }}>
                    إذا استمرت المشكلة، تواصل مع{' '}
                    <a
                        href="mailto:support@aseel.sa"
                        style={{ color: 'var(--coral)', textDecoration: 'underline' }}
                    >
                        فريق الدعم
                    </a>
                </p>
            </div>
        </div>
    );
}
