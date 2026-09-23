import { CUSTOMER_FIELDS, parseBookingCustomer, type BookingCustomerInput } from "./booking-customers.ts";
import { parseThaiBirthDate } from "./thai-birth-date.ts";
import { bookingToday } from "./booking-availability.ts";

export type CustomerSection = typeof CUSTOMER_FIELDS[number]["group"];
export type CustomerErrors = Partial<Record<keyof BookingCustomerInput, string>>;

export function validateCustomerSection(value: BookingCustomerInput, section: CustomerSection, birthDateText: string): CustomerErrors {
  const errors: CustomerErrors = {};
  const keys: (keyof BookingCustomerInput)[] = CUSTOMER_FIELDS.filter(field => field.group === section).map(field => field.key);
  if (section === "general") keys.push("first_name", "last_name", "customer_type");
  if (section === "contact") keys.push("phone");
  if (section === "tax") keys.push("tax_head_office");
  if (section === "extra") keys.push("vip_status");
  for (const key of keys) {
    try {
      const fieldValue = key === "date_of_birth" ? parseThaiBirthDate(birthDateText, bookingToday()) : value[key];
      if (fieldValue === undefined) continue;
      parseBookingCustomer({ [key]: fieldValue });
    } catch (error) {
      errors[key] = error instanceof Error ? error.message : "ข้อมูลไม่ถูกต้อง";
    }
  }
  return errors;
}
