export const BusinessCenterIpc = {
  GetDepartments: 'businessCenter:getDepartments',
  CreateDepartment: 'businessCenter:createDepartment',
  UpdateDepartment: 'businessCenter:updateDepartment',
  DeleteDepartment: 'businessCenter:deleteDepartment',
  GetEmployees: 'businessCenter:getEmployees',
  GetEmployee: 'businessCenter:getEmployee',
  CreateEmployee: 'businessCenter:createEmployee',
  UpdateEmployee: 'businessCenter:updateEmployee',
  DisableEmployee: 'businessCenter:disableEmployee',
  ResetEmployeePassword: 'businessCenter:resetEmployeePassword',
  GetAvailableApplications: 'businessCenter:getAvailableApplications',
  SetEmployeeApplications: 'businessCenter:setEmployeeApplications',
} as const;

export type BusinessCenterIpcChannel = typeof BusinessCenterIpc[keyof typeof BusinessCenterIpc];
