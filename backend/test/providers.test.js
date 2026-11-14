import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiProvider, openaiProvider, createProvider, SYSTEM_INSTRUCTION } from '../src/llm/providers.js';

test('Gemini: usa x-goog-api-key, instrucción de sistema y temperatura 0', async () => {
  let seen;
  const fetchImpl = async (url, opts) => { seen = { url, opts }; return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }) }; };
  const p = geminiProvider({ apiKey: 'g-key', model: 'gemini-x', fetchImpl });
  assert.equal(await p.generate('hola NAME_abcdefabcdef'), 'ok');
  assert.match(seen.url, /models\/gemini-x:generateContent$/);
  assert.equal(seen.opts.headers['x-goog-api-key'], 'g-key');
  const body = JSON.parse(seen.opts.body);
  assert.equal(body.systemInstruction.parts[0].text, SYSTEM_INSTRUCTION);
  assert.equal(body.generationConfig.temperature, 0);
});

test('OpenAI: Authorization Bearer y error HTTP controlado', async () => {
  const p = openaiProvider({ apiKey: 'o-key', fetchImpl: async () => ({ ok: false, status: 429 }) });
  await assert.rejects(() => p.generate('x'), /HTTP 429/);
});

test('sin llave configurada se usa el proveedor simulado', () => {
  assert.equal(createProvider({ provider: 'gemini', geminiKey: '' }).name, 'mock');
});
