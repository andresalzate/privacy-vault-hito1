import test from 'node:test';
import assert from 'node:assert/strict';
import { detectPII, luhnValid } from '../src/detectors/index.js';

const types = (t) => detectPII(t).map((e) => `${e.type}:${e.value}`);

test('caso base del Taller 2: nombre, correo y teléfono', () => {
  assert.deepEqual(types('oferta de trabajo para Dago Borda con email dborda@gmail.com y teléfono 3152319157'),
    ['NAME:Dago Borda', 'EMAIL:dborda@gmail.com', 'PHONE:3152319157']);
});

test('retro Taller 2: documentos de identidad (CC con y sin puntos, TI, CE)', () => {
  assert.ok(types('mi cédula es 1.020.304.050').includes('DOC:1.020.304.050'));
  assert.ok(types('CC 79845123').includes('DOC:79845123'));
  assert.ok(types('cédula de extranjería: 4567890').includes('DOC:4567890'));
  assert.ok(types('T.I. 1001234567').includes('DOC:1001234567'));
});

test('retro Taller 2: direcciones colombianas', () => {
  assert.ok(types('vivo en la Calle 45 # 12-30 apto 501, Bogotá').includes('ADDRESS:Calle 45 # 12-30 apto 501'));
  assert.ok(types('Carrera 7 No. 32-16 sur').includes('ADDRESS:Carrera 7 No. 32-16 sur'));
  assert.ok(types('Transversal 5 bis # 10A-20').includes('ADDRESS:Transversal 5 bis # 10A-20'));
  assert.ok(types('Av. 68 # 22-41').includes('ADDRESS:Av. 68 # 22-41'));
});

test('retro Taller 2: tarjetas bancarias con validación Luhn', () => {
  assert.ok(types('tarjeta 4111 1111 1111 1111').includes('CARD:4111 1111 1111 1111'));
  assert.ok(types('pan 5500-0000-0000-0004').includes('CARD:5500-0000-0000-0004'));
  assert.equal(luhnValid('1234567890123456'), false);
  assert.ok(!types('ref 1234 5678 9012 3456').some((x) => x.startsWith('CARD')));
});

test('cuentas, NIT, pasaporte y teléfonos fijo/internacional', () => {
  const t = types('cuenta de ahorros No. 123-456789-01, NIT 900.123.456-7, pasaporte AB123456, fijo 601 345 6789, +1 305 555 0101, cel +57 310 555 1234');
  for (const e of ['ACCOUNT:123-456789-01', 'NIT:900.123.456-7', 'PASSPORT:AB123456', 'PHONE:601 345 6789', 'PHONE:+1 305 555 0101', 'PHONE:+57 310 555 1234']) {
    assert.ok(t.includes(e), `${e} en ${t}`);
  }
});

test('los montos en pesos NO se confunden con cédulas', () => {
  assert.deepEqual(types('me cobraron $1.250.000 y luego 2.400.000 pesos'), []);
});

test('nombres: con palabra disparadora, nombres frecuentes, y sin falsos positivos de lugares', () => {
  assert.ok(types('Atentamente, Luisa Aragon').includes('NAME:Luisa Aragon'));
  assert.ok(types('Juan no reconoce el cobro').includes('NAME:Juan'));
  assert.ok(types('mi nombre es Xiomara Quintero').includes('NAME:Xiomara Quintero'));
  assert.deepEqual(types('Banco Andino en Bogotá'), []);
});

test('sin PII no hay hallazgos', () => {
  assert.deepEqual(detectPII('No reconozco este cobro, por favor revisen.'), []);
});
