import { randomUUID } from "node:crypto";

import { getAgentHealth, sendAgentOperation } from "../../../server/central-user-manager/agent-client.ts";
import {
  decryptTenantToken,
  encryptTenantToken,
} from "../../../server/central-user-manager/token-vault.ts";
import {
  activateCustomerProjectForProvisioning,
  beginCustomerProjectTokenRotation,
  findCustomerProjectForProvisioning,
  recordCustomerProjectVerification,
  registerCustomerProject,
  storeCustomerProjectBearerForProvisioning,
} from "../../../server/repositories/customer-projects.ts";

function failure() {
  throw new Error("Central registry provisioning failed.");
}

export function createRegistryProvisioner(client, config) {
  let encryptedProject = null;
  let attestation = null;

  function assertCoordinates(project) {
    if (
      project.tenantId !== config.tenantId ||
      project.displayName !== config.displayName ||
      project.targetSupabaseProjectRef !== config.targetSupabaseProjectRef ||
      project.agentOrigin !== config.agentOrigin ||
      project.wranglerEnvironment !== config.wranglerEnvironment ||
      project.expectedAgentVersion !== config.expectedAgentVersion ||
      project.expectedSchemaVersion !== config.expectedSchemaVersion
    ) failure();
  }

  function buildDispatchProject(project) {
    if (!project.encryptedToken) failure();
    return {
      ...project.encryptedToken,
      targetSupabaseProjectRef: project.targetSupabaseProjectRef,
      agentOrigin: project.agentOrigin,
      wranglerEnvironment: project.wranglerEnvironment,
      expectedAgentVersion: project.expectedAgentVersion,
      expectedSchemaVersion: project.expectedSchemaVersion,
      authAttestationVersion: project.authAttestationVersion,
      authAttestationDigest: project.authAttestationDigest,
      authAttestationCheckedAt: project.authAttestationCheckedAt,
    };
  }

  return {
    async prepare() {
      const current = await findCustomerProjectForProvisioning(
        client,
        config.tenantId,
      );
      if (!current) {
        if (config.mode !== "onboard") failure();
        return { phase: "new", attestation: null, token: null };
      }
      assertCoordinates(current);
      attestation = {
        version: current.authAttestationVersion,
        digest: current.authAttestationDigest,
        checkedAt: current.authAttestationCheckedAt,
      };
      const tokenVersion = current.encryptedToken?.bearerTokenVersion ?? 0;
      if (
        current.isActive &&
        current.provisioningState === "completed" &&
        tokenVersion === config.nextTokenVersion
      ) {
        return { phase: "completed", attestation, token: null };
      }
      if (config.mode === "onboard") {
        if (
          current.isActive ||
          (tokenVersion !== 0 && tokenVersion !== 1)
        ) failure();
        if (
          tokenVersion === 0 &&
          current.provisioningState === "registered"
        ) {
          return { phase: "registered", attestation, token: null };
        }
        if (
          tokenVersion !== 1 ||
          current.provisioningState !== "token_stored"
        ) failure();
        encryptedProject = buildDispatchProject(current);
        return {
          phase: "stored",
          attestation,
          token: await decryptTenantToken(current.encryptedToken),
        };
      }
      if (!current.encryptedToken) failure();
      if (
        current.isActive &&
        (
          current.provisioningState === null ||
          current.provisioningState === "completed"
        ) &&
        tokenVersion === config.expectedTokenVersion
      ) {
        encryptedProject = buildDispatchProject(current);
        return { phase: "active_expected", attestation, token: null };
      }
      if (
        !current.isActive &&
        current.provisioningState === "rotation_gated" &&
        tokenVersion === config.expectedTokenVersion
      ) {
        encryptedProject = buildDispatchProject(current);
        return { phase: "gated", attestation, token: null };
      }
      if (
        !current.isActive &&
        current.provisioningState === "token_stored" &&
        tokenVersion === config.nextTokenVersion
      ) {
        encryptedProject = buildDispatchProject(current);
        return {
          phase: "stored",
          attestation,
          token: await decryptTenantToken(current.encryptedToken),
        };
      }
      failure();
    },
    async registerInactive(nextAttestation) {
      attestation = nextAttestation;
      await registerCustomerProject(client, {
        tenantId: config.tenantId,
        displayName: config.displayName,
        targetSupabaseProjectRef: config.targetSupabaseProjectRef,
        agentOrigin: config.agentOrigin,
        wranglerEnvironment: config.wranglerEnvironment,
        expectedAgentVersion: config.expectedAgentVersion,
        expectedSchemaVersion: config.expectedSchemaVersion,
        authAttestationVersion: nextAttestation.version,
        authAttestationDigest: nextAttestation.digest,
        authAttestationCheckedAt: nextAttestation.checkedAt,
        actorUid: config.operatorUid,
        eventId: randomUUID(),
      });
    },
    async beginRotation() {
      const gate = await beginCustomerProjectTokenRotation(client, {
        tenantId: config.tenantId,
        actorUid: config.operatorUid,
        eventId: randomUUID(),
        expectedTokenVersion: config.expectedTokenVersion,
      });
      if (gate.remainingDispatchableCount !== 0) failure();
    },
    async storeEncryptedToken(token, nextAttestation) {
      attestation = nextAttestation;
      const encrypted = await encryptTenantToken({
        tenantId: config.tenantId,
        token,
        tokenVersion: config.nextTokenVersion,
      });
      const stored = await storeCustomerProjectBearerForProvisioning(client, {
        ...encrypted,
        expectedTokenVersion: config.expectedTokenVersion,
        actorUid: config.operatorUid,
        eventId: randomUUID(),
      });
      if (!stored) failure();
      encryptedProject = {
        ...encrypted,
        targetSupabaseProjectRef: config.targetSupabaseProjectRef,
        agentOrigin: config.agentOrigin,
        wranglerEnvironment: config.wranglerEnvironment,
        expectedAgentVersion: config.expectedAgentVersion,
        expectedSchemaVersion: config.expectedSchemaVersion,
        authAttestationVersion: nextAttestation.version,
        authAttestationDigest: nextAttestation.digest,
        authAttestationCheckedAt: nextAttestation.checkedAt,
      };
    },
    async checkHealth() {
      if (!encryptedProject || !attestation) failure();
      const result = await getAgentHealth(encryptedProject);
      const succeeded = result.kind === "success";
      const recorded = await recordCustomerProjectVerification(client, {
        tenantId: config.tenantId,
        tokenVersion: config.nextTokenVersion,
        check: "health",
        succeeded,
        safeErrorCode: succeeded ? null : "provider_failure",
        health: succeeded ? result.data : null,
      });
      return recorded && succeeded;
    },
    async checkListUsers() {
      if (!encryptedProject) failure();
      const result = await sendAgentOperation(encryptedProject, {
        tenantId: config.tenantId,
        operationId: randomUUID(),
        actorUid: config.operatorUid,
        action: "list_users",
        payload: { page: 1, pageSize: 1 },
      });
      const succeeded =
        result.kind === "response" &&
        result.status === "completed" &&
        result.safeResult !== null &&
        "users" in result.safeResult;
      const recorded = await recordCustomerProjectVerification(client, {
        tenantId: config.tenantId,
        tokenVersion: config.nextTokenVersion,
        check: "list_users",
        succeeded,
        safeErrorCode: succeeded ? null : "provider_failure",
        health: null,
      });
      return recorded && succeeded;
    },
    async activate() {
      const activated = await activateCustomerProjectForProvisioning(client, {
        tenantId: config.tenantId,
        expectedTokenVersion: config.nextTokenVersion,
        actorUid: config.operatorUid,
        eventId: randomUUID(),
      });
      if (!activated) failure();
    },
  };
}
