import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { waitForQuotationPrintImages } from "../lib/quotation-print.ts";

class FakeImage extends EventTarget {
  complete: boolean;
  decode: () => Promise<void>;

  constructor({ complete = false, decode = async () => {} }: { complete?: boolean; decode?: () => Promise<void> } = {}) {
    super();
    this.complete = complete;
    this.decode = decode;
  }
}

describe("quotation print image readiness", () => {
  it("waits for complete images to decode", async () => {
    let release = () => {};
    const image = new FakeImage({
      complete: true,
      decode: () => new Promise<void>((resolve) => {
        release = resolve;
      }),
    });
    let settled = false;
    const waiting = waitForQuotationPrintImages([image], { timeoutMs: 1_000 }).then((value) => {
      settled = true;
      return value;
    });

    await Promise.resolve();
    assert.equal(settled, false);
    release();
    assert.equal(await waiting, true);
  });

  it("waits for pending image load and tolerates decode failure", async () => {
    const image = new FakeImage({ decode: async () => { throw new Error("broken"); } });
    const waiting = waitForQuotationPrintImages([image], { timeoutMs: 1_000 });
    image.dispatchEvent(new Event("error"));
    assert.equal(await waiting, true);
  });

  it("uses the timeout as a graceful print fallback", async () => {
    assert.equal(await waitForQuotationPrintImages([new FakeImage()], { timeoutMs: 5 }), true);
  });

  it("cancels a stale print request", async () => {
    const controller = new AbortController();
    const waiting = waitForQuotationPrintImages([new FakeImage()], {
      signal: controller.signal,
      timeoutMs: 1_000,
    });
    controller.abort();
    assert.equal(await waiting, false);
  });
});
