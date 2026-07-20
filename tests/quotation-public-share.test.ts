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
    assert.match(page, /notFound\(\)/);
    assert.match(page, /robots:\s*\{\s*follow:\s*false,\s*index:\s*false/);
    assert.doesNotMatch(page, /requireAdmin|canUseQuotation/);
  });

  it("enables share only for a saved public token", () => {
    const editor = source("../components/admin/quotations/quotation-editor.tsx");
    assert.match(editor, /publicToken/);
    assert.match(editor, /navigator\.clipboard\.writeText/);
    assert.match(editor, /\/q\/\$\{publicToken\}/);
    assert.match(editor, /disabled=\{!publicToken/);
    assert.match(editor, /data-document-actions/);
  });

  it("uses the same saved payment document for public read-only", () => {
    const page = source("../app/q/[token]/page.tsx");
    const repository = source("../server/repositories/quotations.ts");
    const document = source("../components/admin/quotations/quotation-document.tsx");

    assert.match(page, /quotation\.payload/);
    assert.match(repository, /quotation_payment_methods/);
    assert.match(repository, /quotation_payment_methods\([\s\S]*account_type/);
    assert.match(document, /payload\.paymentMethods/);
    assert.doesNotMatch(document, /internalNotes/);
  });
});
