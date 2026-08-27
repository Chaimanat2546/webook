import { UserManagementPage } from "../../../components/admin/user-management/user-management-page";
import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import { listWebookUserManagementData } from "../../../server/services/webook-users";

export default async function WebookUsersPage() {
  await requireWebookUserManagerAdmin();
  const { roles, users } = await listWebookUserManagementData();

  return <UserManagementPage initialUsers={users} roles={roles} />;
}
