import type { DbItem, Filters, ColumnKey } from "./types";
import { CATEGORY_COLUMN_PRESETS } from "./types";

export function safeText(v: any): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

export function parseDate(d?: string | null): Date | null {
  if (!d) return null;
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function fmtMoney(purchase: any): string {
  if (!purchase || purchase.price == null) return "";
  const cur = purchase.currency || "";
  const price = Number(purchase.price);
  if (Number.isNaN(price)) return "";
  return `${price.toLocaleString()} ${cur}`.trim();
}

export function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

export function slugifyId(input: string): string {
  return String(input || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
}

export function itemSearchText(item: DbItem): string {
  return [
    item.name,
    item.brand,
    item.model,
    item.category,
    item.type,
    item.location,
    ...(item.tags || []),
  ]
    .map(safeText)
    .join(" ")
    .toLowerCase();
}

export function getOrderId(item: DbItem): string {
  return (item as any).orderId || (item.purchase && item.purchase.orderId) || "";
}

export function humanKey(key: string): string {
  return String(key)
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function getViews(): Record<string, Partial<Filters>> {
  try {
    return JSON.parse(localStorage.getItem("inventoryViews") || "{}");
  } catch {
    return {};
  }
}

export function setViews(v: Record<string, Partial<Filters>>): void {
  localStorage.setItem("inventoryViews", JSON.stringify(v));
}

// Returns the appropriate column set for the current category filter.
// User overrides (stored in localStorage) are merged on top.
export function resolveColumns(activeCategory: string): ColumnKey[] {
  const preset =
    CATEGORY_COLUMN_PRESETS[activeCategory] ??
    CATEGORY_COLUMN_PRESETS["default"];

  try {
    const saved = localStorage.getItem("inventoryColumnOverrides");
    if (!saved) return preset;
    const overrides: Partial<Record<string, ColumnKey[]>> = JSON.parse(saved);
    const key = activeCategory || "default";
    return overrides[key] ?? preset;
  } catch {
    return preset;
  }
}

export function saveColumnOverride(activeCategory: string, cols: ColumnKey[]): void {
  try {
    const saved = localStorage.getItem("inventoryColumnOverrides");
    const overrides = saved ? JSON.parse(saved) : {};
    overrides[activeCategory || "default"] = cols;
    localStorage.setItem("inventoryColumnOverrides", JSON.stringify(overrides));
  } catch {}
}
