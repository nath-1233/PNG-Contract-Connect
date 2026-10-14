import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import ts from 'typescript';

const originalGeminiModel = process.env.GEMINI_MODEL;
const originalClaudeModel = process.env.ANTHROPIC_MODEL;
delete process.env.GEMINI_MODEL;
delete process.env.ANTHROPIC_MODEL;

const routeFile = new URL('../src/app/api/contract-assistant/route.ts', import.meta.url);
const routeSource = await readFile(routeFile, 'utf8');
const routeJavaScript = ts.transpileModule(routeSource, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const routeModule = await import(`data:text/javascript;base64,${Buffer.from(routeJavaScript).toString('base64')}`);

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

    await t.test('returns an explicit error when the selected provider key is missing', async () => {
      const gemini = await routeModule.POST(makeRequest({ provider: 'gemini', messages }));
      assert.equal(gemini.status, 503);
      assert.match((await readJson(gemini)).error, /GEMINI_API_KEY/);

      const claude = await routeModule.POST(makeRequest({ provider: 'claude', messages }));
      assert.equal(claude.status, 503);
      assert.match((await readJson(claude)).error, /ANTHROPIC_API_KEY/);
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
