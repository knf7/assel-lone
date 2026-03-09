import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Auth/LoginPage';
import ResetPasswordPage from './pages/Auth/ResetPasswordPage';
import DashboardPage from './pages/Dashboard/DashboardPage';
import LoansPage from './pages/Loans/LoansPage';
import AddLoanPage from './pages/Loans/AddLoanPage';
import ExcelUploadPage from './pages/Najiz/ExcelUploadPage';
import AnalyticsPage from './pages/Dashboard/AnalyticsPage';
import CustomersPage from './pages/Customers/CustomersPage';
import EmployeesPage from './pages/Employees/EmployeesPage';
import SettingsPage from './pages/Admin/SettingsPage';
import PricingPage from './pages/Marketing/PricingPage';
import AdminPage from './pages/Admin/AdminPage';
import NajizCasesPage from './pages/Najiz/NajizCasesPage';
import LandingPage from './pages/Marketing/LandingPage';
import NotFoundPage from './pages/NotFoundPage';
import GlobalAlert from './components/ui/GlobalAlert';
import './App.css';

// ─── Auth Guard ────────────────────────────────────────────────────────────────
function PrivateRoute({ children, isAuthenticated }) {
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }
    return children;
}

// ─── App ───────────────────────────────────────────────────────────────────────
function App() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check for existing token on mount
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    const setAuth = (val) => {
        setIsAuthenticated(val);
        if (!val) {
            localStorage.removeItem('token');
            localStorage.removeItem('merchant');
            localStorage.removeItem('user');
        }
    };

    // Don't render until we've checked localStorage
    if (loading) return null;

    return (
        <Router>
            <div className="App">
                <GlobalAlert />

                <Routes>
                    {/* ── Public Routes ── */}
                    <Route
                        path="/"
                        element={
                            isAuthenticated
                                ? <Navigate to="/dashboard" replace />
                                : <LandingPage />
                        }
                    />
                    <Route
                        path="/login"
                        element={
                            isAuthenticated
                                ? <Navigate to="/dashboard" replace />
                                : <LoginPage setAuth={setAuth} />
                        }
                    />
                    <Route
                        path="/register"
                        element={
                            isAuthenticated
                                ? <Navigate to="/dashboard" replace />
                                : <LoginPage setAuth={setAuth} defaultRegister />
                        }
                    />
                    <Route path="/reset-password" element={<ResetPasswordPage />} />
                    <Route path="/pricing" element={<PricingPage />} />
                    <Route path="/system-manage-x7" element={<AdminPage />} />

                    {/* ── Protected Routes ── */}
                    <Route
                        path="/dashboard"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <DashboardPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/loans"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <LoansPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/add-loan"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <AddLoanPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/najiz"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <NajizCasesPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/najiz-cases"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <NajizCasesPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/excel-upload"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <ExcelUploadPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/analytics"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <AnalyticsPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/customers"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <CustomersPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/employees"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <EmployeesPage />
                            </PrivateRoute>
                        }
                    />
                    <Route
                        path="/settings"
                        element={
                            <PrivateRoute isAuthenticated={isAuthenticated}>
                                <SettingsPage />
                            </PrivateRoute>
                        }
                    />

                    {/* 404 */}
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App;
