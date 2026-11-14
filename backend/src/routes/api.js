import { Router } from 'express';
import { ENTITY_TYPES } from '../detectors/index.js';
import { requireRole } from '../middleware/auth.js';

const MAX = 5000;

function readMessage(req, res) {
  const { message } = req.body || {};
  if (typeof message !== 'string' || !message.trim()) {
    res.status(400).json({ error: 'mensaje_invalido', mensaje: 'El campo "message" es obligatorio y debe ser texto.' });
    return null;
  }
  if (message.length > MAX) {
    res.status(413).json({ error: 'mensaje_muy_largo', mensaje: `Máximo ${MAX} caracteres.` });
    return null;
  }
  return message;
}

export function apiRouter({ vault, provider, audit }) {
  const r = Router();

  // Visitante: catálogo de tipos y vista previa sin almacenamiento.
  r.get('/entity-types', (_req, res) => res.json({ types: ENTITY_TYPES }));
  r.post('/detect', (req, res) => {
    const message = readMessage(req, res);
    if (message === null) return;
    const entities = vault.preview(message);
    audit.record({ role: req.role, action: 'detect', entities: entities.length });
    res.json({ entities, stored: false });
  });

  r.post('/anonymize', requireRole('operador'), async (req, res, next) => {
    try {
      const message = readMessage(req, res);
      if (message === null) return;
      const a = await vault.anonymize(message);
      audit.record({ role: req.role, action: 'anonymize', types: a.stats });
      res.json({ anonymizedMessage: a.anonymizedText, entities: a.entities, stats: a.stats, leakCheck: a.leakCheck });
    } catch (e) {
      next(e);
    }
  });

  r.post('/deanonymize', requireRole('auditor'), async (req, res, next) => {
    try {
      const message = readMessage(req, res);
      if (message === null) return;
      const d = await vault.deanonymize(message);
      audit.record({ role: req.role, action: 'deanonymize', restored: d.restored, unknown: d.unknown.length });
      res.json({ originalMessage: d.restoredText, restored: d.restored, unknownTokens: d.unknown, repairedTokens: d.repaired });
    } catch (e) {
      next(e);
    }
  });

  // Flujo completo: anonimizar -> IA -> verificar integridad -> restaurar.
  r.post('/secure-chat', requireRole('operador'), async (req, res, next) => {
    try {
      const message = readMessage(req, res);
      if (message === null) return;
      const a = await vault.anonymize(message);
      if (!a.leakCheck.ok) {
        audit.record({ role: req.role, action: 'secure-chat-bloqueado', residual: a.leakCheck.residualTypes });
        return res.status(422).json({ error: 'posible_fuga', mensaje: 'El texto conserva datos personales tras anonimizar; no se envió a la IA.', residualTypes: a.leakCheck.residualTypes });
      }
      let aiResponse;
      try {
        aiResponse = await provider.generate(a.anonymizedText);
      } catch (err) {
        audit.record({ role: req.role, action: 'secure-chat-error-ia', provider: provider.name });
        return res.status(502).json({ error: 'proveedor_ia_no_disponible', mensaje: err.name === 'AbortError' ? 'La IA no respondió a tiempo.' : 'El proveedor de IA falló.', anonymizedMessage: a.anonymizedText });
      }
      const integrity = vault.integrity(a.entities.map((e) => e.token), aiResponse);
      const d = await vault.deanonymize(aiResponse, { placeholderForUnknown: '[dato no disponible]', mask: true });
      audit.record({ role: req.role, action: 'secure-chat', provider: provider.name, types: a.stats, missing: integrity.missing.length, invented: integrity.invented.length, repaired: integrity.repaired });
      res.json({
        anonymizedMessage: a.anonymizedText,
        aiResponse,
        finalResponse: d.restoredText,
        entities: a.entities,
        integrity,
        provider: { name: provider.name, model: provider.model },
      });
    } catch (e) {
      next(e);
    }
  });

  r.get('/audit', requireRole('auditor'), async (_req, res) => res.json({ events: audit.list(), vault: await vault.stats() }));

  return r;
}
