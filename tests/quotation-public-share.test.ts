import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("quotation public share", () => {
  it("renders a token-scoped public document without admin auth", () => {
    const page = source("../app/q/[token]/page.tsx");
    assert.match(page, /getPublicQuotationByToken/);
    assert.match(page, /createSupabaseServerClient/);
    assert.match(page, /calculateQuotation/);
    assert.match(page, /QuotationDocument/);
    assert.match(page, /getQuotationPublicOrigin\(\)/);
    assert.doesNotMatch(page, /headers\(\)|x-forwarded-proto|x-forwarded-host|requestHeaders|get\("host"\)/);
    assert.match(page, /buildQuotationPublicUrl/);
    assert.match(page, /createQuotationPublicQrDataUrl/);
    assert.match(page, /publicQrDataUrl=\{publicQrDataUrl\}/);
    assert.match(page, /notFound\(\)/);
    assert.match(page, /robots:\s*\{\s*follow:\s*false,\s*index:\s*false/);
    assert.doesNotMatch(page, /requireAdmin|canUseQuotation/);
  });

  it("enables share only for a clean saved public token", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    const createPage = source("../app/admin/quotations/new/page.tsx");
    const editPage = source("../app/admin/quotations/[id]/page.tsx");
    assert.match(editor, /publicToken/);
    assert.match(editor, /publicOrigin: string \| null/);
    assert.match(editor, /navigator\.clipboard\.writeText/);
    assert.match(editor, /buildQuotationPublicUrl\(publicOrigin, publicToken\)/);
    assert.doesNotMatch(editor, /window\.location\.origin/);
    assert.match(editor, /documentNumber &&[\s\S]*lastSavedPayload &&[\s\S]*publicOrigin &&[\s\S]*publicToken &&[\s\S]*!isDirty/);
    assert.match(editor, /disabled=\{!canUseSavedDocument\}/);
    assert.match(editor, /ยังไม่ได้ตั้งค่า URL สาธารณะสำหรับใบเสนอราคา/);
    assert.match(editor, /aria-describedby=\{shareUnavailableMessage \? "quotation-share-unavailable" : undefined\}/);
    assert.match(editor, /id="quotation-share-unavailable"[\s\S]*\{shareUnavailableMessage\}/);
    assert.match(editor, /data-document-actions/);
    for (const page of [createPage, editPage]) {
      assert.match(page, /getQuotationPublicOrigin\(\)/);
      assert.match(page, /publicOrigin=\{publicOrigin\}/);
      assert.doesNotMatch(page, /headers\(\)|window\.location\.origin|x-forwarded-host|get\("host"\)/);
    }
  });

  it("keeps draft QR clean-only while preserving the saved QR for print", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /const \[publicQrDataUrl, setPublicQrDataUrl\] = useState\(""\)/);
    assert.match(editor, /if \(!lastSavedPayload\?\.documentDisplay\.certificationQr \|\| !publicOrigin \|\| !publicToken\)[\s\S]*setPublicQrDataUrl\(""\)/);
    assert.match(editor, /createQuotationPublicQrDataUrl\(publicUrl\)/);
    assert.match(editor, /let stale = false/);
    assert.match(editor, /if \(stale\) return;[\s\S]*setPublicQrDataUrl/);
    assert.match(editor, /return \(\) => \{[\s\S]*stale = true/);
    assert.match(
      editor,
      /const savedPublicQrDataUrl =\s*publicOrigin && publicToken && publicQrSettledToken === publicToken/,
    );
    assert.match(editor, /const draftPublicQrDataUrl = !isDirty \? savedPublicQrDataUrl : ""/);
    assert.equal(editor.match(/publicQrDataUrl=\{draftPublicQrDataUrl\}/g)?.length, 1);
    assert.equal(editor.match(/publicQrDataUrl=\{savedPublicQrDataUrl\}/g)?.length, 1);
  });

  it("waits for a clean saved quotation QR before printing", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /const \[publicQrSettledToken, setPublicQrSettledToken\] = useState\(""\)/);
    assert.match(editor, /const publicQrPending = Boolean\([\s\S]*documentDisplay\.certificationQr[\s\S]*publicOrigin[\s\S]*publicToken[\s\S]*publicQrSettledToken !== publicToken/);
    assert.doesNotMatch(editor, /const publicQrPending = Boolean\([\s\S]*!isDirty[\s\S]*publicQrSettledToken !== publicToken/);
    assert.match(editor, /const canPrint = Boolean\([\s\S]*!publicQrPending/);
    assert.match(editor, /setPublicQrSettledToken\(publicToken \?\? ""\)/);
  });

  it("uses the same saved payment document for public read-only", () => {
    const page = source("../app/q/[token]/page.tsx");
    const repository = source("../server/repositories/quotations.ts");
    const document = source("../components/admin/quotations/templates/quotation-document-current.tsx");
    const viewModel = source("../lib/quotation-document-view.ts");

    assert.match(page, /quotation\.payload/);
    assert.match(repository, /quotation_payment_methods/);
    assert.match(repository, /quotation_payment_methods\([\s\S]*account_type/);
    assert.match(repository, /document_template_snapshot/);
    assert.match(
      repository,
      /const template = normalizeQuotationTemplate\(row\.document_template_snapshot\)/,
    );
    assert.match(viewModel, /payload\.paymentMethods/);
    assert.match(document, /model\.paymentMethods/);
    assert.doesNotMatch(document, /internalNotes/);
  });

  it("expires public bearer links and lets only the owner rotate them", () => {
    const migration = source("../supabase/migrations/20260806103000_quotation_security_hardening.sql");
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(migration, /public_token_expires_at timestamptz/);
    assert.match(migration, /public_token_expires_at is null or q\.public_token_expires_at > now\(\)/);
    assert.match(migration, /private\.has_quotation_permission\(\)/);
    assert.match(migration, /q\.created_by = auth\.uid\(\)/);
    assert.match(editor, /rotateQuotationPublicTokenAction/);
    assert.match(editor, /รีเซ็ตลิงก์/);
  });

  it("passes the public saved template snapshot to the shared document dispatcher", () => {
    const page = source("../app/q/[token]/page.tsx");
    const dispatcher = source("../components/admin/quotations/quotation-document.tsx");

    assert.match(
      page,
      /<QuotationDocument[\s\S]*calculation=\{calculation\}[\s\S]*payload=\{quotation\.payload\}[\s\S]*publicQrDataUrl=\{publicQrDataUrl\}/,
    );
    assert.match(dispatcher, /payload\.template/);
    for (const renderer of [
      "CurrentQuotationDocument",
      "HospitalityQuotationDocument",
      "CorporateQuotationDocument",
    ]) {
      assert.match(dispatcher, new RegExp(renderer));
    }
  });

  it("keeps the public A4 document inside an intentional horizontal viewport", () => {
    const page = source("../app/q/[token]/page.tsx");
    const document = source(
      "../components/admin/quotations/templates/quotation-document-current.tsx",
    );

    assert.match(page, /data-public-quotation-viewport/);
    assert.match(page, /overflow-x-auto/);
    assert.match(page, /overscroll-x-contain/);
    assert.match(document, /w-\[210mm\]/);
    assert.doesNotMatch(page, /grid-cols|data-public-card/);
  });

  it("uses a generic Thai not-found state for invalid public quotations", () => {
    const notFoundPage = source("../app/q/[token]/not-found.tsx");

    assert.match(notFoundPage, /ไม่พบใบเสนอราคา/);
    assert.match(
      notFoundPage,
      /ลิงก์อาจไม่ถูกต้องหรือเอกสารถูกนำออกแล้ว/,
    );
    assert.doesNotMatch(notFoundPage, /token|database|Supabase|error/i);
  });
});
