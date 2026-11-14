import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createMemoryRepository, createMongoRepository } from './vault/repositories.js';
import { createVaultService } from './vault/vaultService.js';
import { createProvider } from './llm/providers.js';

const config = loadConfig();
const repo = config.mongo.uri
  ? await createMongoRepository({ uri: config.mongo.uri, dbName: config.mongo.db })
  : createMemoryRepository();
const vault = createVaultService({ repo, tokenSecret: config.tokenSecret, encryptionKey: config.encryptionKey, ttlDays: config.ttlDays });
const provider = createProvider(config.llm);
const app = createApp({ vault, provider, apiKeys: config.apiKeys, corsOrigin: config.corsOrigin, repoKind: repo.kind });

for (const w of config.warnings) console.warn(`[aviso] ${w}`);
if (!process.env.OPERATOR_API_KEY) console.warn('[aviso] Usando llaves de demostración: operador="demo-operador", auditor="demo-auditor".');
app.listen(config.port, () => {
  console.log(`Privacy Vault v2 en http://localhost:${config.port} | almacenamiento: ${repo.kind} | IA: ${provider.name} (${provider.model})`);
});
process.on('SIGINT', async () => { await repo.close(); process.exit(0); });
