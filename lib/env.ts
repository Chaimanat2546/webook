export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return { anonKey, url };
}

export function getAdvertisementImageEnv() {
  const workerSecret = process.env.ADVERTISEMENT_IMAGE_WORKER_SECRET;
  const workerUrl = process.env.ADVERTISEMENT_IMAGE_WORKER_URL;

  if (!workerSecret || !workerUrl) {
    throw new Error("Missing advertisement image environment variables");
  }

  return { workerSecret, workerUrl };
}
