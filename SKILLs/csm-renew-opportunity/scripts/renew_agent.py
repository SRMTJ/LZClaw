#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSM Claw · 续费预测Agent  V1.0
================================
Agent 名称：CSM_Renew_Predictor
职责：基于客户盘点表字段，判断每位客户未来 30/60/90 天的续费概率，
      输出高/中/低续费风险分级，供任务 Agent 和主管驾驶舱使用。

判断维度：
  1. 到期距今天数（urgency_score）
  2. 续费意向字段（intent_score）
  3. 续费状态字段（status_score）
  4. 服务阶段（stage_score）
  5. 风险标签（risk_score）
  6. 最近沟通时间（contact_score）

续费概率区间：
  ≥ 70%   → 高续费概率（建议确认付款）
  40-69%  → 中续费概率（建议深度跟进）
  < 40%   → 低续费概率（需重点干预）
"""

import pandas as pd
import json
from datetime import datetime, date

# ── 常量 ───────────────────────────────────────────────────────────────
EXCEL_FILE  = '客户成功总表.xlsx'
SHEET_NAME  = '⭐增鑫客成-总表'
OUTPUT_FILE = 'renew_results.json'
TODAY       = date.today()

# 续费意向 → 分数
INTENT_SCORE = {
    '大机会':       90,
    '可转化':       70,
    '已合作':       80,
    '待确定':       45,
    '未做跟进预估': 35,
    '流失风险':     15,
    '死单':          5,
}

# 续费状态 → 分数
STATUS_SCORE = {
    '提前3月以上': 95,
    '提前2月':     85,
    '提前1月':     75,
    '当月续费':    65,
    '断约':        10,
}

# 服务阶段 → 分数
STAGE_SCORE = {
    '活跃期':             60,
    '场景交付期中':       55,
    '场景交付延期-卡点':  40,
    '基础交付中':         50,
    '基础交付延期-有卡点':35,
    '断约':               10,
    '续费期':             70,
}

# 风险标签 → 扣分
RISK_DEDUCT = {
    '断约风险':    -30,
    '流失风险':    -35,
    '准备关店':    -40,
    '准备换系统':  -40,
    '需要2次建联': -10,
    '正常建联':     0,
    '新签交付中':   0,
}


def days_to_expire(expire_val):
    """将到期日期转换为"距今天数"（负数=已逾期）"""
    if pd.isna(expire_val):
        return None
    try:
        if isinstance(expire_val, (datetime, pd.Timestamp)):
            return (expire_val.date() - TODAY).days
        if isinstance(expire_val, date):
            return (expire_val - TODAY).days
        # 数字 Excel 序列号
        ts = pd.to_datetime(expire_val, errors='coerce')
        if pd.isna(ts):
            return None
        return (ts.date() - TODAY).days
    except Exception:
        return None


def calc_renew_score(row) -> dict:
    """计算单客户续费预测分数，返回结果字典"""
    score = 50  # 基础分

    # 1. 到期紧迫度
    days = days_to_expire(row.get('最新到期时间'))
    if days is None:
        days = days_to_expire(row.get('26年到期时间'))
    urgency_tag = '无到期信息'
    horizon = None
    if days is not None:
        if days < 0:
            urgency_tag = '已逾期'
            score -= 25
            horizon = '逾期'
        elif days <= 30:
            urgency_tag = f'{days}天内到期'
            score += 10  # 紧迫 = 机会
            horizon = '30天内'
        elif days <= 60:
            urgency_tag = f'{days}天内到期'
            score += 5
            horizon = '60天内'
        elif days <= 90:
            urgency_tag = f'{days}天内到期'
            horizon = '90天内'
        else:
            urgency_tag = f'{days}天后到期'
            score -= 5
            horizon = '90天以上'

    # 2. 续费意向
    intent = str(row.get('预估续费意向') or '').strip()
    if not intent or intent == 'nan':
        intent = str(row.get('25年续费意向') or '').strip()
    score += INTENT_SCORE.get(intent, 35) - 50  # 相对基准50调整

    # 3. 续费状态
    status = str(row.get('续费状态') or '').strip()
    if status and status != 'nan':
        score += STATUS_SCORE.get(status, 40) - 50

    # 4. 服务阶段
    stage = str(row.get('服务阶段') or '').strip()
    score += STAGE_SCORE.get(stage, 45) - 50

    # 5. 风险标签扣分
    label = str(row.get('盘点后客户标签') or '').strip()
    score += RISK_DEDUCT.get(label, 0)

    # 6. 最近沟通时间
    last_contact = row.get('最近跟进时间') or row.get('最近跟进日期')
    contact_days = None
    if not pd.isna(last_contact) if pd.api.types.is_scalar(last_contact) else False:
        try:
            lc = pd.to_datetime(last_contact, errors='coerce')
            if not pd.isna(lc):
                contact_days = (TODAY - lc.date()).days
                if contact_days > 60:
                    score -= 15
                elif contact_days > 30:
                    score -= 8
                elif contact_days <= 14:
                    score += 5
        except Exception:
            pass

    score = max(0, min(100, score))

    if score >= 70:
        prob_level = '高'
        prob_label = '[健康] 高续费概率'
        action     = '确认付款时间 / 推进签单'
    elif score >= 40:
        prob_level = '中'
        prob_label = '[成长] 中续费概率'
        action     = '深度沟通意向 / 解除顾虑'
    else:
        prob_level = '低'
        prob_label = '[流失] 低续费概率'
        action     = '紧急介入 / 挽回沟通'

    return {
        'name':        str(row.get('客户名称', '') or '').strip(),
        'csm':         str(row.get('负责CSM', '') or row.get('CSM', '') or '').strip(),
        'stage':       stage,
        'expire_date': str(row.get('最新到期时间', '') or ''),
        'days_left':   days,
        'urgency_tag': urgency_tag,
        'horizon':     horizon,
        'intent':      intent if intent and intent != 'nan' else '未填写',
        'status':      status if status and status != 'nan' else '未填写',
        'renew_score': score,
        'prob_level':  prob_level,
        'prob_label':  prob_label,
        'action':      action,
    }


def main():
    print(f'[CSM_Renew_Predictor V1.0]  开始续费预测分析...')
    df = pd.read_excel(EXCEL_FILE, sheet_name=SHEET_NAME, header=0)
    print(f'  读取客户总数：{len(df)} 家')

    results = []
    for _, row in df.iterrows():
        r = calc_renew_score(row)
        # 过滤断约且无到期信息的客户
        if r['stage'] == '断约' and r['days_left'] is None:
            continue
        results.append(r)

    # 按分数降序（高续费优先）
    results.sort(key=lambda x: -x['renew_score'])

    high = [r for r in results if r['prob_level'] == '高']
    mid  = [r for r in results if r['prob_level'] == '中']
    low  = [r for r in results if r['prob_level'] == '低']

    # 按 horizon 分桶
    h30  = [r for r in results if r['horizon'] == '30天内']
    h60  = [r for r in results if r['horizon'] == '60天内']
    h90  = [r for r in results if r['horizon'] == '90天内']
    overdue = [r for r in results if r['horizon'] == '逾期']

    summary = {
        'total':        len(results),
        'high_prob':    len(high),
        'mid_prob':     len(mid),
        'low_prob':     len(low),
        'expire_30d':   len(h30),
        'expire_60d':   len(h60),
        'expire_90d':   len(h90),
        'overdue':      len(overdue),
    }

    output = {
        'date':     str(TODAY),
        'agent':    'CSM_Renew_Predictor V1.0',
        'summary':  summary,
        'high_prob_clients': high,
        'mid_prob_clients':  mid,
        'low_prob_clients':  low,
        'all_clients':       results,
    }

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2, default=str)

    print(f'  分析完成：{len(results)} 家有效续费客户')
    print(f'  [健康] 高续费概率（≥70分）：{len(high)} 家')
    print(f'  [成长] 中续费概率（40-69）：{len(mid)} 家')
    print(f'  [流失] 低续费概率（<40分） ：{len(low)} 家')
    print(f'  [日期] 30天内到期：{len(h30)}  60天内：{len(h60)}  90天内：{len(h90)}  已逾期：{len(overdue)}')
    print(f'  → 结果已保存至 {OUTPUT_FILE}')


if __name__ == '__main__':
    main()
