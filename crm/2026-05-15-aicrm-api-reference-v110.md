# AIcrm V1.10 接口文档

更新时间：2026-05-15  
适用范围：`E:\Desktop\git\LZcrm\backend` 当前后端已实现接口  
接口前缀：`/api/v1`  
历史文档：`docs/api/2026-04-21-aicrm-api-reference.md`

本文档以当前后端 `backend/internal/bootstrap/router.go`、DTO、handler 和 service 代码为准，覆盖认证、用户权限、数据字典、系统设置、AI驾驶舱、V1.10 线索挖掘、线索池、客户池、异步任务、通知和 RAG 痛点总结链路。

## 1. 全局约定

### 1.1 请求地址

本地开发常见地址：

- 前端：`http://127.0.0.1:3000`
- 后端 API：`http://127.0.0.1:8080/api/v1`
- WeKnora 管理后台入口：由系统设置 `weknora_admin_url` 配置，默认常见值为 `http://127.0.0.1:18081`

文档中的路径默认省略 `/api/v1` 前缀，例如 `/auth/login` 实际请求为 `/api/v1/auth/login`。

### 1.2 鉴权

公开接口：

- `POST /auth/login`
- `POST /auth/sms-code`
- `POST /auth/sms-login`

除公开接口外，前端调用均应携带访问令牌：

```http
Authorization: Bearer <access_token>
```

当前中间件兼容裸 token，但正式调用统一使用 `Bearer`。业务接口如果未携带有效 token，会返回：

```json
{
  "code": 40101,
  "message": "unauthorized",
  "data": {}
}
```

### 1.3 统一响应

所有接口返回统一信封：

```json
{
  "code": 0,
  "message": "success",
  "data": {}
}
```

说明：

- `code = 0` 表示成功。
- 业务错误通常 HTTP 状态仍为 `200`，需要以前端 `code` 判断成功或失败。
- 未知错误或系统内部错误通常 HTTP 状态为 `500`，响应 `code = 50001`。
- 响应头会带 `X-Request-Trace`，如果请求头没有传同名 trace，后端会生成一个 UTC 时间戳 trace。

### 1.4 分页

列表接口统一支持：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | number | `1` | 页码，小于 1 时按 1 处理 |
| `page_size` | number | `10` | 每页条数，小于 1 时按 10 处理，最大 100 |

分页返回结构：

```json
{
  "list": [],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 0
  }
}
```

部分结果型接口使用 `results` 字段承载列表，但 `pagination` 结构一致。

### 1.5 错误码

| code | message | 含义 |
| --- | --- | --- |
| `0` | `success` | 成功 |
| `40001` | `invalid params` | 参数非法、缺少参数、路径参数解析失败 |
| `40101` | `unauthorized` | 未登录、token 无效、当前会话无效 |
| `40301` | `forbidden` | 禁止访问，例如默认角色或默认用户不允许删除 |
| `43001` | `resource not found` | 资源不存在 |
| `43004` | `invalid resource state` | 资源当前状态不允许该操作 |
| `43005` | `state transition denied` | 状态流转被拒绝 |
| `45002` | `duplicate operation` | 重复操作，例如角色名、用户名、手机号重复 |
| `50001` | `system internal` | 系统内部错误 |

## 2. 接口总览

| 模块 | 方法 | 路径 | 说明 | 鉴权 |
| --- | --- | --- | --- | --- |
| 认证 | `POST` | `/auth/login` | 账号密码登录 | 否 |
| 认证 | `POST` | `/auth/sms-code` | 获取短信验证码 | 否 |
| 认证 | `POST` | `/auth/sms-login` | 短信验证码登录 | 否 |
| 认证 | `GET` | `/auth/me` | 当前会话 | 是 |
| 角色 | `GET` | `/roles` | 角色列表 | 是 |
| 角色 | `POST` | `/roles` | 新增角色 | 是 |
| 角色 | `PUT` | `/roles/{id}` | 编辑角色 | 是 |
| 角色 | `DELETE` | `/roles/{id}` | 删除角色 | 是 |
| 用户 | `GET` | `/users` | 用户列表 | 是 |
| 用户 | `POST` | `/users` | 新增用户 | 是 |
| 用户 | `PUT` | `/users/{id}` | 编辑用户 | 是 |
| 用户 | `DELETE` | `/users/{id}` | 删除用户 | 是 |
| 设置 | `GET` | `/dictionaries` | 数据字典列表 | 是 |
| 设置 | `PUT` | `/dictionaries/{id}` | 编辑字典项 | 是 |
| 设置 | `GET` | `/system-settings` | 系统设置列表 | 是 |
| 设置 | `PUT` | `/system-settings/{id}` | 编辑系统设置 | 是 |
| AI驾驶舱 | `GET` | `/ai-prompts` | AI 提示词列表 | 是 |
| AI驾驶舱 | `PUT` | `/ai-prompts/{id}` | 编辑 AI 提示词 | 是 |
| AI驾驶舱 | `GET` | `/ai-call-records` | AI 调用记录 | 是 |
| 异步任务 | `GET` | `/async-tasks/{id}` | 查询异步任务 | 是 |
| V1.10 线索挖掘 | `POST` | `/source-search-runs` | 发起高德线索挖掘 | 是 |
| V1.10 线索挖掘 | `GET` | `/source-search-runs` | 线索挖掘任务列表 | 是 |
| V1.10 线索挖掘 | `GET` | `/source-search-runs/{id}/results` | 线索挖掘结果列表 | 是 |
| V1.10 线索挖掘 | `POST` | `/source-search-results/join-pool` | 将挖掘结果加入公海 | 是 |
| 兼容旧线索挖掘 | `POST` | `/search-tasks` | 创建旧版检索任务 | 是 |
| 兼容旧线索挖掘 | `GET` | `/search-tasks` | 旧版检索任务列表 | 是 |
| 兼容旧线索挖掘 | `GET` | `/search-tasks/{id}/results` | 旧版检索结果 | 是 |
| 兼容旧线索挖掘 | `POST` | `/search-results/{result_id}/claim` | 认领旧版检索结果 | 是 |
| 线索公海 | `GET` | `/lead-pool` | 线索公海列表 | 是 |
| 线索公海 | `POST` | `/lead-pool` | 手动创建公海线索 | 是 |
| 线索公海 | `GET` | `/lead-pool/{lead_id}` | 线索公海详情 | 是 |
| 线索公海 | `POST` | `/lead-pool/{lead_id}/claim` | 认领线索 | 是 |
| 线索公海 | `POST` | `/lead-pool/{lead_id}/assign` | 分配线索 | 是 |
| 我的线索 | `GET` | `/my-leads` | 我的线索列表 | 是 |
| 我的线索 | `GET` | `/my-leads/{lead_id}` | 我的线索详情 | 是 |
| 我的线索 | `POST` | `/leads/{lead_id}/enrichment` | 线索补充 | 是 |
| 我的线索 | `POST` | `/leads/{lead_id}/script` | 生成线索话术 | 是 |
| 我的线索 | `POST` | `/leads/{lead_id}/follow-ups` | 新增线索跟进 | 是 |
| 我的线索 | `POST` | `/leads/{lead_id}/convert-to-customer` | 线索转客户校验 | 是 |
| 我的线索 | `POST` | `/leads/{lead_id}/transfer-records` | 转移线索 | 是 |
| 客户公海 | `GET` | `/customer-pool` | 客户公海列表 | 是 |
| 客户公海 | `GET` | `/customer-pool/{customer_id}` | 客户公海详情 | 是 |
| 客户公海 | `POST` | `/customer-pool/{customer_id}/claim` | 认领客户 | 是 |
| 我的客户 | `GET` | `/my-customers` | 我的客户列表 | 是 |
| 我的客户 | `GET` | `/my-customers/{customer_id}` | 我的客户详情 | 是 |
| 我的客户 | `POST` | `/customers/{customer_id}/follow-up-plans` | 创建客户跟进计划 | 是 |
| 我的客户 | `POST` | `/customers/{customer_id}/follow-up-records` | 创建客户跟进记录 | 是 |
| 我的客户 | `POST` | `/customers/{customer_id}/stage-transitions` | 推进客户阶段 | 是 |
| 我的客户 | `POST` | `/customers/{customer_id}/transfer-records` | 转移客户 | 是 |
| 通知 | `GET` | `/notifications` | 通知列表 | 是 |
| 通知 | `POST` | `/notifications/read-all` | 全部已读 | 是 |
| 通知 | `POST` | `/notifications/{id}/read` | 单条已读 | 是 |

## 3. 认证

### 3.1 账号密码登录

`POST /auth/login`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `username` | string | 否 | 用户名。与 `mobile` 二选一 |
| `mobile` | string | 否 | 手机号。与 `username` 二选一 |
| `password` | string | 是 | 密码 |

示例：

```json
{
  "username": "admin",
  "password": "Passw0rd!"
}
```

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `access_token` | string | 后续请求令牌 |
| `user_name` | string | 展示名 |
| `user_id` | string | 当前用户 ID |
| `role_name` | string | 角色名 |
| `login_name` | string | 登录名 |
| `allowed_menu_paths` | string[] | 当前用户可见菜单路径 |

常见错误：`40001` 参数不完整，`40101` 用户不存在或密码错误。

### 3.2 获取短信验证码

`POST /auth/sms-code`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mobile` | string | 是 | 手机号 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `mobile` | string | 手机号 |
| `resend_available_at` | string | 可再次发送时间 |
| `expires_at` | string | 验证码过期时间 |

### 3.3 短信登录

`POST /auth/sms-login`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `mobile` | string | 是 | 手机号 |
| `verification_code` | string | 是 | 验证码 |

成功 `data` 与 `/auth/login` 一致。

### 3.4 当前会话

`GET /auth/me`

成功 `data` 与 `/auth/login` 一致。token 失效时返回 `40101`，前端应清理本地会话并跳转登录页。

## 4. 用户与角色

### 4.1 角色列表

`GET /roles`

查询参数：`page`、`page_size`

成功 `data.list[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 角色 ID |
| `role_name` | string | 角色名称 |
| `allowed_menu_paths` | string[] | 允许访问的菜单路径 |
| `is_default` | boolean | 是否默认角色 |

### 4.2 新增角色

`POST /roles`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `role_name` | string | 是 | 角色名称，不能与现有角色重复 |
| `allowed_menu_paths` | string[] | 否 | 菜单路径权限 |

成功 `data` 为角色对象。常见错误：`40001` 名称为空，`45002` 角色名重复。

### 4.3 编辑角色

`PUT /roles/{id}`

请求体同新增角色。常见错误：`43001` 角色不存在，`45002` 角色名重复。

### 4.4 删除角色

`DELETE /roles/{id}`

成功 `data`：

```json
{}
```

常见错误：`40301` 默认角色不允许删除，`43004` 角色已分配给用户。

### 4.5 用户列表

`GET /users`

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `mobile` | string | 按手机号筛选 |
| `name` | string | 按姓名或用户名筛选 |
| `page` | number | 页码 |
| `page_size` | number | 每页条数 |

成功 `data.list[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 用户 ID |
| `username` | string | 用户名 |
| `display_name` | string | 展示名 |
| `mobile` | string | 手机号 |
| `role_id` | number | 角色 ID |
| `role_name` | string | 角色名 |
| `is_default` | boolean | 是否默认用户 |

### 4.6 新增用户

`POST /users`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `username` | string | 否 | 用户名。为空时默认使用手机号 |
| `display_name` | string | 是 | 展示名 |
| `mobile` | string | 是 | 手机号，不能重复 |
| `password` | string | 是 | 初始密码 |
| `role_id` | number | 是 | 有效角色 ID |

常见错误：`40001` 展示名/手机号/密码/角色缺失，`45002` 用户名或手机号重复。

### 4.7 编辑用户

`PUT /users/{id}`

请求体同新增用户，但 `password` 可为空；为空时保留原密码。常见错误：`43001` 用户不存在。

### 4.8 删除用户

`DELETE /users/{id}`

成功 `data` 为 `{}`。默认用户不允许删除。

## 5. 设置与 AI 驾驶舱

### 5.1 数据字典列表

`GET /dictionaries`

查询参数：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `dict_type` | string | 字典类型。为空时返回全部字典项 |
| `page` | number | 页码 |
| `page_size` | number | 每页条数 |

成功 `data.list[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 字典项 ID |
| `dict_type` | string | 字典类型，例如 `city_adcode`、`sub_industry` |
| `dict_code` | string | 字典编码 |
| `dict_name` | string | 当前值 |
| `description` | string | 说明。细分行业的搜索关键词等扩展配置会放在这里 |
| `sort_no` | number | 排序 |
| `enabled` | boolean | 是否启用 |

重要字典：

- `city_adcode`：地区字典，高德行政区划编码，用于线索挖掘 `area_code`。
- `sub_industry`：细分行业字典，用于线索挖掘 `sub_industry_id`，要求说明中配置 4 个搜索关键词。
- `customer_stage_display`、`customer_status`、`lead_status`、`follow_up_method` 等：客户、线索和跟进相关枚举。

### 5.2 编辑字典项

`PUT /dictionaries/{id}`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `dict_name` | string | 是 | 当前值，不能为空 |
| `description` | string | 否 | 说明或 JSON 扩展配置 |
| `sort_no` | number | 是 | 排序号 |
| `enabled` | boolean | 是 | 是否启用 |

成功 `data` 为字典项对象。

### 5.3 系统设置列表

`GET /system-settings`

查询参数：`page`、`page_size`

成功 `data.list[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 设置 ID |
| `setting_key` | string | 设置键 |
| `setting_name` | string | 设置名称 |
| `setting_value` | string | 设置值。敏感 key 会脱敏展示 |
| `description` | string | 说明 |

敏感设置判断包含：`api_key`、`secret`、`token`、`password`。脱敏值示例：`************1234`。提交脱敏值时后端会保留原真实值。

常见设置：

| setting_key | 用途 |
| --- | --- |
| `amap_api_key` | 高德地图 API Key，线索挖掘必需 |
| `weknora_admin_url` | 知识库管理后台打开地址 |
| `weknora_pg_schema` | WeKnora 在当前 PostgreSQL database 中使用的 schema |
| `weknora_knowledge_base_ids` | RAG 检索使用的知识库 ID，多个用英文逗号分隔 |
| `rag_top_k` | 痛点总结最多使用的知识片段数量 |
| `rag_timeout_seconds` | RAG 检索和大模型调用超时时间 |
| `ai_gateway_base_url` | OpenAI-compatible AI 中转站地址 |
| `ai_gateway_api_key` | AI 中转站 API Key |
| `chat_model_name` | 痛点总结使用的对话模型 |
| `embedding_model_name` | 知识检索 embedding 模型 |
| `embedding_dimension` | embedding 向量维度 |

### 5.4 编辑系统设置

`PUT /system-settings/{id}`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `setting_value` | string | 是 | 设置值，不能为空 |

### 5.5 AI 提示词列表

`GET /ai-prompts`

查询参数：`page`、`page_size`

成功 `data.list[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 提示词 ID |
| `prompt_key` | string | 提示词键 |
| `prompt_name` | string | 提示词名称 |
| `prompt_group` | string | 分组 |
| `prompt_content` | string | 提示词内容 |
| `is_enabled` | boolean | 是否启用 |
| `version` | number | 版本 |
| `remark` | string | 备注 |
| `update_user_id` | number | 更新人 ID |

### 5.6 编辑 AI 提示词

`PUT /ai-prompts/{id}`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt_name` | string | 是 | 提示词名称 |
| `prompt_group` | string | 是 | 分组 |
| `prompt_content` | string | 是 | 内容 |
| `is_enabled` | boolean | 是 | 是否启用 |
| `remark` | string | 否 | 备注 |
| `update_user_id` | number | 是 | 更新人 ID |

### 5.7 AI 调用记录

`GET /ai-call-records`

查询参数：`page`、`page_size`

成功 `data.list[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `ai_call_id` | number | 调用记录 ID |
| `capability` | string | AI 能力，例如 `lead_mining_pain_points` |
| `resource_type` | string | 资源类型 |
| `resource_id` | number | 资源 ID |
| `ai_input` | object | 输入摘要，RAG 会记录 `query`、`knowledge_chunks`、`poi` |
| `ai_output` | object | 输出结构化结果 |
| `generated_at` | string | 生成时间 |
| `model_name` | string | 模型名称 |
| `is_used` | boolean | 结果是否被业务采用 |
| `is_edited` | boolean | 是否人工编辑 |
| `ai_failure_reason` | object | AI 或知识检索失败原因 |

## 6. 异步任务

### 6.1 查询异步任务

`GET /async-tasks/{id}`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 任务 ID |
| `task_type` | string | 任务类型 |
| `resource_type` | string | 资源类型 |
| `resource_id` | number | 资源 ID |
| `task_status` | string | `pending`、`running`、`success`、`failed` 等 |
| `prompt_key` | string | 使用的提示词键 |
| `prompt_snapshot` | string | 发起任务时的提示词快照 |
| `business_payload_snapshot` | object | 业务输入快照 |
| `context_snapshot` | object | 上下文快照 |
| `result_payload` | object | 任务结果 |
| `error_message` | string | 失败原因 |

不存在时返回 `43001`。

## 7. V1.10 线索挖掘

V1.10 线索挖掘使用高德 POI 检索，核心输入为地区编码和细分行业。

- 地区来自数据字典 `city_adcode`。
- 细分行业来自数据字典 `sub_industry`。
- 细分行业必须配置 4 个搜索关键词，否则发起挖掘返回 `40001`。
- 高德 Key 从系统设置 `amap_api_key` 读取，未配置时返回 `40001`。
- 痛点总结在挖掘后自动触发，结果写入 `business_pain_points` 和 `ai_call_record`。

### 7.1 发起线索挖掘

`POST /source-search-runs`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `area_code` | string | 是 | 地区编码，应使用 `city_adcode.dict_code` |
| `sub_industry_id` | string | 是 | 细分行业编码，应使用 `sub_industry.dict_code` |

示例：

```json
{
  "area_code": "371300",
  "sub_industry_id": "dental_clinic"
}
```

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_search_run_id` | string | 挖掘任务 ID |
| `region_name` | string | 地区名称 |
| `adcode` | string | 高德行政区划编码 |
| `sub_industry` | string | 细分行业名称 |
| `search_keywords` | string[] | 实际使用的 4 个搜索关键词 |
| `search_status` | string | `running`、`success`、`partial_success`、`failed` |
| `raw_result_count` | number | 原始结果数 |
| `deduped_result_count` | number | 去重后结果数 |
| `joined_pool_count` | number | 已加入公海数量 |
| `failed_keywords` | string[] | 失败关键词 |
| `search_failure_reason` | string | 检索失败摘要 |
| `error_detail` | object | 按关键词记录的错误明细 |
| `created_by` | string | 创建人 ID |
| `created_at` | string | 创建时间 |
| `completed_at` | string | 完成时间 |

### 7.2 线索挖掘任务列表

`GET /source-search-runs`

查询参数：`page`、`page_size`。只返回当前登录用户创建的任务。

成功 `data`：

```json
{
  "list": [],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 0
  }
}
```

`list[]` 字段同 7.1 成功 `data`。

### 7.3 线索挖掘结果列表

`GET /source-search-runs/{id}/results`

查询参数：`page`、`page_size`

成功 `data.results[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `source_result_id` | string | 挖掘结果 ID |
| `source_search_run_id` | string | 挖掘任务 ID |
| `dedupe_key` | string | 去重键 |
| `result_status` | string | `not_joined_pool`、`completion_failed` 等 |
| `duplicate_reason` | string | 重复原因 |
| `duplicate_object_type` | string | 重复对象类型 |
| `duplicate_object_id` | number | 重复对象 ID |
| `amap_poi_id` | string | 高德 POI ID |
| `poi_name` | string | 门店名称 |
| `sub_industry` | string | 细分行业 |
| `brand_name` | string | 品牌名称 |
| `store_count` | number | 门店数量 |
| `business_pain_points` | string | 经营痛点总结 |
| `poi_address` | string | 门店地址 |
| `contact_phone` | string | 联系电话 |
| `poi_rating` | number | POI 评分 |
| `poi_photos` | array | 图片列表，元素为 `{ "title": "", "url": "" }` |
| `business_info` | string | 经营信息 |
| `ai_failure_reason` | object | AI 补全或 RAG 失败原因 |

### 7.4 加入线索公海

`POST /source-search-results/join-pool`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `source_result_ids` | string[] | 是 | 要加入公海的挖掘结果 ID 列表 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `joined_count` | number | 新加入公海数量 |
| `duplicate_count` | number | 重复未加入数量 |

## 8. RAG 痛点总结链路

RAG 痛点总结目前不是独立前端按钮接口，而是在 `POST /source-search-runs` 发起线索挖掘后，对每条保存后的挖掘结果自动执行。

链路：

1. 根据 `source_search_result` 组装门店信息。
2. 根据 `sub_industry_id`、`capability = lead_mining_pain_points`、`enabled = true` 检索知识库 Top K。
3. 读取 AI驾驶舱提示词：优先 `lead_pain_summary` 和 `lead_mining_pain_points`。
4. 调用 OpenAI-compatible AI 中转站 `/chat/completions`，要求返回 JSON。
5. 将 `business_pain_points` 写回挖掘结果。
6. 写入 `ai_call_record`，记录 `query`、`knowledge_chunks`、POI 输入、模型输出和失败原因。

依赖的系统设置见 5.3。无知识库、embedding 失败、AI 中转站失败时不会中断主挖掘流程，失败原因写入 `ai_failure_reason` 和 `ai_call_record.ai_failure_reason`。

## 9. 兼容旧线索挖掘接口

以下接口保留用于兼容旧流程和测试。V1.10 用户界面优先使用 `/source-search-runs`。

### 9.1 创建旧版检索任务

`POST /search-tasks`

请求体：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `template_code` | string | 模板编码 |
| `keyword` | string | 关键词 |
| `city_code` | string | 城市编码 |
| `district_code` | string | 区县编码 |
| `store_category` | string | 门店分类 |
| `price_band` | string | 价格带 |
| `store_type` | string | 门店类型 |
| `scale_type` | string | 规模类型 |
| `mobile_required` | string | 是否要求手机号 |
| `business_stage` | string | 经营阶段 |
| `operation_signal` | string | 经营信号 |
| `group_buy_status` | string | 团购状态 |
| `group_buy_package_count` | string | 团购套餐数量 |
| `rating_level` | string | 评分等级 |
| `opportunity_level` | string | 机会等级 |
| `pain_point` | string | 痛点 |
| `team_size` | string | 团队规模 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | number | 任务 ID |
| `task_name` | string | 任务名称 |
| `task_status` | string | 任务状态 |
| `result_count` | number | 结果数量 |

### 9.2 旧版任务列表

`GET /search-tasks`

查询参数：`page`、`page_size`。只返回当前登录用户任务。

成功 `data.list[]` 包含 9.1 请求字段，并额外包含：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `task_id` | number | 任务 ID |
| `task_name` | string | 任务名称 |
| `task_status` | string | 任务状态 |
| `result_count` | number | 结果数量 |
| `create_time` | string | 创建时间 |
| `update_time` | string | 更新时间 |

### 9.3 旧版任务结果

`GET /search-tasks/{id}/results`

查询参数：`page`、`page_size`

成功 `data.results[]`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | number | 结果 ID |
| `external_id` | string | 外部 ID |
| `company_name` | string | 公司或门店名称 |
| `contact_name` | string | 联系人 |
| `mobile` | string | 手机号 |
| `region_text` | string | 区域文本 |
| `detailed_address` | string | 详细地址 |
| `store_type` | string | 门店类型 |
| `scale_type` | string | 规模类型 |
| `price_band` | string | 价格带 |
| `has_group_buy` | string | 是否有团购 |
| `group_buy_package_count` | string | 团购套餐数量 |
| `store_category` | string | 门店分类 |
| `rating_level` | string | 评分等级 |
| `opportunity_level` | string | 机会等级 |
| `pain_point` | string | 痛点 |
| `recommendation_reason` | string | 推荐理由 |

### 9.4 认领旧版结果

`POST /search-results/{result_id}/claim`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_id` | number | 生成或认领后的线索 ID |
| `lead_status` | string | 线索状态 |
| `owner_id` | number | 负责人 ID |
| `mobile` | string | 手机号 |

## 10. 线索接口

### 10.1 线索列表通用筛选

适用于 `GET /lead-pool` 和 `GET /my-leads`。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 关键词。也会作为 `poi_name` 兜底 |
| `poi_name` | string | 门店名称 |
| `poi_address` | string | 门店地址 |
| `sub_industry` | string | 细分行业 |
| `brand_name` | string | 品牌 |
| `store_count_min` | string | 门店数量下限 |
| `store_count_max` | string | 门店数量上限 |
| `contact_phone` | string | 联系电话 |
| `store_category` | string | 门店分类。仅线索公海使用 |
| `lead_status` | string | 线索状态 |
| `contact_status` | string | 联系状态 |
| `store_tag` | string | 门店标签 |
| `created_at_start` | string | 创建时间起 |
| `created_at_end` | string | 创建时间止 |
| `last_follow_up_start` | string | 最近跟进时间起 |
| `last_follow_up_end` | string | 最近跟进时间止 |
| `next_follow_up_start` | string | 下次跟进时间起 |
| `next_follow_up_end` | string | 下次跟进时间止 |
| `page` | number | 页码 |
| `page_size` | number | 每页条数 |

线索列表 `list[]` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_id` | number | 线索 ID |
| `owner_id` | number | 负责人 ID |
| `company_name` | string | 公司名 |
| `contact_name` | string | 联系人 |
| `mobile` | string | 手机号 |
| `address` | string | 地址 |
| `store_category` | string | 门店分类 |
| `store_tags` | string[] | 门店标签 |
| `poi_name` | string | 门店名称 |
| `store_thumbnail_url` | string | 门店缩略图 |
| `sub_industry` | string | 细分行业 |
| `brand_name` | string | 品牌 |
| `store_count` | number | 门店数量 |
| `business_pain_points` | string | 经营痛点 |
| `poi_address` | string | POI 地址 |
| `contact_phone` | string | 联系电话 |
| `poi_rating` | number | POI 评分 |
| `lead_status` | string | 线索状态 |
| `contact_status` | string | 联系状态 |
| `source` | string | 来源 |
| `recommendation_reason` | string | 推荐理由 |
| `score` | number | 分数 |
| `created_at` | string | 创建时间 |
| `last_follow_up_at` | string | 最近跟进时间 |
| `next_follow_up_at` | string | 下次跟进时间 |
| `last_follow_up_time` | string | 最近跟进时间兼容字段 |
| `next_follow_up_time` | string | 下次跟进时间兼容字段 |

### 10.2 线索公海列表

`GET /lead-pool`

返回结构：

```json
{
  "list": [],
  "pagination": {
    "page": 1,
    "page_size": 10,
    "total": 0
  }
}
```

### 10.3 手动创建公海线索

`POST /lead-pool`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `poi_name` | string | 是 | 门店名称 |
| `poi_address` | string | 否 | 门店地址 |
| `contact_phone` | string | 否 | 联系电话 |
| `sub_industry` | string | 否 | 细分行业 |
| `brand_name` | string | 否 | 品牌 |
| `store_count` | number | 否 | 门店数量 |
| `business_info` | string | 否 | 经营信息 |
| `business_pain_points` | string | 否 | 经营痛点 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_id` | number | 线索 ID |
| `owner_id` | number | 创建人 ID |
| `in_pool` | boolean | 是否在公海 |
| `source` | string | 来源 |
| `lead_status` | string | 线索状态 |
| `contact_status` | string | 联系状态 |
| `dedupe_key` | string | 去重键 |

### 10.4 线索公海详情

`GET /lead-pool/{lead_id}`

成功 `data` 为线索详情对象，结构同 10.7。

### 10.5 认领公海线索

`POST /lead-pool/{lead_id}/claim`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_id` | number | 线索 ID |
| `owner_id` | number | 当前用户 ID |
| `in_pool` | boolean | 固定为 `false` |

### 10.6 分配公海线索

`POST /lead-pool/{lead_id}/assign`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target_user_id` | number | 是 | 目标用户 ID |
| `reason` | string | 否 | 分配原因。为空时后端使用 `assign_from_pool` |

成功 `data` 同 10.5。

### 10.7 我的线索列表

`GET /my-leads`

筛选参数同 10.1，但只返回当前登录用户负责的线索。

### 10.8 我的线索详情

`GET /my-leads/{lead_id}`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_base` | object | 线索基础信息 |
| `store_card` | object | 门店卡片信息 |
| `company_info` | object | 公司信息 |
| `business_info` | object | 经营信息 |
| `supplement_info` | object | 补充信息 |
| `poi_info` | object | POI 信息 |
| `status_info` | object | 状态信息 |
| `contacts` | array | 联系人列表 |
| `follow_up_records` | array | 跟进记录 |
| `transfer_records` | array | 转移记录 |
| `history_flow_records` | array | 流转历史 |
| `supplement` | object | AI 补充信息 |
| `script` | object | AI 话术信息 |
| `ai_decision` | object | AI 决策信息 |

`lead_base` 主要字段：`lead_id`、`owner_id`、`company_name`、`contact_name`、`mobile`、`address`、`region_code`、`industry_code`、`store_category`、`store_tags`、`poi_name`、`store_thumbnail_url`、`sub_industry`、`brand_name`、`store_count`、`business_info_text`、`business_pain_points`、`poi_address`、`contact_phone`、`poi_rating`、`source`、`lead_status`、`contact_status`、`recommendation_reason`、`score`、`latest_follow_up_result`、`enrichment_status`、`lead_enrichment_status`、`lead_script_status`、`last_follow_up_time`、`next_follow_up_time`、`create_time`、`update_time`。

### 10.9 线索补充

`POST /leads/{lead_id}/enrichment`

创建异步任务，成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_id` | number | 线索 ID |
| `task_id` | number | 异步任务 ID |
| `task_status` | string | 初始任务状态，通常为 `pending` |

### 10.10 生成线索话术

`POST /leads/{lead_id}/script`

成功 `data` 同 10.9。

### 10.11 新增线索跟进

`POST /leads/{lead_id}/follow-ups`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `result_code` | string | 是 | 跟进结果，例如 `connected_success`、`connected_failed`、`empty_number` |
| `content` | string | 是 | 跟进内容 |

成功 `data` 同 10.9。后端会异步总结跟进；`empty_number` 会使线索回到公海。

### 10.12 线索转客户校验

`POST /leads/{lead_id}/convert-to-customer`

成功 `data` 同 10.9。当前接口发起 AI 校验异步任务，实际结果可通过 `/async-tasks/{id}` 查询。

### 10.13 转移线索

`POST /leads/{lead_id}/transfer-records`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target_user_id` | number | 是 | 目标用户 ID，必须与当前负责人不同 |
| `reason` | string | 是 | 转移原因 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lead_id` | number | 线索 ID |
| `owner_id` | number | 新负责人 ID |
| `task_status` | string | 固定为 `success` |
| `lead_status` | string | 线索状态 |
| `enrichment_status` | string | 补充状态 |
| `latest_follow_up_result` | string | 最近跟进结果 |
| `in_pool` | boolean | 是否在公海 |

## 11. 客户接口

### 11.1 客户列表通用筛选

适用于 `GET /customer-pool` 和 `GET /my-customers`。

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `keyword` | string | 关键词 |
| `company_name` | string | 公司名。优先级高于 `keyword` |
| `poi_name` | string | 门店名 |
| `poi_address` | string | 门店地址 |
| `sub_industry` | string | 细分行业 |
| `brand_name` | string | 品牌 |
| `store_count_min` | string | 门店数量下限 |
| `store_count_max` | string | 门店数量上限 |
| `contact_phone` | string | 联系电话 |
| `customer_status` | string | 客户状态 |
| `status` | string | 客户状态兼容参数 |
| `customer_stage` | string | 客户阶段 |
| `stage` | string | 客户阶段兼容参数 |
| `contact_status` | string | 联系状态 |
| `store_tag` | string | 门店标签 |
| `tag` | string | 门店标签兼容参数 |
| `created_at_start` | string | 创建时间起 |
| `created_at_end` | string | 创建时间止 |
| `last_follow_up_start` | string | 最近跟进时间起 |
| `last_follow_up_end` | string | 最近跟进时间止 |
| `next_follow_up_start` | string | 下次跟进时间起 |
| `next_follow_up_end` | string | 下次跟进时间止 |
| `page` | number | 页码 |
| `page_size` | number | 每页条数 |

客户列表 `list[]` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `customer_id` | number | 客户 ID |
| `owner_id` | number | 负责人 ID |
| `company_name` | string | 公司名 |
| `contact_name` | string | 联系人 |
| `mobile` | string | 手机号 |
| `address` | string | 地址 |
| `store_category` | string | 门店分类 |
| `customer_tags` | string[] | 客户标签 |
| `poi_name` | string | 门店名称 |
| `sub_industry` | string | 细分行业 |
| `brand_name` | string | 品牌 |
| `store_count` | number | 门店数量 |
| `business_pain_points` | string | 经营痛点 |
| `poi_address` | string | POI 地址 |
| `contact_phone` | string | 联系电话 |
| `poi_rating` | number | POI 评分 |
| `recommendation_reason` | string | 推荐理由 |
| `score` | number | 分数 |
| `customer_status` | string | 客户状态 |
| `customer_stage` | string | 客户阶段 |
| `contact_status` | string | 联系状态 |
| `source` | string | 来源 |
| `created_at` | string | 创建时间 |
| `latest_follow_up_time` | string | 最近跟进时间 |
| `next_follow_up_time` | string | 下次跟进时间 |

### 11.2 客户公海列表

`GET /customer-pool`

返回客户列表和分页。

### 11.3 客户公海详情

`GET /customer-pool/{customer_id}`

成功 `data` 为客户详情对象，结构同 11.6。

### 11.4 认领客户

`POST /customer-pool/{customer_id}/claim`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `customer_id` | number | 客户 ID |
| `owner_id` | number | 当前用户 ID |
| `in_pool` | boolean | 固定为 `false` |
| `status` | string | 固定为 `owned` |

### 11.5 我的客户列表

`GET /my-customers`

筛选参数同 11.1，但只返回当前登录用户负责的客户。

### 11.6 我的客户详情

`GET /my-customers/{customer_id}`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `customer_base` | object | 客户基础信息 |
| `store_card` | object | 门店卡片 |
| `company_info` | object | 公司信息 |
| `business_info` | object | 经营信息 |
| `supplement_info` | object | 补充信息 |
| `poi_info` | object | POI 信息 |
| `customer_status_info` | object | 客户状态信息 |
| `customer_pain_points` | string[] | 客户痛点 |
| `contacts` | array | 联系人列表 |
| `follow_up_records` | array | 跟进记录 |
| `transfer_records` | array | 转移记录 |
| `flow_records` | array | 流转记录 |
| `history_flow_records` | array | 历史流转记录 |
| `stage_change_records` | array | 阶段变更记录 |
| `follow_up_plans` | array | 跟进计划 |

`customer_base` 主要字段：`customer_id`、`owner_id`、`company_name`、`contact_name`、`mobile`、`address`、`region_code`、`industry_code`、`store_category`、`customer_tags`、`poi_name`、`sub_industry`、`brand_name`、`store_count`、`business_info_text`、`business_pain_points`、`poi_address`、`contact_phone`、`poi_rating`、`contact_status`、`source`、`recommendation_reason`、`score`、`customer_status`、`customer_stage`、`previsit_summary`、`latest_ai_summary`、`latest_stage_decision`、`latest_follow_up_time`、`next_follow_up_time`、`company_registration_number`、`company_registration_time`、`company_registered_capital`、`is_chain_store`、`offline_store_count`、`team_size`、`contact_mobile_region`、`contact_gender`、`create_time`、`update_time`。

### 11.7 创建客户跟进计划

`POST /customers/{customer_id}/follow-up-plans`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `plan_time` | string | 是 | 计划跟进时间 |
| `content` | string | 是 | 计划内容 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `customer_id` | number | 客户 ID |
| `task_id` | number | AI 预访总结异步任务 ID |
| `task_status` | string | 任务状态 |

### 11.8 创建客户跟进记录

`POST /customers/{customer_id}/follow-up-records`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `result_code` | string | 是 | 跟进结果 |
| `content` | string | 是 | 跟进内容 |

成功 `data` 同 11.7。

### 11.9 推进客户阶段

`POST /customers/{customer_id}/stage-transitions`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target_stage` | string | 是 | 目标阶段。当前支持 `L`、`D`、`C`、`B` |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `customer_id` | number | 客户 ID |
| `task_id` | number | 阶段推进 AI 校验任务 ID |
| `task_status` | string | 任务状态 |
| `customer_stage` | string | 当前或目标客户阶段 |

常见错误：`43004` 目标阶段非法或客户已有 AI 任务处理中。

### 11.10 转移客户

`POST /customers/{customer_id}/transfer-records`

请求体：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `target_user_id` | number | 是 | 目标用户 ID，必须与当前负责人不同 |
| `reason` | string | 是 | 转移原因 |

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `customer_id` | number | 客户 ID |
| `owner_id` | number | 新负责人 ID |
| `task_status` | string | 固定为 `success` |
| `customer_stage` | string | 客户阶段 |

## 12. 通知

### 12.1 通知列表

`GET /notifications`

成功 `data`：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `list` | array | 通知列表 |
| `unread_count` | number | 未读数量 |

`list[]` 字段：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `notification_id` | number | 通知 ID |
| `notification_type` | string | 通知类型 |
| `notification_target_user_id` | number | 目标用户 ID |
| `related_object_type` | string | 关联对象类型 |
| `related_object_id` | number | 关联对象 ID |
| `notification_content` | string | 通知内容 |
| `warning_triggered_at` | string | 预警触发时间 |
| `is_read` | boolean | 是否已读 |
| `created_at` | string | 创建时间 |

### 12.2 标记单条已读

`POST /notifications/{id}/read`

成功 `data` 为 `{}`。

### 12.3 标记全部已读

`POST /notifications/read-all`

成功 `data` 为 `{}`。

## 13. 对外依赖接口

以下不是 AIcrm 对前端暴露的 API，但会影响业务接口行为。

### 13.1 高德 POI 检索

由 `POST /source-search-runs` 间接触发。后端调用：

```http
GET https://restapi.amap.com/v3/place/text
```

关键入参来自：

- `key`：系统设置 `amap_api_key`
- `keywords`：`sub_industry` 字典说明中的 4 个搜索关键词
- `city` 或 `adcode`：`city_adcode` 字典编码

### 13.2 AI 中转站

痛点总结通过 OpenAI-compatible API 调用：

```http
POST <ai_gateway_base_url>/chat/completions
POST <ai_gateway_base_url>/embeddings
Authorization: Bearer <ai_gateway_api_key>
```

使用模型：

- `chat_model_name`：结构化痛点总结
- `embedding_model_name`：知识库向量检索

## 14. 维护要求

新增或修改后端路由时，需要同步更新本文档：

1. 更新接口总览。
2. 更新请求体、查询参数、响应 `data` 字段。
3. 标注公开接口和登录后接口。
4. 如果接口触发异步任务，必须说明返回的 `task_id` 和查询方式。
5. 如果接口依赖字典、系统设置或外部服务，必须说明对应 key。
6. 修改完成后用 `backend/internal/bootstrap/router.go` 的路由清单核对文档覆盖。
