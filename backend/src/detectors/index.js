// Motor de detección de PII colombiana (HU-01 · BA-PV-01).
// Cada detector devuelve candidatos {type, value, start, end, priority}. Luego se resuelven solapamientos.
// Son reglas (regex + validaciones), no un modelo: tienen límites documentados en el README.

export const ENTITY_TYPES = {
  CARD: 'Tarjeta débito/crédito (13-19 dígitos, valida Luhn)',
  ACCOUNT: 'Número de cuenta bancaria (con contexto: "cuenta", "cta")',
  DOC: 'Documento de identidad: cédula (CC), tarjeta de identidad (TI), cédula de extranjería (CE)',
  NIT: 'NIT de persona jurídica o natural',
  PASSPORT: 'Pasaporte',
  EMAIL: 'Correo electrónico',
  PHONE: 'Teléfono colombiano (celular o fijo 60X) o internacional',
  ADDRESS: 'Dirección colombiana (Calle, Carrera, Avenida, Diagonal, Transversal...)',
  NAME: 'Nombre de persona (heurística por contexto y nombres frecuentes)',
};

// Prioridad menor = gana en un solapamiento.
const P = { CARD: 1, EMAIL: 2, ACCOUNT: 3, NIT: 3, DOC: 3, PASSPORT: 3, ADDRESS: 4, PHONE: 5, DOC_DOTTED: 6, NAME: 7 };

export function luhnValid(digits) {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return digits.length >= 13 && digits.length <= 19 && sum % 10 === 0;
}

// Ejecuta un regex global; si tiene el grupo nombrado "v", solo ese grupo es el dato.
function scan(text, re, type, priority, accept = () => true) {
  const out = [];
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    const value = m.groups?.v ?? m[0];
    const offset = m.groups?.v !== undefined ? m[0].lastIndexOf(value) : 0;
    const start = m.index + offset;
    const cand = { type, value, start, end: start + value.length, priority };
    if (accept(cand, text)) out.push(cand);
    if (m[0].length === 0) re.lastIndex += 1;
  }
  return out;
}

const UP = 'A-ZÁÉÍÓÚÑ';
const LOW = 'a-záéíóúüñ';

const RE = {
  email: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  card: /(?<![\d-])(?:\d[ -]?){12,18}\d(?![\d-])/g,
  account: new RegExp(`(?:cuenta(?:\\s+de)?(?:\\s+(?:ahorros?|corriente|n[óo]mina))?|cta\\.?(?:\\s+(?:ahorros?|cte\\.?))?)\\s*(?:No\\.?|n[úu]mero|nro\\.?|#|:)?\\s*(?<v>\\d[\\d-]{5,18}\\d)(?![\\d])`, 'gi'),
  nit: /\bNIT\.?\s*(?:No\.?|n[úu]mero|:)?\s*(?<v>\d{3}\.?\d{3}\.?\d{3}\s*-?\s*\d)\b/gi,
  doc: new RegExp(`(?:\\bc\\.\\s?c\\.?|\\bcc\\b|\\bc[ée]dula(?:\\s+de\\s+(?:ciudadan[íi]a|extranjer[íi]a))?|\\bdocumento(?:\\s+de\\s+identidad)?|\\bidentificaci[óo]n|\\bt\\.\\s?i\\.?|\\btarjeta\\s+de\\s+identidad|\\bc\\.\\s?e\\.)\\s*(?:No\\.?|n[úu]mero|nro\\.?|#|:)?\\s*(?<v>\\d{1,3}(?:[.\\s]?\\d{3}){1,3}|\\d{6,11})(?![\\d])`, 'gi'),
  docDotted: /(?<![\d.$])\d{1,3}(?:\.\d{3}){2,3}(?![\d.])/g,
  passport: /\bpasaporte\s*(?:No\.?|n[úu]mero|nro\.?|#|:)?\s*(?<v>[A-Z]{1,3}\d{5,9})\b/gi,
  phone: /(?<![\w+])(?:\+?57[\s-]?)?(?:3\d{2}|60[1-8])[\s-]?\d{3}[\s-]?\d{4}(?!\d)/g,
  phoneIntl: /(?<![\w])\+(?!57)\d{1,3}[\s-]?\d{2,4}[\s-]?\d{3,4}[\s-]?\d{3,4}(?!\d)/g,
  address: new RegExp(
    `\\b(?:calle|cl\\.?|carrera|cra\\.?|kr\\.?|cr\\.?|avenida(?:\\s+calle|\\s+carrera)?|av\\.?|diagonal|dg\\.?|transversal|tv\\.?|autopista|circular)\\s+\\d{1,3}\\s?[A-Za-z]?(?:\\s*bis)?(?:\\s+(?:sur|norte|este))?\\s*(?:#|No\\.?|n[úu]mero|N°)\\s*\\d{1,3}\\s?[A-Za-z]?\\s*-\\s*\\d{1,3}(?:\\s+(?:sur|norte|este))?(?:[,\\s]+(?:apto\\.?|apartamento|casa|torre|int\\.?|interior|oficina|of\\.?|bloque)\\s*[\\w-]+)*`,
    'gi',
  ),
  nameSeq: new RegExp(`[${UP}][${LOW}]+(?:\\s+(?:de\\s+(?:la\\s+|los\\s+)?|del\\s+)?[${UP}][${LOW}]+){0,3}`, 'g'),
};

const NAME_TRIGGERS = new RegExp(
  `(?:me\\s+llamo|mi\\s+nombre\\s+es|soy|nombre(?:\\s+completo)?\\s*:|cliente\\s*:|titular\\s*:|se[ñn]ora?|sr\\.?|sra\\.?|don|doña|para|de\\s+parte\\s+de|a\\s+nombre\\s+de|mi\\s+(?:esposa?|hij[oa]|mam[áa]|pap[áa]|herman[oa])|atentamente|cordialmente)[\\s,:]*$`,
  'i',
);

// Nombres frecuentes en Colombia (lista corta; ampliable). Sirve cuando no hay palabra disparadora.
const COMMON_FIRST = new Set(
  'juan josé jose luis carlos andrés andres jorge diego miguel david daniel alejandro fernando pedro santiago sebastián sebastian camilo felipe javier ricardo óscar oscar manuel julián julian mauricio hernán hernan dago maría maria ana luisa laura carolina paula diana angela ángela sandra claudia andrea natalia valentina daniela catalina juliana marcela patricia gloria martha marta liliana adriana lucía lucia sofía sofia isabel gabriela'
    .split(' '),
);

// Palabras que preceden a un nombre; si inician la secuencia capitalizada se quitan y cuentan como disparador.
const TRIGGER_WORDS = new Set('soy atentamente cordialmente cliente titular señor señora sr sra don doña para nombre'.split(' '));

const NOT_NAMES = new Set(
  'banco andino bogotá bogota medellín medellin cali colombia calle carrera avenida diagonal transversal visa mastercard nequi daviplata pse enero febrero marzo abril mayo junio julio agosto septiembre octubre noviembre diciembre lunes martes miércoles jueves viernes sábado domingo hola buenos buenas gracias señor señora cliente cuenta tarjeta nit pasaporte cédula cedula'
    .split(' '),
);

function nameCandidates(text) {
  const out = [];
  for (const c of scan(text, RE.nameSeq, 'NAME', P.NAME)) {
    const words = c.value.split(/\s+/).filter((w) => !/^(de|del|la|los)$/i.test(w));
    // Quita palabras iniciales que no son nombres (p. ej. "Hola Ana" -> "Ana").
    let value = c.value;
    let start = c.start;
    let strippedTrigger = false;
    while (words.length && (NOT_NAMES.has(words[0].toLowerCase()) || TRIGGER_WORDS.has(words[0].toLowerCase().replace('.', '')))) {
      const w = words.shift();
      if (TRIGGER_WORDS.has(w.toLowerCase().replace('.', ''))) strippedTrigger = true;
      const idx = value.indexOf(w) + w.length;
      const rest = value.slice(idx);
      const trimmed = rest.replace(/^\s+(?:(?:de\s+(?:la\s+|los\s+)?|del\s+))?/i, '');
      start += value.length - trimmed.length;
      value = trimmed;
    }
    if (!words.length || words.some((w) => NOT_NAMES.has(w.toLowerCase()))) continue;
    const before = text.slice(Math.max(0, start - 30), start);
    const triggered = strippedTrigger || NAME_TRIGGERS.test(before);
    const common = COMMON_FIRST.has(words[0].toLowerCase());
    // Reglas: con palabra disparadora se acepta 1+ palabras; sin ella, solo si empieza por un nombre frecuente.
    // Se prefiere un falso positivo (ocultar de más) a una fuga de datos.
    if (triggered || common) {
      out.push({ type: 'NAME', value, start, end: start + value.length, priority: P.NAME });
    }
  }
  return out;
}

function notMoney(c, text) {
  const before = text.slice(Math.max(0, c.start - 6), c.start);
  const after = text.slice(c.end, c.end + 12).toLowerCase();
  return !/\$\s*$|cop\s*$|usd\s*$/i.test(before) && !/^\s*(pesos|cop|usd|mil|millones|de pesos)/.test(after);
}

export function collectCandidates(text) {
  const t = String(text ?? '');
  return [
    ...scan(t, RE.card, 'CARD', P.CARD, (c) => luhnValid(c.value.replace(/\D/g, ''))),
    ...scan(t, RE.email, 'EMAIL', P.EMAIL),
    ...scan(t, RE.account, 'ACCOUNT', P.ACCOUNT),
    ...scan(t, RE.nit, 'NIT', P.NIT),
    ...scan(t, RE.doc, 'DOC', P.DOC),
    ...scan(t, RE.passport, 'PASSPORT', P.PASSPORT),
    ...scan(t, RE.address, 'ADDRESS', P.ADDRESS),
    ...scan(t, RE.phone, 'PHONE', P.PHONE),
    ...scan(t, RE.phoneIntl, 'PHONE', P.PHONE),
    ...scan(t, RE.docDotted, 'DOC', P.DOC_DOTTED, notMoney),
    ...nameCandidates(t),
  ];
}

// Resuelve solapamientos: gana menor prioridad y, a igualdad, el más largo.
export function resolveOverlaps(cands) {
  const sorted = [...cands].sort((a, b) => a.priority - b.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start);
  const chosen = [];
  for (const c of sorted) {
    if (!chosen.some((k) => c.start < k.end && k.start < c.end)) chosen.push(c);
  }
  return chosen.sort((a, b) => a.start - b.start).map(({ priority, ...rest }) => rest);
}

export function detectPII(text) {
  return resolveOverlaps(collectCandidates(text));
}
