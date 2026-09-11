"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize, Minus, Plus } from "lucide-react";
import { documentFitScale } from "../../../lib/document-preview";
import { Button } from "../../ui/button";

export function DocumentPreview({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  const document = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0, fit: 1 });
  const [zoom, setZoom] = useState(1);
  useEffect(() => {
    const area = viewport.current;
    const page = document.current;
    if (!area || !page) return;
    const observer = new ResizeObserver(() => {
      const width = page.offsetWidth;
      const height = page.offsetHeight;
      const fit = documentFitScale(area.offsetWidth - 24, area.offsetHeight - 24, width, height);
      setSize(previous => previous.width === width && previous.height === height && previous.fit === fit ? previous : { width, height, fit });
    });
    observer.observe(area);
    observer.observe(page);
    return () => observer.disconnect();
  }, []);
  const scale = size.fit * zoom;
  const maxZoom = Math.max(4, 2 / size.fit);
  return <div className="flex min-h-0 flex-1 flex-col">
    <div aria-label="ขนาดตัวอย่างเอกสาร" className="flex shrink-0 items-center justify-center gap-2 border-b p-2">
      <Button aria-label="ย่อเอกสาร" className="min-h-12 min-w-12" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.5))} type="button" variant="outline"><Minus aria-hidden /></Button>
      <Button className="min-h-12" onClick={() => { setZoom(1); viewport.current?.scrollTo({ top: 0, left: 0 }); }} type="button" variant="outline"><Maximize aria-hidden />เต็มหน้า</Button>
      <Button aria-label="ขนาดจริง 100 เปอร์เซ็นต์" className="min-h-12" onClick={() => setZoom(1 / size.fit)} type="button" variant="outline">100%</Button>
      <Button aria-label="ขยายเอกสาร" className="min-h-12 min-w-12" disabled={zoom >= maxZoom} onClick={() => setZoom(value => Math.min(maxZoom, value + 0.5))} type="button" variant="outline"><Plus aria-hidden /></Button>
    </div>
    <div ref={viewport} aria-label="ตัวอย่างเอกสาร" className="min-h-0 flex-1 overflow-auto bg-muted/40 p-3 touch-auto">
      <div className="relative mx-auto overflow-hidden" style={{ width: size.width * scale, height: size.height * scale }}>
        <div ref={document} className="absolute left-0 top-0 w-max origin-top-left" style={{ transform: `scale(${scale})`, visibility: size.width ? "visible" : "hidden" }}>{children}</div>
      </div>
    </div>
  </div>;
}
