"use client";

import Link from "next/link";
import { createContext, useContext, useEffect, useRef, type MouseEvent, type ReactNode } from "react";
import { dashboardLocation, dashboardReturnState, type DashboardReturnState } from "../../../lib/dashboard-return";
import { Button } from "../../ui/button";

const ReturnContext = createContext<(href: string) => void>(() => {});
const storageKey = "webook:dashboard:return";

function scrollContainer(element: HTMLElement): HTMLElement | null {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return null;
}

export function DashboardNavigationContext({ scopeKey, sourceHref, children }: { scopeKey: string; sourceHref?: string; children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const key = `${storageKey}:${scopeKey}`;
  useEffect(() => {
    try {
      // Only one scope/month is active. Do not retain state after switching identity or month.
      for (let index = sessionStorage.length - 1; index >= 0; index--) {
        const entry = sessionStorage.key(index);
        if (entry?.startsWith(storageKey + ":") && entry !== key) sessionStorage.removeItem(entry);
      }
      const state = dashboardReturnState(sessionStorage.getItem(key), location.pathname + location.search);
      if (!state) return;
      const frame = requestAnimationFrame(() => {
        if (!root.current) return;
        sessionStorage.removeItem(key);
        const container = scrollContainer(root.current);
        if (container) container.scrollTo({ top: state.scrollTop, behavior: "instant" });
        else window.scrollTo({ top: state.scrollTop, behavior: "instant" });
        document.getElementById(state.originId)?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    } catch { /* Storage-disabled sessions still use normal navigation. */ }
  }, [children, key]);

  function record(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[data-dashboard-detail-link]") : null;
    if (!target || !root.current) return;
    const detailHref = target.getAttribute("href") ?? "";
    if (!dashboardLocation(detailHref)) return;
    const container = scrollContainer(root.current);
    const state: DashboardReturnState = { sourceHref: sourceHref ?? location.pathname + location.search, detailHref, originId: target.id, scrollTop: container?.scrollTop ?? window.scrollY, pending: false };
    try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Optional restoration. */ }
  }

  function markReturn(href: string) {
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      const pending: unknown = JSON.parse(raw);
      if (!pending || typeof pending !== "object") return;
      const state = dashboardReturnState(JSON.stringify({ ...pending, pending: true }), href);
      if (state && dashboardLocation(state.detailHref) === dashboardLocation(location.pathname + location.search)) sessionStorage.setItem(key, JSON.stringify(state));
    } catch { /* Direct links need no history entry. */ }
  }
  return <ReturnContext.Provider value={markReturn}><div ref={root} onClickCapture={record}>{children}</div></ReturnContext.Provider>;
}

export function DashboardBackLink({ href, label }: { href: string; label: string }) {
  const markReturn = useContext(ReturnContext);
  return <Button asChild variant="outline" className="min-h-11"><Link href={href} onClick={event => {
    if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) markReturn(href);
  }}>{label}</Link></Button>;
}
