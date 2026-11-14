// Visitante (sin llave) vs usuario logueado (llave por rol). Corrección: en el Taller 2 cualquiera podía desanonimizar.
export function authenticate(apiKeys) {
  const byKey = Object.fromEntries(Object.entries(apiKeys).map(([role, key]) => [key, role]));
  return (req, _res, next) => {
    const key = req.header('x-api-key');
    req.role = (key && byKey[key]) || 'visitante';
    next();
  };
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (req.role === 'visitante') return res.status(401).json({ error: 'no_autenticado', mensaje: 'Envíe una llave válida en el header x-api-key.' });
    if (!roles.includes(req.role)) return res.status(403).json({ error: 'rol_no_autorizado', mensaje: `Requiere rol: ${roles.join(' o ')}.` });
    next();
  };
}
