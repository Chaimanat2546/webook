export const ZONE_LABELS: Record<string, string> = {
  all: "ทุกโซน",
  bangkok: "กรุงเทพ",
  bangsaray: "บางเสร่",
  bang_saray: "บางเสร่",
  bangsean: "บางแสน",
  bang_saen: "บางแสน",
  hua_hin: "หัวหิน",
  huahin: "หัวหิน",
  jomtien: "จอมเทียน",
  khaoyai: "เขาใหญ่",
  pattaya: "พัทยา",
  rayong: "ระยอง",
  sattahip: "สัตหีบ",
};

export const ZONE_OPTIONS = Object.entries(ZONE_LABELS).map(([value, label]) => ({
  label,
  value,
}));

export function normalizeZone(value: string): string {
  return value.trim().toLowerCase();
}

export function isKnownZone(value: string): boolean {
  return Object.prototype.hasOwnProperty.call(ZONE_LABELS, normalizeZone(value));
}

export function formatZone(zone: string | null | undefined): string {
  const normalized = normalizeZone(zone ?? "");
  if (!normalized) return "-";

  return ZONE_LABELS[normalized] ?? zone?.trim() ?? "-";
}
