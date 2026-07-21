export interface QuotationPrintImage {
  readonly complete: boolean;
  addEventListener: EventTarget["addEventListener"];
  decode?: () => Promise<void>;
  removeEventListener: EventTarget["removeEventListener"];
}

export function waitForQuotationPrintImages(
  images: Iterable<QuotationPrintImage>,
  { signal, timeoutMs = 1_500 }: { signal?: AbortSignal; timeoutMs?: number } = {},
): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  const pending = [...images];
  if (!pending.length) return Promise.resolve(true);

  return new Promise((resolve) => {
    let remaining = pending.length;
    let settled = false;
    const removeListeners: Array<() => void> = [];
    const onAbort = () => finish(false);

    function finish(ready: boolean) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      removeListeners.forEach((remove) => remove());
      signal?.removeEventListener("abort", onAbort);
      resolve(ready);
    }

    function decoded(image: QuotationPrintImage) {
      Promise.resolve()
        .then(() => image.decode?.())
        .catch(() => undefined)
        .then(() => {
          remaining -= 1;
          if (remaining === 0) finish(true);
        });
    }

    for (const image of pending) {
      if (image.complete) {
        decoded(image);
        continue;
      }
      let handled = false;
      const onReady = () => {
        if (handled) return;
        handled = true;
        image.removeEventListener("load", onReady);
        image.removeEventListener("error", onReady);
        decoded(image);
      };
      image.addEventListener("load", onReady, { once: true });
      image.addEventListener("error", onReady, { once: true });
      removeListeners.push(() => {
        image.removeEventListener("load", onReady);
        image.removeEventListener("error", onReady);
      });
    }

    signal?.addEventListener("abort", onAbort, { once: true });
    const timeout = setTimeout(() => finish(true), Math.max(0, timeoutMs));
  });
}
