import Link from 'next/link';

export const metadata = {
  title: 'المحتوى القانوني | أصيل المالي',
};

export default function LegalIndexPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">المحتوى القانوني</h1>
        <p className="mt-2 text-slate-500">صفحات السياسات والأحكام التي تنظّم استخدام المنصة.</p>

        <div className="mt-10 grid gap-4">
          <Link className="rounded-lg border border-slate-200 p-4 hover:border-slate-300" href="/terms">
            الشروط والأحكام
          </Link>
          <Link className="rounded-lg border border-slate-200 p-4 hover:border-slate-300" href="/privacy">
            سياسة الخصوصية
          </Link>
          <Link className="rounded-lg border border-slate-200 p-4 hover:border-slate-300" href="/usage-policy">
            سياسة الاستخدام المقبول
          </Link>
          <Link className="rounded-lg border border-slate-200 p-4 hover:border-slate-300" href="/how-it-works">
            آلية العمل
          </Link>
          <Link className="rounded-lg border border-slate-200 p-4 hover:border-slate-300" href="/plans">
            الباقات
          </Link>
          <Link className="rounded-lg border border-slate-200 p-4 hover:border-slate-300" href="/contact">
            بيانات التواصل الرسمية
          </Link>
        </div>
      </div>
    </div>
  );
}
