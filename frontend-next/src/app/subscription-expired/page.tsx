'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
// import { useClerk } from '@clerk/nextjs';
import AnimatedBackground from '@/components/layout/AnimatedBackground';

export default function SubscriptionExpiredPage() {
    const router = useRouter();
    // const { signOut } = useClerk();

    return (
        <div className="min-h-screen relative flex items-center justify-center p-4 bg-slate-50 font-sans" dir="rtl">
            <AnimatedBackground />

            <div className="glass-card p-10 flex flex-col items-center w-full max-w-md relative z-10 text-center shadow-xl border border-white/40">
                <div className="w-20 h-20 bg-coral/10 text-coral rounded-full flex items-center justify-center mb-6 shadow-sm border border-coral/20">
                    <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>

                <h1 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">انتهى اشتراكك</h1>
                <p className="text-slate-600 mb-8 font-medium leading-relaxed">
                    باقتك التجريبية أو الحالية انتهت صلاحيتها.<br />
                    يرجى تجديد الاشتراك للاستمرار في استخدام المنصة بشكل كامل.
                </p>

                <div className="w-full space-y-4">
                    <button
                        onClick={() => router.push('/pricing')}
                        className="btn-premium-primary w-full py-4 text-base justify-center shadow-md border border-white/20"
                    >
                        تجديد الاشتراك
                    </button>

                    <button
                        onClick={() => { localStorage.clear(); router.push('/login'); }}
                        className="w-full py-4 text-slate-600 bg-white/60 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 transition-all font-bold rounded-2xl shadow-sm text-base"
                    >
                        تسجيل الخروج
                    </button>
                </div>
            </div>
        </div>
    );
}
