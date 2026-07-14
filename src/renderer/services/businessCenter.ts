export interface BusinessDepartment {
  id: string;
  enterpriseId: string;
  parentId?: string;
  name: string;
  code: string;
  managerEnterpriseUserId?: string;
  managerName?: string;
  sortOrder: number;
  status: string;
  employeeCount: number;
  createdAt: string;
  updatedAt: string;
}

export type BusinessDepartmentStatus = 'active' | 'disabled';

export const BusinessEmployeeRole = {
  Owner: 'owner',
  Admin: 'admin',
  Employee: 'employee',
} as const;
export type BusinessEmployeeRoleValue = typeof BusinessEmployeeRole[keyof typeof BusinessEmployeeRole];

export const BusinessEmployeeStatus = {
  Active: 'active',
  Disabled: 'disabled',
} as const;
export type BusinessEmployeeStatusValue = typeof BusinessEmployeeStatus[keyof typeof BusinessEmployeeStatus];

export interface BusinessApplication {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
}

export interface BusinessEmployee {
  id: string;
  enterpriseId: string;
  username: string;
  name: string;
  phone?: string;
  email?: string;
  role: BusinessEmployeeRoleValue;
  status: BusinessEmployeeStatusValue;
  forcePasswordChange: boolean;
  identityProvider: string;
  casdoorOrgName?: string;
  casdoorUserId?: string;
  casdoorUsername?: string;
  departmentIds: string[];
  departmentNames: string[];
  primaryDepartmentId?: string;
  applicationIds: string[];
  applicationNames: string[];
  applicationCount: number;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessEmployeeList {
  items: BusinessEmployee[];
  total: number;
  page: number;
  pageSize: number;
  pages: number;
  summary: BusinessEmployeeSummary;
}

export interface BusinessEmployeeSummary {
  total: number;
  active: number;
  disabled: number;
  addedThisMonth: number;
}

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  parentId?: string;
  managerEnterpriseUserId?: string;
  sortOrder?: number;
  status?: BusinessDepartmentStatus;
}

export interface UpdateDepartmentInput {
  name?: string;
  code?: string;
  parentId?: string;
  managerEnterpriseUserId?: string;
  sortOrder?: number;
  status?: BusinessDepartmentStatus;
}

export interface CreateEmployeeInput {
  username: string;
  password: string;
  name: string;
  phone: string;
  email?: string;
  role: Exclude<BusinessEmployeeRoleValue, 'owner'>;
  status: BusinessEmployeeStatusValue;
  forcePasswordChange: boolean;
  departmentIds: string[];
  applicationIds: string[];
}

export interface UpdateEmployeeInput {
  name?: string;
  phone?: string;
  email?: string;
  role?: Exclude<BusinessEmployeeRoleValue, 'owner'>;
  status?: BusinessEmployeeStatusValue;
  departmentIds?: string[];
  applicationIds?: string[];
}

export interface ResetEmployeePasswordInput {
  password: string;
  forcePasswordChange: boolean;
}

const normalizeBusinessCenterError = (error: string | undefined, fallback: string): string => {
  if (!error) return fallback;
  if (error.includes('department has child departments')) {
    return '该组织节点存在下级节点，请先删除或迁移下级节点';
  }
  if (error.includes('department has assigned employees')) {
    return '该组织节点已有员工归属，请先调整员工部门后再删除';
  }
  if (error.includes('department not found')) {
    return '组织节点不存在或已被删除';
  }
  if (error.includes('parent department not found')) {
    return '上级组织节点不存在或已被删除';
  }
  if (error.includes('department parent would create a cycle')) {
    return '上级组织不能选择当前节点的下级节点';
  }
  if (error.includes('department cannot be its own parent')) {
    return '上级组织不能选择当前节点自身';
  }
  if (error.includes('manager employee not found')) {
    return '负责人不存在或不属于当前企业';
  }
  if (error.includes('creating enterprise employee')) {
    return '员工账号已存在于当前企业，请更换账号后重试';
  }
  if (error.includes('phone is required')) {
    return '请输入员工手机号';
  }
  if (error.includes('at least one department is required')) {
    return '请选择员工所属组织';
  }
  if (error.includes('one or more departments were not found')) {
    return '所选组织不存在、已停用或已被删除';
  }
  if (error.includes('application is not available for current enterprise')) {
    return '所选应用未向当前企业开通或已失效';
  }
  if (error.includes('only enterprise owner can assign admin role')) {
    return '只有企业主可以授予管理员角色';
  }
  if (error.includes('admin can only manage employees')) {
    return '管理员只能管理普通员工';
  }
  if (error.includes('owner cannot be modified')) {
    return '企业主不能通过员工管理修改';
  }
  if (error.includes('current user cannot disable itself')) {
    return '不能停用当前登录账号';
  }
  if (error.includes('password must be at least 6 characters')) {
    return '密码至少需要 6 位';
  }
  return error;
};

const unwrap = <T>(result: { success: boolean; data?: T; error?: string }, fallback: string): T => {
  if (!result.success || result.data === undefined) {
    throw new Error(normalizeBusinessCenterError(result.error, fallback));
  }
  return result.data;
};

const ensureSuccess = (result: { success: boolean; error?: string }, fallback: string): void => {
  if (!result.success) {
    throw new Error(normalizeBusinessCenterError(result.error, fallback));
  }
};

class BusinessCenterService {
  async getDepartments(): Promise<BusinessDepartment[]> {
    return unwrap(await window.electron.businessCenter.getDepartments(), '加载组织架构失败');
  }

  async createDepartment(input: CreateDepartmentInput): Promise<BusinessDepartment> {
    return unwrap(await window.electron.businessCenter.createDepartment({ ...input }), '新增部门失败');
  }

  async updateDepartment(id: string, input: UpdateDepartmentInput): Promise<BusinessDepartment> {
    return unwrap(await window.electron.businessCenter.updateDepartment(id, { ...input }), '更新组织节点失败');
  }

  async setDepartmentStatus(id: string, status: BusinessDepartmentStatus, sortOrder = 0): Promise<void> {
    ensureSuccess(
      await window.electron.businessCenter.updateDepartment(id, { status, sortOrder }),
      status === 'disabled' ? '停用组织节点失败' : '启用组织节点失败',
    );
  }

  async disableDepartment(id: string, sortOrder = 0): Promise<void> {
    await this.setDepartmentStatus(id, 'disabled', sortOrder);
  }

  async deleteDepartment(id: string): Promise<void> {
    ensureSuccess(await window.electron.businessCenter.deleteDepartment(id), '删除组织节点失败');
  }

  async getEmployees(query: Record<string, unknown> = {}): Promise<BusinessEmployeeList> {
    return unwrap(await window.electron.businessCenter.getEmployees(query), '加载员工失败');
  }

  async getEmployee(id: string): Promise<BusinessEmployee> {
    return unwrap(await window.electron.businessCenter.getEmployee(id), '加载员工详情失败');
  }

  async createEmployee(input: CreateEmployeeInput): Promise<BusinessEmployee> {
    return unwrap(await window.electron.businessCenter.createEmployee({ ...input }), '新增员工失败');
  }

  async updateEmployee(id: string, input: UpdateEmployeeInput): Promise<BusinessEmployee> {
    return unwrap(await window.electron.businessCenter.updateEmployee(id, { ...input }), '更新员工失败');
  }

  async disableEmployee(id: string): Promise<BusinessEmployee> {
    return unwrap(await window.electron.businessCenter.disableEmployee(id), '禁用员工失败');
  }

  async resetEmployeePassword(id: string, input: ResetEmployeePasswordInput): Promise<void> {
    await unwrap(await window.electron.businessCenter.resetEmployeePassword(id, { ...input }), '重置密码失败');
  }

  async getAvailableApplications(): Promise<BusinessApplication[]> {
    return unwrap(await window.electron.businessCenter.getAvailableApplications(), '加载企业应用失败');
  }

  async setEmployeeApplications(id: string, applicationIds: string[]): Promise<BusinessEmployee> {
    return unwrap(
      await window.electron.businessCenter.setEmployeeApplications(id, applicationIds),
      '配置员工应用失败',
    );
  }
}

export const businessCenterService = new BusinessCenterService();
