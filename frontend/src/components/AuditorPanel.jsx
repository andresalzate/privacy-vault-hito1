import { useEffect, useState } from 'react';
import { call } from '../api.js';

export default function AuditorPanel({ role }) {
  const [tokens, setTokens] = useState('');
  const [restored, setRestored] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState('');

  const load = () => call('/api/v1/audit', { role, method: 'GET' }).then(setAudit).catch((e) => setError(e.message));
  useEffect(() => { if (role === 'auditor') load(); }, [role]);

  if (role !== 'auditor') return <p className="card alert alert-info">Esta vista requiere el rol <strong>Auditor de datos</strong>. Restaurar datos personales es una acción restringida y queda registrada.</p>;

  async function restore() {
    setError('');
    try { setRestored(await call('/api/v1/deanonymize', { role, body: { message: tokens } })); } catch (e) { setError(e.message); }
    load();
  }

  return (
    <section aria-label="Panel de auditoría">
      <div className="card">
        <h2>Restaurar un texto con tokens</h2>
        <textarea aria-label="Texto con tokens" value={tokens} onChange={(e) => setTokens(e.target.value)} placeholder="Pegue un texto que contenga tokens, p. ej. NAME_xxxxxxxxxxxx" />
        <div className="row"><button className="btn btn-primary" onClick={restore} disabled={!tokens.trim()}>Restaurar</button></div>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
        {restored && <p className="final">{restored.originalMessage} <br /><small className="muted">Restaurados: {restored.restored} · Desconocidos: {restored.unknownTokens.length}</small></p>}
      </div>
      <div className="card">
        <h2>Bitácora (sin datos personales)</h2>
        {audit && <p className="chips">{Object.entries(audit.vault).map(([t, n]) => <span key={t} className={`chip pii-${t}`}>{t}: {n} en bóveda</span>)}</p>}
        <table className="audit">
          <thead><tr><th>Hora</th><th>Rol</th><th>Acción</th><th>Detalle</th></tr></thead>
          <tbody>
            {audit?.events.map((e, i) => {
              const { at, role: r, action, ...rest } = e;
              return <tr key={i}><td>{new Date(at).toLocaleTimeString('es-CO')}</td><td>{r}</td><td>{action}</td><td><code>{JSON.stringify(rest)}</code></td></tr>;
            })}
          </tbody>
        </table>
        <button className="btn" onClick={load}>Actualizar</button>
      </div>
    </section>
  );
}
