"use client";

import { useState } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { DbItem } from "../types";
import { Modal } from "./Modal";
import { slugifyId } from "../helpers";
import styles from "../inventory.module.css";
import m from "./ItemModal.module.css";

type Props = {
  open: boolean;
  parent: DbItem | null;
  allItems: DbItem[];
  onClose: () => void;
  onSaved: () => void;
  session: any;
};

type UnitRow = {
  name: string;
  quantity: string;
  unitType: string;
  faction: string;
  subfaction: string;
  buildStatus: string;
  paintStatus: string;
  notes: string;
  overridePrice: string;
};

function emptyRow(): UnitRow {
  return {
    name: "", quantity: "1", unitType: "", faction: "",
    subfaction: "", buildStatus: "", paintStatus: "",
    notes: "", overridePrice: "",
  };
}

function wargameSuggest(allItems: DbItem[], field: string): string[] {
  const vals = allItems
    .filter((i) => (i.category ?? "").trim().toLowerCase() === "wargame")
    .map((i) => i.specs?.wargame?.[field] ?? "")
    .filter(Boolean) as string[];
  return [...new Set(vals)].sort((a, b) => a.localeCompare(b));
}

function statusSuggest(allItems: DbItem[], field: "buildStatus" | "paintStatus"): string[] {
  const vals = allItems
    .filter((i) => (i.category ?? "").trim().toLowerCase() === "wargame")
    .map((i) => i.specs?.[field] ?? "")
    .filter(Boolean) as string[];
  return [...new Set(vals)].sort((a, b) => a.localeCompare(b));
}

function DL({ id, options }: { id: string; options: string[] }) {
  return (
    <datalist id={id}>
      {options.map((o) => <option key={o} value={o} />)}
    </datalist>
  );
}

export function ChildCreatorModal({
  open, parent, allItems, onClose, onSaved, session,
}: Props) {
  const [rows,    setRows]    = useState<UnitRow[]>([emptyRow()]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const suggestFactions    = wargameSuggest(allItems, "faction");
  const suggestSubfactions = wargameSuggest(allItems, "subfaction");
  const suggestUnitTypes   = wargameSuggest(allItems, "unitType");
  const suggestBuild       = statusSuggest(allItems, "buildStatus");
  const suggestPaint       = statusSuggest(allItems, "paintStatus");

  function setRow(idx: number, patch: Partial<UnitRow>) {
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }

  function addRow() {
    // Pre-fill faction/subfaction from first row if available
    const first = rows[0];
    setRows((prev) => [...prev, {
      ...emptyRow(),
      faction:    first?.faction    ?? "",
      subfaction: first?.subfaction ?? "",
    }]);
  }

  function removeRow(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleCreate() {
    if (!session?.user?.id || !parent) return;
    setError(null);

    const valid = rows.filter((r) => r.name.trim());
    if (!valid.length) {
      setError("Add at least one unit with a name.");
      return;
    }

    setSaving(true);
    try {
      const payloads = valid.map((row) => {
        // Generate a unique id from parent id + unit name
        const baseId = slugifyId(`${parent.id}-${row.name}`);
        // Make sure it's unique among existing items
        let id = baseId;
        let suffix = 2;
        while (allItems.some((x) => x.id === id)) {
          id = `${baseId}-${suffix++}`;
        }

        const price = row.overridePrice !== ""
          ? Number(row.overridePrice)
          : parent.purchase?.price ?? null;

        return {
          id,
          user_id:   session.user.id,
          parent_id: parent.id,
          name:      row.name.trim(),
          category:  parent.category,
          type:      parent.type,
          brand:     parent.brand,
          model:     null,
          quantity:  Number(row.quantity) || 1,
          location:  parent.location,
          tags:      parent.tags || [],
          notes:     row.notes.trim() || null,
          images:    [],
          purchase:  {
            date:     parent.purchase?.date     ?? null,
            price,
            currency: parent.purchase?.currency ?? "SEK",
            store:    parent.purchase?.store    ?? null,
            orderRef: parent.purchase?.orderRef ?? null,
            orderId:  parent.purchase?.orderId  ?? null,
          },
          specs: {
            buildStatus: row.buildStatus || undefined,
            paintStatus: row.paintStatus || undefined,
            wargame: {
              system:     parent.specs?.wargame?.system     ?? undefined,
              faction:    row.faction    || undefined,
              subfaction: row.subfaction || undefined,
              unitType:   row.unitType   || undefined,
              baseSize:   parent.specs?.wargame?.baseSize   ?? undefined,
              scale:      parent.specs?.wargame?.scale      ?? undefined,
            },
          },
          purchase_history: [],
        };
      });

      const { error: dbErr } = await supabase
        .from("inventory_items")
        .insert(payloads);

      if (dbErr) throw new Error(dbErr.message);

      setRows([emptyRow()]);
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setRows([emptyRow()]);
    setError(null);
    onClose();
  }

  if (!parent) return null;

  const isWargame = (parent.category ?? "").trim().toLowerCase() === "wargame";

  return (
    <Modal open={open} onClose={handleClose}>
      <div>
        <h2 style={{ marginTop: 0 }}>Add units to {parent.name}</h2>

        {/* Inherited purchase info */}
        <div style={{
          background: "rgba(0,0,0,0.03)",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 10,
          padding: "0.65rem 0.85rem",
          marginBottom: "1rem",
          fontSize: "0.88rem",
          display: "flex",
          gap: "1.5rem",
          flexWrap: "wrap",
        }}>
          <span className={styles.muted}>
            Inherited from parent:
          </span>
          {parent.purchase?.date && (
            <span><b>Date:</b> {parent.purchase.date}</span>
          )}
          {parent.purchase?.store && (
            <span><b>Store:</b> {parent.purchase.store}</span>
          )}
          {parent.purchase?.price != null && (
            <span><b>Price:</b> {parent.purchase.price} {parent.purchase.currency ?? ""}</span>
          )}
          {parent.purchase?.orderId && (
            <span><b>OrderId:</b> {parent.purchase.orderId}</span>
          )}
          {isWargame && parent.specs?.wargame?.system && (
            <span><b>System:</b> {parent.specs.wargame.system}</span>
          )}
        </div>

        {/* Datalists */}
        <DL id="cc-faction"    options={suggestFactions} />
        <DL id="cc-subfaction" options={suggestSubfactions} />
        <DL id="cc-unitType"   options={suggestUnitTypes} />
        <DL id="cc-build"      options={suggestBuild} />
        <DL id="cc-paint"      options={suggestPaint} />

        {/* Unit rows */}
        <div style={{ display: "grid", gap: "0.85rem" }}>
          {rows.map((row, idx) => (
            <div key={idx} style={{
              border: "1px solid rgba(0,0,0,0.09)",
              borderRadius: 12,
              padding: "0.85rem",
              position: "relative",
            }}>
              {/* Row number + remove */}
              <div style={{
                display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: "0.6rem",
              }}>
                <span style={{ fontWeight: 700, fontSize: "0.85rem", opacity: 0.6 }}>
                  Unit {idx + 1}
                </span>
                {rows.length > 1 && (
                  <button
                    className={styles.invBtn}
                    style={{ padding: "0.25rem 0.6rem", fontSize: "0.8rem" }}
                    onClick={() => removeRow(idx)}
                  >
                    ✕ Remove
                  </button>
                )}
              </div>

              {/* Row 1: Name + Quantity */}
              <div className={m.fieldRow} style={{ marginBottom: "0.6rem" }}>
                <label>
                  <div className={m.fieldLabel}>Unit name *</div>
                  <input
                    className={styles.invInput}
                    value={row.name}
                    onChange={(e) => setRow(idx, { name: e.target.value })}
                    placeholder="e.g. Clanrats"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  <div className={m.fieldLabel}>Quantity</div>
                  <input
                    className={styles.invInput}
                    type="number"
                    value={row.quantity}
                    onChange={(e) => setRow(idx, { quantity: e.target.value })}
                    style={{ width: "100%" }}
                  />
                </label>
              </div>

              {/* Row 2: Wargame fields (only if parent is wargame) */}
              {isWargame && (
                <div className={m.fieldRow4} style={{ marginBottom: "0.6rem" }}>
                  <label>
                    <div className={m.fieldLabel}>Faction</div>
                    <input
                      className={styles.invInput}
                      list="cc-faction"
                      value={row.faction}
                      onChange={(e) => setRow(idx, { faction: e.target.value })}
                      placeholder={parent.specs?.wargame?.faction ?? ""}
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label>
                    <div className={m.fieldLabel}>Sub-faction</div>
                    <input
                      className={styles.invInput}
                      list="cc-subfaction"
                      value={row.subfaction}
                      onChange={(e) => setRow(idx, { subfaction: e.target.value })}
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label>
                    <div className={m.fieldLabel}>Unit type</div>
                    <input
                      className={styles.invInput}
                      list="cc-unitType"
                      value={row.unitType}
                      onChange={(e) => setRow(idx, { unitType: e.target.value })}
                      placeholder="e.g. Infantry"
                      style={{ width: "100%" }}
                    />
                  </label>
                  <label>
                    <div className={m.fieldLabel}>Price override</div>
                    <input
                      className={styles.invInput}
                      type="number"
                      value={row.overridePrice}
                      onChange={(e) => setRow(idx, { overridePrice: e.target.value })}
                      placeholder={
                        parent.purchase?.price != null
                          ? `From parent: ${parent.purchase.price} ${parent.purchase.currency ?? ""}`.trim()
                          : "Leave blank to inherit"
                      }
                      style={{ width: "100%" }}
                    />
                  </label>
                </div>
              )}

              {/* Row 3: Build + Paint status */}
              <div className={m.fieldRow} style={{ marginBottom: "0.6rem" }}>
                <label>
                  <div className={m.fieldLabel}>Build status</div>
                  <input
                    className={styles.invInput}
                    list="cc-build"
                    value={row.buildStatus}
                    onChange={(e) => setRow(idx, { buildStatus: e.target.value })}
                    placeholder="e.g. assembled"
                    style={{ width: "100%" }}
                  />
                </label>
                <label>
                  <div className={m.fieldLabel}>Paint status</div>
                  <input
                    className={styles.invInput}
                    list="cc-paint"
                    value={row.paintStatus}
                    onChange={(e) => setRow(idx, { paintStatus: e.target.value })}
                    placeholder="e.g. unpainted"
                    style={{ width: "100%" }}
                  />
                </label>
              </div>

              {/* Notes */}
              <label>
                <div className={m.fieldLabel}>Notes</div>
                <input
                  className={styles.invInput}
                  value={row.notes}
                  onChange={(e) => setRow(idx, { notes: e.target.value })}
                  placeholder="Optional"
                  style={{ width: "100%" }}
                />
              </label>
            </div>
          ))}
        </div>

        {/* Add row button */}
        <button
          className={styles.invBtn}
          style={{ marginTop: "0.75rem", width: "100%" }}
          onClick={addRow}
        >
          + Add another unit
        </button>

        {error && (
          <p style={{ color: "crimson", marginTop: "0.5rem", fontSize: "0.88rem" }}>
            {error}
          </p>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
          <button
            className={styles.invBtn}
            onClick={handleCreate}
            disabled={saving}
          >
            {saving
              ? "Creating…"
              : `Create ${rows.filter((r) => r.name.trim()).length || ""} unit${rows.filter((r) => r.name.trim()).length === 1 ? "" : "s"}`}
          </button>
          <button className={styles.invBtn} onClick={handleClose} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
