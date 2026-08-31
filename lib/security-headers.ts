const DEVELOPMENT_SCRIPT_SOURCES = "'self' 'unsafe-inline' 'wasm-unsafe-eval' 'unsafe-eval'";
const PRODUCTION_SCRIPT_SOURCES = "'self' 'unsafe-inline' 'wasm-unsafe-eval'";

export function getContentSecurityPolicy(environment: string | undefined): string {
  const scriptSources = environment === "development" ? DEVELOPMENT_SCRIPT_SOURCES : PRODUCTION_SCRIPT_SOURCES;

  return `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSources}; connect-src 'self' data: https://*.supabase.co https://webook-media.poolvilla.workers.dev https://d24r25u6qcb3zryipzoiqj2jxy0ilqtm.lambda-url.ap-southeast-1.on.aws; frame-src 'self' blob:; worker-src 'self' blob:`;
}
