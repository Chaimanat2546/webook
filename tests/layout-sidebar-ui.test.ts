import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const files = [
  new URL("../components/layout/admin-shell.tsx", import.meta.url),
  new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
];

const source = files
  .filter((file) => existsSync(file))
  .map((file) => readFileSync(file, "utf8"))
  .join("\n");

const uiSidebarSource = readFileSync(
  new URL("../components/ui/sidebar.tsx", import.meta.url),
  "utf8",
);

describe("admin layout sidebar UI", () => {
  it("uses the shadcn sidebar primitives instead of a custom sheet sidebar", () => {
    assert.match(source, /SidebarProvider/);
    assert.match(source, /SidebarTrigger/);
    assert.match(source, /SidebarMenuButton/);
    assert.doesNotMatch(source, /SidebarRail/);
    assert.match(source, /variant="inset"/);
    assert.match(source, /SidebarGroupLabel/);
    assert.match(source, /size="lg"/);
    assert.match(source, /Separator/);
    assert.doesNotMatch(source, /defaultOpen={false}/);
    assert.doesNotMatch(source, /--sidebar-width/);
    assert.doesNotMatch(source, /SheetContent/);
  });

  it("seeds the desktop sidebar state from the persisted sidebar cookie", () => {
    const layoutSource = readFileSync(
      new URL("../app/admin/layout.tsx", import.meta.url),
      "utf8",
    );
    const shellSource = readFileSync(
      new URL("../components/layout/admin-shell.tsx", import.meta.url),
      "utf8",
    );

    assert.match(layoutSource, /import \{ cookies \} from "next\/headers";/);
    assert.match(layoutSource, /const cookieStore = await cookies\(\);/);
    assert.match(
      layoutSource,
      /const defaultSidebarOpen = cookieStore\.get\("sidebar_state"\)\?\.value !== "false";/,
    );
    assert.match(
      layoutSource,
      /<AdminShell defaultSidebarOpen=\{defaultSidebarOpen\}>\{children\}<\/AdminShell>/,
    );
    assert.match(shellSource, /defaultSidebarOpen = true/);
    assert.match(shellSource, /<SidebarProvider defaultOpen=\{defaultSidebarOpen\}>/);
  });

  it("keeps the explicit sidebar trigger out of the sidebar header", () => {
    const sidebarSource = readFileSync(
      new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
      "utf8",
    );

    assert.doesNotMatch(sidebarSource, /SidebarTrigger/);
    assert.doesNotMatch(sidebarSource, /<SidebarHeader>[\s\S]*<SidebarTrigger/);
  });

  it("binds collapsed width rules to the sidebar width elements", () => {
    const sidebarGapBlock =
      uiSidebarSource.match(/<div\s+data-slot="sidebar-gap"[\s\S]*?\/>/)?.[0] ??
      "";
    const sidebarContainerBlock =
      uiSidebarSource.match(
        /<div\s+data-slot="sidebar-container"[\s\S]*?<div\s+data-sidebar="sidebar"/,
      )?.[0] ?? "";

    assert.match(
      sidebarGapBlock,
      /data-collapsible=\{state === "collapsed" \? collapsible : ""\}/,
    );
    assert.match(
      sidebarGapBlock,
      /data-\[collapsible=icon\]:w-\[calc\(var\(--sidebar-width-icon\)\+\(--spacing\(4\)\)\)\]/,
    );
    assert.match(
      sidebarContainerBlock,
      /data-collapsible=\{state === "collapsed" \? collapsible : ""\}/,
    );
    assert.match(
      sidebarContainerBlock,
      /data-\[collapsible=icon\]:w-\[calc\(var\(--sidebar-width-icon\)\+\(--spacing\(4\)\)\+2px\)\]/,
    );
  });

  it("keeps sidebar toggle actions out of the sidebar brand and rail", () => {
    const sidebarSource = readFileSync(
      new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
      "utf8",
    );

    assert.doesNotMatch(sidebarSource, /toggleSidebar/);
    assert.doesNotMatch(sidebarSource, /<SidebarMenuButton[^>]*onClick=/);
    assert.doesNotMatch(sidebarSource, /SidebarRail/);
  });

  it("closes the mobile drawer after a navigation menu link is selected", () => {
    const sidebarSource = readFileSync(
      new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url),
      "utf8",
    );

    assert.match(sidebarSource, /useSidebar/);
    assert.match(sidebarSource, /const \{ isMobile, setOpenMobile \} = useSidebar\(\);/);
    assert.match(
      sidebarSource,
      /function closeMobileSidebar\(\) \{\s*if \(isMobile\) setOpenMobile\(false\);\s*\}/,
    );
    assert.match(sidebarSource, /<Link[\s\S]*?href="\/admin\/houses"[\s\S]*?onClick=\{closeMobileSidebar\}[\s\S]*?>/);
    assert.match(sidebarSource, /<Link[\s\S]*?href="\/admin\/advertisements"[\s\S]*?onClick=\{closeMobileSidebar\}[\s\S]*?>/);
    assert.doesNotMatch(sidebarSource, /toggleSidebar/);
  });

  it("does not make the sidebar inset wider than the remaining viewport", () => {
    const sidebarInsetBlock =
      uiSidebarSource.match(/function SidebarInset[\s\S]*?function SidebarInput/)?.[0] ?? "";

    assert.match(sidebarInsetBlock, /min-w-0/);
    assert.doesNotMatch(sidebarInsetBlock, /\bw-full\b/);
  });

  it("uses a mobile hamburger trigger and full-screen mobile drawer", () => {
    assert.match(uiSidebarSource, /MenuIcon/);
    assert.match(uiSidebarSource, /<MenuIcon className="md:hidden"/);
    assert.match(uiSidebarSource, /<PanelLeftIcon className="hidden md:block"/);
    assert.match(uiSidebarSource, /data-mobile="true"[\s\S]*w-screen/);
    assert.match(uiSidebarSource, /data-mobile="true"[\s\S]*max-w-none/);
    assert.doesNotMatch(uiSidebarSource, /data-mobile="true"[\s\S]*\[\&>button\]:hidden/);
    assert.doesNotMatch(uiSidebarSource, /const SIDEBAR_WIDTH_MOBILE = "18rem"/);
  });
});
