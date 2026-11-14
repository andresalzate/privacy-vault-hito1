import { createApp } from '../src/app.js';
import { createMemoryRepository } from '../src/vault/repositories.js';
import { createVaultService } from '../src/vault/vaultService.js';
import { mockProvider } from '../src/llm/providers.js';

export const KEYS = { operador: 'k-op', auditor: 'k-aud' };
export const SECRET = 'a'.repeat(64);
export const ENC = 'b'.repeat(64);

export function makeVault(opts = {}) {
  const repo = createMemoryRepository(opts);
  return { repo, vault: createVaultService({ repo, tokenSecret: SECRET, encryptionKey: ENC, ...opts }) };
}

export async function withServer({ provider = mockProvider() } = {}, fn) {
  const { vault, repo } = makeVault();
  const app = createApp({ vault, provider, apiKeys: KEYS });
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, { key, method = 'POST', body } = {}) => {
    const res = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(call, repo); } finally { server.close(); }
}
