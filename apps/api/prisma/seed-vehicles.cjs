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

  let makeCount = 0;
  let modelCount = 0;
  for (const [name, models] of Object.entries(data)) {
    const make = await prisma.vehicleMake.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    makeCount++;
    for (const modelName of models) {
      await prisma.vehicleModel.upsert({
        where: { makeId_name: { makeId: make.id, name: modelName } },
        update: {},
        create: { makeId: make.id, name: modelName },
      });
      modelCount++;
    }
  }

  console.log(`Vehicle catalogue seeded: ${makeCount} makes, ${modelCount} models.`);
  await prisma.$disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
