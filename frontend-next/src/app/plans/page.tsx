import Link from 'next/link';

export const metadata = {
  title: 'الباقات | أصيل المالي',
};

const plans = [
  {
    name: 'الأساسة',
    price: '99 ر.س',
    cadence: 'شهرياً',
    description: 'مناسبة للمنشآت الصغيرة وبداية التنظيم.',
    features: ['50 عميل', '50 قرض', 'بدون تصدير Excel', 'بدون استيراد Excel', 'بدون تقارير شهرية', 'بدون موظفين'],
    highlight: false,
  },
  {
    name: 'متوسطه',
    price: '220 ر.س',
    cadence: 'شهرياً',
    description: 'خيار متقدم مع تحليلات أوسع ودعم سريع.',
    features: ['150 عميل', '200 قرض', 'موظف واحد', 'استيراد Excel', 'بدون تصدير Excel', 'تقارير شهرية'],
    highlight: true,
  },
  {
    name: 'برو',
    price: '350 ر.س',
    cadence: 'شهرياً',
    description: 'أفضل أداء للمنشآت الكبرى مع صلاحيات شاملة.',
    features: ['500 عميل', '700 قرض', 'موظفان', 'تقارير شهرية', 'تحليلات المخاطر AI'],
    highlight: false,
  },
] as const;

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-slate-900">الباقات</h1>
          <p className="mt-3 text-slate-500">اختر الخطة الأنسب حسب حجم العمل واحتياجات فريقك.</p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition-shadow ${
                plan.highlight ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200'
              }`}
            >
              {plan.highlight && (
                <span className="absolute -top-3 right-6 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white shadow">
                  الأكثر طلباً
                </span>
              )}

              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">{plan.name}</h2>
                  <p className="mt-2 text-sm text-slate-500">{plan.description}</p>
                </div>
                <div className="text-left">
                  <p className="text-3xl font-bold text-slate-900" dir="ltr">
                    {plan.price}
                  </p>
                  <span className="text-xs text-slate-400">{plan.cadence}</span>
                </div>
              </div>

              <div className="mt-6 flex-1">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">المميزات</p>
                <ul className="mt-4 space-y-3 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 rounded-full bg-blue-500" aria-hidden="true" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Link className="rounded-md bg-slate-900 px-5 py-2.5 text-white" href="/pricing">
            عرض الأسعار التفصيلية
          </Link>
        </div>
      </div>
    </div>
  );
}
