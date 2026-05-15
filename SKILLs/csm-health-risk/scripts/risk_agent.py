#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSM Claw · 风险客户识别Agent  V2.1
======================================
Agent 名称：CSM_Risk_Detector
中文名称：风险客户识别Agent
职责：从客户成功总表中识别所有存在风险信号的客户，输出风险原因与建议动作。

风险识别维度（共 7 项）：
  R1 · 沟通停滞      — 60 天及以上未沟通，或无任何沟通记录
  R2 · 零场景绑定    — 场景数量为 0（深度绑定缺失）
  R3 · 经营困难      — 经营困难/倒闭/歇业/停业
  R4 · 风险标签      — 标签含流失/高风险/预警/断约/跑路
  R5 · 不续费意向    — 续费字段含不续/断约/流失/放弃
  R6 · 低健康叠加    — 健康分 < 40 且同时触发多项风险（流失客户复核）
  R7 · 续费期不确定  — 客户阶段 = 续费 且续费意向 = 不确定

风险等级（按触发项数）：
  [流失] 高风险  满足 2 条及以上
  [成长] 中风险  满足 1 条

输出结构（每客户）：
  客户名称 / 风险等级 / 风险原因 / 当前阶段 / 建议动作
  建议动作三类：联系客户 / 运营诊断 / 推进经营场景
"""

import zipfile, re, json
from datetime import datetime, date, timedelta

# ── 运行日期（自动取当天）─────────────────────────────────────────────────
TODAY = date.today()

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

def get_sheet_names(z):
    rels = z.read('xl/_rels/workbook.xml.rels').decode()
    rid_map = {}
    for m in re.finditer(r'Id="(rId\d+)"[^>]*Target="([^"]+)"', rels):
        rid_map[m.group(1)] = m.group(2)
    wb = z.read('xl/workbook.xml').decode()
    entries = re.findall(r'name="([^"]+)"[^>]+r:id="(rId\d+)"', wb)
    result = {}
    for name, rid in entries:
        path = rid_map.get(rid, '').lstrip('/')
        if not path.startswith('xl/'):
            path = 'xl/' + path
        result[name] = path
    return result

def read_sheet(z, path, ss):
    xml = z.read(path).decode('utf-8')
    sd = re.search(r'<sheetData>(.*?)</sheetData>', xml, re.DOTALL)
    if not sd:
        return []
    rows_data = []
    rows = re.findall(r'<row r="(\d+)"[^>]*>(.*?)</row>', sd.group(1), re.DOTALL)
    for row_num, row_content in rows:
        cells = re.findall(r'<c r="([A-Z]+\d+)"([^>]*)>(.*?)</c>', row_content, re.DOTALL)
        row_vals = {}
        for ref, attrs, content in cells:
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

def excel_date(serial):
    try:
        n = int(float(serial))
        if n <= 0:
            return None
        if n > 60:
            n -= 1
        return date(1899, 12, 31) + timedelta(days=n)
    except Exception:
        return None

def parse_date(s):
    if not s:
        return None
    s = str(s).strip()
    for fmt in ('%Y-%m-%d', '%Y/%m/%d', '%Y年%m月%d日', '%m/%d/%Y', '%Y.%m.%d'):
        try:
            return datetime.strptime(s, fmt).date()
        except Exception:
            pass
    return excel_date(s)

def count_scenarios(s):
    if not s or str(s).strip() == '':
        return 0
    parts = re.split(r'[,，、\n/]', str(s).strip())
    return len([p for p in parts if p.strip()])

# ── 字段列定义 ────────────────────────────────────────────────────────────
COL_NAME          = 'B'
COL_LIFECYCLE     = 'C'
COL_CSM           = 'G'
COL_INDUSTRY      = 'Q'
COL_LABEL         = 'N'
COL_SCENARIO      = 'P'
COL_LAST_CONTACT  = 'DU'
COL_RENEW         = 'BD'
COL_RENEW_25      = 'CG'
COL_RENEW_STATUS  = 'BK'

# ── 主程序 ────────────────────────────────────────────────────────────────
with zipfile.ZipFile(FNAME) as z:
    ss = get_shared_strings(z)
    sheets = get_sheet_names(z)
    rows = read_sheet(z, sheets['⭐增鑫客成-总表'], ss)

# 尝试读取健康度数据（用于 R6 流失复核）
health_score_map = {}
try:
    health_path = 'health_results.json'
    if os.path.exists(health_path):
        with open(health_path, encoding='utf-8') as f:
            health_list = json.load(f)
        health_score_map = {c['name']: c['score'] for c in health_list}
    # 回退到原始路径
    elif os.path.exists('health_results.json'):
        with open('health_results.json', encoding='utf-8') as f:
            health_list = json.load(f)
        health_score_map = {c['name']: c['score'] for c in health_list}
except Exception:
    pass

RISK_CUSTOMERS = []

for rn, rv in rows[1:]:
    name = rv.get(COL_NAME, '').strip()
    if not name or name in ['店铺名称', '']:
        continue
    if any(kw in name for kw in ['填写', '必填', '文本']):
        continue

    lifecycle   = rv.get(COL_LIFECYCLE, '').strip()
    label_n     = rv.get(COL_LABEL, '').strip()
    scenario_str = rv.get(COL_SCENARIO, '').strip()
    last_contact_raw = rv.get(COL_LAST_CONTACT, '').strip()
    renew_intent = rv.get(COL_RENEW, '').strip()
    renew_intent_25 = rv.get(COL_RENEW_25, '').strip()
    renew_status = rv.get(COL_RENEW_STATUS, '').strip()
    csm_owner   = rv.get(COL_CSM, '').strip()
    industry    = rv.get(COL_INDUSTRY, '').strip()

    risks   = []
    actions = []

    # R1 · 沟通停滞
    last_contact = parse_date(last_contact_raw)
    if last_contact:
        days_gap = (TODAY - last_contact).days
        if days_gap >= 60:
            risks.append(f'R1 · 沟通停滞：{days_gap}天未联系（最后：{last_contact}）')
            actions.append('立即电话/企微触达，了解近况及续费意向')
    else:
        risks.append('R1 · 沟通停滞：无任何沟通记录')
        actions.append('优先电话冷启动，加企微好友建立联系')

    # R2 · 零场景绑定
    n_scenes = count_scenarios(scenario_str)
    if n_scenes == 0:
        risks.append('R2 · 零场景绑定：无任何经营场景')
        actions.append('诊断现有使用情况，推荐1个核心场景落地（会员/外卖/预约等）')

    # R3 · 经营困难
    bad_ops = ['困难', '经营困难', '倒闭', '歇业', '停业', '已关闭']
    if any(kw in lifecycle for kw in bad_ops):
        risks.append(f'R3 · 经营困难：{lifecycle[:40]}')
        actions.append('了解困难原因，提供降本增效方案或协助申请账期/退费')

    # R4 · 风险标签
    risk_kws = ['流失', '风险', '高风险', '预警', '断约', '跑路']
    matched_kw = [kw for kw in risk_kws if kw in label_n]
    if matched_kw:
        risks.append(f'R4 · 风险标签：【{label_n}】')
        actions.append('升级关注：安排负责人面访或主管介入处理')

    # R5 · 不续费意向
    no_renew_kws = ['不续费', '断约', '不续', '放弃', '流失', '不打算续']
    renew_combined = renew_intent + renew_intent_25 + renew_status
    matched_renew = [kw for kw in no_renew_kws if kw in renew_combined]
    if matched_renew or renew_status in ('断约', '已断约'):
        intent_str = '/'.join(filter(None, [renew_intent, renew_intent_25, renew_status]))
        risks.append(f'R5 · 不续费意向：{intent_str}')
        actions.append('启动挽回：明确断约原因 → 提挽留方案 → 上报主管')

    # R6 · 低健康叠加复核（流失客户且健康分 < 40）
    hs = health_score_map.get(name)
    if hs is not None and hs < 40 and len(risks) >= 2:
        risks.append(f'R6 · 流失客户复核：健康分仅{hs}分，需紧急干预')
        actions.append('主管牵头启动挽留专项，本周内上门拜访')

    # R7 · 续费期不确定（客户阶段 = 续费 且续费意向 = 不确定）
    renew_uncertain_kws = ['不确定', '考虑中', '待定', '未确定', '还没想好']
    is_renew_stage = '续费' in lifecycle
    is_uncertain   = any(kw in renew_combined for kw in renew_uncertain_kws)
    if is_renew_stage and is_uncertain:
        risks.append(f'R7 · 续费期不确定：当前阶段={lifecycle[:20]}，续费意向={renew_intent or renew_intent_25 or renew_status}')
        actions.append('确认续费意向，明确拒绝原因或推进方案确认')

    if risks:
        # 风险等级：满足 1 条 → 中风险；满足 2 条及以上 → 高风险
        danger_level = '高风险' if len(risks) >= 2 else '中风险'
        RISK_CUSTOMERS.append({
            'name':       name,
            'csm':        csm_owner,
            'industry':   industry,
            'risks':      risks,
            'actions':    actions,
            'risk_count': len(risks),
            'danger_level': danger_level,
            'last_contact': str(last_contact) if last_contact else '无记录',
            'scenes':     n_scenes,
            'label':      label_n,
            'lifecycle':  lifecycle[:40] if lifecycle else '',
            'renew':      renew_intent or renew_intent_25 or renew_status,
        })

# 排序：先按risk_count降序，再按最后联系时间升序（越久没联系越靠前）
RISK_CUSTOMERS.sort(key=lambda x: (-x['risk_count'], x['last_contact']))

# ── 统计 ──────────────────────────────────────────────────────────────────
total_risk = len(RISK_CUSTOMERS)
high_risk  = [c for c in RISK_CUSTOMERS if c['danger_level'] == '高风险']
mid_risk   = [c for c in RISK_CUSTOMERS if c['danger_level'] == '中风险']
no_contact = [c for c in RISK_CUSTOMERS if any('R1' in r for r in c['risks'])]
no_scene   = [c for c in RISK_CUSTOMERS if any('R2' in r for r in c['risks'])]
hard_op    = [c for c in RISK_CUSTOMERS if any('R3' in r for r in c['risks'])]
risk_label = [c for c in RISK_CUSTOMERS if any('R4' in r for r in c['risks'])]
no_renew   = [c for c in RISK_CUSTOMERS if any('R5' in r for r in c['risks'])]
r7_list    = [c for c in RISK_CUSTOMERS if any('R7' in r for r in c['risks'])]

print(f"\n{'='*65}")
print(f"  CSM Claw 风险客户报告  [CSM_Risk_Detector V2.1]  {TODAY}")
print(f"{'='*65}")
print(f"  风险客户数量：{total_risk} 家")
print(f"  ├─ [流失] 高风险（2条及以上）：{len(high_risk)} 家")
print(f"  ├─ [成长] 中风险（1条）      ：{len(mid_risk)} 家")
print(f"  ├─ R1 沟通停滞           ：{len(no_contact)} 家")
print(f"  ├─ R2 零场景绑定         ：{len(no_scene)} 家")
print(f"  ├─ R3 经营困难           ：{len(hard_op)} 家")
print(f"  ├─ R4 风险标签           ：{len(risk_label)} 家")
print(f"  ├─ R5 不续费意向         ：{len(no_renew)} 家")
print(f"  └─ R7 续费期不确定       ：{len(r7_list)} 家")
print(f"{'='*65}\n")

# ── 高风险客户（2条及以上）──────────────────────────────────────────────────
print("【[流失] 高风险客户（满足 2 条及以上风险条件）】\n")
for c in high_risk:
    print(f"  客户名称：{c['name']}  （CSM：{c['csm'] or '未分配'}）")
    print(f"  风险等级：[流失] 高风险（命中 {c['risk_count']} 项）")
    print(f"  风险原因：")
    for r in c['risks']:
        print(f"    * {r}")
    print(f"  当前阶段：{c['lifecycle'] or '未知'}")
    # 建议动作按三类归类输出
    actions_contact  = [a for a in c['actions'] if any(k in a for k in ['电话', '企微', '触达', '联系', '冷启动', '拜访'])]
    actions_ops      = [a for a in c['actions'] if any(k in a for k in ['诊断', '困难', '账期', '退费', '挽留', '挽回', '续费', '意向', '断约', '升级关注', '主管'])]
    actions_scene    = [a for a in c['actions'] if any(k in a for k in ['场景', '外卖', '预约', '会员', '核心'])]
    actions_other    = [a for a in c['actions'] if a not in actions_contact + actions_ops + actions_scene]
    print(f"  建议动作：")
    if actions_contact:
        print(f"    [联系] 联系客户：{' / '.join(actions_contact)}")
    if actions_ops:
        print(f"    [分析] 运营诊断：{' / '.join(actions_ops)}")
    if actions_scene:
        print(f"    [推进] 推进经营场景：{' / '.join(actions_scene)}")
    if actions_other:
        for a in actions_other:
            print(f"    → {a}")
    print()

# ── 中风险客户（1条，节选前50）──────────────────────────────────────────────
if mid_risk:
    print(f"\n【[成长] 中风险客户（满足 1 条风险条件，共 {len(mid_risk)} 家）— 节选前 50 家】\n")
    for c in mid_risk[:50]:
        print(f"  客户名称：{c['name']}  （CSM：{c['csm'] or '未分配'}）")
        print(f"  风险等级：[成长] 中风险")
        print(f"  风险原因：{'  |  '.join(c['risks'])}")
        print(f"  当前阶段：{c['lifecycle'] or '未知'}")
        print(f"  建议动作：{' / '.join(c['actions'])}")
        print()

# 保存 JSON
output_path = 'risk_results.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(RISK_CUSTOMERS, f, ensure_ascii=False, indent=2)
print(f"[完成] 完整数据已保存至 {output_path}（共{total_risk}条）")
