import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "../../lib/prisma";

// Types used locally to keep TS happy during mapping
type TxRow = {
  id: string;
  occurredAt: Date;
  transactionType: string;
  quantityKg: number | string | null;
  notes: string | null;
  gas?: { code?: string } | null;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { serial } = req.query;

  if (!serial || typeof serial !== "string") {
    return res.status(400).json({ error: "Serial number is required" });
  }

  try {
    const bottle = await prisma.bottle.findUnique({
      where: { serial },
      include: {
        gas: true, // Gas relation on Bottle
        transactions: {
          orderBy: { occurredAt: "asc" },
          include: { gas: true }, // Gas relation on each Transaction
        },
      },
    });

    if (!bottle) {
      return res.status(404).json({ error: "Bottle not found" });
    }

    // Cast once so our map/filter/reduce callbacks are typed
    const txs = bottle.transactions as unknown as TxRow[];

    const openingBalanceKg = Number((bottle as any).openingBalanceKg ?? 0);

    // Compute current balance with a simple loop (avoids reduce typing issues)
    let currentQuantityKg = openingBalanceKg;
    for (const t of txs) currentQuantityKg += Number(t.quantityKg ?? 0);

    // Build the ledger rows (typed map callback)
    const ledger = txs.map((t: TxRow) => ({
      id: t.id,
      occurredAt: t.occurredAt,
      type: t.transactionType,
      gas: t.gas?.code ?? bottle.gas?.code ?? null,
      quantityKg: Number(t.quantityKg ?? 0),
      notes: t.notes ?? null,
    }));

    return res.json({
      serial: bottle.serial,
      status: "active",
      gas: bottle.gas?.code ?? null,
      openingBalanceKg,
      currentQuantityKg,
      ledger,
    });
  } catch (e: any) {
    console.error("Error in bottles API:", e);
    return res.status(500).json({ error: e.message || "Server error" });
  }
}
