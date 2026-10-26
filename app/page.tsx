import { redirect } from "next/navigation";
import { getAdminNavigationPermissions } from "../server/auth/admin-navigation";
import { mobileDestinations } from "../lib/mobile-navigation";
import { AdminNoAccess } from "../components/layout/admin-no-access";

export default async function Home() {
  const permissions = await getAdminNavigationPermissions();
  const destination = mobileDestinations(permissions)[0];
  if (destination) redirect(destination.href);
  return <AdminNoAccess />;
}
