#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""明日任务布置 - 销售总控Agent"""
import pandas as pd
import warnings
import datetime

warnings.filterwarnings('ignore')
xl = pd.ExcelFile('销售管理系统 .xlsx')
SALES = ['肖芳', '张浩', '李志远', '刘欣萌', '齐健彪', '范鑫']
today = datetime.date(2026, 3, 16)
tomorrow = datetime.date(2026, 3, 17)

# ── 读各阶段数据 ────────────────────────────────────────────
def read_sheet(sheet_name):
    try:
        df = xl.parse(sheet_name)
        return df
    except Exception:
        return pd.DataFrame()

def clean(val):
    s = str(val)
    if s in ('nan', 'NaT', 'None', '多行文本', '必填', ''):
        return ''
    return s.strip()

results = {}
for name in SALES:
    info = {'L': [], 'D': [], 'C': [], 'B': []}

    # ── L 阶段 ──────────────────────────────────────────────
    df = read_sheet(f'{name}L')
    if not df.empty and '客户名称★' in df.columns:
        df = df[df['客户名称★'].notna()]
        df = df[~df['客户名称★'].astype(str).str.contains('多行文本|必填|文本', na=False)]
        for _, row in df.iterrows():
            cname = clean(row.get('客户名称★', ''))
            touch = clean(row.get('触达结果★', ''))
            industry = clean(row.get('主营行业★', ''))
            phone = clean(row.get('联系电话★', ''))
            src = clean(row.get('线索来源★', ''))
            touch_date = row.get('触达日期★', None)
            if cname:
                info['L'].append({
                    '名称': cname, '触达结果': touch,
                    '行业': industry, '电话': phone,
                    '来源': src, '触达日期': touch_date
                })

    # ── D 阶段 ──────────────────────────────────────────────
    df = read_sheet(f'{name}D')
    if not df.empty and '客户名称' in df.columns:
        df = df[df['客户名称'].notna()]
        df = df[~df['客户名称'].astype(str).str.contains('多行文本|必填', na=False)]
        for _, row in df.iterrows():
            cname = clean(row.get('客户名称', ''))
            kp = clean(row.get('KP姓名', ''))
            phone = clean(row.get('KP联系方式', ''))
            action = clean(row.get('短期动作建议★', ''))
            risk = clean(row.get('转化风险★', ''))
            wechat = clean(row.get('是否已加微信', ''))
            pain = clean(row.get('核心痛点★', ''))
            if cname:
                info['D'].append({
                    '名称': cname, 'KP': kp, '电话': phone,
                    '建议': action, '风险': risk,
                    '微信': wechat, '痛点': pain
                })

    # ── C 阶段 ──────────────────────────────────────────────
    df = read_sheet(f'{name}C')
    if not df.empty and '客户名称' in df.columns:
        df = df[df['客户名称'].notna()]
        df = df[~df['客户名称'].astype(str).str.contains('多行文本|必填', na=False)]
        for _, row in df.iterrows():
            cname = clean(row.get('客户名称', ''))
            kp = clean(row.get('KP 姓名★', ''))
            phone = clean(row.get('KP 联系方式★', ''))
            task = clean(row.get('专属任务★', ''))
            stay = row.get('阶段停留天数', 0)
            next_date = row.get('下次跟进日期★', None)
            is_b = clean(row.get('是否推进到 B★', ''))
            layer = clean(row.get('客户分层★', ''))
            objection = clean(row.get('异议处理', ''))
            if cname:
                info['C'].append({
                    '名称': cname, 'KP': kp, '电话': phone,
                    '任务': task, '停留天数': stay,
                    '下次跟进': next_date, '是否推进B': is_b,
                    '分层': layer, '异议': objection
                })

    # ── B 阶段 ──────────────────────────────────────────────
    df = read_sheet(f'{name}B')
    if not df.empty and '客户名称' in df.columns:
        df = df[df['客户名称'].notna()]
        df = df[~df['客户名称'].astype(str).str.contains('多行文本|必填', na=False)]
        for _, row in df.iterrows():
            cname = clean(row.get('客户名称', ''))
            kp = clean(row.get('KP 姓名★', ''))
            phone = clean(row.get('KP 联系方式★', ''))
            task = clean(row.get('专属任务★', ''))
            ver = clean(row.get('是否确认产品版本', ''))
            fee = clean(row.get('是否确认费用', ''))
            is_a = clean(row.get('是否推进到 A★', ''))
            stay = row.get('阶段停留天数', 0)
            objection = clean(row.get('异议处理', ''))
            layer = clean(row.get('客户分层★', ''))
            if cname:
                info['B'].append({
                    '名称': cname, 'KP': kp, '电话': phone,
                    '任务': task, '版本': ver, '费用': fee,
                    '成交': is_a, '停留天数': stay,
                    '异议': objection, '分层': layer
                })

    results[name] = info


# ═══════════════════════════════════════════════════════════
# 生成任务清单
# ═══════════════════════════════════════════════════════════
print('=' * 70)
print('  销售总控Agent · 明日任务布置（2026-03-17）')
print('=' * 70)

for name in SALES:
    info = results[name]
    B = info['B']
    C = info['C']
    D = info['D']
    L = info['L']

    print(f'\n{"─"*70}')
    print(f'  [客户] {name}  |  B:{len(B)}  C:{len(C)}  D:{len(D)}  L:{len(L)}')
    print(f'{"─"*70}')

    task_num = 0

    # ── 任务1：B阶段成交冲刺（最高优先级）──────────────────
    if B:
        for b in B:
            task_num += 1
            ver_ok = '[完成]' if b['版本'] in ('是', '已确认', '✓') else '[错误]'
            fee_ok = '[完成]' if b['费用'] in ('是', '已确认', '✓') else '[错误]'
            print(f'  [流失] 任务{task_num}【成交冲刺 · 最高优先级】')
            print(f'     客户：{b["名称"]}  |  联系人：{b["KP"] or "待确认"}  |  [联系] {b["电话"] or "无"}')
            print(f'     分层：{b["分层"] or "/"} | 停留：{b["停留天数"]}天')
            print(f'     产品版本确认：{ver_ok}  费用确认：{fee_ok}  已成交：{b["成交"] or "否"}')
            if b['任务']:
                print(f'     专属任务：{b["任务"][:80]}')
            if b['异议']:
                print(f'     待处理异议：{b["异议"][:60]}')
            # 推进建议
            if b['版本'] not in ('是', '已确认') or b['费用'] not in ('是', '已确认'):
                print(f'     ⚡ 明日动作：先电话确认版本和费用，再约时间签合同 / 付款')
            else:
                print(f'     ⚡ 明日动作：约定签约/付款具体时间，今明必须完成成交')

    # ── 任务2：C阶段推进（明确需求→推B）─────────────────────
    c_urgent = []
    c_normal = []
    for c in C:
        next_d = c['下次跟进']
        try:
            nd = pd.to_datetime(next_d).date()
            if nd <= tomorrow:
                c_urgent.append(c)
            else:
                c_normal.append(c)
        except Exception:
            c_normal.append(c)

    for c in c_urgent:
        task_num += 1
        stay = c['停留天数']
        flag = '[流失]' if (isinstance(stay, (int, float)) and stay > 10) else '[成长]'
        print(f'  {flag} 任务{task_num}【C阶段跟进 · 今明到期】')
        print(f'     客户：{c["名称"]}  |  联系人：{c["KP"] or "待确认"}  |  [联系] {c["电话"] or "无"}')
        print(f'     分层：{c["分层"] or "/"} | 停留：{stay}天 | 是否推进B：{c["是否推进B"] or "未确认"}')
        if c['任务']:
            print(f'     专属任务：{c["任务"][:80]}')
        if c['异议']:
            print(f'     已知异议：{c["异议"][:60]}')
        if isinstance(stay, (int, float)) and stay > 10:
            print(f'     ⚡ 明日动作：主管评估是否暂停投入 / 降级，停留已过10天')
        else:
            print(f'     ⚡ 明日动作：电话或见面推进需求确认，目标本周推入B阶段')

    if c_normal:
        task_num += 1
        print(f'  [健康] 任务{task_num}【C阶段维护 · 共{len(c_normal)}个，暂无截止】')
        for c in c_normal[:3]:
            print(f'     · {c["名称"]}（停留{c["停留天数"]}天）{" | 任务：" + c["任务"][:30] if c["任务"] else ""}')
        if len(c_normal) > 3:
            print(f'     · ……还有{len(c_normal)-3}个（按停留天数排序）')
        print(f'     ⚡ 明日动作：优先联系停留天数最长的，推进或降级')

    # ── 任务3：D阶段邀约见面 ──────────────────────────────────
    d_no_action = [d for d in D if not d['建议'] or d['建议'] == '/']
    d_with_action = [d for d in D if d['建议'] and d['建议'] != '/']

    if d_with_action:
        task_num += 1
        print(f'  [成长] 任务{task_num}【D阶段跟进 · 有明确建议 · 共{len(d_with_action)}个】')
        for d in d_with_action[:4]:
            print(f'     · {d["名称"]}  {d["KP"] or ""}  [联系] {d["电话"] or "无"}')
            print(f'       建议：{d["建议"][:50]}')
        if len(d_with_action) > 4:
            print(f'     · ……还有{len(d_with_action)-4}个')
        print(f'     ⚡ 明日动作：逐一执行已有建议，目标邀约见面 / 首次面谈（进C）')

    if D:
        task_num += 1
        no_wechat = [d for d in D if d['微信'] not in ('是', '已加', '✓')]
        print(f'  [成长] 任务{task_num}【D阶段 · 未加微信 {len(no_wechat)} 个】')
        for d in no_wechat[:5]:
            print(f'     · {d["名称"]}  [联系] {d["电话"] or "无"}  行业：{d.get("痛点","")[:20]}')
        if no_wechat:
            print(f'     ⚡ 明日动作：首要补充加微信，建立私信渠道')

    # ── 任务4：L阶段电话开发 ──────────────────────────────────
    l_untouched = [l for l in L if not l['触达结果'] or l['触达结果'] in ('未触达', '/', 'nan')]
    l_follow = [l for l in L if l['触达结果'] not in ('', '/', 'nan', '未触达')]

    if l_untouched:
        task_num += 1
        count_show = min(5, len(l_untouched))
        print(f'  [健康] 任务{task_num}【L阶段首电开发 · 未触达{len(l_untouched)}个，明日目标{min(10,len(l_untouched))}个】')
        for l in l_untouched[:count_show]:
            print(f'     · {l["名称"]}  行业：{l["行业"]}  [联系] {l["电话"] or "无"}  来源：{l["来源"]}')
        if len(l_untouched) > count_show:
            print(f'     · ……还有{len(l_untouched)-count_show}个未触达')
        print(f'     ⚡ 明日动作：按行业匹配话术，完成电话→加微信，日均目标10个触达')

    # ── 特殊：齐健彪辅导任务 ────────────────────────────────
    if name == '齐健彪':
        task_num += 1
        print(f'  [流失] 任务{task_num}【[警告] 专项辅导 · 主管必看】')
        print(f'     D→C转化率 0%，C阶段0个客户，是全队最低')
        print(f'     ⚡ 明日动作：主管安排1对1复盘，回听3条电话录音，重点改首电流程')
        print(f'     建议：让齐健彪用农产品/蛋糕行业话术模板重新打10条电话，当天汇报')

    if task_num == 0:
        print(f'  （暂无明确任务，建议补充L阶段线索后重新分析）')

    print(f'\n  [清单] 明日任务合计：{task_num} 项')

# ── 全队汇总 ─────────────────────────────────────────────────
print('\n' + '=' * 70)
print('  全队明日优先级汇总')
print('=' * 70)
print('\n  [流失] TOP优先级（今明必完成）：')
for name in SALES:
    if results[name]['B']:
        for b in results[name]['B']:
            print(f'     · {name} - {b["名称"]} 【B阶段成交冲刺】')

print('\n  [成长] 次优先级（今明跟进截止）：')
for name in SALES:
    for c in results[name]['C']:
        try:
            nd = pd.to_datetime(c['下次跟进']).date()
            if nd <= tomorrow:
                print(f'     · {name} - {c["名称"]} 【C阶段，下次跟进{nd}，停留{c["停留天数"]}天】')
        except Exception:
            pass

print('\n  [警告]  风险预警（主管关注）：')
print('     · 齐健彪 C阶段0个 → 立即安排辅导')
for name in SALES:
    for c in results[name]['C']:
        try:
            stay = float(c['停留天数'])
            if stay > 10:
                print(f'     · {name} - {c["名称"]} C阶段停留{int(stay)}天 → 评估是否降级')
        except Exception:
            pass

print('\n  [置顶] 今日各人线索库：')
for name in SALES:
    B = len(results[name]['B'])
    C = len(results[name]['C'])
    D = len(results[name]['D'])
    L = len(results[name]['L'])
    total = B+C+D+L
    print(f'     {name:<6} B:{B}  C:{C}  D:{D}  L:{L}  合计:{total}')

print('\n' + '=' * 70)
print('  任务布置完毕 - 销售总控Agent 2026-03-17')
print('=' * 70)
