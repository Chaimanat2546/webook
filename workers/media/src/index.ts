interface R2ObjectBody {
  body: BodyInit | null;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  delete(key: string): Promise<void>;
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<{ key: string } | null>;
}

interface Env {
  ADVERTISEMENT_IMAGE_WORKER_SECRET: string;
  MEDIA_BUCKET: R2Bucket;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function keyFromRequest(request: Request): string {
  const url = new URL(request.url);
  const key = decodeURIComponent(url.pathname.replace(/^\/+/, "")).replace(/\\/g, "/");
  const parts = key.split("/");

  if (
    !key.startsWith("advertisements/") ||
    key.includes("://") ||
    parts.some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error("Invalid image name");
  }

  return key;
}

function requireBearer(request: Request, secret: string): Response | null {
  return request.headers.get("authorization") === `Bearer ${secret}`
    ? null
    : new Response("Unauthorized", { status: 401 });
}

function corsHeaders() {
  return {
    "access-control-allow-headers": "authorization,content-type",
    "access-control-allow-methods": "GET,HEAD,PUT,DELETE,OPTIONS",
    "access-control-allow-origin": "*",
  };
}

const worker = {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    let key: string;
    try {
      key = keyFromRequest(request);
    } catch {
      return new Response("Invalid image name", { headers: corsHeaders(), status: 400 });
    }

    if (request.method === "GET" || request.method === "HEAD") {
      const object = await env.MEDIA_BUCKET.get(key);
      if (!object) return new Response("Not found", { headers: corsHeaders(), status: 404 });

      const headers = new Headers(corsHeaders());
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      headers.set("cache-control", "public, max-age=31536000, immutable");

      return new Response(request.method === "HEAD" ? null : object.body, { headers });
    }

    const authError = requireBearer(request, env.ADVERTISEMENT_IMAGE_WORKER_SECRET);
    if (authError) return authError;

    if (request.method === "PUT") {
      const contentType = request.headers.get("content-type") ?? "";
      if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
        return new Response("Unsupported media type", { headers: corsHeaders(), status: 415 });
      }

      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > MAX_IMAGE_BYTES) {
        return new Response("Image too large", { headers: corsHeaders(), status: 413 });
      }

      const object = await env.MEDIA_BUCKET.put(key, bytes, {
        httpMetadata: { contentType },
      });

      return Response.json({ key: object?.key ?? key }, { headers: corsHeaders() });
    }

    if (request.method === "DELETE") {
      await env.MEDIA_BUCKET.delete(key);
      return new Response(null, { headers: corsHeaders(), status: 204 });
    }

    return new Response("Method not allowed", { headers: corsHeaders(), status: 405 });
  },
};

export default worker;
