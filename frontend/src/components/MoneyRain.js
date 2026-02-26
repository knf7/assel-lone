import React, { useEffect, useState } from 'react';
import './MoneyRain.css';

const MoneyRain = ({ isRaining, onComplete }) => {
    const [elements, setElements] = useState([]);

    useEffect(() => {
        if (isRaining) {
            // Generate multiple cash elements with falling rain physics
            const newElements = Array.from({ length: 40 }).map((_, i) => ({
                id: i,
                left: `${Math.random() * 100}vw`,
                top: `-${Math.random() * 20 + 10}vh`, // Start above the screen
                r: `${Math.random() * 360}deg`,
                animationDuration: `${Math.random() * 2 + 3}s`, // Slower fall (3-5s)
                animationDelay: `${Math.random() * 2}s`, // Spread the start times
            }));

            setElements(newElements);

            const timer = setTimeout(() => {
                setElements([]);
                if (onComplete) onComplete();
            }, 7000); // Wait longer for the rain to finish (since duration is 3-5s + delay 2s)

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
                    }}
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
