'use client';

import React, { useState, useEffect, useRef } from 'react';
import './SupportWidget.css';

const FAQ_ITEMS = [
    {
        q: 'كيف أرفع ملف Excel؟',
        a: 'اذهب إلى "رفع ملف" من القائمة الجانبية، ثم اختر ملف Excel يحتوي أعمدة: الاسم، رقم الهوية، المبلغ، التاريخ.'
    },
    {
        q: 'كيف أضيف عميل جديد؟',
        a: 'من صفحة "العملاء"، اضغط زر "إضافة عميل" وأدخل الاسم ورقم الهوية والجوال.'
    },
    {
        q: 'كيف أصدّر التقارير؟',
        a: 'من لوحة التحكم، اضغط "تصدير CSV" أو اذهب لصفحة "التحليلات" للتصدير بصيغة Excel.'
    },
    {
        q: 'كيف أغير كلمة المرور؟',
        a: 'اذهب إلى "الإعدادات" من القائمة الجانبية، ثم اختر "تغيير كلمة المرور" وأدخل الكلمة الحالية والجديدة.'
    },
    {
        q: 'ما هي صيغ الملفات المدعومة للرفع؟',
        a: 'يدعم النظام ملفات Excel (xlsx, xls) وملفات CSV.'
    },
    {
        q: 'كيف أتواصل مع عميل عبر واتساب؟',
        a: 'في صفحة القروض أو العملاء، ستجد زر واتساب بجانب كل عميل لديه رقم جوال مسجل.'
    },
];

const SupportWidget = React.memo(function SupportWidget() {
    const [open, setOpen] = useState(false);
    const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('keydown', handleKey);
        return () => document.removeEventListener('keydown', handleKey);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        const timer = setTimeout(() => {
            document.addEventListener('mousedown', handleClickOutside);
        }, 100);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [open]);

    return (
        <div className="support-widget" role="complementary" aria-label="خدمة العملاء">
            {open && (
                <div
                    ref={popupRef}
                    className="support-popup glass-card"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="support-title"
                >
                    <div className="support-header">
                        <h4 id="support-title">💬 خدمة العملاء</h4>
                        <button
                            className="support-close"
                            onClick={() => setOpen(false)}
                            aria-label="إغلاق نافذة خدمة العملاء"
                            title="إغلاق"
                        >
                            ×
                        </button>
                    </div>

                    <p className="support-desc">نحن هنا لمساعدتك! اختر طريقة التواصل المناسبة:</p>

                    <div className="support-links">
                        <a
                            href="https://wa.me/966500000000?text=السلام%20عليكم،%20أحتاج%20مساعدة%20في%20نظام%20أصيل%20المالي"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="support-link support-whatsapp"
                            aria-label="تواصل معنا عبر واتساب - رد فوري"
                        >
                            <span className="support-link-icon" aria-hidden="true">📱</span>
                            <div>
                                <div className="support-link-title">واتساب</div>
                                <div className="support-link-sub">رد فوري خلال دقائق</div>
                            </div>
                        </a>

                        <a
                            href="mailto:support@aseel.sa?subject=طلب دعم — نظام أصيل المالي"
                            className="support-link support-email"
                            aria-label="تواصل معنا عبر البريد الإلكتروني support@aseel.sa"
                        >
                            <span className="support-link-icon" aria-hidden="true">📧</span>
                            <div>
                                <div className="support-link-title">البريد الإلكتروني</div>
                                <div className="support-link-sub">support@aseel.sa</div>
                            </div>
                        </a>
                    </div>

                    <div className="support-faq" role="region" aria-label="الأسئلة الشائعة">
                        <h5>❓ أسئلة شائعة</h5>
                        {FAQ_ITEMS.map((item, index) => (
                            <div key={index} className="faq-item">
                                <button
                                    className="faq-summary"
                                    onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                                    aria-expanded={expandedFaq === index}
                                    aria-controls={`faq-answer-${index}`}
                                >
                                    <span>{item.q}</span>
                                    <span className={`faq-chevron ${expandedFaq === index ? 'open' : ''}`} aria-hidden="true">
                                        ▾
                                    </span>
                                </button>
                                <div
                                    id={`faq-answer-${index}`}
                                    className={`faq-answer ${expandedFaq === index ? 'expanded' : ''}`}
                                    aria-hidden={expandedFaq !== index}
                                >
                                    <p>{item.a}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="support-privacy">
                        <span aria-hidden="true">🔒</span> محادثاتك آمنة ومحمية بموجب{' '}
                        <a href="/privacy" style={{ color: 'var(--coral)' }}>سياسة الخصوصية</a>
                    </div>
                </div>
            )}

            <button
                className={`support-fab ${open ? 'support-fab-active' : ''}`}
                onClick={() => setOpen(!open)}
                title={open ? 'إغلاق خدمة العملاء' : 'فتح خدمة العملاء'}
                aria-label={open ? 'إغلاق خدمة العملاء' : 'فتح خدمة العملاء'}
                aria-expanded={open}
                aria-controls="support-popup"
            >
                <span className="fab-icon" aria-hidden="true">{open ? '×' : '💬'}</span>
                {!open && <span className="fab-pulse" aria-hidden="true" />}
            </button>
        </div>
    );
});

export default SupportWidget;
