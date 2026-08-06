import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { canUseHospitalitySideBySideSettlement } from "../lib/quotation-hospitality-layout.ts";

describe("Hospitality quotation layout", () => {
  it("flows a long payment list above its settlement panel", () => {
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 20, publicNotesLength: 80 }),
      false,
    );
  });

  it("keeps content at the exact compact boundary beside its settlement panel", () => {
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 2, publicNotesLength: 250 }),
      true,
    );
  });

  it("flows content that exceeds either compact boundary", () => {
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 3, publicNotesLength: 250 }),
      false,
    );
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 2, publicNotesLength: 251 }),
      false,
    );
  });

  it("flows compact-count payments when their instructions are long", () => {
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 2, publicNotesLength: 80, paymentContentLength: 2001 }),
      false,
    );
  });

  it("keeps the exact rendered-payment estimate boundary deterministic", () => {
    assert.equal(canUseHospitalitySideBySideSettlement({ paymentMethodCount: 1, publicNotesLength: 80, paymentContentLength: 1800 }), true);
    assert.equal(canUseHospitalitySideBySideSettlement({ paymentMethodCount: 1, publicNotesLength: 80, paymentContentLength: 1801 }), false);
  });

  it("keeps compact payments without QR artwork beside their settlement panel", () => {
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 2, publicNotesLength: 80, hasPaymentQr: false }),
      true,
    );
  });

  it("flows one or more QR-bearing payments to the safe sequential layout", () => {
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 1, publicNotesLength: 80, hasPaymentQr: true }),
      false,
    );
    assert.equal(
      canUseHospitalitySideBySideSettlement({ paymentMethodCount: 2, publicNotesLength: 80, hasPaymentQr: true }),
      false,
    );
  });

  it("lets the HTML long-payment path flow as sequential print content", () => {
    const document = readFileSync(
      new URL("../components/admin/quotations/templates/quotation-document-hospitality.tsx", import.meta.url),
      "utf8",
    );
    const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

    assert.match(document, /canUseHospitalitySideBySideSettlement/);
    assert.match(document, /data-hospitality-summary-sequential/);
    assert.match(css, /\[data-hospitality-summary-sequential\][\s\S]*break-inside: auto !important/);
  });

  it("does not apply a zero-basis grow style to the sequential PDF payment content", () => {
    const pdf = readFileSync(
      new URL("../components/admin/quotations/templates/quotation-pdf-hospitality.tsx", import.meta.url),
      "utf8",
    );

    assert.match(pdf, /canUseSideBySideSettlement \? styles\.paymentColumn : undefined/);
  });
});
