import { pathToFileURL } from "node:url";

import { fetchAuthAttestation } from "./provisioning/attestation.mjs";
import { parseProvisionArguments } from "./provisioning/config.mjs";
import { createRegistryProvisioner } from "./provisioning/registry.mjs";
import {
  createCentralProvisioningClient,
  verifyCentralOperator,
} from "./provisioning/supabase-auth.mjs";
import {
  deployTargetOnly,
  installTargetToken,
  validateTargetRepository,
  verifyCloudflareTarget,
} from "./provisioning/target-deploy.mjs";
import { readTenantToken } from "./provisioning/token-input.mjs";

function failure() {
  throw new Error("Tenant provisioning failed.");
}

export async function provisionTenant(config, dependencies) {
  if (!config.apply) return { applied: false, mode: config.mode };
  await dependencies.verifyOperator(config.operatorUid);
  const context = await dependencies.prepare();
  const expectedAttestation =
    context.attestation ?? await dependencies.readTargetAttestation();
  const attestation = await dependencies.attest(
    config.targetSupabaseProjectRef,
    expectedAttestation,
  );
  if (context.phase === "completed") {
    return { applied: true, mode: config.mode };
  }
  if (config.mode === "onboard") {
    if (context.phase === "new" || context.phase === "registered") {
      await dependencies.registerInactive(attestation);
    }
  } else if (context.phase === "active_expected") {
    await dependencies.beginRotation();
  }
  const token = context.token ?? await dependencies.readToken();
  try {
    await dependencies.installTargetSecret(token, attestation);
    if (context.phase !== "stored") {
      await dependencies.storeEncryptedToken(token, attestation);
    }
    await dependencies.deployTarget(attestation);
  } finally {
    // Strings cannot be wiped; keep the binding scoped and never persist or print it.
  }
  if (!(await dependencies.checkHealth())) failure();
  if (!(await dependencies.checkListUsers())) failure();
  await dependencies.activate();
  return { applied: true, mode: config.mode };
}

export async function runProvisionCli(
  argv = process.argv.slice(2),
  environment = process.env,
  io = {},
) {
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  try {
    const config = parseProvisionArguments(argv);
    if (!config.apply) {
      stdout.write(`Dry run validated for Tenant ${config.tenantId}; no changes applied.\n`);
      return 0;
    }
    const client = createCentralProvisioningClient(environment);
    const registry = createRegistryProvisioner(client, config);
    await provisionTenant(config, {
      verifyOperator: (operatorUid) => verifyCentralOperator(client, operatorUid),
      prepare: registry.prepare,
      readTargetAttestation: () => validateTargetRepository(config),
      attest: (projectRef, expected) =>
        fetchAuthAttestation(projectRef, environment, {}, expected),
      registerInactive: registry.registerInactive,
      beginRotation: registry.beginRotation,
      readToken: () => readTenantToken({ stdin: io.stdin, stderr }),
      installTargetSecret: async (token, attestation) => {
        await validateTargetRepository(config, attestation);
        await verifyCloudflareTarget(config, environment);
        await installTargetToken(config, token, { environment });
      },
      storeEncryptedToken: registry.storeEncryptedToken,
      deployTarget: () => deployTargetOnly(config, { environment }),
      checkHealth: registry.checkHealth,
      checkListUsers: registry.checkListUsers,
      activate: registry.activate,
    });
    stdout.write(`Tenant ${config.tenantId} is active on token version ${config.nextTokenVersion}.\n`);
    return 0;
  } catch {
    stderr.write("Central User Manager provisioning failed safely; verify Tenant state before retry.\n");
    return 1;
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  process.exitCode = await runProvisionCli();
}
