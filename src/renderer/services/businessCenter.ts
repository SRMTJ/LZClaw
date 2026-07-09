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

export interface BusinessEmployee {
  id: string;
  enterpriseId: string;
  username: string;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  status: string;
  identityProvider: string;
  casdoorOrgName?: string;
  casdoorUserId?: string;
  casdoorUsername?: string;
  departmentIds: string[];
  departmentNames: string[];
  primaryDepartmentId?: string;
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
  phone?: string;
  email?: string;
  role?: string;
  departmentIds?: string[];
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
  return error;
};

const unwrap = <T>(result: { success: boolean; data?: T; error?: string }, fallback: string): T => {
  if (!result.success || result.data === undefined) {
    throw new Error(normalizeBusinessCenterError(result.error, fallback));
  }
  return result.data;
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

  async setDepartmentStatus(id: string, status: BusinessDepartmentStatus, sortOrder = 0): Promise<BusinessDepartment> {
    return this.updateDepartment(id, { status, sortOrder });
  }

  async disableDepartment(id: string, sortOrder = 0): Promise<BusinessDepartment> {
    return this.setDepartmentStatus(id, 'disabled', sortOrder);
  }

  async deleteDepartment(id: string): Promise<BusinessDepartment> {
    return unwrap(await window.electron.businessCenter.deleteDepartment(id), '删除组织节点失败');
  }

  async getEmployees(query: Record<string, unknown> = {}): Promise<BusinessEmployeeList> {
    return unwrap(await window.electron.businessCenter.getEmployees(query), '加载员工失败');
  }

  async createEmployee(input: CreateEmployeeInput): Promise<BusinessEmployee> {
    return unwrap(await window.electron.businessCenter.createEmployee({ ...input }), '新增员工失败');
  }

  async disableEmployee(id: string): Promise<BusinessEmployee> {
    return unwrap(await window.electron.businessCenter.disableEmployee(id), '禁用员工失败');
  }

  async resetEmployeePassword(id: string, password: string): Promise<void> {
    await unwrap(await window.electron.businessCenter.resetEmployeePassword(id, password), '重置密码失败');
  }
}

export const businessCenterService = new BusinessCenterService();
