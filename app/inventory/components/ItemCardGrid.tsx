"use client";

import styles from "../inventory.module.css";
import { DbItem } from "../types";
import { fmtMoney, safeText } from "../helpers";

type Props = {
  items: DbItem[];
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onSelectItem: (id: string) => void;
};

export function ItemCardGrid({
  items,
  page,
  totalPages,
  onPageChange,
  onSelectItem,
}: Props) {
  return (
    <>
      <div className={styles.invGrid}>
        {items.map((it) => {
          const thumb = it.images?.[0] || "";

          const subtitleParts = [
            it.brand && it.model
              ? `${it.brand} ${it.model}`
              : it.model || it.brand || "",
            it.location ? `📍 ${it.location}` : "",
          ].filter(Boolean);

          const money = fmtMoney(it.purchase);
          const date  = it.purchase?.date ?? "";

          const isMini       = it.type === "miniatures";
          const buildStatus  = isMini ? (it.specs?.buildStatus || "") : "";
          const paintStatus  = isMini ? (it.specs?.paintStatus || "") : "";

          return (
            <div
              key={it.id}
              className={styles.invCard}
              tabIndex={0}
              onClick={() => onSelectItem(it.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onSelectItem(it.id);
              }}
            >
              <div className={styles.invCardTop}>
                {thumb ? (
                  <img className={styles.invThumb} src={thumb} alt="" />
                ) : (
                  <div className={styles.invThumb} aria-hidden="true" />
                )}

                <div>
                  <h3 style={{ margin: 0, fontSize: "1.05rem" }}>{it.name}</h3>
                  <p className={styles.invSub}>
                    {subtitleParts.join(" • ")}
                  </p>
                  <p className={styles.invSub}>
                    {[money, date].filter(Boolean).join(" • ")}
                  </p>
                </div>
              </div>

              <div className={styles.badges}>
                {it.category ? (
                  <span className={styles.badge}>{it.category}</span>
                ) : null}
                {it.type ? (
                  <span className={styles.badge}>{it.type}</span>
                ) : null}
                {buildStatus ? (
                  <span className={styles.badge}>🧩 {buildStatus}</span>
                ) : null}
                {paintStatus ? (
                  <span className={styles.badge}>🎨 {paintStatus}</span>
                ) : null}
                {(it.tags || []).slice(0, 3).map((t) => (
                  <span key={t} className={styles.badge}>#{t}</span>
                ))}
                {it.quantity && it.quantity !== 1 ? (
                  <span className={styles.badge}>x{it.quantity}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

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
    </>
  );
}
