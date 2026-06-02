import { expect,test } from 'vitest';

import { CLAW_SALES_PRESET_AGENTS, CLAW_SALES_TEMPLATE_IDS } from './clawSalesPresetAgents';
import { normalizePresetAgent, PRESET_AGENTS } from './presetAgents';

const expectedIcons: Record<string, string> = {
  'claw-agent-01-prospect': 'agent-avatar-svg:tag',
  'claw-agent-02-icebreak': 'agent-avatar-svg:heart',
  'claw-agent-03-customer-diagnosis': 'agent-avatar-svg:diagnosis',
  'claw-agent-04-solution-advance': 'agent-avatar-svg:briefcase',
  'claw-agent-05-deal-conversion': 'agent-avatar-svg:lightning',
  'claw-agent-06-contract-collection': 'agent-avatar-svg:scales',
  'claw-agent-07-training-review': 'agent-avatar-svg:graduation-cap',
  'claw-agent-08-sales-supervision': 'agent-avatar-svg:brain',
  'claw-agent-09-executive-dashboard': 'agent-avatar-svg:data',
};

test('sales preset agents are included in PRESET_AGENTS with expected skills and icons', () => {
  expect(CLAW_SALES_PRESET_AGENTS).toHaveLength(9);

  for (const preset of CLAW_SALES_PRESET_AGENTS) {
    expect(CLAW_SALES_TEMPLATE_IDS).toContain(preset.id);
    expect(PRESET_AGENTS).toContainEqual(preset);
    expect(preset.icon).toBe(expectedIcons[preset.id]);
    expect(preset.skillIds.length).toBeGreaterThan(0);
    expect(preset.systemPrompt).toContain(preset.identity);
  }
});

test('normalizePresetAgent derives identity from systemPrompt when remote template omits it', () => {
  const normalized = normalizePresetAgent({
    id: 'remote-sales-template',
    name: '远端销售模板',
    icon: 'agent-avatar-svg:data',
    description: '测试远端模板 identity 回退。',
    systemPrompt:
      '你是联智 Claw AI CRM 中的远端模板 Agent，负责验证首句回退。\\n\\n## 内置技能\\n- 示例技能',
    skillIds: ['claw-executive-dashboard'],
  });

  expect(normalized).not.toBeNull();
  expect(normalized?.identity).toBe('你是联智 Claw AI CRM 中的远端模板 Agent，负责验证首句回退。');
});
