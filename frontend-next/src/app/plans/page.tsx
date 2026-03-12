import Link from 'next/link';

export const metadata = {
  title: 'الباقات | أصيل المالي',
};

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">الباقات</h1>
        <p className="mt-2 text-slate-500">ملخص الباقات مع توجيه لصفحة الأسعار التفصيلية.</p>

        <div className="mt-10 grid gap-6">
          <div className="rounded-lg border border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">الأساسية</h2>
            <p className="mt-2 text-slate-600">مناسبة للمنشآت الصغيرة وبداية التنظيم.</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">الاحترافية</h2>
            <p className="mt-2 text-slate-600">مزايا متقدمة وتقارير موسعة ورفع ملفات.</p>
          </div>
          <div className="rounded-lg border border-slate-200 p-5">
            <h2 className="text-xl font-semibold text-slate-900">المؤسسية</h2>
            <p className="mt-2 text-slate-600">تحليلات AI متقدمة ودعم مميز وصلاحيات واسعة.</p>
          </div>
        </div>

        <div className="mt-8">
          <Link className="rounded-md bg-slate-900 px-4 py-2 text-white" href="/pricing">
            عرض الأسعار التفصيلية
          </Link>
        </div>
      </div>
    </div>
  );
}
