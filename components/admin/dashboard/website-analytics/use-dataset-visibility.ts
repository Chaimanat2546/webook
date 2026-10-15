"use client";

import { useState } from "react";
import type { WebsiteScopeSelection } from "../../../../lib/website-analytics-scope";
import type { WebsiteOption } from "./filters";

export function useDatasetVisibility(primary: WebsiteOption[], comparison: WebsiteOption[], scope?: WebsiteScopeSelection, context = "") {
  const sites = [...primary, ...comparison.filter(site => !primary.some(current => current.key === site.key))];
  const selected = scope?.sites;
  const identity = `${context}:${sites.map(site => site.key).sort().join(",")}`;
  const initial = selected?.some(key => sites.some(site => site.key === key)) ? sites.filter(site => !selected.includes(site.key)).map(site => site.key) : [];
  const [state, setState] = useState({ identity, hidden: initial });
  if (state.identity !== identity) setState({ identity, hidden: initial });
  const hidden = state.identity === identity ? state.hidden : initial;
  function toggle(key: string) {
    if (!sites.some(site => site.key === key)) return;
    if (!hidden.includes(key) && sites.length - hidden.length <= 1) return;
    setState({ identity, hidden: hidden.includes(key) ? hidden.filter(value => value !== key) : [...hidden, key] });
  }
  return { hidden, toggle };
}
