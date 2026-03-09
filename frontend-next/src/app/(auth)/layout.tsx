import AnimatedBackground from '@/components/layout/AnimatedBackground';

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12 sm:px-6 lg:px-8">
            <AnimatedBackground />
            <div className="relative z-10 w-full max-w-[560px]">
                {children}
            </div>
        </div>
    );
}
