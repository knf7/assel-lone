'use client';

import { Bell, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ModeToggle } from "@/components/layout/mode-toggle"
import { UserButton } from "@clerk/nextjs"

export function Header() {
    return (
        <header className="flex h-16 items-center gap-4 border-b bg-white dark:bg-slate-950 px-6 border-slate-200 dark:border-slate-800">
            <div className="flex flex-1 items-center gap-4">
                <form className="flex-1 sm:flex-initial">
                    <div className="relative">
                        <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-500 dark:text-slate-400" />
                        <Input
                            type="search"
                            placeholder="ابحث عن عميل أو قرض..."
                            className="pr-8 sm:w-[300px] md:w-[200px] lg:w-[300px]"
                        />
                    </div>
                </form>
            </div>
            <div className="flex items-center gap-4">
                <ModeToggle />
                <Button variant="outline" size="icon" className="h-9 w-9 rounded-full">
                    <Bell className="h-4 w-4" />
                    <span className="sr-only">الإشعارات</span>
                </Button>
                <UserButton
                    appearance={{
                        elements: {
                            avatarBox: "h-9 w-9",
                        },
                    }}
                />
            </div>
        </header>
    );
}

