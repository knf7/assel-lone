import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import LoansPage from './pages/LoansPage';
import AddLoanPage from './pages/AddLoanPage';
import ExcelUploadPage from './pages/ExcelUploadPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CustomersPage from './pages/CustomersPage';
import SettingsPage from './pages/SettingsPage';
import PricingPage from './pages/PricingPage';
import AdminPage from './pages/AdminPage';
import NajizCasesPage from './pages/NajizCasesPage';
import SubscriptionExpiredPage from './pages/SubscriptionExpiredPage';
import NotFoundPage from './pages/NotFoundPage';
import GlobalAlert from './components/GlobalAlert';
import './App.css';

// ── Session Timeout Warning Dialog ──
function SessionWarningDialog({ onStay, onLeave, remaining }) {
    const mins = Math.floor(remaining / 60);
    const secs = remaining % 60;
    return (
        <div
            className="modal-overlay"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="session-warning-title"
            aria-describedby="session-warning-desc"
        >
            <div className="modal-box" style={{ maxWidth: 420, textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>⏱️</div>
                <h2
                    id="session-warning-title"
                    className="modal-title"
                    style={{ justifyContent: 'center', marginBottom: '12px' }}
                >
                    انتبه: جلستك على وشك الانتهاء
                </h2>
                <p
                    id="session-warning-desc"
                    style={{ color: 'var(--text-secondary)', marginBottom: '8px', lineHeight: 1.7 }}
                >
                    ستنتهي جلستك تلقائياً بعد:
                </p>
                <div style={{
                    fontSize: '36px',
                    fontWeight: 900,
                    color: secs <= 30 ? '#EF4444' : '#F59E0B',
                    marginBottom: '24px',
                    fontVariantNumeric: 'tabular-nums',
                    transition: 'color 0.3s',
                }}>
                    {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
                </div>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                    <button
                        className="btn btn-primary"
                        onClick={onStay}
                        autoFocus
                        style={{ minWidth: '140px' }}
                    >
                        ✓ تمديد الجلسة
                    </button>
                    <button
                        className="btn btn-danger"
                        onClick={onLeave}
                        style={{ minWidth: '120px' }}
                    >
                        خروج الآن
                    </button>
                </div>
            </div>
        </div>
    );
}

function App() {
    const [isAuthenticated, setIsAuthenticated] = React.useState(
        !!localStorage.getItem('token')
    );
    const [showSessionWarning, setShowSessionWarning] = React.useState(false);
    const [warningCountdown, setWarningCountdown] = React.useState(120); // 2 min warning

    const PrivateRoute = ({ children }) => {
        return isAuthenticated ? children : <Navigate to="/login" />;
    };

    // ── Inactivity Timeout (15 minutes) with 2-minute warning ──
    React.useEffect(() => {
        if (!isAuthenticated) return;

        const TIMEOUT = 15 * 60 * 1000;        // 15 min
        const WARN_BEFORE = 2 * 60 * 1000;     // warn 2 min before
        let logoutTimer;
        let warnTimer;
        let countdownInterval;

        const doLogout = () => {
            setShowSessionWarning(false);
            localStorage.clear();
            setIsAuthenticated(false);
            window.location.href = '/login?reason=timeout';
        };

        const startWarning = () => {
            setWarningCountdown(120);
            setShowSessionWarning(true);

            let count = 120;
            countdownInterval = setInterval(() => {
                count -= 1;
                setWarningCountdown(count);
                if (count <= 0) {
                    clearInterval(countdownInterval);
                }
            }, 1000);
        };

        const resetTimers = () => {
            clearTimeout(logoutTimer);
            clearTimeout(warnTimer);
            clearInterval(countdownInterval);
            setShowSessionWarning(false);

            warnTimer = setTimeout(startWarning, TIMEOUT - WARN_BEFORE);
            logoutTimer = setTimeout(doLogout, TIMEOUT);
        };

        const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
        events.forEach(event => window.addEventListener(event, resetTimers, { passive: true }));

        resetTimers();

        return () => {
            clearTimeout(logoutTimer);
            clearTimeout(warnTimer);
            clearInterval(countdownInterval);
            events.forEach(event => window.removeEventListener(event, resetTimers));
        };
    }, [isAuthenticated]);

    const handleStaySession = () => {
        setShowSessionWarning(false);
        // Trigger event to reset the timer
        window.dispatchEvent(new Event('mousedown'));
    };

    const handleLeaveSession = () => {
        setShowSessionWarning(false);
        localStorage.clear();
        setIsAuthenticated(false);
        window.location.href = '/login';
    };

    return (
        <Router>
            <div className="App">
                <GlobalAlert />

                {/* Session Warning Dialog */}
                {showSessionWarning && (
                    <SessionWarningDialog
                        remaining={warningCountdown}
                        onStay={handleStaySession}
                        onLeave={handleLeaveSession}
                    />
                )}

                <Routes>
                    <Route path="/login" element={<LoginPage setAuth={setIsAuthenticated} />} />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/subscription-expired" element={<SubscriptionExpiredPage />} />
                    <Route path="/system-manage-x7" element={<AdminPage />} />
                    <Route
                        path="/dashboard"
                        element={
                            <PrivateRoute>
                                <DashboardPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/najiz-cases"
                        element={
                            <PrivateRoute>
                                <NajizCasesPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/loans"
                        element={
                            <PrivateRoute>
                                <LoansPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/add-loan"
                        element={
                            <PrivateRoute>
                                <AddLoanPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/excel-upload"
                        element={
                            <PrivateRoute>
                                <ExcelUploadPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/analytics"
                        element={
                            <PrivateRoute>
                                <AnalyticsPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/customers"
                        element={
                            <PrivateRoute>
                                <CustomersPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <PrivateRoute>
                                <SettingsPage />
                            </PrivateRoute>
                        }
                    />
                    <Route path="/" element={<Navigate to="/dashboard" />} />
                    {/* 404 catch-all */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
