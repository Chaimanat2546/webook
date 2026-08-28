import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = readFileSync(new URL("../components/layout/admin-desktop-sidebar.tsx", import.meta.url), "utf8");

describe("admin sidebar icons", () => {
  it("uses the approved Lucide icons for each admin menu", () => {
    assert.match(source, /import \{ Contact, Files, FileText, House, LogOutIcon, Megaphone, ShieldUser, Users \} from "lucide-react"/);
    assert.match(source, /<House data-icon="inline-start" \/>[\s\S]*?<span>บ้านพัก<\/span>/);
    assert.match(source, /<Megaphone data-icon="inline-start" \/>[\s\S]*?<span>โฆษณา<\/span>/);
    assert.match(source, /<FileText data-icon="inline-start" \/>[\s\S]*?<span>ใบเสนอราคา<\/span>/);
    assert.match(source, /<Files aria-hidden\/>[\s\S]*?<span>รายการใบเสนอราคา<\/span>/);
    assert.match(source, /<Contact aria-hidden \/>[\s\S]*?<span>ข้อมูลลูกค้า<\/span>/);
    assert.match(source, /<Users data-icon="inline-start" \/>[\s\S]*?<span>ผู้ใช้เว็บไซต์<\/span>/);
    assert.match(source, /<ShieldUser data-icon="inline-start" \/>[\s\S]*?<span>ผู้ใช้ WeBook<\/span>/);
  });
});
