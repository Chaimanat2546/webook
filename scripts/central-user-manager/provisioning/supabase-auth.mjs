import { createClient } from "@supabase/supabase-js";

function failure() {
  throw new Error("Central provisioning authorization failed.");
}

export function createCentralProvisioningClient(environment = process.env) {
  const url = environment.NEXT_PUBLIC_SUPABASE_URL;
  const key = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (typeof url !== "string" || typeof key !== "string" || !url || !key) failure();
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function verifyCentralOperator(client, operatorUid) {
  try {
    const { data, error } = await client
      .from("users")
      .select("uid, role_id")
      .eq("uid", operatorUid)
      .limit(2);
    if (
      error ||
      !Array.isArray(data) ||
      data.length !== 1 ||
      data[0]?.uid !== operatorUid ||
      data[0]?.role_id !== 1
    ) failure();
  } catch {
    failure();
  }
}
