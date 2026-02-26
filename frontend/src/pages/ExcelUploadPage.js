import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { loansAPI } from '../services/api';
import Layout from '../components/Layout';
import {
    IconUpload, IconCheck, IconAlertTriangle,
    IconX, IconClipboard, IconRefresh, IconDownload
} from '../components/Icons';
import './ExcelUploadPage.css';

// ─── Column mapping: Arabic headers → internal keys ───
const COLUMN_MAP = {
    nationalId: ['رقم الهوية', 'الهوية', 'هوية', 'national_id', 'id', 'ID'],
    fullName: ['اسم العميل', 'الاسم', 'اسم', 'full_name', 'name'],
    mobileNumber: ['رقم الجوال', 'الجوال', 'جوال', 'mobile', 'phone', 'رقم الهاتف'],
    amount: ['المبلغ', 'مبلغ', 'amount', 'المبلغ الإجمالي', 'قيمة القرض'],
    receiptNumber: ['رقم السند', 'رقم الإيصال', 'سند', 'إيصال', 'receipt', 'receipt_number'],
    date: ['التاريخ', 'تاريخ', 'date', 'transaction_date', 'تاريخ المعاملة']
};

function findColumn(row, candidates) {
    const keys = Object.keys(row);
    for (const cand of candidates) {
        const found = keys.find(k => k.trim().toLowerCase() === cand.trim().toLowerCase());
        if (found !== undefined) return found;
    }
    return null;
}

function mapRow(row) {
    const get = (candidates) => {
        const key = findColumn(row, candidates);
        return key !== undefined ? String(row[key] || '').trim() : '';
    };
    return {
        nationalId: get(COLUMN_MAP.nationalId),
        fullName: get(COLUMN_MAP.fullName),
        mobileNumber: get(COLUMN_MAP.mobileNumber),
        amount: get(COLUMN_MAP.amount),
        receiptNumber: get(COLUMN_MAP.receiptNumber),
        date: get(COLUMN_MAP.date)
    };
}

// ─── Download template helper ─────────────────────────
function downloadTemplate() {
    const ws = XLSX.utils.aoa_to_sheet([
        ['رقم الهوية', 'اسم العميل', 'رقم الجوال', 'المبلغ', 'رقم السند', 'التاريخ'],
        ['1234567890', 'محمد أحمد', '0512345678', '5000', 'R-001', '2024-01-15'],
        ['0987654321', 'فاطمة علي', '0598765432', '3000', 'R-002', '2024-01-20'],
    ]);
    ws['!cols'] = [{ wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'قروض');
    XLSX.writeFile(wb, 'نموذج-رفع-القروض.xlsx');
}

// ─── Main Component ────────────────────────────────────
export default function ExcelUploadPage() {
    const navigate = useNavigate();
    const fileRef = useRef(null);

    const [file, setFile] = useState(null);
    const [sheets, setSheets] = useState([]);
    const [selectedSheet, setSelected] = useState('');
    const [workbookRef, setWorkbook] = useState(null);
    const [preview, setPreview] = useState([]);
    const [headers, setHeaders] = useState([]);
    const [rowCount, setRowCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState(null); // { success, failed, errors }
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const merchant = JSON.parse(localStorage.getItem('merchant') || '{}');
    const plan = merchant.subscription_plan?.toLowerCase();
    const isPremium = plan === 'pro' || plan === 'enterprise';

    // Date Unification State
    const [unifyDate, setUnifyDate] = useState(false);
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);

    // ── Parse worksheet into preview ──────────────────
    const parseSheet = useCallback((wb, sheetName) => {
        const sheet = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        setRowCount(raw.length);
        setHeaders(raw.length > 0 ? Object.keys(raw[0]) : []);
        setPreview(raw.slice(0, 8));
    }, []);

    // ── File reader ───────────────────────────────────
    const processFile = useCallback((f) => {
        if (!f) return;
        const ext = f.name.split('.').pop().toLowerCase();
        if (!['xlsx', 'xls', 'csv'].includes(ext)) {
            setError('صيغة الملف غير مدعومة. يُرجى استخدام Excel أو CSV');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target.result, { type: 'binary', cellDates: true });
                setWorkbook(wb);
                setSheets(wb.SheetNames);
                if (wb.SheetNames.length > 0) {
                    setSelected(wb.SheetNames[0]);
                    parseSheet(wb, wb.SheetNames[0]);
                }
            } catch {
                setError('فشل قراءة الملف. تأكد من أن الملف غير تالف');
            }
        };
        reader.readAsBinaryString(f);
    }, [parseSheet]);

    const handleFileInput = (e) => processFile(e.target.files[0]);
    const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); processFile(e.dataTransfer.files[0]); };
    const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = () => setIsDragging(false);

    const handleSheetChange = (name) => {
        setSelected(name);
        if (workbookRef) parseSheet(workbookRef, name);
    };

    const handleReset = () => {
        setFile(null); setSheets([]); setSelected(''); setWorkbook(null);
        setPreview([]); setHeaders([]); setRowCount(0); setResult(null);
        setError(''); setProgress(0);
        if (fileRef.current) fileRef.current.value = '';
    };

    // ── Download Errors CSV ────────────────────────────
    const downloadErrors = useCallback(() => {
        if (!result || !result.errors || result.errors.length === 0) return;

        const csvRows = [];
        // Header
        csvRows.push(['الصف', 'رقم الهوية', 'الاسم', 'سبب الرفض'].join(','));
        // Data
        result.errors.forEach(e => {
            csvRows.push([
                e.row,
                e.national_id,
                `"${e.name || ''}"`,
                `"${e.error || ''}"`
            ].join(','));
        });

        const csvString = '\uFEFF' + csvRows.join('\n'); // Add BOM for Excel UTF-8
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `أخطاء-الرفع-${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [result]);

    // ── FAST IMPORT — single multipart request ────────
    // Sends the original file directly to the backend.
    // The backend processes all rows in ONE transaction with bulk SQL.
    const handleImport = async () => {
        if (!file) return;
        setLoading(true);
        setError('');
        setResult(null);
        setProgress(10);

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (selectedSheet) formData.append('sheet', selectedSheet);
            if (unifyDate) formData.append('overrideDate', customDate);

            const timer = setInterval(() => setProgress(p => p < 90 ? p + 10 : p), 500);

            // Single HTTP request — no per-row API calls
            const res = await loansAPI.upload(formData);

            clearInterval(timer);
            setProgress(100);

            const s = res.data?.summary || {};
            setResult({
                success: s.success || 0,
                failed: s.failed || 0,
                errors: s.errors || [],
                total: s.totalRowsInFile || 0
            });

            if ((s.success || 0) > 0) {
                setTimeout(() => navigate('/dashboard'), 5000); // Wait 5 seconds to let them read the results
            }
        } catch (err) {
            setProgress(0);
            const msg = err.response?.data?.error || 'فشل الاستيراد. تحقق من الاتصال بالخادم أو صيغة البيانات.';
            const details = err.response?.data?.detailedErrors || [];

            setError(msg);
            if (details.length > 0) {
                setResult({
                    success: 0,
                    failed: details.length,
                    errors: details,
                    total: 0,
                    isFatal: true
                });
            }
        } finally {
            setLoading(false);
        }
    };

    // ─── Render ──────────────────────────────────────
    if (!isPremium) {
        return (
            <Layout>
                <div className="upgrade-locked-container fade-up" style={{ textAlign: 'center', padding: '100px 20px' }}>
                    <div className="upgrade-icon" style={{ fontSize: '3rem', marginBottom: '20px' }}></div>
                    <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--navy)' }}>رفع الملفات المتقدم متاح في باقة برو</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>ارفع آلاف القروض والعملاء في ثوانٍ معدودة باستخدام ملفات Excel.</p>
                    <button className="btn btn-primary" onClick={() => window.location.href = '/pricing'}>
                        ترقية الباقة الآن
                    </button>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <div className="up-header fade-up">
                <div>
                    <h1 className="up-title">رفع بيانات Excel / CSV</h1>
                    <p className="up-sub">استيراد القروض والعملاء بشكل دفعي</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                    <IconDownload size={15} /> تحميل نموذج
                </button>
            </div>

            {/* ── Drop Zone ── */}
            {!file ? (
                <div
                    className={`drop-zone glass-card fade-up ${isDragging ? 'dragging' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => fileRef.current?.click()}
                >
                    <input
                        ref={fileRef} type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInput}
                        className="file-input-hidden"
                    />
                    <div className="drop-icon-wrap">
                        <IconUpload size={32} color="var(--accent)" />
                    </div>
                    <p className="drop-title">اسحب الملف هنا أو اضغط للاختيار</p>
                    <p className="drop-sub">يدعم: Excel (.xlsx, .xls) و CSV</p>
                    <div className="drop-formats">
                        <span className="format-chip">XLSX</span>
                        <span className="format-chip">XLS</span>
                        <span className="format-chip">CSV</span>
                    </div>
                </div>
            ) : (
                <div className="file-card glass-card fade-up">
                    <div className="file-card-icon">
                        <IconClipboard size={24} color="var(--accent)" />
                    </div>
                    <div className="file-card-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-meta">
                            {(file.size / 1024).toFixed(1)} KB
                            {rowCount > 0 && <span> · {rowCount.toLocaleString('ar-SA')} صف</span>}
                            {sheets.length > 1 && <span> · {sheets.length} شيت</span>}
                        </div>
                    </div>
                    <button className="icon-btn" onClick={handleReset} title="إزالة الملف">
                        <IconX size={18} color="var(--text-muted)" />
                    </button>
                </div>
            )}

            {/* ── Sheet Selector ── */}
            {sheets.length > 1 && (
                <div className="sheets-section glass-card fade-up">
                    <p className="section-label">اختر الشيت</p>
                    <div className="sheets-row">
                        {sheets.map(s => (
                            <button
                                key={s}
                                className={`sheet-chip ${selectedSheet === s ? 'active' : ''}`}
                                onClick={() => handleSheetChange(s)}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Date Unification ── */}
            {file && !result && (
                <div className="date-unify-section glass-card fade-up">
                    <div className="unify-header">
                        <label className="unify-toggle">
                            <input
                                type="checkbox"
                                checked={unifyDate}
                                onChange={(e) => setUnifyDate(e.target.checked)}
                            />
                            <span className="toggle-slider"></span>
                            <p className="section-label" style={{ margin: 0 }}>توحيد تاريخ جميع العمليات</p>
                        </label>
                        <p className="unify-tip">سيتم تجاهل التاريخ الموجود في الملف واستخدام هذا التاريخ بدلاً منه</p>
                    </div>

                    {unifyDate && (
                        <div className="unify-input-wrap fade-in">
                            <input
                                type="date"
                                className="unify-date-input"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                            />
                        </div>
                    )}
                </div>
            )}


            {/* ── Column Detection Status ── */}
            {preview.length > 0 && (
                <div className="col-map-card glass-card fade-up">
                    <p className="section-label">اكتشاف الأعمدة تلقائياً</p>
                    <div className="col-chips">
                        {Object.entries(COLUMN_MAP).map(([key, candidates]) => {
                            const found = preview[0] ? findColumn(preview[0], candidates) : null;
                            return (
                                <div key={key} className={`col-chip ${found ? 'found' : 'missing'}`}>
                                    {found ? <IconCheck size={13} /> : <IconX size={13} />}
                                    <span>{
                                        key === 'nationalId' ? 'رقم الهوية' :
                                            key === 'fullName' ? 'الاسم' :
                                                key === 'mobileNumber' ? 'الجوال' :
                                                    key === 'amount' ? 'المبلغ' :
                                                        key === 'receiptNumber' ? 'رقم السند' : 'التاريخ'
                                    }</span>
                                    {found && <span className="col-found-label">{found}</span>}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Preview Table ── */}
            {preview.length > 0 && (
                <div className="preview-card glass-card fade-up">
                    <div className="preview-header">
                        <p className="section-label">معاينة البيانات</p>
                        <span className="preview-badge">أول 8 صفوف من أصل {rowCount}</span>
                    </div>
                    <div className="table-scroll">
                        <table className="preview-table">
                            <thead>
                                <tr>{headers.map(h => <th key={h}>{h}</th>)}</tr>
                            </thead>
                            <tbody>
                                {preview.map((row, i) => (
                                    <tr key={i}>
                                        {headers.map(h => (
                                            <td key={h}>{String(row[h] ?? '')}</td>
                                        ))}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* ── Error ── */}
            {error && (
                <div className="alert alert-error fade-up">
                    <IconAlertTriangle size={18} color="#EF4444" />
                    <span>{error}</span>
                </div>
            )}

            {/* ── Result ── */}
            {result && (
                <div className={`result-card fade-up ${result.success > 0 ? 'result-success' : 'result-error'}`}>
                    <div className="result-icon">
                        {result.success > 0
                            ? <IconCheck size={26} color="#22C55E" />
                            : <IconAlertTriangle size={26} color="#EF4444" />
                        }
                    </div>
                    <div className="result-body">
                        <div className="result-title">
                            {result.success > 0
                                ? ` تم استيراد ${result.success} قرض بنجاح`
                                : result.isFatal ? ' توقف الاستيراد بسبب أخطاء حرجة' : '️ استيراد جزئي / أخطاء'
                            }
                        </div>
                        {result.failed > 0 && (
                            <div className="result-sub" style={{ color: '#EF4444', marginTop: '0.25rem', fontWeight: '500' }}>
                                تم تجاهل أو فشل {result.failed} صف ({result.total > 0 ? `من أصل ${result.total}` : 'بحاجة لتصحيح'})
                            </div>
                        )}

                        {result.errors && result.errors.length > 0 && (
                            <div className="result-errors-container" style={{ marginTop: '0.75rem' }}>
                                <div className="result-errors-list" style={{ fontSize: '0.85rem', color: '#B91C1C', background: '#FEE2E2', padding: '0.75rem', borderRadius: '8px' }}>
                                    {result.errors.slice(0, 15).map((e, i) => (
                                        <div key={i} className="result-error-item" style={{ marginBottom: '4px' }}>
                                            • صف {e.row}: {e.error} ({e.national_id})
                                        </div>
                                    ))}
                                    {result.errors.length > 15 && <div style={{ marginTop: '8px', fontWeight: 'bold' }}>... و {result.errors.length - 15} أخطاء أخرى.</div>}
                                </div>
                                <button
                                    onClick={downloadErrors}
                                    className="btn btn-outline btn-sm"
                                    style={{ marginTop: '10px', width: '100%', borderColor: '#EF4444', color: '#EF4444' }}
                                >
                                    <IconDownload size={14} /> تحميل تقرير الأخطاء (CSV)
                                </button>
                            </div>
                        )}
                    </div>
                    {result.success > 0 && (
                        <div className="result-redirect" style={{ marginTop: '1rem', color: 'var(--text-muted)' }}>جاري التوجيه للوحة التحكم بعد إغلاق هذا التقرير...</div>
                    )}
                </div>
            )}

            {/* ── Actions ── */}
            {file && !result && (
                <div className="up-actions fade-up">
                    <button className="btn btn-outline" onClick={handleReset} disabled={loading}>
                        <IconRefresh size={16} /> إعادة تحديد
                    </button>
                    <button
                        className="btn btn-primary btn-import"
                        onClick={handleImport}
                        disabled={loading || preview.length === 0}
                    >
                        {loading ? (
                            <>
                                <div className="btn-spinner" />
                                جاري المعالجة ({progress}%)
                            </>
                        ) : (
                            <>
                                <IconUpload size={16} />
                                بدء رفع {rowCount > 0 ? `${rowCount.toLocaleString('ar-SA')} صف` : 'البيانات'}
                            </>
                        )}
                    </button>
                </div>
            )}

            {/* ── Progress Bar ── */}
            {loading && (
                <div className="progress-wrap fade-up">
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <p className="progress-label">
                            {progress < 30 ? 'جاري تحضير الملف وقراءة الأعمدة...' :
                                progress < 80 ? `جاري تنظيف ومعالجة صفوف الإكسل...` :
                                    'جاري حفظ البيانات في الخادم (Database)...'}
                        </p>
                        <span style={{ fontSize: '0.85rem', color: 'var(--accent)', fontWeight: 'bold' }}>{progress}%</span>
                    </div>
                </div>
            )}

            {/* ── Upload Tips ── */}
            {!file && (
                <div className="tips-card glass-card fade-up">
                    <p className="section-label">متطلبات الملف</p>
                    <ul className="tips-list">
                        <li><IconCheck size={14} color="#22C55E" /> الصف الأول يجب أن يحتوي على رؤوس الأعمدة</li>
                        <li><IconCheck size={14} color="#22C55E" /> رقم الهوية الوطنية (10 أرقام) — إلزامي</li>
                        <li><IconCheck size={14} color="#22C55E" /> المبلغ (رقم) — إلزامي</li>
                        <li><IconCheck size={14} color="#22C55E" /> اسم العميل، رقم الجوال، رقم السند — اختياري</li>
                        <li><IconCheck size={14} color="#22C55E" /> يدعم ملفات ضخمة (حتى أكثر من مليون صف)</li>
                    </ul>
                </div>
            )}
        </Layout>
    );
}
