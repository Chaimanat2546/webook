/** Start both tasks even when one fails; never expose the rejected task's secrets. */
export async function runBookingMaintenance(expire: () => Promise<unknown>, push: () => Promise<unknown>): Promise<void> {
  const results = await Promise.allSettled([Promise.resolve().then(expire), Promise.resolve().then(push)]);
  if (results.some(result => result.status === "rejected")) throw new Error("booking_maintenance_failed");
}
