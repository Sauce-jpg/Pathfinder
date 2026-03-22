"use client";

import styles from "../inventory.module.css";
import { DEFAULT_FILTERS, Filters } from "../types";
import { getViews, setViews } from "../helpers";

type Props = {
  filters: Filters;
  onChange: (f: Filters) => void;
  categories: string[];
  locations: string[];
  activeOrderId: string;
  onClearOrder: () => void;
  filteredCount: number;
  savedViews: Record<string, Partial<Filters>>;
  onSavedViewsChange: (v: Record<string, Partial<Filters>>) => void;
};

export function FilterBar({
  filters,
  onChange,
  categories,
  locations,
  activeOrderId,
  onClearOrder,
  filteredCount,
  savedViews,
  onSavedViewsChange,
}: Props) {
  function set(patch: Partial<Filters>) {
    onChange({ ...filters, ...patch });
  }

  function handleLoadView(name: string) {
    if (!name) return;
    const view = savedViews[name];
    if (!view) return;
    onChange({
      ...filters,
      q:           view.q           ?? filters.q,
      category:    view.category    ?? filters.category,
      location:    view.location    ?? filters.location,
      buildStatus: view.buildStatus ?? filters.buildStatus,
      paintStatus: view.paintStatus ?? filters.paintStatus,
      sort:        view.sort        ?? filters.sort,
    });
  }

  function handleSaveView() {
    const name = prompt("Name this view:");
    if (!name) return;
    const next = { ...savedViews, [name]: { ...filters } };
    setViews(next);
    onSavedViewsChange(next);
  }

  function handleDeleteView() {
    const name = prompt("Delete which view? (type exact name)");
    if (!name) return;
    if (!savedViews[name]) { alert("No such view."); return; }
    if (!confirm(`Delete view "${name}"?`)) return;
    const next = { ...savedViews };
    delete next[name];
    setViews(next);
    onSavedViewsChange(next);
  }

  function handleReset() {
    onChange(DEFAULT_FILTERS);
    onClearOrder();
  }

  return (
    <>
      <div className={styles.invControls}>
        <input
          className={styles.invInput}
          type="search"
          placeholder="Search name / model / tags..."
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
        />

        <select
          className={styles.invSelect}
          value={filters.category}
          onChange={(e) => set({ category: e.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          className={styles.invSelect}
          value={filters.location}
          onChange={(e) => set({ location: e.target.value })}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>

        <select
          className={styles.invSelect}
          value={filters.buildStatus}
          onChange={(e) => set({ buildStatus: e.target.value })}
        >
          <option value="">Build: All</option>
          <option value="boxed">Boxed</option>
          <option value="partiallyBuilt">Partially built</option>
          <option value="assembled">Assembled</option>
          <option value="primed">Primed</option>
        </select>

        <select
          className={styles.invSelect}
          value={filters.paintStatus}
          onChange={(e) => set({ paintStatus: e.target.value })}
        >
          <option value="">Paint: All</option>
          <option value="unpainted">Unpainted</option>
          <option value="wip">WIP</option>
          <option value="finished">Finished</option>
          <option value="mixed">Mixed</option>
        </select>

        <select
          className={styles.invSelect}
          value={filters.sort}
          onChange={(e) =>
            set({ sort: e.target.value as Filters["sort"] })
          }
        >
          <option value="name-asc">Sort: Name (A → Z)</option>
          <option value="name-desc">Sort: Name (Z → A)</option>
          <option value="date-desc">Sort: Purchase date (new → old)</option>
          <option value="date-asc">Sort: Purchase date (old → new)</option>
          <option value="price-desc">Sort: Price (high → low)</option>
          <option value="price-asc">Sort: Price (low → high)</option>
        </select>

        {/* Saved views */}
        <select
          className={styles.invSelect}
          value=""
          onChange={(e) => {
            handleLoadView(e.target.value);
            e.target.value = "";
          }}
        >
          <option value="">Saved views…</option>
          {Object.keys(savedViews).sort().map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        <button className={styles.invBtn} onClick={handleSaveView}>
          💾 Save view
        </button>

        <button className={styles.invBtn} onClick={handleDeleteView}>
          🗑 Delete
        </button>

        <button className={styles.invBtn} onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* Meta row */}
      <div className={styles.invMeta}>
        <span>
          {filteredCount} item{filteredCount === 1 ? "" : "s"}
          {activeOrderId ? ` • Order: ${activeOrderId}` : ""}
        </span>
        {activeOrderId && (
          <button className={styles.invBtn} onClick={onClearOrder}>
            Clear order filter
          </button>
        )}
      </div>
    </>
  );
}
