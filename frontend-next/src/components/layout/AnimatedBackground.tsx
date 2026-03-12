'use client';

import React from 'react';

const AnimatedBackground = React.memo(function AnimatedBackground() {
    return (
        <div className="fixed inset-0 w-full h-full -z-10 bg-slate-900 overflow-hidden pointer-events-none">
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

            <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full opacity-15 blur-[100px]"
                style={{ background: "radial-gradient(circle, #FF6B35, transparent)" }}
            />
            <div className="absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full opacity-10 blur-[90px]"
                style={{ background: "radial-gradient(circle, #3B82F6, transparent)" }}
            />
        </div>
    );
});

export default AnimatedBackground;
