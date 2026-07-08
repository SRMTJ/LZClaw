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

const unwrap = <T>(result: { success: boolean; data?: T; error?: string }, fallback: string): T => {
  if (!result.success || result.data === undefined) {
    throw new Error(result.error || fallback);
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

  async disableDepartment(id: string): Promise<BusinessDepartment> {
    return unwrap(await window.electron.businessCenter.deleteDepartment(id), '停用部门失败');
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
