const BASE = import.meta.env.VITE_API_URL || '';
export const ROLES = {
  visitante: { label: 'Visitante', key: '' },
  operador: { label: 'Operador de postventa', key: import.meta.env.VITE_OPERATOR_KEY || 'demo-operador' },
  auditor: { label: 'Auditor de datos', key: import.meta.env.VITE_AUDITOR_KEY || 'demo-auditor' },
};

export async function call(path, { role = 'visitante', method = 'POST', body } = {}) {
  const key = ROLES[role]?.key;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.mensaje || data.error || `Error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}
