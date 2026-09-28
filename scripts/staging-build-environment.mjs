import { existsSync } from "node:fs";
import { rename } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

export class CommandExitError extends Error {
  constructor(exitCode, message) {
    super(message);
    this.exitCode = exitCode;
  }
}

export async function withProductionEnvironmentExcluded(directory, work) {
  const productionEnvironment = join(directory, ".env.production");
  if (!existsSync(productionEnvironment)) return work();
  const heldEnvironment = join(directory, `.env.production.staging-build-${randomUUID()}`);
  await rename(productionEnvironment, heldEnvironment);
  try {
    return await work();
  } finally {
    await rename(heldEnvironment, productionEnvironment);
  }
}
