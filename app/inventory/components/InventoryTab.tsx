"use client";

import { useMemo, useState } from "react";
import styles from "../inventory.module.css";
import { DbItem, Filters, DEFAULT_FILTERS, CATEGORY_COLUMN_PRESETS } from "../types";
import { itemSearchText, getOrderId, parseDate, safeText, uniq } from "../helpers";
import { FilterBar } from "./FilterBar";
import { ItemCardGrid } from "./ItemCardGrid";
import { ItemTableView } from "./ItemTableView";

type ViewMode = "card" | "table";

type Props = {
  items: DbItem[];
  activeOrderId: string;
  onClearOrder: () => void;
  onSelectItem: (id: string) => void;
  loadError: string | null;
};

const PAGE_SIZE = 48;

export function InventoryTab({
  items,
  activeOrderId,
  onClearOrder,
  onSelectItem,
  loadError,
}: Props) {
  const [filters,    setFilters]    = useState<Filters>(DEFAULT_FILTERS);
  const [page,       setPage]       = useState(1);
  const [viewMode,   setViewMode]   = useState<ViewMode>("card");
  const [savedViews, setSavedViews] = useState<Record<string, Partial<Filters>>>({});

  const categories = useMemo(
    () => uniq(items.map((i) => i.category || "").filter(Boolean)),
    [items]
  );
  const locations = useMemo(
    () => uniq(items.map((i) => i.location || "").filter(Boolean)),
    [items]
  );

  // Count non-owned items that would be hidden
  const hiddenNonOwnedCount = useMemo(
    () => items.filter((i) => (i.status ?? "owned") !== "owned").length,
    [items]
  );

  const filtered = useMemo(() => {
    const q        = filters.q.trim().toLowerCase();
    const category = filters.category;
    const location = filters.location;
    const build    = filters.buildStatus;
    const paint    = filters.paintStatus;
    const sort     = filters.sort;
    const status   = filters.status;

    let list = [...items];

    // Hide non-owned by default unless toggled or filtering by status
    if (!filters.showNonOwned && !status) {
      list = list.filter((it) => ["owned", "household"].includes(it.status ?? "owned"));
    }

    if (activeOrderId)
      list = list.filter((it) => getOrderId(it) === activeOrderId);
    if (q)
      list = list.filter((it) => itemSearchText(it).includes(q));
    if (category)
      list = list.filter((it) => (it.category || "") === category);
    if (location)
      list = list.filter((it) => (it.location || "") === location);
    if (status)
      list = list.filter((it) => (it.status ?? "owned") === status);
    if (build)
      list = list.filter(
        (it) => it.type === "miniatures" && (it.specs?.buildStatus || "") === build
      );
    if (paint)
      list = list.filter(
        (it) => it.type === "miniatures" && (it.specs?.paintStatus || "") === paint
      );

    list.sort((a, b) => {
      switch (sort) {
        case "name-desc":
          return safeText(b.name).localeCompare(safeText(a.name));
        case "date-desc": {
          const da = parseDate(a.purchase?.date);
          const db = parseDate(b.purchase?.date);
          return (db?.getTime() || 0) - (da?.getTime() || 0);
        }
        case "date-asc": {
          const da = parseDate(a.purchase?.date);
          const db = parseDate(b.purchase?.date);
          return (da?.getTime() || 0) - (db?.getTime() || 0);
        }
        case "price-desc":
          return (Number(b.purchase?.price) || 0) - (Number(a.purchase?.price) || 0);
        case "price-asc":
          return (Number(a.purchase?.price) || 0) - (Number(b.purchase?.price) || 0);
        case "name-asc":
        default:
          return safeText(a.name).localeCompare(safeText(b.name));
      }
    });

    return list;
  }, [items, filters, activeOrderId]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
    [filtered.length]
  );

  const pageItems = useMemo(() => {
    const p     = Math.min(page, totalPages);
    const start = (p - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page, totalPages]);

  function handleFiltersChange(next: Filters) {
    setFilters(next);
    setPage(1);
  }

  function handleCsvExport() {
    const rows = filtered.map((it) => ({
      id:          it.id,
      name:        it.name,
      status:      it.status      ?? "owned",
      category:    it.category    || "",
      type:        it.type        || "",
      quantity:    it.quantity    ?? 1,
      location:    it.location    || "",
      buildStatus: it.specs?.buildStatus || "",
      paintStatus: it.specs?.paintStatus || "",
      price:       it.purchase?.price    ?? "",
      currency:    it.purchase?.currency ?? "",
      date:        it.purchase?.date     ?? "",
      orderId:     it.purchase?.orderId  ?? "",
      store:       it.purchase?.store    ?? "",
      orderRef:    it.purchase?.orderRef ?? "",
      tags:        (it.tags || []).join(" "),
    }));

    if (!rows.length) {
      alert("Nothing to export (no items in current view).");
      return;
    }

    const headers = Object.keys(rows[0]);
    const csv = [
      headers.join(","),
      ...rows.map((r) =>
        headers
          .map((h) => `"${String((r as any)[h] ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `inventory-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <FilterBar
        filters={filters}
        onChange={handleFiltersChange}
        categories={categories}
        locations={locations}
        activeOrderId={activeOrderId}
        onClearOrder={() => { onClearOrder(); setPage(1); }}
        filteredCount={filtered.length}
        hiddenNonOwnedCount={hiddenNonOwnedCount}
        savedViews={savedViews}
        onSavedViewsChange={setSavedViews}
      />

      {/* View toggle + CSV export */}
      <div style={{
        maxWidth: 1100, margin: "0 auto 0.75rem",
        padding: "0 1rem",
        display: "flex", alignItems: "center", gap: "0.5rem",
      }}>
        <button
          className={`${styles.invBtn} ${viewMode === "card" ? styles.invTabActive : ""}`}
          onClick={() => setViewMode("card")}
          title="Card view"
        >
          ⊞ Cards
        </button>
        <button
          className={`${styles.invBtn} ${viewMode === "table" ? styles.invTabActive : ""}`}
          onClick={() => setViewMode("table")}
          title="Table view"
        >
          ☰ Table
        </button>
        <div style={{ marginLeft: "auto" }}>
          <button className={styles.invBtn} onClick={handleCsvExport}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {loadError && (
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 1rem", color: "crimson" }}>
          Error: {loadError}
        </div>
      )}

      {viewMode === "card" ? (
        <ItemCardGrid
          items={pageItems}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onSelectItem={onSelectItem}
        />
      ) : (
        <ItemTableView
          items={pageItems}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          onSelectItem={onSelectItem}
          activeCategory={filters.category}
        />
      )}
    </>
  );
}
