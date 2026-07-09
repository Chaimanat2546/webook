import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const headerUrl = new URL("../components/admin/houses/house-task-header.tsx", import.meta.url);
const shellUrl = new URL("../components/admin/houses/house-workspace-shell.tsx", import.meta.url);
const navItemUrl = new URL("../components/admin/houses/house-workspace-nav-item.tsx", import.meta.url);

describe("house workspace shared components", () => {
  it("provides the fixed house task header", () => {
    assert.equal(existsSync(headerUrl), true);
    const source = readFileSync(headerUrl, "utf8");

    assert.match(source, /export function HouseTaskHeader/);
    assert.match(source, /backHref: string/);
    assert.match(source, /title: string/);
    assert.match(source, /propertyId: string \| number/);
    assert.match(source, /subtitle: string/);
    assert.match(source, /actions\?: ReactNode/);
    assert.match(source, /ArrowLeftIcon/);
    assert.match(source, /<Badge variant="secondary">DV-\{propertyId\}<\/Badge>/);
    assert.match(source, /className="text-base font-semibold sm:text-lg lg:text-xl"/);
  });

  it("provides the fixed workspace frame and content header slots", () => {
    assert.equal(existsSync(shellUrl), true);
    const source = readFileSync(shellUrl, "utf8");

    assert.match(source, /export function HouseWorkspaceShell/);
    assert.match(source, /sidebarTitle: string/);
    assert.match(source, /sidebar: ReactNode/);
    assert.match(source, /contentIcon: ReactNode/);
    assert.match(source, /contentTitle: ReactNode/);
    assert.match(source, /contentMeta\?: ReactNode/);
    assert.match(source, /contentActions\?: ReactNode/);
    assert.match(source, /contentClassName\?: string/);
    assert.match(source, /rounded-lg border/);
    assert.match(source, /lg:grid-cols-\[16rem_minmax\(0,1fr\)\]/);
    assert.match(source, /hidden border-b px-4 py-3 lg:block/);
    assert.match(source, /grid min-h-0 min-w-0 grid-rows-\[auto_minmax\(0,1fr\)\]/);
  });

  it("provides one nav item style for sections and zones", () => {
    assert.equal(existsSync(navItemUrl), true);
    const source = readFileSync(navItemUrl, "utf8");

    assert.match(source, /"use client"/);
    assert.match(source, /export const HouseWorkspaceNavItem = forwardRef/);
    assert.match(source, /active\?: boolean/);
    assert.match(source, /badge\?: ReactNode/);
    assert.match(source, /icon: ReactNode/);
    assert.match(source, /label: ReactNode/);
    assert.match(source, /min-w-44/);
    assert.match(source, /bg-primary text-primary-foreground/);
    assert.match(source, /hidden shrink-0 lg:inline-flex/);
  });
});
