#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
CSM Claw · 客户成功调度Agent  V3.0
======================================
Agent 名称：CSM_Claw_Scheduler
职责：作为 CSM Claw 系统的统一调度入口，按顺序驱动六个子 Agent 执行，
      完成"分析 → 识别 → 机会挖掘 → 续费预测 → 任务生成 → 报告输出"全流程。

每日运行流程：
  Step 1  客户健康分析Agent      [csm_health.py]            → 客户健康评分（health_results.json）
  Step 2  风险客户识别Agent      [risk_agent.py]            → 风险客户报告（risk_results.json）
  Step 3  客户经营机会Agent      [opportunity_agent.py]     → 六类机会识别（opportunity_results.json）
  Step 4  续费预测Agent          [renew_agent.py]           → 续费概率预测（renew_results.json）
  Step 5  客户成功任务Agent      [gen_task_list.py]         → 今日任务清单（task_results.json）
  Step 6  报告生成（三份）
            客户成功日报          [gen_task_report.py]       → task_list.html
            经营机会报告          [gen_opportunity_report.py]→ opportunity_report.html
            主管驾驶舱日报        [gen_dashboard_report.py]  → dashboard_report.html

最终输出：
  · task_list.html         —— CSM 每日任务清单
  · opportunity_report.html—— 六类经营机会（分 Tab）
  · dashboard_report.html  —— 主管驾驶舱全局视图

调度规则：
  - 每一步成功完成后才进入下一步
  - 若某步失败，中止后续步骤并输出错误详情
  - 全部完成后输出汇总摘要（含六大板块数据快览）
"""

import subprocess, sys, time, json, os
from datetime import datetime
from collections import Counter

# ── Agent 列表（顺序即执行顺序）────────────────────────────────────────
AGENTS = [
    {
        'id':     'CSM_Health_Analyzer',
        'name':   '客户健康分析Agent',
        'script': 'scripts/csm_health.py',
        'desc':   '客户健康度评分，输出四级分层（健康/成长/风险/流失）',
        'output': 'health_results.json',
    },
    {
        'id':     'CSM_Risk_Detector',
        'name':   '风险客户识别Agent',
        'script': 'scripts/risk_agent.py',
        'desc':   '识别风险客户（[流失]高风险/[成长]中风险），标注风险原因与建议动作',
        'output': 'risk_results.json',
    },
    {
        'id':     'CSM_Opportunity_Analyzer',
        'name':   '客户经营机会Agent',
        'script': 'scripts/opportunity_agent.py',
        'desc':   '识别六类机会：会员/分销/储值/私域运营/版本升级/增购（每客户最多2个）',
        'output': 'opportunity_results.json',
    },
    {
        'id':     'CSM_Renew_Predictor',
        'name':   '续费预测Agent',
        'script': 'scripts/renew_agent.py',
        'desc':   '预测客户30/60/90天续费概率（高/中/低三档），综合六维度评分',
        'output': 'renew_results.json',
    },
    {
        'id':     'CSM_Daily_Task_Manager',
        'name':   '客户成功任务Agent',
        'script': '../skills/gen_task_list.py',
        'desc':   '汇总生成三类任务：风险客户 / 场景推进（≤1个场景）/ 续费任务',
        'output': 'task_results.json',
    },
    {
        'id':     'Report_Task',
        'name':   '客户成功日报生成',
        'script': '../skills/gen_task_report.py',
        'desc':   '渲染 HTML 任务日报（task_list.html）',
        'output': 'task_list.html',
    },
    {
        'id':     'Report_Opportunity',
        'name':   '经营机会报告生成',
        'script': '../skills/gen_opportunity_report.py',
        'desc':   '渲染经营机会 HTML 报告（opportunity_report.html）—— 六类机会分 Tab',
        'output': 'opportunity_report.html',
    },
    {
        'id':     'CSM_Dashboard_Agent',
        'name':   '客户成功主管驾驶舱',
        'script': '../skills/gen_dashboard_report.py',
        'desc':   '主管视角：健康/风险/机会/续费/任务五大板块全局日报（dashboard_report.html）',
        'output': 'dashboard_report.html',
    },
]

BANNER = """
╔══════════════════════════════════════════════════════════════════╗
║   CSM Claw · 客户成功调度Agent  [CSM_Claw_Scheduler V3.0]      ║
║   健康分析 → 风险识别 → 经营机会 → 续费预测 → 任务 → 驾驶舱   ║
╚══════════════════════════════════════════════════════════════════╝
"""

SEP  = '─' * 67
SEP2 = '═' * 67


def run_agent(agent: dict) -> tuple[bool, str, float]:
    t0 = time.time()
    # 构建正确的脚本路径
    script_path = agent['script']
    
    # 如果脚本不在当前目录，尝试从agent目录查找
    if not os.path.exists(script_path) and not script_path.startswith('../'):
        # 尝试在agent目录查找
        agent_script_path = os.path.join(os.path.dirname(__file__), script_path)
        if os.path.exists(agent_script_path):
            script_path = agent_script_path
    
    result = subprocess.run(
        [sys.executable, script_path],
        capture_output=True, text=True, encoding='utf-8'
    )
    elapsed = time.time() - t0
    output = result.stdout.strip()
    if result.returncode != 0:
        err = result.stderr.strip() or result.stdout.strip()
        return False, err, elapsed
    return True, output, elapsed


def fmt_time(seconds: float) -> str:
    return f'{seconds:.1f}s'


def load_json(path: str):
    try:
        # 尝试从生成结果文件夹加载
        gen_path = os.path.join('生成结果', path)
        if os.path.exists(gen_path):
            with open(gen_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        # 回退到原始路径
        elif os.path.exists(path):
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}


LEVEL_MAP = {
    '健康客户': 'healthy',
    '成长客户': 'growing',
    '风险客户': 'at_risk',
    '流失客户': 'churned',
}


def print_daily_report(today: str) -> None:
    """输出 CSM Claw 客户成功日报快览（六大板块）"""
    health_raw = load_json('health_results.json')
    health_list = health_raw if isinstance(health_raw, list) else health_raw.get('clients', [])

    risk_raw   = load_json('risk_results.json')
    tasks_raw  = load_json('task_results.json')
    opp_raw    = load_json('opportunity_results.json')
    renew_raw  = load_json('renew_results.json')

    risk_list  = risk_raw  if isinstance(risk_raw, list)  else risk_raw.get('risk_clients', [])
    task_data  = tasks_raw if isinstance(tasks_raw, dict) else {}
    opp_data   = opp_raw   if isinstance(opp_raw,  dict)  else {}
    renew_data = renew_raw if isinstance(renew_raw, dict) else {}

    t_sum = task_data.get('summary', {})
    o_sum = opp_data.get('summary', {})
    r_sum = renew_data.get('summary', {})

    # 健康四级
    lvl_cnt: Counter = Counter()
    for c in health_list:
        lv = c.get('level', '')
        if lv in LEVEL_MAP:
            lvl_cnt[LEVEL_MAP[lv]] += 1
    total   = len(health_list)
    healthy = lvl_cnt['healthy']
    growing = lvl_cnt['growing']
    at_risk = lvl_cnt['at_risk']
    churned = lvl_cnt['churned']

    r_total = len(risk_list)
    r_high  = sum(1 for r in risk_list if r.get('danger_level') == '高风险')
    r_mid   = sum(1 for r in risk_list if r.get('danger_level') == '中风险')

    opp_has   = o_sum.get('has_opportunity', 0)
    opp_types = o_sum.get('opportunity_type_counts', {})

    renew_total = r_sum.get('total', 0)
    renew_high  = r_sum.get('high_prob', 0)
    renew_mid   = r_sum.get('mid_prob', 0)
    renew_low   = r_sum.get('low_prob', 0)
    expire_30   = r_sum.get('expire_30d', 0)
    overdue     = r_sum.get('overdue', 0)

    task_risk   = t_sum.get('risk_total', len(task_data.get('risk_clients', [])))
    risk_high   = t_sum.get('risk_high', 0)
    risk_mid    = t_sum.get('risk_mid', 0)
    rn_total    = t_sum.get('renew_total', 0)

    print(f'\n{SEP2}')
    print(f'  [清单]  CSM Claw 客户成功日报  ·  {today}')
    print(SEP2)

    # 一、健康概览
    print(f'\n  一、客户健康概览  （共 {total} 家）')
    print(f'      [完成] 健康客户 {healthy:>4} 家  |  [上升] 成长客户 {growing:>4} 家')
    print(f'      [警告]  风险客户 {at_risk:>4} 家  |  💔 流失客户 {churned:>4} 家')

    # 二、风险客户
    print(f'\n  二、今日风险客户  （共 {r_total} 家）')
    print(f'      [流失] 高风险 {r_high} 家  |  [成长] 中风险 {r_mid} 家')
    for r in risk_list[:5]:
        print(f'      · {r.get("name",""):16}  {r.get("danger_level",""):5}  {", ".join(r.get("risk_reasons",[]) or [r.get("reason","")][:1])[:28]}')

    # 三、经营机会
    print(f'\n  三、今日经营机会客户  （共 {opp_has} 家有明确机会）')
    for t, cnt in sorted(opp_types.items(), key=lambda x: -x[1]):
        print(f'      · {t:<10} {cnt:>4} 家')

    # 四、续费重点
    print(f'\n  四、今日续费重点客户  （{renew_total} 家有效续费分析）')
    print(f'      [健康] 高续费概率 {renew_high} 家  |  [成长] 中概率 {renew_mid} 家  |  [流失] 低概率 {renew_low} 家')
    print(f'      [日期] 30天内到期：{expire_30} 家  |  已逾期：{overdue} 家')
    for r in (renew_data.get('high_prob_clients', []) + renew_data.get('mid_prob_clients', []))[:5]:
        days = r.get('days_left')
        days_str = f'{days}天后到期' if days and days > 0 else (f'已逾期{abs(days)}天' if days and days < 0 else '—')
        print(f'      · {r.get("name",""):16}  {r.get("prob_label",""):12}  {days_str}')

    # 五、今日任务
    print(f'\n  五、今日客户成功任务')
    print(f'      🚨 风险跟进  {task_risk:>3} 家  （[流失]高风险 {risk_high} / [成长]中风险 {risk_mid}）')
    print(f'      [目标] 经营机会  {opp_has:>3} 家  （详见 opportunity_report.html）')
    print(f'      🔄 续费任务  {rn_total:>3} 家')

    # 六、报告地址
    print(f'\n  六、报告文件')
    print(f'      [清单] 主管驾驶舱  ：dashboard_report.html')
    print(f'      📄 任务日报    ：task_list.html')
    print(f'      [目标] 经营机会    ：opportunity_report.html')
    print(f'{SEP2}\n')


def main():
    print(BANNER)
    now = datetime.now()
    today_str = now.strftime('%Y-%m-%d')
    print(f"  调度启动时间：{now.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  Agent 总数  ：{len(AGENTS)}")
    print(SEP)

    results = []
    all_ok  = True

    for i, agent in enumerate(AGENTS, 1):
        print(f"\n[Step {i}/{len(AGENTS)}] {agent['name']}  ·  {agent['id']}")
        print(f"  脚本  ：{agent['script']}")
        print(f"  说明  ：{agent['desc']}")
        print(f"  输出  ：{agent['output']}")
        print(f"  执行中...", end='', flush=True)

        ok, output, elapsed = run_agent(agent)
        status = '[完成] 完成' if ok else '[错误] 失败'
        print(f"\r  状态  ：{status}  耗时：{fmt_time(elapsed)}")

        if output:
            for line in output.splitlines():
                print(f"  │  {line}")

        results.append({
            'step':    i,
            'id':      agent['id'],
            'name':    agent['name'],
            'ok':      ok,
            'elapsed': round(elapsed, 2),
        })

        if not ok:
            print(f"\n  [警告]  Agent 执行失败，调度终止。请检查脚本或数据文件。")
            all_ok = False
            break

    # ── 执行摘要 ────────────────────────────────────────────────────────
    print(f"\n{SEP}")
    total_time = sum(r['elapsed'] for r in results)
    print(f"\n  调度完成时间：{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  总耗时       ：{fmt_time(total_time)}")
    print(f"  执行状态     ：{'全部成功 [完成]' if all_ok else '存在失败 [错误]'}")
    print()
    print(f"  {'步骤':<4} {'Agent ID':<30} {'输出文件':<28} {'状态':<8} {'耗时'}")
    print(f"  {'─'*4} {'─'*30} {'─'*28} {'─'*8} {'─'*6}")
    for r in results:
        agent  = AGENTS[r['step'] - 1]
        status = '[完成] 完成' if r['ok'] else '[错误] 失败'
        print(f"  {r['step']:<4} {r['id']:<30} {agent['output']:<28} {status:<8} {fmt_time(r['elapsed'])}")

    if all_ok:
        print_daily_report(today_str)

    print(SEP)
    return 0 if all_ok else 1


if __name__ == '__main__':
    sys.exit(main())
