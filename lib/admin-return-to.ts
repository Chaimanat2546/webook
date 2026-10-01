export function safeHouseReturnTo(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "/admin/houses" || value.startsWith("/admin/houses?")) return value;
  if (!value.startsWith("/admin/dashboard/houses/") || value.startsWith("//") || value.includes("\\") || value.includes("#")) return null;

  try {
    const url = new URL(value, "https://webook.invalid");
    if (url.origin !== "https://webook.invalid" || !/^\/admin\/dashboard\/houses\/[^/]+$/.test(url.pathname)) return null;
    return `${url.pathname}${url.search}`;
  } catch {
    return null;
  }
}
