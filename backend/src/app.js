import express from 'express';
import cors from 'cors';
import { authenticate } from './middleware/auth.js';
import { apiRouter } from './routes/api.js';
import { createAuditLog } from './audit.js';

export function createApp({ vault, provider, apiKeys, corsOrigin = '*', audit = createAuditLog(), repoKind = 'memory' }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: corsOrigin }));
  app.use(express.json({ limit: '20kb' }));
  app.use(authenticate(apiKeys));

  app.get('/health', (_req, res) => res.json({ status: 'ok', storage: repoKind, provider: provider.name }));
  app.use('/api/v1', apiRouter({ vault, provider, audit }));

  // Rutas del Taller 2 conservadas por compatibilidad (ahora exigen llave).
  app.post('/anonymize', (req, res, next) => { req.url = '/api/v1/anonymize'; app.handle(req, res, next); });
  app.post('/deanonymize', (req, res, next) => { req.url = '/api/v1/deanonymize'; app.handle(req, res, next); });
  app.post('/secureChatGPT', (req, res, next) => { req.url = '/api/v1/secure-chat'; app.handle(req, res, next); });

  app.use((_req, res) => res.status(404).json({ error: 'no_encontrado' }));
  // Errores sin filtrar datos ni trazas.
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    const bad = err.type === 'entity.parse.failed';
    if (!bad) console.error('[error]', err.message);
    res.status(bad ? 400 : 500).json({ error: bad ? 'json_invalido' : 'error_interno' });
  });
  return app;
}
