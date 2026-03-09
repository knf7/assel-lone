import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './GlobalAlert.css';

const GlobalAlert = () => {
    const [alert, setAlert] = useState(null);
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

    useEffect(() => {
        const fetchAlert = async () => {
            try {
                const res = await axios.get(`${API_URL}/public/settings`);
                if (res.data?.global_alert?.active) {
                    setAlert(res.data.global_alert);
                }
            } catch (err) {
                console.error('Error fetching global alert');
            }
        };
        fetchAlert();
    }, [API_URL]);

    if (!alert) return null;

    return (
        <div className={`global-alert-banner alert-type-${alert.type || 'info'}`}>
            <span className="alert-icon">
                {alert.type === 'warning' ? '️' : alert.type === 'error' ? '' : ''}
            </span>
            <span className="alert-message">{alert.message}</span>
            <button className="close-alert-btn" onClick={() => setAlert(null)}></button>
        </div>
    );
};

export default GlobalAlert;
