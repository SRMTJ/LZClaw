#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSM Claw · 客户成功任务Agent  V2.1
======================================
Agent 名称：CSM_Daily_Task_Manager
职责：汇总健康分析和风险识别结果，生成 CSM 每日三类任务清单，写入 task_results.json。

三类任务：
  ① 风险客户     — 所有风险客户（[流失]高风险优先，[成长]中风险次之），优先处理流失客户
  ② 场景推进客户 — 场景数量 ≤1，优先推进经营场景落地
                   推进方向：会员体系 / 分销体系 / 储值体系
  ③ 续费任务     — 客户阶段=续费 或 到期时间≤60天（含已逾期30天内）
                   建议动作：续费沟通 / 确认续费意向 / 讨论增购机会

优先级规则（V2.1）：
  - 风险客户：流失客户置顶，高风险优先于中风险
  - 场景推进：双重预警客户（同时触发风险）置顶
  - 续费任务：低意向/断约客户置顶，再按紧迫程度升序
"""

import zipfile, re, json
from datetime import datetime, timedelta, date

TODAY          = datetime.combine(date.today(), datetime.min.time())
RENEW_WINDOW   = 60   # 即将续费窗口（天）
OVERDUE_WINDOW = 30   # 允许逾期追踪范围（天）
MAX_RISK       = 50   # 风险客户最大展示数
MAX_SCENE      = 30   # 场景推进最大展示数
MAX_RENEW      = 60   # 续费客户最大展示数

FNAME = '客户成功总表.xlsx'

# ── xlsx 工具函数 ─────────────────────────────────────────────────────────
def get_shared_strings(z):
    for p in ('xl/sharedStrings.xml', 'xl/SharedStrings.xml'):
        try:
            xml = z.read(p).decode('utf-8')
            return re.findall(r'<t[^>]*>(.*?)</t>', xml, re.DOTALL)
        except KeyError:
            pass
    return []

def get_sheet_path(z):
    rels = z.read('xl/_rels/workbook.xml.rels').decode()
    rid_map = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
        rid_map[m.group(1)] = m.group(2)
    wb = z.read('xl/workbook.xml').decode()
    for name, rid in re.findall(r'name="([^"]+)"[^>]+r:id="(rId\d+)"', wb):
        if '增鑫' in name and '总表' in name:
            path = rid_map.get(rid, '').lstrip('/')
            return path if path.startswith('xl/') else 'xl/' + path
    return None

def read_sheet(z, path, ss):
    xml = z.read(path).decode('utf-8')
    sd = re.search(r'<sheetData>(.*?)</sheetData>', xml, re.DOTALL)
    if not sd:
        return []
    rows_data = []
    for row_num, row_content in re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', sd.group(1), re.DOTALL):
        row_vals = {}
        for ref, attrs, content in re.findall(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', row_content, re.DOTALL):
            col = re.match(r'([A-Z]+)', ref).group(1)
            t_type = re.search(r'\bt="([^"]+)"', attrs)
            v_match = re.search(r'<v>(.*?)</v>', content)
            t_match = re.search(r'<t[^>]*>(.*?)</t>', content)
            if t_match:
                val = t_match.group(1)
            elif v_match:
                if t_type and t_type.group(1) == 's':
                    idx = int(v_match.group(1))
                    val = ss[idx] if idx < len(ss) else ''
                else:
                    val = v_match.group(1)
            else:
                val = ''
            row_vals[col] = val
        rows_data.append((int(row_num), row_vals))
    return rows_data

def excel_serial_to_dt(serial):
    try:
        s = float(serial)
        if 1000 < s < 100000:
            return datetime(1899, 12, 30) + timedelta(days=int(s))
    except (ValueError, TypeError, OverflowError):
        pass
    return None

def parse_date(s):
    if not s:
        return None
    s = str(s).strip()
    for fmt in ('%Y-%m-%d', '%Y/%m/%d', '%Y年%m月%d日', '%m/%d/%Y', '%Y.%m.%d'):
        try:
            return datetime.strptime(s, fmt)
        except Exception:
            pass
    return excel_serial_to_dt(s)

# ── 字段列定义 ────────────────────────────────────────────────────────────
COL_NAME          = 'B'
COL_CSM           = 'G'
COL_LABEL         = 'I'
COL_RENEW         = 'BD'
COL_RENEW_25      = 'CG'
COL_RENEW_STATUS  = 'BK'
COL_LAST_CONTACT  = 'AK'
COL_EXPIRE_LATEST = 'F'
COL_EXPIRE_26     = 'E'
COL_EXPIRE_25     = 'H'

# ── 读取数据 ──────────────────────────────────────────────────────────────
with zipfile.ZipFile(FNAME) as z:
    ss = get_shared_strings(z)
    path = get_sheet_path(z)
    rows = read_sheet(z, path, ss)

with open('risk_results.json', encoding='utf-8') as f:
    risk_list = json.load(f)
with open('health_results.json', encoding='utf-8') as f:
    health_list = json.load(f)

risk_names   = {r['name'] for r in risk_list}

# ── 任务① 风险客户（全量，流失客户置顶，高风险优先）──────────────────────────
def _risk_sort_key(r):
    # 流失客户最优先；高风险 > 中风险；再按风险条数降序；最后按最后联系时间升序
    is_lost = any('流失' in ri for ri in r.get('risks', []))
    is_high  = r.get('danger_level', '') == '高风险'
    return (0 if is_lost else 1, 0 if is_high else 1, -r['risk_count'], r['last_contact'])

top_risk = sorted(risk_list, key=_risk_sort_key)[:MAX_RISK]

# ── 任务② 场景推进客户 ────────────────────────────────────────────────────
# 场景数量 ≤1，标记是否也在风险列表
scene_push = []
for c in health_list:
    if c['scenes'] <= 1:
        double_warning = c['name'] in risk_names
        scene_push.append({
            'name':           c['name'],
            'csm':            c.get('csm', ''),
            'level':          c['level'],
            'label':          c['label'],
            'last_contact':   c['last_contact'],
            'score':          c['score'],
            'double_warning': double_warning,  # 同时是风险客户
        })
# 双重预警优先，再按分数降序
scene_push = sorted(scene_push, key=lambda x: (-int(x['double_warning']), -x['score']))[:MAX_SCENE]

# ── 任务③ 续费任务 ────────────────────────────────────────────────────────
# 触发条件：客户阶段=续费  OR  到期时间≤60天（含已逾期30天内）
# 建议动作：续费沟通 / 确认续费意向 / 讨论增购机会
renew_soon = []
CUTOFF = TODAY + timedelta(days=RENEW_WINDOW)
NO_RENEW_KWS = {'不续费', '断约', '不续', '放弃', '流失', '不打算续'}

# 需要字段：客户阶段列（COL_LIFECYCLE）
COL_LIFECYCLE = 'D'   # 根据总表实际列位自动从 risk_agent 同款扫描，此处先复用常见位

for row_num, row in rows[1:]:
    name = row.get(COL_NAME, '').strip()
    if not name:
        continue

    # 读取客户阶段
    lifecycle = row.get(COL_LIFECYCLE, '').strip()
    is_renew_stage = '续费' in lifecycle

    # 尝试三个到期时间字段
    expire = None
    for col in (COL_EXPIRE_LATEST, COL_EXPIRE_26, COL_EXPIRE_25):
        d = parse_date(row.get(col, ''))
        if d:
            expire = d
            break

    # 触发续费任务：阶段=续费 OR 到期时间在窗口内
    days_left = None
    in_expire_window = False
    if expire:
        days_left = (expire - TODAY).days
        in_expire_window = -OVERDUE_WINDOW <= days_left <= RENEW_WINDOW

    if not is_renew_stage and not in_expire_window:
        continue

    renew_intent  = (row.get(COL_RENEW, '') or row.get(COL_RENEW_25, '')).strip()
    renew_status  = row.get(COL_RENEW_STATUS, '').strip()
    csm           = row.get(COL_CSM, '').strip()
    label         = row.get(COL_LABEL, '').strip()
    last_c        = parse_date(row.get(COL_LAST_CONTACT, ''))
    lc_str        = last_c.strftime('%Y-%m-%d') if last_c else '无记录'

    # 紧迫程度（无到期时间则用阶段标记）
    if days_left is None:
        urgency     = '续费阶段'
        urgency_ord = 1
    elif days_left < 0:
        urgency     = '已逾期'
        urgency_ord = 0
    elif days_left <= 14:
        urgency     = '≤14天（紧急）'
        urgency_ord = 1
    elif days_left <= 30:
        urgency     = '≤30天（急迫）'
        urgency_ord = 2
    else:
        urgency     = f'{days_left}天后到期'
        urgency_ord = 3

    # 低意向标记
    combined = renew_intent + renew_status
    low_intent = any(kw in combined for kw in NO_RENEW_KWS)

    renew_soon.append({
        'name':           name,
        'csm':            csm,
        'expire_date':    expire.strftime('%Y-%m-%d') if expire else '未知',
        'days_left':      days_left if days_left is not None else 9999,
        'urgency':        urgency,
        'urgency_ord':    urgency_ord,
        'renew_intent':   renew_intent,
        'renew_status':   renew_status,
        'label':          label,
        'last_contact':   lc_str,
        'low_intent':     low_intent,
        'is_renew_stage': is_renew_stage,
    })

# 排序：低意向优先，再按紧迫程度
renew_soon = sorted(renew_soon, key=lambda x: (-int(x['low_intent']), x['urgency_ord'], x['days_left']))[:MAX_RENEW]

# ── 保存结果 ──────────────────────────────────────────────────────────────
task_data = {
    'date':         TODAY.strftime('%Y-%m-%d'),
    'agent':        'CSM_Daily_Task_Manager V2.1',
    'risk_clients': top_risk,
    'scene_push':   scene_push,
    'renew_soon':   renew_soon,
    'summary': {
        'risk_total':        len(top_risk),
        'risk_high':         sum(1 for r in top_risk if r.get('danger_level') == '高风险'),
        'risk_mid':          sum(1 for r in top_risk if r.get('danger_level') == '中风险'),
        'scene_push_total':  len(scene_push),
        'renew_total':       len(renew_soon),
        'renew_overdue':     sum(1 for r in renew_soon if (r['days_left'] or 9999) < 0),
        'renew_14d':         sum(1 for r in renew_soon if 0 <= (r['days_left'] or 9999) <= 14),
        'double_warning':    sum(1 for c in scene_push if c['double_warning']),
        'low_intent_renew':  sum(1 for r in renew_soon if r['low_intent']),
        'renew_stage_only':  sum(1 for r in renew_soon if r.get('is_renew_stage') and (r['days_left'] or 9999) == 9999),
    }
}
output_path = 'task_results.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(task_data, f, ensure_ascii=False, indent=2)

s = task_data['summary']
print(f"\n[完成]  客户成功任务Agent [CSM_Daily_Task_Manager V2.1]  {TODAY.date()}")
print(f"   ① 风险客户（全量）: {s['risk_total']} 家  （[流失]高风险 {s['risk_high']} / [成长]中风险 {s['risk_mid']}）")
print(f"   ② 场景推进客户   : {s['scene_push_total']} 家（双重预警：{s['double_warning']} 家）")
print(f"   ③ 续费任务       : {s['renew_total']} 家")
print(f"      ├─ 已逾期             : {s['renew_overdue']} 家")
print(f"      ├─ 14天内到期         : {s['renew_14d']} 家")
print(f"      ├─ 续费阶段（无到期）  : {s['renew_stage_only']} 家")
print(f"      └─ 低意向/断约        : {s['low_intent_renew']} 家")
