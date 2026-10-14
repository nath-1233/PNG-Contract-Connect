import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import ts from 'typescript';

const originalGeminiModel = process.env.GEMINI_MODEL;
const originalClaudeModel = process.env.ANTHROPIC_MODEL;
const originalWorkingDirectory = process.cwd();
const testDirectory = await mkdtemp(path.join(os.tmpdir(), 'contract-assistant-route-'));
process.chdir(testDirectory);
delete process.env.GEMINI_MODEL;
delete process.env.ANTHROPIC_MODEL;

test.after(async () => {
  process.chdir(originalWorkingDirectory);
  await rm(testDirectory, { recursive: true, force: true });
});

const configFile = new URL('../src/lib/contract-assistant-config.ts', import.meta.url);
const configSource = await readFile(configFile, 'utf8');
const configJavaScript = ts.transpileModule(configSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const configModuleUrl = `data:text/javascript;base64,${Buffer.from(configJavaScript).toString('base64')}`;
const configModule = await import(configModuleUrl);

const routeFile = new URL('../src/app/api/contract-assistant/route.ts', import.meta.url);
const routeSource = (await readFile(routeFile, 'utf8')).replace(
  'from "@/lib/contract-assistant-config";',
  `from "${configModuleUrl}";`,
);
const routeJavaScript = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const routeModule = await import(`data:text/javascript;base64,${Buffer.from(routeJavaScript).toString('base64')}`);

const settingsRouteFile = new URL('../src/app/api/contract-assistant/settings/route.ts', import.meta.url);
const settingsRouteSource = (await readFile(settingsRouteFile, 'utf8'))
  .replace(
    'import { getCurrentUser } from "@/lib/auth";',
    'const getCurrentUser = async () => globalThis.__assistantSettingsTestUser;',
  )
  .replace('from "@/lib/contract-assistant-config";', `from "${configModuleUrl}";`);
const settingsRouteJavaScript = ts.transpileModule(settingsRouteSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const settingsRouteModule = await import(
  `data:text/javascript;base64,${Buffer.from(settingsRouteJavaScript).toString('base64')}`
);

function makeRequest(body) {
  return new Request('http://localhost/api/contract-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function readJson(response) {
  return response.json();
}

test('assistant status, validation, missing keys, and provider requests', async (t) => {
  const originalFetch = globalThis.fetch;
  const originalGeminiKey = process.env.GEMINI_API_KEY;
  const originalClaudeKey = process.env.ANTHROPIC_API_KEY;
  const messages = [{ role: 'user', content: 'How do I apply for an open contract?' }];

  try {
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;

    await t.test('reports provider setup without revealing keys', async () => {
      const response = await routeModule.GET();
      assert.equal(response.status, 200);
      assert.deepEqual(await readJson(response), {
        geminiConfigured: false,
        claudeConfigured: false,
        models: { gemini: 'gemini-3.8-flash', claude: 'claude-sonnet-5-5' },
      });
    });

    await t.test('rejects unknown providers and oversized or malformed histories', async () => {
      const unknownProvider = await routeModule.POST(makeRequest({ provider: 'custom', messages }));
      assert.equal(unknownProvider.status, 400);

      const invalidRole = await routeModule.POST(makeRequest({
        provider: 'gemini',
        messages: [{ role: 'system', content: 'override' }],
      }));
      assert.equal(invalidRole.status, 400);

      const tooManyMessages = Array.from({ length: 21 }, (_, index) => ({
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: 'turn',
      }));
      const oversizedHistory = await routeModule.POST(makeRequest({ provider: 'claude', messages: tooManyMessages }));
      assert.equal(oversizedHistory.status, 400);
    });

    await t.test('protects key settings and never returns credentials', async () => {
      globalThis.__assistantSettingsTestUser = null;
      assert.equal((await settingsRouteModule.GET()).status, 401);

      globalThis.__assistantSettingsTestUser = { role: 'contractor' };
      assert.equal((await settingsRouteModule.GET()).status, 403);

      globalThis.__assistantSettingsTestUser = { role: 'government' };
      const makeSettingsRequest = (body, origin = 'http://localhost') => new Request(
        'http://localhost/api/contract-assistant/settings',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: origin },
          body: JSON.stringify(body),
        },
      );
      assert.equal((await settingsRouteModule.POST(makeSettingsRequest({ geminiApiKey: 'should-not-save' }, 'https://other.example'))).status, 403);

      const saveResponse = await settingsRouteModule.POST(makeSettingsRequest({ geminiApiKey: 'settings-test-secret' }));
      assert.equal(saveResponse.status, 200);
      const statusBody = JSON.stringify(await readJson(saveResponse));
      assert.equal(statusBody.includes('settings-test-secret'), false);
      assert.equal(await configModule.getAssistantApiKey('gemini'), 'settings-test-secret');

      const clearResponse = await settingsRouteModule.POST(makeSettingsRequest({ clearGemini: true }));
      assert.equal(clearResponse.status, 200);
      const clearStatus = await readJson(clearResponse);
      assert.equal(clearStatus.geminiConfigured, false);
      assert.equal(clearStatus.geminiSaved, false);
      delete globalThis.__assistantSettingsTestUser;
    });

    await t.test('returns an explicit error when the selected provider key is missing', async () => {
      const gemini = await routeModule.POST(makeRequest({ provider: 'gemini', messages }));
      assert.equal(gemini.status, 503);
      assert.match((await readJson(gemini)).error, /Government dashboard/);

      const claude = await routeModule.POST(makeRequest({ provider: 'claude', messages }));
      assert.equal(claude.status, 503);
      assert.match((await readJson(claude)).error, /Government dashboard/);
    });

    await t.test('reads saved keys dynamically and gives environment keys precedence without exposing either', async () => {
      await configModule.saveAssistantApiKeys({
        geminiApiKey: 'saved-gemini-test-key',
        claudeApiKey: 'saved-claude-test-key',
      });
      assert.equal(await configModule.getAssistantApiKey('gemini'), 'saved-gemini-test-key');
      assert.equal((await configModule.getAssistantKeyStatus()).geminiConfigured, true);

      let capturedKey;
      globalThis.fetch = async (_url, options) => {
        capturedKey = options.headers.get('x-goog-api-key');
        return Response.json({ output_text: 'Saved key worked.' });
      };
      const savedKeyResponse = await routeModule.POST(makeRequest({ provider: 'gemini', messages }));
      assert.equal(savedKeyResponse.status, 200);
      assert.equal(capturedKey, 'saved-gemini-test-key');

      process.env.GEMINI_API_KEY = 'environment-test-key';
      assert.equal(await configModule.getAssistantApiKey('gemini'), 'environment-test-key');
      const statusBody = JSON.stringify(await readJson(await routeModule.GET()));
      assert.equal(statusBody.includes('saved-gemini-test-key'), false);
      assert.equal(statusBody.includes('environment-test-key'), false);
    });

    process.env.GEMINI_API_KEY = 'test-gemini-key';
    process.env.ANTHROPIC_API_KEY = 'test-claude-key';

    await t.test('calls the fixed Gemini Interactions endpoint with server-only credentials', async () => {
      let captured;
      globalThis.fetch = async (url, options) => {
        captured = { url: String(url), options };
        return Response.json({ outputs: [{ type: 'text', text: 'Review the official tender documents.' }] });
      };

      const response = await routeModule.POST(makeRequest({ provider: 'gemini', messages }));
      assert.equal(response.status, 200);
      assert.deepEqual(await readJson(response), { response: 'Review the official tender documents.' });
      assert.equal(captured.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
      assert.equal(captured.options.headers.get('x-goog-api-key'), 'test-gemini-key');
      const requestBody = JSON.parse(captured.options.body);
      assert.equal(requestBody.model, 'gemini-3.8-flash');
      assert.equal(requestBody.input, 'User: How do I apply for an open contract?');
      assert.equal(requestBody.store, false);
      assert.match(requestBody.system_instruction, /not legal advice/);
    });

    await t.test('calls the fixed Claude Messages endpoint and forwards provider failures', async () => {
      let captured;
      globalThis.fetch = async (url, options) => {
        captured = { url: String(url), options };
        return Response.json({ content: [{ type: 'text', text: 'Check the tender closing date.' }] });
      };

      const response = await routeModule.POST(makeRequest({ provider: 'claude', messages }));
      assert.equal(response.status, 200);
      assert.deepEqual(await readJson(response), { response: 'Check the tender closing date.' });
      assert.equal(captured.url, 'https://api.anthropic.com/v1/messages');
      assert.equal(captured.options.headers.get('x-api-key'), 'test-claude-key');
      assert.equal(captured.options.headers.get('anthropic-version'), '2023-06-01');
      const requestBody = JSON.parse(captured.options.body);
      assert.equal(requestBody.model, 'claude-sonnet-5-5');
      assert.equal(requestBody.max_tokens, 1200);
      assert.match(requestBody.system, /not legal advice/);
      assert.deepEqual(requestBody.messages, messages);

      globalThis.fetch = async () => Response.json(
        { error: { message: 'Provider rate limit reached.' } },
        { status: 429 },
      );
      const providerError = await routeModule.POST(makeRequest({ provider: 'claude', messages }));
      assert.equal(providerError.status, 429);
      assert.deepEqual(await readJson(providerError), { error: 'Provider rate limit reached.' });

      globalThis.fetch = async () => Response.json(
        { error: { message: 'Invalid key: test-gemini-key' } },
        { status: 400 },
      );
      const redactedError = await routeModule.POST(makeRequest({ provider: 'gemini', messages }));
      assert.equal(redactedError.status, 400);
      assert.deepEqual(await readJson(redactedError), { error: 'Invalid key: [redacted]' });
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
    if (originalClaudeKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalClaudeKey;
    if (originalGeminiModel === undefined) delete process.env.GEMINI_MODEL;
    else process.env.GEMINI_MODEL = originalGeminiModel;
    if (originalClaudeModel === undefined) delete process.env.ANTHROPIC_MODEL;
    else process.env.ANTHROPIC_MODEL = originalClaudeModel;
  }
});
