'use client';

import React, { useEffect, useState } from 'react';
import './MoneyRain.css';

interface MoneyRainProps {
    isRaining: boolean;
    onComplete?: () => void;
}

interface MoneyElement {
    id: number;
    left: string;
    top: string;
    r: string;
    animationDuration: string;
    animationDelay: string;
}

const MoneyRain: React.FC<MoneyRainProps> = ({ isRaining, onComplete }) => {
    const [elements, setElements] = useState<MoneyElement[]>([]);

    useEffect(() => {
        if (isRaining) {
            const newElements = Array.from({ length: 40 }).map((_, i) => ({
                id: i,
                left: `${Math.random() * 100}vw`,
                top: `-${Math.random() * 20 + 10}vh`,
                r: `${Math.random() * 360}deg`,
                animationDuration: `${Math.random() * 2 + 3}s`,
                animationDelay: `${Math.random() * 2}s`,
            }));

            setElements(newElements);

            const timer = setTimeout(() => {
                setElements([]);
                if (onComplete) onComplete();
            }, 7000);

            return () => clearTimeout(timer);
        }
    }, [isRaining, onComplete]);

    if (!isRaining) return null;

    return (
        <div className="money-rain-container">
            {elements.map((el) => (
                <div
                    key={el.id}
                    className="money-particle"
                    style={{
                        left: el.left,
                        top: el.top,
                        '--r': el.r,
                        animationDuration: el.animationDuration,
                        animationDelay: el.animationDelay,
                    } as React.CSSProperties}
                >
                    <div className="banknote">
                        <div className="banknote-inner">
                            <div className="banknote-emblem"></div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default MoneyRain;
