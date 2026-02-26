import React, { useState, useEffect } from 'react';
import { FiSearch, FiSave, FiExternalLink, FiDollarSign } from 'react-icons/fi';
import { FaBalanceScale, FaWhatsapp } from 'react-icons/fa';
import { loansAPI } from '../services/api';
import Layout from '../components/Layout';
import './NajizCasesPage.css';

const NajizCasesPage = () => {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [updatingId, setUpdatingId] = useState(null);

    useEffect(() => {
        fetchCases();
    }, []);

    const fetchCases = async () => {
        try {
            setLoading(true);
            const response = await loansAPI.getAll({ status: 'Raised', limit: 100 });
            const data = response.data || response;
            setCases(data.loans || []);
        } catch (error) {
            console.error('Failed to fetch Najiz cases:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCollectedAmountChange = (id, value) => {
        setCases(prev => prev.map(c =>
            c.id === id ? { ...c, najiz_collected_amount: value } : c
        ));
    };

    const handleCaseAmountChange = (id, value) => {
        setCases(prev => prev.map(c =>
            c.id === id ? { ...c, najiz_case_amount: value } : c
        ));
    };

    const saveNajizDetails = async (loan) => {
        try {
            setUpdatingId(loan.id);
            await loansAPI.update(loan.id, {
                najiz_collected_amount: parseFloat(loan.najiz_collected_amount) || 0,
                najiz_case_amount: parseFloat(loan.najiz_case_amount) || 0
            });
            // Show success briefly or just rely on state
        } catch (error) {
            alert('فشل حفظ المبلغ');
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredCases = cases.filter(c =>
        (c.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.national_id || '').includes(searchTerm) ||
        (c.najiz_case_number || '').includes(searchTerm)
    );

    return (
        <Layout>
            <div className="najiz-page-header">
                <div className="header-info">
                    <h1><FaBalanceScale className="header-icon" /> قضايا ناجز</h1>
                    <p>إدارة وتحصيل المبالغ للقضايا المرفوعة في منصة ناجز</p>
                </div>
                <div className="header-actions">
                    <div className="search-box">
                        <FiSearch className="search-icon" />
                        <input
                            type="text"
                            placeholder="بحث بالاسم، الهوية، أو رقم القضية..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="loading-state">جاري تحميل القضايا...</div>
            ) : (
                <div className="cases-grid">
                    {filteredCases.length === 0 ? (
                        <div className="empty-cases">
                            <FaBalanceScale size={48} />
                            <p>لا توجد قضايا مرفوعة حالياً</p>
                        </div>
                    ) : (
                        filteredCases.map(loan => (
                            <div key={loan.id} className="case-card glass-card">
                                <div className="case-card-header">
                                    <div className="customer-info">
                                        <h3>{loan.customer_name}</h3>
                                        <span>{loan.national_id}</span>
                                    </div>
                                    <div className="case-badge">
                                        {loan.najiz_status || 'قيد المعالجة'}
                                    </div>
                                </div>

                                <div className="case-details">
                                    <div className="detail-item">
                                        <label>رقم القضية</label>
                                        <div className="detail-value">{loan.najiz_case_number || 'غير محدد'}</div>
                                    </div>
                                    <div className="detail-item">
                                        <label>مبلغ المطالبة</label>
                                        <div className="detail-value highlight">{parseFloat(loan.amount).toLocaleString('ar-SA')} ر.س</div>
                                    </div>
                                    <div className="detail-item" style={{ flex: '1 1 100%' }}>
                                        <label>مبلغ السند</label>
                                        <div className="input-with-action" style={{ display: 'flex', gap: '8px' }}>
                                            <div className="amount-input-wrapper" style={{ flex: 1 }}>
                                                <FiDollarSign className="input-icon" />
                                                <input
                                                    type="number"
                                                    value={loan.najiz_case_amount || ''}
                                                    placeholder="مبلغ السند"
                                                    onChange={(e) => handleCaseAmountChange(loan.id, e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="collection-section">
                                    <label>المبلغ المتحصل عليه (أو القرض الجديد)</label>
                                    <div className="input-with-action">
                                        <div className="amount-input-wrapper" style={{ flex: 1 }}>
                                            <FiDollarSign className="input-icon" />
                                            <input
                                                type="number"
                                                value={loan.najiz_collected_amount || ''}
                                                placeholder="0.00"
                                                onChange={(e) => handleCollectedAmountChange(loan.id, e.target.value)}
                                            />
                                        </div>
                                        <button
                                            className={`btn-save ${updatingId === loan.id ? 'loading' : ''}`}
                                            onClick={() => saveNajizDetails(loan)}
                                            disabled={updatingId === loan.id}
                                        >
                                            <FiSave /> {updatingId === loan.id ? 'جاري الحفظ...' : 'حفظ'}
                                        </button>
                                    </div>
                                </div>

                                <div className="case-card-footer">
                                    <div className="footer-links">
                                        {loan.najizLink && (
                                            <a href={loan.najizLink} target="_blank" rel="noopener noreferrer" className="link-najiz">
                                                <FiExternalLink /> ناجز
                                            </a>
                                        )}
                                        {loan.whatsappLink && (
                                            <a href={loan.whatsappLink} target="_blank" rel="noopener noreferrer" className="link-whatsapp">
                                                <FaWhatsapp /> واتساب
                                            </a>
                                        )}
                                    </div>
                                    <div className="transaction-date">
                                        المعاملة: {new Date(loan.transaction_date).toLocaleDateString('ar-SA')}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </Layout>
    );
};

export default NajizCasesPage;
