'use strict';

const fs = require('fs');
const path = require('path');

const CLIENT_PATCH_MARKER = 'lzclaw_cognee_remember_entry_patch';
const AGENT_END_PATCH_MARKER = 'lzclaw_cognee_agent_end_capture_patch';

function lzclawAsConversationRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function lzclawUnwrapConversationMessage(value) {
  const record = lzclawAsConversationRecord(value);
  if (!record) return null;
  const nested = lzclawAsConversationRecord(record.message);
  return nested && typeof nested.role === 'string' ? nested : record;
}

function lzclawExtractVisibleMessageText(message) {
  const record = lzclawUnwrapConversationMessage(message);
  if (!record) return '';
  if (typeof record.content === 'string') return record.content.trim();
  if (!Array.isArray(record.content)) return '';

  const chunks = [];
  for (const block of record.content) {
    if (typeof block === 'string') {
      if (block.trim()) chunks.push(block.trim());
      continue;
    }
    const blockRecord = lzclawAsConversationRecord(block);
    if (!blockRecord || blockRecord.type === 'thinking' || blockRecord.type === 'reasoning') {
      continue;
    }
    if (blockRecord.type === 'text' && typeof blockRecord.text === 'string' && blockRecord.text.trim()) {
      chunks.push(blockRecord.text.trim());
      continue;
    }
    if (
      blockRecord.type === 'output_text'
      && typeof blockRecord.output_text === 'string'
      && blockRecord.output_text.trim()
    ) {
      chunks.push(blockRecord.output_text.trim());
    }
  }
  return chunks.join('\n').trim();
}

function lzclawStripManagedUserContext(text) {
  const marker = '[Current user request]';
  const markerIndex = text.lastIndexOf(marker);
  return (markerIndex >= 0 ? text.slice(markerIndex + marker.length) : text).trim();
}

function extractLatestCogneeConversationTurn(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return null;

  let userIndex = -1;
  let userMessage = null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const candidate = lzclawUnwrapConversationMessage(messages[index]);
    if (candidate?.role === 'user') {
      userIndex = index;
      userMessage = candidate;
      break;
    }
  }
  if (userIndex < 0 || !userMessage) return null;

  const question = lzclawStripManagedUserContext(lzclawExtractVisibleMessageText(userMessage));
  if (!question) return null;

  const answerChunks = [];
  let lastAssistantMessage = null;
  for (let index = userIndex + 1; index < messages.length; index += 1) {
    const candidate = lzclawUnwrapConversationMessage(messages[index]);
    if (candidate?.role !== 'assistant') continue;
    const text = lzclawExtractVisibleMessageText(candidate);
    if (!text) continue;
    answerChunks.push(text);
    lastAssistantMessage = candidate;
  }
  const answer = answerChunks.join('\n\n').trim();
  if (!answer || !lastAssistantMessage) return null;

  const userIdentity = String(
    userMessage.idempotencyKey
      ?? userMessage.id
      ?? userMessage.timestamp
      ?? question,
  );
  const assistantIdentity = String(
    lastAssistantMessage.responseId
      ?? lastAssistantMessage.id
      ?? lastAssistantMessage.timestamp
      ?? answer,
  );
  return { question, answer, userIdentity, assistantIdentity };
}

function patchCogneeClient(clientPath, clientDeclarationPath, log) {
  if (!fs.existsSync(clientPath)) {
    throw new Error(`Cognee client not found: ${clientPath}`);
  }

  let source = fs.readFileSync(clientPath, 'utf-8');
  if (!source.includes(CLIENT_PATCH_MARKER)) {
    const anchor = '    // POST /api/v1/improve — Cognee 1.0.3\'s memory-oriented alias for /memify.';
    if (!source.includes(anchor)) {
      throw new Error('Cognee client remember-entry patch anchor not found');
    }
    const addition = [
      `    // ${CLIENT_PATCH_MARKER}`,
      '    async rememberEntry(params) {',
      '        const path = this.isCloud ? "/remember/entry" : "/api/v1/remember/entry";',
      '        return this.fetchAPI(path, {',
      '            method: "POST",',
      '            headers: { "Content-Type": "application/json" },',
      '            body: JSON.stringify({',
      '                entry: {',
      '                    type: "qa",',
      '                    question: params.question,',
      '                    answer: params.answer,',
      '                    context: params.context ?? "",',
      '                },',
      '                dataset_name: params.datasetName,',
      '                session_id: params.sessionId,',
      '            }),',
      '        }, this.timeoutMs, async (response) => (await response.json()), 0);',
      '    }',
      '',
    ].join('\n');
    source = source.replace(anchor, `${addition}${anchor}`);
    fs.writeFileSync(clientPath, source, 'utf-8');
    log('Patched cognee-openclaw client: added rememberEntry()');
  }

  if (!fs.existsSync(clientDeclarationPath)) return;
  let declarations = fs.readFileSync(clientDeclarationPath, 'utf-8');
  if (declarations.includes('rememberEntry(params:')) return;
  const declarationAnchor = '    improve(params: {';
  if (!declarations.includes(declarationAnchor)) {
    throw new Error('Cognee client declaration patch anchor not found');
  }
  const declaration = [
    '    rememberEntry(params: {',
    '        question: string;',
    '        answer: string;',
    '        context?: string;',
    '        datasetName: string;',
    '        sessionId: string;',
    '    }): Promise<{',
    '        status?: string;',
    '        entry_type?: string;',
    '        entry_id?: string;',
    '    }>;',
  ].join('\n');
  declarations = declarations.replace(declarationAnchor, `${declaration}\n${declarationAnchor}`);
  fs.writeFileSync(clientDeclarationPath, declarations, 'utf-8');
}

function patchCogneeAgentEnd(pluginPath, log) {
  if (!fs.existsSync(pluginPath)) {
    throw new Error(`Cognee plugin entry not found: ${pluginPath}`);
  }

  let source = fs.readFileSync(pluginPath, 'utf-8');
  if (source.includes(AGENT_END_PATCH_MARKER)) return;

  const helperAnchor = 'const autoSyncedWorkspaces = new Set();';
  if (!source.includes(helperAnchor)) {
    throw new Error('Cognee agent-end helper patch anchor not found');
  }
  const helperSource = [
    '',
    `// ${AGENT_END_PATCH_MARKER}`,
    lzclawAsConversationRecord.toString(),
    lzclawUnwrapConversationMessage.toString(),
    lzclawExtractVisibleMessageText.toString(),
    lzclawStripManagedUserContext.toString(),
    extractLatestCogneeConversationTurn.toString(),
    'const lzclawCapturedCogneeTurns = new Set();',
  ].join('\n');
  source = source.replace(helperAnchor, `${helperAnchor}${helperSource}`);

  const hookAnchor = [
    '        // ------------------------------------------------------------------',
    '        // Post-agent sync + session persistence',
    '        // ------------------------------------------------------------------',
  ].join('\n');
  if (!source.includes(hookAnchor)) {
    throw new Error('Cognee agent-end hook patch anchor not found');
  }
  const hookSource = [
    '        // Capture the completed user/assistant turn independently from memory-file indexing.',
    '        // This populates Cognee Sessions via POST /api/v1/remember/entry.',
    '        if (cfg.enableSessions) {',
    '            api.on("agent_end", async (event, ctx) => {',
    '                if (!event.success)',
    '                    return;',
    '                const captureSessionId = ctx.sessionId ?? sessionId;',
    '                if (!captureSessionId)',
    '                    return;',
    '                const turn = extractLatestCogneeConversationTurn(event.messages);',
    '                if (!turn)',
    '                    return;',
    '                const turnId = `${captureSessionId}:${turn.userIdentity}:${turn.assistantIdentity}`;',
    '                if (lzclawCapturedCogneeTurns.has(turnId))',
    '                    return;',
    '                lzclawCapturedCogneeTurns.add(turnId);',
    '                const targetDataset = multiScope',
    '                    ? datasetNameForScope("agent", cfg, ctx.agentId)',
    '                    : cfg.datasetName;',
    '                try {',
    '                    const result = await client.rememberEntry({',
    '                        question: turn.question,',
    '                        answer: turn.answer,',
    '                        context: JSON.stringify({ source: "lzclaw", turn_id: turnId }),',
    '                        datasetName: targetDataset,',
    '                        sessionId: captureSessionId,',
    '                    });',
    '                    api.logger.info?.(`cognee-openclaw: captured completed turn for session ${captureSessionId} -> dataset "${targetDataset}" (entry=${result.entry_id ?? "?"})`);',
    '                }',
    '                catch (error) {',
    '                    lzclawCapturedCogneeTurns.delete(turnId);',
    '                    api.logger.warn?.(`cognee-openclaw: completed-turn capture failed for session ${captureSessionId}: ${error instanceof Error ? error.message : String(error)}`);',
    '                }',
    '            });',
    '        }',
    '',
  ].join('\n');
  source = source.replace(hookAnchor, `${hookSource}${hookAnchor}`);
  fs.writeFileSync(pluginPath, source, 'utf-8');
  log('Patched cognee-openclaw plugin: capture completed turns on agent_end');
}

function patchCognee({ runtimeExtensionsDir, log = () => {} }) {
  const pluginDir = path.join(runtimeExtensionsDir, 'cognee-openclaw');
  const distDir = path.join(pluginDir, 'dist', 'src');
  patchCogneeClient(
    path.join(distDir, 'client.js'),
    path.join(distDir, 'client.d.ts'),
    log,
  );
  patchCogneeAgentEnd(path.join(distDir, 'plugin.js'), log);
}

module.exports = {
  extractLatestCogneeConversationTurn,
  patchCognee,
};
