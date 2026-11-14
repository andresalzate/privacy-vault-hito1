// Cifrado del dato original en la bóveda con AES-256-GCM (corrección del Taller 2: antes era opcional).
import crypto from 'node:crypto';

function keyFrom(secret) {
  // Acepta 64 caracteres hex (32 bytes) o deriva 32 bytes con SHA-256 de cualquier texto largo.
  return /^[0-9a-f]{64}$/i.test(secret) ? Buffer.from(secret, 'hex') : crypto.createHash('sha256').update(secret).digest();
}

export function createCipher(secret) {
  const key = keyFrom(secret);
  return {
    encrypt(plain) {
      const iv = crypto.randomBytes(12);
      const c = crypto.createCipheriv('aes-256-gcm', key, iv);
      const enc = Buffer.concat([c.update(String(plain), 'utf8'), c.final()]);
      return `${iv.toString('base64')}.${c.getAuthTag().toString('base64')}.${enc.toString('base64')}`;
    },
    decrypt(payload) {
      const [iv, tag, data] = String(payload).split('.').map((x) => Buffer.from(x, 'base64'));
      const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
      d.setAuthTag(tag);
      return Buffer.concat([d.update(data), d.final()]).toString('utf8');
    },
  };
}
