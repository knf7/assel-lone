import React, { useMemo } from 'react';
import './AnimatedBackground.css';

function AnimatedBackground() {
    const stars = useMemo(() => {
        return Array.from({ length: 60 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 2.5 + 0.8,
            opacity: Math.random() * 0.6 + 0.2,
            delay: Math.random() * 5,
            duration: Math.random() * 3 + 2,
        }));
    }, []);

    return (
        <div className="animated-background">
            <div className="gradient-overlay"></div>
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
                            opacity: s.opacity,
                            animationDelay: `${s.delay}s`,
                            animationDuration: `${s.duration}s`,
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

export default AnimatedBackground;
