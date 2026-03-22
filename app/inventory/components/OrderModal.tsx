"use client";

import styles from "../inventory.module.css";
import { DbItem } from "../types";
import { Modal } from "./Modal";

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
  order: Order | null;
  onClose: () => void;
  onFilterByOrder: (orderId: string) => void;
  onSelectItem: (id: string) => void;
};

export function OrderModal({ order, onClose, onFilterByOrder, onSelectItem }: Props) {
  return (
    <Modal open={!!order} onClose={onClose}>
      {order && (
        <div>
          <h2 style={{ marginTop: 0 }}>
            {order.store}
            {order.orderRef ? ` • ${order.orderRef}` : ""}
          </h2>

          <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
            {order.date} • {order.items.length} item(s)
          </p>
          {!!order.total && (
            <p className={styles.muted}>
              Total: {order.total.toLocaleString()} {order.currency}
            </p>
          )}

          <button
            className={styles.invBtn}
            style={{ margin: "0.5rem 0 1rem" }}
            onClick={() => {
              onFilterByOrder(order.orderId);
              onClose();
            }}
          >
            Filter inventory by this order
          </button>

          <h3>Items</h3>
          <div className={styles.setupItems}>
            {order.items.map((it) => (
              <div
                key={it.id}
                className={styles.setupItemRow}
                role="button"
                tabIndex={0}
                onClick={() => { onClose(); onSelectItem(it.id); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onClose();
                    onSelectItem(it.id);
                  }
                }}
              >
                <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                  {it.images?.[0] ? (
                    <img className={styles.invThumb} src={it.images[0]} alt="" />
                  ) : (
                    <div className={styles.invThumb} aria-hidden="true" />
                  )}
                  <div>
                    <div style={{ fontWeight: 800 }}>{it.name}</div>
                    <div className={styles.muted} style={{ fontSize: "0.95rem" }}>
                      {[it.brand, it.model].filter(Boolean).join(" • ")}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
