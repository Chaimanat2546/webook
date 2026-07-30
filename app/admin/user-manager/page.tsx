import { UserManagerPage } from "../../../components/admin/user-manager/user-manager-page";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "../../../components/ui/empty";
import { createSupabaseAdminClient } from "../../../lib/supabase/admin";
import {
  CentralUserManagerAuthorizationError,
  requireCentralUserManagerAdmin,
} from "../../../server/auth/central-user-manager-admin";
import { listCustomerProjects } from "../../../server/repositories/customer-projects";

export default async function CentralUserManagerPage() {
  let projects = null;
  let forbidden = false;
  try {
    await requireCentralUserManagerAdmin();
    const client = createSupabaseAdminClient();
    if (!client) {
      throw new Error("Central User Manager service unavailable");
    }
    projects = await listCustomerProjects(client);
  } catch (error) {
    forbidden =
      error instanceof CentralUserManagerAuthorizationError &&
      (error.code === "forbidden" || error.code === "unauthorized");
  }
  if (projects) {
    return <UserManagerPage initialProjects={projects} />;
  }
  return (
    <Empty className="min-h-[50vh] border">
      <EmptyHeader>
        <EmptyTitle>
          {forbidden
            ? "ไม่มีสิทธิ์จัดการผู้ใช้ลูกค้า"
            : "โหลดข้อมูลจัดการผู้ใช้ไม่ได้"}
        </EmptyTitle>
        <EmptyDescription>
          {forbidden
            ? "เมนูนี้สำหรับผู้ดูแลระบบส่วนกลางเท่านั้น"
            : "กรุณาตรวจสอบการเชื่อมต่อแล้วลองใหม่"}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
