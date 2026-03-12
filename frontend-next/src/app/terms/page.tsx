export const metadata = {
  title: 'الشروط والأحكام | أصيل المالي',
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">الشروط والأحكام</h1>
        <p className="mt-2 text-slate-500">آخر تحديث: 2026-03-12</p>

        <section className="mt-10 space-y-6 text-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">1) التعريفات</h2>
            <p>تشير "المنصة" إلى نظام أصيل المالي، وتشير "الجهة المالكة" إلى مقدم الخدمة، وتشير "المستخدم" إلى كل من ينشئ حسابا أو يستخدم الخدمات.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">2) نطاق الاستخدام</h2>
            <p>يُسمح باستخدام المنصة للأغراض المشروعة فقط ووفق الصلاحيات المخوّلة لكل حساب، مع الالتزام بالأنظمة المعمول بها.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">3) الحسابات والصلاحيات</h2>
            <p>المستخدم مسؤول عن سرية بيانات الدخول وإدارة الصلاحيات داخل منشأته. أي استخدام غير مصرح به يقع على مسؤولية الجهة المالكة للحساب.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">4) الاشتراكات والدفع</h2>
            <p>تخضع الباقات للرسوم المعلنة، ويتم التجديد وفق الخطة المختارة. يمكن تغيير الباقة من صفحة الإعدادات. قد يتم تعليق الخدمة عند انتهاء الاشتراك حسب السياسة.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">5) حدود المسؤولية</h2>
            <p>تُقدّم المنصة "كما هي". لا تتحمل الجهة المالكة مسؤولية أي أضرار غير مباشرة أو خسائر ناتجة عن سوء استخدام النظام أو عن أعطال خارج نطاق السيطرة.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">6) الملكية الفكرية</h2>
            <p>جميع الحقوق محفوظة. لا يجوز إعادة توزيع أو نسخ أي جزء من المنصة دون إذن خطي.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">7) الإنهاء والتعليق</h2>
            <p>يحق للجهة المالكة تعليق أو إنهاء الحساب عند مخالفة الشروط أو السياسات أو الأنظمة.</p>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-900">8) التواصل</h2>
            <p>للاستفسارات النظامية، يمكن التواصل عبر البريد الرسمي الموضح في صفحة بيانات التواصل.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
