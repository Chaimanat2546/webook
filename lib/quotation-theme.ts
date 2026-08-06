import type { QuotationTemplate } from "./quotation-template";

export const QUOTATION_TEMPLATE_THEME_COLORS: Record<QuotationTemplate, string> = {
  corporate: "#142D4C",
  current: "#6366F1",
  hospitality: "#286A5B",
};

export interface QuotationThemePalette {
  border: string;
  contrast: string;
  dark: string;
  light: string;
  muted: string;
  primary: string;
}

export function isQuotationThemeColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

export function normalizeQuotationThemeColor(
  value: unknown,
  template: QuotationTemplate,
): string {
  return isQuotationThemeColor(value)
    ? value.toUpperCase()
    : QUOTATION_TEMPLATE_THEME_COLORS[template];
}

function mixHex(left: string, right: string, rightWeight: number): string {
  const channel = (value: string, offset: number) => Number.parseInt(value.slice(offset, offset + 2), 16);
  const mixed = [1, 3, 5].map((offset) => Math.round(
    channel(left, offset) * (1 - rightWeight) + channel(right, offset) * rightWeight,
  ));
  return `#${mixed.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function quotationThemePalette(primaryColor: string): QuotationThemePalette {
  const primary = isQuotationThemeColor(primaryColor) ? primaryColor.toUpperCase() : "#6366F1";
  const red = Number.parseInt(primary.slice(1, 3), 16);
  const green = Number.parseInt(primary.slice(3, 5), 16);
  const blue = Number.parseInt(primary.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return {
    border: mixHex(primary, "#FFFFFF", 0.72),
    contrast: luminance > 0.62 ? "#0F172A" : "#FFFFFF",
    dark: mixHex(primary, "#000000", 0.2),
    light: mixHex(primary, "#FFFFFF", 0.9),
    muted: mixHex(primary, "#FFFFFF", 0.45),
    primary,
  };
}
