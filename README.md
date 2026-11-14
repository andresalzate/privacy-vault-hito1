# Privacy Vault v2 · Banco Andino (PoC · Hito 1)

Curso *Inteligencia Artificial para negocios digitales* (MAIT). Evolución del Privacy Vault del Taller 2 hacia la PoC del proyecto:
una capa que **detecta y tokeniza datos personales colombianos antes de enviar texto a un LLM**, y restaura la respuesta de forma controlada.

> Demostración con **datos ficticios**. No usar con datos reales sin revisión de seguridad y Habeas Data (Ley 1581 de 2012).

## Qué cambió frente al Taller 2

| Taller 2 | Privacy Vault v2 |
|---|---|
| Detectaba nombre, correo y teléfono | + cédula/TI/CE, NIT, pasaporte, **dirección**, **tarjeta (Luhn)**, cuenta bancaria, teléfono fijo e internacional |
| Cualquiera podía desanonimizar | Llaves por rol: visitante (solo detectar), operador (anonimizar, IA), auditor (restaurar, bitácora) |
| Cifrado opcional | AES-256-GCM obligatorio; tokens HMAC-SHA256 deterministas |
| Si la IA alteraba un token, se perdía el dato | Reparación de tokens + reporte de integridad (conservados, reparados, perdidos, inventados) |
| La respuesta final mostraba los datos completos | Respuesta al cliente con enmascaramiento (tarjeta ••••1111, CC ***050) |
| Sin control previo al envío | Verificación de fuga: si queda PII, no se envía a la IA (422) |
| Datos sin vencimiento | TTL de retención (`VAULT_TTL_DAYS`) |
| `openaiService.js` con Gemini dentro | Proveedores intercambiables: `mock`, `gemini`, `openai` |

## Estructura

```
backend/   Node.js + Express (ESM)
  src/detectors/   motor de detección de PII colombiana
  src/vault/       tokenizer (HMAC), crypto (AES-256-GCM), repositorios (memoria / MongoDB), vaultService
  src/llm/         proveedores de IA + instrucción de sistema
  src/routes/      API v1 + rutas del Taller 2 por compatibilidad
  test/            28 pruebas (node:test)
frontend/  React + Vite (consola de operador y auditor, 2 pruebas con Vitest)
```

## Ejecutar

```bash
# Terminal 1 – backend (http://localhost:3001)
cd backend
cp .env.example .env     # genere sus propios secretos; NO suba .env
npm install
npm start

# Terminal 2 – frontend (http://localhost:5173)
cd frontend
npm install
npm run dev
```

Sin `MONGODB_URI` usa memoria; sin llave de IA usa el proveedor `mock` (determinista, sin costo).
Para Gemini: `LLM_PROVIDER=gemini`, `GEMINI_API_KEY=...`, `LLM_MODEL=<modelo vigente>`.

## API

| Método y ruta | Rol (`x-api-key`) | Descripción |
|---|---|---|
| `GET /health` | — | Estado, almacenamiento y proveedor |
| `GET /api/v1/entity-types` | visitante | Tipos de dato protegidos |
| `POST /api/v1/detect` | visitante | Vista previa de detección, no guarda nada |
| `POST /api/v1/anonymize` | operador | `{message}` → `{anonymizedMessage, entities, stats, leakCheck}` |
| `POST /api/v1/secure-chat` | operador | Anonimiza → IA → integridad → restaura con enmascaramiento |
| `POST /api/v1/deanonymize` | auditor | Restaura el texto completo |
| `GET /api/v1/audit` | auditor | Bitácora sin PII y conteo de la bóveda |

Rutas del Taller 2 (`/anonymize`, `/deanonymize`, `/secureChatGPT`) siguen funcionando, ahora con llave.

Ejemplo en PowerShell:

```powershell
$h = @{ "x-api-key" = "demo-operador"; "Content-Type" = "application/json" }
$b = '{"message":"Soy María López, CC 1.020.304.050, tarjeta 4111 1111 1111 1111"}'
Invoke-RestMethod -Uri http://localhost:3001/api/v1/secure-chat -Method Post -Headers $h -Body $b
```

## Pruebas

```bash
cd backend && npm test     # 28 pruebas
cd frontend && npm test    # 2 pruebas
```

## Límites conocidos

- La detección es por reglas: los nombres se detectan por contexto y por una lista de nombres frecuentes, así que puede omitir nombres poco comunes sin palabra disparadora. El siguiente paso es un modelo NER en español.
- El repositorio MongoDB no tiene pruebas automáticas (requiere un servidor); el contrato se prueba con el repositorio en memoria.
- Tokens deterministas: permiten correlacionar el mismo dato entre solicitudes; es intencional para la IA, pero el secreto debe rotarse y protegerse.
- Las llaves por rol son una simplificación; en producción se integra el IdP del banco.
