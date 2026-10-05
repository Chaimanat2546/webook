import { dashboardStatus, parseDashboardQuery, type DashboardAgency, type DashboardBookingSource, type DashboardPage, type DashboardReportingQuery, type DashboardReportingResult, type DashboardScope } from "../../lib/dashboard.ts";

/** In-memory RPC double for UI/service unit tests, not the reporting implementation.
 * PostgreSQL aggregation/security behavior is tested in dashboard-migration.test.ts.
 */
export function dashboardReportFixture(scope: DashboardScope, source: DashboardBookingSource[], query: DashboardReportingQuery): DashboardReportingResult {
  const month = parseDashboardQuery({ month: query.month });
  const base = source.filter(row => (scope.kind === "admin" || row.propertyId === scope.propertyId) &&
    (query.checkInFrom && query.checkInTo ? row.checkIn >= query.checkInFrom && row.checkIn <= query.checkInTo : Date.parse(row.updatedAt) >= Date.parse(month.start) && Date.parse(row.updatedAt) < Date.parse(month.end)));
  const scoped = base.filter(row => !query.agency || (query.agency === "unassigned" ? row.agentId === null : row.agentId === query.agency));
  const statusCounts = { confirmed: 0, waiting: 0, cancelled: 0, repair: 0, unknown: 0 };
  scoped.forEach(row => statusCounts[dashboardStatus(row.status)]++);
  const salesFor = (rows: DashboardBookingSource[]) => ({ count: rows.length, amountCents: rows.reduce((sum, row) => sum + (row.priceCents ?? 0), 0), missingPrices: rows.filter(row => row.priceCents === null).length });
  const confirmed = (rows: DashboardBookingSource[]) => rows.filter(row => row.status === "confirmed");
  const label = (row: DashboardBookingSource) => row.agentName ?? (row.agentId ? "เอเจนซี่ที่ไม่มีชื่อในระบบ" : "ไม่ระบุเอเจนซี่");
  const groups: DashboardAgency[] = scope.kind === "admin" ? [...new Set(base.map(row => row.agentId))].map(id => {
    const rows = base.filter(row => row.agentId === id);
    return { id, name: label(rows[0]), ...salesFor(confirmed(rows)), count: rows.length };
  }) : [];
  groups.sort((a,b) => b.amountCents-a.amountCents || b.count-a.count || a.name.localeCompare(b.name,"th"));
  const agencyRows = groups.filter(row => row.name.toLowerCase().includes((query.agencySearch ?? "").toLowerCase()));
  agencyRows.sort((a,b) => {
    if (query.agencySort === "name-asc") return a.name.localeCompare(b.name,"th");
    if (query.agencySort === "count-asc") return a.count-b.count || a.name.localeCompare(b.name,"th");
    if (query.agencySort === "count-desc") return b.count-a.count || a.name.localeCompare(b.name,"th");
    if (query.agencySort === "sales-asc") return a.amountCents-b.amountCents || a.name.localeCompare(b.name,"th");
    return b.amountCents-a.amountCents || a.name.localeCompare(b.name,"th");
  });
  const rows = scoped.filter(row => (!query.status || query.status === "all" || dashboardStatus(row.status) === query.status)
    && (query.amountFromCents === undefined || (row.priceCents !== null && row.priceCents >= query.amountFromCents))
    && (query.amountToCents === undefined || (row.priceCents !== null && row.priceCents <= query.amountToCents))
    && [row.houseTitle, `DV-${row.propertyId}`, [row.customerFirstName,row.customerLastName].filter(Boolean).join(" "), scope.kind === "admin" ? label(row) : ""].some(value => value.toLowerCase().includes((query.search ?? "").toLowerCase())));
  rows.sort((a,b) => {
    if (query.sort === "checkin-desc" && a.checkIn !== b.checkIn) return b.checkIn.localeCompare(a.checkIn);
    if (query.sort === "price-asc" || query.sort === "price-desc") {
      if (a.priceCents === null && b.priceCents !== null) return 1;
      if (b.priceCents === null && a.priceCents !== null) return -1;
      if (a.priceCents !== null && b.priceCents !== null && a.priceCents !== b.priceCents) return (a.priceCents-b.priceCents)*(query.sort === "price-desc" ? -1 : 1);
    }
    return b.updatedAt.localeCompare(a.updatedAt) || b.id.localeCompare(a.id,"en",{ numeric: true });
  });
  function page<T>(rows: T[], number = 1, size = 10): DashboardPage<T> {
    const pages = Math.max(1,Math.ceil(rows.length/size)), current = Math.min(number,pages);
    return { rows: rows.slice((current-1)*size,current*size), total: rows.length, page: current, pages };
  }
  const dayCount = new Date(Number(query.month.slice(0,4)),Number(query.month.slice(5)),0).getDate();
  return {
    bookingCount: scoped.length, statusCounts, sales: salesFor(confirmed(scoped)), totalSalesCents: salesFor(confirmed(base)).amountCents,
    daily: Array.from({ length: dayCount },(_,i) => { const date = `${query.month}-${String(i+1).padStart(2,"0")}`; return { date, count: confirmed(scoped).filter(row => new Date(Date.parse(row.updatedAt)+7*3600000).toISOString().slice(0,10) === date).length }; }),
    bookings: page(rows,query.page,query.pageSize), bookingDetail: scoped.find(row => row.id === query.bookingId) ?? null,
    agencies: page(agencyRows,query.agenciesPage), selectedAgency: groups.find(row => query.agency === "unassigned" ? row.id === null : row.id === query.agency) ?? null,
    agencyCount: groups.length, topAgencies: groups.slice(0,5),
  };
}
