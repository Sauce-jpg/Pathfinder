"use client";

import { useState, useEffect, useRef } from "react";
import styles from "../inventory.module.css";
import tableStyles from "./ItemTableView.module.css";
import { DbItem, ColumnKey, ColumnDef, ALL_COLUMNS } from "../types";
import { fmtMoney, safeText, resolveColumns, saveColumnOverride } from "../helpers";
import { Specs } from "./Specs";

type Props = {
  items: DbItem[];
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onSelectItem: (id: string) => void;
  activeCategory: string;
};

function cellValue(col: ColumnKey, item: DbItem): React.ReactNode {
  switch (col) {
    case "name":
      return (
        <span style={{ fontWeight: 600 }}>{item.name}</span>
      );
    case "brand_model": {
      const parts = [item.brand, item.model].filter(Boolean).map(safeText);
      return parts.join(" · ") || <span style={{ opacity: 0.35 }}>—</span>;
    }
    case "category":
      return item.category || <span style={{ opacity: 0.35 }}>—</span>;
    case "type":
      return item.type || <span style={{ opacity: 0.35 }}>—</span>;
    case "location":
      return item.location
        ? <span>📍 {item.location}</span>
        : <span style={{ opacity: 0.35 }}>—</span>;
    case "price":
      return fmtMoney(item.purchase) || <span style={{ opacity: 0.35 }}>—</span>;
    case "date":
      return item.purchase?.date || <span style={{ opacity: 0.35 }}>—</span>;
    case "tags":
      return (item.tags || []).length
        ? (item.tags || []).slice(0, 4).map((t) => (
            <span key={t} className={tableStyles.tagPill}>#{t}</span>
          ))
        : <span style={{ opacity: 0.35 }}>—</span>;
    case "quantity":
      return item.quantity ?? 1;
    case "build_status":
      return item.specs?.buildStatus || <span style={{ opacity: 0.35 }}>—</span>;
    case "paint_status":
      return item.specs?.paintStatus || <span style={{ opacity: 0.35 }}>—</span>;
    default:
      return null;
  }
}

function ExpandedRow({
  item,
  colCount,
  onSelectItem,
}: {
  item: DbItem;
  colCount: number;
  onSelectItem: (id: string) => void;
}) {
  const money = fmtMoney(item.purchase);

  return (
    <tr className={tableStyles.expandedRow}>
      <td colSpan={colCount + 1} className={tableStyles.expandedCell}>
        <div className={tableStyles.expandedInner}>

          {/* Left: core details */}
          <div className={tableStyles.expandedSection}>
            <div className={tableStyles.expandedSectionTitle}>Details</div>
            <table className={tableStyles.kvTable}>
              <tbody>
                {item.brand  && <tr><td className={tableStyles.kvKey}>Brand</td><td>{item.brand}</td></tr>}
                {item.model  && <tr><td className={tableStyles.kvKey}>Model</td><td>{item.model}</td></tr>}
                {item.type   && <tr><td className={tableStyles.kvKey}>Type</td><td>{item.type}</td></tr>}
                {item.category && <tr><td className={tableStyles.kvKey}>Category</td><td>{item.category}</td></tr>}
                {item.location && <tr><td className={tableStyles.kvKey}>Location</td><td>📍 {item.location}</td></tr>}
                {item.quantity != null && <tr><td className={tableStyles.kvKey}>Quantity</td><td>{item.quantity}</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Middle: purchase */}
          <div className={tableStyles.expandedSection}>
            <div className={tableStyles.expandedSectionTitle}>Purchase</div>
            <table className={tableStyles.kvTable}>
              <tbody>
                {item.purchase?.date     && <tr><td className={tableStyles.kvKey}>Date</td><td>{item.purchase.date}</td></tr>}
                {money                   && <tr><td className={tableStyles.kvKey}>Price</td><td>{money}</td></tr>}
                {item.purchase?.store    && <tr><td className={tableStyles.kvKey}>Store</td><td>{item.purchase.store}</td></tr>}
                {item.purchase?.orderRef && <tr><td className={tableStyles.kvKey}>Order ref</td><td>{item.purchase.orderRef}</td></tr>}
              </tbody>
            </table>

            {/* Tags + notes */}
            {!!(item.tags || []).length && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className={tableStyles.expandedSectionTitle}>Tags</div>
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", marginTop: "0.35rem" }}>
                  {item.tags.map((t) => (
                    <span key={t} className={tableStyles.tagPill}>#{t}</span>
                  ))}
                </div>
              </div>
            )}

            {item.notes && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className={tableStyles.expandedSectionTitle}>Notes</div>
                <p style={{ margin: "0.35rem 0 0", fontSize: "0.92rem" }}>{item.notes}</p>
              </div>
            )}
          </div>

          {/* Right: mini specs preview */}
          {item.specs && Object.keys(item.specs).length > 0 && (
            <div className={tableStyles.expandedSection} style={{ flex: "1.2" }}>
              <div className={tableStyles.expandedSectionTitle}>Specs</div>
              <div style={{ maxHeight: 220, overflowY: "auto" }}>
                <Specs specs={item.specs} />
              </div>
            </div>
          )}

          {/* Open full modal button */}
          <div className={tableStyles.expandedActions}>
            <button
              className={styles.invBtn}
              onClick={() => onSelectItem(item.id)}
            >
              Open full detail →
            </button>
          </div>

        </div>
      </td>
    </tr>
  );
}

function ColumnPicker({
  allColumns,
  visible,
  onChange,
  onReset,
}: {
  allColumns: ColumnDef[];
  visible: ColumnKey[];
  onChange: (cols: ColumnKey[]) => void;
  onReset: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  function toggle(key: ColumnKey) {
    if (visible.includes(key)) {
      if (visible.length === 1) return; // always keep at least one
      onChange(visible.filter((k) => k !== key));
    } else {
      // insert at natural ALL_COLUMNS order
      const next = allColumns
        .map((c) => c.key)
        .filter((k) => visible.includes(k) || k === key);
      onChange(next);
    }
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        className={styles.invBtn}
        onClick={() => setOpen((v) => !v)}
        title="Choose columns"
      >
        ⊞ Columns
      </button>

      {open && (
        <div className={tableStyles.columnPickerDropdown}>
          <div className={tableStyles.columnPickerTitle}>Visible columns</div>
          {allColumns.map((col) => {
            const checked = visible.includes(col.key);
            return (
              <label key={col.key} className={tableStyles.columnPickerRow}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(col.key)}
                />
                <span>{col.label}</span>
              </label>
            );
          })}
          <button
            className={tableStyles.columnPickerReset}
            onClick={() => { onReset(); setOpen(false); }}
          >
            Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

export function ItemTableView({
  items,
  page,
  totalPages,
  onPageChange,
  onSelectItem,
  activeCategory,
}: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColumnKey[]>(() =>
    resolveColumns(activeCategory)
  );

  // Update columns when category filter changes
  useEffect(() => {
    setVisibleCols(resolveColumns(activeCategory));
    setExpandedId(null);
  }, [activeCategory]);

  function handleColChange(cols: ColumnKey[]) {
    setVisibleCols(cols);
    saveColumnOverride(activeCategory, cols);
  }

  function handleColReset() {
    const { CATEGORY_COLUMN_PRESETS } = require("../types");
    const preset =
      CATEGORY_COLUMN_PRESETS[activeCategory] ??
      CATEGORY_COLUMN_PRESETS["default"];
    setVisibleCols(preset);
    saveColumnOverride(activeCategory, preset);
  }

  function toggleRow(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const activeCols = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));

  return (
    <div className={tableStyles.wrapper}>
      {/* Column picker toolbar */}
      <div className={tableStyles.toolbar}>
        <ColumnPicker
          allColumns={ALL_COLUMNS}
          visible={visibleCols}
          onChange={handleColChange}
          onReset={handleColReset}
        />
        <span className={styles.muted} style={{ fontSize: "0.88rem" }}>
          {activeCols.length} column{activeCols.length === 1 ? "" : "s"} visible
          {activeCategory ? ` · defaults for "${activeCategory}"` : ""}
        </span>
      </div>

      {/* Table */}
      <div className={tableStyles.tableScroll}>
        <table className={tableStyles.table}>
          <thead>
            <tr>
              <th className={tableStyles.th} style={{ width: 32 }} />
              {activeCols.map((col) => (
                <th
                  key={col.key}
                  className={tableStyles.th}
                  style={{ minWidth: col.defaultWidth }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={activeCols.length + 1}
                  style={{ padding: "2rem", textAlign: "center", opacity: 0.5 }}
                >
                  No items match your filters.
                </td>
              </tr>
            )}

            {items.map((item) => {
              const isExpanded = expandedId === item.id;
              return (
                <>
                  <tr
                    key={item.id}
                    className={`${tableStyles.row} ${isExpanded ? tableStyles.rowExpanded : ""}`}
                    onClick={() => toggleRow(item.id)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleRow(item.id);
                    }}
                  >
                    <td className={tableStyles.td} style={{ textAlign: "center", color: "var(--color-text-secondary)" }}>
                      <span className={tableStyles.expandChevron} data-open={isExpanded}>
                        ›
                      </span>
                    </td>
                    {activeCols.map((col) => (
                      <td key={col.key} className={tableStyles.td}>
                        {cellValue(col.key, item)}
                      </td>
                    ))}
                  </tr>

                  {isExpanded && (
                    <ExpandedRow
                      key={`${item.id}-expanded`}
                      item={item}
                      colCount={activeCols.length}
                      onSelectItem={onSelectItem}
                    />
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pager */}
      <div className={styles.invPager}>
        <button
          className={styles.invBtn}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
        >
          ← Prev
        </button>
        <span className={styles.muted}>
          Page {Math.min(page, totalPages)} / {totalPages}
        </span>
        <button
          className={styles.invBtn}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page >= totalPages}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
