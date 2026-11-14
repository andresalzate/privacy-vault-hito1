// Bitácora de auditoría SIN datos personales: quién, qué acción, cuántos datos de cada tipo.
export function createAuditLog({ max = 500, now = () => new Date() } = {}) {
  const events = [];
  return {
    record(event) {
      events.push({ at: now().toISOString(), ...event });
      if (events.length > max) events.shift();
    },
    list: () => [...events].reverse(),
  };
}
