'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function LoginPage() {
    const { login, isLoggingIn } = useAuth();
    const [formData, setFormData] = useState({
        identifier: '',
        password: '',
        rememberMe: false
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        login(formData);
    };

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, rememberMe: e.target.checked }));
    };

    return (
        <section className="glass-card auth-card">
            {/* Logo placeholder if needed */}
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight dark:text-slate-50">مرحباً بعودتك</h1>
            <p className="text-slate-700 mb-8 font-semibold dark:text-slate-200">سجل دخولك للمتابعة</p>

            <div className="auth-switch" role="tablist" aria-label="التنقل بين الدخول والتسجيل">
                <button type="button" role="tab" aria-selected={true} className="auth-switch-active">تسجيل دخول</button>
                <Link href="/register" className="auth-switch-link" role="tab" aria-selected={false}>حساب جديد</Link>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-6" noValidate>
                <div className="space-y-2">
                    <label htmlFor="identifier" className="text-sm font-bold text-slate-800 mr-2 dark:text-slate-100">البريد الإلكتروني أو اسم المستخدم</label>
                    <input
                        id="identifier"
                        name="identifier"
                        type="text"
                        placeholder="username أو user@example.com"
                        required
                        autoComplete="username"
                        className="field-control"
                        onChange={handleTextChange}
                        disabled={isLoggingIn}
                    />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                        <label htmlFor="password" className="text-sm font-bold text-slate-800 dark:text-slate-100">كلمة المرور</label>
                    </div>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                        className="field-control"
                        onChange={handleTextChange}
                        disabled={isLoggingIn}
                    />
                </div>

                <div className="flex items-center justify-between w-full px-2 text-sm">
                    <Link href="/forgot-password" title="استعادة كلمة المرور" className="font-bold text-slate-800 hover:text-coral transition-colors underline decoration-dotted dark:text-slate-200">نسيت كلمة المرور؟</Link>
                    <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-semibold dark:text-slate-200">
                        تذكرني
                        <input
                            type="checkbox"
                            checked={formData.rememberMe}
                            onChange={handleRememberMeChange}
                            className="w-4 h-4 rounded border-slate-300 text-coral focus:ring-coral"
                            aria-label="تذكر تسجيل الدخول"
                        />
                    </label>
                </div>

                <button
                    type="submit"
                    className="btn-premium-primary action-btn w-full text-lg justify-center mt-4"
                    disabled={isLoggingIn}
                    aria-busy={isLoggingIn}
                >
                    {isLoggingIn ? 'جاري الدخول...' : 'دخول'}
                </button>
            </form>

        </section>
    );
}
