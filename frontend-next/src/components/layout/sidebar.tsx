'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { navigationLinks } from '@/lib/constants';
import { LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SignOutButton } from '@clerk/nextjs';

export function Sidebar() {
    const pathname = usePathname();

    return (
        <div className="flex h-full w-64 flex-col border-l bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <div className="flex h-16 items-center border-b px-6 border-slate-200 dark:border-slate-800">
                <Link href="/dashboard" className="flex items-center gap-2 font-bold text-xl">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#FF6B35] to-[#FF8C61] font-bold text-white shadow-lg text-sm">
                        أ
                    </div>
                    <span className="bg-gradient-to-r from-[#FF6B35] to-[#FF8C61] bg-clip-text text-transparent">أصيل المالي</span>
                </Link>
            </div>

            <div className="flex-1 overflow-auto py-4">
                <nav className="grid gap-1 px-4">
                    {navigationLinks.map((link) => {
                        const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                        return (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-slate-50",
                                    isActive ? "bg-blue-50 text-[#3B82F6] dark:bg-blue-900/20 dark:text-blue-400 font-semibold" : "text-slate-500 dark:text-slate-400"
                                )}
                            >
                                <link.icon className={cn("h-4 w-4", isActive && "text-[#3B82F6]")} />
                                {link.name}
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="border-t p-4 border-slate-200 dark:border-slate-800">
                <SignOutButton>
                    <Button variant="ghost" className="w-full justify-start gap-3 text-slate-500 hover:text-red-600">
                        <LogOut className="h-4 w-4" />
                        تسجيل الخروج
                    </Button>
                </SignOutButton>
            </div>
        </div>
    );
}
