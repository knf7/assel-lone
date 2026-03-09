import React from 'react';
import './BackButton.css';

function BackButton({ onClick, to }) {
    const handleClick = () => {
        if (onClick) {
            onClick();
        } else if (to) {
            window.location.href = to;
        }
    };

    return (
        <button className="back-button" onClick={handleClick}>
            العودة للرئيسية
        </button>
    );
}

export default BackButton;
