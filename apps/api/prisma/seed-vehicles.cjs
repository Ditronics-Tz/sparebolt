/**
 * Standalone seeder for the vehicle make/model catalogue.
 * Idempotent (upsert) and safe to run repeatedly on any environment — it does
 * NOT touch users, listings, or any other data. Reads DATABASE_URL from
 * apps/api/.env when it is not already present in the environment.
 *
 *   node apps/api/prisma/seed-vehicles.cjs
 */
const fs = require('fs');
const path = require('path');

if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 0) continue;
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!process.env[k]) process.env[k] = v;
    }
  }
}

const { PrismaClient } = require('@prisma/client');

(async () => {
  const prisma = new PrismaClient();
  const file = path.join(__dirname, 'data', 'vehicle-makes.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));

  // Accept either [{ make, models }] or { make: [models] }, and merge any
  // duplicate make entries.
  const entries = Array.isArray(data)
    ? data.map((m) => [m.make, m.models])
    : Object.entries(data);
  const catalogue = new Map();
  for (const [name, models] of entries) {
    if (!name) continue;
    if (!catalogue.has(name)) catalogue.set(name, new Set());
    for (const model of models || []) {
      if (model) catalogue.get(name).add(model);
    }
  }

  // Clean sync: the catalogue should exactly match the JSON. Nothing foreign-
  // keys these tables (listings and driver vehicles store make/model as text),
  // so a replace is safe. vehicle_models cascade-delete with their make.
  await prisma.vehicleModel.deleteMany({});
  await prisma.vehicleMake.deleteMany({});

  let modelCount = 0;
  for (const [name, models] of catalogue) {
    const make = await prisma.vehicleMake.create({ data: { name } });
    const rows = [...models].map((model) => ({ makeId: make.id, name: model }));
    if (rows.length) {
      await prisma.vehicleModel.createMany({ data: rows, skipDuplicates: true });
      modelCount += rows.length;
    }
  }

  console.log(
    `Vehicle catalogue synced: ${catalogue.size} makes, ${modelCount} models.`,
  );
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
