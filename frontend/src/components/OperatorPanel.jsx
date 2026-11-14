import { useState } from 'react';
import { call } from '../api.js';
import { SAMPLES } from '../samples.js';
import { HighlightSpans, HighlightTokens } from './Highlight.jsx';

export default function OperatorPanel({ role }) {
  const [text, setText] = useState(SAMPLES[0].text);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  async function run(kind) {
    setBusy(kind); setError('');
    try {
      if (kind === 'detect') {
        const r = await call('/api/v1/detect', { role, body: { message: text } });
        setPreview({ text, spans: r.entities }); setResult(null);
      } else if (kind === 'anonymize') {
        const r = await call('/api/v1/anonymize', { role, body: { message: text } });
        setResult({ anonymizedMessage: r.anonymizedMessage, entities: r.entities, leakCheck: r.leakCheck });
      } else {
        const r = await call('/api/v1/secure-chat', { role, body: { message: text } });
        setResult(r);
      }
    } catch (e) {
      setError(e.status === 401 ? 'Como visitante solo puedes detectar. Cambia al rol Operador para anonimizar o consultar la IA.' : e.message);
    } finally { setBusy(''); }
  }

  const counts = result?.entities?.reduce((c, e) => ({ ...c, [e.type]: (c[e.type] || 0) + 1 }), {});

  return (
    <section aria-label="Panel de anonimización">
      <div className="card">
        <h2>Solicitud del cliente</h2>
        <div className="chips">
          {SAMPLES.map((s) => <button key={s.label} className="chip-btn" onClick={() => { setText(s.text); setPreview(null); setResult(null); }}>{s.label}</button>)}
        </div>
        <label className="field">
          <span>Texto (datos ficticios)</span>
          <textarea aria-label="Texto de la solicitud" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
        </label>
        <div className="row">
          <button className="btn" onClick={() => run('detect')} disabled={!!busy}>{busy === 'detect' ? 'Detectando…' : '1. Detectar datos personales'}</button>
          <button className="btn" onClick={() => run('anonymize')} disabled={!!busy}>{busy === 'anonymize' ? 'Anonimizando…' : '2. Anonimizar'}</button>
          <button className="btn btn-primary" onClick={() => run('chat')} disabled={!!busy}>{busy === 'chat' ? 'Consultando…' : '3. Consulta segura con IA'}</button>
        </div>
        {error && <p role="alert" className="alert alert-danger">{error}</p>}
      </div>

      {preview && (
        <div className="card">
          <h3>Datos personales detectados ({preview.spans.length})</h3>
          <p className="muted">Vista previa: no se guarda nada en la bóveda.</p>
          <HighlightSpans text={preview.text} spans={preview.spans} />
        </div>
      )}

      {result && (
        <div className="card">
          <h3>Lo que recibe la IA (anonimizado)</h3>
          <div className="chips">
            {Object.entries(counts || {}).map(([t, n]) => <span key={t} className={`chip pii-${t}`}>{t} × {n}</span>)}
            <span className={`chip ${result.leakCheck?.ok === false ? 'chip-danger' : 'chip-ok'}`}>{result.leakCheck?.ok === false ? 'Posible fuga' : 'Verificación de fuga: OK'}</span>
          </div>
          <HighlightTokens text={result.anonymizedMessage} />
        </div>
      )}

      {result?.aiResponse && (
        <>
          <div className="card">
            <h3>Respuesta de la IA (con tokens) <small className="muted">· {result.provider.name} / {result.provider.model}</small></h3>
            <HighlightTokens text={result.aiResponse} />
            <div className="chips">
              <span className="chip">Tokens enviados: {result.integrity.sent}</span>
              <span className="chip chip-ok">Conservados: {result.integrity.preserved}</span>
              <span className="chip">Reparados: {result.integrity.repaired}</span>
              <span className={`chip ${result.integrity.invented.length ? 'chip-danger' : ''}`}>Inventados: {result.integrity.invented.length}</span>
            </div>
          </div>
          <div className="card ok">
            <h3>Respuesta final para el cliente (datos restaurados)</h3>
            <p className="final">{result.finalResponse}</p>
          </div>
        </>
      )}
    </section>
  );
}
