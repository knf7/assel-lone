import React, { useMemo } from 'react';
import './AnimatedBackground.css';

export default function AnimatedBackground() {
    const stars = useMemo(() => {
        return Array.from({ length: 32 }, (_, i) => ({
            id: i,
            x: (Math.sin(i * 137.508) * 50 + 50),
            y: (Math.cos(i * 137.508) * 50 + 50),
            size: (i % 3) * 0.7 + 0.5,
            opacity: (i % 5) * 0.08 + 0.08,
            delay: (i % 5),
            duration: (i % 3) + 3,
        }));
    }, []);

    return (
        <div className="animated-background">
            {/* Gradient overlay */}
            <div className="gradient-overlay" />
            {/* Stars */}
            <div className="stars-layer">
                {stars.map(s => (
                    <span
                        key={s.id}
                        className="star"
                        style={{
                            left: `${s.x}%`,
                            top: `${s.y}%`,
                            width: `${s.size}px`,
                            height: `${s.size}px`,
                            '--star-opacity': s.opacity,
                            animationDelay: `${s.delay}s`,
                            animationDuration: `${s.duration}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}
