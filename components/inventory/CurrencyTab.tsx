"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface CurrencyTabProps {
  characterId: string;
  currency: any;
  onUpdate: () => void;
}

const CURRENCY_META = [
  { key: "platinum", label: "Platinum", abbr: "pp", icon: "💎", bg: "#f9fafb", border: "#c7d2fe", coinBg: "linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)", rate: "1 pp = 10 gp" },
  { key: "gold",     label: "Gold",     abbr: "gp", icon: "🪙", bg: "#fffbeb", border: "#fbbf24", coinBg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)", rate: "Base currency" },
  { key: "silver",   label: "Silver",   abbr: "sp", icon: "⚪", bg: "#f9fafb", border: "#d1d5db", coinBg: "linear-gradient(135deg, #f3f4f6 0%, #e5e7eb 100%)", rate: "1 sp = 0.1 gp" },
  { key: "copper",   label: "Copper",   abbr: "cp", icon: "🟤", bg: "#fef2f2", border: "#fca5a5", coinBg: "linear-gradient(135deg, #fed7aa 0%, #fdba74 100%)", rate: "1 cp = 0.01 gp" },
];

export function CurrencyTab({ characterId, currency, onUpdate }: CurrencyTabProps) {
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [txType, setTxType] = useState<"receive" | "pay">("receive");
  const [txPlatinum, setTxPlatinum] = useState(0);
  const [txGold, setTxGold] = useState(0);
  const [txSilver, setTxSilver] = useState(0);
  const [txCopper, setTxCopper] = useState(0);
  const [txNote, setTxNote] = useState("");
  const [txSaving, setTxSaving] = useState(false);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, [characterId]);

  async function loadTransactions() {
    setLoadingTx(true);
    const { data } = await supabase
      .from("character_currency_transactions")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(50);
    setTransactions(data || []);
    setLoadingTx(false);
  }

  function openTransactionModal(type: "receive" | "pay") {
    setTxType(type);
    setTxPlatinum(0);
    setTxGold(0);
    setTxSilver(0);
    setTxCopper(0);
    setTxNote("");
    setShowTransactionModal(true);
  }

  async function handleTransaction() {
    if (txPlatinum === 0 && txGold === 0 && txSilver === 0 && txCopper === 0) {
      alert("Enter an amount for at least one currency.");
      return;
    }
    setTxSaving(true);

    const sign = txType === "receive" ? 1 : -1;

    const newValues = {
      platinum: Math.max(0, (currency?.platinum || 0) + sign * txPlatinum),
      gold:     Math.max(0, (currency?.gold     || 0) + sign * txGold),
      silver:   Math.max(0, (currency?.silver   || 0) + sign * txSilver),
      copper:   Math.max(0, (currency?.copper   || 0) + sign * txCopper),
    };

    const { error: currError } = await supabase
      .from("character_currency")
      .update(newValues)
      .eq("character_id", characterId);

    if (currError) {
      alert("Error updating currency: " + currError.message);
      setTxSaving(false);
      return;
    }

    await supabase.from("character_currency_transactions").insert({
      character_id: characterId,
      platinum: sign * txPlatinum,
      gold:     sign * txGold,
      silver:   sign * txSilver,
      copper:   sign * txCopper,
      note: txNote || (txType === "receive" ? "Received" : "Paid"),
      transaction_type: "manual",
    });

    setShowTransactionModal(false);
    loadTransactions();
    onUpdate();
    setTxSaving(false);
  }

  const totalGp =
    (currency?.platinum || 0) * 10 +
    (currency?.gold     || 0) +
    (currency?.silver   || 0) / 10 +
    (currency?.copper   || 0) / 100;

  function formatTxAmount(tx: any) {
    const parts: string[] = [];
    if (tx.platinum) parts.push(`${tx.platinum > 0 ? "+" : ""}${tx.platinum} pp`);
    if (tx.gold)     parts.push(`${tx.gold > 0 ? "+" : ""}${tx.gold} gp`);
    if (tx.silver)   parts.push(`${tx.silver > 0 ? "+" : ""}${tx.silver} sp`);
    if (tx.copper)   parts.push(`${tx.copper > 0 ? "+" : ""}${tx.copper} cp`);
    return parts.join(", ") || "0";
  }

  function txIsPositive(tx: any) {
    return (tx.platinum * 10 + tx.gold + tx.silver / 10 + tx.copper / 100) >= 0;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div style={{ display: "grid", gap: "2rem" }}>

      {/* Total Wealth */}
      <div style={{ background: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)", color: "white", borderRadius: "12px", padding: "2rem", textAlign: "center" }}>
        <div style={{ fontSize: "0.9rem", opacity: 0.9, marginBottom: "0.5rem" }}>Total Wealth</div>
        <div style={{ fontSize: "3rem", fontWeight: 700 }}>{totalGp.toFixed(2)} gp</div>
      </div>

      {/* Currency Cards */}
      <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0 }}>Currency</h3>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button onClick={() => openTransactionModal("receive")}
              style={{ padding: "0.6rem 1.25rem", background: "#10b981", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
              + Receive
            </button>
            <button onClick={() => openTransactionModal("pay")}
              style={{ padding: "0.6rem 1.25rem", background: "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
              − Pay
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: "1rem" }}>
          {CURRENCY_META.map(({ key, label, abbr, icon, bg, border, coinBg, rate }) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "1.25rem 1.5rem", background: bg, borderRadius: "8px", border: `2px solid ${border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: coinBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem" }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "1.05rem" }}>{label}</div>
                  <div style={{ fontSize: "0.82rem", color: "#666" }}>{rate}</div>
                </div>
              </div>
              <div style={{ fontSize: "2rem", fontWeight: 700 }}>
                {currency?.[key] || 0} <span style={{ fontSize: "1rem", color: "#666", fontWeight: 400 }}>{abbr}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction History */}
      <div style={{ background: "white", border: "1px solid #ddd", borderRadius: "12px", padding: "2rem" }}>
        <h3 style={{ margin: "0 0 1.5rem 0" }}>📜 Transaction History</h3>
        {loadingTx ? (
          <div style={{ textAlign: "center", color: "#666", padding: "2rem" }}>Loading...</div>
        ) : transactions.length === 0 ? (
          <div style={{ textAlign: "center", color: "#999", padding: "2rem", background: "#f9fafb", borderRadius: "8px" }}>
            No transactions yet. Use Receive or Pay to record currency changes.
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {transactions.map(tx => (
              <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: txIsPositive(tx) ? "#f0fdf4" : "#fef2f2", borderRadius: "8px", border: `1px solid ${txIsPositive(tx) ? "#86efac" : "#fca5a5"}` }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>{tx.note}</div>
                  <div style={{ fontSize: "0.8rem", color: "#666", marginTop: "0.15rem" }}>{formatDate(tx.created_at)}</div>
                </div>
                <div style={{ fontWeight: 700, color: txIsPositive(tx) ? "#10b981" : "#ef4444", fontSize: "0.95rem", textAlign: "right" }}>
                  {formatTxAmount(tx)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Conversion Guide */}
      <div style={{ padding: "1.5rem", background: "#f0f9ff", border: "1px solid #bfdbfe", borderRadius: "12px" }}>
        <h4 style={{ marginTop: 0, marginBottom: "1rem" }}>💡 Conversion Guide</h4>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", fontSize: "0.9rem" }}>
          <div>1 platinum = 10 gold</div>
          <div>1 gold = 10 silver</div>
          <div>1 silver = 10 copper</div>
          <div>1 platinum = 100 silver</div>
          <div>1 platinum = 1,000 copper</div>
          <div>1 gold = 100 copper</div>
        </div>
      </div>

      {/* Transaction Modal */}
      {showTransactionModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 }}
          onClick={() => setShowTransactionModal(false)}>
          <div style={{ background: "white", borderRadius: "12px", padding: "2rem", maxWidth: "480px", width: "90%" }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ marginTop: 0, color: txType === "receive" ? "#10b981" : "#ef4444" }}>
              {txType === "receive" ? "💰 Receive Currency" : "💸 Pay Currency"}
            </h2>

            <div style={{ display: "grid", gap: "1rem", marginBottom: "1.5rem" }}>
              {CURRENCY_META.map(({ key, label, abbr, icon }) => {
                const vals: Record<string, number> = { platinum: txPlatinum, gold: txGold, silver: txSilver, copper: txCopper };
                const setters: Record<string, (v: number) => void> = { platinum: setTxPlatinum, gold: setTxGold, silver: setTxSilver, copper: setTxCopper };
                return (
                  <div key={key} style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <span style={{ fontSize: "1.4rem", width: "32px", textAlign: "center" }}>{icon}</span>
                    <label style={{ fontWeight: 600, width: "76px" }}>{label}</label>
                    <input type="number" min="0" value={vals[key]}
                      onChange={e => setters[key](parseInt(e.target.value) || 0)}
                      style={{ flex: 1, padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem", textAlign: "right" }} />
                    <span style={{ color: "#666", width: "28px" }}>{abbr}</span>
                  </div>
                );
              })}

              <div>
                <label style={{ display: "block", fontWeight: 600, marginBottom: "0.4rem" }}>Note</label>
                <input type="text" value={txNote} onChange={e => setTxNote(e.target.value)}
                  placeholder={txType === "receive" ? "e.g. Reward for quest X" : "e.g. Bought bag of holding"}
                  style={{ width: "100%", padding: "0.6rem", border: "1px solid #ddd", borderRadius: "6px", fontSize: "1rem" }} />
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button onClick={handleTransaction} disabled={txSaving}
                style={{ flex: 1, padding: "0.75rem", background: txType === "receive" ? "#10b981" : "#ef4444", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                {txSaving ? "Saving..." : txType === "receive" ? "Receive" : "Pay"}
              </button>
              <button onClick={() => setShowTransactionModal(false)}
                style={{ padding: "0.75rem 1.5rem", background: "#eee", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: 600 }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
