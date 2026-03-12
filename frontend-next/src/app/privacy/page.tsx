export const metadata = {
  title: 'سياسة الخصوصية | أصيل المالي',
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">سياسة الخصوصية</h1>
        <p className="mt-2 text-slate-500">آخر تحديث: 2026-03-12</p>

        <section className="mt-10 space-y-6 text-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">1) البيانات التي نجمعها</h2>
            <p>قد نجمع بيانات الحساب، وبيانات النشاط، والبيانات التشغيلية اللازمة لتقديم الخدمة وتحسينها.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">2) استخدام البيانات</h2>
            <p>تُستخدم البيانات لتشغيل المنصة، وتحسين الأداء، والدعم الفني، والالتزام بالمتطلبات النظامية.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">3) مشاركة البيانات</h2>
            <p>لا تتم مشاركة البيانات مع أطراف خارجية إلا عند الحاجة التشغيلية أو بطلب نظامي أو بموافقة المستخدم.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">4) أمن المعلومات</h2>
            <p>نطبق ضوابط أمنية معقولة لحماية البيانات، بما في ذلك التحكم في الصلاحيات وتسجيل العمليات.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">5) الاحتفاظ بالبيانات</h2>
            <p>نحتفظ بالبيانات للمدة اللازمة لتقديم الخدمة أو حسب المتطلبات النظامية، ثم يتم إتلافها أو إخفاؤها بشكل آمن.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">6) حقوق المستخدم</h2>
            <p>للمستخدم الحق في الاستفسار عن بياناته أو تحديثها عبر القنوات الرسمية.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
