import { PrismaClient } from "@prisma/client";

/**
 * Database seed. Phase 0 has no required seed data — games are created at
 * runtime and static card/noble data lives in @splendor/engine, not the DB.
 * This script exists so `prisma db seed` / `pnpm db:seed` is wired for later
 * phases (demo users, fixtures). Extend as needed; it is safe to re-run.
 */
const prisma = new PrismaClient();

async function main(): Promise<void> {
  // No-op for now. Example for later phases:
  // await prisma.user.upsert({ where: { email: "demo@splendor.local" }, ... });
  // eslint-disable-next-line no-console
  console.log("Seed complete (no data to seed in Phase 0).");
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
