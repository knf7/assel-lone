'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { employeesAPI, settingsAPI } from '@/lib/api';
import './settings.css';

type PermissionKey =
  | 'can_view_dashboard'
  | 'can_view_loans'
  | 'can_add_loans'
  | 'can_upload_loans'
  | 'can_view_customers'
  | 'can_view_najiz'
  | 'can_view_analytics'
  | 'can_view_settings';

type EmployeePermissions = Record<PermissionKey, boolean>;

type Employee = {
  id: string;
  full_name: string;
  email: string;
  permissions: Partial<EmployeePermissions>;
  is_active?: boolean;
  deleted_at?: string | null;
};

type ApiErrorLike = {
  response?: {
    data?: {
      error?: string;
    };
  };
};

const DEFAULT_PERMISSIONS: EmployeePermissions = {
  can_view_dashboard: true,
  can_view_loans: true,
  can_add_loans: false,
  can_upload_loans: false,
  can_view_customers: false,
  can_view_najiz: false,
  can_view_analytics: false,
  can_view_settings: false,
};

const PERMISSION_LABELS: Array<{ key: PermissionKey; label: string; hint: string }> = [
  { key: 'can_view_dashboard', label: 'صفحة الرئيسية', hint: 'عرض لوحة المؤشرات الرئيسية' },
  { key: 'can_view_loans', label: 'صفحة القروض', hint: 'عرض قائمة القروض والتفاصيل' },
  { key: 'can_add_loans', label: 'إضافة/تعديل القروض', hint: 'إنشاء وتعديل وحذف القروض' },
  { key: 'can_upload_loans', label: 'استيراد القروض', hint: 'رفع ملفات القروض (Excel/CSV)' },
  { key: 'can_view_customers', label: 'صفحة العملاء', hint: 'عرض وإدارة بيانات العملاء' },
  { key: 'can_view_najiz', label: 'صفحة ناجز', hint: 'الوصول إلى قضايا ناجز' },
  { key: 'can_view_analytics', label: 'صفحة التحليلات', hint: 'عرض المخططات والتحليلات' },
  { key: 'can_view_settings', label: 'صفحة الإعدادات', hint: 'الوصول إلى إعدادات الحساب' },
];

function mergePermissions(perms?: Partial<EmployeePermissions>): EmployeePermissions {
  return { ...DEFAULT_PERMISSIONS, ...(perms || {}) };
}

function extractApiError(error: unknown, fallback: string) {
  const apiErr = error as ApiErrorLike;
  return apiErr.response?.data?.error || fallback;
}

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'account' | 'employees'>('account');

  const [profile, setProfile] = useState({
    username: '',
    business_name: '',
    email: '',
    mobile_number: '',
    whatsapp_phone_id: '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  const [messages, setMessages] = useState<{ profile: string | null; password: string | null; employees: string | null }>({
    profile: null,
    password: null,
    employees: null,
  });

  const [busyEmployeeId, setBusyEmployeeId] = useState<string | null>(null);

  const activeEmployees = useMemo(() => employees.filter((e) => e.is_active !== false && !e.deleted_at), [employees]);
  const inactiveEmployees = useMemo(() => employees.filter((e) => e.is_active === false || !!e.deleted_at), [employees]);

  useEffect(() => {
    const boot = async () => {
      setLoading(true);
      await Promise.all([fetchProfile(), fetchEmployees()]);
      if (typeof window !== 'undefined') {
        const palette = 'aero-silver';
        localStorage.setItem('color_palette', palette);
        document.documentElement.setAttribute('data-color-palette', palette);
      }
      setLoading(false);
    };
    boot();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await settingsAPI.getProfile();
      const data = res.data?.profile || res.data;
      if (data) {
        setProfile({
          username: data.username || '',
          business_name: data.business_name || '',
          email: data.email || '',
          mobile_number: data.mobile_number || '',
          whatsapp_phone_id: data.whatsapp_phone_id || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  const fetchEmployees = async () => {
    try {
      const res = await employeesAPI.getAll({ includeInactive: true });
      const list = res.data?.employees || [];
      setEmployees(list.map((emp: Employee) => ({ ...emp, permissions: mergePermissions(emp.permissions) })));
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessages((m) => ({ ...m, profile: 'جاري حفظ بيانات الحساب...' }));
    try {
      await settingsAPI.updateProfile(profile);
      setMessages((m) => ({ ...m, profile: 'تم حفظ بيانات الحساب بنجاح.' }));
    } catch (error: unknown) {
      setMessages((m) => ({ ...m, profile: extractApiError(error, 'تعذر حفظ بيانات الحساب.') }));
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessages((m) => ({ ...m, password: 'كلمة المرور الجديدة وتأكيدها غير متطابقين.' }));
      return;
    }
    setMessages((m) => ({ ...m, password: 'جاري تحديث كلمة المرور...' }));
    try {
      await settingsAPI.changePassword(passwordData.currentPassword, passwordData.newPassword);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setMessages((m) => ({ ...m, password: 'تم تحديث كلمة المرور بنجاح.' }));
    } catch (error: unknown) {
      setMessages((m) => ({ ...m, password: extractApiError(error, 'فشل تحديث كلمة المرور.') }));
    }
  };

  const handleDisableEmployee = async (id: string) => {
    setBusyEmployeeId(id);
    try {
      await employeesAPI.delete(id);
      await fetchEmployees();
      setMessages((m) => ({ ...m, employees: 'تم تعطيل الموظف.' }));
    } catch (error: unknown) {
      setMessages((m) => ({ ...m, employees: extractApiError(error, 'تعذر تعطيل الموظف.') }));
    } finally {
      setBusyEmployeeId(null);
    }
  };

  const handleActivateEmployee = async (id: string) => {
    setBusyEmployeeId(id);
    try {
      await employeesAPI.activate(id);
      await fetchEmployees();
      setMessages((m) => ({ ...m, employees: 'تم تفعيل الموظف.' }));
    } catch (error: unknown) {
      setMessages((m) => ({ ...m, employees: extractApiError(error, 'تعذر تفعيل الموظف.') }));
    } finally {
      setBusyEmployeeId(null);
    }
  };

  if (loading) {
    return <div className="loading-container">جاري تحميل الإعدادات...</div>;
  }

  return (
    <div className="settings-page-container">
      <div className="page-header">
        <div>
          <h1>الإعدادات</h1>
          <p>تحكم كامل بالحساب وصلاحيات الموظفين حسب الصفحات</p>
        </div>
      </div>

      <div className="settings-tabs" role="tablist" aria-label="أقسام الإعدادات">
        <button
          className={`settings-tab ${activeSection === 'account' ? 'active' : ''}`}
          onClick={() => setActiveSection('account')}
          role="tab"
          aria-selected={activeSection === 'account'}
        >
          إعدادات الحساب
        </button>
        <button
          className={`settings-tab ${activeSection === 'employees' ? 'active' : ''}`}
          onClick={() => setActiveSection('employees')}
          role="tab"
          aria-selected={activeSection === 'employees'}
        >
          إعدادات الموظفين
        </button>
      </div>

      {activeSection === 'account' && (
        <div className="settings-grid">
          <div className="settings-card glass-card">
            <h2>معلومات الحساب</h2>
            <form onSubmit={handleProfileSubmit} className="form-stack">
              <div className="form-group">
                <label>اسم المستخدم</label>
                <input type="text" className="input" value={profile.username} onChange={(e) => setProfile({ ...profile, username: e.target.value })} />
              </div>

              <div className="form-group">
                <label>اسم النشاط</label>
                <input type="text" className="input" value={profile.business_name} onChange={(e) => setProfile({ ...profile, business_name: e.target.value })} required />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>البريد الإلكتروني</label>
                  <input type="email" className="input" value={profile.email} readOnly />
                </div>
                <div className="form-group">
                  <label>رقم الجوال</label>
                  <input type="text" className="input" value={profile.mobile_number} onChange={(e) => setProfile({ ...profile, mobile_number: e.target.value })} />
                </div>
              </div>

              {messages.profile && <div className="message info">{messages.profile}</div>}
              <button type="submit" className="btn btn-primary">حفظ تغييرات الحساب</button>
            </form>
          </div>

          <div className="settings-card glass-card">
            <h2>الأمان</h2>
            <form onSubmit={handlePasswordSubmit} className="form-stack">
              <div className="form-group">
                <label>كلمة المرور الحالية</label>
                <input type="password" className="input" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} />
              </div>
              <div className="form-group">
                <label>كلمة المرور الجديدة</label>
                <input type="password" className="input" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
              </div>
              <div className="form-group">
                <label>تأكيد كلمة المرور</label>
                <input type="password" className="input" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
              </div>

              {messages.password && <div className="message info">{messages.password}</div>}
              <button type="submit" className="btn btn-secondary">تحديث كلمة المرور</button>
            </form>
          </div>
        </div>
      )}

      {activeSection === 'employees' && (
        <div className="settings-card glass-card full-width">
          <div className="card-header">
            <div>
              <h2>إدارة الموظفين</h2>
              <p>خصص وصول كل موظف حسب صفحات المنصة</p>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditingEmployee(null);
                setShowEmployeeModal(true);
              }}
            >
              + إضافة موظف
            </button>
          </div>

          {messages.employees && <div className="message info">{messages.employees}</div>}

          <div className="employees-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد الإلكتروني</th>
                  <th>الحالة</th>
                  <th>صلاحيات الصفحات</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {[...activeEmployees, ...inactiveEmployees].map((emp) => {
                  const perms = mergePermissions(emp.permissions);
                  const pages: string[] = [];
                  if (perms.can_view_dashboard) pages.push('الرئيسية');
                  if (perms.can_view_loans) pages.push('القروض');
                  if (perms.can_view_customers) pages.push('العملاء');
                  if (perms.can_view_najiz) pages.push('ناجز');
                  if (perms.can_view_analytics) pages.push('التحليلات');
                  if (perms.can_view_settings) pages.push('الإعدادات');

                  return (
                    <tr key={emp.id}>
                      <td>{emp.full_name}</td>
                      <td>{emp.email}</td>
                      <td>
                        <span className={`status-chip ${emp.deleted_at ? 'off' : 'on'}`}>
                          {emp.deleted_at ? 'معطل' : 'مفعل'}
                        </span>
                      </td>
                      <td>
                        <div className="perms-tags">
                          {pages.length ? pages.map((label) => <span key={label} className="tag">{label}</span>) : <span className="muted">بدون صلاحيات</span>}
                        </div>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => {
                              setEditingEmployee(emp);
                              setShowEmployeeModal(true);
                            }}
                          >
                            تعديل
                          </button>

                          {!emp.deleted_at ? (
                            <button
                              className="btn btn-danger btn-xs"
                              disabled={busyEmployeeId === emp.id}
                              onClick={() => handleDisableEmployee(emp.id)}
                            >
                              {busyEmployeeId === emp.id ? '...' : 'تعطيل'}
                            </button>
                          ) : (
                            <button
                              className="btn btn-success btn-xs"
                              disabled={busyEmployeeId === emp.id}
                              onClick={() => handleActivateEmployee(emp.id)}
                            >
                              {busyEmployeeId === emp.id ? '...' : 'تفعيل'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {employees.length === 0 && (
                  <tr>
                    <td colSpan={5} className="empty-cell">لا يوجد موظفون حاليًا.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {showEmployeeModal && (
        <EmployeeModal
          employee={editingEmployee}
          onClose={() => {
            setShowEmployeeModal(false);
            setEditingEmployee(null);
          }}
          onSaved={async (message) => {
            setMessages((m) => ({ ...m, employees: message }));
            setShowEmployeeModal(false);
            setEditingEmployee(null);
            await fetchEmployees();
          }}
        />
      )}
    </div>
  );
}

type EmployeeModalProps = {
  employee: Employee | null;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
};

function EmployeeModal({ employee, onClose, onSaved }: EmployeeModalProps) {
  const isEdit = !!employee;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: employee?.full_name || '',
    email: employee?.email || '',
    password: '',
    permissions: mergePermissions(employee?.permissions),
  });

  const updatePermission = (key: PermissionKey, value: boolean) => {
    setForm((prev) => {
      const next = { ...prev.permissions, [key]: value };
      // Najiz currently relies on loans endpoints.
      if (key === 'can_view_najiz' && value) {
        next.can_view_loans = true;
      }
      if (key === 'can_view_loans' && !value) {
        next.can_view_najiz = false;
        next.can_add_loans = false;
        next.can_upload_loans = false;
      }
      if ((key === 'can_add_loans' || key === 'can_upload_loans') && value) {
        next.can_view_loans = true;
      }
      return { ...prev, permissions: next };
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload: {
        fullName: string;
        email: string;
        permissions: EmployeePermissions;
        password?: string;
      } = {
        fullName: form.fullName,
        email: form.email,
        permissions: form.permissions,
      };

      if (!isEdit || form.password.trim()) {
        payload.password = form.password;
      }

      if (isEdit && employee) {
        await employeesAPI.update(employee.id, payload);
        await onSaved('تم تحديث بيانات الموظف وصلاحياته.');
      } else {
        await employeesAPI.create(payload);
        await onSaved('تم إضافة الموظف بنجاح.');
      }
    } catch (error: unknown) {
      setError(extractApiError(error, 'فشلت العملية.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-box glass-card">
        <div className="modal-header">
          <h3>{isEdit ? 'تعديل الموظف' : 'إضافة موظف جديد'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form className="modal-form" onSubmit={submit}>
          <div className="form-row-2">
            <div className="form-group">
              <label>الاسم الكامل</label>
              <input className="input" value={form.fullName} onChange={(e) => setForm((p) => ({ ...p, fullName: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>البريد الإلكتروني</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required />
            </div>
          </div>

          <div className="form-group">
            <label>{isEdit ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}</label>
            <input className="input" type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required={!isEdit} minLength={8} />
          </div>

          <div className="perm-grid">
            {PERMISSION_LABELS.map((item) => (
              <label key={item.key} className="perm-item">
                <input
                  type="checkbox"
                  checked={!!form.permissions[item.key]}
                  onChange={(e) => updatePermission(item.key, e.target.checked)}
                />
                <div>
                  <strong>{item.label}</strong>
                  <span>{item.hint}</span>
                </div>
              </label>
            ))}
          </div>

          {error && <div className="message error">{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>إلغاء</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة الموظف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
