#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSM Claw · 客户健康分析Agent  V2
===================================
Agent 名称：CSM_Health_Analyzer
职责：读取客户成功总表，对每个客户进行健康度评分，输出四级分层（健康/成长/风险/流失）。

评分规则（满分 100）：
  ① 沟通时间间隔  最高扣 40 分
      - 无沟通记录      -40
      - 60 天及以上未沟通  -40
      - 30–59 天未沟通    -20
      - 15–29 天未沟通    -10
  ② 场景绑定数量  最高扣 30 分
      - 0 个场景         -30
      - 1 个场景         -10
  ③ 经营状态      最高扣 30 分
      - 经营困难/倒闭/歇业  -30
      - 需要帮助/经营一般   -15
  ④ 风险标签      最高扣 20 分
      - 流失/高风险/预警/断约等  -20
  ⑤ 续费意向低落  最高扣 10 分
      - 不续费/断约/流失意向    -10

健康等级：
  [健康] 健康客户 80–100
  [成长] 成长客户 60–79
  [风险] 风险客户 40–59
  [流失] 流失客户  0–39
"""

import zipfile, re, json
from datetime import datetime, date, timedelta

# ── 运行日期（每次运行自动取当天）────────────────────────────────────────
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
    """Excel 日期序列号 → date"""
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
    """多格式日期字符串解析"""
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
    """统计场景数量"""
    if not s or str(s).strip() == '':
        return 0
    parts = re.split(r'[,，、\n/]', str(s).strip())
    return len([p for p in parts if p.strip()])

# ── 核心评分函数 ──────────────────────────────────────────────────────────
def calc_health(name, lifecycle, last_contact_raw, label, scenario_str,
                renew_intent='', renew_intent_25='', renew_status='',
                csm='', industry=''):
    score = 100
    deductions = []

    # ① 沟通时间间隔
    last_contact = parse_date(last_contact_raw)
    if last_contact:
        days = (TODAY - last_contact).days
        if days >= 60:
            score -= 40
            deductions.append(f'60天以上未沟通（已{days}天）-40')
        elif days >= 30:
            score -= 20
            deductions.append(f'30天以上未沟通（已{days}天）-20')
        elif days >= 15:
            score -= 10
            deductions.append(f'15天以上未沟通（已{days}天）-10')
    else:
        score -= 40
        deductions.append('无沟通记录 -40')

    # ② 场景绑定数量
    n_scenes = count_scenarios(scenario_str)
    if n_scenes == 0:
        score -= 30
        deductions.append('0个经营场景 -30')
    elif n_scenes == 1:
        score -= 10
        deductions.append('仅1个经营场景 -10')

    # ③ 经营状态
    lc = (lifecycle or '').strip()
    bad_ops = ['困难', '经营困难', '倒闭', '歇业', '停业', '已关闭']
    mid_ops = ['需要帮助', '帮助', '经营一般', '一般']
    if any(kw in lc for kw in bad_ops):
        score -= 30
        deductions.append(f'经营困难/停业 -30')
    elif any(kw in lc for kw in mid_ops):
        score -= 15
        deductions.append(f'经营需要帮助 -15')

    # ④ 风险标签
    lbl = (label or '').strip()
    risk_kws = ['流失', '风险', '高风险', '流失风险', '预警', '断约风险', '跑路']
    if any(kw in lbl for kw in risk_kws):
        score -= 20
        deductions.append(f'存在风险标签：{lbl} -20')

    # ⑤ 续费意向低落（新增）
    no_renew_kws = ['不续费', '断约', '不续', '放弃', '流失', '不打算续']
    renew_combined = (renew_intent or '') + (renew_intent_25 or '') + (renew_status or '')
    if any(kw in renew_combined for kw in no_renew_kws):
        score -= 10
        deductions.append('续费意向：不续费/断约 -10')

    score = max(0, score)

    if score >= 80:
        level, emoji = '健康客户', '[健康]'
    elif score >= 60:
        level, emoji = '成长客户', '[成长]'
    elif score >= 40:
        level, emoji = '风险客户', '[风险]'
    else:
        level, emoji = '流失客户', '[流失]'

    return {
        'name': name,
        'csm': csm,
        'industry': industry,
        'score': score,
        'level': level,
        'emoji': emoji,
        'deductions': deductions,
        'lifecycle': lc,
        'label': lbl,
        'scenes': n_scenes,
        'last_contact': str(last_contact) if last_contact else '无记录',
        'renew_intent': renew_intent or renew_intent_25 or renew_status,
    }

# ── 主程序 ────────────────────────────────────────────────────────────────
with zipfile.ZipFile(FNAME) as z:
    ss = get_shared_strings(z)
    sheets = get_sheet_names(z)
    rows = read_sheet(z, sheets['⭐增鑫客成-总表'], ss)

# 字段列（根据实际表头，可在此调整）
COL_NAME          = 'B'   # 店铺名称
COL_LIFECYCLE     = 'C'   # 生命周期盘点情况
COL_CSM           = 'G'   # CSM负责人
COL_INDUSTRY      = 'Q'   # 行业（如有）
COL_LABEL         = 'N'   # 盘点后客户标签
COL_SCENARIO      = 'P'   # 客户购买场景
COL_LAST_CONTACT  = 'DU'  # 最近跟进时间
COL_RENEW         = 'BD'  # 预估续费意向
COL_RENEW_25      = 'CG'  # 25年续费意向
COL_RENEW_STATUS  = 'BK'  # 续费状态

results = []
skipped = 0

for rn, rv in rows[1:]:
    name = rv.get(COL_NAME, '').strip()
    if not name or name in ['店铺名称', '']:
        skipped += 1
        continue
    if any(kw in name for kw in ['填写', '必填', '文本']):
        skipped += 1
        continue

    r = calc_health(
        name        = name,
        lifecycle   = rv.get(COL_LIFECYCLE, ''),
        last_contact_raw = rv.get(COL_LAST_CONTACT, ''),
        label       = rv.get(COL_LABEL, ''),
        scenario_str = rv.get(COL_SCENARIO, ''),
        renew_intent = rv.get(COL_RENEW, ''),
        renew_intent_25 = rv.get(COL_RENEW_25, ''),
        renew_status = rv.get(COL_RENEW_STATUS, ''),
        csm         = rv.get(COL_CSM, '').strip(),
        industry    = rv.get(COL_INDUSTRY, '').strip(),
    )
    results.append(r)

# 统计
total   = len(results)
healthy = [r for r in results if r['level'] == '健康客户']
growing = [r for r in results if r['level'] == '成长客户']
risk    = [r for r in results if r['level'] == '风险客户']
churn   = [r for r in results if r['level'] == '流失客户']

print(f"\n{'='*65}")
print(f"  客户健康分析Agent  [CSM_Health_Analyzer V2]  {TODAY}")
print(f"{'='*65}")
print(f"  分析客户总数：{total}（跳过空行：{skipped}）")
print(f"  [健康] 健康客户（80-100）：{len(healthy)} 家  {len(healthy)/total*100:.1f}%")
print(f"  [成长] 成长客户（60-79） ：{len(growing)} 家  {len(growing)/total*100:.1f}%")
print(f"  [风险] 风险客户（40-59） ：{len(risk)} 家  {len(risk)/total*100:.1f}%")
print(f"  [流失] 流失客户（0-39）  ：{len(churn)} 家  {len(churn)/total*100:.1f}%")
print(f"{'='*65}")

results_sorted = sorted(results, key=lambda x: x['score'], reverse=True)

for level_name, group in [
    ('健康客户（80-100分）', healthy),
    ('成长客户（60-79分）', growing),
    ('风险客户（40-59分）', risk),
    ('流失客户（0-39分）', churn),
]:
    g = sorted(group, key=lambda x: x['score'], reverse=True)
    print(f"\n【{level_name}】")
    for r in g:
        ded = ' | '.join(r['deductions']) if r['deductions'] else '无扣分'
        csm_tag = f"  [{r['csm']}]" if r['csm'] else ''
        print(f"  {r['emoji']} {r['name']}{csm_tag}  {r['score']}分  {ded}")

output_path = 'health_results.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(results_sorted, f, ensure_ascii=False, indent=2)
print(f"\n[完成] 详细数据已保存至 {output_path}（共{total}条）")
