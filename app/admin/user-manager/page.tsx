import { requireCentralUserManagerAdmin } from "../../../server/auth/admin";
import { UserManagerPage } from "../../../components/admin/user-manager/user-manager-page";
import { listCentralUserTenants } from "../../../server/central-user-manager/tenant-bindings";

export default async function CentralUserManagerPage() {
  await requireCentralUserManagerAdmin();
  return <UserManagerPage tenants={listCentralUserTenants()} />;
}
