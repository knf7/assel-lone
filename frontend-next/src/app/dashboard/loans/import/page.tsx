'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';
import { loansAPI } from '@/lib/api';
import {
    IconUpload, IconCheck, IconAlertTriangle,
    IconX, IconClipboard, IconRefresh, IconDownload
} from '@/components/layout/icons';
import './import.css';

const COLUMN_MAP = {
    nationalId: ['رقم الهوية', 'الهوية', 'هوية', 'national_id', 'id', 'ID'],
    fullName: ['اسم العميل', 'الاسم', 'اسم', 'full_name', 'name'],
    mobileNumber: ['رقم الجوال', 'الجوال', 'جوال', 'mobile', 'phone', 'رقم الهاتف'],
    amount: ['المبلغ', 'مبلغ', 'amount', 'المبلغ الإجمالي', 'قيمة القرض'],
    receiptNumber: ['رقم السند', 'رقم الإيصال', 'سند', 'إيصال', 'receipt', 'receipt_number'],
    date: ['التاريخ', 'تاريخ', 'date', 'transaction_date', 'تاريخ المعاملة']
};

type FieldKey = keyof typeof COLUMN_MAP;

const FIELD_LABELS: Record<FieldKey, string> = {
    nationalId: 'رقم الهوية',
    fullName: 'الاسم',
    mobileNumber: 'الجوال',
    amount: 'المبلغ',
    receiptNumber: 'رقم السند',
    date: 'التاريخ'
};

const REQUIRED_FIELDS: FieldKey[] = ['nationalId', 'fullName', 'amount'];

function findColumn(row: any, candidates: string[]) {
    const keys = Object.keys(row);
    for (const cand of candidates) {
        const candNorm = cand.trim().toLowerCase();
        const found = keys.find(k => {
            const keyNorm = k.trim().toLowerCase();
            return keyNorm === candNorm || keyNorm.includes(candNorm);
        });
        if (found !== undefined) return found;
    }
    return null;
}

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

export default function ExcelUploadPage() {
    const router = useRouter();
    const fileRef = useRef<HTMLInputElement>(null);

    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelected] = useState('');
    const [workbookRef, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [preview, setPreview] = useState<any[]>([]);
    const [headers, setHeaders] = useState<string[]>([]);
    const [rowCount, setRowCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<any>(null);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const [unifyDate, setUnifyDate] = useState(false);
    const [customDate, setCustomDate] = useState(new Date().toISOString().split('T')[0]);
    const [calendarType, setCalendarType] = useState<'gregorian' | 'hijri'>('gregorian');
    const [applyInterest, setApplyInterest] = useState(true);
    const [profitPercentage, setProfitPercentage] = useState(30);
    const [columnMap, setColumnMap] = useState<Record<FieldKey, string>>({
        nationalId: '',
        fullName: '',
        mobileNumber: '',
        amount: '',
        receiptNumber: '',
        date: ''
    });
    const [rowEdits, setRowEdits] = useState<Record<string, Partial<Record<FieldKey, string>>>>({});
    const missingRequired = useMemo(
        () => REQUIRED_FIELDS.filter((field) => !columnMap[field]),
        [columnMap]
    );
    const missingRequiredLabels = useMemo(
        () => missingRequired.map((field) => FIELD_LABELS[field]),
        [missingRequired]
    );

    const isPremium = true; // For now assuming true or we can check via API/Localstorage

    const parseSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
        const sheet = wb.Sheets[sheetName];
        const raw = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        const normalized = raw.map((row: any, idx: number) => ({
            ...row,
            __rowNum__: typeof row.__rowNum__ === 'number' ? row.__rowNum__ + 1 : idx + 2
        }));
        setRowCount(normalized.length);
        const headerList = normalized.length > 0 ? Object.keys(normalized[0]).filter(k => k !== '__rowNum__') : [];
        setHeaders(headerList);
        setPreview(normalized.slice(0, 8));

        const defaults: Record<FieldKey, string> = { ...columnMap };
        (Object.keys(COLUMN_MAP) as FieldKey[]).forEach((key) => {
            const found = normalized[0] ? findColumn(normalized[0], COLUMN_MAP[key]) : null;
            defaults[key] = found || '';
        });
        setColumnMap(defaults);
        setRowEdits({});
    }, []);

    const processFile = useCallback((f: File) => {
        if (!f) return;
        const ext = f.name.split('.').pop()?.toLowerCase();
        if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
            setError('صيغة الملف غير مدعومة. يُرجى استخدام Excel أو CSV');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const wb = XLSX.read(e.target?.result, { type: 'binary', cellDates: true });
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

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) processFile(e.target.files[0]);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (e.dataTransfer.files) processFile(e.dataTransfer.files[0]);
    };

    const handleReset = () => {
        setFile(null); setSheets([]); setSelected(''); setWorkbook(null);
        setPreview([]); setHeaders([]); setRowCount(0); setResult(null);
        setError(''); setProgress(0);
        setRowEdits({});
        if (fileRef.current) fileRef.current.value = '';
    };

    const handleImport = async () => {
        if (!file) return;
        if (missingRequired.length > 0) {
            setError(`يرجى تحديد الأعمدة المطلوبة أولاً: ${missingRequiredLabels.join('، ')}`);
            return;
        }
        setLoading(true);
        setError('');
        setResult(null);
        setProgress(10);

        try {
            const formData = new FormData();
            formData.append('file', file);
            if (selectedSheet) formData.append('sheet', selectedSheet);
            if (unifyDate) formData.append('overrideDate', customDate);
            formData.append('calendar', calendarType);
            formData.append('applyInterest', applyInterest ? 'true' : 'false');
            formData.append('profitPercentage', String(profitPercentage));
            formData.append('columnMap', JSON.stringify(columnMap));
            if (Object.keys(rowEdits).length > 0) {
                formData.append('rowOverrides', JSON.stringify(rowEdits));
            }

            const timer = setInterval(() => setProgress(p => p < 90 ? p + 10 : p), 500);

            const res = await loansAPI.upload(formData);
            clearInterval(timer);
            setProgress(100);

            const s = res.data?.summary || (res as any).summary || {};
            setResult({
                success: s.success || 0,
                failed: s.failed || 0,
                errors: s.errors || [],
                total: s.totalRowsInFile || 0
            });

            if ((s.success || 0) > 0) {
                setTimeout(() => router.push('/dashboard'), 5000);
            }
        } catch (err: any) {
            setProgress(0);
            const msg = err.response?.data?.error || 'فشل الاستيراد. تحقق من الاتصال بالخادم أو صيغة البيانات.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="import-page-container">
            <div className="up-header fade-up">
                <div>
                    <h1 className="up-title">رفع بيانات Excel / CSV</h1>
                    <p className="up-sub">استيراد القروض والعملاء بشكل دفعي</p>
                </div>
                <button className="btn btn-outline btn-sm" onClick={downloadTemplate}>
                    <IconDownload size={15} /> تحميل نموذج
                </button>
            </div>

            {!file ? (
                <div
                    className={`drop-zone glass-card fade-up ${isDragging ? 'dragging' : ''}`}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onClick={() => fileRef.current?.click()}
                >
                    <input
                        ref={fileRef} type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileInput}
                        className="file-input-hidden"
                    />
                    <div className="drop-icon-wrap">
                        <IconUpload size={32} />
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
                        <IconClipboard size={24} />
                    </div>
                    <div className="file-card-info">
                        <div className="file-name">{file.name}</div>
                        <div className="file-meta">
                            {(file.size / 1024).toFixed(1)} KB
                            {rowCount > 0 && <span> · {rowCount.toLocaleString('en-US')} صف</span>}
                        </div>
                    </div>
                    <button className="icon-btn" onClick={handleReset} title="إزالة الملف">
                        <IconX size={18} />
                    </button>
                </div>
            )}

            {sheets.length > 1 && (
                <div className="sheets-section glass-card fade-up">
                    <p className="section-label">اختر الشيت</p>
                    <div className="sheets-row">
                        {sheets.map(s => (
                            <button
                                key={s}
                                className={`sheet-chip ${selectedSheet === s ? 'active' : ''}`}
                                onClick={() => { setSelected(s); if (workbookRef) parseSheet(workbookRef, s); }}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}

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

                    <div className="import-settings-row">
                        <div className="import-setting">
                            <label className="section-label">نوع التقويم</label>
                            <select value={calendarType} onChange={(e) => setCalendarType(e.target.value as 'gregorian' | 'hijri')}>
                                <option value="gregorian">ميلادي</option>
                                <option value="hijri">هجري (سيتم التحويل للميلادي)</option>
                            </select>
                        </div>
                        <div className="import-setting">
                            <label className="section-label">تطبيق الفائدة</label>
                            <label className="inline-toggle">
                                <input
                                    type="checkbox"
                                    checked={applyInterest}
                                    onChange={(e) => setApplyInterest(e.target.checked)}
                                />
                                <span>تفعيل الفائدة تلقائياً</span>
                            </label>
                        </div>
                        <div className="import-setting">
                            <label className="section-label">نسبة الفائدة %</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                value={profitPercentage}
                                onChange={(e) => setProfitPercentage(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                                disabled={!applyInterest}
                            />
                        </div>
                    </div>
                </div>
            )}

            {preview.length > 0 && (
                <div className="col-map-card glass-card fade-up">
                    <p className="section-label">مطابقة الأعمدة</p>
                    <div className="map-grid">
                        {(Object.keys(COLUMN_MAP) as FieldKey[]).map((key) => (
                            <div key={key} className="map-row">
                                <label className={`map-label ${REQUIRED_FIELDS.includes(key) ? 'required' : ''}`}>
                                    {FIELD_LABELS[key]}
                                </label>
                                <select
                                    className="map-select"
                                    value={columnMap[key] || ''}
                                    onChange={(e) => setColumnMap(prev => ({ ...prev, [key]: e.target.value }))}
                                >
                                    <option value="">بدون</option>
                                    {headers.map((h) => (
                                        <option key={h} value={h}>{h}</option>
                                    ))}
                                </select>
                            </div>
                        ))}
                    </div>
                    {missingRequired.length > 0 && (
                        <div className="map-warning">
                            <IconAlertTriangle size={16} />
                            <span>الحقول المطلوبة غير محددة: {missingRequiredLabels.join('، ')}</span>
                        </div>
                    )}
                </div>
            )}

            {preview.length > 0 && (
                <div className="preview-card glass-card fade-up">
                    <div className="preview-header">
                        <p className="section-label">معاينة البيانات</p>
                        <span className="preview-badge">أول 8 صفوف من أصل {rowCount}</span>
                    </div>
                    <div className="table-scroll">
                        <table className="preview-table preview-edit-table">
                            <thead>
                                <tr>
                                    <th>#</th>
                                    {(Object.keys(COLUMN_MAP) as FieldKey[]).map((key) => (
                                        <th key={key}>{FIELD_LABELS[key]}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {preview.map((row, i) => (
                                    <tr key={i}>
                                        <td className="preview-rownum">{row.__rowNum__ || i + 2}</td>
                                        {(Object.keys(COLUMN_MAP) as FieldKey[]).map((key) => {
                                            const rowNumber = String(row.__rowNum__ || i + 2);
                                            const mappedKey = columnMap[key] || '';
                                            const rawValue = mappedKey ? row[mappedKey] : '';
                                            const overrideValue = rowEdits[rowNumber]?.[key];
                                            const displayValue = overrideValue !== undefined ? overrideValue : (rawValue ?? '');
                                            return (
                                                <td key={key}>
                                                    <input
                                                        className="preview-input"
                                                        value={String(displayValue)}
                                                        onChange={(e) => setRowEdits(prev => ({
                                                            ...prev,
                                                            [rowNumber]: {
                                                                ...prev[rowNumber],
                                                                [key]: e.target.value
                                                            }
                                                        }))}
                                                    />
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-error fade-up">
                    <IconAlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            )}

            {result && (
                <div className={`result-card fade-up ${result.success > 0 ? 'result-success' : 'result-error'}`}>
                    <div className="result-icon">
                        {result.success > 0 ? <IconCheck size={26} /> : <IconAlertTriangle size={26} />}
                    </div>
                    <div className="result-body">
                        <div className="result-title">
                            {result.success > 0 ? `تم استيراد ${result.success} قرض بنجاح` : 'استيراد جزئي / أخطاء'}
                        </div>
                        {result.failed > 0 && (
                            <div className="result-sub">فشل {result.failed} صف من أصل {result.total}</div>
                        )}
                    </div>
                </div>
            )}

            {file && !result && (
                <div className="up-actions fade-up">
                    <button className="btn btn-outline" onClick={handleReset} disabled={loading}>
                        <IconRefresh size={16} /> إعادة تحديد
                    </button>
                    <button
                        className="btn btn-primary btn-import"
                        onClick={handleImport}
                        disabled={loading || preview.length === 0 || missingRequired.length > 0}
                    >
                        {loading ? (
                            <>
                                <div className="btn-spinner" />
                                جاري المعالجة ({progress}%)
                            </>
                        ) : (
                            <>
                                <IconUpload size={16} />
                                بدء رفع {rowCount > 0 ? `${rowCount.toLocaleString('en-US')} صف` : 'البيانات'}
                            </>
                        )}
                    </button>
                </div>
            )}

            {loading && (
                <div className="progress-wrap fade-up">
                    <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${progress}%` }} />
                    </div>
                    <div className="progress-info">
                        <p className="progress-label">جاري المعالجة...</p>
                        <span>{progress}%</span>
                    </div>
                </div>
            )}
        </div>
    );
}
