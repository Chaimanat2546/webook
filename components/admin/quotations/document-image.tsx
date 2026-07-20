"use client";

import { useState } from "react";

export function DocumentImage({ alt, className, src }: { alt: string; className: string; src: string }) {
  const [unavailable, setUnavailable] = useState(false);
  if (unavailable) return null;
  // eslint-disable-next-line @next/next/no-img-element -- Optional external certification assets must fail closed.
  return <img alt={alt} className={className} onError={() => setUnavailable(true)} src={src} />;
}
