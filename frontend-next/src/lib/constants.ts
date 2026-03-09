import { Home, Users, CreditCard, UploadCloud, PieChart, UserCog, Settings } from 'lucide-react';

export const navigationLinks = [
    { name: 'نظرة عامة', href: '/dashboard', icon: Home },
    { name: 'العملاء', href: '/dashboard/customers', icon: Users },
    { name: 'القروض', href: '/dashboard/loans', icon: CreditCard },
    { name: 'رفع ملف', href: '/dashboard/loans/import', icon: UploadCloud },
    { name: 'التقارير', href: '/dashboard/analytics', icon: PieChart },
    { name: 'الموظفين', href: '/dashboard/employees', icon: UserCog },
    { name: 'الإعدادات', href: '/dashboard/settings', icon: Settings },
];
