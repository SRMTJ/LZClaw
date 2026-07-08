import {
  ArrowPathIcon,
  BellIcon,
  BoltIcon,
  BuildingOffice2Icon,
  CalendarDaysIcon,
  CheckCircleIcon,
  ChevronRightIcon,
  CircleStackIcon,
  CubeIcon,
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
} from '@heroicons/react/24/outline';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import { authService } from '../../services/auth';
import {
  businessCenterService,
  type BusinessDepartment,
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

const EMPLOYEE_PAGE_SIZE = 20;
const DEPARTMENT_MEMBER_PREVIEW_SIZE = 6;

interface StatCardProps {
  icon: IconComponent;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  progress?: number;
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
}> = {
  cyan: {
    icon: 'bg-cyan-500/10 text-cyan-500',
    soft: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
    text: 'text-cyan-500',
    bar: 'bg-cyan-500',
  },
  green: {
    icon: 'bg-emerald-500/10 text-emerald-500',
    soft: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    text: 'text-emerald-500',
    bar: 'bg-emerald-500',
  },
  amber: {
    icon: 'bg-amber-500/10 text-amber-500',
    soft: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    text: 'text-amber-500',
    bar: 'bg-amber-500',
  },
  violet: {
    icon: 'bg-violet-500/10 text-violet-500',
    soft: 'bg-violet-500/10 text-violet-500 border-violet-500/20',
    text: 'text-violet-500',
    bar: 'bg-violet-500',
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

const filterDepartmentTree = (
  nodes: DepartmentTreeNode[],
  keyword: string,
): DepartmentTreeNode[] => {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) return nodes;

  return nodes.flatMap((node) => {
    const children = filterDepartmentTree(node.children, normalizedKeyword);
    const matched = node.name.toLowerCase().includes(normalizedKeyword)
      || departmentCodeLabel(node).toLowerCase().includes(normalizedKeyword)
      || node.managerName?.toLowerCase().includes(normalizedKeyword);

    if (matched || children.length > 0) {
      return [{ ...node, children }];
    }
    return [];
  });
};

const StatCard: React.FC<StatCardProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  tone,
  progress,
}) => (
  <section className="group rounded-lg border border-border bg-surface p-4 shadow-subtle transition-colors hover:border-primary/30 hover:bg-surface-raised/60">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-secondary">{label}</p>
        <strong className="mt-2 block truncate text-2xl font-semibold tracking-normal text-foreground">{value}</strong>
      </div>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone].icon}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
    <div className="mt-3 flex items-center justify-between gap-3">
      <p className="min-w-0 truncate text-xs text-secondary">{detail}</p>
      <span className={`shrink-0 text-xs font-medium ${toneClasses[tone].text}`}>稳定</span>
    </div>
    {typeof progress === 'number' && (
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <div
          className={`h-full rounded-full ${toneClasses[tone].bar}`}
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    )}
  </section>
);

const UsageItem: React.FC<UsageItemProps> = ({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}) => (
  <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-background px-3 py-3">
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${toneClasses[tone].icon}`}>
      <Icon className="h-5 w-5" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs text-secondary">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <strong className="truncate text-lg font-semibold text-foreground">{value}</strong>
        <span className={`shrink-0 text-xs ${toneClasses[tone].text}`}>{detail}</span>
      </div>
    </div>
  </div>
);

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
  const [employeeTotal, setEmployeeTotal] = useState(0);
  const [employeePage, setEmployeePage] = useState(1);
  const [employeePageCount, setEmployeePageCount] = useState(0);
  const [departmentEmployees, setDepartmentEmployees] = useState<BusinessEmployee[]>([]);
  const [departmentEmployeeTotal, setDepartmentEmployeeTotal] = useState<number | null>(null);
  const [isOrgLoading, setIsOrgLoading] = useState(false);
  const [isEmployeeLoading, setIsEmployeeLoading] = useState(false);
  const [isDepartmentEmployeeLoading, setIsDepartmentEmployeeLoading] = useState(false);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>('');
  const [orgSearch, setOrgSearch] = useState('');
  const [departmentForm, setDepartmentForm] = useState({ name: '', code: '', parentId: '' });
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
  const businessBaseName = workspace?.name?.trim() || user?.enterpriseName?.trim() || '海豚买买';
  const businessTitle = businessBaseName.includes('业务中心') ? businessBaseName : `${businessBaseName}业务中心`;
  const remainingTokens = formatCompactNumber(profileSummary?.totalCreditsRemaining ?? quota?.creditsRemaining);
  const currentRole = workspace?.role || 'employee';
  const canManageOrg = currentRole === 'owner' || currentRole === 'admin';

  const activeDepartments = useMemo(
    () => departments.filter((department) => department.status !== 'disabled'),
    [departments],
  );
  const departmentNameById = useMemo(
    () => new Map(departments.map((department) => [department.id, department.name])),
    [departments],
  );
  const orgTree = useMemo(() => buildDepartmentTree(departments), [departments]);
  const filteredOrgTree = useMemo(() => filterDepartmentTree(orgTree, orgSearch), [orgTree, orgSearch]);
  const selectedDepartment = useMemo(
    () => departments.find((department) => department.id === selectedDepartmentId)
      ?? activeDepartments[0]
      ?? departments[0]
      ?? null,
    [activeDepartments, departments, selectedDepartmentId],
  );
  const childDepartments = useMemo(
    () => selectedDepartment
      ? departments.filter((department) => department.parentId === selectedDepartment.id)
      : [],
    [departments, selectedDepartment],
  );
  const disabledDepartmentCount = departments.length - activeDepartments.length;
  const selectedDepartmentMemberTotal = selectedDepartment
    ? departmentEmployeeTotal ?? departmentEmployeeCount(selectedDepartment)
    : 0;

  const navItems = useMemo(() => ([
    { key: 'overview' as const, label: '首页概览', icon: HomeIcon, enabled: true },
    { key: 'organization' as const, label: '组织架构', icon: UserGroupIcon, enabled: true },
    { key: 'employees' as const, label: '员工管理', icon: UsersIcon, enabled: true },
    { key: 'tokens' as const, label: 'Token 管理', icon: CircleStackIcon, enabled: false },
    { key: 'apps' as const, label: '应用管理', icon: Squares2X2Icon, enabled: false },
  ]), []);

  const tokenRows = useMemo(() => ([
    { source: 'AI 聚合接待', employee: '李娜', usage: '4,920', time: '10:08', status: '已结算' },
    { source: 'Claw 对话', employee: '陈昊', usage: '2,100', time: '09:31', status: '已结算' },
    { source: '拼多多运营', employee: '王敏', usage: '6,700', time: '09:15', status: '峰值' },
    { source: 'AI 聚合接待', employee: '李娜', usage: '3,210', time: '08:47', status: '已结算' },
    { source: 'Claw 对话', employee: '陈昊', usage: '1,960', time: '08:30', status: '已结算' },
  ]), []);

  const enabledApps = useMemo(() => ([
    { id: 'ai-reception', name: 'AI 聚合接待', subtitle: '接待台与客户分析', label: 'AI', tone: 'cyan' as Tone },
    { id: 'pdd-ops', name: '拼多多运营', subtitle: '商品与活动运营', label: 'PDD', tone: 'violet' as Tone },
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

  const loadDepartmentEmployees = useCallback(async (departmentId: string) => {
    if (!canManageOrg || !departmentId) {
      setDepartmentEmployees([]);
      setDepartmentEmployeeTotal(null);
      return;
    }
    setDepartmentEmployees([]);
    setDepartmentEmployeeTotal(null);
    setIsDepartmentEmployeeLoading(true);
    try {
      const result = await businessCenterService.getEmployees({
        page: 1,
        pageSize: DEPARTMENT_MEMBER_PREVIEW_SIZE,
        departmentId,
      });
      setDepartmentEmployees(result.items);
      setDepartmentEmployeeTotal(result.total);
    } catch (error) {
      setDepartmentEmployees([]);
      setDepartmentEmployeeTotal(null);
      showToast(error instanceof Error ? error.message : '加载部门成员失败');
    } finally {
      setIsDepartmentEmployeeLoading(false);
    }
  }, [canManageOrg]);

  useEffect(() => {
    if (!canManageOrg) {
      return;
    }
    if (activeTab === 'organization') {
      void loadDepartments();
      void loadEmployeeSummary();
    }
    if (activeTab === 'employees') {
      void loadDepartments();
      void loadEmployees(employeePage);
    }
    if (activeTab === 'overview') {
      void loadEmployeeSummary();
    }
  }, [activeTab, canManageOrg, employeePage, loadDepartments, loadEmployees, loadEmployeeSummary]);

  useEffect(() => {
    if (activeTab === 'organization' && selectedDepartment?.id) {
      void loadDepartmentEmployees(selectedDepartment.id);
    } else {
      setDepartmentEmployees([]);
      setDepartmentEmployeeTotal(null);
    }
  }, [activeTab, loadDepartmentEmployees, selectedDepartment?.id]);

  useEffect(() => {
    if (departments.length === 0) {
      setSelectedDepartmentId('');
      return;
    }
    if (!selectedDepartmentId || !departments.some((department) => department.id === selectedDepartmentId)) {
      setSelectedDepartmentId((activeDepartments[0] ?? departments[0]).id);
    }
  }, [activeDepartments, departments, selectedDepartmentId]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const refreshTasks: Array<Promise<unknown>> = [
        authService.refreshQuota(),
        authService.fetchProfileSummary(),
      ];
      if (canManageOrg && activeTab === 'organization') {
        refreshTasks.push(loadDepartments(), loadEmployeeSummary());
        if (selectedDepartment?.id) {
          refreshTasks.push(loadDepartmentEmployees(selectedDepartment.id));
        }
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

  const handleCreateDepartment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!departmentForm.name.trim()) {
      showToast('请输入部门名称');
      return;
    }
    try {
      await businessCenterService.createDepartment({
        name: departmentForm.name.trim(),
        code: departmentForm.code.trim(),
        parentId: departmentForm.parentId || undefined,
      });
      setDepartmentForm({ name: '', code: '', parentId: '' });
      await loadDepartments();
      showToast('部门已新增');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '新增部门失败');
    }
  };

  const handleDisableDepartment = async (department: BusinessDepartment) => {
    if (!window.confirm(`确定停用「${department.name}」吗？`)) return;
    try {
      await businessCenterService.disableDepartment(department.id);
      await loadDepartments();
      showToast('部门已停用');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '停用部门失败');
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
        selectedDepartment?.id ? loadDepartmentEmployees(selectedDepartment.id) : Promise.resolve(),
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
        selectedDepartment?.id ? loadDepartmentEmployees(selectedDepartment.id) : Promise.resolve(),
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

  const renderDepartmentTreeNode = (node: DepartmentTreeNode): React.ReactNode => {
    const isSelected = selectedDepartment?.id === node.id;
    const isDisabled = node.status === 'disabled';

    return (
      <div key={node.id} className="space-y-1">
        <button
          type="button"
          onClick={() => setSelectedDepartmentId(node.id)}
          className={`group flex min-h-[52px] w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
            isSelected
              ? 'border-primary/30 bg-primary-muted text-primary'
              : 'border-transparent text-foreground hover:border-border hover:bg-surface-raised/70'
          } ${isDisabled ? 'opacity-60' : ''}`}
          style={{ paddingLeft: `${12 + node.depth * 18}px` }}
        >
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            isSelected ? 'bg-primary text-primary-foreground' : 'bg-background text-secondary group-hover:text-foreground'
          }`}>
            <UserGroupIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-2">
              <span className="truncate text-sm font-medium">{node.name}</span>
              {isDisabled && (
                <span className="shrink-0 rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-secondary">
                  停用
                </span>
              )}
            </span>
            <span className="mt-0.5 block truncate text-xs text-secondary">
              {departmentCodeLabel(node)} · {departmentEmployeeCount(node)} 人 · {node.children.length} 个下级
            </span>
          </span>
          <ChevronRightIcon className={`h-4 w-4 shrink-0 transition-transform ${isSelected ? 'rotate-90' : 'text-tertiary'}`} />
        </button>
        {node.children.length > 0 && (
          <div className="space-y-1">
            {node.children.map((child) => renderDepartmentTreeNode(child))}
          </div>
        )}
      </div>
    );
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
          progress={34}
        />
        <StatCard
          icon={CircleStackIcon}
          label="Token 余额"
          value={remainingTokens}
          detail="企业级 Token 池"
          tone="green"
          progress={72}
        />
        <StatCard
          icon={BoltIcon}
          label="今日消耗"
          value="18.2K"
          detail="全部 AI 调用汇总"
          tone="amber"
          progress={48}
        />
        <StatCard
          icon={CubeIcon}
          label="已开通应用"
          value={String(enabledApps.length)}
          detail="平台授权可用"
          tone="violet"
          progress={40}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border bg-surface shadow-subtle">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-foreground">Token 消耗明细</h2>
              <p className="mt-1 text-xs text-secondary">按应用、员工和时间聚合最近调用</p>
            </div>
            <button
              type="button"
              onClick={() => showToast(i18nService.t('businessCenterComingSoon'))}
              className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 text-sm text-foreground transition-colors hover:bg-surface-raised"
            >
              近 7 天
              <ChevronRightIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-raised/40 text-xs text-secondary">
                  <th className="px-4 py-2.5 font-medium">来源</th>
                  <th className="px-4 py-2.5 font-medium">员工</th>
                  <th className="px-4 py-2.5 font-medium">消耗</th>
                  <th className="px-4 py-2.5 font-medium">时间</th>
                  <th className="px-4 py-2.5 font-medium">状态</th>
                </tr>
              </thead>
              <tbody>
                {tokenRows.map((row) => (
                  <tr key={`${row.source}-${row.employee}-${row.time}`} className="border-b border-border/60 text-foreground last:border-b-0 hover:bg-surface-raised/40">
                    <td className="px-4 py-3">{row.source}</td>
                    <td className="px-4 py-3 text-secondary">{row.employee}</td>
                    <td className="px-4 py-3 font-semibold">{row.usage}</td>
                    <td className="px-4 py-3 text-secondary">{row.time}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="truncate text-base font-semibold text-foreground">已开通应用</h2>
              <span className="rounded-full border border-border bg-background px-2 py-1 text-xs text-secondary">{enabledApps.length} 个</span>
            </div>
            <div className="space-y-2">
              {enabledApps.map((app) => (
                <article key={app.id} className="flex items-center gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-surface-raised/60">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-semibold ${toneClasses[app.tone].soft}`}>
                    {app.label}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-sm font-semibold text-foreground">{app.name}</h3>
                    <p className="mt-0.5 truncate text-xs text-secondary">{app.subtitle}</p>
                  </div>
                  <button type="button" onClick={() => showToast(i18nService.t('businessCenterComingSoon'))} className="inline-flex h-8 shrink-0 items-center rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-surface-raised">
                    打开
                  </button>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
            <h2 className="mb-3 text-base font-semibold text-foreground">平台使用情况</h2>
            <div className="grid gap-2">
              <UsageItem icon={UsersIcon} label="企业成员" value={String(employeeTotal || employees.length || '-')} detail="已同步" tone="cyan" />
              <UsageItem icon={CubeIcon} label="应用调用总数" value="28.6K" detail="+12.4%" tone="green" />
              <UsageItem icon={BoltIcon} label="Token 日均消耗" value="16.3K" detail="+8.7%" tone="amber" />
              <UsageItem icon={CircleStackIcon} label="存量预计可用" value="51 天" detail="按当前消耗" tone="violet" />
            </div>
          </section>
        </div>
      </section>
    </>
  );

  const organizationContent = (
    <section className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={UserGroupIcon}
          label="部门总数"
          value={String(departments.length)}
          detail={`${activeDepartments.length} 个启用中`}
          tone="cyan"
          progress={departments.length ? (activeDepartments.length / departments.length) * 100 : 0}
        />
        <StatCard
          icon={BuildingOffice2Icon}
          label="一级部门"
          value={String(departments.filter((department) => !department.parentId).length)}
          detail="组织树根节点"
          tone="green"
        />
        <StatCard
          icon={UsersIcon}
          label="已绑定成员"
          value={String(employeeTotal || employees.length)}
          detail="企业成员总数"
          tone="violet"
        />
        <StatCard
          icon={NoSymbolIcon}
          label="停用部门"
          value={String(disabledDepartmentCount)}
          detail="不影响历史成员记录"
          tone="amber"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-surface shadow-subtle">
            <div className="border-b border-border px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-foreground">组织树</h2>
                  <p className="mt-1 text-xs text-secondary">当前工作区的部门层级</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    void loadDepartments();
                    void loadEmployees();
                  }}
                  className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm text-foreground transition-colors hover:bg-surface-raised"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isOrgLoading || isEmployeeLoading ? 'animate-spin' : ''}`} />
                  刷新
                </button>
              </div>
              <label className="mt-3 flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm text-foreground focus-within:border-primary">
                <MagnifyingGlassIcon className="h-4 w-4 shrink-0 text-secondary" />
                <input
                  value={orgSearch}
                  onChange={(event) => setOrgSearch(event.target.value)}
                  className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-tertiary"
                  placeholder="搜索部门、编码或负责人"
                />
              </label>
            </div>
            <div className="max-h-[520px] overflow-y-auto p-3 [scrollbar-gutter:stable]">
              {filteredOrgTree.length > 0 ? (
                <div className="space-y-1">
                  {filteredOrgTree.map((department) => renderDepartmentTreeNode(department))}
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-secondary">
                  {isOrgLoading ? '正在加载组织架构' : '暂无匹配部门'}
                </div>
              )}
            </div>
          </section>

          <form onSubmit={handleCreateDepartment} className="rounded-lg border border-border bg-surface p-4 shadow-subtle">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-foreground">新增部门</h2>
                <p className="mt-1 text-xs text-secondary">部门数据由 AIZhongtai 管理</p>
              </div>
              <UserGroupIcon className="h-5 w-5 shrink-0 text-primary" />
            </div>
            <fieldset disabled={!canManageOrg} className="space-y-3 disabled:opacity-60">
              <label className="block">
                <span className="text-xs font-medium text-secondary">部门名称</span>
                <input
                  value={departmentForm.name}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="例如 运营部"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-secondary">部门编码</span>
                <input
                  value={departmentForm.code}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, code: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                  placeholder="例如 ops"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-secondary">上级部门</span>
                <select
                  value={departmentForm.parentId}
                  onChange={(event) => setDepartmentForm((prev) => ({ ...prev, parentId: event.target.value }))}
                  className="mt-1 h-9 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary"
                >
                  <option value="">无上级</option>
                  {activeDepartments.map((department) => (
                    <option key={department.id} value={department.id}>{department.name}</option>
                  ))}
                </select>
              </label>
              <button
                type="submit"
                className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <PlusIcon className="h-4 w-4" />
                新增部门
              </button>
            </fieldset>
            {!canManageOrg && <p className="mt-3 text-xs text-secondary">当前角色仅可查看组织架构。</p>}
          </form>
        </div>

        <section className="rounded-lg border border-border bg-surface shadow-subtle">
          {selectedDepartment ? (
            <>
              <div className="flex flex-col gap-4 border-b border-border px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(selectedDepartment.status)}`}>
                      {statusLabel(selectedDepartment.status)}
                    </span>
                    <span className="rounded-md border border-border bg-background px-2 py-0.5 text-xs text-secondary">
                      {selectedDepartment.code}
                    </span>
                  </div>
                  <h2 className="mt-3 truncate text-2xl font-semibold tracking-normal text-foreground">
                    {selectedDepartment.name}
                  </h2>
                  <p className="mt-2 text-sm text-secondary">
                    上级部门：{selectedDepartment.parentId ? departmentNameById.get(selectedDepartment.parentId) || '未知部门' : '无'}
                  </p>
                </div>
                {canManageOrg && selectedDepartment.status !== 'disabled' && (
                  <button
                    type="button"
                    onClick={() => handleDisableDepartment(selectedDepartment)}
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm text-secondary transition-colors hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-500"
                  >
                    <NoSymbolIcon className="h-4 w-4" />
                    停用部门
                  </button>
                )}
              </div>

              <div className="grid gap-3 border-b border-border p-5 md:grid-cols-3">
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-secondary">负责人</p>
                  <p className="mt-2 truncate text-lg font-semibold text-foreground">{selectedDepartment.managerName || '未设置'}</p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-secondary">部门成员</p>
                  <p className="mt-2 truncate text-lg font-semibold text-foreground">
                    {selectedDepartmentMemberTotal} 人
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background p-4">
                  <p className="text-xs text-secondary">直属下级</p>
                  <p className="mt-2 truncate text-lg font-semibold text-foreground">{childDepartments.length} 个</p>
                </div>
              </div>

              <div className="grid gap-4 p-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <section className="min-w-0">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h3 className="truncate text-sm font-semibold text-foreground">部门成员</h3>
                    <button
                      type="button"
                      onClick={() => setActiveTab('employees')}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs text-foreground transition-colors hover:bg-surface-raised"
                    >
                      员工管理
                      <ChevronRightIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border">
                    {departmentEmployees.length > 0 ? (
                      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                        <thead className="bg-surface-raised/40 text-xs text-secondary">
                          <tr>
                            <th className="px-4 py-2.5 font-medium">成员</th>
                            <th className="px-4 py-2.5 font-medium">角色</th>
                            <th className="px-4 py-2.5 font-medium">状态</th>
                          </tr>
                        </thead>
                        <tbody>
                          {departmentEmployees.map((employee) => (
                            <tr key={employee.id} className="border-t border-border/60 hover:bg-surface-raised/40">
                              <td className="px-4 py-3">
                                <div className="font-medium text-foreground">{employee.name || employee.username}</div>
                                <div className="mt-0.5 text-xs text-secondary">{employee.phone || employee.email || employee.username}</div>
                              </td>
                              <td className="px-4 py-3 text-secondary">{roleLabel(employee.role)}</td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${statusClass(employee.status)}`}>
                                  {statusLabel(employee.status)}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="p-8 text-center text-sm text-secondary">
                        {isDepartmentEmployeeLoading ? '正在加载部门成员' : '当前部门暂无成员'}
                      </div>
                    )}
                  </div>
                  {selectedDepartmentMemberTotal > departmentEmployees.length && (
                    <p className="mt-2 text-xs text-secondary">
                      已预览 {departmentEmployees.length} / {selectedDepartmentMemberTotal} 名成员，完整列表可在员工管理中查看。
                    </p>
                  )}
                </section>

                <section className="min-w-0">
                  <h3 className="mb-3 truncate text-sm font-semibold text-foreground">直属下级部门</h3>
                  <div className="space-y-2">
                    {childDepartments.length > 0 ? childDepartments.map((department) => (
                      <button
                        key={department.id}
                        type="button"
                        onClick={() => setSelectedDepartmentId(department.id)}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition-colors hover:bg-surface-raised"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium text-foreground">{department.name}</span>
                          <span className="mt-0.5 block truncate text-xs text-secondary">{departmentCodeLabel(department)} · {departmentEmployeeCount(department)} 人</span>
                        </span>
                        <ChevronRightIcon className="h-4 w-4 shrink-0 text-secondary" />
                      </button>
                    )) : (
                      <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-secondary">
                        暂无下级部门
                      </div>
                    )}
                  </div>
                </section>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-sm text-secondary">
              暂无组织架构数据
            </div>
          )}
        </section>
      </section>
    </section>
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
            <div className="flex min-w-0 items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 shrink-0 text-primary" />
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
          <div className="flex min-w-0 items-center gap-2">
            <BuildingOffice2Icon className="h-5 w-5 shrink-0 text-primary" />
            <h1 className="truncate text-lg font-semibold text-foreground">{i18nService.t('businessCenter')}</h1>
          </div>
        </div>
        <WindowTitleBar inline />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-background [scrollbar-gutter:stable]">
        <main className="mx-auto w-full max-w-[1220px] space-y-4 px-4 py-5 sm:px-6">
          <section className="rounded-lg border border-border bg-surface p-5 shadow-subtle">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    <CheckCircleIcon className="h-3.5 w-3.5" />
                    当前工作区
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-500">
                    <ShieldCheckIcon className="h-3.5 w-3.5" />
                    安全防护中
                  </span>
                </div>
                <h2 className="mt-4 truncate text-[28px] font-semibold leading-tight tracking-normal text-foreground">
                  {businessTitle}
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                  欢迎回来，{displayName}。这里汇总企业组织、员工、Token 和应用状态。
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[520px]">
                <div className="rounded-lg border border-border bg-background px-3 py-3">
                  <p className="text-xs text-secondary">工作区角色</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{roleLabel(currentRole)}</p>
                </div>
                <div className="rounded-lg border border-border bg-background px-3 py-3">
                  <p className="text-xs text-secondary">套餐状态</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{quota?.planName || '企业版'}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="inline-flex h-full min-h-[62px] items-center justify-center gap-2 rounded-lg bg-primary px-3 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                  刷新数据
                </button>
              </div>
            </div>
          </section>

          <nav className="non-draggable flex gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => handleTabClick(item)}
                  className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary-muted text-primary'
                      : item.enabled
                        ? 'text-secondary hover:bg-surface-raised hover:text-foreground'
                        : 'text-tertiary hover:bg-surface-raised'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
            <div className="ml-auto hidden items-center gap-2 px-2 text-xs text-secondary lg:flex">
              <BellIcon className="h-4 w-4" />
              12 条待处理提醒
              <button type="button" onClick={() => showToast(i18nService.t('businessCenterComingSoon'))} className="rounded-md p-1 transition-colors hover:bg-surface-raised hover:text-foreground" aria-label="帮助">
                <QuestionMarkCircleIcon className="h-4 w-4" />
              </button>
            </div>
          </nav>

          {activeTab === 'organization'
            ? organizationContent
            : activeTab === 'employees'
              ? employeesContent
              : overviewContent}
        </main>
      </div>
    </div>
  );
};

export default BusinessCenterView;
