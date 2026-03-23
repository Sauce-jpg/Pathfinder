"use client";

import { useMemo, useState } from "react";
import styles from "../inventory.module.css";
import { DbItem } from "../types";
import { parseDate } from "../helpers";

type Order = {
  orderId:  string;
  store:    string;
  date:     string;
  orderRef: string;
  currency: string;
  total:    number;
  items:    DbItem[];
};

type Props = {
  orders: Order[];
  onSelectOrder: (orderId: string) => void;
};

type SortKey = "date-desc" | "date-asc" | "total-desc" | "total-asc";

export function OrdersTab({ orders, onSelectOrder }: Props) {
  const [q,         setQ]         = useState("");
  const [store,     setStore]     = useState("");
  const [dateFrom,  setDateFrom]  = useState("");
  const [dateTo,    setDateTo]    = useState("");
  const [sort,      setSort]      = useState<SortKey>("date-desc");

  const stores = useMemo(
    () => [...new Set(orders.map((o) => o.store).filter(Boolean))].sort(),
    [orders]
  );

  const filtered = useMemo(() => {
    let list = [...orders];

    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.store.toLowerCase().includes(lq) ||
          o.orderRef.toLowerCase().includes(lq) ||
          o.orderId.toLowerCase().includes(lq)
      );
    }

    if (store) {
      list = list.filter((o) => o.store === store);
    }

    if (dateFrom) {
      const from = new Date(dateFrom).getTime();
      list = list.filter((o) => {
        const t = parseDate(o.date)?.getTime();
        return t != null && t >= from;
      });
    }

    if (dateTo) {
      const to = new Date(dateTo).getTime();
      list = list.filter((o) => {
        const t = parseDate(o.date)?.getTime();
        return t != null && t <= to;
      });
    }

    list.sort((a, b) => {
      switch (sort) {
        case "date-asc":
          return (parseDate(a.date)?.getTime() || 0) - (parseDate(b.date)?.getTime() || 0);
        case "total-desc":
          return b.total - a.total;
        case "total-asc":
          return a.total - b.total;
        case "date-desc":
        default:
          return (parseDate(b.date)?.getTime() || 0) - (parseDate(a.date)?.getTime() || 0);
      }
    });

    return list;
  }, [orders, q, store, dateFrom, dateTo, sort]);

  const totalValue = useMemo(
    () => filtered.reduce((sum, o) => sum + o.total, 0),
    [filtered]
  );

  const currency = orders[0]?.currency ?? "SEK";

  function handleReset() {
    setQ("");
    setStore("");
    setDateFrom("");
    setDateTo("");
    setSort("date-desc");
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 2rem" }}>
      <h2 style={{ marginTop: 0 }}>🧾 Orders</h2>
      <p className={styles.muted}>
        Auto-generated from items that share the same purchase.orderId.
      </p>

      {/* Filter bar */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr auto",
          gap: "0.65rem",
          alignItems: "end",
          marginBottom: "0.75rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "0.25rem", fontWeight: 600 }}>
            Search
          </div>
          <input
            className={styles.invInput}
            type="search"
            placeholder="Store, ref, orderId…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "0.25rem", fontWeight: 600 }}>
            Store
          </div>
          <select
            className={styles.invSelect}
            value={store}
            onChange={(e) => setStore(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "0.25rem", fontWeight: 600 }}>
            From date
          </div>
          <input
            className={styles.invInput}
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "0.25rem", fontWeight: 600 }}>
            To date
          </div>
          <input
            className={styles.invInput}
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={{ width: "100%" }}
          />
        </div>

        <div>
          <div style={{ fontSize: "0.78rem", opacity: 0.55, marginBottom: "0.25rem", fontWeight: 600 }}>
            Sort
          </div>
          <select
            className={styles.invSelect}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            style={{ width: "100%" }}
          >
            <option value="date-desc">Date (new → old)</option>
            <option value="date-asc">Date (old → new)</option>
            <option value="total-desc">Total (high → low)</option>
            <option value="total-asc">Total (low → high)</option>
          </select>
        </div>

        <button className={styles.invBtn} onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* Meta row */}
      <div
        className={styles.invMeta}
        style={{ maxWidth: "100%", marginBottom: "0.75rem" }}
      >
        <span>
          {filtered.length} order{filtered.length === 1 ? "" : "s"}
          {filtered.length !== orders.length ? ` (of ${orders.length})` : ""}
        </span>
        {!!totalValue && (
          <span className={styles.muted}>
            Total: {totalValue.toLocaleString()} {currency}
          </span>
        )}
      </div>

      {/* Order cards */}
      <div className={styles.invGrid}>
        {!orders.length ? (
          <div className={styles.invCard}>
            <h3 style={{ marginTop: 0 }}>No orders yet</h3>
            <p className={styles.muted}>
              Add purchase.orderId to items to group them.
            </p>
          </div>
        ) : !filtered.length ? (
          <div className={styles.invCard}>
            <h3 style={{ marginTop: 0 }}>No orders match</h3>
            <p className={styles.muted}>Try adjusting your filters.</p>
          </div>
        ) : (
          filtered.map((o) => (
            <div
              key={o.orderId}
              className={styles.invCard}
              tabIndex={0}
              onClick={() => onSelectOrder(o.orderId)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectOrder(o.orderId);
              }}
            >
              <h3 style={{ margin: 0 }}>
                {o.store}
                {o.orderRef ? ` • ${o.orderRef}` : ""}
              </h3>
              <p className={styles.invSub}>
                {o.date} • {o.items.length} item{o.items.length === 1 ? "" : "s"}
              </p>
              {!!o.total && (
                <p className={styles.invSub}>
                  {o.total.toLocaleString()} {o.currency}
                </p>
              )}
              <div className={styles.badges}>
                <span className={styles.badge}>{o.orderId}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
