import {
  ArrowPathIcon,
  ArrowUpRightIcon,
  BellIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  ChevronRightIcon,
  CircleStackIcon,
  CubeIcon,
  EllipsisHorizontalIcon,
  ExclamationTriangleIcon,
  HomeIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  NoSymbolIcon,
  PlusIcon,
  QuestionMarkCircleIcon,
  ShieldCheckIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { authService } from '../../services/auth';
import {
  businessCenterService,
  type BusinessDepartment,
  type BusinessDepartmentStatus,
  type BusinessEmployee,
} from '../../services/businessCenter';
import { i18nService } from '../../services/i18n';
import type { RootState } from '../../store';
import ComposeIcon from '../icons/ComposeIcon';
import SidebarToggleIcon from '../icons/SidebarToggleIcon';
import WindowTitleBar from '../window/WindowTitleBar';

interface BusinessCenterViewProps {
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  onNewChat?: () => void;
  updateBadge?: React.ReactNode;
}

type Tone = 'cyan' | 'green' | 'amber' | 'violet';
type IconComponent = React.ElementType<{ className?: string }>;
type BusinessTab = 'overview' | 'organization' | 'employees' | 'tokens' | 'apps';

type DepartmentTreeNode = BusinessDepartment & {
  children: DepartmentTreeNode[];
  depth: number;
};

type DepartmentStatusFilter = 'all' | BusinessDepartmentStatus;
type DepartmentModalMode = 'create' | 'edit';
type DepartmentConfirmAction = 'enable' | 'disable' | 'delete';

interface DepartmentFormState {
  name: string;
  code: string;
  parentId: string;
  managerEnterpriseUserId: string;
  sortOrder: string;
  status: BusinessDepartmentStatus;
}

interface DepartmentConfirmState {
  action: DepartmentConfirmAction;
  department: BusinessDepartment;
}

const EMPLOYEE_PAGE_SIZE = 20;

const createEmptyDepartmentForm = (): DepartmentFormState => ({
  name: '',
  code: '',
  parentId: '',
  managerEnterpriseUserId: '',
  sortOrder: '0',
  status: 'active',
});

interface StatCardProps {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  progress?: number;
  footer?: string;
  sparkline?: boolean;
  trend?: string;
}

interface UsageItemProps {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

const toneClasses: Record<Tone, {
  icon: string;
  soft: string;
  text: string;
  bar: string;
  chart: string;
  glow: string;
}> = {
  cyan: {
    icon: 'bg-blue-100 text-blue-600',
    soft: 'bg-blue-50 text-blue-600 border-blue-100',
    text: 'text-blue-600',
    bar: 'bg-blue-500',
    chart: '#2563eb',
    glow: 'shadow-blue-100/80',
  },
  green: {
    icon: 'bg-emerald-100 text-emerald-600',
    soft: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    text: 'text-emerald-600',
    bar: 'bg-emerald-500',
    chart: '#16a34a',
    glow: 'shadow-emerald-100/80',
  },
  amber: {
    icon: 'bg-orange-100 text-orange-500',
    soft: 'bg-orange-50 text-orange-500 border-orange-100',
    text: 'text-orange-500',
    bar: 'bg-amber-500',
    chart: '#f97316',
    glow: 'shadow-orange-100/80',
  },
  violet: {
    icon: 'bg-violet-100 text-violet-600',
    soft: 'bg-violet-50 text-violet-600 border-violet-100',
    text: 'text-violet-600',
    bar: 'bg-violet-500',
    chart: '#4f7cff',
    glow: 'shadow-violet-100/80',
  },
};

const showToast = (message: string): void => {
  window.dispatchEvent(new CustomEvent('app:showToast', { detail: message }));
};

const formatCompactNumber = (value?: number | null): string => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-';
  const absValue = Math.abs(value);
  if (absValue >= 1_000_000) {
    const formatted = value / 1_000_000;
    return `${formatted >= 10 ? formatted.toFixed(0) : formatted.toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    const formatted = value / 1_000;
    return `${formatted >= 100 ? formatted.toFixed(0) : formatted.toFixed(1)}K`;
  }
  return String(value);
};

const roleLabel = (role?: string): string => {
  switch (role) {
    case 'owner':
      return '企业主';
    case 'admin':
      return '管理员';
    default:
      return '员工';
  }
};

const statusLabel = (status?: string): string => status === 'disabled' ? '已停用' : '启用中';

const statusClass = (status?: string): string =>
  status === 'disabled'
    ? 'border-border bg-surface-raised text-secondary'
    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500';

const departmentCodeLabel = (department: BusinessDepartment): string => department.code || '-';
const departmentEmployeeCount = (department: BusinessDepartment): number =>
  Number.isFinite(department.employeeCount) ? department.employeeCount : 0;
const employeeDepartmentNames = (employee: BusinessEmployee): string[] =>
  Array.isArray(employee.departmentNames) ? employee.departmentNames : [];

const buildDepartmentTree = (departments: BusinessDepartment[]): DepartmentTreeNode[] => {
  const nodes = new Map<string, DepartmentTreeNode>();
  departments.forEach((department) => {
    nodes.set(department.id, { ...department, children: [], depth: 0 });
  });

  const roots: DepartmentTreeNode[] = [];
  nodes.forEach((node) => {
    const parent = node.parentId ? nodes.get(node.parentId) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  const sortNodes = (items: DepartmentTreeNode[], depth = 0) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'zh-CN'));
    items.forEach((item) => {
      item.depth = depth;
      sortNodes(item.children, depth + 1);
    });
  };
  sortNodes(roots);
  return roots;
};

const filterDepartmentTreeForTable = (
  nodes: DepartmentTreeNode[],
  keyword: string,
  statusFilter: DepartmentStatusFilter,
): DepartmentTreeNode[] => {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return nodes.flatMap((node) => {
    const children = filterDepartmentTreeForTable(node.children, normalizedKeyword, statusFilter);
    const keywordMatched = !normalizedKeyword
      || node.name.toLowerCase().includes(normalizedKeyword)
      || departmentCodeLabel(node).toLowerCase().includes(normalizedKeyword)
      || node.managerName?.toLowerCase().includes(normalizedKeyword);
    const statusMatched = statusFilter === 'all' || node.status === statusFilter;

    if ((keywordMatched && statusMatched) || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
};

const flattenDepartmentTreeForTable = (
  nodes: DepartmentTreeNode[],
  expandedIds: Set<string>,
  forceExpanded: boolean,
): DepartmentTreeNode[] => {
  const rows: DepartmentTreeNode[] = [];

  const walk = (items: DepartmentTreeNode[]) => {
    items.forEach((item) => {
      rows.push(item);
      if (item.children.length > 0 && (forceExpanded || expandedIds.has(item.id))) {
        walk(item.children);
      }
    });
  };

  walk(nodes);
  return rows;
};

const getDepartmentDescendantIds = (
  nodes: DepartmentTreeNode[],
  departmentId: string,
): Set<string> => {
  const result = new Set<string>();
  const collect = (items: DepartmentTreeNode[], shouldCollect: boolean): boolean => {
    let found = false;
    items.forEach((item) => {
      const isTarget = item.id === departmentId;
      const collectChildren = shouldCollect || isTarget;
      if (shouldCollect) {
        result.add(item.id);
      }
      if (collect(item.children, collectChildren) || isTarget) {
        found = true;
      }
    });
    return found;
  };
  collect(nodes, false);
  return result;
};

const formatBusinessDateTime = (value?: string): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const parseDepartmentSortOrder = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const MiniSparkline: React.FC<{ tone: Tone }> = ({ tone }) => {
  const color = toneClasses[tone].chart;

  return (
    <svg className="h-11 w-24 shrink-0" viewBox="0 0 96 44" fill="none" aria-hidden="true">
      <path
        d="M4 35 C14 31 19 28 28 30 C37 32 41 21 49 22 C58 23 61 16 69 13 C78 10 82 3 92 9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M4 35 C14 31 19 28 28 30 C37 32 41 21 49 22 C58 23 61 16 69 13 C78 10 82 3 92 9 L92 42 L4 42 Z"
        fill={color}
        fillOpacity="0.1"
      />
    </svg>
  );
};

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  progress,
  footer,
  sparkline,
  trend,
}) => (
  <section className="group min-h-[112px] rounded-lg border border-[#e6ebf2] bg-white p-4 shadow-[0_8px_24px_rgba(15,35,80,0.04)] transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_12px_30px_rgba(15,35,80,0.08)]">
    <div className="flex h-full items-center gap-4">
      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-lg ${toneClasses[tone].icon} ${toneClasses[tone].glow}`}>
        <Icon className="h-7 w-7" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-[#6b7890]">{label}</p>
        <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-2">
          <strong className="truncate text-[26px] font-bold leading-8 tracking-normal text-[#0d1730]">{value}</strong>
          {trend && <span className="shrink-0 text-xs font-semibold text-emerald-600">{trend}</span>}
        </div>
        <p className="mt-1 truncate text-xs text-[#64748b]">{detail}</p>
        {typeof progress === 'number' && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7eef8]">
            <div
              className={`h-full rounded-full ${toneClasses[tone].bar}`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        )}
        {footer && <p className="mt-2 truncate text-xs text-[#64748b]">{footer}</p>}
      </div>
      {sparkline ? (
        <MiniSparkline tone={tone} />
      ) : (
        <ArrowUpRightIcon className={`h-4 w-4 shrink-0 ${toneClasses[tone].text}`} />
      )}
    </div>
  </section>
);

const UsageItem: React.FC<UsageItemProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}) => (
  <div className="flex min-w-0 items-center gap-4 px-4 py-3">
    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${toneClasses[tone].icon}`}>
      <Icon className="h-7 w-7" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-medium text-[#6b7890]">{label}</p>
      <div className="mt-1 flex min-w-0 items-baseline gap-2">
        <strong className="truncate text-2xl font-bold leading-7 text-[#0d1730]">{value}</strong>
        <span className={`shrink-0 text-xs font-semibold ${toneClasses[tone].text}`}>{detail}</span>
      </div>
    </div>
  </div>
);

interface DepartmentConfirmModalProps {
  state: DepartmentConfirmState;
  isWorking: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const DepartmentConfirmModal: React.FC<DepartmentConfirmModalProps> = ({
  state,
  isWorking,
  onConfirm,
  onCancel,
}) => {
  const isDelete = state.action === 'delete';
  const isDisable = state.action === 'disable';
  const actionLabel = isDelete ? '删除' : isDisable ? '停用' : '启用';
  const title = isDelete
    ? '删除组织节点'
    : `${actionLabel}组织节点`;
  const message = isDelete
    ? `确定要删除组织节点「${state.department.name}」吗？存在下级节点或员工归属时，系统会拒绝删除。`
    : `确定要${actionLabel}组织节点「${state.department.name}」吗？`;
  const confirmClassName = isDelete || isDisable
    ? 'bg-red-500 text-white hover:bg-red-600'
    : 'bg-blue-600 text-white hover:bg-blue-700';

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={isWorking ? undefined : onCancel}
    >
      <div className="absolute inset-0 bg-black/40 dark:bg-black/60" />
      <div
        className="relative w-80 rounded-xl border border-border bg-surface p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="business-center-department-confirm-title"
      >
        <div className="flex flex-col items-center text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
          </div>
          <h3 id="business-center-department-confirm-title" className="mb-2 text-sm font-semibold text-foreground">
            {title}
          </h3>
          <p className="mb-5 text-sm text-secondary">
            {message}
          </p>
          <div className="flex w-full items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isWorking}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-foreground transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
            >
              {i18nService.t('cancel')}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isWorking}
              className={`flex-1 rounded-lg px-4 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${confirmClassName}`}
            >
              {isWorking ? '处理中' : actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const BusinessCenterView: React.FC<BusinessCenterViewProps> = ({
  isSidebarCollapsed,
  onToggleSidebar,
  onNewChat,
  updateBadge,
}) => {
  const user = useSelector((state: RootState) => state.auth.user);
  const quota = useSelector((state: RootState) => state.auth.quota);
  const workspace = useSelector((state: RootState) => state.auth.workspace);
  const profileSummary = useSelector((state: RootState) => state.auth.profileSummary);
  const [activeTab, setActiveTab] = useState<BusinessTab>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [departments, setDepartments] = useState<BusinessDepartment[]>([]);
  const [employees, setEmployees] = useState<BusinessEmployee[]>([]);
  const [managerEmployees, setManagerEmployees] = useState<BusinessEmployee[]>([]);
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageCount, setEmployeePageCount] = useState(0);
  const [isOrgLoading, setIsOrgLoading] = useState(false);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgStatusFilter, setOrgStatusFilter] = useState<DepartmentStatusFilter>('all');
  const [expandedDepartmentIds, setExpandedDepartmentIds] = useState<Set<string>>(() => new Set());
  const [departmentModal, setDepartmentModal] = useState<{
    mode: DepartmentModalMode;
    department?: BusinessDepartment;
  } | null>(null);
  const [departmentConfirm, setDepartmentConfirm] = useState<DepartmentConfirmState | null>(null);
  const [departmentForm, setDepartmentForm] = useState<DepartmentFormState>(() => createEmptyDepartmentForm());
  const [isDepartmentSaving, setIsDepartmentSaving] = useState(false);
  const [isDepartmentActionRunning, setIsDepartmentActionRunning] = useState(false);
  const [employeeForm, setEmployeeForm] = useState({
    username: '',
    password: '',
    name: '',
    phone: '',
    email: '',
    role: 'employee',
    departmentId: '',
  });

  const isMac = window.electron.platform === 'darwin';
  const displayName = user?.nickname?.trim()
    || profileSummary?.nickname?.trim()
    || user?.phone?.trim()
    || user?.yid?.trim()
    || 'admin';
  const remainingTokens = formatCompactNumber(profileSummary?.totalCreditsRemaining ?? quota?.creditsRemaining);
  const currentRole = workspace?.role || 'employee';
  const canManageOrg = currentRole === 'owner' || currentRole === 'admin';
  const orgText = useMemo(() => ({
    title: i18nService.t('businessCenterOrgTitle'),
    description: i18nService.t('businessCenterOrgDescription'),
    searchPlaceholder: i18nService.t('businessCenterOrgSearchPlaceholder'),
    allStatus: i18nService.t('businessCenterOrgAllStatus'),
    active: i18nService.t('businessCenterOrgActive'),
    disabled: i18nService.t('businessCenterOrgDisabled'),
    add: i18nService.t('businessCenterOrgAdd'),
    code: i18nService.t('businessCenterOrgCode'),
    structure: i18nService.t('businessCenterOrgStructure'),
    manager: i18nService.t('businessCenterOrgManager'),
    status: i18nService.t('businessCenterOrgStatus'),
    createdAt: i18nService.t('businessCenterOrgCreatedAt'),
    actions: i18nService.t('businessCenterOrgActions'),
    edit: i18nService.t('businessCenterOrgEdit'),
    enable: i18nService.t('businessCenterOrgEnable'),
    disable: i18nService.t('businessCenterOrgDisable'),
    delete: i18nService.t('businessCenterOrgDelete'),
    more: i18nService.t('businessCenterOrgMore'),
    empty: i18nService.t('businessCenterOrgEmpty'),
    loading: i18nService.t('businessCenterOrgLoading'),
    createTitle: i18nService.t('businessCenterOrgCreateTitle'),
    editTitle: i18nService.t('businessCenterOrgEditTitle'),
    name: i18nService.t('businessCenterOrgName'),
    parent: i18nService.t('businessCenterOrgParent'),
    noParent: i18nService.t('businessCenterOrgNoParent'),
    sort: i18nService.t('businessCenterOrgSort'),
    namePlaceholder: i18nService.t('businessCenterOrgNamePlaceholder'),
    codePlaceholder: i18nService.t('businessCenterOrgCodePlaceholder'),
    managerPlaceholder: i18nService.t('businessCenterOrgManagerPlaceholder'),
    sortPlaceholder: i18nService.t('businessCenterOrgSortPlaceholder'),
    close: i18nService.t('businessCenterOrgClose'),
    cancel: i18nService.t('businessCenterOrgCancel'),
    save: i18nService.t('businessCenterOrgSave'),
    saving: i18nService.t('businessCenterOrgSaving'),
    nameRequired: i18nService.t('businessCenterOrgNameRequired'),
    saveSuccess: i18nService.t('businessCenterOrgSaveSuccess'),
    createSuccess: i18nService.t('businessCenterOrgCreateSuccess'),
    saveFailed: i18nService.t('businessCenterOrgSaveFailed'),
    deleted: i18nService.t('businessCenterOrgDeleted'),
    deleteFailed: i18nService.t('businessCenterOrgDeleteFailed'),
    managerLoadFailed: i18nService.t('businessCenterOrgManagerLoadFailed'),
  }), []);

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.status !== 'disabled'),
    [departments],
  );
  const orgTree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const filteredOrgTree = useMemo(
    () => filterDepartmentTreeForTable(orgTree, orgSearch, orgStatusFilter),
    [orgSearch, orgStatusFilter, orgTree],
  );
  const departmentTableRows = useMemo(
    () => flattenDepartmentTreeForTable(
      filteredOrgTree,
      expandedDepartmentIds,
      orgSearch.trim() !== '' || orgStatusFilter !== 'all',
    ),
    [expandedDepartmentIds, filteredOrgTree, orgSearch, orgStatusFilter],
  );
  const editingDepartment = departmentModal?.mode === 'edit' ? departmentModal.department : undefined;
  const editingDepartmentDescendantIds = useMemo(
    () => editingDepartment ? getDepartmentDescendantIds(orgTree, editingDepartment.id) : new Set<string>(),
    [editingDepartment, orgTree],
  );
  const departmentParentOptions = useMemo(
    () => activeDepartments.filter((department) =>
      department.id !== editingDepartment?.id && !editingDepartmentDescendantIds.has(department.id)
    ),
    [activeDepartments, editingDepartment?.id, editingDepartmentDescendantIds],
  );
  const activeManagerEmployees = useMemo(
    () => managerEmployees.filter((employee) => employee.status !== 'disabled'),
    [managerEmployees],
  );
  const disabledDepartmentCount = departments.length - activeDepartments.length;

  const navItems = useMemo(() => ([
    { key: 'overview' as const, label: '首页概览', icon: HomeIcon, enabled: true },
    { key: 'organization' as const, label: '组织架构', icon: UserGroupIcon, enabled: true },
    { key: 'employees' as const, label: '员工管理', icon: UsersIcon, enabled: true },
    { key: 'tokens' as const, label: 'Token 管理', icon: CircleStackIcon, enabled: false },
    { key: 'apps' as const, label: '应用管理', icon: Squares2X2Icon, enabled: false },
  ]), []);

  const tokenRows = useMemo(() => ([
    { source: 'AI 聚合接待', employee: '李娜', usage: '4,920', time: '2026-06-25 10:08:12' },
    { source: 'AI 客服后台', employee: '王敏', usage: '3,450', time: '2026-06-25 09:45:16' },
    { source: '拼多多运营管理后台', employee: '陈昊', usage: '2,800', time: '2026-06-25 09:31:45' },
    { source: 'AI 聚合接待', employee: '李娜', usage: '2,310', time: '2026-06-25 08:47:21' },
    { source: 'AI 客服后台', employee: '李娜', usage: '1,960', time: '2026-06-25 08:30:19' },
    { source: '拼多多运营管理后台', employee: '王敏', usage: '1,280', time: '2026-06-25 07:58:33' },
  ]), []);

  const enabledApps = useMemo(() => ([
    { id: 'ai-reception', name: 'AI 聚合接待后台管理', subtitle: '独立应用后台入口', label: 'AI', tone: 'cyan' as Tone },
    { id: 'ai-service', name: 'AI 客服后台', subtitle: '智能客服系统管理平台', label: 'AI', tone: 'violet' as Tone },
    { id: 'pdd-ops', name: '拼多多运营管理后台', subtitle: '拼多多店铺运营管理平台', label: 'PDD', tone: 'cyan' as Tone },
  ]), []);

  const loadDepartments = useCallback(async () => {
    if (!canManageOrg) {
      setDepartments([]);
      return;
    }
    setIsOrgLoading(true);
    try {
      setDepartments(await businessCenterService.getDepartments());
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载组织架构失败');
    } finally {
      setIsOrgLoading(false);
    }
  }, [canManageOrg]);

  const loadEmployeeSummary = useCallback(async () => {
    if (!canManageOrg) {
      setEmployeeTotal(0);
      return;
    }
    try {
      const result = await businessCenterService.getEmployees({ page: 1, pageSize: 1 });
      setEmployeeTotal(result.total);
      setEmployeePageCount(result.pages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载员工统计失败');
    }
  }, [canManageOrg]);

  const loadEmployees = useCallback(async (page = 1) => {
    if (!canManageOrg) {
      setEmployees([]);
      setEmployeeTotal(0);
      setEmployeePage(1);
      setEmployeePageCount(0);
      return;
    }
    setIsEmployeeLoading(true);
    try {
      const result = await businessCenterService.getEmployees({ page, pageSize: EMPLOYEE_PAGE_SIZE });
      setEmployees(result.items);
      setEmployeeTotal(result.total);
      setEmployeePage(result.page);
      setEmployeePageCount(result.pages);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '加载员工失败');
    } finally {
      setIsEmployeeLoading(false);
    }
  }, [canManageOrg]);

  const loadManagerEmployees = useCallback(async () => {
    if (!canManageOrg) {
      setManagerEmployees([]);
      return;
    }
    try {
      const result = await businessCenterService.getEmployees({ page: 1, pageSize: 100 });
      setManagerEmployees(result.items);
    } catch (error) {
      setManagerEmployees([]);
      showToast(error instanceof Error ? error.message : orgText.managerLoadFailed);
    }
  }, [canManageOrg, orgText.managerLoadFailed]);

  useEffect(() => {
    if (!canManageOrg) {
      return;
    }
    if (activeTab === 'organization') {
      void loadDepartments();
      void loadEmployeeSummary();
      void loadManagerEmployees();
    }
    if (activeTab === 'employees') {
      void loadDepartments();
      void loadEmployees(employeePage);
    }
    if (activeTab === 'overview') {
      void loadEmployeeSummary();
    }
  }, [activeTab, canManageOrg, employeePage, loadDepartments, loadEmployees, loadEmployeeSummary, loadManagerEmployees]);

  useEffect(() => {
    if (departments.length === 0) {
      setExpandedDepartmentIds(new Set());
      return;
    }
    setExpandedDepartmentIds((prev) => {
      const validIds = new Set(departments.map((department) => department.id));
      const next = new Set(Array.from(prev).filter((id) => validIds.has(id)));
      if (next.size === 0) {
        departments
          .filter((department) => !department.parentId)
          .forEach((department) => next.add(department.id));
      }
      return next;
    });
  }, [departments]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshTasks: Array<Promise<unknown>> = [
        authService.refreshQuota(),
        authService.fetchProfileSummary(),
      ];
      if (canManageOrg && activeTab === 'organization') {
        refreshTasks.push(loadDepartments(), loadEmployeeSummary(), loadManagerEmployees());
      }
      if (canManageOrg && activeTab === 'employees') {
        refreshTasks.push(loadDepartments(), loadEmployees(employeePage));
      }
      if (canManageOrg && activeTab === 'overview') {
        refreshTasks.push(loadEmployeeSummary());
      }
      await Promise.all(refreshTasks);
      showToast('已刷新当前业务中心数据');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '刷新失败');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleTabClick = (item: typeof navItems[number]) => {
    if (!item.enabled) {
      showToast(i18nService.t('businessCenterComingSoon'));
      return;
    }
    setActiveTab(item.key);
  };

  const openCreateDepartmentModal = () => {
    setDepartmentForm(createEmptyDepartmentForm());
    setDepartmentModal({ mode: 'create' });
  };

  const openEditDepartmentModal = (department: BusinessDepartment) => {
    setDepartmentForm({
      name: department.name,
      code: department.code,
      parentId: department.parentId || '',
      managerEnterpriseUserId: department.managerEnterpriseUserId || '',
      sortOrder: String(department.sortOrder || 0),
      status: department.status === 'disabled' ? 'disabled' : 'active',
    });
    setDepartmentModal({ mode: 'edit', department });
  };

  const closeDepartmentModal = () => {
    setDepartmentModal(null);
    setDepartmentForm(createEmptyDepartmentForm());
  };

  const toggleDepartmentExpanded = (departmentId: string) => {
    setExpandedDepartmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(departmentId)) {
        next.delete(departmentId);
      } else {
        next.add(departmentId);
      }
      return next;
    });
  };

  const refreshOrganizationData = async () => {
    await Promise.all([
      loadDepartments(),
      loadEmployeeSummary(),
      loadManagerEmployees(),
    ]);
  };

  const handleSubmitDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!departmentModal) return;
    const name = departmentForm.name.trim();
    if (!name) {
      showToast(orgText.nameRequired);
      return;
    }
    setIsDepartmentSaving(true);
    try {
      const payload = {
        name,
        code: departmentForm.code.trim(),
        parentId: departmentForm.parentId || undefined,
        managerEnterpriseUserId: departmentForm.managerEnterpriseUserId || undefined,
        sortOrder: parseDepartmentSortOrder(departmentForm.sortOrder),
        status: departmentForm.status,
      };
      if (departmentModal.mode === 'edit' && departmentModal.department) {
        await businessCenterService.updateDepartment(departmentModal.department.id, payload);
        showToast(orgText.saveSuccess);
      } else {
        await businessCenterService.createDepartment(payload);
        showToast(orgText.createSuccess);
      }
      closeDepartmentModal();
      await refreshOrganizationData();
    } catch (error) {
      showToast(error instanceof Error ? error.message : orgText.saveFailed);
    } finally {
      setIsDepartmentSaving(false);
    }
  };

  const handleSetDepartmentStatus = async (
    department: BusinessDepartment,
    status: BusinessDepartmentStatus,
  ) => {
    setDepartmentConfirm({
      action: status === 'disabled' ? 'disable' : 'enable',
      department,
    });
  };

  const handleDeleteDepartment = async (department: BusinessDepartment) => {
    setDepartmentConfirm({ action: 'delete', department });
  };

  const handleCancelDepartmentAction = () => {
    if (isDepartmentActionRunning) return;
    setDepartmentConfirm(null);
  };

  const handleConfirmDepartmentAction = async () => {
    if (!departmentConfirm) return;
    const { action, department } = departmentConfirm;
    setIsDepartmentActionRunning(true);
    if (action === 'delete') {
      try {
        await businessCenterService.deleteDepartment(department.id);
        await refreshOrganizationData();
        showToast(orgText.deleted);
        setDepartmentConfirm(null);
      } catch (error) {
        showToast(error instanceof Error ? error.message : orgText.deleteFailed);
      } finally {
        setIsDepartmentActionRunning(false);
      }
      return;
    }

    const status: BusinessDepartmentStatus = action === 'disable' ? 'disabled' : 'active';
    const actionText = status === 'disabled' ? '停用' : '启用';
    try {
      await businessCenterService.setDepartmentStatus(department.id, status, department.sortOrder);
      await refreshOrganizationData();
      setDepartmentConfirm(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : `${actionText}组织节点失败`);
    } finally {
      setIsDepartmentActionRunning(false);
    }
  };

  const handleCreateEmployee = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!employeeForm.username.trim() || !employeeForm.name.trim() || !employeeForm.password) {
      showToast('请填写账号、姓名和初始密码');
      return;
    }
    try {
      await businessCenterService.createEmployee({
        username: employeeForm.username.trim(),
        password: employeeForm.password,
        name: employeeForm.name.trim(),
        phone: employeeForm.phone.trim(),
        email: employeeForm.email.trim(),
        role: employeeForm.role,
        departmentIds: employeeForm.departmentId ? [employeeForm.departmentId] : [],
      });
      setEmployeeForm({
        username: '',
        password: '',
        name: '',
        phone: '',
        email: '',
        role: 'employee',
        departmentId: '',
      });
      await Promise.all([
        loadEmployees(employeePage),
        loadEmployeeSummary(),
        loadManagerEmployees(),
      ]);
      showToast('员工已新增');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '新增员工失败');
    }
  };

  const handleDisableEmployee = async (employee: BusinessEmployee) => {
    if (!window.confirm(`确定禁用「${employee.name || employee.username}」吗？`)) return;
    try {
      await businessCenterService.disableEmployee(employee.id);
      await Promise.all([
        loadEmployees(employeePage),
        loadEmployeeSummary(),
        loadManagerEmployees(),
      ]);
      showToast('员工已禁用');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '禁用员工失败');
    }
  };

  const handleResetEmployeePassword = async (employee: BusinessEmployee) => {
    const password = window.prompt(`请输入「${employee.name || employee.username}」的新密码`);
    if (!password) return;
    try {
      await businessCenterService.resetEmployeePassword(employee.id, password);
      showToast('密码已重置');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '重置密码失败');
    }
  };

  const overviewContent = (
    <>
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={CalendarDaysIcon}
          label="企业有效期"
          value="2027-06-30"
          detail="剩余 369 天"
          tone="cyan"
          progress={42}
          footer="2026-06-25 ~ 2027-06-30"
        />
        <StatCard
          icon={CircleStackIcon}
          label="Token 总额度 / 剩余"
          value={`1,000K / ${remainingTokens}`}
          detail="企业级 Token 池"
          tone="green"
          sparkline
        />
        <StatCard
          icon={BoltIcon}
          label="今日 Token 消耗"
          value="18.2K"
          detail="较昨日 +8.7%"
          tone="amber"
          sparkline
        />
        <StatCard
          icon={CubeIcon}
          label="已开通应用数量"
          value={String(enabledApps.length)}
          detail="平台授权可用"
          tone="violet"
          sparkline
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)]">
        <div className="rounded-lg border border-[#e6ebf2] bg-white shadow-[0_8px_24px_rgba(15,35,80,0.04)]">
          <div className="flex flex-col gap-3 border-b border-[#e6ebf2] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="truncate text-base font-bold text-[#0d1730]">Token 消耗明细</h2>
            <button
              type="button"
              onClick={() => showToast(i18nService.t('businessCenterComingSoon'))}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-[#d8e1ee] bg-white px-3 text-xs font-medium text-[#354560] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600"
            >
              近 7 天
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[#e6ebf2] bg-[#f8fbff] text-xs text-[#6b7890]">
                  <th className="px-4 py-2.5 font-semibold">来源</th>
                  <th className="px-4 py-2.5 font-semibold">员工</th>
                  <th className="px-4 py-2.5 font-semibold">消耗（Token）</th>
                  <th className="px-4 py-2.5 font-semibold">时间</th>
                </tr>
              </thead>
              <tbody>
                {tokenRows.map((row) => (
                  <tr key={`${row.source}-${row.employee}-${row.time}`} className="border-b border-[#edf2f8] text-[#22304a] last:border-b-0 hover:bg-[#f8fbff]">
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3 text-[#354560]">{row.employee}</td>
                    <td className="px-4 py-3 font-semibold">{row.usage}</td>
                    <td className="px-4 py-3 text-[#354560]">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[#edf2f8] px-4 py-3 text-xs">
            <span className="text-[#6b7890]">共 25 条</span>
            <button
              type="button"
              onClick={() => showToast(i18nService.t('businessCenterComingSoon'))}
              className="inline-flex items-center gap-1.5 font-semibold text-blue-600 transition-colors hover:text-blue-700"
            >
              查看全部明细
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-[#e6ebf2] bg-white p-4 shadow-[0_8px_24px_rgba(15,35,80,0.04)]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="truncate text-base font-bold text-[#0d1730]">已开通应用</h2>
          </div>
          <div className="space-y-3">
            {enabledApps.map((app) => (
              <article key={app.id} className="flex items-center gap-4 rounded-lg border border-[#e6ebf2] bg-white p-3 transition-all hover:border-blue-200 hover:bg-[#fbfdff] hover:shadow-[0_8px_22px_rgba(15,35,80,0.06)]">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-lg text-lg font-bold ${toneClasses[app.tone].soft}`}>
                  {app.label}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-base font-bold text-[#0d1730]">{app.name}</h3>
                  <p className="mt-1 truncate text-xs text-[#6b7890]">{app.subtitle}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-600">已开通</span>
                  <button
                    type="button"
                    onClick={() => showToast(i18nService.t('businessCenterComingSoon'))}
                    className="inline-flex h-8 items-center rounded-md bg-blue-600 px-4 text-xs font-semibold text-white shadow-[0_6px_16px_rgba(37,99,235,0.22)] transition-colors hover:bg-blue-700"
                  >
                    打开后台
                  </button>
                </div>
              </article>
            ))}
          </div>
          <button
            type="button"
            onClick={() => showToast(i18nService.t('businessCenterComingSoon'))}
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
          >
            进入应用管理中心
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </section>
      </section>

      <section className="rounded-lg border border-[#e6ebf2] bg-white p-4 shadow-[0_8px_24px_rgba(15,35,80,0.04)]">
        <h2 className="mb-4 text-base font-bold text-[#0d1730]">平台使用情况</h2>
        <div className="grid divide-y divide-[#e6ebf2] overflow-hidden rounded-lg border border-[#e6ebf2] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
          <UsageItem icon={UsersIcon} label="企业成员" value={String(employeeTotal || employees.length || 128)} detail="较昨日 +2 人 ↑" tone="cyan" />
          <UsageItem icon={CubeIcon} label="应用调用总数" value="28.6K" detail="较昨日 +12.4%" tone="green" />
          <UsageItem icon={BoltIcon} label="Token 日均消耗" value="16.3K" detail="较上周 +8.7%" tone="amber" />
          <UsageItem icon={CircleStackIcon} label="存量 Token 预计可用" value="51 天" detail="按当前消耗速度估算" tone="violet" />
        </div>
      </section>
    </>
  );

  const organizationContent = (
    <>
      <section className="overflow-hidden rounded-lg border border-[#e6ebf2] bg-white shadow-[0_8px_24px_rgba(15,35,80,0.04)]">
        <div className="border-b border-[#e6ebf2] px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold tracking-normal text-[#0d1730]">{orgText.title}</h2>
              <p className="mt-1 text-sm text-[#64748b]">
                {orgText.description}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] focus-within:border-blue-400 xl:w-[280px]">
                <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-[#6b7890]" />
                <input
                  value={orgSearch}
                  onChange={(event) => setOrgSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#94a3b8]"
                  placeholder={orgText.searchPlaceholder}
                />
              </label>
              <select
                value={orgStatusFilter}
                onChange={(event) => setOrgStatusFilter(event.target.value as DepartmentStatusFilter)}
                className="h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm font-medium text-[#354560] outline-none transition-colors hover:border-blue-300 focus:border-blue-400"
              >
                <option value="all">{orgText.allStatus}</option>
                <option value="active">{orgText.active}</option>
                <option value="disabled">{orgText.disabled}</option>
              </select>
              <button
                type="button"
                onClick={openCreateDepartmentModal}
                disabled={!canManageOrg}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)] transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <PlusIcon className="h-4 w-4" />
                {orgText.add}
              </button>
            </div>
          </div>
          <div className="mt-4 text-sm text-[#354560]">
            <span>
              共 {departments.length} 个组织节点（{orgText.active} {activeDepartments.length} 个，{orgText.disabled} {disabledDepartmentCount} 个）
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e6ebf2] bg-[#f8fbff] text-xs text-[#6b7890]">
                <th className="w-[150px] px-4 py-3 font-semibold">{orgText.code}</th>
                <th className="min-w-[300px] px-4 py-3 font-semibold">{orgText.structure}</th>
                <th className="w-[140px] px-4 py-3 font-semibold">{orgText.manager}</th>
                <th className="w-[100px] px-4 py-3 font-semibold">{orgText.status}</th>
                <th className="w-[180px] px-4 py-3 font-semibold">{orgText.createdAt}</th>
                <th className="w-[190px] px-4 py-3 text-right font-semibold">{orgText.actions}</th>
              </tr>
            </thead>
            <tbody>
              {departmentTableRows.map((department) => {
                const hasChildren = department.children.length > 0;
                const isExpanded = expandedDepartmentIds.has(department.id);
                const isDisabled = department.status === 'disabled';
                const Icon = department.depth === 0 ? BuildingOffice2Icon : UserGroupIcon;
                return (
                  <tr
                    key={department.id}
                    className={`border-b border-[#edf2f8] text-[#22304a] last:border-b-0 hover:bg-[#f8fbff] ${isDisabled ? 'bg-[#fbfcfe] text-[#6b7890]' : ''}`}
                  >
                    <td className="px-4 py-3 font-medium">{departmentCodeLabel(department)}</td>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${department.depth * 28}px` }}>
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={() => toggleDepartmentExpanded(department.id)}
                            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-blue-50 hover:text-blue-600"
                            aria-label={isExpanded ? '收起组织节点' : '展开组织节点'}
                          >
                            <ChevronRightIcon className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                          </button>
                        ) : (
                          <span className="h-6 w-6 shrink-0" />
                        )}
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${department.depth === 0 ? 'bg-blue-50 text-blue-600' : 'bg-[#eff6ff] text-blue-500'}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{department.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-[#6b7890]">
                            {departmentEmployeeCount(department)} 名成员 · 排序 {department.sortOrder}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">{department.managerName || '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${statusClass(department.status)}`}>
                        {isDisabled ? orgText.disabled : orgText.active}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-[#4d5f7a]">{formatBusinessDateTime(department.createdAt)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          disabled={!canManageOrg}
                          onClick={() => openEditDepartmentModal(department)}
                          className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                        >
                          {orgText.edit}
                        </button>
                        <button
                          type="button"
                          disabled={!canManageOrg}
                          onClick={() => void handleSetDepartmentStatus(department, isDisabled ? 'active' : 'disabled')}
                          className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                        >
                          {isDisabled ? orgText.enable : orgText.disable}
                        </button>
                        <button
                          type="button"
                          disabled={!canManageOrg || isDepartmentActionRunning}
                          onClick={() => void handleDeleteDepartment(department)}
                          className="text-xs font-semibold text-blue-600 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:text-[#94a3b8]"
                        >
                          {orgText.delete}
                        </button>
                        <button
                          type="button"
                          onClick={() => showToast(i18nService.t('businessCenterComingSoon'))}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-blue-50 hover:text-blue-600"
                          aria-label={orgText.more}
                        >
                          <EllipsisHorizontalIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!isOrgLoading && departmentTableRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748b]">
                    {orgText.empty}
                  </td>
                </tr>
              )}
              {isOrgLoading && departmentTableRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-[#64748b]">
                    {orgText.loading}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {departmentModal && (
        <div className="non-draggable fixed inset-0 z-50 flex items-center justify-center bg-[#0b1220]/35 px-4 py-6 backdrop-blur-[2px]">
          <form
            onSubmit={handleSubmitDepartment}
            className="w-full max-w-[420px] rounded-lg border border-[#e6ebf2] bg-white p-5 shadow-[0_24px_80px_rgba(15,23,42,0.22)]"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <h3 className="truncate text-lg font-bold text-[#0d1730]">
                {departmentModal.mode === 'edit' ? orgText.editTitle : orgText.createTitle}
              </h3>
              <button
                type="button"
                disabled={isDepartmentSaving}
                onClick={closeDepartmentModal}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0d1730] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={orgText.close}
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>

            <fieldset disabled={isDepartmentSaving} className="space-y-3 disabled:opacity-70">
              <label className="grid gap-1.5 text-sm sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
                <span className="font-medium text-[#354560]"><span className="text-red-500">*</span> {orgText.name}</span>
                <input
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-blue-400"
                  placeholder={orgText.namePlaceholder}
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
                <span className="font-medium text-[#354560]"><span className="text-red-500">*</span> {orgText.code}</span>
                <input
                  value={departmentForm.code}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-blue-400"
                  placeholder={orgText.codePlaceholder}
                />
              </label>
              <label className="grid gap-1.5 text-sm sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
                <span className="font-medium text-[#354560]"><span className="text-red-500">*</span> {orgText.parent}</span>
                <select
                  value={departmentForm.parentId}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  className="h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors focus:border-blue-400"
                >
                  <option value="">{orgText.noParent}</option>
                  {departmentParentOptions.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
                <span className="font-medium text-[#354560]"><span className="text-red-500">*</span> {orgText.manager}</span>
                <select
                  value={departmentForm.managerEnterpriseUserId}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, managerEnterpriseUserId: event.target.value }))}
                  className="h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors focus:border-blue-400"
                >
                  <option value="">{orgText.managerPlaceholder}</option>
                  {activeManagerEmployees.map((employee) => (
                    <option key={employee.id} value={employee.id}>{employee.name || employee.username}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-sm sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
                <span className="font-medium text-[#354560]"><span className="text-red-500">*</span> {orgText.sort}</span>
                <input
                  type="number"
                  value={departmentForm.sortOrder}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                  className="h-10 rounded-md border border-[#d8e1ee] bg-white px-3 text-sm text-[#22304a] outline-none transition-colors placeholder:text-[#94a3b8] focus:border-blue-400"
                  placeholder={orgText.sortPlaceholder}
                />
              </label>
              <div className="grid gap-1.5 text-sm sm:grid-cols-[92px_minmax(0,1fr)] sm:items-center">
                <span className="font-medium text-[#354560]"><span className="text-red-500">*</span> {orgText.status}</span>
                <div className="flex items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-[#354560]">
                    <input
                      type="radio"
                      checked={departmentForm.status === 'active'}
                      onChange={() => setDepartmentForm((prev) => ({ ...prev, status: 'active' }))}
                      className="h-4 w-4 accent-blue-600"
                    />
                    {orgText.active}
                  </label>
                  <label className="inline-flex items-center gap-2 text-[#354560]">
                    <input
                      type="radio"
                      checked={departmentForm.status === 'disabled'}
                      onChange={() => setDepartmentForm((prev) => ({ ...prev, status: 'disabled' }))}
                      className="h-4 w-4 accent-blue-600"
                    />
                    {orgText.disabled}
                  </label>
                </div>
              </div>
            </fieldset>

            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={isDepartmentSaving}
                onClick={closeDepartmentModal}
                className="inline-flex h-10 items-center justify-center rounded-md border border-[#d8e1ee] bg-white px-5 text-sm font-semibold text-[#354560] transition-colors hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {orgText.cancel}
              </button>
              <button
                type="submit"
                disabled={isDepartmentSaving}
                className="inline-flex h-10 items-center justify-center rounded-md bg-blue-600 px-5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.22)] transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDepartmentSaving ? orgText.saving : orgText.save}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );

  const employeesContent = (
    <section className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <form onSubmit={handleCreateEmployee} className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">新增员工</h2>
            <p className="mt-1 text-xs text-secondary">创建或复用全局 Casdoor 用户，再绑定当前企业。</p>
          </div>
          <UsersIcon className="h-5 w-5 text-primary" />
        </div>
        <fieldset disabled={!canManageOrg} className="grid gap-3 disabled:opacity-60">
          <input
            value={employeeForm.username}
            onChange={(event) => setEmployeeForm((prev) => ({ ...prev, username: event.target.value }))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="账号 / 手机号"
          />
          <input
            value={employeeForm.name}
            onChange={(event) => setEmployeeForm((prev) => ({ ...prev, name: event.target.value }))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="姓名"
          />
          <input
            type="password"
            value={employeeForm.password}
            onChange={(event) => setEmployeeForm((prev) => ({ ...prev, password: event.target.value }))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="初始密码"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              value={employeeForm.phone}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, phone: event.target.value }))}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
              placeholder="手机号"
            />
            <select
              value={employeeForm.role}
              onChange={(event) => setEmployeeForm((prev) => ({ ...prev, role: event.target.value }))}
              className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            >
              <option value="employee">员工</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <input
            value={employeeForm.email}
            onChange={(event) => setEmployeeForm((prev) => ({ ...prev, email: event.target.value }))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
            placeholder="邮箱"
          />
          <select
            value={employeeForm.departmentId}
            onChange={(event) => setEmployeeForm((prev) => ({ ...prev, departmentId: event.target.value }))}
            className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
          >
            <option value="">不分配部门</option>
            {activeDepartments.map((department) => (
              <option key={department.id} value={department.id}>{department.name}</option>
            ))}
          </select>
          <button
            type="submit"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <PlusIcon className="h-4 w-4" />
            新增员工
          </button>
        </fieldset>
        {!canManageOrg && <p className="mt-3 text-xs text-secondary">当前角色仅可查看员工列表。</p>}
      </form>

      <section className="rounded-lg border border-border bg-surface shadow-subtle">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-foreground">员工管理</h2>
            <p className="mt-1 text-xs text-secondary">共 {employeeTotal || employees.length} 名企业成员</p>
          </div>
          <button
            type="button"
            onClick={() => void loadEmployees(employeePage)}
            className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-raised"
          >
            <ArrowPathIcon className={`h-4 w-4 ${isEmployeeLoading ? 'animate-spin' : ''}`} />
            刷新
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-raised/40 text-xs text-secondary">
                <th className="px-4 py-2.5 font-medium">员工</th>
                <th className="px-4 py-2.5 font-medium">账号</th>
                <th className="px-4 py-2.5 font-medium">部门</th>
                <th className="px-4 py-2.5 font-medium">角色</th>
                <th className="px-4 py-2.5 font-medium">状态</th>
                <th className="px-4 py-2.5 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-border/60 text-foreground last:border-b-0 hover:bg-surface-raised/40">
                  <td className="px-4 py-3">
                    <div className="font-medium">{employee.name || employee.username}</div>
                    <div className="mt-0.5 text-xs text-secondary">{employee.phone || employee.email || '未填写联系方式'}</div>
                  </td>
                  <td className="px-4 py-3 text-secondary">{employee.username}</td>
                  <td className="px-4 py-3 text-secondary">{employeeDepartmentNames(employee).length > 0 ? employeeDepartmentNames(employee).join(' / ') : '未分配'}</td>
                  <td className="px-4 py-3">{roleLabel(employee.role)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(employee.status)}`}>
                      {statusLabel(employee.status)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!canManageOrg || employee.status === 'disabled'}
                        onClick={() => handleResetEmployeePassword(employee)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-foreground transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <KeyIcon className="h-4 w-4" />
                        重置
                      </button>
                      <button
                        type="button"
                        disabled={!canManageOrg || employee.status === 'disabled' || employee.role === 'owner'}
                        onClick={() => handleDisableEmployee(employee)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-secondary transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <NoSymbolIcon className="h-4 w-4" />
                        禁用
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!isEmployeeLoading && employees.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-sm text-secondary">暂无员工</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {employeePageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-secondary">
            <span>第 {employeePage} / {employeePageCount} 页</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={employeePage <= 1 || isEmployeeLoading}
                onClick={() => void loadEmployees(employeePage - 1)}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-foreground transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={employeePage >= employeePageCount || isEmployeeLoading}
                onClick={() => void loadEmployees(employeePage + 1)}
                className="inline-flex h-8 items-center rounded-md border border-border px-3 text-foreground transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </section>
    </section>
  );

  if (!canManageOrg) {
    return (
      <div className="flex h-full flex-1 flex-col bg-background">
        <div className="draggable flex h-12 shrink-0 items-center justify-between border-b border-border bg-background px-4">
          <div className="flex h-8 min-w-0 items-center gap-3">
            {isSidebarCollapsed && (
              <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
                <button
                  type="button"
                  onClick={onToggleSidebar}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
                </button>
                <button
                  type="button"
                  onClick={onNewChat}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
                >
                  <ComposeIcon className="h-4 w-4" />
                </button>
                {updateBadge}
              </div>
            )}
            <div className="flex min-w-0 items-center">
              <h1 className="truncate text-lg font-semibold text-foreground">{i18nService.t('businessCenter')}</h1>
            </div>
          </div>
          <WindowTitleBar inline />
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-background px-6">
          <section className="max-w-md rounded-lg border border-border bg-surface p-6 text-center shadow-subtle">
            <ShieldCheckIcon className="mx-auto h-10 w-10 text-secondary" />
            <h2 className="mt-4 text-lg font-semibold text-foreground">仅企业主和管理员可访问</h2>
            <p className="mt-2 text-sm leading-6 text-secondary">
              业务中心包含组织架构和员工联系方式，请切换到企业主或管理员工作区后再查看。
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-1 flex-col bg-[#f3f6fb]">
      <div className="draggable flex h-12 shrink-0 items-center justify-between border-b border-[#e6ebf2] bg-white/95 px-4">
        <div className="flex h-8 min-w-0 items-center gap-3">
          {isSidebarCollapsed && (
            <div className={`non-draggable flex items-center gap-1 ${isMac ? 'pl-[68px]' : ''}`}>
              <button
                type="button"
                onClick={onToggleSidebar}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <SidebarToggleIcon className="h-4 w-4" isCollapsed={true} />
              </button>
              <button
                type="button"
                onClick={onNewChat}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-secondary transition-colors hover:bg-surface-raised hover:text-foreground"
              >
                <ComposeIcon className="h-4 w-4" />
              </button>
              {updateBadge}
            </div>
          )}
          <div className="flex min-w-0 items-center">
            <h1 className="truncate text-lg font-semibold text-[#0d1730]">{i18nService.t('businessCenter')}</h1>
          </div>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#f3f6fb] [scrollbar-gutter:stable]">
        <main className="mx-auto w-full max-w-[1280px] space-y-4 px-4 py-4 sm:px-5">
          <nav className="non-draggable flex min-h-[56px] items-center gap-1 overflow-x-auto rounded-lg border border-[#e6ebf2] bg-white px-4 shadow-[0_8px_24px_rgba(15,35,80,0.04)]">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTabClick(item)}
                  className={`relative inline-flex h-14 shrink-0 items-center gap-2 px-4 text-sm font-semibold transition-colors ${
                    isActive
                      ? 'text-blue-600 after:absolute after:bottom-0 after:left-3 after:right-3 after:h-0.5 after:rounded-full after:bg-blue-600'
                      : item.enabled
                        ? 'text-[#354560] hover:text-blue-600'
                        : 'text-[#94a3b8] hover:text-[#64748b]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <div className="ml-auto hidden items-center gap-3 pl-3 text-xs text-[#354560] lg:flex">
              <button type="button" onClick={() => showToast(i18nService.t('businessCenterComingSoon'))} className="relative rounded-md p-1.5 transition-colors hover:bg-blue-50 hover:text-blue-600" aria-label="通知">
                <BellIcon className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">12</span>
              </button>
              <button type="button" onClick={() => showToast(i18nService.t('businessCenterComingSoon'))} className="rounded-md p-1.5 transition-colors hover:bg-blue-50 hover:text-blue-600" aria-label="帮助">
                <QuestionMarkCircleIcon className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 border-l border-[#e6ebf2] pl-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                  {displayName.slice(0, 1).toUpperCase()}
                </span>
                <span className="max-w-[120px] truncate font-medium">{displayName}</span>
                <ChevronRightIcon className="h-3.5 w-3.5 rotate-90" />
              </div>
            </div>
          </nav>

          {activeTab === 'overview' && (
            <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="truncate text-2xl font-bold tracking-normal text-[#0d1730]">欢迎回来，{displayName}</h2>
                <p className="mt-1 text-sm text-[#64748b]">以下是企业运营的关键数据概览</p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-[#d8e1ee] bg-white px-4 text-sm font-semibold text-[#354560] shadow-[0_8px_20px_rgba(15,35,80,0.04)] transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                刷新数据
              </button>
            </section>
          )}

          {activeTab === 'organization'
            ? organizationContent
            : activeTab === 'employees'
              ? employeesContent
              : overviewContent}
          {departmentConfirm && (
            <DepartmentConfirmModal
              state={departmentConfirm}
              isWorking={isDepartmentActionRunning}
              onConfirm={() => void handleConfirmDepartmentAction()}
              onCancel={handleCancelDepartmentAction}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default BusinessCenterView;
