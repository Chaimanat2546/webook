import type { BookingAgency } from "./house-bookings";

export interface BookingAgencyChoice {
  id: string;
  label: string;
}

export function bookingAgencyChoices(
  canManageAgency: boolean,
  agencies: BookingAgency[],
  selectedAgencyId: string | null,
): BookingAgencyChoice[] {
  if (!canManageAgency) return [];
  const choices: BookingAgencyChoice[] = [{ id: "", label: "ไม่ระบุเอเจนซี่" }];
  choices.push(...agencies.map((agency) => ({ id: agency.id, label: agency.name })));
  if (selectedAgencyId && !agencies.some((agency) => agency.id === selectedAgencyId)) {
    choices.push({ id: selectedAgencyId, label: `เอเจนซี่เดิม #${selectedAgencyId}` });
  }
  return choices;
}
