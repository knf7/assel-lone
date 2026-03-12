export const metadata = {
  title: 'التواصل | أصيل المالي',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-4 py-16">
        <h1 className="text-3xl font-bold text-slate-900">بيانات التواصل الرسمية</h1>
        <p className="mt-2 text-slate-500">قنوات التواصل المباشر للاستفسارات والدعم.</p>

        <div className="mt-10 space-y-4 text-slate-700">
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">الهاتف</div>
            <a className="text-lg font-semibold text-slate-900" href="tel:0583719925">0583719925</a>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">البريد الإلكتروني</div>
            <a className="text-lg font-semibold text-slate-900" href="mailto:aseel.ksa.sa.org@gmail.com">aseel.ksa.sa.org@gmail.com</a>
          </div>
          <div className="rounded-lg border border-slate-200 p-4">
            <div className="text-sm text-slate-500">LinkedIn</div>
            <a
              className="text-lg font-semibold text-slate-900 break-all"
              href="https://www.linkedin.com/in/khalid-alshammari-37ab95370?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app"
              target="_blank"
              rel="noopener noreferrer"
            >
              ملف LinkedIn
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
