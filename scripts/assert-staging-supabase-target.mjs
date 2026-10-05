export const STAGING_SUPABASE_PROJECT_REF = "sxvkhzhqtrpxgzumsswl";

export function assertStagingProjectRef(projectRef) {
  if (projectRef !== STAGING_SUPABASE_PROJECT_REF) {
    throw new Error("Invalid Staging Supabase target.");
  }
}
