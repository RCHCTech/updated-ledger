import { useEffect, useState } from "react";

type Transaction = {
  id: string;
  occurredAt: string;
  type: string;
  gas: string | null;
  quantityKg: number;
  notes?: string | null;
};

type Bottle = {
  serial: string;
  gas: string | null;
  currentQuantityKg: number;
  openingBalanceKg: number;
  ledger: Transaction[];
};

const GAS_OPTIONS = [
  "R410A",
  "R32",
  "R134a",
  "R404A",
  "R407C",
  "R1234yf",
  "R290",
  "R600a",
  "R22",
  "MIX",
];

const TX_TYPES = [
  "charge",
  "recover",
  "fill",
  "return",
  "transfer_in",
  "transfer_out",
  "reversal",
];

export default function Home() {
  // Form state
  const [serial, setSerial] = useState("");
  const [gasCode, setGasCode] = useState(GAS_OPTIONS[0]);
  const [transactionType, setTransactionType] = useState("charge");
  const [quantityKg, setQuantityKg] = useState<string>("");
  const [notes, setNotes] = useState("");

  // Data state
  const [bottle, setBottle] = useState<Bottle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load bottle if serial is already filled (optional)
  useEffect(() => {
    // no auto-fetch on mount to avoid 404s with empty serial
  }, []);

  async function fetchBottle() {
    setError(null);
    if (!serial) {
      setBottle(null);
      return;
    }
    try {
      const res = await fetch(`/api/bottles?serial=${encodeURIComponent(serial)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to load bottle");
      setBottle(data);
      // If server reports a bottle gas, default gas selector to it for convenience
      if (data?.gas && GAS_OPTIONS.includes(data.gas)) {
        setGasCode(data.gas);
      }
    } catch (e: any) {
      setBottle(null);
      setError(e.message);
    }
  }

  async function submitTransaction() {
    setError(null);
    if (!serial) return setError("Please enter a bottle serial.");
    const qty = parseFloat(quantityKg);
    if (!isFinite(qty) || qty <= 0) return setError("Enter a valid positive quantity (kg).");

    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serial,
          gasCode,
          transactionType,
          quantityKg: qty,
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create transaction");
      // keep serial & gasCode; clear qty/notes for fast repeat entry
      setQuantityKg("");
      setNotes("");
      await fetchBottle();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTx(id: string) {
    if (!confirm("Delete this transaction? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Delete failed (HTTP ${res.status})`);
      await fetchBottle();
    } catch (e: any) {
      alert(e.message || "Delete failed");
    }
  }

  async function editTx(row: Transaction) {
    // type
    const newType = prompt(
      `Type (${TX_TYPES.join(", ")}):`,
      row.type
    );
    if (!newType) return;

    // quantity (absolute value; server will sign by type)
    const newQtyStr = prompt("Quantity (kg):", String(Math.abs(row.quantityKg)));
    if (!newQtyStr) return;
    const newQty = Number(newQtyStr);
    if (!isFinite(newQty) || newQty <= 0) {
      alert("Quantity must be a positive number.");
      return;
    }

    // optionally allow changing gas code
    const newGas = prompt(
      `Gas code (leave blank to keep "${row.gas ?? bottle?.gas ?? ""}"):\n` +
        `Common: ${GAS_OPTIONS.join(", ")}`,
      row.gas ?? bottle?.gas ?? ""
    );

    // notes (optional)
    const newNotes = prompt("Notes (optional):", row.notes ?? "");

    try {
      const res = await fetch(`/api/transactions/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionType: newType,
          quantityKg: newQty,
          gasCode: newGas && newGas.trim().length ? newGas.trim() : undefined,
          notes: newNotes ?? undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `Edit failed (HTTP ${res.status})`);
      await fetchBottle();
    } catch (e: any) {
      alert(e.message || "Edit failed");
    }
  }

  return (
    <main style={{ padding: 20 }}>
      <h1>RCHC Refrigerant Bottle Ledger</h1>

      {/* Error notice */}
      {error && (
        <p style={{ color: "red", marginTop: 8 }}>Error: {error}</p>
      )}

      {/* Bottle quick search + refresh */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ marginBottom: 8 }}>
          <label>
            Bottle Serial:&nbsp;
            <input
              value={serial}
              onChange={(e) => setSerial(e.target.value)}
              placeholder="e.g. CYL-001928"
            />
          </label>
          <button onClick={fetchBottle} style={{ marginLeft: 8 }}>
            Load / Refresh
          </button>
        </div>
        {bottle && (
          <div style={{ fontSize: 14, color: "#444" }}>
            Loaded bottle: <b>{bottle.serial}</b> • Gas: <b>{bottle.gas ?? "N/A"}</b> •
            &nbsp;Current: <b>{bottle.currentQuantityKg.toFixed(3)} kg</b>
          </div>
        )}
      </div>

      {/* Add Transaction form */}
      <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 6 }}>
        <h3>Add Transaction</h3>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <div>
            <label>
              Gas:&nbsp;
              <select value={gasCode} onChange={(e) => setGasCode(e.target.value)}>
                {GAS_OPTIONS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Type:&nbsp;
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value)}
              >
                {TX_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </label>
          </div>
          <div>
            <label>
              Quantity (kg):&nbsp;
              <input
                type="number"
                step="0.001"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="e.g. 2.500"
              />
            </label>
          </div>
          <div style={{ flex: 1, minWidth: 240 }}>
            <label>
              Notes:&nbsp;
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="optional"
                style={{ width: "100%" }}
              />
            </label>
          </div>
        </div>
        <div style={{ marginTop: 10 }}>
          <button onClick={submitTransaction} disabled={loading}>
            {loading ? "Submitting..." : "Submit Transaction"}
          </button>
        </div>
      </div>

      {/* Ledger */}
      {bottle ? (
        <div style={{ marginTop: 20 }}>
          <h3>Transaction Ledger</h3>
          <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr>
                <th>Date/Time</th>
                <th>Type</th>
                <th>Gas</th>
                <th style={{ textAlign: "right" }}>Qty (kg)</th>
                <th>Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bottle.ledger.map((tx) => (
                <tr key={tx.id}>
                  <td>{new Date(tx.occurredAt).toLocaleString()}</td>
                  <td>{tx.type}</td>
                  <td>{tx.gas ?? ""}</td>
                  <td style={{ textAlign: "right" }}>{tx.quantityKg.toFixed(3)}</td>
                  <td>{tx.notes ?? ""}</td>
                  <td>
                    <button onClick={() => editTx(tx)}>Edit</button>{" "}
                    <button onClick={() => deleteTx(tx.id)}>Delete</button>
                  </td>
                </tr>
              ))}
              {bottle.ledger.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "#666" }}>
                    No transactions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p style={{ marginTop: 12 }}>No bottle loaded. Enter a serial and click “Load / Refresh”.</p>
      )}
    </main>
  );
}
