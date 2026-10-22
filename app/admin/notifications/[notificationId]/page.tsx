import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { Badge } from "../../../../components/ui/badge";
import { buttonVariants } from "../../../../components/ui/button";
import { NotificationReadButton } from "../../../../components/admin/notifications/notification-read-button";
import { notificationSession, NotificationAccessError } from "../../../../server/auth/notifications";
import { getBookingNotification } from "../../../../server/services/booking-notifications";
import { notificationEventLabel } from "../../../../lib/booking-notifications";

export default async function NotificationDetailPage({ params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  let item;
  let canUseBooking = false;
  try {
    const session = await notificationSession();
    canUseBooking = session.canUseBooking;
    item = await getBookingNotification(session.repository, session.actorId, notificationId);
  } catch (error) {
    if (error instanceof NotificationAccessError && error.status === 401) redirect("/login");
    return <div role="alert" className="space-y-4"><p>ไม่สามารถเปิดรายการแจ้งเตือนนี้ได้ กรุณาตรวจสอบสิทธิ์หรือลองใหม่อีกครั้ง</p><Link href="/admin/dashboard" className="underline">กลับหน้าภาพรวม</Link></div>;
  }
  if (!item) notFound();
  const dates = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" });
  // Dashboard details share the report's updated_at period filter.
  const month = new Date(new Date(item.bookingUpdatedAt).getTime() + 7 * 3_600_000).toISOString().slice(0, 7);
  const href = item.source === "internal"
    ? `/admin/dashboard/bookings/${encodeURIComponent(item.bookingId)}?month=${month}&status=all`
    : canUseBooking ? `/admin/houses/${encodeURIComponent(item.propertyId)}/bookings` : null;
  return <section className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-5">
    <div className="flex items-center gap-3"><Bell aria-hidden className="size-5" /><h1 className="text-xl font-semibold">{notificationEventLabel(item.eventType, item.source)}</h1></div>
    <div><h2 className="text-lg font-medium">{item.title}</h2><p className="text-sm text-muted-foreground">DV {item.propertyId}</p></div>
    <p>เข้าพัก {dates.format(new Date(`${item.checkIn}T00:00:00+07:00`))}<br />ออก {dates.format(new Date(`${item.checkOut}T00:00:00+07:00`))}</p>
    <Badge variant="secondary">สถานะปัจจุบัน: {item.status === "waiting" ? "รอโอน" : item.status === "confirmed" ? "ติดจอง" : item.status === "cancelled" ? "ยกเลิก" : item.status}</Badge>
    {item.source === "ical" && <p className="text-sm text-muted-foreground">{item.eventType === "booking_created" ? "รายการนี้นำเข้าจากปฏิทินภายนอก เวลาแจ้งเตือนคือเวลานำเข้า" : "รายการนี้มาจากปฏิทินภายนอก"}</p>}
    <div className="flex flex-wrap gap-3">
      {href && <Link href={href} className={buttonVariants({ variant: "default" })}>{item.source === "internal" ? "ดูรายละเอียด booking" : "ดูปฏิทินบ้าน"}</Link>}
      <NotificationReadButton id={item.id} read={item.readAt !== null} />
    </div>
    <Link href="/admin/dashboard" className="block text-sm underline">กลับหน้าภาพรวม</Link>
  </section>;
}
