import Link from "next/link";
import { redirect } from "next/navigation";
import { buttonVariants } from "../../../../components/ui/button";
import { NotificationReadMarker } from "../../../../components/admin/notifications/notification-read-marker";
import { notificationSession, NotificationAccessError } from "../../../../server/auth/notifications";
import { getBookingNotification } from "../../../../server/services/booking-notifications";
import { notificationDestination } from "../../../../lib/booking-notifications";

export default async function NotificationDetailPage({ params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  let item;
  let canUseBooking = false;
  let actorId: string | null = null;
  try {
    const session = await notificationSession();
    canUseBooking = session.canUseBooking;
    actorId = session.actorId;
    item = await getBookingNotification(session.repository, session.actorId, notificationId);
  } catch (error) {
    if (error instanceof NotificationAccessError && error.status === 401) redirect("/login");
    return <div role="alert" className="space-y-4"><p>ไม่สามารถเปิดรายการแจ้งเตือนนี้ได้ กรุณาตรวจสอบสิทธิ์หรือลองใหม่อีกครั้ง</p><Link href="/admin/notifications" className="underline">กลับรายการแจ้งเตือน</Link></div>;
  }
  if (!item || !actorId) return <section role="alert" className="space-y-4"><p>ไม่พบรายการแจ้งเตือนนี้ หรือคุณไม่มีสิทธิ์เข้าถึง</p><Link href="/admin/notifications" className="underline">กลับรายการแจ้งเตือน</Link></section>;
  const href = notificationDestination(item, canUseBooking);
  return <section className="mx-auto max-w-xl space-y-5 rounded-xl border bg-card p-5">
    <p role="status">{href ? "กำลังเปิดรายการ…" : "คุณไม่มีสิทธิ์เปิดปฏิทินของรายการนี้"}</p>
    {href && <Link href={href} className={buttonVariants({ variant: "default" })}>เปิดรายการ</Link>}
    <NotificationReadMarker id={item.id} read={item.readAt !== null} actorId={actorId} href={href ?? undefined} />
    <Link href="/admin/notifications" className="block text-sm underline">กลับรายการแจ้งเตือน</Link>
  </section>;
}
