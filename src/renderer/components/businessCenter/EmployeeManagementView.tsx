import {
  ArrowPathIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeSlashIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PlusIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UserMinusIcon,
  UserPlusIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';

import {
  type BusinessApplication,
  businessCenterService,
  type BusinessDepartment,
  type BusinessEmployee,
  BusinessEmployeeRole,
  type BusinessEmployeeRoleValue,
  BusinessEmployeeStatus,
  type BusinessEmployeeStatusValue,
  type BusinessEmployeeSummary,
} from '../../services/businessCenter';
import { i18nService } from '../../services/i18n';

interface EmployeeManagementViewProps {
  departments: BusinessDepartment[];
  currentRole: string;
  onSummaryChange?: (summary: BusinessEmployeeSummary) => void;
}

type DrawerMode = 'create' | 'view' | 'edit' | 'applications';

interface EmployeeFilters {
  name: string;
  username: string;
  departmentId: string;
  status: '' | BusinessEmployeeStatusValue;
}

interface EmployeeFormState {
  username: string;
  password: string;
  name: string;
  phone: string;
  email: string;
  role: Exclude<BusinessEmployeeRoleValue, 'owner'>;
  status: BusinessEmployeeStatusValue;
  departmentId: string;
  applicationIds: string[];
  forcePasswordChange: boolean;
}

interface ResetPasswordState {
  employee: BusinessEmployee;
  password: string;
  confirmation: string;
  forcePasswordChange: boolean;
}

interface StatusConfirmState {
  employee: BusinessEmployee;
  nextStatus: BusinessEmployeeStatusValue;
}

const DEFAULT_PAGE_SIZE = 10;
const EMPTY_SUMMARY: BusinessEmployeeSummary = {
  total: 0,
  active: 0,
  disabled: 0,
  addedThisMonth: 0,
};
const EMPTY_FILTERS: EmployeeFilters = {
  name: '',
  username: '',
  departmentId: '',
  status: '',
};

const showToast = (message: string): void => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const emptyEmployeeForm = (): EmployeeFormState => ({
  username: '',
  password: '',
  name: '',
  phone: '',
  email: '',
  role: BusinessEmployeeRole.Employee,
  status: BusinessEmployeeStatus.Active,
  departmentId: '',
  applicationIds: [],
  forcePasswordChange: true,
});

const employeeFormFromEmployee = (employee: BusinessEmployee): EmployeeFormState => ({
  username: employee.username,
  password: '',
  name: employee.name,
  phone: employee.phone ?? '',
  email: employee.email ?? '',
  role: employee.role === BusinessEmployeeRole.Admin
    ? BusinessEmployeeRole.Admin
    : BusinessEmployeeRole.Employee,
  status: employee.status,
  departmentId: employee.primaryDepartmentId ?? employee.departmentIds[0] ?? '',
  applicationIds: employee.applicationIds ?? [],
  forcePasswordChange: employee.forcePasswordChange,
});

const maskPhone = (phone?: string): string => {
  const value = phone?.trim() ?? '';
  if (value.length < 7) return value || '-';
  return `${value.slice(0, 3)}****${value.slice(-4)}`;
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(i18nService.getLanguage() === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date).replace(/\//g, '-');
};

const paginationItems = (page: number, pages: number): Array<number | 'ellipsis'> => {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  const values = new Set([1, pages, page - 1, page, page + 1]);
  const sorted = [...values].filter((value) => value > 0 && value <= pages).sort((a, b) => a - b);
  const result: Array<number | 'ellipsis'> = [];
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('ellipsis');
    result.push(value);
  });
  return result;
};

const EmployeeManagementView: React.FC<EmployeeManagementViewProps> = ({
  departments,
  currentRole,
  onSummaryChange,
}) => {
  const t = useCallback((key: string) => i18nService.t(key), []);
  const [employees, setEmployees] = useState<BusinessEmployee[]>([]);
  const [applications, setApplications] = useState<BusinessApplication[]>([]);
  const [summary, setSummary] = useState<BusinessEmployeeSummary>(EMPTY_SUMMARY);
  const [draftFilters, setDraftFilters] = useState<EmployeeFilters>(EMPTY_FILTERS);
  const [filters, setFilters] = useState<EmployeeFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [pages, setPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<BusinessEmployee | null>(null);
  const [employeeForm, setEmployeeForm] = useState<EmployeeFormState>(emptyEmployeeForm);
  const [isDrawerLoading, setIsDrawerLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [resetState, setResetState] = useState<ResetPasswordState | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [statusConfirm, setStatusConfirm] = useState<StatusConfirmState | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.status === BusinessEmployeeStatus.Active),
    [departments],
  );
  const currentUserIsOwner = currentRole === BusinessEmployeeRole.Owner;
  const canManageTarget = useCallback((employee: BusinessEmployee): boolean => {
    if (employee.role === BusinessEmployeeRole.Owner) return false;
    if (currentUserIsOwner) return true;
    return employee.role === BusinessEmployeeRole.Employee;
  }, [currentUserIsOwner]);

  const loadEmployees = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await businessCenterService.getEmployees({
        page,
        pageSize,
        name: filters.name,
        username: filters.username,
        departmentId: filters.departmentId,
        status: filters.status,
      });
      setEmployees(result.items);
      setTotal(result.total);
      setPages(result.pages);
      setSummary(result.summary ?? EMPTY_SUMMARY);
      onSummaryChange?.(result.summary ?? EMPTY_SUMMARY);
      if (result.pages > 0 && page > result.pages) setPage(result.pages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('businessCenterEmployeeLoadFailed'));
    } finally {
      setIsLoading(false);
    }
  }, [filters, onSummaryChange, page, pageSize, t]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees, refreshKey]);

  useEffect(() => {
    const loadApplications = async () => {
      try {
        setApplications(await businessCenterService.getAvailableApplications());
      } catch (error) {
        showToast(error instanceof Error ? error.message : t('businessCenterEmployeeApplicationsLoadFailed'));
      }
    };
    void loadApplications();
  }, [t]);

  const applyFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPage(1);
    setFilters({ ...draftFilters });
  };

  const resetFilters = () => {
    setDraftFilters(EMPTY_FILTERS);
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const openCreateDrawer = () => {
    setSelectedEmployee(null);
    setEmployeeForm(emptyEmployeeForm());
    setDrawerMode('create');
  };

  const openEmployeeDrawer = async (mode: Exclude<DrawerMode, 'create'>, employee: BusinessEmployee) => {
    setDrawerMode(mode);
    setSelectedEmployee(employee);
    setEmployeeForm(employeeFormFromEmployee(employee));
    setIsDrawerLoading(true);
    try {
      const detail = await businessCenterService.getEmployee(employee.id);
      setSelectedEmployee(detail);
      setEmployeeForm(employeeFormFromEmployee(detail));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('businessCenterEmployeeDetailLoadFailed'));
      setDrawerMode(null);
    } finally {
      setIsDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    if (isSaving) return;
    setDrawerMode(null);
    setSelectedEmployee(null);
    setEmployeeForm(emptyEmployeeForm());
  };

  const validateEmployeeForm = (): boolean => {
    if (!employeeForm.name.trim()) {
      showToast(t('businessCenterEmployeeNameRequired'));
      return false;
    }
    if (drawerMode === 'create' && !employeeForm.username.trim()) {
      showToast(t('businessCenterEmployeeUsernameRequired'));
      return false;
    }
    if (drawerMode === 'create' && employeeForm.password.length < 6) {
      showToast(t('businessCenterEmployeePasswordMin'));
      return false;
    }
    if (!employeeForm.phone.trim()) {
      showToast(t('businessCenterEmployeePhoneRequired'));
      return false;
    }
    if (!employeeForm.departmentId) {
      showToast(t('businessCenterEmployeeDepartmentRequired'));
      return false;
    }
    return true;
  };

  const saveDrawer = async (continueAdding = false) => {
    if (!drawerMode || drawerMode === 'view') return;
    if (drawerMode !== 'applications' && !validateEmployeeForm()) return;
    if (drawerMode !== 'create' && !selectedEmployee) return;
    setIsSaving(true);
    try {
      if (drawerMode === 'create') {
        await businessCenterService.createEmployee({
          username: employeeForm.username.trim(),
          password: employeeForm.password,
          name: employeeForm.name.trim(),
          phone: employeeForm.phone.trim(),
          email: employeeForm.email.trim(),
          role: employeeForm.role,
          status: employeeForm.status,
          forcePasswordChange: employeeForm.forcePasswordChange,
          departmentIds: [employeeForm.departmentId],
          applicationIds: employeeForm.applicationIds,
        });
      } else if (drawerMode === 'edit') {
        await businessCenterService.updateEmployee(selectedEmployee!.id, {
          name: employeeForm.name.trim(),
          phone: employeeForm.phone.trim(),
          email: employeeForm.email.trim(),
          role: employeeForm.role,
          status: employeeForm.status,
          departmentIds: [employeeForm.departmentId],
          applicationIds: employeeForm.applicationIds,
        });
      } else {
        await businessCenterService.setEmployeeApplications(
          selectedEmployee!.id,
          employeeForm.applicationIds,
        );
      }
      setRefreshKey((value) => value + 1);
      if (continueAdding && drawerMode === 'create') {
        setEmployeeForm(emptyEmployeeForm());
      } else {
        setDrawerMode(null);
        setSelectedEmployee(null);
        setEmployeeForm(emptyEmployeeForm());
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('businessCenterEmployeeSaveFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  const openResetPassword = (employee: BusinessEmployee) => {
    setResetState({
      employee,
      password: '',
      confirmation: '',
      forcePasswordChange: true,
    });
    setShowResetPassword(false);
  };

  const resetPassword = async () => {
    if (!resetState) return;
    if (resetState.password.length < 6) {
      showToast(t('businessCenterEmployeePasswordMin'));
      return;
    }
    if (resetState.password !== resetState.confirmation) {
      showToast(t('businessCenterEmployeePasswordMismatch'));
      return;
    }
    setIsResettingPassword(true);
    try {
      await businessCenterService.resetEmployeePassword(resetState.employee.id, {
        password: resetState.password,
        forcePasswordChange: resetState.forcePasswordChange,
      });
      setResetState(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('businessCenterEmployeePasswordResetFailed'));
    } finally {
      setIsResettingPassword(false);
    }
  };

  const changeStatus = async () => {
    if (!statusConfirm) return;
    setIsChangingStatus(true);
    try {
      await businessCenterService.updateEmployee(statusConfirm.employee.id, {
        status: statusConfirm.nextStatus,
      });
      setStatusConfirm(null);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      showToast(error instanceof Error ? error.message : t('businessCenterEmployeeStatusFailed'));
    } finally {
      setIsChangingStatus(false);
    }
  };

  const toggleApplication = (applicationId: string) => {
    setEmployeeForm((current) => ({
      ...current,
      applicationIds: current.applicationIds.includes(applicationId)
        ? current.applicationIds.filter((id) => id !== applicationId)
        : [...current.applicationIds, applicationId],
    }));
  };

  const activeRate = summary.total > 0 ? Math.round((summary.active / summary.total) * 100) : 0;
  const disabledRate = summary.total > 0 ? Math.round((summary.disabled / summary.total) * 100) : 0;
  const pageItems = paginationItems(page, pages);
  const drawerTitle = drawerMode === 'create'
    ? t('businessCenterEmployeeCreate')
    : drawerMode === 'view'
      ? t('businessCenterEmployeeViewTitle')
      : drawerMode === 'edit'
        ? t('businessCenterEmployeeEditTitle')
        : t('businessCenterEmployeeApplicationsTitle');

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-normal text-[#0d1730]">{t('businessCenterEmployeeTitle')}</h2>
          <p className="mt-1 text-sm text-[#64748b]">{t('businessCenterEmployeeDescription')}</p>
        </div>
        <button
          type="button"
          onClick={openCreateDrawer}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.2)] transition-colors hover:bg-blue-700"
        >
          <PlusIcon className="h-4 w-4" />
          {t('businessCenterEmployeeCreate')}
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { icon: UsersIcon, label: t('businessCenterEmployeeTotal'), value: summary.total, detail: t('businessCenterEmployeeAllMembers'), tone: 'blue' },
          { icon: UserGroupIcon, label: t('businessCenterEmployeeActive'), value: summary.active, detail: `${activeRate}%`, tone: 'emerald' },
          { icon: UserMinusIcon, label: t('businessCenterEmployeeDisabled'), value: summary.disabled, detail: `${disabledRate}%`, tone: 'orange' },
          { icon: UserPlusIcon, label: t('businessCenterEmployeeAddedThisMonth'), value: summary.addedThisMonth, detail: t('businessCenterEmployeeCurrentMonth'), tone: 'violet' },
        ].map((item) => {
          const Icon = item.icon;
          const tone = item.tone === 'emerald'
            ? 'bg-emerald-50 text-emerald-600'
            : item.tone === 'orange'
              ? 'bg-orange-50 text-orange-500'
              : item.tone === 'violet'
                ? 'bg-violet-50 text-violet-600'
                : 'bg-blue-50 text-blue-600';
          return (
            <article key={item.label} className="flex min-h-[106px] items-center gap-4 rounded-lg border border-[#e1e8f2] bg-white px-5 py-4 shadow-[0_8px_22px_rgba(15,35,80,0.035)]">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tone}`}>
                <Icon className="h-6 w-6" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-[#6b7890]">{item.label}</p>
                <strong className="mt-1 block text-2xl font-bold leading-7 text-[#0d1730]">{item.value}</strong>
                <span className="mt-1 block text-xs text-[#64748b]">{item.detail}</span>
              </div>
            </article>
          );
        })}
      </section>

      <form onSubmit={applyFilters} className="rounded-lg border border-[#e1e8f2] bg-white p-4 shadow-[0_8px_22px_rgba(15,35,80,0.035)]">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_auto] xl:items-end">
          <FilterField label={t('businessCenterEmployeeNameSearch')}>
            <input
              value={draftFilters.name}
              onChange={(event) => setDraftFilters((current) => ({ ...current, name: event.target.value }))}
              className="h-10 w-full rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-blue-400"
              placeholder={t('businessCenterEmployeeNamePlaceholder')}
            />
          </FilterField>
          <FilterField label={t('businessCenterEmployeeUsernameSearch')}>
            <input
              value={draftFilters.username}
              onChange={(event) => setDraftFilters((current) => ({ ...current, username: event.target.value }))}
              className="h-10 w-full rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-blue-400"
              placeholder={t('businessCenterEmployeeUsernamePlaceholder')}
            />
          </FilterField>
          <FilterField label={t('businessCenterEmployeeDepartmentFilter')}>
            <select
              value={draftFilters.departmentId}
              onChange={(event) => setDraftFilters((current) => ({ ...current, departmentId: event.target.value }))}
              className="h-10 w-full rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors focus:border-blue-400"
            >
              <option value="">{t('businessCenterEmployeeAllDepartments')}</option>
              {departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </FilterField>
          <FilterField label={t('businessCenterEmployeeStatusFilter')}>
            <select
              value={draftFilters.status}
              onChange={(event) => setDraftFilters((current) => ({ ...current, status: event.target.value as EmployeeFilters['status'] }))}
              className="h-10 w-full rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors focus:border-blue-400"
            >
              <option value="">{t('businessCenterEmployeeAllStatuses')}</option>
              <option value={BusinessEmployeeStatus.Active}>{t('businessCenterEmployeeStatusActive')}</option>
              <option value={BusinessEmployeeStatus.Disabled}>{t('businessCenterEmployeeStatusDisabled')}</option>
            </select>
          </FilterField>
          <div className="flex items-center gap-2 md:col-span-2 xl:col-span-1">
            <button type="submit" className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700 xl:flex-none">
              <MagnifyingGlassIcon className="h-4 w-4" />
              {t('businessCenterEmployeeSearch')}
            </button>
            <button type="button" onClick={resetFilters} className="inline-flex h-10 flex-1 items-center justify-center rounded-md border border-[#d8e1ee] bg-white px-4 text-sm font-semibold text-[#354560] transition-colors hover:bg-[#f8fbff] xl:flex-none">
              {t('businessCenterEmployeeReset')}
            </button>
            <button
              type="button"
              onClick={() => setRefreshKey((value) => value + 1)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#d8e1ee] bg-white text-[#64748b] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
              title={t('businessCenterEmployeeRefresh')}
              aria-label={t('businessCenterEmployeeRefresh')}
            >
              <ArrowPathIcon className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </form>

      <section className="overflow-hidden rounded-lg border border-[#e1e8f2] bg-white shadow-[0_8px_22px_rgba(15,35,80,0.035)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1320px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e6ebf2] bg-[#fbfcfe] text-xs font-semibold text-[#64748b]">
                <TableHeader>{t('businessCenterEmployeeName')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeUsername')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeePhone')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeEmail')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeDepartment')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeApplicationCount')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeStatus')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeCreatedAt')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeLastLoginAt')}</TableHeader>
                <TableHeader>{t('businessCenterEmployeeActions')}</TableHeader>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => {
                const manageable = canManageTarget(employee);
                return (
                  <tr key={employee.id} className="border-b border-[#edf2f8] text-[#22304a] last:border-b-0 hover:bg-[#f8fbff]">
                    <td className="whitespace-nowrap px-4 py-3 font-semibold text-[#0d1730]">{employee.name || employee.username}</td>
                    <td className="whitespace-nowrap px-4 py-3">{employee.username}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-[#52627c]">{maskPhone(employee.phone)}</td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-[#52627c]" title={employee.email}>{employee.email || '-'}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-[#52627c]" title={employee.departmentNames.join(' / ')}>{employee.departmentNames.join(' / ') || '-'}</td>
                    <td className="px-4 py-3 text-center font-semibold text-[#354560]">{employee.applicationCount}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${employee.status === BusinessEmployeeStatus.Disabled ? 'bg-orange-50 text-orange-600' : 'bg-emerald-50 text-emerald-600'}`}>
                        {employee.status === BusinessEmployeeStatus.Disabled ? t('businessCenterEmployeeStatusDisabled') : t('businessCenterEmployeeStatusActive')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#52627c]">{formatDateTime(employee.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#52627c]">{formatDateTime(employee.lastLoginAt)}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-3 text-xs font-semibold">
                        <ActionButton onClick={() => void openEmployeeDrawer('view', employee)}>{t('businessCenterEmployeeView')}</ActionButton>
                        <ActionButton disabled={!manageable} onClick={() => void openEmployeeDrawer('edit', employee)}>{t('businessCenterEmployeeEdit')}</ActionButton>
                        <ActionButton disabled={!manageable} onClick={() => void openEmployeeDrawer('applications', employee)}>{t('businessCenterEmployeeConfigureApps')}</ActionButton>
                        <ActionButton disabled={!manageable} onClick={() => openResetPassword(employee)}>{t('businessCenterEmployeeResetPassword')}</ActionButton>
                        <ActionButton
                          disabled={!manageable}
                          danger={employee.status === BusinessEmployeeStatus.Active}
                          onClick={() => setStatusConfirm({
                            employee,
                            nextStatus: employee.status === BusinessEmployeeStatus.Active
                              ? BusinessEmployeeStatus.Disabled
                              : BusinessEmployeeStatus.Active,
                          })}
                        >
                          {employee.status === BusinessEmployeeStatus.Active ? t('businessCenterEmployeeDisable') : t('businessCenterEmployeeEnable')}
                        </ActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isLoading && employees.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-[#64748b]">{t('businessCenterEmployeeEmpty')}</td></tr>
              )}
              {isLoading && employees.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-14 text-center text-sm text-[#64748b]">{t('businessCenterEmployeeLoading')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex flex-col gap-3 border-t border-[#e6ebf2] px-4 py-3 text-sm text-[#64748b] sm:flex-row sm:items-center sm:justify-between">
          <span>{t('businessCenterEmployeeTotalPrefix')} {total} {t('businessCenterEmployeeTotalSuffix')}</span>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-9 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#354560] outline-none focus:border-blue-400"
              aria-label={t('businessCenterEmployeePageSize')}
            >
              {[10, 20, 50].map((size) => <option key={size} value={size}>{size} {t('businessCenterEmployeePerPage')}</option>)}
            </select>
            <button type="button" disabled={page <= 1 || isLoading} onClick={() => setPage((value) => value - 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8e1ee] text-[#354560] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('businessCenterEmployeePreviousPage')}>
              <ChevronLeftIcon className="h-4 w-4" />
            </button>
            {pageItems.map((item, index) => item === 'ellipsis'
              ? <span key={`ellipsis-${index}`} className="px-1">...</span>
              : (
                <button key={item} type="button" onClick={() => setPage(item)} className={`h-9 min-w-9 rounded-md px-2 text-sm font-semibold ${page === item ? 'bg-blue-600 text-white' : 'border border-transparent text-[#354560] hover:border-[#d8e1ee] hover:bg-[#f8fbff]'}`}>{item}</button>
              ))}
            <button type="button" disabled={page >= pages || isLoading || pages === 0} onClick={() => setPage((value) => value + 1)} className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#d8e1ee] text-[#354560] hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-40" aria-label={t('businessCenterEmployeeNextPage')}>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </section>

      {drawerMode && (
        <div className="non-draggable fixed inset-0 z-[9998] flex justify-end bg-[#07111f]/35 backdrop-blur-[1px]" onClick={closeDrawer}>
          <aside className="flex h-full w-full max-w-[540px] flex-col border-l border-[#e1e8f2] bg-white shadow-[-24px_0_70px_rgba(15,23,42,0.18)]" onClick={(event) => event.stopPropagation()} aria-label={drawerTitle}>
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e6ebf2] px-5">
              <div className="min-w-0">
                <h3 className="truncate text-lg font-bold text-[#0d1730]">{drawerTitle}</h3>
                {selectedEmployee && drawerMode !== 'create' && <p className="mt-0.5 truncate text-xs text-[#64748b]">{selectedEmployee.name} · {selectedEmployee.username}</p>}
              </div>
              <button type="button" onClick={closeDrawer} disabled={isSaving} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0d1730] disabled:opacity-50" aria-label={t('businessCenterEmployeeClose')}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
              {isDrawerLoading ? (
                <div className="flex h-48 items-center justify-center text-sm text-[#64748b]">{t('businessCenterEmployeeDetailLoading')}</div>
              ) : drawerMode === 'applications' ? (
                <ApplicationPicker applications={applications} selectedIds={employeeForm.applicationIds} disabled={isSaving} onToggle={toggleApplication} />
              ) : (
                <EmployeeForm
                  mode={drawerMode}
                  form={employeeForm}
                  departments={activeDepartments}
                  applications={applications}
                  currentUserIsOwner={currentUserIsOwner}
                  disabled={isSaving || drawerMode === 'view'}
                  onChange={setEmployeeForm}
                  onToggleApplication={toggleApplication}
                />
              )}
            </div>
            {drawerMode !== 'view' && (
              <div className="flex shrink-0 flex-wrap justify-end gap-3 border-t border-[#e6ebf2] bg-white px-5 py-4">
                <button type="button" onClick={closeDrawer} disabled={isSaving} className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8e1ee] bg-white px-5 text-sm font-semibold text-[#354560] transition-colors hover:bg-[#f8fbff] disabled:opacity-50">{t('businessCenterEmployeeCancel')}</button>
                {drawerMode === 'create' && <button type="button" onClick={() => void saveDrawer(true)} disabled={isSaving} className="inline-flex h-10 items-center justify-center rounded-md border border-blue-200 bg-blue-50 px-5 text-sm font-semibold text-blue-600 transition-colors hover:bg-blue-100 disabled:opacity-50">{t('businessCenterEmployeeSaveAndContinue')}</button>}
                <button type="button" onClick={() => void saveDrawer(false)} disabled={isSaving} className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50">{isSaving ? t('businessCenterEmployeeSaving') : t('businessCenterEmployeeSave')}</button>
              </div>
            )}
          </aside>
        </div>
      )}

      {resetState && (
        <ModalShell title={t('businessCenterEmployeeResetPasswordTitle')} onClose={() => !isResettingPassword && setResetState(null)}>
          <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-600">{t('businessCenterEmployeeResetPasswordHint')}</div>
          <PasswordField label={t('businessCenterEmployeeNewPassword')} value={resetState.password} visible={showResetPassword} disabled={isResettingPassword} onToggle={() => setShowResetPassword((value) => !value)} onChange={(value) => setResetState((current) => current ? { ...current, password: value } : current)} />
          <PasswordField label={t('businessCenterEmployeeConfirmPassword')} value={resetState.confirmation} visible={showResetPassword} disabled={isResettingPassword} onToggle={() => setShowResetPassword((value) => !value)} onChange={(value) => setResetState((current) => current ? { ...current, confirmation: value } : current)} />
          <ToggleRow checked={resetState.forcePasswordChange} disabled={isResettingPassword} label={t('businessCenterEmployeeForcePasswordChange')} onChange={(checked) => setResetState((current) => current ? { ...current, forcePasswordChange: checked } : current)} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setResetState(null)} disabled={isResettingPassword} className="h-10 rounded-md border border-[#d8e1ee] px-5 text-sm font-semibold text-[#354560] hover:bg-[#f8fbff] disabled:opacity-50">{t('businessCenterEmployeeCancel')}</button>
            <button type="button" onClick={() => void resetPassword()} disabled={isResettingPassword} className="h-10 rounded-md bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{isResettingPassword ? t('businessCenterEmployeeResetting') : t('businessCenterEmployeeConfirmReset')}</button>
          </div>
        </ModalShell>
      )}

      {statusConfirm && (
        <ModalShell title={statusConfirm.nextStatus === BusinessEmployeeStatus.Disabled ? t('businessCenterEmployeeDisableTitle') : t('businessCenterEmployeeEnableTitle')} onClose={() => !isChangingStatus && setStatusConfirm(null)} compact>
          <div className="flex flex-col items-center text-center">
            <div className={`mb-3 flex h-11 w-11 items-center justify-center rounded-full ${statusConfirm.nextStatus === BusinessEmployeeStatus.Disabled ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
              {statusConfirm.nextStatus === BusinessEmployeeStatus.Disabled ? <NoSymbolIcon className="h-5 w-5" /> : <CheckIcon className="h-5 w-5" />}
            </div>
            <p className="text-sm leading-6 text-[#52627c]">{statusConfirm.nextStatus === BusinessEmployeeStatus.Disabled ? t('businessCenterEmployeeDisableMessage') : t('businessCenterEmployeeEnableMessage')} “{statusConfirm.employee.name || statusConfirm.employee.username}”?</p>
            <div className="mt-5 flex w-full gap-3">
              <button type="button" onClick={() => setStatusConfirm(null)} disabled={isChangingStatus} className="h-10 flex-1 rounded-md border border-[#d8e1ee] text-sm font-semibold text-[#354560] hover:bg-[#f8fbff] disabled:opacity-50">{t('businessCenterEmployeeCancel')}</button>
              <button type="button" onClick={() => void changeStatus()} disabled={isChangingStatus} className={`h-10 flex-1 rounded-md text-sm font-semibold text-white disabled:opacity-50 ${statusConfirm.nextStatus === BusinessEmployeeStatus.Disabled ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'}`}>{isChangingStatus ? t('businessCenterEmployeeProcessing') : statusConfirm.nextStatus === BusinessEmployeeStatus.Disabled ? t('businessCenterEmployeeDisable') : t('businessCenterEmployeeEnable')}</button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
};

const FilterField: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-[#52627c]">{label}{children}</label>
);

const TableHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th className="whitespace-nowrap px-4 py-3 font-semibold">{children}</th>
);

const ActionButton: React.FC<{
  children: React.ReactNode;
  disabled?: boolean;
  danger?: boolean;
  onClick: () => void;
}> = ({ children, disabled, danger, onClick }) => (
  <button type="button" disabled={disabled} onClick={onClick} className={`${danger ? 'text-red-500 hover:text-red-600' : 'text-blue-600 hover:text-blue-700'} transition-colors disabled:cursor-not-allowed disabled:text-[#b4becd]`}>
    {children}
  </button>
);

const FormField: React.FC<{ label: string; required?: boolean; children: React.ReactNode }> = ({ label, required, children }) => (
  <label className="grid gap-1.5 text-sm text-[#354560]">
    <span className="font-semibold">{required && <span className="text-red-500">* </span>}{label}</span>
    {children}
  </label>
);

const ToggleRow: React.FC<{
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}> = ({ checked, disabled, label, onChange }) => (
  <label className="flex items-center justify-between gap-4 rounded-md border border-[#e1e8f2] px-3 py-3 text-sm font-semibold text-[#354560]">
    <span>{label}</span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" />
    <span className="relative h-6 w-11 shrink-0 rounded-full bg-[#cbd5e1] transition-colors peer-checked:bg-blue-600 peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-5" />
  </label>
);

const ApplicationPicker: React.FC<{
  applications: BusinessApplication[];
  selectedIds: string[];
  disabled?: boolean;
  onToggle: (id: string) => void;
}> = ({ applications, selectedIds, disabled, onToggle }) => {
  const t = i18nService.t.bind(i18nService);
  return (
    <div className="space-y-3">
      <div>
        <h4 className="text-sm font-bold text-[#0d1730]">{t('businessCenterEmployeeAvailableApplications')}</h4>
        <p className="mt-1 text-xs leading-5 text-[#64748b]">{t('businessCenterEmployeeApplicationHint')}</p>
      </div>
      {applications.length === 0 ? (
        <div className="rounded-md border border-dashed border-[#d8e1ee] px-4 py-10 text-center text-sm text-[#64748b]">{t('businessCenterEmployeeNoApplications')}</div>
      ) : applications.map((application) => (
        <label key={application.id} className="flex cursor-pointer items-center gap-3 rounded-md border border-[#e1e8f2] px-3 py-3 transition-colors hover:border-blue-200 hover:bg-blue-50/50">
          <input type="checkbox" checked={selectedIds.includes(application.id)} disabled={disabled} onChange={() => onToggle(application.id)} className="h-4 w-4 rounded accent-blue-600" />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600"><Squares2X2Icon className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[#22304a]">{application.name}</strong><span className="mt-0.5 block truncate text-xs text-[#64748b]">{application.code}</span></span>
        </label>
      ))}
    </div>
  );
};

const EmployeeForm: React.FC<{
  mode: DrawerMode;
  form: EmployeeFormState;
  departments: BusinessDepartment[];
  applications: BusinessApplication[];
  currentUserIsOwner: boolean;
  disabled: boolean;
  onChange: React.Dispatch<React.SetStateAction<EmployeeFormState>>;
  onToggleApplication: (id: string) => void;
}> = ({ mode, form, departments, applications, currentUserIsOwner, disabled, onChange, onToggleApplication }) => {
  const t = i18nService.t.bind(i18nService);
  const inputClassName = 'h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-blue-400 disabled:cursor-not-allowed disabled:bg-[#f5f7fa] disabled:text-[#64748b]';
  return (
    <fieldset disabled={disabled} className="space-y-4 disabled:opacity-80">
      <FormField label={t('businessCenterEmployeeName')} required><input value={form.name} onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))} className={inputClassName} placeholder={t('businessCenterEmployeeNameInput')} /></FormField>
      <FormField label={t('businessCenterEmployeeUsername')} required><input value={form.username} disabled={disabled || mode !== 'create'} onChange={(event) => onChange((current) => ({ ...current, username: event.target.value }))} className={inputClassName} placeholder={t('businessCenterEmployeeUsernameInput')} /></FormField>
      {mode === 'create' && <FormField label={t('businessCenterEmployeeInitialPassword')} required><input type="password" value={form.password} onChange={(event) => onChange((current) => ({ ...current, password: event.target.value }))} className={inputClassName} placeholder={t('businessCenterEmployeePasswordInput')} /><span className="text-xs font-normal text-[#94a3b8]">{t('businessCenterEmployeePasswordHelp')}</span></FormField>}
      <FormField label={t('businessCenterEmployeePhone')} required><input value={form.phone} onChange={(event) => onChange((current) => ({ ...current, phone: event.target.value }))} className={inputClassName} placeholder={t('businessCenterEmployeePhoneInput')} /></FormField>
      <FormField label={t('businessCenterEmployeeEmail')}><input type="email" value={form.email} onChange={(event) => onChange((current) => ({ ...current, email: event.target.value }))} className={inputClassName} placeholder={t('businessCenterEmployeeEmailInput')} /></FormField>
      <FormField label={t('businessCenterEmployeeDepartment')} required><select value={form.departmentId} onChange={(event) => onChange((current) => ({ ...current, departmentId: event.target.value }))} className={inputClassName}><option value="">{t('businessCenterEmployeeDepartmentInput')}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}</select></FormField>
      <FormField label={t('businessCenterEmployeeRole')} required><select value={form.role} onChange={(event) => onChange((current) => ({ ...current, role: event.target.value as EmployeeFormState['role'] }))} className={inputClassName}><option value={BusinessEmployeeRole.Employee}>{t('businessCenterEmployeeRoleEmployee')}</option>{currentUserIsOwner && <option value={BusinessEmployeeRole.Admin}>{t('businessCenterEmployeeRoleAdmin')}</option>}</select></FormField>
      <ApplicationPicker applications={applications} selectedIds={form.applicationIds} disabled={disabled} onToggle={onToggleApplication} />
      {mode === 'create' && <ToggleRow checked={form.forcePasswordChange} disabled={disabled} label={t('businessCenterEmployeeForcePasswordChange')} onChange={(checked) => onChange((current) => ({ ...current, forcePasswordChange: checked }))} />}
      <div className="grid gap-2 text-sm font-semibold text-[#354560]"><span>{t('businessCenterEmployeeStatus')}</span><div className="flex gap-6"><label className="inline-flex items-center gap-2"><input type="radio" checked={form.status === BusinessEmployeeStatus.Active} onChange={() => onChange((current) => ({ ...current, status: BusinessEmployeeStatus.Active }))} className="h-4 w-4 accent-blue-600" />{t('businessCenterEmployeeStatusActive')}</label><label className="inline-flex items-center gap-2"><input type="radio" checked={form.status === BusinessEmployeeStatus.Disabled} onChange={() => onChange((current) => ({ ...current, status: BusinessEmployeeStatus.Disabled }))} className="h-4 w-4 accent-blue-600" />{t('businessCenterEmployeeStatusDisabled')}</label></div></div>
    </fieldset>
  );
};

const PasswordField: React.FC<{
  label: string;
  value: string;
  visible: boolean;
  disabled?: boolean;
  onToggle: () => void;
  onChange: (value: string) => void;
}> = ({ label, value, visible, disabled, onToggle, onChange }) => (
  <FormField label={label} required>
    <div className="relative"><input type={visible ? 'text' : 'password'} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 w-full rounded-md border border-[#d8e1ee] bg-white px-3 pr-10 text-sm text-[#22304a] outline-none focus:border-blue-400 disabled:bg-[#f5f7fa]" /><button type="button" onClick={onToggle} disabled={disabled} className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9]" aria-label={label}>{visible ? <EyeSlashIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}</button></div>
  </FormField>
);

const ModalShell: React.FC<{
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  compact?: boolean;
}> = ({ title, children, onClose, compact }) => (
  <div className="non-draggable fixed inset-0 z-[9999] flex items-center justify-center bg-[#07111f]/40 px-4 py-6 backdrop-blur-[2px]" onClick={onClose}>
    <section className={`w-full rounded-lg border border-[#e1e8f2] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.24)] ${compact ? 'max-w-[360px]' : 'max-w-[440px]'}`} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-label={title}>
      <div className="mb-5 flex items-center justify-between gap-3"><h3 className="truncate text-lg font-bold text-[#0d1730]">{title}</h3><button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0d1730]"><XMarkIcon className="h-4 w-4" /></button></div>
      <div className="space-y-4">{children}</div>
    </section>
  </div>
);

export default EmployeeManagementView;
