'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function RegisterPage() {
    const { register, isRegistering } = useAuth();
    const [formData, setFormData] = useState({
        businessName: '',
        username: '',
        email: '',
        mobile: '',
        password: ''
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        register(formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    return (
        <section className="glass-card auth-card">
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight dark:text-slate-50">إنشاء حساب جديد</h1>
            <p className="text-slate-700 mb-8 font-semibold dark:text-slate-200">ابدأ رحلتك معنا اليوم</p>

            <div className="auth-switch" role="tablist" aria-label="التنقل بين الدخول والتسجيل">
                <Link href="/login" className="auth-switch-link" role="tab" aria-selected={false}>تسجيل دخول</Link>
                <button type="button" className="auth-switch-active" role="tab" aria-selected={true}>حساب جديد</button>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-5" noValidate>
                <div className="space-y-1.5">
                    <label htmlFor="username" className="text-sm font-bold text-slate-800 mr-2 dark:text-slate-100">اسم المستخدم</label>
                    <input
                        id="username"
                        name="username"
                        type="text"
                        placeholder="مثال: ahmed123"
                        required
                        autoComplete="username"
                        className="field-control"
                        onChange={handleChange}
                        disabled={isRegistering}
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="businessName" className="text-sm font-bold text-slate-800 mr-2 dark:text-slate-100">اسم المتجر / الشركة</label>
                    <input
                        id="businessName"
                        name="businessName"
                        type="text"
                        placeholder="مثال: متجر الرياض"
                        required
                        autoComplete="organization"
                        className="field-control"
                        onChange={handleChange}
                        disabled={isRegistering}
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="email" className="text-sm font-bold text-slate-800 mr-2 dark:text-slate-100">البريد الإلكتروني</label>
                    <input
                        id="email"
                        name="email"
                        type="email"
                        placeholder="name@company.com"
                        required
                        autoComplete="email"
                        className="field-control"
                        onChange={handleChange}
                        disabled={isRegistering}
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="mobile" className="text-sm font-bold text-slate-800 mr-2 dark:text-slate-100">رقم الجوال</label>
                    <input
                        id="mobile"
                        name="mobile"
                        type="tel"
                        placeholder="05xxxxxxxx"
                        required
                        autoComplete="tel"
                        inputMode="tel"
                        className="field-control"
                        onChange={handleChange}
                        disabled={isRegistering}
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor="password" className="text-sm font-bold text-slate-800 mr-2 dark:text-slate-100">كلمة المرور</label>
                    <input
                        id="password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        required
                        autoComplete="new-password"
                        className="field-control"
                        onChange={handleChange}
                        disabled={isRegistering}
                    />
                </div>

                <button
                    type="submit"
                    className="btn-premium-primary action-btn w-full text-lg justify-center mt-6"
                    disabled={isRegistering}
                    aria-busy={isRegistering}
                >
                    {isRegistering ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
                </button>
            </form>

            <p className="mt-6 text-xs text-slate-600 text-center font-semibold leading-relaxed dark:text-slate-300">
                بإنشائك للحساب، فأنت توافق على <Link href="/terms" className="text-coral underline">الشروط والأحكام</Link> و <Link href="/privacy" className="text-coral underline">سياسة الخصوصية</Link>
            </p>
        </section>
    );
}
