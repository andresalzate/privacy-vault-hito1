import test from 'node:test';
import assert from 'node:assert/strict';
import { makeVault } from './helpers.js';
import { createCipher } from '../src/vault/crypto.js';

const MSG = 'Soy María López, CC 1.020.304.050, tarjeta 4111 1111 1111 1111, vivo en Calle 45 # 12-30. Escríbanme a maria@correo.com';

test('anonymize reemplaza toda la PII por tokens TIPO_12hex y pasa la verificación de fuga', async () => {
  const { vault } = makeVault();
  const a = await vault.anonymize(MSG);
  for (const v of ['María López', '1.020.304.050', '4111', 'Calle 45', 'maria@correo.com']) assert.ok(!a.anonymizedText.includes(v), v);
  assert.match(a.anonymizedText, /NAME_[a-f0-9]{12}/);
  assert.deepEqual(Object.keys(a.stats).sort(), ['ADDRESS', 'CARD', 'DOC', 'EMAIL', 'NAME']);
  assert.equal(a.leakCheck.ok, true);
});

test('el dato original se guarda CIFRADO (no aparece en claro en el repositorio)', async () => {
  const { vault, repo } = makeVault();
  await vault.anonymize(MSG);
  const dump = JSON.stringify([...repo._items.values()]);
  assert.ok(!dump.includes('1.020.304.050') && !dump.includes('maria@correo.com'));
});

test('ida y vuelta: deanonymize restaura exactamente el texto original', async () => {
  const { vault } = makeVault();
  const a = await vault.anonymize(MSG);
  const d = await vault.deanonymize(a.anonymizedText);
  assert.equal(d.restoredText, MSG);
  assert.equal(d.unknown.length, 0);
});

test('tokens deterministas: el mismo dato da el mismo token (con o sin formato)', async () => {
  const { vault } = makeVault();
  const a = await vault.anonymize('cel 310 555 1234');
  const b = await vault.anonymize('cel +57 3105551234');
  assert.equal(a.entities[0].token, b.entities[0].token);
});

test('repara tokens alterados por la IA (minúsculas, guion, corchetes)', async () => {
  const { vault } = makeVault();
  const a = await vault.anonymize('Soy María López');
  const tok = a.entities[0].token;
  const alterado = `Hola [${tok.toLowerCase().replace('_', '-')}]`;
  const d = await vault.deanonymize(alterado);
  assert.equal(d.restoredText, 'Hola María López');
  assert.equal(d.repaired.length, 1);
});

test('integridad: detecta tokens perdidos e inventados por la IA', async () => {
  const { vault } = makeVault();
  const a = await vault.anonymize('Soy María López, CC 79845123');
  const [n, doc] = a.entities.map((e) => e.token);
  const r = vault.integrity([n, doc], `Hola ${n}, su cédula es DOC_000000000000`);
  assert.equal(r.preserved, 1);
  assert.deepEqual(r.missing, [doc]);
  assert.deepEqual(r.invented, ['DOC_000000000000']);
});

test('retención: entradas vencidas (TTL) ya no se pueden restaurar', async () => {
  let ahora = new Date('2026-11-01T00:00:00Z');
  const { vault } = makeVault({ ttlDays: 1, now: () => ahora });
  const a = await vault.anonymize('CC 79845123');
  ahora = new Date('2026-11-03T00:00:00Z');
  const d = await vault.deanonymize(a.anonymizedText);
  assert.deepEqual(d.unknown, [a.entities[0].token]);
});

test('AES-256-GCM: cifra con IV aleatorio y detecta manipulación', () => {
  const c = createCipher('c'.repeat(64));
  const x = c.encrypt('dato'); const y = c.encrypt('dato');
  assert.notEqual(x, y);
  assert.equal(c.decrypt(x), 'dato');
  const [iv, tag, data] = x.split('.');
  const otro = Buffer.from(data, 'base64'); otro[0] ^= 1;
  assert.throws(() => c.decrypt(`${iv}.${tag}.${otro.toString('base64')}`));
});
