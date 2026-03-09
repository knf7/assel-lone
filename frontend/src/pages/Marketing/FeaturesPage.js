import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
    IconDashboard, IconLoans, IconUsers,
    IconAnalytics, IconShield, IconPlus
} from '../../components/ui/Icons';
import './FeaturesPage.css';

const FEATURES = [
    {
        title: 'إدارة القروض الذكية',
        desc: 'تتبع شامل لجميع القروض، تواريخ الاستحقاق، والأقساط بنظام آلي متطور.',
        Icon: IconLoans,
        color: '#FF6B35'
    },
    {
        title: 'تكامل ناجز الآلي',
        desc: 'متابعة تلقائية للقضايا في منصة ناجز وربطها بالمقترضين لضمان حقوقك.',
        Icon: IconShield,
        color: '#3B82F6'
    },
    {
        title: 'تحليلات البيانات',
        desc: 'تقارير بيانية مفصلة عن نمو المحفظة، نسب التحصيل، والتوقعات المالية.',
        Icon: IconAnalytics,
        color: '#10B981'
    },
    {
        title: 'إدارة العملاء',
        desc: 'ملف متكامل لكل عميل يشمل سجل الالتزام، الوثائق، وتاريخ التواصل.',
        Icon: IconUsers,
        color: '#8B5CF6'
    },
    {
        title: 'رفع البيانات الضخمة',
        desc: 'استيراد آلي لآلاف السجلات من ملفات Excel بضغطة زر واحدة.',
        Icon: IconDashboard,
        color: '#F59E0B'
    },
    {
        title: 'الأمان والخصوصية',
        desc: 'تشفير عالي المستوى للبيانات وصلاحيات وصول دقيقة لكل مستخدم.',
        Icon: IconPlus,
        color: '#EF4444'
    }
];

export default function FeaturesPage() {
    const navigate = useNavigate();

    return (
        <div className="features-page">
            <div className="features-header">
                <h1>مميزات منصة أصيل المالي</h1>
                <p>كل ما تحتاجه لإدارة أعمالك المالية والتمويلية في مكان واحد وبأحدث التقنيات.</p>
            </div>

            <div className="features-grid">
                {FEATURES.map((f, i) => (
                    <div className="feature-card" key={i}>
                        <div className="feature-icon" style={{ backgroundColor: `${f.color}15`, color: f.color }}>
                            <f.Icon size={32} />
                        </div>
                        <h3>{f.title}</h3>
                        <p>{f.desc}</p>
                    </div>
                ))}
            </div>

            <div className="features-cta">
                <h2>ابدأ رحلة النجاح الآن</h2>
                <p>انظم إلى مئات الشركات التي تدير محفظتها المالية بكفاءة عالية.</p>
                <button className="cta-btn" onClick={() => navigate('/pricing')}>
                    اكتشف الباقات
                </button>
            </div>
        </div>
    );
}
