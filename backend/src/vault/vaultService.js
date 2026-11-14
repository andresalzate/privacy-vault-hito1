// Orquesta detección -> tokenización -> almacenamiento cifrado, y la restauración segura.
import { detectPII } from '../detectors/index.js';
import { createCipher } from './crypto.js';
import { createTokenizer, TOKEN_RE, TOKEN_VARIANT_RE } from './tokenizer.js';

export function createVaultService({ repo, tokenSecret, encryptionKey, ttlDays = 30, now = () => new Date() }) {
  const tokenOf = createTokenizer(tokenSecret);
  const cipher = createCipher(encryptionKey);

  // Solo detecta (para visitantes): no guarda nada.
  function preview(text) {
    return detectPII(text).map(({ type, start, end }) => ({ type, start, end, length: end - start }));
  }

  async function anonymize(text) {
    const entities = detectPII(text);
    const created = now();
    const expiresAt = new Date(created.getTime() + ttlDays * 86400000);
    let out = '';
    let cursor = 0;
    const entries = new Map();
    const found = [];
    for (const e of entities) {
      const token = tokenOf(e.type, e.value);
      out += text.slice(cursor, e.start) + token;
      cursor = e.end;
      found.push({ type: e.type, token });
      if (!entries.has(token)) entries.set(token, { token, type: e.type, valueEnc: cipher.encrypt(e.value), createdAt: created, expiresAt });
    }
    out += text.slice(cursor);
    await repo.upsertMany([...entries.values()]);
    // Verificación de fuga: el texto anonimizado no debe contener PII detectable fuera de los tokens.
    const residual = detectPII(out.replace(TOKEN_RE, ' ')).map((r) => r.type);
    return { anonymizedText: out, entities: found, stats: countTypes(found), leakCheck: { ok: residual.length === 0, residualTypes: residual } };
  }

  // Normaliza variantes de tokens alteradas por un LLM (p. ej. "[name-C8A90A092E8D]") a su forma exacta.
  function repairTokens(text) {
    const repaired = [];
    const fixed = String(text).replace(TOKEN_VARIANT_RE, (match, type, hex) => {
      const canonical = `${type.toUpperCase()}_${hex.toLowerCase()}`;
      if (match !== canonical) repaired.push({ from: match, to: canonical });
      return canonical;
    });
    return { text: fixed, repaired };
  }

  // mask=true: para respuestas al cliente, los datos financieros/de identidad se muestran parcialmente.
  async function deanonymize(text, { placeholderForUnknown = null, mask = false } = {}) {
    const { text: fixed, repaired } = repairTokens(text);
    const tokens = [...new Set(fixed.match(TOKEN_RE) || [])];
    const found = tokens.length ? await repo.findByTokens(tokens) : new Map();
    const unknown = tokens.filter((t) => !found.has(t));
    const restoredText = fixed.replace(TOKEN_RE, (t) => {
      const e = found.get(t);
      if (e) {
        const plain = cipher.decrypt(e.valueEnc);
        return mask ? maskValue(e.type, plain) : plain;
      }
      return placeholderForUnknown ?? t;
    });
    return { restoredText, restored: tokens.length - unknown.length, unknown, repaired };
  }

  // Compara los tokens enviados al LLM con los que volvieron (HU-04: integridad de tokens).
  function integrity(sentTokens, aiText) {
    const { text: fixed, repaired } = repairTokens(aiText);
    const returned = new Set(fixed.match(TOKEN_RE) || []);
    const sent = new Set(sentTokens);
    return {
      sent: sent.size,
      preserved: [...sent].filter((t) => returned.has(t)).length,
      repaired: repaired.length,
      missing: [...sent].filter((t) => !returned.has(t)),
      invented: [...returned].filter((t) => !sent.has(t)),
    };
  }

  return { preview, anonymize, deanonymize, integrity, repairTokens, stats: () => repo.countByType() };
}

const MASK_LAST = { CARD: 4, ACCOUNT: 4, DOC: 3, NIT: 3, PASSPORT: 3 };
export function maskValue(type, value) {
  const n = MASK_LAST[type];
  if (!n) return value;
  const clean = String(value).replace(/[^0-9A-Za-z]/g, '');
  return `${type === 'CARD' || type === 'ACCOUNT' ? '••••' : '***'}${clean.slice(-n)}`;
}

export function countTypes(list) {
  const c = {};
  for (const e of list) c[e.type] = (c[e.type] || 0) + 1;
  return c;
}
