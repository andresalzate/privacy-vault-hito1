// Repositorio intercambiable: memoria (demo/pruebas) o MongoDB (persistencia real).
// Solo guarda: token, tipo, valor CIFRADO, fechas. Nunca el valor en claro.

export function createMemoryRepository({ now = () => new Date() } = {}) {
  const items = new Map();
  return {
    kind: 'memory',
    async upsertMany(entries) {
      for (const e of entries) if (!items.has(e.token)) items.set(e.token, { ...e });
    },
    async findByTokens(tokens) {
      const out = new Map();
      const t = now();
      for (const tok of tokens) {
        const e = items.get(tok);
        if (e && (!e.expiresAt || e.expiresAt > t)) out.set(tok, e);
      }
      return out;
    },
    async countByType() {
      const c = {};
      for (const e of items.values()) c[e.type] = (c[e.type] || 0) + 1;
      return c;
    },
    async close() {},
    _items: items,
  };
}

export async function createMongoRepository({ uri, dbName, collection = 'vault_entries' }) {
  const { MongoClient } = await import('mongodb');
  const client = new MongoClient(uri);
  await client.connect();
  const col = client.db(dbName).collection(collection);
  await col.createIndex({ token: 1 }, { unique: true });
  await col.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // TTL: retención (Habeas Data)
  return {
    kind: 'mongodb',
    async upsertMany(entries) {
      if (!entries.length) return;
      await col.bulkWrite(
        entries.map((e) => ({ updateOne: { filter: { token: e.token }, update: { $setOnInsert: e }, upsert: true } })),
        { ordered: false },
      );
    },
    async findByTokens(tokens) {
      const docs = await col.find({ token: { $in: tokens }, expiresAt: { $gt: new Date() } }).toArray();
      return new Map(docs.map((d) => [d.token, d]));
    },
    async countByType() {
      const rows = await col.aggregate([{ $group: { _id: '$type', n: { $sum: 1 } } }]).toArray();
      return Object.fromEntries(rows.map((r) => [r._id, r.n]));
    },
    async close() {
      await client.close();
    },
  };
}
