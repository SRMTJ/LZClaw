#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSM Claw · 客户经营机会Agent  V1.0
======================================
Agent 名称：CSM_Opportunity_Analyzer
职责：读取客户盘点表，识别每位客户当前最值得推进的经营机会。

六类机会：
  1. 会员机会
  2. 分销机会
  3. 储值机会
  4. 私域运营机会
  5. 版本升级机会
  6. 增购机会

判断原则：
  - 严格基于字段数据判断，不做主观猜测
  - 每个客户最多输出 1-2 个最优先机会
  - 优先级：当前阶段最适合 > 低风险高成功率 > 续费/增购价值更大

字段映射（来自⭐增鑫客成-总表）：
  服务阶段          → 客户阶段映射
  盘点后客户标签    → 经营状态 / 风险标签
  行业类目          → 行业（复购型 / 裂变型 / 门店型）
  留存客户平台      → 是否有私域
  现有客户维护体系  → 会员/储值体系状态
  客户购买场景      → 已购场景（含分销判断）
  盘点后客户场景    → 盘点后场景
  产品版本          → 版本高低
  门店数量          → 门店数
  预估续费意向      → 续费意向
  增购插件          → 已增购插件
"""

import json
import pandas as pd
from datetime import datetime

# ── 常量 ──────────────────────────────────────────────────────────────────

EXCEL_PATH  = '客户成功总表.xlsx'
SHEET_NAME  = '\u2b50\u589e\u946b\u5ba2\u6210-\u603b\u8868'
OUTPUT_JSON = 'opportunity_results.json'

# 行业分类
REPURCHASE_INDUSTRIES = {'蛋糕烘焙', '零售', '美妆护肤', '母婴', '茶饮咖酒水', '烘焙', '综合食品', '生鲜果蔬'}
FISSION_INDUSTRIES    = {'保健食品', '茶饮咖酒水', '美妆护肤', '酒水', '母婴', '滋补保健', '其他食品'}
STORE_INDUSTRIES      = {'蛋糕烘焙', '茶饮咖酒水', '餐饮', '零售', '门店零售', '生鲜果蔬', '综合食品'}

# 版本等级（数值越大版本越高）
VERSION_RANK = {
    '电商基础版': 1,
    '门店基础版': 1,
    '电商专业版': 2,
    '门店专业版': 2,
    '电商专业版2+1': 3,
    '门店专业版2+1': 3,
    '连锁专业版': 4,
    '连锁专业版2+1': 4,
    '旗舰版': 5,
}

# 机会优先级权重（数值越大越优先输出）
PRIORITY_WEIGHTS = {
    '增购机会':     6,
    '版本升级机会': 5,
    '会员机会':     4,
    '分销机会':     3,
    '储值机会':     3,
    '私域运营机会': 2,
}

BANNER = """
╔══════════════════════════════════════════════════════════════════╗
║   CSM Claw · 客户经营机会Agent  [V1.0]                         ║
║   识别六类经营机会：会员/分销/储值/私域/版本升级/增购           ║
╚══════════════════════════════════════════════════════════════════╝
"""

# ── 字段解析辅助 ──────────────────────────────────────────────────────────

def safe_str(val) -> str:
    if pd.isna(val):
        return ''
    return str(val).strip()


def parse_service_stage(val: str) -> str:
    """将服务阶段映射为 [激活/经营/续费/断约/交付]"""
    v = safe_str(val)
    if '活跃' in v:
        return '经营'
    if '续费' in v:
        return '续费'
    if '断约' in v:
        return '断约'
    if '交付' in v or '新签' in v:
        return '激活'
    return ''


def parse_health_state(label: str) -> str:
    """从盘点后客户标签判断经营状态"""
    l = safe_str(label).lower()
    if '倒闭' in l or '断约' in l or '流失' in l:
        return '风险'
    if '正常建联' in l:
        return '正常'
    if '新签' in l or '交付' in l:
        return '激活'
    if '需要2次建联' in l or '梳理' in l or '项目暂停' in l:
        return '需要帮助'
    if '增值升级' in l:
        return '经营良好'
    if '内部' in l or '风控' in l:
        return '特殊'
    return '未知'


def has_private_domain(platform: str) -> bool:
    """判断是否有私域（个微/企微/公众号=有）"""
    p = safe_str(platform)
    return any(k in p for k in ['个微', '企微', '公众号'])


def has_member_system(maintain: str, scene: str) -> bool:
    """判断是否已有会员体系"""
    m = safe_str(maintain)
    s = safe_str(scene)
    return '会员' in m or '会员' in s


def has_distribution_system(purchase_scene: str, post_scene: str) -> bool:
    """判断是否已有分销体系"""
    p = safe_str(purchase_scene)
    s = safe_str(post_scene)
    return '分销' in p or '分销' in s


def has_deposit_system(maintain: str, scene: str, deposit_members) -> bool:
    """判断是否已有储值体系"""
    m = safe_str(maintain)
    s = safe_str(scene)
    if '储值' in m or '储值' in s:
        return True
    try:
        return float(deposit_members) > 0
    except (TypeError, ValueError):
        return False


def count_scenes(purchase_scene: str, post_scene: str) -> int:
    """统计已购/盘点场景数量"""
    scenes = set()
    for raw in [purchase_scene, post_scene]:
        v = safe_str(raw)
        if v:
            for part in v.split(','):
                part = part.strip()
                if part and part not in {'nan', '基础版商家', '展示下单', '基础下单'}:
                    scenes.add(part)
    return len(scenes)


def get_version_rank(version: str) -> int:
    v = safe_str(version)
    for k, r in VERSION_RANK.items():
        if k in v:
            return r
    return 0


def parse_renew_intent(intent: str) -> str:
    v = safe_str(intent)
    if '大机会' in v or '已合作' in v:
        return '明确续费'
    if '跟进可转化' in v:
        return '可能续费'
    if '死单' in v:
        return '不续费'
    return ''


def has_risk_stop(label: str) -> bool:
    """风险标签中是否存在'准备关店'或'准备换系统'"""
    l = safe_str(label)
    return '关店' in l or '换系统' in l or '倒闭' in l


def parse_store_count(val) -> int:
    v = safe_str(val)
    if v in ('', 'nan', '不知道'):
        return 0
    if v == '5-10':
        return 5
    if '10以上' in v:
        return 10
    try:
        return int(float(v))
    except ValueError:
        return 0


def is_repurchase_industry(industry: str) -> bool:
    i = safe_str(industry)
    return any(k in i for k in REPURCHASE_INDUSTRIES)


def is_fission_industry(industry: str) -> bool:
    i = safe_str(industry)
    return any(k in i for k in FISSION_INDUSTRIES)


def is_store_industry(industry: str) -> bool:
    i = safe_str(industry)
    return any(k in i for k in STORE_INDUSTRIES)


# ── 六类机会判断 ──────────────────────────────────────────────────────────

def check_member_opportunity(row) -> tuple[bool, str]:
    """会员机会：满足任意2条触发"""
    conditions = []
    stage      = parse_service_stage(row['服务阶段'])
    health     = parse_health_state(row['盘点后客户标签'])
    industry   = safe_str(row['行业类目（实际类目非注册）'])
    platform   = safe_str(row['留存客户平台'])
    maintain   = safe_str(row['现有客户维护体系'])
    post_scene = safe_str(row['盘点后客户场景'])

    has_pvt  = has_private_domain(platform)
    has_mem  = has_member_system(maintain, post_scene)

    reasons = []
    if has_pvt:
        conditions.append(True)
        reasons.append('有私域流量')
    if is_repurchase_industry(industry):
        conditions.append(True)
        reasons.append(f'复购型行业({industry})')
    if not has_mem:
        conditions.append(True)
        reasons.append('会员体系未开始')
    if stage == '经营':
        conditions.append(True)
        reasons.append('客户阶段=经营')
    if health in ('正常', '经营良好'):
        conditions.append(True)
        reasons.append(f'经营状态={health}')

    if sum(conditions) >= 2 and not has_mem:
        return True, '；'.join(reasons[:3])
    return False, ''


def check_distribution_opportunity(row) -> tuple[bool, str]:
    """分销机会：满足任意2条触发"""
    stage        = parse_service_stage(row['服务阶段'])
    health       = parse_health_state(row['盘点后客户标签'])
    industry     = safe_str(row['行业类目（实际类目非注册）'])
    purchase     = safe_str(row['客户购买场景'])
    post_scene   = safe_str(row['盘点后客户场景'])
    biz_model    = safe_str(row['商家业态'])

    has_dist = has_distribution_system(purchase, post_scene)
    if has_dist:
        return False, ''

    conditions = []
    reasons    = []
    # 是否有代理（商家业态含渠道/批发/供货视为有代理潜力）
    if any(k in biz_model for k in ['渠道', '批发', '供货', '厂牌']):
        conditions.append(True)
        reasons.append(f'有代理/渠道销售({biz_model})')
    if is_fission_industry(industry):
        conditions.append(True)
        reasons.append(f'裂变适合行业({industry})')
    if stage == '经营':
        conditions.append(True)
        reasons.append('客户阶段=经营')
    if health in ('正常', '经营良好'):
        conditions.append(True)
        reasons.append(f'经营状态={health}')

    if sum(conditions) >= 2:
        return True, '；'.join(reasons[:3])
    return False, ''


def check_deposit_opportunity(row) -> tuple[bool, str]:
    """储值机会：满足任意2条触发"""
    stage       = parse_service_stage(row['服务阶段'])
    health      = parse_health_state(row['盘点后客户标签'])
    industry    = safe_str(row['行业类目（实际类目非注册）'])
    maintain    = safe_str(row['现有客户维护体系'])
    post_scene  = safe_str(row['盘点后客户场景'])
    store_cnt   = parse_store_count(row['门店数量'])
    dep_members = row['储值会员数']

    has_dep = has_deposit_system(maintain, post_scene, dep_members)
    if has_dep:
        return False, ''

    conditions = []
    reasons    = []
    if store_cnt >= 1:
        conditions.append(True)
        reasons.append(f'门店数≥1({store_cnt}家)')
    if is_store_industry(industry):
        conditions.append(True)
        reasons.append(f'高复购门店行业({industry})')
    if stage == '经营':
        conditions.append(True)
        reasons.append('客户阶段=经营')
    if health in ('正常', '经营良好'):
        conditions.append(True)
        reasons.append(f'经营状态={health}')

    if sum(conditions) >= 2:
        return True, '；'.join(reasons[:3])
    return False, ''


def check_private_domain_opportunity(row) -> tuple[bool, str]:
    """私域运营机会：满足任意2条触发"""
    stage    = parse_service_stage(row['服务阶段'])
    health   = parse_health_state(row['盘点后客户标签'])
    platform = safe_str(row['留存客户平台'])
    label    = safe_str(row['盘点后客户标签'])

    if has_risk_stop(label):
        return False, ''

    has_pvt = has_private_domain(platform)

    conditions = []
    reasons    = []
    if not has_pvt:
        conditions.append(True)
        reasons.append('暂无私域/私域未开始')
    if stage in ('激活', '经营'):
        conditions.append(True)
        reasons.append(f'客户阶段={stage}')
    if health in ('正常', '需要帮助'):
        conditions.append(True)
        reasons.append(f'经营状态={health}')

    if sum(conditions) >= 2:
        return True, '；'.join(reasons[:3])
    return False, ''


def check_upgrade_opportunity(row) -> tuple[bool, str]:
    """版本升级机会：满足任意2条触发"""
    stage        = parse_service_stage(row['服务阶段'])
    health       = parse_health_state(row['盘点后客户标签'])
    version      = safe_str(row['产品版本'])
    purchase     = safe_str(row['客户购买场景'])
    post_scene   = safe_str(row['盘点后客户场景'])
    label        = safe_str(row['盘点后客户标签'])

    version_rank = get_version_rank(version)
    scene_cnt    = count_scenes(purchase, post_scene)

    conditions = []
    reasons    = []
    if version_rank in (1, 2):
        conditions.append(True)
        reasons.append(f'当前版本较低({version})')
    if scene_cnt >= 2:
        conditions.append(True)
        reasons.append(f'已启动{scene_cnt}个场景')
    if stage in ('经营', '续费'):
        conditions.append(True)
        reasons.append(f'客户阶段={stage}')
    if health == '经营良好' or '增值升级' in label:
        conditions.append(True)
        reasons.append('经营良好/有增值升级需求')

    if sum(conditions) >= 2 and version_rank < 4:
        return True, '；'.join(reasons[:3])
    return False, ''


def check_upsell_opportunity(row) -> tuple[bool, str]:
    """增购机会：满足任意2条触发"""
    stage       = parse_service_stage(row['服务阶段'])
    health      = parse_health_state(row['盘点后客户标签'])
    purchase    = safe_str(row['客户购买场景'])
    post_scene  = safe_str(row['盘点后客户场景'])
    label       = safe_str(row['盘点后客户标签'])
    intent      = parse_renew_intent(row['预估续费意向'])

    scene_cnt   = count_scenes(purchase, post_scene)
    has_bad_tag = has_risk_stop(label) or '流失风险' in label or '断约' in label

    if has_bad_tag:
        return False, ''

    conditions = []
    reasons    = []
    if scene_cnt >= 1:
        conditions.append(True)
        reasons.append(f'已有{scene_cnt}个场景在使用')
    if health in ('正常', '经营良好'):
        conditions.append(True)
        reasons.append(f'经营状态={health}')
    if intent in ('明确续费', '可能续费'):
        conditions.append(True)
        reasons.append(f'续费意向={intent}')
    if not label or label == 'nan':
        conditions.append(True)
        reasons.append('无风险标签')
    if stage in ('经营', '续费'):
        conditions.append(True)
        reasons.append(f'客户阶段={stage}')

    if sum(conditions) >= 2:
        return True, '；'.join(reasons[:3])
    return False, ''


# ── 建议动作映射 ──────────────────────────────────────────────────────────

ACTIONS = {
    '会员机会':     '建议推进：设计会员等级体系 → 引导客户导入历史会员 → 开启积分/储值联动',
    '分销机会':     '建议推进：引导开启分销员功能 → 梳理代理/渠道层级方案 → 设置佣金比例',
    '储值机会':     '建议推进：开启储值功能 → 设定首次储值门槛和赠送比例 → 配合门店收银测试',
    '私域运营机会': '建议推进：引导添加企微/个微 → 制定用户留存SOP → 讲解私域运营价值',
    '版本升级机会': '建议推进：梳理当前版本限制 → 对比高版本新功能 → 制作升级ROI测算表',
    '增购机会':     '建议推进：梳理已有场景使用情况 → 找到下一个场景需求点 → 给出增购方案报价',
}

NO_OPPORTUNITY = {
    'type':   '暂无明确经营机会',
    'reason': '当前客户更适合先维持服务或先处理风险',
    'action': '先保持跟进或先解决风险问题',
}


# ── 主流程 ────────────────────────────────────────────────────────────────

def analyze_opportunities(df: pd.DataFrame) -> list[dict]:
    results = []
    checkers = [
        ('会员机会',     check_member_opportunity),
        ('分销机会',     check_distribution_opportunity),
        ('储值机会',     check_deposit_opportunity),
        ('私域运营机会', check_private_domain_opportunity),
        ('版本升级机会', check_upgrade_opportunity),
        ('增购机会',     check_upsell_opportunity),
    ]

    for _, row in df.iterrows():
        name  = safe_str(row['店铺名称'])
        stage = parse_service_stage(row['服务阶段'])
        raw_stage = safe_str(row['服务阶段'])
        health = parse_health_state(row['盘点后客户标签'])

        found = []
        for opp_type, fn in checkers:
            ok, reason = fn(row)
            if ok:
                found.append({
                    'type':     opp_type,
                    'reason':   reason,
                    'action':   ACTIONS[opp_type],
                    'priority': PRIORITY_WEIGHTS[opp_type],
                })

        # 按优先级降序，最多输出2个
        found.sort(key=lambda x: x['priority'], reverse=True)
        top = found[:2]

        if top:
            results.append({
                'name':        name,
                'stage':       stage,
                'raw_stage':   raw_stage,
                'health':      health,
                'industry':    safe_str(row['行业类目（实际类目非注册）']),
                'version':     safe_str(row['产品版本']),
                'opportunities': [
                    {'type': o['type'], 'reason': o['reason'], 'action': o['action']}
                    for o in top
                ],
                'opp_count': len(top),
            })
        else:
            results.append({
                'name':        name,
                'stage':       stage,
                'raw_stage':   raw_stage,
                'health':      health,
                'industry':    safe_str(row['行业类目（实际类目非注册）']),
                'version':     safe_str(row['产品版本']),
                'opportunities': [NO_OPPORTUNITY],
                'opp_count': 0,
            })

    return results


def build_summary(results: list[dict]) -> dict:
    total = len(results)
    has_opp = sum(1 for r in results if r['opp_count'] > 0)
    type_counter: dict[str, int] = {}
    for r in results:
        for o in r['opportunities']:
            t = o['type']
            if t != '暂无明确经营机会':
                type_counter[t] = type_counter.get(t, 0) + 1

    return {
        'generated_at':  datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'total_clients': total,
        'has_opportunity': has_opp,
        'no_opportunity':  total - has_opp,
        'opportunity_type_counts': type_counter,
    }


def print_summary(summary: dict, results: list[dict]) -> None:
    sep = '─' * 65
    print(f'\n{sep}')
    print(f'  CSM Claw 客户经营机会报告  ·  {summary["generated_at"]}')
    print(sep)
    print(f'\n  总客户数：{summary["total_clients"]} 家')
    print(f'  有机会客户：{summary["has_opportunity"]} 家  |  暂无机会：{summary["no_opportunity"]} 家\n')
    print('  各类机会分布：')
    for t, cnt in sorted(summary['opportunity_type_counts'].items(),
                         key=lambda x: x[1], reverse=True):
        print(f'    · {t:<10} {cnt:>4} 家')

    print(f'\n  Top 15 经营机会客户（按优先级）：')
    # 只取有机会、优先级最高的
    top_clients = [r for r in results if r['opp_count'] > 0]
    top_clients.sort(
        key=lambda x: PRIORITY_WEIGHTS.get(x['opportunities'][0]['type'], 0),
        reverse=True
    )
    for i, c in enumerate(top_clients[:15], 1):
        o = c['opportunities'][0]
        print(f'    {i:>2}. [{o["type"]}] {c["name"]}（{c["health"]} · {c["stage"]}）')
        print(f'        理由：{o["reason"]}')
    print(sep)


def main() -> int:
    # print(BANNER)
    # print(f'  数据源：{EXCEL_PATH} · {SHEET_NAME}')

    df = pd.read_excel(EXCEL_PATH, sheet_name=SHEET_NAME, header=0)
    # 过滤内部店铺 / 空名称
    df = df[df['店铺名称'].notna()].copy()
    print(f'  有效客户：{len(df)} 家')

    results  = analyze_opportunities(df)
    summary  = build_summary(results)

    # 保存 JSON
    output = {'summary': summary, 'clients': results}
    with open(OUTPUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f'  已保存：{OUTPUT_JSON}')

    print_summary(summary, results)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
