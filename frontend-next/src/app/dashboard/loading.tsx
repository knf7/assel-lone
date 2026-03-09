'use client';

export default function DashboardLoading() {
    return (
        <div className="flex h-[400px] flex-col items-center justify-center gap-4">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF6B35]"></div>
            <p className="text-slate-500 text-sm">جاري التحميل...</p>
        </div>
    );
}
