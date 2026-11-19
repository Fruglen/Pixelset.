import type { PrismaClient } from "@prisma/client";
// Phase 5B seed hooks. Each section owns one file in this folder and exports
// `seed(db, userId)`. Register it in the list below. Runs after the base seed.
import { seed as gallery } from "./gallery";
import { seed as website } from "./website";
import { seed as studio } from "./studio";
import { seed as store } from "./store";
import { seed as platform } from "./platform";

export async function seed5b(db: PrismaClient, userId: string) {
  for (const [name, fn] of [["gallery", gallery], ["website", website], ["studio", studio], ["store", store], ["platform", platform]] as const) {
    await fn(db, userId);
    console.log(`  Phase 5B seed: ${name} done`);
  }
}
