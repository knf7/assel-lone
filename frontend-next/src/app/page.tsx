'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ShieldCheck, BarChart3, Scale, ArrowLeft } from 'lucide-react';

function MiniLogo() {
  return (
    <div className="w-10 h-10 rounded-[0.8rem] bg-gradient-to-b from-[#8ab4f8] to-[#60a5fa] border-2 border-slate-200 shadow-sm p-1.5 flex items-end justify-center gap-1" dir="ltr">
      <div className="w-1.5 h-[60%] bg-white rounded-full" />
      <div className="w-1.5 h-[80%] bg-white rounded-full" />
      <div className="flex flex-col items-center justify-end h-full gap-0.5">
        <div className="w-1.5 h-1.5 bg-white rounded-full" />
        <div className="w-1.5 h-[40%] bg-white rounded-full" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [activePillar, setActivePillar] = useState<number | null>(null);
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      id: 0,
      title: 'تكامل مع ناجز',
      description: 'تتبع القضايا المرفوعة والمبالغ المحصلة عبر منصة ناجز مباشرة من لوحة التحكم الخاصة بك.',
      icon: Scale,
    },
    {
      id: 1,
      title: 'إدارة آمنة للعملاء',
      description: 'سجل متكامل لكل عميل، تتبع الدفعات المتأخرة، وإدارة ملفاتهم بأعلى معايير الأمان والثقة.',
      icon: ShieldCheck,
    },
    {
      id: 2,
      title: 'تحليلات ورؤى ذكية',
      description: 'رسوم بيانية وإحصائيات دقيقة لحركة الأموال، نسب التحصيل، والمبالغ المعلقة لاتخاذ قرارات أفضل.',
      icon: BarChart3,
    },
  ];

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 font-sans text-slate-800 selection:bg-blue-200">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="flex items-center gap-3">
              <MiniLogo />
              <span className="font-bold text-2xl text-slate-900 tracking-tight">أصيل المالي</span>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
              <a href="#features" className="hover:text-blue-600 transition-colors">المميزات</a>
              <a href="#how-it-works" className="hover:text-blue-600 transition-colors">آلية العمل</a>
              <a href="#pricing" className="hover:text-blue-600 transition-colors">الباقات</a>
            </div>

            <div className="flex items-center gap-4">
              <Link href="/login" className="hidden sm:block text-slate-600 hover:text-slate-900 font-medium text-sm transition-colors">
                تسجيل الدخول
              </Link>
              <Link href="/register" className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium text-sm transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2">
                ابدأ مجاناً
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-1/2 translate-x-1/2 w-[800px] h-[400px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none -z-10" />

        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white border border-slate-200 text-slate-700 text-sm font-medium mb-8 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
            </span>
            إدارة ذكية للعملاء والمعاملات المالية
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.2] mb-6">
            أدر عملائك <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-l from-blue-600 to-blue-400">
              بذكاء وسلاسة
            </span>
          </h1>

          <p className="max-w-2xl mx-auto text-lg text-slate-600 mb-14 leading-relaxed">
            المنصة المتكاملة لإدارة العملاء، تتبع القروض، والربط المباشر مع الأنظمة لضمان حقوقك. تخلص من التعقيد وانتقل
            للإدارة الرقمية مع أصيل المالي.
          </p>

          <div className="flex justify-center mb-20 mt-10">
            <div
              className="relative w-[280px] h-[280px] md:w-[340px] md:h-[340px] rounded-[3rem] md:rounded-[4rem] bg-gradient-to-br from-[#8ab4f8] to-[#5b95ea] p-8 flex items-end justify-center gap-4 md:gap-6 transition-all duration-500 hover:scale-105 group cursor-default"
              style={{
                boxShadow:
                  '0 0 0 6px rgba(255, 255, 255, 0.6), 0 0 0 16px rgba(138, 180, 248, 0.15), 0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                border: '1px solid rgba(255,255,255,0.8)',
              }}
              dir="ltr"
              onMouseLeave={() => setActivePillar(null)}
            >
              <div className="relative flex flex-col items-center justify-end h-full w-12 md:w-16 cursor-pointer" onMouseEnter={() => setActivePillar(1)}>
                <div
                  className={`absolute -top-14 transition-all duration-400 ease-out z-10 ${
                    activePillar === 1 ? 'opacity-100 -translate-y-4 scale-110' : 'opacity-0 translate-y-0 scale-95'
                  }`}
                >
                  <span className="bg-white/90 text-blue-600 font-bold px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm whitespace-nowrap text-lg">كفاءة</span>
                </div>
                <div className={`w-10 md:w-12 bg-white rounded-full transition-all duration-500 ease-out shadow-inner ${activePillar === 1 ? 'h-[65%] bg-blue-50 scale-x-105' : 'h-[50%]'}`} />
              </div>

              <div className="relative flex flex-col items-center justify-end h-full w-12 md:w-16 cursor-pointer" onMouseEnter={() => setActivePillar(2)}>
                <div
                  className={`absolute -top-14 transition-all duration-400 ease-out z-10 ${
                    activePillar === 2 ? 'opacity-100 -translate-y-4 scale-110' : 'opacity-0 translate-y-0 scale-95'
                  }`}
                >
                  <span className="bg-white/90 text-blue-600 font-bold px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm whitespace-nowrap text-lg">تحاليل</span>
                </div>
                <div className={`w-10 md:w-12 bg-white rounded-full transition-all duration-500 ease-out shadow-inner ${activePillar === 2 ? 'h-[85%] bg-blue-50 scale-x-105' : 'h-[75%]'}`} />
              </div>

              <div
                className="relative flex flex-col items-center justify-end h-full w-12 md:w-16 cursor-pointer gap-2 md:gap-2.5"
                onMouseEnter={() => setActivePillar(3)}
              >
                <div
                  className={`absolute -top-14 transition-all duration-400 ease-out z-10 ${
                    activePillar === 3 ? 'opacity-100 -translate-y-4 scale-110' : 'opacity-0 translate-y-0 scale-95'
                  }`}
                >
                  <span className="bg-white/90 text-blue-600 font-bold px-4 py-2 rounded-xl shadow-lg backdrop-blur-sm whitespace-nowrap text-lg">ثقة</span>
                </div>
                <div className={`w-10 md:w-12 h-10 md:h-12 bg-white rounded-full transition-all duration-500 ease-out shadow-inner ${activePillar === 3 ? '-translate-y-3 bg-blue-50 scale-105' : ''}`} />
                <div className={`w-10 md:w-12 bg-white rounded-full transition-all duration-500 ease-out shadow-inner ${activePillar === 3 ? 'h-[45%] bg-blue-50 scale-x-105' : 'h-[35%]'}`} />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
            <Link href="/register" className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white px-8 py-3.5 rounded-xl font-medium text-lg transition-all shadow-xl shadow-slate-900/20 text-center">
              ابدأ تجربتك الآن
            </Link>
            <a href="#features" className="w-full sm:w-auto bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 px-8 py-3.5 rounded-xl font-medium text-lg transition-all text-center">
              تعرف على المزيد
            </a>
          </div>
        </div>
      </section>

      <section id="features" className="py-32 bg-slate-50 border-t border-slate-100 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">كل ما تحتاجه لإدارة أعمالك المالية</h2>
            <p className="text-slate-600 text-lg">صممنا أصيل المالي لتغطي كافة جوانب إدارة العملاء والمطالبات في مكان واحد.</p>
          </div>

          <div className="relative w-full h-[450px] md:h-[500px] flex justify-center items-center">
            {features.map((feature, index) => {
              const isActive = activeFeature === index;
              const Icon = feature.icon;

              const cardStyles = [
                {
                  gradient: 'from-[#3b82f6] to-[#1e3a8a]',
                  position: 'translate-x-[60px] md:translate-x-[120px] rotate-[12deg] translate-y-4 md:translate-y-8',
                  liftPosition: 'translate-x-[70px] md:translate-x-[140px] -translate-y-[10px] md:-translate-y-[20px] rotate-[4deg]',
                },
                {
                  gradient: 'from-[#10b981] to-[#064e3b]',
                  position: 'translate-x-0 rotate-0 translate-y-0',
                  liftPosition: 'translate-x-0 -translate-y-[30px] md:-translate-y-[40px] rotate-0',
                },
                {
                  gradient: 'from-[#f97316] to-[#7c2d12]',
                  position: '-translate-x-[60px] md:-translate-x-[120px] -rotate-[12deg] translate-y-4 md:translate-y-8',
                  liftPosition: '-translate-x-[70px] md:-translate-x-[140px] -translate-y-[10px] md:-translate-y-[20px] -rotate-[4deg]',
                },
              ];

              const baseStyle = cardStyles[index];
              const transformStyle = isActive
                ? `${baseStyle.liftPosition} scale-[1.05] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.6)] z-50`
                : `${baseStyle.position} scale-95 opacity-90 hover:opacity-100 hover:-translate-y-2 hover:scale-[0.98] shadow-2xl z-10`;

              return (
                <div
                  key={feature.id}
                  className={`absolute top-1/2 left-1/2 origin-bottom transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] ${transformStyle} cursor-pointer w-[260px] md:w-[280px] h-[360px] md:h-[400px] -ml-[130px] md:-ml-[140px] -mt-[180px] md:-mt-[200px]`}
                  onClick={() => setActiveFeature(index)}
                >
                  <div className="w-full h-full rounded-[2rem] bg-white p-2.5 shadow-xl transition-all duration-300">
                    <div className={`w-full h-full rounded-[1.5rem] bg-gradient-to-br ${baseStyle.gradient} p-5 text-white relative overflow-hidden group`}>
                      <div className="absolute inset-0 opacity-[0.05] bg-[radial-gradient(circle_at_center,white_1px,transparent_1px)] bg-[length:12px_12px] pointer-events-none" />
                      <div className="absolute inset-2 border border-white/20 rounded-[1.2rem] pointer-events-none" />

                      <div className="absolute top-4 right-4 flex flex-col items-center opacity-80">
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold tracking-wider">{feature.title.split(' ')[0]}</span>
                      </div>

                      <div className={`flex-1 flex flex-col items-center justify-center h-full text-center px-2 transition-all duration-500 ${isActive ? 'scale-100' : 'scale-95 opacity-80 group-hover:opacity-100'}`}>
                        <div className="w-14 h-14 md:w-16 md:h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-4 md:mb-6 shadow-lg border border-white/30">
                          <Icon className="w-7 h-7 md:w-8 md:h-8 text-white drop-shadow-md" />
                        </div>
                        <h3 className="text-xl md:text-2xl font-bold mb-3 drop-shadow-md">{feature.title}</h3>
                        <p className={`text-white/90 text-xs md:text-sm leading-relaxed drop-shadow-sm transition-all duration-300 ${isActive ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}>
                          {feature.description}
                        </p>
                      </div>

                      <div className="absolute bottom-4 left-4 flex flex-col items-center opacity-80 rotate-180">
                        <Icon className="w-5 h-5 mb-1" />
                        <span className="text-[10px] font-bold tracking-wider">{feature.title.split(' ')[0]}</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <footer className="bg-slate-50 border-t border-slate-200 pt-16 pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div className="col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <MiniLogo />
                <span className="font-bold text-xl text-slate-900">أصيل المالي</span>
              </div>
              <p className="text-slate-500 max-w-sm">النظام الأذكى لإدارة العملاء والمعاملات المالية، والربط مع الأنظمة العدلية.</p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">المنتج</h4>
              <ul className="space-y-3 text-slate-600">
                <li><a href="#features" className="hover:text-blue-600 transition-colors">المميزات</a></li>
                <li><a href="#pricing" className="hover:text-blue-600 transition-colors">الأسعار</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">دليل الاستخدام</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-4">قانوني</h4>
              <ul className="space-y-3 text-slate-600">
                <li><a href="#" className="hover:text-blue-600 transition-colors">شروط الاستخدام</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">سياسة الخصوصية</a></li>
                <li><a href="#" className="hover:text-blue-600 transition-colors">اتصل بنا</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">© 2026 أصيل المالي. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
