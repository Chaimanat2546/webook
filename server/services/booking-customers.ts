import "server-only";
import { bookingId, record } from "../../lib/house-bookings.ts";
import { normalizeBookingPhone, parseBookingCustomer, type BookingCustomerCreation } from "../../lib/booking-customers.ts";
import type { HouseBookingsRepository } from "../repositories/house-bookings.ts";

type CustomerRepository = Pick<HouseBookingsRepository, "house" | "customersByPhone" | "createCustomer">;

export async function createBookingCustomer(repository: CustomerRepository, propertyId: unknown, raw: unknown): Promise<BookingCustomerCreation> {
  const input = parseBookingCustomer(raw);
  const house = await repository.house(bookingId(propertyId));
  if (!house) throw new Error("booking_house_not_found");
  const customers = await repository.customersByPhone(house, input.phone);
  if (customers.length) return { kind: "existing", customers };
  return { kind: "created", customer: await repository.createCustomer(house, input) };
}

type EditRepository = Pick<HouseBookingsRepository, "house" | "customerDetail" | "customersByPhone" | "updateCustomer">;
export async function getBookingCustomer(repository: EditRepository, propertyId: unknown, id: unknown) {
  const house = await repository.house(bookingId(propertyId));
  if (!house) throw new Error("booking_house_not_found");
  const customer = await repository.customerDetail(house, bookingId(id));
  if (!customer) throw new Error("ไม่พบข้อมูลลูกค้า");
  return customer;
}
export async function updateBookingCustomer(repository: EditRepository, propertyId: unknown, id: unknown, revision: unknown, raw: unknown): Promise<BookingCustomerCreation> {
  const current = await getBookingCustomer(repository, propertyId, id);
  if (revision !== current.updated_at) throw new Error("ข้อมูลลูกค้าถูกแก้ไขแล้ว กรุณาปิดและเปิดฟอร์มใหม่");
  const house = await repository.house(bookingId(propertyId));
  if (!house) throw new Error("booking_house_not_found");
  const input = parseBookingCustomer({ last_name: current.last_name, ...record(raw) });
  const duplicates = (await repository.customersByPhone(house, input.phone)).filter(customer => customer.id !== current.id);
  if (duplicates.length && normalizeBookingPhone(current.phone) !== input.phone) return { kind: "existing", customers: duplicates };
  return { kind: "created", customer: await repository.updateCustomer(house, current.id, current.updated_at, input) };
}
