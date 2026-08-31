import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

function read(relativePath: string) {
  const url = new URL(relativePath, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

describe("Webook user management UI", () => {
  it("shows a responsive list with DV ID and sortable user fields", () => {
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(table, /value="name">ชื่อ<\/SortButton>/);
    assert.match(table, /value="username">Username<\/SortButton>/);
    assert.match(table, /value="email">อีเมล<\/SortButton>/);
    assert.match(table, /value="dvId">DV ID<\/SortButton>/);
    assert.match(table, /value="role">สิทธิ์ผู้ใช้<\/SortButton>/);
    assert.match(table, /user\.dvId/);
    assert.match(table, /md:hidden/);
    assert.match(table, /hidden[^\"]*md:block/);
  });

  it("renders missing user values as a dash", () => {
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(table, /return value && value\.toLowerCase\(\) !== "null" \? value : "-"/);
    assert.match(table, /return roles\.find\(\(role\) => role\.id === roleId\)\?\.name \?\? "-"/);
    assert.match(table, /user\.dvId \?\? "-"/);
  });

  it("shows each mobile user email only beneath the name", () => {
    const table = read("../components/admin/user-management/user-table.tsx");
    const mobileCards = table.slice(
      table.indexOf('<div className="grid gap-3 md:hidden">'),
      table.indexOf('<Card className="hidden overflow-hidden p-0 md:block">'),
    );

    assert.match(mobileCards, /<p className="truncate text-xs text-muted-foreground">\{displayText\(user\.email\)\}<\/p>/);
    assert.doesNotMatch(mobileCards, /<dt className="text-xs text-muted-foreground">อีเมล<\/dt>/);
  });

  it("uses shadcn checkbox menu items to filter multiple user roles", () => {
    const filter = read("../components/admin/user-management/user-role-filter.tsx");
    const page = read("../components/admin/user-management/user-management-page.tsx");
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(filter, /DropdownMenuCheckboxItem/);
    assert.match(filter, /selectedRoleIds\.includes\(role\.id\)/);
    assert.match(filter, /params\.set\("roles"/);
    assert.match(page, /<UserRoleFilter/);
    assert.ok(page.indexOf("<UserRoleFilter") < page.indexOf('type="submit"'));
    assert.doesNotMatch(table, /UserRoleFilter/);
  });

  it("offers both user settings sections from one per-user management menu", () => {
    const table = read("../components/admin/user-management/user-table.tsx");

    assert.match(table, /DropdownMenu/);
    assert.match(table, /DropdownMenuTrigger/);
    assert.match(table, /DropdownMenuItem/);
    assert.match(table, /EllipsisVerticalIcon/);
    assert.match(table, /ข้อมูลผู้ใช้/);
    assert.match(table, /สิทธิ์และการใช้งาน/);
    assert.match(table, /permissionParams\.set\("section", "permissions"\)/);
    assert.doesNotMatch(table, /BanIcon|ShieldCheckIcon|Ban|ปลด Ban/);
  });

  it("preserves the current user-list query when opening and navigating an edit page", () => {
    const table = read("../components/admin/user-management/user-table.tsx");
    const page = read("../app/admin/users/[id]/page.tsx");

    assert.match(table, /returnTo/);
    assert.match(table, /returnToParams\.set\("page", String\(page\)\)/);
    assert.match(table, /detailsParams\.set\("returnTo", returnTo\)/);
    assert.match(table, /permissionParams\.set\("returnTo", returnTo\)/);
    assert.match(page, /function normalizeReturnTo/);
    assert.match(page, /backHref=\{returnTo\}/);
    assert.match(page, /params\.set\("returnTo", returnTo\)/);
  });

  it("separates user details from permissions and usage", () => {
    const page = read("../app/admin/users/[id]/page.tsx");
    const form = read("../components/admin/user-management/user-edit-form.tsx");
    const users = read("../lib/webook-users.ts");

    assert.match(page, /label: "ข้อมูลผู้ใช้"/);
    assert.match(page, /label: "สิทธิ์และการใช้งาน"/);
    assert.match(page, /section === "permissions"/);
    assert.match(page, /<UserTaskHeader/);
    assert.match(page, /<UserWorkspaceShell/);
    assert.match(page, /contentTitle=\{activeSection\.label\}/);
    assert.doesNotMatch(page, /HouseWorkspaceShell/);
    assert.match(page, /<UserEditForm/);
    assert.match(page, /key=\{`\$\{activeSection\.key\}-\$\{user\.dvId \?\? ""\}`\}/);
    assert.match(form, /name="name"/);
    assert.match(form, /name="dvId"/);
    assert.match(form, /inputMode="numeric"/);
    assert.match(form, /const \[dvId, setDvId\] = useState\(user\.dvId \?\? ""\)/);
    assert.match(form, /value=\{state\?\.ok && !hasEditedDvIdSinceSubmit \? state\.user\.dvId \?\? "" : dvId\}/);
    assert.match(form, /setDvId\(event\.currentTarget\.value\.replace\(\/\\D\/g, ""\)\)/);
    assert.match(form, /onInput=\{\(event\) => \{/);
    assert.match(form, /replace\(\/\\D\/g, ""\)/);
    assert.match(form, /DV ID ต้องเป็นตัวเลข และห้ามซ้ำกับผู้ใช้อื่น/);
    assert.doesNotMatch(form, /pattern="\[0-9\]\*"/);
    assert.match(form, /grid gap-4 md:grid-cols-2/);
    assert.equal((form.match(/grid gap-4 md:grid-cols-2/g) ?? []).length, 2);
    assert.doesNotMatch(form, /max-w-lg/);
    assert.match(form, /max-w-none/);
    assert.match(form, /name="roleId"/);
    assert.match(form, /type="hidden" value=\{user\.roleId/);
    assert.match(form, /type="hidden" value=\{user\.name\}/);
    assert.match(form, /disabled=\{user\.roleId === null \|\| isPending\}/);
    assert.match(form, /กรุณากำหนดสิทธิ์ผู้ใช้ก่อนแก้ไขข้อมูลผู้ใช้/);
    assert.match(form, /roles\.map\(/);
    assert.match(form, /ALLOW_TOOL_OPTIONS\.map\(/);
    assert.match(form, /<Switch/);
    assert.match(users, /allow_booking/);
    assert.match(users, /allow_accommodation/);
    assert.match(form, /สิทธิ์การใช้งานระบบ/);
    assert.match(form, /className="grid grid-cols-1 gap-3 lg:grid-cols-5"/);
    assert.match(form, /className="flex min-h-16 items-start gap-3 rounded-md border p-3 text-sm"/);
    assert.match(form, /text-xs text-muted-foreground">\{option\.description\}<\/span>/);
    assert.match(form, /บันทึกสิทธิ์การใช้งาน/);
    const detailActions = form.slice(form.indexOf("function FormActions"));
    assert.match(detailActions, /<SaveIcon data-icon="inline-start" \/>/);
    assert.match(detailActions, /บันทึกข้อมูลผู้ใช้\s*<\/Button>/);
    assert.doesNotMatch(detailActions, /ยกเลิก|<Link/);
    assert.doesNotMatch(form, /name="(?:email|username|tel)"/);
    assert.doesNotMatch(page, /Ban|ปลด Ban/);
  });

  it("shows an update error on the dedicated edit page", () => {
    const actions = read("../app/admin/users/actions.ts");

    const form = read("../components/admin/user-management/user-edit-form.tsx");
    assert.match(form, /useActionState/);
    assert.match(form, /updateWebookUserFormAction/);
    assert.match(form, /aria-invalid=\{hasDvIdError\}/);
    assert.match(form, /aria-describedby="webook-user-dv-id-error"/);
    assert.match(form, /min-h-5/);
    assert.match(form, /router\.refresh\(\)/);
    assert.doesNotMatch(form, /router\.push\(/);
    assert.doesNotMatch(actions, /redirect\(/);

    const notification = read("../components/admin/user-management/user-save-notification.tsx");
    assert.match(notification, /export function UserUpdateErrorNotification/);
    assert.match(notification, /toast\.error\(message\)/);
  });

  it("shows a success toast while remaining on the edit page", () => {
    const page = read("../app/admin/users/page.tsx");
    const editPage = read("../app/admin/users/[id]/page.tsx");
    const form = read("../components/admin/user-management/user-edit-form.tsx");
    const notification = read("../components/admin/user-management/user-save-notification.tsx");

    assert.match(form, /state\?\.ok \? <UserSaveNotification \/> : null/);
    assert.match(form, /const \[hasEditedDvIdSinceSubmit, setHasEditedDvIdSinceSubmit\] = useState\(false\)/);
    assert.match(form, /state\?\.ok && !hasEditedDvIdSinceSubmit \? state\.user\.dvId \?\? "" : dvId/);
    assert.match(editPage, /key=\{`\$\{activeSection\.key\}-\$\{user\.dvId \?\? ""\}`\}/);
    assert.doesNotMatch(form, /router\.push\(/);
    assert.match(page, /<UserSaveNotification \/>/);
    assert.match(notification, /toast\.success\("บันทึกข้อมูลผู้ใช้แล้ว"\)/);
  });

  it("keeps the heading and search available while the user list loads", () => {
    const page = read("../app/admin/users/page.tsx");
    const shell = read("../components/admin/user-management/user-management-page.tsx");
    const skeleton = read("../components/admin/user-management/user-list-skeleton.tsx");

    assert.match(page, /<Suspense fallback=\{<UserListSkeleton \/>\}>/);
    assert.match(shell, /placeholder="ค้นหาชื่อ, Username หรืออีเมล\.\.\."/);
    assert.match(skeleton, /Array\.from\(\{ length: 8 \}\)/);
    assert.match(skeleton, /<TableHead className="w-\[13%\]">DV ID<\/TableHead>/);
    assert.match(skeleton, /<TableCell><Skeleton className="h-4 w-2\/3" \/><\/TableCell>/);
    assert.match(skeleton, /<CardContent className="space-y-4">/);
    assert.match(skeleton, /<dl className="grid gap-3 text-sm">/);
    assert.match(skeleton, /<Skeleton className="h-7 w-16" \/>/);
    assert.match(skeleton, /md:hidden/);
    assert.match(skeleton, /md:block/);
  });

  it("depends on shared DTOs instead of the server repository layer", () => {
    const files = [
      read("../components/admin/user-management/user-table.tsx"),
      read("../app/admin/users/[id]/page.tsx"),
    ].join("\n");

    assert.match(files, /lib\/webook-users/);
    assert.doesNotMatch(files, /server\/repositories\/webook-users/);
  });

  it("provides responsive User Workspace presentation primitives", () => {
    const header = read("../components/admin/user-management/user-task-header.tsx");
    const shell = read("../components/admin/user-management/user-workspace-shell.tsx");
    const nav = read("../components/admin/user-management/user-workspace-nav-item.tsx");

    assert.match(header, /กลับไปรายการผู้ใช้/);
    assert.match(header, /DV-/);
    assert.match(shell, /lg:grid-cols-\[16rem_minmax\(0,1fr\)\]/);
    assert.match(nav, /aria-current/);
    assert.match(nav, /lg:min-w-0/);
  });
});
