import test from 'node:test';
import assert from 'node:assert/strict';
import { withServer, KEYS } from './helpers.js';

const MSG = 'Hola, soy Pedro Pérez, CC 79845123. No reconozco un cobro en mi tarjeta 4111 1111 1111 1111. Mi cel es 310 555 1234.';

test('visitante: puede ver tipos y detectar sin guardar, pero no anonimizar (401)', async () => {
  await withServer({}, async (call) => {
    assert.equal((await call('/api/v1/entity-types', { method: 'GET' })).status, 200);
    const det = await call('/api/v1/detect', { body: { message: MSG } });
    assert.equal(det.status, 200);
    assert.equal(det.body.stored, false);
    assert.ok(!JSON.stringify(det.body).includes('79845123'));
    assert.equal((await call('/api/v1/anonymize', { body: { message: MSG } })).status, 401);
  });
});

test('roles: el operador no puede desanonimizar (403); el auditor sí', async () => {
  await withServer({}, async (call) => {
    const a = await call('/api/v1/anonymize', { key: KEYS.operador, body: { message: MSG } });
    assert.equal(a.status, 200);
    assert.equal((await call('/api/v1/deanonymize', { key: KEYS.operador, body: { message: a.body.anonymizedMessage } })).status, 403);
    const d = await call('/api/v1/deanonymize', { key: KEYS.auditor, body: { message: a.body.anonymizedMessage } });
    assert.equal(d.body.originalMessage, MSG);
  });
});

test('validación de entrada: message vacío, no texto o JSON inválido', async () => {
  await withServer({}, async (call) => {
    assert.equal((await call('/api/v1/anonymize', { key: KEYS.operador, body: { message: '' } })).status, 400);
    assert.equal((await call('/api/v1/anonymize', { key: KEYS.operador, body: { message: 42 } })).status, 400);
    assert.equal((await call('/api/v1/anonymize', { key: KEYS.operador, body: { message: 'x'.repeat(5001) } })).status, 413);
  });
});

test('secure-chat: la IA solo recibe tokens y la respuesta final restaura los datos', async () => {
  let recibido = '';
  const provider = { name: 'espia', model: 'test', async generate(m) { recibido = m; return `Hola ${m.match(/NAME_\w{12}/)[0]}, revisaremos el cobro.`; } };
  await withServer({ provider }, async (call) => {
    const r = await call('/api/v1/secure-chat', { key: KEYS.operador, body: { message: MSG } });
    assert.equal(r.status, 200);
    for (const v of ['Pedro', '79845123', '4111', '310 555']) assert.ok(!recibido.includes(v), v);
    assert.equal(r.body.finalResponse, 'Hola Pedro Pérez, revisaremos el cobro.');
    assert.equal(r.body.integrity.sent, 4);
    assert.equal(r.body.integrity.preserved, 1);
  });
});

test('secure-chat: la respuesta al cliente enmascara tarjeta y documento (solo el auditor ve el dato completo)', async () => {
  const provider = { name: 'eco', model: 't', async generate(m) { return m; } };
  await withServer({ provider }, async (call) => {
    const r = await call('/api/v1/secure-chat', { key: KEYS.operador, body: { message: MSG } });
    assert.match(r.body.finalResponse, /tarjeta ••••1111/);
    assert.match(r.body.finalResponse, /CC \*\*\*123/);
    assert.match(r.body.finalResponse, /Pedro Pérez/);
    assert.ok(!r.body.finalResponse.includes('4111 1111'));
  });
});

test('secure-chat: tokens inventados por la IA no se restauran ni filtran', async () => {
  const provider = { name: 'alucina', model: 't', async generate() { return 'Su documento DOC_ffffffffffff está activo.'; } };
  await withServer({ provider }, async (call) => {
    const r = await call('/api/v1/secure-chat', { key: KEYS.operador, body: { message: 'CC 79845123' } });
    assert.equal(r.body.finalResponse, 'Su documento [dato no disponible] está activo.');
    assert.deepEqual(r.body.integrity.invented, ['DOC_ffffffffffff']);
  });
});

test('secure-chat: si la IA falla responde 502 sin exponer detalles', async () => {
  const provider = { name: 'caido', model: 't', async generate() { throw new Error('clave sk-123 inválida'); } };
  await withServer({ provider }, async (call) => {
    const r = await call('/api/v1/secure-chat', { key: KEYS.operador, body: { message: MSG } });
    assert.equal(r.status, 502);
    assert.ok(!JSON.stringify(r.body).includes('sk-123'));
  });
});

test('compatibilidad con rutas del Taller 2 (/anonymize, /secureChatGPT) con llave', async () => {
  await withServer({}, async (call) => {
    assert.equal((await call('/anonymize', { body: { message: MSG } })).status, 401);
    const r = await call('/secureChatGPT', { key: KEYS.operador, body: { message: MSG } });
    assert.equal(r.status, 200);
    assert.match(r.body.finalResponse, /Pedro Pérez/);
    assert.match(r.body.finalResponse, /fraude/);
  });
});

test('auditoría sin PII, solo para auditor', async () => {
  await withServer({}, async (call) => {
    await call('/api/v1/secure-chat', { key: KEYS.operador, body: { message: MSG } });
    assert.equal((await call('/api/v1/audit', { method: 'GET', key: KEYS.operador })).status, 403);
    const a = await call('/api/v1/audit', { method: 'GET', key: KEYS.auditor });
    assert.equal(a.body.events[0].action, 'secure-chat');
    assert.ok(!JSON.stringify(a.body).includes('Pedro'));
    assert.equal(a.body.vault.DOC, 1);
  });
});
