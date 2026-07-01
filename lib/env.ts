export function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return { anonKey, url };
}

export function getSupabaseServiceRoleEnv() {
  const { url } = getSupabaseEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    return null;
  }

  return { serviceRoleKey, url };
}

export function getAdvertisementImageEnv() {
  const workerSecret = process.env.ADVERTISEMENT_IMAGE_WORKER_SECRET;
  const workerUrl = process.env.ADVERTISEMENT_IMAGE_WORKER_URL;

  if (!workerSecret || !workerUrl) {
    throw new Error("Missing advertisement image environment variables");
  }

  return { workerSecret, workerUrl };
}

export function getHouseImageEnv() {
  return getAdvertisementImageEnv();
}

export function getAwsS3ImageEnv() {
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const bucket = process.env.AWS_BUCKET;
  const region = process.env.AWS_REGION;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !bucket || !region || !secretAccessKey) {
    const missing = [
      ["AWS_ACCESS_KEY_ID", accessKeyId],
      ["AWS_BUCKET", bucket],
      ["AWS_REGION", region],
      ["AWS_SECRET_ACCESS_KEY", secretAccessKey],
    ]
      .filter(([, value]) => !value)
      .map(([name]) => name);
    throw new Error(`ยังไม่ได้ตั้งค่า ${missing.join(", ")} สำหรับลบรูป AWS`);
  }

  return { accessKeyId, bucket, region, secretAccessKey };
}
