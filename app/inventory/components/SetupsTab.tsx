"use client";

import { useMemo, useState } from "react";
import styles from "../inventory.module.css";
import { DbItem, DbSetup, DbSetupItem } from "../types";
import { safeText } from "../helpers";
import { supabase } from "../../../lib/supabaseClient";

type Props = {
  items: DbItem[];
  setups: DbSetup[];
  setupItems: DbSetupItem[];
  onSelectItem: (id: string) => void;
  onOpenSetupModal: () => void;
  onReload: () => void;
  session: any;
};

export function SetupsTab({
  items,
  setups,
  setupItems,
  onSelectItem,
  onOpenSetupModal,
  onReload,
  session,
}: Props) {
  const [selectedSetupId,  setSelectedSetupId]  = useState<string | null>(null);
  const [isEditingSetup,   setIsEditingSetup]   = useState(false);
  const [setupEditItemIds, setSetupEditItemIds] = useState<string[]>([]);
  const [showAccessories,  setShowAccessories]  = useState(false);

  // ── Hierarchy helpers ──────────────────────────────────────────────
  const childrenByParent = useMemo(() => {
    const map = new Map<string, DbSetup[]>();
    for (const s of setups) {
      const pid = s.parent_setup_id || "";
      if (!map.has(pid)) map.set(pid, []);
      map.get(pid)!.push(s);
    }
    for (const [, list] of map)
      list.sort((a, b) => a.name.localeCompare(b.name));
    return map;
  }, [setups]);

  const setupsOrdered = useMemo(() => {
    const out: Array<{ setup: DbSetup; depth: number }> = [];
    function walk(parentId: string, depth: number) {
      for (const s of childrenByParent.get(parentId) || []) {
        out.push({ setup: s, depth });
        walk(s.id, depth + 1);
      }
    }
    walk("", 0);
    return out;
  }, [childrenByParent]);

  const selectedSetup = useMemo(
    () => setups.find((s) => s.id === selectedSetupId) ?? null,
    [setups, selectedSetupId]
  );

  function getDescendantSetupIds(rootId: string): string[] {
    const out: string[] = [];
    const stack = [rootId];
    while (stack.length) {
      const cur  = stack.pop()!;
      const kids = childrenByParent.get(cur) || [];
      for (const k of kids) { out.push(k.id); stack.push(k.id); }
    }
    return out;
  }

  const setupItemByKey = useMemo(() => {
    const map = new Map<string, DbSetupItem>();
    for (const si of setupItems)
      map.set(`${si.setup_id}:${si.item_id}`, si);
    return map;
  }, [setupItems]);

  const setupView = useMemo(() => {
    if (!selectedSetup) return { direct: [] as DbItem[], bubbled: [] as DbItem[], accessories: [] as Array<{ setup: DbSetup; items: DbItem[] }> };

    const directIds = new Set(
      setupItems.filter((si) => si.setup_id === selectedSetup.id).map((si) => si.item_id)
    );
    const direct = items.filter((it) => directIds.has(it.id));

    const descendantIds = getDescendantSetupIds(selectedSetup.id);
    const bubbledSet    = new Set<string>();
    const accessories: Array<{ setup: DbSetup; items: DbItem[] }> = [];

    for (const sid of descendantIds) {
      const childSetup = setups.find((s) => s.id === sid);
      if (!childSetup) continue;

      const childLinks  = setupItems.filter((si) => si.setup_id === sid);
      const bubbledIds  = new Set(childLinks.filter((x) =>  x.include_in_parent_summary).map((x) => x.item_id));
      const accessoryIds= new Set(childLinks.filter((x) => !x.include_in_parent_summary).map((x) => x.item_id));

      for (const id of bubbledIds) bubbledSet.add(id);

      const accItems = items.filter((it) => accessoryIds.has(it.id));
      if (accItems.length) accessories.push({ setup: childSetup, items: accItems });
    }

    const bubbled = items.filter((it) => bubbledSet.has(it.id) && !directIds.has(it.id));
    return { direct, bubbled, accessories };
  }, [selectedSetup, setupItems, items, setups, childrenByParent]);

  // ── Actions ────────────────────────────────────────────────────────
  async function toggleIncludeInParent(setupId: string, itemId: string, value: boolean) {
    if (!session?.user?.id) return;
    const { error } = await supabase
      .from("inventory_setup_items")
      .update({ include_in_parent_summary: value })
      .eq("setup_id", setupId)
      .eq("item_id", itemId)
      .eq("user_id", session.user.id);
    if (error) { alert(error.message); return; }
    onReload();
  }

  async function saveSetupEdits() {
    if (!selectedSetup || !session?.user?.id) return;

    const currentIds = setupItems
      .filter((si) => si.setup_id === selectedSetup.id)
      .map((si) => si.item_id);

    const toAdd    = setupEditItemIds.filter((id) => !currentIds.includes(id));
    const toRemove = currentIds.filter((id) => !setupEditItemIds.includes(id));

    if (toRemove.length) {
      const { error } = await supabase
        .from("inventory_setup_items")
        .delete()
        .eq("setup_id", selectedSetup.id)
        .in("item_id", toRemove);
      if (error) { alert(error.message); return; }
    }

    if (toAdd.length) {
      const rows = toAdd.map((itemId, idx) => ({
        user_id:  session.user.id,
        setup_id: selectedSetup.id,
        item_id:  itemId,
        position: currentIds.length + idx + 1,
      }));
      const { error } = await supabase.from("inventory_setup_items").insert(rows);
      if (error) { alert(error.message); return; }
    }

    setIsEditingSetup(false);
    onReload();
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className={styles.setupLayout}>

      {/* Left: setup list */}
      <div>
        <h2 style={{ marginTop: 0 }}>🧩 Your Setups</h2>
        <p className={styles.muted}>Pick a setup to view it like a "nice sheet".</p>

        <button
          className={styles.invBtn}
          style={{ marginBottom: "0.75rem" }}
          onClick={onOpenSetupModal}
        >
          + Add setup
        </button>

        <div className={styles.setupList}>
          {setupsOrdered.map(({ setup: s, depth }) => (
            <div
              key={s.id}
              className={`${styles.setupCard} ${selectedSetupId === s.id ? styles.setupCardActive : ""}`}
              style={{ marginLeft: depth * 14 }}
              onClick={() => {
                setSelectedSetupId(s.id);
                setShowAccessories(false);
                setIsEditingSetup(false);
                setSetupEditItemIds([]);
              }}
            >
              <h3 style={{ margin: 0 }}>{s.name}</h3>
              {s.description && (
                <p className={styles.muted} style={{ margin: "0.35rem 0 0" }}>
                  {s.description}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: setup detail */}
      <div>
        {!selectedSetup ? (
          <div className={`${styles.setupDetail} ${styles.setupDetailEmpty}`}>
            <div>
              <h2>Select a setup</h2>
              <p className={styles.muted}>
                Examples: "Desk / PC Setup", "Living Room TV", "Lighting", etc.
              </p>
            </div>
          </div>
        ) : (
          <div className={styles.setupDetail}>
            <h2 style={{ marginTop: 0 }}>{selectedSetup.name}</h2>
            {selectedSetup.description && (
              <p className={styles.muted} style={{ marginTop: "0.25rem" }}>
                {selectedSetup.description}
              </p>
            )}

            {/* Edit controls */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
              <button
                className={styles.invBtn}
                onClick={() => {
                  setIsEditingSetup(true);
                  setSetupEditItemIds(
                    setupItems
                      .filter((si) => si.setup_id === selectedSetup.id)
                      .map((si) => si.item_id)
                  );
                }}
              >
                ✏ Edit setup items
              </button>
              {isEditingSetup && (
                <button className={styles.invBtn} onClick={() => setIsEditingSetup(false)}>
                  Cancel edit
                </button>
              )}
            </div>

            <h3 style={{ marginTop: "1rem" }}>Core items</h3>

            {/* Edit mode: item picker */}
            {isEditingSetup && (
              <div style={{ marginTop: "0.75rem" }}>
                <div className={styles.muted} style={{ marginBottom: "0.35rem" }}>
                  Tick items to include in this setup
                </div>
                <div
                  style={{
                    maxHeight: 260, overflow: "auto",
                    border: "1px solid rgba(0,0,0,0.12)",
                    borderRadius: 12, padding: 10,
                  }}
                >
                  {items
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((it) => (
                      <label
                        key={it.id}
                        style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 4px" }}
                      >
                        <input
                          type="checkbox"
                          checked={setupEditItemIds.includes(it.id)}
                          onChange={(e) => {
                            setSetupEditItemIds((prev) =>
                              e.target.checked
                                ? [...prev, it.id]
                                : prev.filter((x) => x !== it.id)
                            );
                          }}
                        />
                        <span style={{ fontWeight: 700 }}>{it.name}</span>
                        <span className={styles.muted} style={{ fontSize: "0.9rem" }}>
                          {[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                        </span>
                      </label>
                    ))}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem" }}>
                  <button className={styles.invBtn} onClick={saveSetupEdits}>
                    Save setup items
                  </button>
                  <button
                    className={styles.invBtn}
                    onClick={() => { setIsEditingSetup(false); setSetupEditItemIds([]); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Item rows */}
            <div className={styles.setupItems}>
              {[...setupView.direct, ...setupView.bubbled].map((it) => {
                const canBubbleUp = !!selectedSetup.parent_setup_id;
                const si = setupItemByKey.get(`${selectedSetup.id}:${it.id}`);

                return (
                  <div
                    key={it.id}
                    className={styles.setupItemRow}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectItem(it.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") onSelectItem(it.id);
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", width: "100%" }}>
                      {it.images?.[0] ? (
                        <img className={styles.invThumb} src={it.images[0]} alt="" />
                      ) : (
                        <div className={styles.invThumb} aria-hidden="true" />
                      )}

                      <div>
                        <div style={{ fontWeight: 800 }}>{it.name}</div>
                        <div className={styles.muted} style={{ fontSize: "0.95rem" }}>
                          {[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                        </div>
                        {canBubbleUp && si?.include_in_parent_summary && (
                          <div className={styles.muted} style={{ fontSize: "0.85rem" }}>
                            Shown in parent setup
                          </div>
                        )}
                        {!canBubbleUp && setupView.bubbled.some((x) => x.id === it.id) && (
                          <div className={styles.muted} style={{ fontSize: "0.85rem" }}>
                            ⤴ From sub-setup
                          </div>
                        )}
                      </div>

                      {canBubbleUp && si && (
                        <label
                          className={styles.muted}
                          style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap", paddingLeft: 12 }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={!!si.include_in_parent_summary}
                            onChange={(e) =>
                              toggleIncludeInParent(selectedSetup.id, it.id, e.target.checked)
                            }
                          />
                          Show in parent setup
                        </label>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Accessories */}
            {!!setupView.accessories.length && (
              <div style={{ marginTop: "1rem" }}>
                <button
                  className={styles.invBtn}
                  onClick={() => setShowAccessories((v) => !v)}
                >
                  {showAccessories
                    ? "Hide accessories"
                    : `Show accessories (${setupView.accessories.reduce((n, g) => n + g.items.length, 0)})`}
                </button>

                {showAccessories && (
                  <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.75rem" }}>
                    {setupView.accessories.map(({ setup, items: accItems }) => (
                      <div
                        key={setup.id}
                        className={`${styles.invCard} ${styles.accessoryCard}`}
                        style={{ padding: "0.75rem" }}
                      >
                        <div style={{ fontWeight: 800 }}>{setup.name}</div>
                        <div className={styles.muted} style={{ fontSize: "0.9rem" }}>Extra items</div>
                        <div style={{ marginTop: "0.5rem", display: "grid", gap: "0.5rem" }}>
                          {accItems.map((it) => (
                            <div
                              key={it.id}
                              className={styles.setupItemRow}
                              style={{ padding: "0.55rem", opacity: 0.9 }}
                              role="button"
                              tabIndex={0}
                              onClick={() => onSelectItem(it.id)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" || e.key === " ") onSelectItem(it.id);
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
                                  <div className={styles.muted} style={{ fontSize: "0.9rem" }}>
                                    {[it.brand, it.model].filter(Boolean).map(safeText).join(" • ")}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
