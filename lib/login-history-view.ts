export type HistoryParams = Record<string, string | undefined>;
const criteriaKeys = ["q", "from", "to", "timeFrom", "timeTo", "status", "sort", "page", "pageSize"] as const;

export function historyHref(params: HistoryParams, overrides: HistoryParams = {}): string {
  const query = new URLSearchParams();
  const values = { ...params, ...overrides };
  for (const key of criteriaKeys) if (values[key]) query.set(key, values[key]!);
  return `/admin/login-history${query.size ? `?${query}` : ""}`;
}
export function hasHistoryCriteria(params: HistoryParams): boolean {
  return Boolean(params.q?.trim() || params.from || params.to || params.timeFrom || params.timeTo || params.status);
}
export function historyRangeLabel(page: number, pageSize: number, total: number, count: number): string {
  if (!total || !count) return "แสดง 0 รายการ";
  const start = (page - 1) * pageSize + 1;
  return `แสดง ${start.toLocaleString("th-TH")}–${Math.min(start + count - 1, total).toLocaleString("th-TH")} จาก ${total.toLocaleString("th-TH")} รายการ`;
}
