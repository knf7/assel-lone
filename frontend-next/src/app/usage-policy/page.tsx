export const metadata = {
  title: 'سياسة الاستخدام المقبول | أصيل المالي',
};

export default function UsagePolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">سياسة الاستخدام المقبول</h1>
        <p className="mt-2 text-slate-500">آخر تحديث: 2026-03-12</p>

        <section className="mt-10 space-y-6 text-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">1) الاستخدام المشروع</h2>
            <p>يحظر استخدام المنصة في أي نشاط غير نظامي أو يخل بالأنظمة واللوائح المعمول بها.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">2) حماية البيانات</h2>
            <p>يلتزم المستخدم بحماية بيانات العملاء وعدم مشاركتها خارج نطاق العمل المصرح به.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">3) إساءة الاستخدام</h2>
            <p>يُحظر إجراء محاولات اختراق أو تحميل ملفات ضارة أو تعطيل الخدمة أو التحايل على القيود.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">4) الالتزام بالسياسات</h2>
            <p>أي مخالفة جسيمة قد تؤدي إلى تعليق أو إنهاء الحساب وفقًا للشروط والأحكام.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
