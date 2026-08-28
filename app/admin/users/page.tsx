import { Suspense } from "react";

import { UserManagementPage } from "../../../components/admin/user-management/user-management-page";
import { UserListSkeleton } from "../../../components/admin/user-management/user-list-skeleton";
import { UserSaveNotification } from "../../../components/admin/user-management/user-save-notification";
import { UserTable } from "../../../components/admin/user-management/user-table";
import { Pagination } from "../../../components/admin/houses/pagination";
import { requireWebookUserManagerAdmin } from "../../../server/auth/admin";
import {
  listWebookUserManagementData,
  listWebookUserRoles,
  normalizeWebookUserRoleIds,
  normalizeWebookUsersPage,
  normalizeWebookUsersSearch,
  normalizeWebookUsersSortBy,
  normalizeWebookUsersSortDirection,
} from "../../../server/services/webook-users";

function parseRoleIds(value?: string): number[] {
  return normalizeWebookUserRoleIds(
    (value ?? "").split(",").map((item) => Number.parseInt(item, 10)),
  );
}

async function WebookUsersList({
  page,
  roleIds,
  roles,
  search,
  sortBy,
  sortDirection,
}: {
  page: number;
  roleIds: number[];
  roles: import("../../../lib/webook-users").WebookManagedRole[];
  search: string;
  sortBy: "dvId" | "email" | "name" | "role" | "username";
  sortDirection: "asc" | "desc";
}) {
  const { pagination, roles: loadedRoles, users } = await listWebookUserManagementData({
    page,
    roleIds,
    roles,
    search,
    sortBy,
    sortDirection,
  });

  return (
    <>
      <UserTable roleIds={roleIds} roles={loadedRoles} search={search} sortBy={sortBy} sortDirection={sortDirection} users={users} />
      <Pagination
        basePath="/admin/users"
        currentPage={pagination.page}
        query={{
          ...(roleIds.length > 0 ? { roles: roleIds.join(",") } : {}),
          ...(sortBy !== "name" ? { sort: sortBy } : {}),
          ...(sortDirection !== "asc" ? { dir: sortDirection } : {}),
        }}
        search={search}
        totalPages={pagination.totalPages}
      />
    </>
  );
}

export default async function WebookUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ dir?: string; page?: string; q?: string; roles?: string; sort?: string; success?: string }>;
}) {
  const params = await searchParams;
  const page = normalizeWebookUsersPage(Number.parseInt(params.page ?? "1", 10));
  const roleIds = parseRoleIds(params.roles);
  const search = normalizeWebookUsersSearch(params.q);
  const sortBy = normalizeWebookUsersSortBy(params.sort);
  const sortDirection = normalizeWebookUsersSortDirection(params.dir);
  await requireWebookUserManagerAdmin();
  const roles = await listWebookUserRoles();

  return (
    <UserManagementPage roles={roles} roleIds={roleIds} search={search} sortBy={sortBy} sortDirection={sortDirection}>
      {params.success === "1" ? <UserSaveNotification /> : null}
      <Suspense fallback={<UserListSkeleton />}>
        <WebookUsersList page={page} roleIds={roleIds} roles={roles} search={search} sortBy={sortBy} sortDirection={sortDirection} />
      </Suspense>
    </UserManagementPage>
  );
}
