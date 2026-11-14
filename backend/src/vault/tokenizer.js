// Tokens deterministas: TIPO_ + 12 hex de HMAC-SHA256(secreto, tipo:valor normalizado).
// El mismo dato produce el mismo token (la IA puede razonar sobre "el mismo cliente" sin verlo).
import crypto from 'node:crypto';
import { ENTITY_TYPES } from '../detectors/index.js';

const NUMERIC = new Set(['CARD', 'ACCOUNT', 'DOC', 'NIT', 'PHONE']);

export function normalize(type, value) {
  const v = String(value).trim();
  if (NUMERIC.has(type)) {
    const digits = v.replace(/\D/g, '');
    return type === 'PHONE' && digits.length === 12 && digits.startsWith('57') ? digits.slice(2) : digits;
  }
  if (type === 'EMAIL' || type === 'PASSPORT') return v.toLowerCase();
  return v.replace(/\s+/g, ' ').toLowerCase();
}

export function createTokenizer(secret) {
  return (type, value) => {
    const h = crypto.createHmac('sha256', secret).update(`${type}:${normalize(type, value)}`).digest('hex');
    return `${type}_${h.slice(0, 12)}`;
  };
}

const TYPES = Object.keys(ENTITY_TYPES).join('|');
// Token exacto.
export const TOKEN_RE = new RegExp(`\\b(?:${TYPES})_[a-f0-9]{12}\\b`, 'g');
// Variantes que un LLM suele producir: minúsculas, guion, espacios, corchetes o llaves alrededor.
export const TOKEN_VARIANT_RE = new RegExp(`(?:[\\[{<(]\\s*)?\\b(${TYPES})\\s?[-_ ]\\s?([a-f0-9]{12})\\b(?:\\s*[\\]}>)])?`, 'gi');
