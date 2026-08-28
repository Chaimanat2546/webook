import { Suspense } from "react";

import { UserManagementPage } from "../../../components/admin/user-management/user-management-page";
import { UserListSkeleton } from "../../../components/admin/user-management/user-list-skeleton";
import { UserSaveNotification } from "../../../components/admin/user-management/user-save-notification";
import { UserTable } from "../../../components/admin/user-management/user-table";
import { Pagination } from "../../../components/admin/houses/pagination";
import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import {
  listWebookUserManagementData,
  normalizeWebookUsersPage,
  normalizeWebookUsersSearch,
} from "../../../server/services/webook-users";

async function WebookUsersList({ page, search }: { page: number; search: string }) {
  const { pagination, roles, users } = await listWebookUserManagementData({ page, search });

  return (
    <>
      <UserTable roles={roles} users={users} />
      <Pagination
        basePath="/admin/users"
        currentPage={pagination.page}
        search={search}
        totalPages={pagination.totalPages}
      />
    </>
  );
}

export default async function WebookUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; success?: string }>;
}) {
  const params = await searchParams;
  const page = normalizeWebookUsersPage(Number.parseInt(params.page ?? "1", 10));
  const search = normalizeWebookUsersSearch(params.q);
  await requireWebookUserManagerAdmin();

  return (
    <UserManagementPage search={search}>
      {params.success === "1" ? <UserSaveNotification /> : null}
      <Suspense fallback={<UserListSkeleton />}>
        <WebookUsersList page={page} search={search} />
      </Suspense>
    </UserManagementPage>
  );
}
