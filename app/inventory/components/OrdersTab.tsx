import styles from "../inventory.module.css";
import { DbItem } from "../types";

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

export function OrdersTab({ orders, onSelectOrder }: Props) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 1rem 2rem" }}>
      <h2 style={{ marginTop: 0 }}>🧾 Orders</h2>
      <p className={styles.muted}>
        Auto-generated from items that share the same purchase.orderId.
      </p>

      <div className={styles.invGrid}>
        {!orders.length ? (
          <div className={styles.invCard}>
            <h3 style={{ marginTop: 0 }}>No orders yet</h3>
            <p className={styles.muted}>
              Add purchase.orderId to items to group them.
            </p>
          </div>
        ) : (
          orders.map((o) => (
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
                {o.date} • {o.items.length} item(s)
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
