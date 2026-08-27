import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import { listWebookUsers } from "../../../server/repositories/webook-users";

export default async function WebookUserManagementPage() {
  const { supabase } = await requireWebookUserManagerAdmin();
  const users = await listWebookUsers(supabase);

  return (
    <main className="space-y-2 p-4">
      <h1 className="text-xl font-semibold">จัดการผู้ใช้ Webook</h1>
      {users.length === 0 ? <p>ไม่พบผู้ใช้</p> : <p>ผู้ใช้ทั้งหมด {users.length} คน</p>}
    </main>
  );
}
