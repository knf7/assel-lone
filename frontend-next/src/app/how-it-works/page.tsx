import Link from 'next/link';

export const metadata = {
  title: 'آلية العمل | أصيل المالي',
};

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">آلية العمل</h1>
        <p className="mt-2 text-slate-500">مسار عملي واضح لإدارة القروض والعملاء بكفاءة.</p>

        <ol className="mt-10 space-y-6 text-slate-700 list-decimal list-inside">
          <li>إنشاء الحساب وضبط بيانات المنشأة والصلاحيات.</li>
          <li>إضافة العملاء والتحقق من بيانات الهوية والجوال.</li>
          <li>إدخال القروض أو استيرادها عبر Excel/CSV.</li>
          <li>متابعة التحصيل، والحالات المتأخرة، والتنبيهات.</li>
          <li>استخدام التقارير والتحليلات لاتخاذ قرارات أسرع.</li>
        </ol>

        <div className="mt-10 flex gap-3">
          <Link className="rounded-md bg-slate-900 px-4 py-2 text-white" href="/dashboard">
            الدخول للوحة التحكم
          </Link>
          <Link className="rounded-md border border-slate-300 px-4 py-2" href="/pricing">
            استعراض الأسعار
          </Link>
        </div>
      </div>
    </div>
  );
}
