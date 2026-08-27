import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import { listWebookUsers } from "../../../server/repositories/webook-users";
import { UserManagementPage } from "../../../components/admin/user-management/user-management-page";

export default async function WebookUserManagementPage() {
  const { supabase } = await requireWebookUserManagerAdmin();
  const users = await listWebookUsers(supabase);

  return <UserManagementPage initialUsers={users} />;
}
