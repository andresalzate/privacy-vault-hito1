// Resalta segmentos [start,end) con su tipo (vista previa de detección) o tokens TIPO_12hex.
export function HighlightSpans({ text, spans }) {
  const parts = [];
  let cursor = 0;
  spans.forEach((s, i) => {
    if (s.start > cursor) parts.push(<span key={`t${i}`}>{text.slice(cursor, s.start)}</span>);
    parts.push(<mark key={`m${i}`} className={`pii pii-${s.type}`} title={s.type}>{text.slice(s.start, s.end)}<sup>{s.type}</sup></mark>);
    cursor = s.end;
  });
  parts.push(<span key="end">{text.slice(cursor)}</span>);
  return <p className="mono-text">{parts}</p>;
}

const TOKEN = /\b(?:CARD|ACCOUNT|DOC|NIT|PASSPORT|EMAIL|PHONE|ADDRESS|NAME)_[a-f0-9]{12}\b/g;
export function HighlightTokens({ text }) {
  const out = [];
  let last = 0;
  for (const m of String(text).matchAll(TOKEN)) {
    out.push(text.slice(last, m.index));
    out.push(<code key={m.index} className={`token pii-${m[0].split('_')[0]}`}>{m[0]}</code>);
    last = m.index + m[0].length;
  }
  out.push(text.slice(last));
  return <p className="mono-text">{out}</p>;
}
