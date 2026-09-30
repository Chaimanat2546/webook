// OpenNext generates this module after Next's type-check phase, and removes
// the previous output before each build. Keep the wrapper typeable on clean builds.
declare module "*.open-next/worker.js" {
  const handler: {
    fetch(request: Request, env: unknown, context: unknown): Promise<Response>;
  };
  export default handler;
}
