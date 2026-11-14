import 'dotenv/config';
import crypto from 'node:crypto';

const warnings = [];

function secret(name, bytes = 32) {
  const v = process.env[name];
  if (v && v.length >= 32) return v;
  warnings.push(`${name} no está definido: se generó uno temporal (solo demo; los tokens cambian al reiniciar).`);
  return crypto.randomBytes(bytes).toString('hex');
}

export function loadConfig(env = process.env) {
  return {
    port: Number(env.PORT || 3001),
    corsOrigin: env.CORS_ORIGIN || 'http://localhost:5173',
    tokenSecret: secret('TOKEN_SECRET'),
    encryptionKey: secret('VAULT_ENCRYPTION_KEY'),
    apiKeys: {
      operador: env.OPERATOR_API_KEY || 'demo-operador',
      auditor: env.AUDITOR_API_KEY || 'demo-auditor',
    },
    mongo: { uri: env.MONGODB_URI || '', db: env.MONGODB_DB || 'privacy_vault' },
    ttlDays: Number(env.VAULT_TTL_DAYS || 30),
    llm: {
      provider: (env.LLM_PROVIDER || 'mock').toLowerCase(),
      model: env.LLM_MODEL || '',
      geminiKey: env.GEMINI_API_KEY || '',
      openaiKey: env.OPENAI_API_KEY || '',
      timeoutMs: Number(env.LLM_TIMEOUT_MS || 15000),
    },
    warnings,
  };
}
